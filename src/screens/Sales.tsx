import React from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Empty, Tag, s } from '../components/ui';
import { useApp, managerRole } from '../lib/context';
import { dateLabel, decimal, money, quantity, shortId, today } from '../lib/format';
import { submitMutation } from '../lib/mutations';
export function SaleDetail({ id }: { id: string }) {
  const a = useApp(),
    sale = a.data.sales.find((s) => s.id === id);
  if (!sale) return <Empty title="Không tìm thấy chứng từ bán" />;
  const receivable = a.data.receivables.find((r) => r.sale_id === id),
    items = a.data.saleItems.filter((i) => i.sale_id === id),
    customer = a.data.customers.find((c) => c.id === sale.customer_id);
  const manager = managerRole(a.role);
  const accountField = {
    name: 'account',
    label: 'Tài khoản thu / hoàn',
    value: a.data.accounts[0]?.id,
    options: a.data.accounts
      .filter((x) => x.is_active)
      .map((x) => ({ value: x.id, label: x.name })),
  };
  function collect() {
    a.openForm({
      title: 'Thu công nợ khách',
      fields: [
        {
          name: 'amount',
          label: 'Số tiền thu (đ)',
          value: String((receivable?.amount ?? 0) - (receivable?.paid_amount ?? 0)),
          numeric: true,
          required: true,
        },
        accountField,
      ],
      submitLabel: 'Ghi nhận thu tiền',
      submit: async (v, key) => {
        await submitMutation(
          'collect_receivable',
          {
            receivable_id: receivable?.id,
            account_id: v.account,
            amount: decimal(v.amount ?? '', 'Tiền thu'),
            txn_date: today(),
          },
          key,
        );
      },
    });
  }
  function returnItem(itemId: string) {
    a.openForm({
      title: 'Ghi trả hàng sau bán',
      description:
        'Số cái trả không vượt lượng còn bán. Nếu cần hoàn tiền, chọn tài khoản thực hoàn.',
      fields: [
        { name: 'qty', label: 'Số cái trả', numeric: true, required: true },
        { name: 'reason', label: 'Lý do trả', required: true, multiline: true },
        accountField,
      ],
      submitLabel: 'Ghi trả & điều chỉnh nợ',
      submit: async (v, key) => {
        await submitMutation(
          'return_sale_item',
          {
            sale_item_id: itemId,
            returned_pieces: decimal(v.qty ?? ''),
            reason: v.reason,
            account_id: v.account || null,
            return_date: today(),
          },
          key,
        );
      },
    });
  }
  return (
    <View style={s.page}>
      <View style={s.between}>
        <Text style={s.label}>LẦN GIAO #{shortId(id)}</Text>
        <Tag value={sale.payment_status} />
      </View>
      <Text style={s.title}>{customer?.name}</Text>
      <Text style={s.muted}>Ngày bán {dateLabel(sale.sale_date)}</Text>
      <Card>
        <View style={s.between}>
          <Text style={s.text}>Giá trị bán hiện tại</Text>
          <Text style={s.h2}>{money(sale.net_amount)}</Text>
        </View>
        <View style={s.between}>
          <Text style={s.text}>Thực thu net</Text>
          <Text style={s.h3}>{money(sale.collected_amount)}</Text>
        </View>
        <View style={s.divider} />
        <View style={s.between}>
          <Text style={s.h3}>Còn phải thu</Text>
          <Text style={s.h2}>
            {money((receivable?.amount ?? 0) - (receivable?.paid_amount ?? 0))}
          </Text>
        </View>
      </Card>
      {manager && receivable && receivable.amount > receivable.paid_amount && (
        <Button title="Thu công nợ" icon="wallet-outline" onPress={collect} />
      )}
      <Text style={s.h2}>Dòng hàng đã ghi</Text>
      {items.map((i) => (
        <Card key={i.id}>
          <Text style={s.h3}>{a.data.products.find((p) => p.id === i.product_id)?.name}</Text>
          <Text style={s.muted}>
            Còn bán {quantity(i.qty * (i.pieces_per_price_unit_snapshot ?? 1))} cái · đã trả{' '}
            {quantity(i.qty_returned * (i.pieces_per_price_unit_snapshot ?? 1))} cái
          </Text>
          <Text style={s.text}>
            {money(i.unit_price)} / {i.price_unit_snapshot} · giảm {quantity(i.discount_pct)}%
          </Text>
          {manager && i.qty > 0 && (
            <Button title="Ghi trả dòng này" secondary onPress={() => returnItem(i.id)} />
          )}
        </Card>
      ))}
      {manager && (
        <>
          <Text style={s.h2}>Giao dịch tiền</Text>
          {a.data.cash
            .filter((m) => m.sale_id === id)
            .map((m) => (
              <Card key={m.id}>
                <View style={s.between}>
                  <Text style={s.h3}>{m.direction === 'in' ? 'Thu' : 'Chi / hoàn'}</Text>
                  <Text style={s.h3}>{money(m.amount)}</Text>
                </View>
                <Text style={s.muted}>
                  {m.txn_date} · {a.data.accounts.find((x) => x.id === m.account_id)?.name}
                </Text>
                {!m.reverses_id &&
                  ['sale_collection', 'debt_collection'].includes(m.kind) &&
                  !a.data.cash.some((x) => x.reverses_id === m.id) && (
                    <Button
                      title="Đảo giao dịch ghi sai"
                      secondary
                      onPress={() =>
                        a.openForm({
                          title: 'Đảo giao dịch tiền',
                          description:
                            'Giữ nguyên dòng cũ và ghi dòng đảo; số dư công nợ được cập nhật cùng lúc.',
                          fields: [
                            { name: 'reason', label: 'Lý do đảo', required: true, multiline: true },
                          ],
                          submit: async (v, key) => {
                            await submitMutation(
                              'reverse_cash_movement',
                              { movement_id: m.id, reason: v.reason },
                              key,
                            );
                          },
                        })
                      }
                    />
                  )}
              </Card>
            ))}
        </>
      )}
    </View>
  );
}
