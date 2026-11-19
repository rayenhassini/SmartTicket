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
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { DataSource, EntityManager, LessThan, Repository } from 'typeorm';
import { UserAuthority } from '../common/enums/user-authority.enum';
import { MailService, smtpReason } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { AcceptSuccessionDto } from './dto/pmo-succession.dto';
import { PmoResignation, ResignationStatus } from './entities/pmo-resignation.entity';

const SALT_ROUNDS = 10;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const isDuplicateKey = (err: unknown) => (err as { code?: string })?.code === 'ER_DUP_ENTRY';
const withCode = (statusCode: number, error: string, code: string, message: string) => ({ statusCode, error, code, message });
const conflict = (code: string, message: string) => new ConflictException(withCode(409, 'Conflict', code, message));
const gone = (code: string, message: string) => new GoneException(withCode(410, 'Gone', code, message));

// Succession PMO. États d'une démission : none (aucune ligne « pending ») → pending → completed | cancelled | expired.
// Le PMO en place le reste TANT QUE le successeur n'a pas terminé son inscription ; le basculement
// (nouveau PMO créé + ancien PMO rétrogradé) se fait dans UNE transaction → jamais deux PMO actifs.
// Sort de l'ancien PMO (choix simple et sûr) : compte DÉSACTIVÉ et rôle « technician » (aucun privilège conservé,
// ses sessions sont refusées immédiatement car le JWT est relu en base à chaque requête).
@Injectable()
export class PmoSuccessionService {
  private readonly logger = new Logger(PmoSuccessionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    @InjectRepository(PmoResignation) private readonly resignations: Repository<PmoResignation>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // ------------------------------------------------------------- PMO connecté

  async create(successorEmail: string, userId: number) {
    const me = await this.users.findOne({ where: { id: userId } });
    if (!me || me.authority !== UserAuthority.PMO || !me.valid) {
      throw conflict('NOT_ACTIVE_PMO', 'Seul le PMO actif peut démissionner.');
    }
    if (successorEmail === me.email.toLowerCase()) {
      throw conflict('SUCCESSOR_IS_SELF', 'Le successeur doit être une autre personne que vous.');
    }
    if (await this.users.findOne({ where: { email: successorEmail } })) {
      throw conflict('EMAIL_ALREADY_REGISTERED', 'Un compte existe déjà avec cet email : le successeur doit avoir une adresse sans compte.');
    }

    await this.expireOutdated();
    if (await this.resignations.findOne({ where: { status: ResignationStatus.PENDING } })) {
      throw conflict('RESIGNATION_ALREADY_PENDING', 'Une démission est déjà en cours : annulez-la avant d\'en lancer une autre.');
    }

    const token = randomBytes(32).toString('base64url');
    const ttlHours = this.config.get<number>('pmoSuccession.ttlHours') ?? 72;
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000);

    let saved: PmoResignation;
    try {
      saved = await this.resignations.save(
        this.resignations.create({
          successorEmail,
          token: hashToken(token),
          status: ResignationStatus.PENDING,
          resigningUserId: me.id,
          expiresAt,
        }),
      );
    } catch (err) {
      // UNIQUE(pending_flag) : course entre deux demandes simultanées.
      if (isDuplicateKey(err)) throw conflict('RESIGNATION_ALREADY_PENDING', 'Une démission est déjà en cours : annulez-la avant d\'en lancer une autre.');
      throw err;
    }

    const link = `${this.config.get<string>('frontend.baseUrl')}/pmo/accept?token=${token}`;
    let mode: 'smtp' | 'log';
    try {
      ({ mode } = await this.mail.sendPmoSuccession({ to: successorEmail, link, resigningName: `${me.firstName} ${me.lastName}`, expiresAt }));
    } catch (err) {
      // Échec d'envoi : pas de démission « pending » dont personne n'a reçu le lien.
      await this.resignations.delete({ id: saved.id });
      this.logger.error(`Échec d'envoi de l'invitation de succession à ${successorEmail} : ${smtpReason(err)}`);
      throw new BadGatewayException(withCode(502, 'Bad Gateway', 'MAIL_SEND_FAILED', `L'email d'invitation n'a pas pu être envoyé (vérifiez « Paramètres mail »). Cause : ${smtpReason(err)}. Aucune démission n'a été enregistrée.`));
    }

    return { ...this.toView(saved), mailMode: mode, ...(mode === 'log' ? { devLink: link } : {}) };
  }

  // État courant vu par le PMO : { status: 'none' } ou la démission en attente.
  async current() {
    await this.expireOutdated();
    const row = await this.resignations.findOne({ where: { status: ResignationStatus.PENDING } });
    return row ? this.toView(row) : { status: 'none' as const };
  }

