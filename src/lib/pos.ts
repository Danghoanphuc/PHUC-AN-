import type { Data } from './data';
import type { Row } from './supabase';
import { today } from './format';
export const searchText = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
export function posPrice(data: Data, customer: Row<'customers'>, productId: string, day = today()) {
  const tier = customer.customer_type === 'Khách lẻ' ? 'retail' : 'wholesale';
  return data.prices
    .filter(
      (p) =>
        p.product_id === productId &&
        p.price_tier === tier &&
        (p.customer_id === customer.id || p.customer_id === null) &&
        p.effective_from <= day &&
        (!p.effective_to || p.effective_to >= day),
    )
    .sort(
      (a, b) =>
        Number(b.customer_id === customer.id) - Number(a.customer_id === customer.id) ||
        b.effective_from.localeCompare(a.effective_from),
    )[0];
}
/** Same positive half-up monetary rounding as PostgreSQL numeric, once per line. */
export function posLineTotal(
  pieces: number,
  amount: number,
  pricePieces: number,
  discount: number,
) {
  const cents = BigInt(amount.toFixed(2).replace('.', ''));
  const unit = BigInt(Math.round(pricePieces * 10000));
  const numerator = cents * BigInt(pieces) * BigInt(10000 - Math.round(discount * 100));
  return Number((numerator * 2n + unit) / (unit * 2n)) / 100;
}
export function favoriteProducts(data: Data, customerId: string) {
  const orders = new Set(
    data.orders
      .filter((o) => o.customer_id === customerId && o.status !== 'cancelled')
      .map((o) => o.id),
  );
  const counts = new Map<string, number>();
  for (const item of data.orderItems)
    if (item.product_id && orders.has(item.order_id))
      counts.set(item.product_id, (counts.get(item.product_id) || 0) + item.order_qty);
  return counts;
}
