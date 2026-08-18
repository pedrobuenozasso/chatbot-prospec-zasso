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
  assert.match(html, /zasso-logo-black\.png/);
  assert.match(html, /zasso-logo-round-black\.png/);
  assert.match(html, /rel="icon"[^>]+zasso-symbol-favicon\.png/);
  assert.match(html, /rel="apple-touch-icon"[^>]+zasso-symbol-touch-icon\.png/);
  assert.doesNotMatch(html, /Sem senha\. Código temporário/);
});

test('identidade visual utiliza somente imagens locais da Zasso', async () => {
  const assets = await Promise.all([
    'zasso-logo-black.png', 'zasso-logo-white.png', 'zasso-logo-round-black.png', 'zasso-symbol-favicon.png',
    'zasso-symbol-touch-icon.png', 'zasso-e-coffee.png', 'zasso-raiden.png', 'zasso-headquarters-machines.png',
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

test('fila de revisão é seletiva, exportável e acessível pelo sino', async () => {
  const [html, script, server, database] = await Promise.all([
    readFile(new URL('../monitoring/public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../monitoring/public/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../monitoring/server.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../monitoring/database.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /Revisão humana seletiva/);
  assert.match(html, /Exportar HTML/);
  assert.match(html, /Exportar JSON/);
  assert.match(script, /data-review-flag/);
  assert.match(script, /api\/reviews\?limit=100/);
  assert.match(server, /\/api\/review-export/);
  assert.match(script, /api\/conversation-review/);
  assert.match(script, /api\/review-export/);
  assert.match(server, /contact_data_redacted/);
  assert.match(database, /r\.status = 'needs_action'/);
});

test('análise corrige tipagem do PostgreSQL e considera somente conversas marcadas', async () => {
  const database = await readFile(new URL('../monitoring/database.mjs', import.meta.url), 'utf8');
  assert.match(database, /status = \$2::varchar/);
  assert.match(database, /error_code = \$5::varchar/);
  assert.match(database, /latest_reviews r ON r\.conversation_key = c\.conversation_key AND r\.status = 'needs_action'/);
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

test('central separa WhatsApp de campanhas e usa rota Meta compatível com a Vercel', async () => {
  const [html, script, server] = await Promise.all([
    readFile(new URL('../monitoring/public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../monitoring/public/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../monitoring/server.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="whatsapp-nav"/);
  assert.match(html, /id="marketing-nav"/);
  assert.match(html, /data-marketing-view="overview"/);
  assert.match(html, /data-marketing-view="performance"/);
  assert.match(html, /data-marketing-view="list"/);
  assert.match(html, /id="campaign-screen-overview"/);
  assert.match(html, /id="campaign-screen-performance"/);
  assert.match(html, /id="campaign-screen-list"/);
  assert.match(html, /Voltar à Central/);
  assert.match(html, /class="area-card-action area-card-button" type="button" data-area="whatsapp"/);
  assert.match(html, /class="area-card-action area-card-button" type="button" data-area="campaigns"/);
  assert.doesNotMatch(html, /<article[^>]+data-area=/);
  assert.doesNotMatch(html, /class="area-card-number"/);
  assert.doesNotMatch(html, /area-card-signal|area-card-orbit/);
  assert.match(script, /\/api\/meta-campaigns\?/);
  assert.match(server, /'\/api\/meta-campaigns'/);
  assert.match(script, /showApp\(selectedArea\)/);
  assert.match(script, /function setCampaignScreen/);
  assert.match(script, /function campaignFunnel/);
  assert.match(script, /function campaignSpendDistribution/);
  assert.match(script, /function campaignTimelineChart/);
  assert.match(script, /function smoothChartPath/);
  assert.match(script, /campaign-series-chart/);
  assert.match(script, /campaign-donut-wrap/);
  assert.match(script, /function completeCampaignDailyRows/);
  assert.match(script, /Custo\/conversa/);
});