  async cancel() {
    await this.expireOutdated();
    return this.dataSource.transaction(async (m) => {
      const row = await m.findOne(PmoResignation, { where: { status: ResignationStatus.PENDING }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new NotFoundException(withCode(404, 'Not Found', 'NO_PENDING_RESIGNATION', 'Aucune démission en cours.'));
      await m.update(PmoResignation, { id: row.id }, { status: ResignationStatus.CANCELLED });
      return { ...this.toView({ ...row, status: ResignationStatus.CANCELLED }) };
    });
  }

  // ------------------------------------------------------------- public : validation / acceptation

  async validate(token: string) {
    const row = await this.findByToken(this.resignations.manager, token);
    this.assertUsable(row);
    return { email: row.successorEmail, expiresAt: row.expiresAt };
  }

  async accept(dto: AcceptSuccessionDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    try {
      return await this.dataSource.transaction(async (m) => {
        // Verrou de la ligne : deux acceptations simultanées ne peuvent pas réussir toutes les deux.
        const row = await this.findByToken(m, dto.token, true);
        this.assertUsable(row);

        if (await m.findOne(User, { where: { email: row.successorEmail } })) {
          throw conflict('EMAIL_ALREADY_REGISTERED', 'Un compte existe déjà avec cet email.');
        }

        // L'ancien PMO doit toujours être le PMO actif ; aucun AUTRE PMO actif ne doit exister.
        const old = row.resigningUserId
          ? await m.findOne(User, { where: { id: row.resigningUserId }, lock: { mode: 'pessimistic_write' } })
          : null;
        if (!old || old.authority !== UserAuthority.PMO || !old.valid) {
          throw conflict('RESIGNATION_OBSOLETE', 'Cette démission n\'est plus valable (le PMO a changé). Demandez une nouvelle invitation.');
        }
        const others = await m.count(User, { where: { authority: UserAuthority.PMO, valid: true } });
        if (others !== 1) {
          throw conflict('PMO_STATE_INCONSISTENT', 'État des PMO incohérent : opération refusée par sécurité.');
        }

        const inserted = await m.insert(User, {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: row.successorEmail,
          passwordHash,
          phoneNumber: dto.phoneNumber || undefined,
          authority: UserAuthority.PMO,
          valid: true,
        });
        const newId = Number(inserted.identifiers[0].id);

        // Ancien PMO : plus de privilège, compte désactivé.
        await m.update(User, { id: old.id }, { authority: UserAuthority.TECHNICIAN, valid: false });

        await m.update(PmoResignation, { id: row.id }, {
          status: ResignationStatus.COMPLETED,
          completedAt: new Date(),
          successorUserId: newId,
        });
        this.logger.log(`Succession PMO terminée : utilisateur ${old.id} remplacé par ${newId}.`);
        return { email: row.successorEmail, message: 'Compte PMO créé : vous pouvez maintenant vous connecter.' };
      });
    } catch (err) {
      if (isDuplicateKey(err)) throw conflict('EMAIL_ALREADY_REGISTERED', 'Un compte existe déjà avec cet email.');
      throw err;
    }
  }

  // ------------------------------------------------------------- internes

  private async expireOutdated() {
    await this.resignations.update(
      { status: ResignationStatus.PENDING, expiresAt: LessThan(new Date()) },
      { status: ResignationStatus.EXPIRED },
    );
  }

  private async findByToken(m: EntityManager, token: string, lock = false): Promise<PmoResignation> {
    const row = await m.findOne(PmoResignation, {
      where: { token: hashToken(token) },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!row) throw new NotFoundException(withCode(404, 'Not Found', 'SUCCESSION_INVALID', 'Lien d\'invitation invalide.'));
    return row;
  }

  private assertUsable(row: PmoResignation) {
    if (row.status === ResignationStatus.COMPLETED) throw gone('SUCCESSION_USED', 'Cette invitation a déjà été utilisée.');
    if (row.status === ResignationStatus.CANCELLED) throw gone('SUCCESSION_CANCELLED', 'Cette démission a été annulée.');
    if (row.status === ResignationStatus.EXPIRED || row.expiresAt.getTime() <= Date.now()) {
      throw gone('SUCCESSION_EXPIRED', 'Cette invitation a expiré : demandez-en une nouvelle au PMO.');
    }
  }

  private toView(r: PmoResignation) {
    return {
      id: Number(r.id),
      status: r.status,
      successorEmail: r.successorEmail,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    };
  }
}
