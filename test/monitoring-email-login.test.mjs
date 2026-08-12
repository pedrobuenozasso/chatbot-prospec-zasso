import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loginCodeMessage, sendLoginCodeEmail } from '../monitoring/mail.mjs';
import { randomLoginCode } from '../monitoring/security.mjs';

test('código de acesso tem seis dígitos e usa aleatoriedade criptográfica', () => {
  const codes = new Set(Array.from({ length: 30 }, () => randomLoginCode()));
  for (const code of codes) assert.match(code, /^\d{6}$/);
  assert.ok(codes.size > 1);
});

test('mail service recebe somente destinatário autorizado e conteúdo do OTP', async () => {
  let captured;
  const result = await sendLoginCodeEmail({
    email: 'pedro.bueno@zasso.com', code: '482731', minutes: 10,
    serviceUrl: 'http://sacf-mail-service:8015', serviceToken: 'a'.repeat(32),
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return new Response('{"status":"queued","job_id":"job-1"}', { status: 202, headers: { 'content-type': 'application/json' } });
    },
  });
  assert.deepEqual(result, { queued: true, jobId: 'job-1' });
  assert.equal(captured.url, 'http://sacf-mail-service:8015/v1/send');
  assert.equal(captured.options.headers['x-service-token'], 'a'.repeat(32));
  const body = JSON.parse(captured.options.body);
  assert.deepEqual(body.to, ['pedro.bueno@zasso.com']);
  assert.match(body.text, /482731/);
  assert.doesNotMatch(body.text, /senha|password/i);
});

test('cliente de e-mail bloqueia endpoint externo', async () => {
  await assert.rejects(
    sendLoginCodeEmail({
      email: 'pedro.bueno@zasso.com', code: '482731',
      serviceUrl: 'https://evil.example', serviceToken: 'a'.repeat(32), fetchImpl: async () => new Response(),
    }),
    /MAIL_SERVICE_ENDPOINT_NOT_ALLOWED/,
  );
});

test('template não permite injetar HTML no código', () => {
  const message = loginCodeMessage({ code: '<script>alert(1)</script>', minutes: 10 });
  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /&lt;script&gt;/);
});

test('migration cria códigos descartáveis sem armazenar o código puro', async () => {
  const migration = await readFile(new URL('../db/migrations/003_email_login_codes.sql', import.meta.url), 'utf8');
  assert.match(migration, /chatbot_admin_email_codes/);
  assert.match(migration, /code_hash char\(64\)/);
  assert.match(migration, /consumed_at/);
  assert.doesNotMatch(migration, /\bcode\s+(?:text|varchar|char)\b/i);
});
