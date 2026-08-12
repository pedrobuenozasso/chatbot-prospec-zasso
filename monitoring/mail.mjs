import { monitoringConfig, isAllowedAdminEmail } from './config.mjs';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function allowedEndpoint(value) {
  const endpoint = new URL(value);
  const localHost = endpoint.hostname === 'sacf-mail-service' || endpoint.hostname === '127.0.0.1' || endpoint.hostname === 'localhost';
  if (endpoint.protocol !== 'http:' || !localHost || endpoint.username || endpoint.password) {
    throw new Error('MAIL_SERVICE_ENDPOINT_NOT_ALLOWED');
  }
  return endpoint;
}

export function loginCodeMessage({ code, minutes }) {
  const safeCode = escapeHtml(code);
  const safeMinutes = Number(minutes);
  return {
    subject: 'Seu código de acesso — Zasso Monitor',
    text: `Seu código de acesso ao Zasso Monitor é ${code}. Ele expira em ${safeMinutes} minutos e pode ser usado somente uma vez. Se você não solicitou este código, ignore este e-mail.`,
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f3f6f3;font-family:Arial,sans-serif;color:#10201a"><div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #dce5df;border-radius:16px;overflow:hidden"><div style="background:#0d241a;padding:24px;color:#fff"><strong style="font-size:20px">Zasso Monitor</strong><div style="color:#a9bcb0;margin-top:5px">Acesso administrativo protegido</div></div><div style="padding:30px"><p>Use o código abaixo para entrar:</p><div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#136b46;margin:24px 0">${safeCode}</div><p>Ele expira em <strong>${safeMinutes} minutos</strong> e pode ser usado somente uma vez.</p><p style="color:#617069;font-size:13px;margin-top:26px">Se você não solicitou este código, ignore este e-mail. Nunca compartilhe o código com outra pessoa.</p></div></div></body></html>`,
  };
}

export async function sendLoginCodeEmail({
  email,
  code,
  minutes = monitoringConfig.emailCodeMinutes,
  serviceUrl = monitoringConfig.mailServiceUrl,
  serviceToken = monitoringConfig.mailServiceToken,
  fetchImpl = fetch,
}) {
  if (!isAllowedAdminEmail(email)) throw new Error('EMAIL_NOT_ALLOWED');
  if (String(serviceToken).length < 16) throw new Error('MAIL_SERVICE_TOKEN_MISSING');
  const endpoint = new URL('/v1/send', allowedEndpoint(serviceUrl));
  const message = loginCodeMessage({ code, minutes });
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-service-token': serviceToken },
    body: JSON.stringify({ to: [email], ...message }),
    signal: AbortSignal.timeout(7000),
  });
  const result = await response.json().catch(() => ({}));
  if (response.status !== 202 || result.status !== 'queued') throw new Error(`MAIL_SERVICE_HTTP_${response.status}`);
  return { queued: true, jobId: String(result.job_id || '').slice(0, 80) };
}
