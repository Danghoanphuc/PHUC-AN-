import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, Empty, Tag, s } from '../components/ui';
import { useApp, managerRole } from '../lib/context';
import { dateLabel, decimal, money, quantity, shortId, today } from '../lib/format';
import { submitMutation } from '../lib/mutations';
import { CustomerContact } from '../components/CustomerContact';
import { PackageAllocation } from '../components/PackageAllocation';
import { d, DetailDisclosure } from '../components/OrderDetailLayout';
import { packageLabel } from '../lib/packagePrices';
export function SaleDetail({ id }: { id: string }) {
  const [allocation, setAllocation] = useState(false);
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
  const packageSale = a.data.packageSales.find((p) => p.id === id);
  const debt = (receivable?.amount ?? 0) - (receivable?.paid_amount ?? 0);
  return (
    <View style={d.page}>
      <View style={d.header}>
        <View style={s.between}>
          <Text style={d.title}>{customer?.name}</Text>
          <Tag value={sale.payment_status} />
        </View>
        <Text style={d.meta}>
          #{shortId(id)} · {dateLabel(sale.sale_date)}
        </Text>
        <CustomerContact customer={customer} compact />
        {!!sale.note && <Text style={d.meta}>Ghi chú: {sale.note}</Text>}
      </View>
      <View style={d.summary}>
        <View style={s.between}>
          <Text style={d.name}>Tổng tiền</Text>
          <Text style={d.total}>{money(sale.net_amount)}</Text>
        </View>
        <View style={s.between}>
          <Text style={d.meta}>Đã thu {money(sale.collected_amount)}</Text>
          <Text style={d.meta}>{debt > 0 ? 'Còn nợ ' + money(debt) : 'Đã thu đủ'}</Text>
        </View>
      </View>
      {manager && debt > 0 && (
        <Button title="Thu công nợ" icon="wallet-outline" onPress={collect} />
      )}
      {packageSale && (
        <View style={{ gap: 8 }}>
          <View style={d.group}>
            {a.data.packageLines
              .filter((l) => l.sale_id === id)
              .map((l, index) => (
                <View key={l.id} style={[d.row, index > 0 && d.divided]}>
                  <Text style={d.name}>
                    {quantity(l.quantity)} {packageLabel(l.package_unit)}
                  </Text>
                  <Text style={d.amount}>{money(l.quantity * l.unit_price)}</Text>
                </View>
              ))}
          </View>
          <Button
            title={packageSale.status === 'complete' ? 'Xem loại bánh đã điền' : 'Điền loại bánh'}
            secondary={packageSale.status === 'complete'}
            onPress={() => setAllocation(true)}
          />
        </View>
      )}
      {items.length > 0 && (
        <>
          <Text style={d.section}>Loại bánh · {items.length} món</Text>
          <View style={d.group}>
            {items.map((i, index) => (
              <View key={i.id} style={[d.row, index > 0 && d.divided]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={d.name}>
                    {a.data.products.find((p) => p.id === i.product_id)?.name}
                  </Text>
                  <Text style={d.meta}>
                    {quantity(i.qty * (i.pieces_per_price_unit_snapshot ?? 1))} cái
                    {i.qty_returned > 0
                      ? ' · đã trả ' +
                        quantity(i.qty_returned * (i.pieces_per_price_unit_snapshot ?? 1)) +
                        ' cái'
                      : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {!packageSale && (
                    <Text style={d.amount}>
                    {money(i.line_amount)}
                    </Text>
                  )}
                  {manager && i.qty > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Ghi trả dòng này"
                      style={d.link}
                      onPress={() => returnItem(i.id)}
                    >
                      <Text style={d.linkText}>Trả hàng</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        </>
      )}
      {allocation && <PackageAllocation saleId={id} onClose={() => setAllocation(false)} />}
      {manager && (
        <DetailDisclosure title="Giao dịch tiền">
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
        </DetailDisclosure>
      )}
    </View>
  );
}
