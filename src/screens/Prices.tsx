import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Icon, Search, Segment, Select, s } from '../components/ui';
import { useApp, managerRole } from '../lib/context';
import { decimal, money, today, validDate } from '../lib/format';
import { submitMutation } from '../lib/mutations';
export function Prices() {
  const a = useApp(),
    [search, setSearch] = useState(''),
    [tier, setTier] = useState('wholesale'),
    [customer, setCustomer] = useState('');
  const day = today();
  function price(id: string) {
    return a.data.prices
      .filter(
        (p) =>
          p.product_id === id &&
          p.price_tier === tier &&
          (p.customer_id === customer || p.customer_id === null) &&
          p.effective_from <= day &&
          (!p.effective_to || p.effective_to >= day),
      )
      .sort(
        (p, q) =>
          Number(q.customer_id === customer) - Number(p.customer_id === customer) ||
          q.effective_from.localeCompare(p.effective_from),
      )[0];
  }
  function edit(productId: string) {
    const next = new Date(`${day}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    a.openForm({
      title: 'Thêm giá mới',
      description: 'Giá có hiệu lực từ ngày đã chọn. Các đơn đã lưu giữ nguyên giá cũ.',
      fields: [
        { name: 'amount', label: 'Giá bán theo đơn vị giá (đ)', numeric: true, required: true },
        {
          name: 'date',
          label: 'Ngày hiệu lực · YYYY-MM-DD',
          value: next.toISOString().slice(0, 10),
          required: true,
        },
      ],
      submit: async (v, key) => {
        await submitMutation(
          'set_selling_price',
          {
            product_id: productId,
            customer_id: customer || null,
            price_tier: tier,
            amount: decimal(v.amount ?? '', 'Giá', true),
            effective_from: validDate(v.date ?? ''),
          },
          key,
        );
      },
    });
  }
  return (
    <View style={s.page}>
      <View>
        <Text style={s.label}>RÕ ĐƠN VỊ · ĐÚNG GIÁ</Text>
        <Text style={s.title}>Bảng giá</Text>
      </View>
      <Segment
        selected={tier}
        onSelect={setTier}
        values={[
          { value: 'wholesale', label: 'Giá sỉ' },
          { value: 'retail', label: 'Giá lẻ' },
        ]}
      />
      <Select
        label="Giá cho khách"
        value={customer}
        onChange={setCustomer}
        options={[
          { value: '', label: 'Bảng giá chung' },
          ...a.data.customers.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <Search value={search} onChange={setSearch} placeholder="Tìm sản phẩm, mã SKU…" />
      {a.data.products
        .filter(
          (p) => p.is_active && `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()),
        )
        .map((p) => {
          const rate = price(p.id);
          return (
            <Card key={p.id}>
              <View style={s.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.h3}>{p.name}</Text>
                  <Text style={s.muted}>{p.sku}</Text>
                </View>
                {managerRole(a.role) && (
                  <Pressable accessibilityLabel={`Thêm giá ${p.name}`} onPress={() => edit(p.id)}>
                    <Icon name="create-outline" />
                  </Pressable>
                )}
              </View>
              <View style={s.between}>
                <Text style={s.h2}>{money(rate?.amount)}</Text>
                <Text style={s.muted}>/ {rate?.price_unit ?? p.sale_unit}</Text>
              </View>
              <View style={s.divider} />
              <Text style={s.muted}>
                {rate
                  ? `1 đơn vị giá = ${rate.pieces_per_price_unit} cái · 1 bì đặt = 10 cái`
                  : 'Cần bổ sung giá đúng nhóm khách trước khi ghi đơn.'}
              </Text>
              {rate && (
                <Text style={s.muted}>
                  Hiệu lực từ {rate.effective_from}
                  {rate.customer_id ? ' · Giá riêng của khách' : ''}
                </Text>
              )}
            </Card>
          );
        })}
    </View>
  );
}
