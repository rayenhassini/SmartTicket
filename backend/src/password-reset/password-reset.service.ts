import { BadRequestException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';

const SALT_ROUNDS = 10;
// Anti-spam : pas plus d'un email de réinitialisation par compte toutes les 60 s.
const COOLDOWN_MS = 60_000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const withCode = (statusCode: number, error: string, code: string, message: string) => ({ statusCode, error, code, message });

export const GENERIC_FORGOT_MESSAGE = "Si un compte existe pour cet email, un message de réinitialisation vient d'être envoyé.";

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    @InjectRepository(PasswordResetToken) private readonly tokens: Repository<PasswordResetToken>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // Réponse IDENTIQUE que le compte existe ou non (pas de fuite d'information) : l'envoi du mail est
  // lancé sans être attendu, pour que le temps de réponse ne révèle pas non plus l'existence du compte.
  async requestReset(dto: ForgotPasswordDto): Promise<{ message: string }> {
    try {
      const user = await this.users.findOne({ where: { email: dto.email, valid: true } });
      if (user) {
        const recent = await this.tokens.findOne({
          where: { userId: user.id, createdAt: MoreThan(new Date(Date.now() - COOLDOWN_MS)) },
        });
        if (!recent) {
          const ttlMinutes = this.config.get<number>('passwordReset.ttlMinutes') ?? 60;
          const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
          const token = randomBytes(32).toString('base64url');
          // Un seul jeton actif par compte : les précédents non utilisés sont invalidés.
          await this.tokens.update({ userId: user.id, usedAt: IsNull() }, { usedAt: new Date() });
          await this.tokens.insert({ userId: user.id, token: hashToken(token), expiresAt });
          const base = this.config.get<string>('frontend.baseUrl');
          const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
          void this.mail
            .sendPasswordReset({ to: user.email, link, expiresAt })
            .catch((e) => this.logger.error(`Envoi du mail de réinitialisation impossible : ${(e as Error).message}`));
        }
      }
    } catch (e) {
      // Une erreur interne ne doit pas non plus distinguer « compte existant » : on journalise seulement.
      this.logger.error(`forgot-password : ${(e as Error).message}`);
    }
    return { message: GENERIC_FORGOT_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException(withCode(400, 'Bad Request', 'PASSWORD_MISMATCH', 'Les deux mots de passe ne correspondent pas.'));
    }
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    await this.dataSource.transaction(async (m) => {
      // Verrou sur la ligne du jeton (sans jointure) : deux usages simultanés ne peuvent pas réussir.
      const row = await m.findOne(PasswordResetToken, {
        where: { token: hashToken(dto.token) },
        select: { id: true, userId: true, expiresAt: true, usedAt: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException(withCode(404, 'Not Found', 'RESET_TOKEN_INVALID', 'Lien de réinitialisation invalide.'));
      if (row.usedAt) throw new GoneException(withCode(410, 'Gone', 'RESET_TOKEN_USED', 'Ce lien a déjà été utilisé ou remplacé par un plus récent.'));
      if (row.expiresAt.getTime() < Date.now()) {
        throw new GoneException(withCode(410, 'Gone', 'RESET_TOKEN_EXPIRED', 'Ce lien a expiré : refaites une demande de réinitialisation.'));
      }
      const user = await m.findOne(User, { where: { id: row.userId, valid: true } });
      if (!user) throw new NotFoundException(withCode(404, 'Not Found', 'RESET_TOKEN_INVALID', 'Lien de réinitialisation invalide.'));

      // Uniquement password_hash : ni rôle, ni nom, ni email ne peuvent changer ici.
      await m.update(User, { id: user.id }, { passwordHash });
      await m.update(PasswordResetToken, { userId: user.id, usedAt: IsNull() }, { usedAt: new Date() });
    });
    return { message: 'Mot de passe mis à jour.' };
  }
}
