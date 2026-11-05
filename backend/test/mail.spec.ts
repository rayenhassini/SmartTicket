/* Tests du MailService : mode log (aucun envoi) et VRAI chemin SMTP (nodemailer) contre un
 * serveur SMTP local factice — c'est le même code que celui utilisé avec Gmail. */
import { SMTPServer } from 'smtp-server';
import { AddressInfo } from 'net';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../src/mail/mail.service';

const cfg = (values: Record<string, unknown>) => ({ get: (k: string) => values[k] }) as unknown as ConfigService;
const mail = {
  to: 'nouveau@example.com',
  link: 'http://localhost:3000/invite/accept?token=AbC_123-xyz',
  teamName: 'Équipe <Réseau>',
  invitedBy: 'Alice PMO',
  expiresAt: new Date('2030-01-01T10:00:00Z'),
};
const decodeQp = (raw: string) =>
  Buffer.from(raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');

describe('MailService', () => {
  let server: SMTPServer;
  let port: number;
  const received: { from: string; to: string[]; raw: string; user?: string }[] = [];

  beforeAll(async () => {
    server = new SMTPServer({
      authOptional: true,
      allowInsecureAuth: true,
      disabledCommands: ['STARTTLS'],
      onAuth: (auth, _s, cb) => cb(null, { user: auth.username }),
      onData(stream, session, cb) {
        const chunks: Buffer[] = [];
        stream.on('data', (c) => chunks.push(c));
        stream.on('end', () => {
          received.push({
            from: session.envelope.mailFrom ? session.envelope.mailFrom.address : '',
            to: session.envelope.rcptTo.map((r) => r.address),
            raw: Buffer.concat(chunks).toString('utf8'),
            user: (session.user as unknown as string) ?? undefined,
          });
          cb();
        });
      },
    });
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', res));
    port = (server.server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((res) => server.close(() => res())));
  beforeEach(() => { received.length = 0; });

  const smtpConfig = (over: Record<string, unknown> = {}) =>
    cfg({ 'mail.mode': 'smtp', 'mail.host': '127.0.0.1', 'mail.port': port, 'mail.secure': false, 'mail.user': 'dev', 'mail.password': 'dev', 'mail.from': 'SmartTicket <dev@example.com>', ...over });

  it('mode log : aucun envoi, le lien est écrit dans les logs', async () => {
    const svc = new MailService(cfg({ 'mail.mode': 'log' }));
    const warn = jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => undefined);
    expect(await svc.sendInvitation(mail)).toEqual({ mode: 'log' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(mail.link));
    expect(received).toHaveLength(0);
  });

  it('mode smtp : envoie réellement le message (lien, destinataire, expéditeur configuré)', async () => {
    const svc = new MailService(smtpConfig());
    expect(svc.mode).toBe('smtp');
    expect(await svc.sendInvitation(mail)).toEqual({ mode: 'smtp' });
    expect(received).toHaveLength(1);
    expect(received[0].to).toEqual(['nouveau@example.com']);
    expect(received[0].from).toBe('dev@example.com');
    const body = decodeQp(received[0].raw);
    expect(body).toContain(mail.link);
    expect(body).toMatch(/Subject: .*Invitation/);
    expect(body).toContain('Équipe &lt;Réseau&gt;'); // HTML échappé
  });

  it('mode smtp : une erreur de transport remonte (pas de faux succès)', async () => {
    const svc = new MailService(smtpConfig({ 'mail.port': 1 })); // port fermé
    await expect(svc.sendInvitation(mail)).rejects.toBeDefined();
  });

  it('réinitialisation : mode smtp envoie le lien, mode log ne fait que le journaliser', async () => {
    const link = 'http://localhost:3000/reset-password?token=Zz_9-abc';
    const reset = { to: 'user@example.com', link, expiresAt: new Date('2030-01-01T10:00:00Z') };
    const svc = new MailService(smtpConfig());
    expect(await svc.sendPasswordReset(reset)).toEqual({ mode: 'smtp' });
    expect(received).toHaveLength(1);
    expect(received[0].to).toEqual(['user@example.com']);
    const body = decodeQp(received[0].raw);
    expect(body).toContain(link);
    expect(body).toMatch(/Subject: .*R.initialisation/);

    const logSvc = new MailService(cfg({ 'mail.mode': 'log' }));
    const warn = jest.spyOn((logSvc as any).logger, 'warn').mockImplementation(() => undefined);
    expect(await logSvc.sendPasswordReset(reset)).toEqual({ mode: 'log' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(link));
    expect(received).toHaveLength(1); // pas d'envoi supplémentaire
  });

  it('mode inconnu/absent → log (sécurité : jamais d’envoi involontaire)', () => {
    expect(new MailService(cfg({})).mode).toBe('log');
  });
});
