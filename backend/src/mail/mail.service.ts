import { Injectable, Logger } from '@nestjs/common';
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

export interface PasswordResetMail {
  to: string;
  link: string;
  expiresAt: Date;
}

export interface MailResult {
  mode: 'smtp' | 'log';
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
export class MailService {
  private readonly logger = new Logger('Mail');
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

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

    if (this.mode === 'log') {
      this.logger.warn(`[MAIL-LOG] mode développement : aucun email envoyé. À: ${mail.to} — Lien d'invitation : ${mail.link}`);
      return { mode: 'log' };
    }

    await this.getTransporter().sendMail({
      from: this.config.get<string>('mail.from'),
      to: mail.to,
      subject,
      text,
      html,
    });
    this.logger.log(`Invitation envoyée à ${mail.to} (smtp).`);
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

    if (this.mode === 'log') {
      this.logger.warn(`[MAIL-LOG] mode développement : aucun email envoyé. À: ${mail.to} — Lien de réinitialisation : ${mail.link}`);
      return { mode: 'log' };
    }
    await this.getTransporter().sendMail({ from: this.config.get<string>('mail.from'), to: mail.to, subject, text, html });
    this.logger.log(`Mail de réinitialisation envoyé à ${mail.to} (smtp).`);
    return { mode: 'smtp' };
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
