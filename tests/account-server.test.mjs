import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const source =
  readFileSync('src/lib/phone.ts', 'utf8').replaceAll('export function', 'function') +
  '\n' +
  readFileSync('supabase/functions/phone-accounts/index.ts', 'utf8').replace(
    /^import .*;\r?\n/gm,
    '',
  );
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
function server({
  role = 'owner',
  active = true,
  valid = true,
  recipient = 'staff',
  existing = null,
  setup = null,
} = {}) {
  const writes = [];
  let handler;
  const client = {
    auth: {
      getUser: async (jwt) => ({
        data: { user: valid && jwt === 'VALID_TOKEN' ? { id: 'actor' } : null },
      }),
      admin: {
        getUserById: async () => ({ data: { user: existing } }),
        createUser: async (body) => {
          writes.push({ op: 'create', body });
          return {};
        },
        updateUserById: async (id, body) => {
          writes.push({ op: 'update', id, body });
          return {};
        },
      },
    },
    from: () => ({
      select: () => ({
        eq: (_, id) => ({
          single: async () => ({ data: id === 'actor' ? { role, active } : { role: recipient } }),
        }),
      }),
    }),
    rpc: async (name, body) => {
      writes.push({ op: name, body });
      return name === 'phone_setup_target' ? { data: setup } : { data: null };
    },
  };
  runInNewContext(code, {
    createClient: () => client,
    Deno: { env: { get: () => 'TEST_ONLY' }, serve: (h) => (handler = h) },
    crypto: webcrypto,
    TextEncoder,
    Uint8Array,
    Response,
  });
  const request = async (body, token = 'VALID_TOKEN') =>
    handler(
      new Request('http://test/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  return { request, writes };
}
const body = {
  action: 'create',
  phone: '0912345678',
  password: 'TEST_INITIAL_PASSWORD',
  role: 'staff',
  full_name: 'Test',
  request_key: 'test-request-key-123',
};
test('account server rejects anonymous, manager and inactive owner before Auth Admin writes', async () => {
  for (const options of [{ valid: false }, { role: 'manager' }, { active: false }]) {
    const s = server(options),
      r = await s.request(body);
    assert.ok([401, 403].includes(r.status));
    assert.deepEqual(s.writes, []);
  }
});
test('account server creates confirmed internal identity, normalizes phone and never passes password to DB', async () => {
  const s = server(),
    r = await s.request(body);
  assert.equal(r.status, 200);
  assert.equal(s.writes[0].body.email, '84912345678@phone.phucan.invalid');
  assert.equal(s.writes[0].body.email_confirm, true);
  assert.equal(s.writes[1].body.payload.phone, '+84912345678');
  assert.ok(!JSON.stringify(s.writes[1]).includes(body.password));
});
test('create retry never changes an existing password and cannot create owners', async () => {
  const s = server({ existing: { email: '84912345678@phone.phucan.invalid' } });
  assert.equal((await s.request(body)).status, 200);
  assert.equal(s.writes.filter((w) => ['create', 'update'].includes(w.op)).length, 0);
  assert.equal((await s.request({ ...body, role: 'owner' })).status, 400);
});
test('bootstrap must validate server capability before touching Auth, and reset cannot target owner', async () => {
  const s = server();
  assert.equal(
    (await s.request({ ...body, action: 'bootstrap', token: 'a'.repeat(64) }, '')).status,
    403,
  );
  assert.equal(s.writes.filter((w) => w.op === 'update').length, 0);
  const owner = server({ recipient: 'owner' });
  assert.equal((await owner.request({ ...body, action: 'reset', user_id: 'owner' })).status, 403);
  assert.deepEqual(owner.writes, []);
  const staff = server();
  assert.equal((await staff.request({ ...body, action: 'reset', user_id: 'staff' })).status, 200);
  assert.equal(staff.writes[0].op, 'update');
});
