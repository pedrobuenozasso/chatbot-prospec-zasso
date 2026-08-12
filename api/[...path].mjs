const copiedResponseHeaders = [
  'cache-control', 'content-type', 'content-length',
  'content-disposition', 'x-content-type-options',
];

function requestPath(value) {
  const parts = Array.isArray(value) ? value : [value];
  const path = parts.filter(Boolean).join('/');
  if (!/^[a-zA-Z0-9._~!$&'()*+,;=:@/-]*$/.test(path) || path.includes('..')) {
    throw new Error('INVALID_PATH');
  }
  return path;
}

function appendQuery(target, query) {
  for (const [key, raw] of Object.entries(query || {})) {
    if (key === 'path') continue;
    for (const value of Array.isArray(raw) ? raw : [raw]) {
      if (value != null) target.searchParams.append(key, String(value));
    }
  }
}

function splitSetCookie(value) {
  return String(value || '').split(/,\s*(?=[!#$%&'*+.^_`|~0-9A-Za-z-]+=)/).filter(Boolean);
}

export default async function handler(request, response) {
  const upstreamOrigin = String(process.env.MONITORING_UPSTREAM_ORIGIN || '').replace(/\/$/, '');
  const proxyToken = String(process.env.MONITORING_PROXY_TOKEN || '');
  if (!/^https:\/\//.test(upstreamOrigin) || proxyToken.length < 32) {
    return response.status(503).json({ error: 'Monitoramento temporariamente indisponível.' });
  }

  let path;
  try { path = requestPath(request.query.path); } catch { return response.status(404).end(); }
  const target = new URL(`/api/${path}`, `${upstreamOrigin}/`);
  appendQuery(target, request.query);

  const headers = {
    accept: 'application/json',
    'content-type': request.headers['content-type'] || 'application/json',
    'user-agent': request.headers['user-agent'] || 'zasso-monitoring-vercel-proxy',
    'x-monitoring-proxy-token': proxyToken,
    'x-forwarded-for': String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || ''),
  };
  if (request.headers.cookie) headers.cookie = request.headers.cookie;
  if (request.headers.origin) headers.origin = request.headers.origin;
  if (request.headers['x-csrf-token']) headers['x-csrf-token'] = request.headers['x-csrf-token'];

  let body;
  if (!['GET', 'HEAD'].includes(request.method)) {
    body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(14000),
    });
    for (const header of copiedResponseHeaders) {
      const value = upstream.headers.get(header);
      if (value) response.setHeader(header, value);
    }
    const setCookies = typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : splitSetCookie(upstream.headers.get('set-cookie'));
    if (setCookies.length) response.setHeader('set-cookie', setCookies);
    const payload = Buffer.from(await upstream.arrayBuffer());
    return response.status(upstream.status).send(payload);
  } catch {
    return response.status(502).json({ error: 'Não foi possível acessar o serviço de monitoramento.' });
  }
}
