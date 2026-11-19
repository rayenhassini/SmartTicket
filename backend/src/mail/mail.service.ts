import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailSettings } from './entities/mail-settings.entity';
import { decryptSecret } from '../common/crypto/secret-box';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface InvitationMail {
  to: string;
  link: string;
  teamName: string;
  invitedBy: string | null;
  expiresAt: Date;
}

export interface ClientInvitationMail {
  to: string;
  link: string;
  invitedBy: string | null;
  expiresAt: Date;
}

export interface PasswordResetMail {
  to: string;
  link: string;
  expiresAt: Date;
}

export interface PmoSuccessionMail {
  to: string;
  link: string;
  resigningName: string | null;
  expiresAt: Date;
}

export interface MailResult {
  mode: 'smtp' | 'log';
}

// Cause lisible d'un échec nodemailer (jamais d'identifiants : code + réponse du serveur SMTP).
export function smtpReason(err: unknown): string {
  const e = err as { code?: string; response?: string; message?: string };
  const hint = e.code === 'EAUTH' ? ' (identifiants refusés : utilisez un mot de passe d\'application Gmail)' : '';
  return `${e.code ? e.code + ' — ' : ''}${(e.response || e.message || 'erreur inconnue').toString().slice(0, 200)}${hint}`;
}

const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

