import { decryptSecret, encryptSecret } from '../src/common/crypto/secret-box';

describe('secret-box (AES-256-GCM)', () => {
  const key = 'une-cle-de-test-assez-longue-0123456789';
  it('chiffre puis déchiffre, sans jamais contenir le clair', () => {
    const blob = encryptSecret('abcdefghijklmnop', key);
    expect(blob.startsWith('v1:')).toBe(true);
    expect(blob).not.toContain('abcdefghijklmnop');
    expect(decryptSecret(blob, key)).toBe('abcdefghijklmnop');
  });
  it('deux chiffrements du même secret diffèrent (IV aléatoire)', () => {
    expect(encryptSecret('x'.repeat(16), key)).not.toBe(encryptSecret('x'.repeat(16), key));
  });
  it('refuse une mauvaise clé', () => {
    expect(() => decryptSecret(encryptSecret('secret-secret-16', key), 'autre-cle-autre-cle-autre-cle')).toThrow();
  });
  it('refuse un blob altéré ou de format inconnu', () => {
    const blob = encryptSecret('secret-secret-16', key);
    const raw = Buffer.from(blob.slice(3), 'base64');
    raw[raw.length - 1] ^= 1;
    expect(() => decryptSecret('v1:' + raw.toString('base64'), key)).toThrow();
    expect(() => decryptSecret('clair', key)).toThrow();
  });
});
