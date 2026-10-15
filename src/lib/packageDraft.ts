import { sessionStorageAdapter } from './storage';
export type PackageDraft = {
  customerId: string;
  bi: string;
  hop: string;
  note: string;
  key: string;
};
let writes: Promise<unknown> = Promise.resolve();
const storageKey = (actor: string) => `phucan.package-draft.${actor}`;
export async function readPackageDraft(actor: string): Promise<PackageDraft | null> {
  await writes.catch(() => {});
  const raw = await sessionStorageAdapter.getItem(storageKey(actor));
  if (!raw) return null;
  const value = JSON.parse(raw);
  return value?.version === 1 && typeof value.draft?.key === 'string' ? value.draft : null;
}
export function savePackageDraft(actor: string, draft: PackageDraft | null) {
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
