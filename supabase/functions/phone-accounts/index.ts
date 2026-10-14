import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { normalizePhone, phoneIdentity } from '../../../src/lib/phone.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
async function hash(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
    (x) => x.toString(16).padStart(2, '0'),
  ).join('');
}
// JWT verification is performed below with Auth.getUser; bootstrap uses an expiring,
// single-use 256-bit capability. No anonymous account creation is accepted.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'Phương thức không hợp lệ.' }, 405);
  try {
    const b = await req.json();
    if (typeof b.password !== 'string' || b.password.length < 12 || b.password.length > 128)
      return json({ error: 'Mật khẩu cần từ 12 đến 128 ký tự.' }, 400);
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let actor: string | null = null,
      setupHash: string | null = null,
      target: string;
    const phone = b.action === 'reset' ? null : normalizePhone(String(b.phone ?? ''));
    if (b.action === 'bootstrap') {
      if (typeof b.token !== 'string' || !/^[a-f0-9]{64}$/.test(b.token))
        return json({ error: 'Liên kết thiết lập không hợp lệ.' }, 403);
      setupHash = await hash(b.token);
      const { data, error } = await admin.rpc('phone_setup_target', {
        token_hash: setupHash,
        phone,
      });
      if (error || !data)
        return json({ error: 'Liên kết thiết lập đã hết hạn hoặc đã sử dụng.' }, 403);
      target = data;
      const { error: updateError } = await admin.auth.admin.updateUserById(target, {
        email: phoneIdentity(phone!),
        password: b.password,
        email_confirm: true,
      });
      if (updateError) throw updateError;
    } else {
      const jwt = req.headers.get('Authorization')?.replace(/^Bearer /i, '') ?? '';
      const { data: auth, error: authError } = await admin.auth.getUser(jwt);
      if (authError || !auth.user) return json({ error: 'Vui lòng đăng nhập lại.' }, 401);
      actor = auth.user.id;
      const { data: member } = await admin
        .from('app_members')
        .select('role,active')
        .eq('user_id', actor)
        .single();
      if (member?.role !== 'owner' || !member.active)
        return json({ error: 'Chỉ chủ doanh nghiệp được cấp tài khoản.' }, 403);
      if (b.action === 'reset') {
        target = String(b.user_id ?? '');
        const { data: recipient } = await admin
          .from('app_members')
          .select('role')
          .eq('user_id', target)
          .single();
        if (!recipient || recipient.role === 'owner')
          return json({ error: 'Không thể đặt lại mật khẩu tài khoản này.' }, 403);
        const { error } = await admin.auth.admin.updateUserById(target, { password: b.password });
        if (error) throw error;
        return json({ user_id: target });
      }
      if (
        b.action !== 'create' ||
        !['manager', 'staff'].includes(b.role) ||
        typeof b.request_key !== 'string' ||
        b.request_key.length < 16
      )
        return json({ error: 'Thông tin cấp tài khoản chưa hợp lệ.' }, 400);
      const digest = await hash(`${actor}:${b.request_key}`);
      target = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
      const email = phoneIdentity(phone!);
      const { data: existing } = await admin.auth.admin.getUserById(target);
      if (existing.user) {
        if (existing.user.email !== email)
          return json({ error: 'Mã yêu cầu đã dùng cho tài khoản khác.' }, 409);
      } else {
        const { error } = await admin.auth.admin.createUser({
          id: target,
          email,
          password: b.password,
          email_confirm: true,
        });
        if (error)
          return json(
            {
              error:
                'Không thể cấp tài khoản. Kiểm tra số điện thoại đã được sử dụng hoặc chính sách mật khẩu.',
            },
            409,
          );
      }
    }
    const { error } = await admin.rpc('provision_phone_member', {
      payload: {
        user_id: target,
        actor,
        token_hash: setupHash,
        phone,
        full_name: String(b.full_name ?? '')
          .trim()
          .slice(0, 150),
        role: b.action === 'bootstrap' ? 'owner' : b.role,
      },
    });
    if (error) throw error;
    return json({ user_id: target });
  } catch {
    return json(
      { error: 'Không thể hoàn tất cấp tài khoản. Kiểm tra thông tin rồi thử lại.' },
      400,
    );
  }
});
