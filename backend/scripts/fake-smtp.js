#!/usr/bin/env node
/* Serveur SMTP local FACTICE pour tester le VRAI chemin d'envoi (nodemailer) sans Gmail.
 * Il accepte tout message, l'affiche et l'ajoute (JSON, une ligne par mail) au fichier FAKE_SMTP_OUT.
 *   node scripts/fake-smtp.js            # écoute sur 127.0.0.1:2525
 * Backend : MAIL_MODE=smtp MAIL_HOST=127.0.0.1 MAIL_PORT=2525 MAIL_SECURE=false MAIL_USER=dev MAIL_PASSWORD=dev
 * (DÉVELOPPEMENT uniquement : aucun chiffrement, aucune distribution réelle.) */
const fs = require('fs');
const { SMTPServer } = require('smtp-server');

const port = parseInt(process.env.FAKE_SMTP_PORT || '2525', 10);
const out = process.env.FAKE_SMTP_OUT;

const server = new SMTPServer({
  authOptional: true,
  allowInsecureAuth: true,
  disabledCommands: ['STARTTLS'],
  onAuth(auth, session, cb) { cb(null, { user: auth.username }); },
  onData(stream, session, cb) {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const decoded = Buffer.from(raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
      const link = (decoded.match(/https?:\/\/[^\s"<]+\/invite\/accept\?token=[A-Za-z0-9_-]+/) || [])[0] || null;
      const rec = { at: new Date().toISOString(), from: session.envelope.mailFrom.address, to: session.envelope.rcptTo.map((r) => r.address), link };
      console.log(`[fake-smtp] mail de ${rec.from} à ${rec.to.join(',')} — lien : ${link}`);
      if (out) fs.appendFileSync(out, JSON.stringify(rec) + '\n');
      cb();
    });
  },
});
server.on('error', (e) => console.error('[fake-smtp]', e.message));
server.listen(port, '127.0.0.1', () => console.log(`[fake-smtp] en écoute sur 127.0.0.1:${port}`));
