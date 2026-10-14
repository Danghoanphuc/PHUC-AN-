import { mutate, supabase, type Rpc } from './supabase';
import { sessionStorageAdapter } from './storage';
import { savePosDraft } from './posDraft';
export type Pending = { actor: string; name: Rpc; payload: Record<string, unknown>; key: string };
const storageKey = (actor: string) => `phucan.pending.${actor}`;
export async function pendingMutation(actor: string): Promise<Pending | null> {
  const json = await sessionStorageAdapter.getItem(storageKey(actor));
  return json ? (JSON.parse(json) as Pending) : null;
}
export async function submitMutation(name: Rpc, payload: Record<string, unknown>, key: string) {
  const { data } = await supabase.auth.getSession();
  const actor = data.session?.user.id;
  if (!actor) throw Error('Phiên đăng nhập đã hết hạn.');
  const old = await pendingMutation(actor);
  if (old && old.key !== key)
    throw Error(
      'Có thao tác chưa xác định kết quả. Vào Thêm → Thao tác chờ xác nhận để thử lại trước khi tạo giao dịch mới.',
    );
  const request: Pending = { actor, name, payload, key };
  await sessionStorageAdapter.setItem(storageKey(actor), JSON.stringify(request));
  try {
    const result = await mutate(name, payload, key);
    // Also covers a POS retry completed from More after restarting the app.
    if (name === 'post_pos_sale') await savePosDraft(actor, null);
    await sessionStorageAdapter.removeItem(storageKey(actor));
    return result;
  } catch (e) {
    // Known PostgreSQL/PostgREST failures mean the atomic server transaction was rejected.
    // Network failures stay encrypted on the device and are retried with exactly the same request.
    const code = (e as { code?: string }).code;
    if (code && /^(?:[0-9A-Z]{5}|PGRST\d+)$/.test(code))
      await sessionStorageAdapter.removeItem(storageKey(actor));
    throw e;
  }
}
