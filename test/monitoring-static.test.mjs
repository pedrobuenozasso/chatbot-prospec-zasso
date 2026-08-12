import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('painel não depende de scripts externos e declara noindex', async () => {
  const html = await readFile(new URL('../monitoring/public/index.html', import.meta.url), 'utf8');
  assert.match(html, /noindex,nofollow,noarchive/);
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
  assert.match(html, /app\.js/);
});

test('compose mantém painel separado e atrás do HTTPS do proxy', async () => {
  const compose = await readFile(new URL('../docker-compose.monitoring.yml', import.meta.url), 'utf8');
  assert.match(compose, /zasso-monitoring:/);
  assert.match(compose, /entrypoints=websecure/);
  assert.match(compose, /tls\.certresolver=letsencrypt/);
  assert.doesNotMatch(compose, /ports:/);
});
