import {
  BadGatewayException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager, LessThan, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Team } from '../teams/entities/team.entity';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { TeamsService } from '../teams/teams.service';
import { MailService } from '../mail/mail.service';
import { InvitationStatus, UserInvitation } from './entities/user-invitation.entity';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';

const SALT_ROUNDS = 10;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const isDuplicateKey = (err: unknown) => (err as { code?: string })?.code === 'ER_DUP_ENTRY';
const withCode = (statusCode: number, error: string, code: string, message: string) => ({ statusCode, error, code, message });
const conflict = (code: string, message: string) => new ConflictException(withCode(409, 'Conflict', code, message));
const gone = (code: string, message: string) => new GoneException(withCode(410, 'Gone', code, message));
const personName = (u?: Pick<User, 'firstName' | 'lastName'> | null) => (u ? `${u.firstName} ${u.lastName}` : null);

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly teams: TeamsService,
    @InjectRepository(UserInvitation) private readonly invitations: Repository<UserInvitation>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Team) private readonly teamsRepo: Repository<Team>,
  ) {}

  // ------------------------------------------------------------- PMO : création / liste / annulation

  async create(dto: CreateInvitationDto, invitedById: number) {
    const email = dto.email;
    const team = await this.teamsRepo.findOne({ where: { id: dto.teamId } });
    if (!team) throw new NotFoundException(`Équipe ${dto.teamId} introuvable.`);

    if (await this.users.findOne({ where: { email } })) {
      throw conflict('EMAIL_ALREADY_REGISTERED', 'Un compte existe déjà avec cet email.');
    }

    // Libère l'emplacement « pending » d'une ancienne invitation expirée (expiration paresseuse).
    await this.invitations.update(
      { email, status: InvitationStatus.PENDING, expiresAt: LessThan(new Date()) },
      { status: InvitationStatus.EXPIRED },
    );

    const token = randomBytes(32).toString('base64url');
    const ttlHours = this.config.get<number>('invitation.ttlHours') ?? 72;
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000);

    let saved: UserInvitation;
    try {
      saved = await this.invitations.save(
        this.invitations.create({
          email,
          token: hashToken(token),
          authority: 'technician',
          teamId: team.id,
          status: InvitationStatus.PENDING,
          invitedById,
          expiresAt,
        }),
      );
    } catch (err) {
      // UNIQUE(pending_email) : une invitation est déjà en attente pour cet email (course incluse).
      if (isDuplicateKey(err)) {
        throw conflict('INVITATION_ALREADY_PENDING', 'Une invitation est déjà en attente pour cet email : annulez-la d’abord.');
      }
      throw err;
    }

    const inviter = await this.users.findOne({ where: { id: invitedById } });
    const link = `${this.config.get<string>('frontend.baseUrl')}/invite/accept?token=${token}`;
    let mode: 'smtp' | 'log';
    try {
      ({ mode } = await this.mail.sendInvitation({ to: email, link, teamName: team.name, invitedBy: personName(inviter), expiresAt }));
    } catch (err) {
      // Échec d'envoi : on ne laisse pas une invitation « pending » dont personne n'a reçu le lien.
      await this.invitations.delete({ id: saved.id });
      this.logger.error(`Échec d'envoi de l'invitation à ${email} : ${(err as Error).message}`);
      throw new BadGatewayException(withCode(502, 'Bad Gateway', 'MAIL_SEND_FAILED', "L'email d'invitation n'a pas pu être envoyé (vérifiez la configuration MAIL_* du serveur). Aucune invitation n'a été créée."));
    }

    return {
      ...this.toView({ ...saved, team, invitedBy: inviter } as UserInvitation),
      mailMode: mode,
      // Jamais en smtp ; jamais en production (le mode log y est interdit par la validation d'environnement).
      ...(mode === 'log' ? { devLink: link } : {}),
    };
  }

  async findAll(status?: string) {
    const rows = await this.invitations.find({
      where: status ? { status: status as InvitationStatus } : {},
      relations: ['team', 'invitedBy'],
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 500,
    });
    // Statut effectif : une invitation « pending » échue est affichée « expired ».
    const views = rows.map((r) => this.toView(r));
    return status ? views.filter((v) => v.status === status) : views;
  }

  async cancel(id: number) {
    await this.dataSource.transaction(async (m) => {
      const inv = await m.findOne(UserInvitation, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!inv) throw new NotFoundException(`Invitation ${id} introuvable.`);
      if (inv.status !== InvitationStatus.PENDING) {
        throw conflict('INVITATION_NOT_PENDING', `Cette invitation n'est plus en attente (statut : ${inv.status}).`);
      }
      if (inv.expiresAt.getTime() <= Date.now()) {
        await m.update(UserInvitation, { id }, { status: InvitationStatus.EXPIRED });
        throw conflict('INVITATION_NOT_PENDING', 'Cette invitation a déjà expiré.');
      }
      await m.update(UserInvitation, { id }, { status: InvitationStatus.CANCELLED });
    });
    const inv = await this.invitations.findOne({ where: { id }, relations: ['team', 'invitedBy'] });
    return this.toView(inv as UserInvitation);
  }

  // ------------------------------------------------------------- public : validation / acceptation

  // Informations minimales pour afficher le formulaire (email + équipe) ; rien d'autre n'est exposé.
  async validate(token: string) {
    const inv = await this.findByToken(this.invitations.manager, token);
    this.assertUsable(inv);
    return { email: inv.email, teamName: inv.team?.name ?? '', expiresAt: inv.expiresAt };
  }

  async accept(dto: AcceptInvitationDto) {
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
          phoneNumber: dto.phoneNumber || undefined,
          authority: UserAuthority.TECHNICIAN,
          valid: true,
        });
        const userId = Number(inserted.identifiers[0].id);

        // Règles de la Phase 2 réutilisées telles quelles (équipe verrouillée, 1er membre = responsable…).
        await this.teams.addMemberWithin(m, inv.teamId, userId);

        await m.update(UserInvitation, { id: inv.id }, {
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

  private async findByToken(m: EntityManager, token: string, lock = false): Promise<UserInvitation> {
    const inv = await m.findOne(UserInvitation, {
      where: { token: hashToken(token) },
      // Avec verrou : pas de jointure (FOR UPDATE sur la seule ligne d'invitation).
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : { relations: ['team'] }),
    });
    if (!inv) {
      throw new NotFoundException(withCode(404, 'Not Found', 'INVITATION_INVALID', 'Lien d’invitation invalide.'));
    }
    return inv;
  }

  private assertUsable(inv: UserInvitation) {
    if (inv.status === InvitationStatus.ACCEPTED) throw gone('INVITATION_USED', 'Cette invitation a déjà été utilisée.');
    if (inv.status === InvitationStatus.CANCELLED) throw gone('INVITATION_CANCELLED', 'Cette invitation a été annulée.');
    if (inv.status === InvitationStatus.EXPIRED || inv.expiresAt.getTime() <= Date.now()) {
      throw gone('INVITATION_EXPIRED', 'Cette invitation a expiré : demandez-en une nouvelle au PMO.');
    }
  }

  private toView(inv: UserInvitation) {
    const expired = inv.status === InvitationStatus.PENDING && inv.expiresAt.getTime() <= Date.now();
    return {
      id: Number(inv.id),
      email: inv.email,
      authority: inv.authority,
      teamId: Number(inv.teamId),
      teamName: inv.team?.name ?? null,
      status: expired ? InvitationStatus.EXPIRED : inv.status,
      invitedBy: personName(inv.invitedBy),
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt ?? null,
      createdAt: inv.createdAt,
    };
  }
}
