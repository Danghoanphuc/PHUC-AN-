import { readFileSync } from 'node:fs';
const config = readFileSync(new URL('../src/lib/config.ts', import.meta.url), 'utf8');
const url = config.match(/projectUrl = '([^']+)'/)[1],
  key = config.match(/publishableKey = '([^']+)'/)[1];
for (const table of ['customers', 'products', 'cash_movements', 'member_profiles']) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key },
  });
  const json = await response.json();
  if (response.ok && Array.isArray(json) && json.length)
    throw Error(`Anonymous data exposed: ${table}`);
  console.log(`${table}: anonymous access blocked (${response.status})`);
}
