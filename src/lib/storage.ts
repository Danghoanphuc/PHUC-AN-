import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Chunk native session JSON because a Supabase session can exceed SecureStore's per-value size.
// Web session, pending requests and actor-scoped POS drafts stay in the current tab.
export const sessionStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web')
      return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key);
    const manifest = await SecureStore.getItemAsync(`${key}.manifest`);
    if (!manifest) return null;
    const { generation, count } = JSON.parse(manifest) as { generation: string; count: number };
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(`${key}.${generation}.${i}`),
      ),
    );
    return parts.every((part) => part !== null) ? parts.join('') : null;
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      sessionStorage.setItem(key, value);
      return;
    }
    const old = await SecureStore.getItemAsync(`${key}.manifest`);
    const generation = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const parts = value.match(/[\s\S]{1,450}/g) ?? [];
    await Promise.all(
      parts.map((part, i) => SecureStore.setItemAsync(`${key}.${generation}.${i}`, part)),
    );
    await SecureStore.setItemAsync(
      `${key}.manifest`,
      JSON.stringify({ generation, count: parts.length }),
    );
    if (old) {
      const previous = JSON.parse(old) as { generation: string; count: number };
      await Promise.all(
        Array.from({ length: previous.count }, (_, i) =>
          SecureStore.deleteItemAsync(`${key}.${previous.generation}.${i}`),
        ),
      );
    }
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      sessionStorage.removeItem(key);
      return;
    }
    const manifest = await SecureStore.getItemAsync(`${key}.manifest`);
    await SecureStore.deleteItemAsync(`${key}.manifest`);
    if (manifest) {
      const previous = JSON.parse(manifest) as { generation: string; count: number };
      await Promise.all(
        Array.from({ length: previous.count }, (_, i) =>
          SecureStore.deleteItemAsync(`${key}.${previous.generation}.${i}`),
        ),
      );
    }
  },
};