// Envoi des emails. Deux modes (voir .env.example) :
//  - smtp : envoi réel via nodemailer (Gmail avec mot de passe d'application, ou tout SMTP) ;
//  - log  : DÉVELOPPEMENT uniquement, le lien est écrit dans la console du backend.
// Le chemin smtp est le même code dans tous les cas : il est testé contre un serveur SMTP local
// (test/mail.spec.ts, scripts/fake-smtp.js). Le mode log n'est jamais accepté en production
// (validation.schema.ts).
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger('Mail');
  private transporter?: Transporter;

  private cache?: { key: string; transporter: Transporter };

  constructor(
    private readonly config: ConfigService,
    // Optionnel : sans dépôt (tests unitaires), seule la configuration d'environnement est utilisée.
    @Optional() @InjectRepository(MailSettings) private readonly settingsRepo?: Repository<MailSettings>,
  ) {}

  // Configuration d'envoi effective. Priorité : 1) configuration enregistrée par le PMO en base
  // (Gmail + mot de passe d'application chiffré) ; 2) variables MAIL_* de l'environnement ; 3) mode log (dev).
  async resolve(): Promise<{ mode: 'smtp' | 'log'; transporter?: Transporter; from?: string; source: 'database' | 'env' | 'log' }> {
    const row = this.settingsRepo
      ? await this.settingsRepo.createQueryBuilder('s').addSelect('s.passwordEnc').where('s.id = 1').getOne()
      : null;
    if (row) {
      try {
        const password = decryptSecret(row.passwordEnc, this.config.get<string>('secrets.encryptionKey') as string);
        const key = `${row.gmail}|${row.passwordEnc}`;
        if (this.cache?.key !== key) {
          this.cache = {
            key,
            transporter: nodemailer.createTransport({
              host: this.config.get<string>('mail.host'),
              port: this.config.get<number>('mail.port'),
              secure: this.config.get<boolean>('mail.secure'),
              auth: { user: row.gmail, pass: password },
              connectionTimeout: 10_000,
              greetingTimeout: 10_000,
              socketTimeout: 20_000,
            }),
          };
        }
        return { mode: 'smtp', transporter: this.cache.transporter, from: `${row.appName} <${row.gmail}>`, source: 'database' };
      } catch (err) {
        this.logger.error(`Configuration mail en base illisible (SETTINGS_ENCRYPTION_KEY / JWT_SECRET modifié ?) : ${(err as Error).message}`);
        if (this.mode !== 'smtp') {
          throw new Error('La configuration mail enregistrée est illisible : le PMO doit la ressaisir (Paramètres mail).');
        }
      }
    }
    if (this.mode === 'smtp') {
      return { mode: 'smtp', transporter: this.getTransporter(), from: this.config.get<string>('mail.from'), source: 'env' };
    }
    return { mode: 'log', source: 'log' };
  }

  // Journal de démarrage : dit clairement quel mode est ACTIF et, s'il est « log » alors que le .env demande
  // « smtp », pourquoi (variable d'environnement système qui écrase le .env, serveur non redémarré, etc.).
  async onModuleInit() {
    try {
      const r = await this.resolve();
      if (r.source === 'database') {
        this.logger.log('Mode email : SMTP actif (configuration enregistrée par le PMO en base).');
        return;
      }
    } catch {
      /* erreur déjà journalisée par resolve() */
    }
    if (this.mode === 'smtp') {
      this.logger.log(`Mode email : SMTP actif (${this.config.get('mail.host')}:${this.config.get('mail.port')}, utilisateur ${this.config.get('mail.user')}).`);
      return;
    }
    this.logger.warn('Mode email : LOG — aucun email ne sera envoyé (les liens d\'invitation sont renvoyés à l\'interface / écrits dans la console).');
    for (const f of new Set([resolve('.env'), resolve(__dirname, '..', '..', '.env')])) {
      if (!existsSync(f)) continue;
      const fileMode = /^\s*MAIL_MODE\s*=\s*['"]?([^'"#\r\n]*)/m.exec(readFileSync(f, 'utf8'))?.[1]?.trim();
      if (fileMode && fileMode.trim() !== 'log' && process.env.MAIL_MODE !== fileMode) {
        this.logger.warn(`Le fichier ${f} demande MAIL_MODE=${fileMode}, mais la variable d'environnement système MAIL_MODE=${process.env.MAIL_MODE ?? '(absente)'} l'emporte (dotenv n'écrase jamais l'environnement). Supprimez-la (Windows : « set MAIL_MODE= » / variables d'environnement utilisateur) puis redémarrez.`);
      }
    }
  }

  get mode(): 'smtp' | 'log' {
    return this.config.get<'smtp' | 'log'>('mail.mode') === 'smtp' ? 'smtp' : 'log';
  }

  async sendInvitation(mail: InvitationMail): Promise<MailResult> {
    const expires = mail.expiresAt.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    const subject = 'Invitation à rejoindre SmartTicket';
    const text =
      `Bonjour,\n\n${mail.invitedBy ?? 'Un responsable'} vous invite à rejoindre SmartTicket en tant que technicien ` +
      `(équipe « ${mail.teamName} »).\n\nPour créer votre compte, ouvrez ce lien :\n${mail.link}\n\n` +
      `Ce lien est personnel et expire le ${expires}.\nSi vous n'êtes pas concerné, ignorez ce message.\n`;
    const html =
      `<p>Bonjour,</p><p>${escapeHtml(mail.invitedBy ?? 'Un responsable')} vous invite à rejoindre <b>SmartTicket</b> ` +
      `en tant que technicien (équipe « ${escapeHtml(mail.teamName)} »).</p>` +
      `<p><a href="${escapeHtml(mail.link)}">Créer mon compte</a></p>` +
      `<p style="color:#666">Lien personnel, valable jusqu'au ${escapeHtml(expires)}. Si vous n'êtes pas concerné, ignorez ce message.</p>`;

    const cfg = await this.resolve();
    if (cfg.mode === 'log') {
      this.logger.warn(`[MAIL-LOG] mode développement : aucun email envoyé. À: ${mail.to} — Lien d'invitation : ${mail.link}`);
      return { mode: 'log' };
    }

    await cfg.transporter!.sendMail({
      from: cfg.from,
      to: mail.to,
      subject,
      text,
      html,
    });
    this.logger.log(`Invitation envoyée à ${mail.to} (smtp).`);
    return { mode: 'smtp' };
  }

  async sendClientInvitation(mail: ClientInvitationMail): Promise<MailResult> {
    const expires = mail.expiresAt.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    const subject = 'Invitation à votre espace client SmartTicket';
    const text =
      `Bonjour,\n\n${mail.invitedBy ?? 'Un responsable'} vous invite à créer votre espace client SmartTicket, ` +
      `pour suivre vos tickets.\n\nPour créer votre compte, ouvrez ce lien :\n${mail.link}\n\n` +
      `Ce lien est personnel et expire le ${expires}.\nSi vous n'êtes pas concerné, ignorez ce message.\n`;
    const html =
      `<p>Bonjour,</p><p>${escapeHtml(mail.invitedBy ?? 'Un responsable')} vous invite à créer votre espace client <b>SmartTicket</b> ` +
      `pour suivre vos tickets.</p><p><a href="${escapeHtml(mail.link)}">Créer mon compte</a></p>` +
      `<p style="color:#666">Lien personnel, valable jusqu'au ${escapeHtml(expires)}. Si vous n'êtes pas concerné, ignorez ce message.</p>`;

    const cfg = await this.resolve();
    if (cfg.mode === 'log') {
      this.logger.warn(`[MAIL-LOG] mode développement : aucun email envoyé. À: ${mail.to} — Lien d'invitation client : ${mail.link}`);
      return { mode: 'log' };
    }
    await cfg.transporter!.sendMail({ from: cfg.from, to: mail.to, subject, text, html });
    this.logger.log(`Invitation client envoyée à ${mail.to} (smtp).`);
    return { mode: 'smtp' };
  }

  async sendPasswordReset(mail: PasswordResetMail): Promise<MailResult> {
    const expires = mail.expiresAt.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    const subject = 'Réinitialisation de votre mot de passe SmartTicket';
    const text =
      `Bonjour,\n\nVous avez demandé la réinitialisation de votre mot de passe SmartTicket.\n\n` +
      `Pour choisir un nouveau mot de passe, ouvrez ce lien :\n${mail.link}\n\n` +
      `Ce lien est personnel, utilisable une seule fois, et expire le ${expires}.\n` +
      `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.\n`;
    const html =
      `<p>Bonjour,</p><p>Vous avez demandé la réinitialisation de votre mot de passe <b>SmartTicket</b>.</p>` +
      `<p><a href="${escapeHtml(mail.link)}">Choisir un nouveau mot de passe</a></p>` +
      `<p style="color:#666">Lien personnel, utilisable une seule fois, valable jusqu'au ${escapeHtml(expires)}. ` +
      `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.</p>`;

    const cfg = await this.resolve();
    if (cfg.mode === 'log') {
      this.logger.warn(`[MAIL-LOG] mode développement : aucun email envoyé. À: ${mail.to} — Lien de réinitialisation : ${mail.link}`);
      return { mode: 'log' };
    }
    await cfg.transporter!.sendMail({ from: cfg.from, to: mail.to, subject, text, html });
    this.logger.log(`Mail de réinitialisation envoyé à ${mail.to} (smtp).`);
    return { mode: 'smtp' };
  }

  async sendPmoSuccession(mail: PmoSuccessionMail): Promise<MailResult> {
    const expires = mail.expiresAt.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    const subject = 'Invitation à devenir PMO de SmartTicket';
    const who = mail.resigningName ?? 'Le PMO actuel';
    const text =
      `Bonjour,\n\n${who} vous invite à reprendre le rôle de PMO (responsable) de SmartTicket.\n\n` +
      `Pour créer votre compte PMO, ouvrez ce lien :\n${mail.link}\n\n` +
      `Ce lien est personnel, utilisable une seule fois, et expire le ${expires}.\n` +
      `Le rôle ne change qu'une fois votre compte créé. Si vous n'êtes pas concerné, ignorez ce message.\n`;
    const html =
      `<p>Bonjour,</p><p>${escapeHtml(who)} vous invite à reprendre le rôle de <b>PMO</b> de SmartTicket.</p>` +
      `<p><a href="${escapeHtml(mail.link)}">Créer mon compte PMO</a></p>` +
      `<p style="color:#666">Lien personnel, utilisable une seule fois, valable jusqu'au ${escapeHtml(expires)}. ` +
      `Le rôle ne change qu'une fois votre compte créé. Si vous n'êtes pas concerné, ignorez ce message.</p>`;
    const cfg = await this.resolve();
    if (cfg.mode === 'log') {
      this.logger.warn(`[MAIL-LOG] mode développement : aucun email envoyé. À: ${mail.to} — Lien de succession PMO : ${mail.link}`);
      return { mode: 'log' };
    }
    await cfg.transporter!.sendMail({ from: cfg.from, to: mail.to, subject, text, html });
    this.logger.log(`Invitation de succession PMO envoyée à ${mail.to} (smtp).`);
    return { mode: 'smtp' };
  }

  // Email de test de la configuration (bouton « Envoyer un email de test »). Refuse le mode log : un test sans envoi réel serait trompeur.
  async sendTest(to: string): Promise<MailResult & { source: 'database' | 'env' }> {
    const cfg = await this.resolve();
    if (cfg.mode === 'log') {
      throw new Error('Aucune configuration d\'envoi : enregistrez d\'abord votre Gmail et votre mot de passe d\'application.');
    }
    await cfg.transporter!.sendMail({
      from: cfg.from,
      to,
      subject: 'Test de la configuration mail SmartTicket',
      text: 'Si vous lisez ce message, la configuration d\'envoi de SmartTicket fonctionne.\n',
    });
    return { mode: 'smtp', source: cfg.source as 'database' | 'env' };
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const user = this.config.get<string>('mail.user');
      const pass = this.config.get<string>('mail.password');
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('mail.host'),
        port: this.config.get<number>('mail.port'),
        secure: this.config.get<boolean>('mail.secure'),
        ...(user ? { auth: { user, pass } } : {}),
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
    }
    return this.transporter;
  }
}
