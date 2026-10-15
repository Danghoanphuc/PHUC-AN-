import type { AppContextValue } from './context';
import { decimal } from './format';
import { submitMutation } from './mutations';
import type { Data } from './data';
export type PackageUnit = 'bi' | 'hop';
export const packageLabel = (unit: string) => (unit === 'bi' ? 'bì' : 'hộp');
export function packagePrice(data: Data, customerId: string, unit: PackageUnit) {
  return (
    data.packagePrices.find((r) => r.customer_id === customerId && r.package_unit === unit) ||
    data.packagePrices.find((r) => r.customer_id === null && r.package_unit === unit)
  );
}
export function packageQuantity(raw: string) {
  return /^\d+(?:[.,]\d{1,2})?$/.test(raw) ? Number(raw.replace(',', '.')) : raw === '' ? 0 : NaN;
}
export function editPackagePrice(a: AppContextValue, customerId: string, unit: PackageUnit) {
  const rate = a.data.packagePrices.find(
    (r) => r.customer_id === (customerId || null) && r.package_unit === unit,
  );
  const customer = a.data.customers.find((c) => c.id === customerId);
  a.openForm({
    title: `Giá ${packageLabel(unit)} · ${customer?.name || 'Giá chung'}`,
    description: customerId
      ? 'Giá riêng của khách, ưu tiên trước giá chung. Đơn đã chốt giữ nguyên giá.'
      : 'Áp dụng cho khách chưa có giá riêng. Đơn đã chốt giữ nguyên giá.',
    fields: [
      {
        name: 'amount',
        label: `Giá 1 ${packageLabel(unit)} (đ)`,
        numeric: true,
        required: true,
        value: rate ? String(rate.amount) : '',
      },
      {
        name: 'pieces',
        label: `Số cái trong 1 ${packageLabel(unit)}`,
        numeric: true,
        required: true,
        value: rate ? String(rate.pieces_per_package) : '10',
        hint: 'Dùng để phân bổ bánh và tính giá vốn.',
      },
    ],
    submit: async (v, key) => {
      const amount = decimal(v.amount || '', 'Giá'),
        pieces = decimal(v.pieces || '', 'Số cái');
      if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(pieces) || pieces > 1000)
        throw Error('Nhập giá đồng nguyên và số cái nguyên từ 1 đến 1.000.');
      await submitMutation(
        'set_pos_package_price',
        { customer_id: customerId || null, package_unit: unit, amount, pieces_per_package: pieces },
        key,
      );
    },
  });
}
