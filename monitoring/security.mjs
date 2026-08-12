import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { monitoringConfig } from './config.mjs';

const scrypt = promisify(scryptCallback);
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function hashPassword(password) {
  if (String(password).length < 14) throw new Error('A senha deve ter pelo menos 14 caracteres.');
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(`${password}${monitoringConfig.passwordPepper}`, salt, 64, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, n, r, p, salt, expected] = String(encoded).split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const derived = await scrypt(`${password}${monitoringConfig.passwordPepper}`, salt, 64, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return safeEqual(derived.toString('hex'), expected);
}

function encryptionKey() {
  return createHash('sha256').update(monitoringConfig.encryptionKey).digest();
}

export function encryptSecret(plainText) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(encoded) {
  const [version, iv, tag, encrypted] = String(encoded).split('.');
  if (version !== 'v1') throw new Error('Formato de segredo inválido.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function randomTotpSecret() {
  const bytes = randomBytes(20);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let result = '';
  for (let index = 0; index < bits.length; index += 5) {
    result += BASE32[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return result;
}

function decodeBase32(value) {
  const clean = String(value).replace(/=+$/g, '').toUpperCase();
  let bits = '';
  for (const character of clean) {
    const index = BASE32.indexOf(character);
    if (index < 0) throw new Error('Segredo TOTP inválido.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpAt(secret, counter) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, '0');
}

export function verifyTotp(secret, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code))) return false;
  const counter = Math.floor(now / 30000);
  return [-1, 0, 1].some((offset) => safeEqual(totpAt(secret, counter + offset), code));
}

export function totpUri(secret, email) {
  const label = encodeURIComponent(`Zasso Monitor:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=Zasso%20Monitor&algorithm=SHA1&digits=6&period=30`;
}

export function newOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function randomLoginCode() {
  return String(randomInt(100000, 1000000));
}

export function secureEqual(left, right) {
  return safeEqual(left, right);
}

export function redactSensitiveText(value) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removido]')
    .replace(/\b(?:\+?\d[\s().-]?){10,15}\b/g, '[telefone removido]')
    .replace(/\b\d{3}[.-]?\d{3}[.-]?\d{3}-?\d{2}\b/g, '[documento removido]')
    .replace(/\b\d{2}[.-]?\d{3}[.-]?\d{3}\/?\d{4}-?\d{2}\b/g, '[documento removido]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}
