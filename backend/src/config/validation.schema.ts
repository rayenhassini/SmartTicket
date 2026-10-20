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
});
