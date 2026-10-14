import { supabase } from './supabase';
import { normalizePhone } from './phone';
export async function manageAccount(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('phone-accounts', {
    body: {
      ...payload,
      ...(payload.phone ? { phone: normalizePhone(String(payload.phone)) } : {}),
    },
  });
  if (error) {
    const response = error.context;
    if (response instanceof Response) {
      const body = await response.json().catch(() => null);
      if (body?.error) throw Error(body.error);
    }
    throw error;
  }
  return data as { user_id: string };
}
