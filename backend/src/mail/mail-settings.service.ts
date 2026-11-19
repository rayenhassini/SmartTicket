import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { encryptSecret } from '../common/crypto/secret-box';
import { MailSettings } from './entities/mail-settings.entity';
import { MailService, smtpReason } from './mail.service';

const SETTINGS_ID = 1;
const withCode = (statusCode: number, error: string, code: string, message: string) => ({ statusCode, error, code, message });

export interface SaveMailSettings {
  gmail: string;
  appName: string;
  appPassword: string;
}

// Configuration d'envoi enregistrée par le PMO. Le mot de passe d'application est chiffré en base et
// n'est JAMAIS renvoyé (ni journalisé) : les réponses ne contiennent que l'état (configuré ou non).
@Injectable()
export class MailSettingsService {
  private readonly logger = new Logger('MailSettings');

  constructor(
    private readonly config: ConfigService,
    private readonly mail: MailService,
    @InjectRepository(MailSettings) private readonly repo: Repository<MailSettings>,
  ) {}

  async status() {
    const row = await this.repo.findOne({ where: { id: SETTINGS_ID } });
    const envConfigured = this.mail.mode === 'smtp';
    return {
      configured: !!row,
      source: row ? 'database' : envConfigured ? 'env' : 'none',
      gmail: row?.gmail ?? null,
      appName: row?.appName ?? null,
      hasPassword: !!row, // l'existence seulement, jamais la valeur
      updatedAt: row?.updatedAt ?? null,
    };
  }

  async save(dto: SaveMailSettings, userId: number) {
    // Google affiche le mot de passe d'application par groupes de 4 séparés par des espaces : on les retire.
    const password = dto.appPassword.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9]{16}$/.test(password)) {
      throw new BadRequestException(withCode(400, 'Bad Request', 'APP_PASSWORD_INVALID', 'Le mot de passe d\'application Gmail comporte 16 caractères (lettres et chiffres, espaces ignorés).'));
    }
    const appName = dto.appName.replace(/[<>"\r\n]/g, '').trim();
    if (!appName) throw new BadRequestException('Le nom de l\'application est obligatoire.');
    await this.repo.save(
      this.repo.create({
        id: SETTINGS_ID,
        gmail: dto.gmail.trim().toLowerCase(),
        appName,
        passwordEnc: encryptSecret(password, this.config.get<string>('secrets.encryptionKey') as string),
        updatedBy: userId,
      }),
    );
    this.logger.log(`Configuration d'envoi enregistrée par l'utilisateur ${userId} (${dto.gmail.trim().toLowerCase()}).`); // jamais le secret
    return this.status();
  }

  async sendTest(to: string) {
    try {
      const r = await this.mail.sendTest(to);
      return { sent: true, to, source: r.source, message: `Email de test envoyé à ${to}.` };
    } catch (err) {
      const msg = (err as Error).message;
      if (/Aucune configuration|illisible/.test(msg)) {
        throw new ConflictException(withCode(409, 'Conflict', 'MAIL_NOT_CONFIGURED', msg));
      }
      this.logger.error(`Échec de l'email de test : ${smtpReason(err)}`);
      throw new BadGatewayException(withCode(502, 'Bad Gateway', 'MAIL_SEND_FAILED', `L'email de test n'a pas pu être envoyé. Cause : ${smtpReason(err)}.`));
    }
  }
}
