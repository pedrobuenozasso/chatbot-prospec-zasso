import { createOrUpdateUser, closeDatabase } from './database.mjs';
import { assertSecureMonitoringConfig, isAllowedAdminEmail } from './config.mjs';
import { encryptSecret, randomTotpSecret, totpUri } from './security.mjs';

assertSecureMonitoringConfig();

const [emailInput, displayNameInput, roleInput, passwordInput] = process.argv.slice(2);
const email = String(emailInput || '').trim().toLowerCase();
const displayName = String(displayNameInput || '').trim();
const role = ['viewer', 'reviewer', 'admin'].includes(roleInput) ? roleInput : 'admin';
const password = String(passwordInput || '');

if (!isAllowedAdminEmail(email) || !displayName || password.length < 14) {
  console.error('Uso: node monitoring/create-user.mjs email@zasso.com "Nome" admin "senha-com-14-ou-mais"');
  process.exitCode = 2;
} else {
  const secret = randomTotpSecret();
  const user = await createOrUpdateUser({
    email,
    displayName,
    role,
    password,
    totpSecretEncrypted: encryptSecret(secret),
  });
  console.log(JSON.stringify({
    created: true,
    user: { email: user.email, displayName: user.display_name, role: user.role },
    totpSecret: secret,
    totpUri: totpUri(secret, email),
    warning: 'Cadastre o TOTP agora e apague esta saída. O segredo não será exibido novamente.',
  }, null, 2));
}

await closeDatabase();
