import * as Joi from 'joi';

// Valeurs d'exemple connues : interdites en production.
const FORBIDDEN_PROD_SECRETS = [
  'change_me_to_a_long_random_secret',
  'dev-secret-change-me',
];

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),

  // Obligatoire partout (pas de valeur par défaut) ; durci en production.
  JWT_SECRET: Joi.string()
    .required()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().min(32).invalid(...FORBIDDEN_PROD_SECRETS),
      otherwise: Joi.string().min(16),
    }),
  JWT_EXPIRES_IN: Joi.string().default('3600s'),

  // Origines autorisées (séparées par des virgules). Défaut dev : le frontend local.
  // En production : obligatoire, sans joker « * ».
  CORS_ORIGINS: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required().pattern(/^[^*]+$/, 'sans joker'),
    otherwise: Joi.string().default('http://localhost:3000'),
  }),

  // Rate limit du login/bootstrap : LIMIT requêtes par fenêtre de TTL secondes, par IP.
  LOGIN_RATE_LIMIT: Joi.number().integer().min(1).default(10),
  LOGIN_RATE_TTL: Joi.number().integer().min(1).default(60),

  // --- Phase 3 : invitations + email ---
  // URL publique du frontend (base du lien d'invitation). Obligatoire en production.
  FRONTEND_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .when('NODE_ENV', { is: 'production', then: Joi.required(), otherwise: Joi.string().default('http://localhost:3000') }),
  INVITATION_TTL_HOURS: Joi.number().integer().min(1).max(720).default(72),
  PASSWORD_RESET_TTL_MINUTES: Joi.number().integer().min(5).max(1440).default(60),
  // Production : envoi réel obligatoire (jamais de lien en console, jamais de devLink dans l'API).
  MAIL_MODE: Joi.string()
    .valid('smtp', 'log')
    .when('NODE_ENV', { is: 'production', then: Joi.valid('smtp').required() }),
  MAIL_HOST: Joi.string().default('smtp.gmail.com'),
  MAIL_PORT: Joi.number().integer().default(465),
  MAIL_SECURE: Joi.boolean(),
  // MAIL_MODE=smtp explicite → identifiants obligatoires (sinon : démarrage refusé).
  MAIL_USER: Joi.string().allow('').default('').when('MAIL_MODE', { is: 'smtp', then: Joi.string().required() }),
  MAIL_PASSWORD: Joi.string().allow('').default('').when('MAIL_MODE', { is: 'smtp', then: Joi.string().required() }),
  MAIL_FROM: Joi.string().allow(''),
});
