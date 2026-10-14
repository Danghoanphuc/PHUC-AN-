import { createClient, processLock } from '@supabase/supabase-js';
import { sessionStorageAdapter } from './storage';
import { projectUrl, publishableKey } from './config';
import type { Database, Json } from '../types/database';

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL || projectUrl,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || publishableKey,
  {
    auth: {
      storage: sessionStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  },
);
export type Table = keyof Database['public']['Tables'];
export type Row<T extends Table> = Database['public']['Tables'][T]['Row'];
export type Role = 'owner' | 'manager' | 'staff';
export async function readRows<T extends Table>(name: T): Promise<Row<T>[]> {
  const results: Row<T>[] = [];
  for (let start = 0; start < 50000; start += 500) {
    const { data, error } = await supabase
      .from(name)
      .select('*')
      .order(
        name === 'order_product_name_rules'
          ? 'alias'
          : name === 'route_assignments'
            ? 'route_id'
            : name === 'app_members' || name === 'member_profiles'
              ? 'user_id'
              : name === 'product_units'
                ? 'product_id'
                : name === 'material_stock_baselines'
                  ? 'material_id'
                  : name === 'product_aliases'
                    ? 'alias_sku'
                    : name === 'sale_item_costs'
                      ? 'sale_item_id'
                      : 'id',
      )
      .range(start, start + 499);
    if (error) throw error;
    if (data !== null && !Array.isArray(data))
      throw Error('Không tải được danh sách dữ liệu. Vui lòng tải lại.');
    const page = (data ?? []) as unknown as Row<T>[];
    results.push(...page);
    if (page.length < 500) return results;
  }
  throw Error('Dữ liệu quá lớn. Cần bổ sung phân trang trước khi tải tiếp.');
}
export type Rpc = keyof Database['public']['Functions'];
export async function mutate(
  name: Rpc,
  payload: Record<string, unknown>,
  key: string,
): Promise<string> {
  const { data, error } = await supabase.rpc(name, {
    payload: payload as Json,
    request_key: key,
  } as never);
  if (error) throw error;
  return data as string;
}
