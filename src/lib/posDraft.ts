import { sessionStorageAdapter } from './storage';

export interface PosDraft {
  customerId: string;
  orderId: string;
  pieces: Record<string, number>;
  typed: Record<string, string>;
  note: string;
  key: string;
}
// Serialize writes across mounts; a slow SecureStore write must not resurrect an old cart.
let writes: Promise<unknown> = Promise.resolve();
const storageKey = (actor: string) => `phucan.pos-draft.${actor}`;
export async function readPosDraft(actor: string): Promise<PosDraft | null> {
  await writes.catch(() => {});
  const raw = await sessionStorageAdapter.getItem(storageKey(actor));
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value.version !== 1 || !value.draft || typeof value.draft.key !== 'string') return null;
  return value.draft;
}
export function savePosDraft(actor: string, draft: PosDraft | null) {
  const raw = draft ? JSON.stringify({ version: 1, draft }) : null;
  const next = writes
    .catch(() => {})
    .then(() =>
      raw
        ? sessionStorageAdapter.setItem(storageKey(actor), raw)
        : sessionStorageAdapter.removeItem(storageKey(actor)),
    );
  writes = next;
  return next;
}
