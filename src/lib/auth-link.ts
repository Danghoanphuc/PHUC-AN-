import { supabase } from './supabase';
import { projectUrl } from './config';
export async function acceptAuthLink(value: string) {
  const link = new URL(value.trim());
  if (link.origin === projectUrl && link.pathname === '/auth/v1/verify') {
    const token = link.searchParams.get('token') ?? link.searchParams.get('token_hash');
    const type = link.searchParams.get('type');
    if (!token || !['signup', 'magiclink', 'recovery', 'email'].includes(type ?? ''))
      throw Error('Liên kết xác minh không hợp lệ.');
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type as 'signup' | 'magiclink' | 'recovery' | 'email',
    });
    if (error) throw error;
    return;
  }
  if (
    link.protocol === 'phucan:' ||
    (typeof location !== 'undefined' && link.origin === location.origin)
  ) {
    const params = new URLSearchParams(link.hash.replace(/^#/, ''));
    const access_token = params.get('access_token'),
      refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
      return;
    }
  }
  throw Error(
    'Dùng liên kết xác minh do Supabase của Phúc An gửi, không dùng liên kết từ project khác.',
  );
}
