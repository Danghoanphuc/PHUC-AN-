import { readFileSync } from 'node:fs';
const config = readFileSync(new URL('../src/lib/config.ts', import.meta.url), 'utf8');
const url = config.match(/projectUrl = '([^']+)'/)[1];
const key = config.match(/publishableKey = '([^']+)'/)[1];
const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
const settings = await response.json();
console.log(
  JSON.stringify(
    {
      status: response.status,
      phone: settings.external?.phone,
      email: settings.external?.email,
      disable_signup: settings.disable_signup,
      phone_autoconfirm: settings.phone_autoconfirm,
    },
    null,
    2,
  ),
);
