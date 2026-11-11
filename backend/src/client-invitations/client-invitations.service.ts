import { BadGatewayException, ConflictException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager, LessThan, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { ClientRole } from '../common/enums/client-role.enum';
import { MailService, smtpReason } from '../mail/mail.service';
import { InvitationStatus } from '../invitations/entities/user-invitation.entity';
import { ClientInvitation } from './entities/client-invitation.entity';
import { AcceptClientInvitationDto } from './dto/client-invitation.dto';

const SALT_ROUNDS = 10;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const isDuplicateKey = (err: unknown) => (err as { code?: string })?.code === 'ER_DUP_ENTRY';
const withCode = (statusCode: number, error: string, code: string, message: string) => ({ statusCode, error, code, message });
const conflict = (code: string, message: string) => new ConflictException(withCode(409, 'Conflict', code, message));
const gone = (code: string, message: string) => new GoneException(withCode(410, 'Gone', code, message));
const personName = (u?: Pick<User, 'firstName' | 'lastName'> | null) => (u ? `${u.firstName} ${u.lastName}` : null);

// Invitations CLIENT : même schéma de sécurité que les invitations techniciens (jeton haché, TTL,
// une seule invitation pending par email, annulation, acceptation transactionnelle), table dédiée.
@Injectable()
export class ClientInvitationsService {
  private readonly logger = new Logger(ClientInvitationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    @InjectRepository(ClientInvitation) private readonly invitations: Repository<ClientInvitation>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // ------------------------------------------------------------- PMO : création / liste / annulation

  async create(email: string, invitedById: number) {
    if (await this.users.findOne({ where: { email } })) {
      throw conflict('EMAIL_ALREADY_REGISTERED', 'Un compte existe déjà avec cet email.');
    }
    // Libère l'emplacement « pending » d'une ancienne invitation expirée (expiration paresseuse).
    await this.invitations.update(
      { email, status: InvitationStatus.PENDING, expiresAt: LessThan(new Date()) },
      { status: InvitationStatus.EXPIRED },
    );

    // Une seule invitation en attente par email (vérifié ici ; renforcé en base par la migration 007, facultative).
    if (await this.invitations.findOne({ where: { email, status: InvitationStatus.PENDING } })) {
      throw conflict('INVITATION_ALREADY_PENDING', 'Une invitation est déjà en attente pour cet email : annulez-la d’abord.');
    }

    const token = randomBytes(32).toString('base64url');
    const ttlHours = this.config.get<number>('invitation.ttlHours') ?? 72;
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000);

    let saved: ClientInvitation;
    try {
      saved = await this.invitations.save(
        this.invitations.create({ id: randomUUID(), email, tokenHash: hashToken(token), status: InvitationStatus.PENDING, invitedById, expiresAt }),
      );
    } catch (err) {
      if (isDuplicateKey(err)) {
        throw conflict('INVITATION_ALREADY_PENDING', 'Une invitation est déjà en attente pour cet email : annulez-la d’abord.');
      }
      throw err;
    }

    const inviter = await this.users.findOne({ where: { id: invitedById } });
    const link = `${this.config.get<string>('frontend.baseUrl')}/invite/client?token=${token}`;
    let mode: 'smtp' | 'log';
    try {
      ({ mode } = await this.mail.sendClientInvitation({ to: email, link, invitedBy: personName(inviter), expiresAt }));
    } catch (err) {
      await this.invitations.delete({ id: saved.id });
      this.logger.error(`Échec d'envoi de l'invitation client à ${email} : ${(err as Error).message}`);
      throw new BadGatewayException(withCode(502, 'Bad Gateway', 'MAIL_SEND_FAILED', `L'email d'invitation n'a pas pu être envoyé (vérifiez la configuration MAIL_* du serveur). Cause : ${smtpReason(err)}. Aucune invitation n'a été créée.`));
    }

    return {
      ...this.toView({ ...saved, invitedBy: inviter } as ClientInvitation),
      mailMode: mode,
      // Jamais en smtp ; jamais en production (le mode log y est interdit par la validation d'environnement).
      ...(mode === 'log' ? { devLink: link } : {}),
    };
  }

  async findAll(status?: string) {
    const rows = await this.invitations.find({
      where: status ? { status: status as InvitationStatus } : {},
      relations: ['invitedBy'],
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 500,
    });
    const views = rows.map((r) => this.toView(r));
    return status ? views.filter((v) => v.status === status) : views;
  }

  async cancel(id: string) {
    await this.dataSource.transaction(async (m) => {
      const inv = await m.findOne(ClientInvitation, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!inv) throw new NotFoundException(`Invitation ${id} introuvable.`);
      if (inv.status !== InvitationStatus.PENDING) {
        throw conflict('INVITATION_NOT_PENDING', `Cette invitation n'est plus en attente (statut : ${inv.status}).`);
      }
      if (inv.expiresAt.getTime() <= Date.now()) {
        await m.update(ClientInvitation, { id }, { status: InvitationStatus.EXPIRED });
        throw conflict('INVITATION_NOT_PENDING', 'Cette invitation a déjà expiré.');
      }
      await m.update(ClientInvitation, { id }, { status: InvitationStatus.CANCELLED });
    });
    const inv = await this.invitations.findOne({ where: { id }, relations: ['invitedBy'] });
    return this.toView(inv as ClientInvitation);
  }

  // ------------------------------------------------------------- public : validation / acceptation

  // Informations minimales pour afficher le formulaire (l'email) ; rien d'autre n'est exposé.
  async validate(token: string) {
    const inv = await this.findByToken(this.invitations.manager, token);
    this.assertUsable(inv);
    return { email: inv.email, expiresAt: inv.expiresAt };
  }

  async accept(dto: AcceptClientInvitationDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    try {
      return await this.dataSource.transaction(async (m) => {
        // Verrou de la ligne : deux acceptations simultanées du même lien ne peuvent pas réussir toutes les deux.
        const inv = await this.findByToken(m, dto.token, true);
        this.assertUsable(inv);

        if (await m.findOne(User, { where: { email: inv.email } })) {
          throw conflict('EMAIL_ALREADY_REGISTERED', 'Un compte existe déjà avec cet email.');
        }

        const inserted = await m.insert(User, {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: inv.email,
          passwordHash,
          phoneNumber: dto.phoneNumber,
          location: dto.location,
          company: dto.company || undefined,
          // Forcés côté serveur : jamais lus depuis la requête.
          authority: UserAuthority.CLIENT,
          clientRole: ClientRole.CLIENT_USER,
          valid: true,
        });
        const userId = Number(inserted.identifiers[0].id);

        await m.update(ClientInvitation, { id: inv.id }, {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedUserId: userId,
        });
        return { email: inv.email, message: 'Compte créé : vous pouvez maintenant vous connecter.' };
      });
    } catch (err) {
      if (isDuplicateKey(err)) throw conflict('EMAIL_ALREADY_REGISTERED', 'Un compte existe déjà avec cet email.');
      throw err;
    }
  }

  // ------------------------------------------------------------- internes

  private async findByToken(m: EntityManager, token: string, lock = false): Promise<ClientInvitation> {
    const inv = await m.findOne(ClientInvitation, {
      where: { tokenHash: hashToken(token) },
      // Avec verrou : pas de jointure (FOR UPDATE sur la seule ligne d'invitation).
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!inv) {
      throw new NotFoundException(withCode(404, 'Not Found', 'INVITATION_INVALID', 'Lien d’invitation invalide.'));
    }
    return inv;
  }

  private assertUsable(inv: ClientInvitation) {
    if (inv.status === InvitationStatus.ACCEPTED) throw gone('INVITATION_USED', 'Cette invitation a déjà été utilisée.');
    if (inv.status === InvitationStatus.CANCELLED) throw gone('INVITATION_CANCELLED', 'Cette invitation a été annulée.');
    if (inv.status === InvitationStatus.EXPIRED || inv.expiresAt.getTime() <= Date.now()) {
      throw gone('INVITATION_EXPIRED', 'Cette invitation a expiré : demandez-en une nouvelle au PMO.');
    }
  }

  private toView(inv: ClientInvitation) {
    const expired = inv.status === InvitationStatus.PENDING && inv.expiresAt.getTime() <= Date.now();
    return {
      id: inv.id,
      email: inv.email,
      status: expired ? InvitationStatus.EXPIRED : inv.status,
      invitedBy: personName(inv.invitedBy),
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt ?? null,
      createdAt: inv.createdAt,
    };
  }
}
