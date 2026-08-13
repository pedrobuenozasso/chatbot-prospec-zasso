import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from './config.mjs';

function encryptionKey(secret = config.weekendHandoffEncryptionKey) {
  const value = String(secret || '').trim();
  const key = /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error('WEEKEND_HANDOFF_ENCRYPTION_KEY deve conter 32 bytes em hexadecimal ou base64.');
  }
  return key;
}

export function validateWeekendEncryptionKey(secret = config.weekendHandoffEncryptionKey) {
  encryptionKey(secret);
  return true;
}

export function encryptWeekendRecipient(recipient, secret = config.weekendHandoffEncryptionKey) {
  const normalized = String(recipient || '').replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(normalized)) throw new Error('Destinatário de fim de semana inválido.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv, tag, ciphertext].map((part) => Buffer.isBuffer(part) ? part.toString('base64url') : part).join('.');
}

export function decryptWeekendRecipient(payload, secret = config.weekendHandoffEncryptionKey) {
  const [version, ivValue, tagValue, encryptedValue] = String(payload || '').split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Destinatário criptografado inválido.');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  if (!/^\d{10,15}$/.test(plaintext)) throw new Error('Destinatário descriptografado inválido.');
  return plaintext;
}
