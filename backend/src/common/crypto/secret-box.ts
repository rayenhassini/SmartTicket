import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Chiffrement AES-256-GCM des secrets stockés en base. Format : « v1:<base64(iv|tag|chiffré)> ».
// La clé est dérivée (scrypt) de SETTINGS_ENCRYPTION_KEY, ou à défaut de JWT_SECRET : si ce secret change,
// les valeurs déjà chiffrées deviennent illisibles (la config mail doit alors être ressaisie).
const deriveKey = (secret: string) => scryptSync(secret, 'smartticket/secret-box/v1', 32);

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64')}`;
}

export function decryptSecret(blob: string, secret: string): string {
  if (!blob.startsWith('v1:')) throw new Error('Format de secret inconnu.');
  const raw = Buffer.from(blob.slice(3), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}
