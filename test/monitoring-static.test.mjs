import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('painel não depende de scripts externos e declara noindex', async () => {
  const html = await readFile(new URL('../monitoring/public/index.html', import.meta.url), 'utf8');
  assert.match(html, /noindex,nofollow,noarchive/);
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
  assert.match(html, /app\.js/);
  assert.doesNotMatch(html, /type="password"|Código do autenticador/);
  assert.match(html, /Código recebido por e-mail/);
  assert.match(html, /brand\.css/);
  assert.match(html, /zasso-logo-(?:black|white)\.png/);
});

test('identidade visual utiliza somente imagens locais da Zasso', async () => {
  const assets = await Promise.all([
    'zasso-logo-black.png', 'zasso-logo-white.png', 'zasso-e-coffee.png', 'zasso-raiden.png',
  ].map((name) => readFile(new URL(`../monitoring/public/assets/${name}`, import.meta.url))));
  assert.ok(assets.every((asset) => asset.length > 1000));
});

test('painel abre o histórico pela rota compatível com a Vercel e identifica lead e bot', async () => {
  const script = await readFile(new URL('../monitoring/public/app.js', import.meta.url), 'utf8');
  assert.match(script, /\/api\/conversation\?id=/);
  assert.match(script, /Mensagem recebida/);
  assert.match(script, /Resposta enviada/);
  assert.match(script, /Bot Zasso/);
  assert.doesNotMatch(script, /api\(`\/api\/conversations\/\$\{encodeURIComponent\(id\)\}`\)/);
});

test('exemplo de produção restringe o painel aos dois e-mails autorizados', async () => {
  const environment = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  const allowed = environment.match(/^MONITORING_ALLOWED_EMAILS=(.+)$/m)?.[1].split(',').sort();
  assert.deepEqual(allowed, [
    'pedro.bueno@zasso.com.br',
    'rodrigo.conilho@zasso.com.br',
  ]);
});

test('compose mantém painel separado e atrás do HTTPS do proxy', async () => {
  const compose = await readFile(new URL('../docker-compose.monitoring.yml', import.meta.url), 'utf8');
  assert.match(compose, /zasso-monitoring:/);
  assert.match(compose, /entrypoints=websecure/);
  assert.match(compose, /tls\.certresolver=letsencrypt/);
  assert.match(compose, /MONITORING_PUBLIC_ORIGIN:-https:\/\/zasso-monitoring/);
  assert.doesNotMatch(compose, /ports:/);
});

test('implantação Vercel usa proxy fixo e não recebe credenciais do banco', async () => {
  const [configuration, proxy] = await Promise.all([
    readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
    readFile(new URL('../api/[...path].mjs', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(configuration + proxy, /CLOUDSQL_DB_PASSWORD|DATABASE_PASSWORD/);
  assert.match(proxy, /MONITORING_UPSTREAM_ORIGIN/);
  assert.match(proxy, /x-monitoring-proxy-token/);
  assert.match(proxy, /\^https:/);
});
