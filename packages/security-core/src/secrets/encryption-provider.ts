/**
 * Encryption abstraction — uses platform crypto only.
 * Do NOT invent a custom cryptosystem.
 */

export interface EncryptionKeyRef {
  id: string;
  algorithm: 'aes-256-gcm' | 'none';
}

export interface EncryptionProvider {
  readonly name: string;
  encrypt(plaintext: string, key: EncryptionKeyRef): Promise<string>;
  decrypt(ciphertext: string, key: EncryptionKeyRef): Promise<string>;
}

/** No-op provider for local-only plaintext stores (default). */
export class NoopEncryptionProvider implements EncryptionProvider {
  readonly name = 'noop';

  async encrypt(plaintext: string, _key: EncryptionKeyRef): Promise<string> {
    return plaintext;
  }

  async decrypt(ciphertext: string, _key: EncryptionKeyRef): Promise<string> {
    return ciphertext;
  }
}

/**
 * Local encryption via Node `node:crypto` AES-256-GCM.
 * Key material must be supplied by the host (env / OS keychain) — Neuron does not invent keys.
 */
export class LocalEncryptionProvider implements EncryptionProvider {
  readonly name = 'local-aes-256-gcm';

  constructor(private readonly resolveKeyBytes: (key: EncryptionKeyRef) => Promise<Buffer>) {}

  async encrypt(plaintext: string, key: EncryptionKeyRef): Promise<string> {
    const { createCipheriv, randomBytes } = await import('node:crypto');
    const keyBytes = await this.resolveKeyBytes(key);
    if (keyBytes.length !== 32) {
      throw new Error('LocalEncryptionProvider requires a 32-byte key from the host key manager');
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', keyBytes, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  async decrypt(ciphertext: string, key: EncryptionKeyRef): Promise<string> {
    const { createDecipheriv } = await import('node:crypto');
    const parts = ciphertext.split(':');
    if (parts[0] !== 'v1' || parts.length !== 4) {
      throw new Error('Invalid ciphertext format');
    }
    const iv = Buffer.from(parts[1]!, 'base64');
    const tag = Buffer.from(parts[2]!, 'base64');
    const data = Buffer.from(parts[3]!, 'base64');
    const keyBytes = await this.resolveKeyBytes(key);
    const decipher = createDecipheriv('aes-256-gcm', keyBytes, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}

export function createNoopEncryptionProvider(): EncryptionProvider {
  return new NoopEncryptionProvider();
}
