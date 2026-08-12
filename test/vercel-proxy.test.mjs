import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/[...path].mjs';

test('proxy da Vercel preserva rota, query e método da API', async () => {
  const originalFetch = global.fetch;
  const originalOrigin = process.env.MONITORING_UPSTREAM_ORIGIN;
  let captured;
  process.env.MONITORING_UPSTREAM_ORIGIN = 'https://monitoring.example.test';
  global.fetch = async (target, options) => {
    captured = { target: String(target), options };
    return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    send(payload) { this.payload = payload; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { return this; },
  };
  try {
    await handler({
      method: 'GET', url: '/api/conversations?page=2&segment=agro',
      headers: { origin: 'https://zasso-monitoring.vercel.app' }, query: {}, socket: {},
    }, response);
    assert.equal(captured.target, 'https://monitoring.example.test/api/conversations?page=2&segment=agro');
    assert.equal(captured.options.method, 'GET');
    assert.equal(response.statusCode, 200);
  } finally {
    global.fetch = originalFetch;
    if (originalOrigin == null) delete process.env.MONITORING_UPSTREAM_ORIGIN;
    else process.env.MONITORING_UPSTREAM_ORIGIN = originalOrigin;
  }
});
