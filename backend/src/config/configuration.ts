export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? 'smartticket_v1',
  },
  jwt: {
    // Aucune valeur par défaut : JWT_SECRET est exigé par validation.schema.ts
    // (l'application refuse de démarrer sans lui).
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '3600s',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  rateLimit: {
    loginLimit: parseInt(process.env.LOGIN_RATE_LIMIT ?? '10', 10),
    loginTtl: parseInt(process.env.LOGIN_RATE_TTL ?? '60', 10),
  },
  // Phase 3 : base du lien d'invitation (frontend) et durée de validité.
  frontend: {
    baseUrl: (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
  },
  invitation: {
    ttlHours: parseInt(process.env.INVITATION_TTL_HOURS ?? '72', 10),
  },
  // Durée de validité du lien « mot de passe oublié » (minutes).
  passwordReset: {
    ttlMinutes: parseInt(process.env.PASSWORD_RESET_TTL_MINUTES ?? '60', 10),
  },
  // Mode « smtp » = envoi réel (Gmail ou autre) ; mode « log » = le lien est écrit dans la console.
  // Sans MAIL_MODE explicite : smtp si MAIL_USER et MAIL_PASSWORD sont renseignés, sinon log.
  mail: {
    mode: (process.env.MAIL_MODE ?? (process.env.MAIL_USER && process.env.MAIL_PASSWORD ? 'smtp' : 'log')) as 'smtp' | 'log',
    host: process.env.MAIL_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT ?? '465', 10),
    // Défaut : TLS implicite sur 465 ; STARTTLS (secure=false) sur 587.
    secure: process.env.MAIL_SECURE !== undefined ? process.env.MAIL_SECURE === 'true' : parseInt(process.env.MAIL_PORT ?? '465', 10) === 465,
    user: process.env.MAIL_USER ?? '',
    password: process.env.MAIL_PASSWORD ?? '',
    from: process.env.MAIL_FROM ?? (process.env.MAIL_USER ? `SmartTicket <${process.env.MAIL_USER}>` : 'SmartTicket <no-reply@localhost>'),
  },
});
