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
});
