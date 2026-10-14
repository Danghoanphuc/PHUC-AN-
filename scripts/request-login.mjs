import { readFileSync } from 'node:fs';
const config = readFileSync(new URL('../src/lib/config.ts', import.meta.url), 'utf8');
const url = config.match(/projectUrl = '([^']+)'/)[1];
const key = config.match(/publishableKey = '([^']+)'/)[1];
const email = process.argv[2];
if (!email || !email.includes('@'))
  throw Error('Pass the approved email address as the only argument.');
const response = await fetch(`${url}/auth/v1/otp`, {
  method: 'POST',
  headers: { apikey: key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, create_user: true }),
});
const body = await response.json();
console.log(
  JSON.stringify(
    {
      status: response.status,
      code: body.error_code,
      message: response.ok ? 'Verification email requested' : (body.msg ?? body.message),
    },
    null,
    2,
  ),
);
if (!response.ok) process.exitCode = 1;
