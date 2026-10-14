import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Button, Card, C, Empty, Icon, Select, Sheet, Tag, s } from '../components/ui';
import { useApp } from '../lib/context';
import {
  dateLabel,
  decimal,
  errorMessage,
  money,
  quantity,
  shortId,
  today,
  validDate,
} from '../lib/format';
import { submitMutation } from '../lib/mutations';
import type { Row } from '../lib/supabase';
export function PurchaseDetail({ id }: { id: string }) {
  const a = useApp(),
    po = a.data.purchases.find((x) => x.id === id);
  if (!po) return <Empty title="Không tìm thấy đơn mua" />;
  const items = a.data.purchaseItems.filter((x) => x.purchase_order_id === id);
  function transition(status: string) {
    a.openForm({
      title:
        status === 'submitted'
          ? 'Gửi duyệt đơn mua'
          : status === 'confirmed'
            ? 'Duyệt đơn mua'
            : 'Hủy phần chưa nhận',
      fields:
        status === 'cancelled'
          ? [{ name: 'reason', label: 'Lý do hủy', required: true, multiline: true }]
          : [],
      submitLabel: 'Xác nhận',
      submit: async (v, key) => {
        await submitMutation(
          'transition_purchase_order',
          { purchase_order_id: id, version: po!.version, status, reason: v.reason },
          key,
        );
      },
    });
  }
  function receive() {
    a.openForm({
      title: 'Nhận nguyên liệu',
      description:
        'Nhập theo đơn vị mua. Hệ số đã duyệt trong PO được dùng để tăng tồn theo đơn vị cơ sở.',
      fields: [
        ...items
          .filter((i) => i.received_qty < i.quantity)
          .map((i) => ({
            name: i.id,
            label: `${a.data.materials.find((m) => m.id === i.material_id)?.name} (${i.purchase_unit})`,
            value: String(i.quantity - i.received_qty),
            numeric: true,
          })),
        { name: 'date', label: 'Ngày nhận', value: today(), required: true },
        { name: 'due', label: 'Ngày đến hạn', value: today(), required: true },
        { name: 'invoice', label: 'Số hóa đơn (nếu có)' },
      ],
      submitLabel: 'Ghi nhận hàng & công nợ',
      submit: async (v, key) => {
        const lines = items
          .filter((i) => i.received_qty < i.quantity)
          .map((i) => ({
            purchase_order_item_id: i.id,
            quantity: decimal(v[i.id] ?? '0', 'Số nhận', true),
          }))
          .filter((i) => i.quantity > 0);
        if (!lines.length) throw Error('Cần nhận ít nhất một nguyên liệu.');
        await submitMutation(
          'receive_purchase_order',
          {
            purchase_order_id: id,
            version: po!.version,
            received_date: validDate(v.date ?? ''),
            due_date: validDate(v.due ?? ''),
            invoice_no: v.invoice,
            lines,
          },
          key,
        );
      },
    });
  }
  return (
    <View style={s.page}>
      <View style={s.between}>
        <Text style={s.label}>ĐƠN MUA #{shortId(id)}</Text>
        <Tag value={po.status} />
      </View>
      <Text style={s.title}>{a.data.suppliers.find((s) => s.id === po.supplier_id)?.name}</Text>
      <Text style={s.muted}>
        Dự kiến nhận {dateLabel(po.expected_date)} · Phiên bản {po.version}
      </Text>
      {items.map((i) => (
        <Card key={i.id}>
          <Text style={s.h3}>{a.data.materials.find((m) => m.id === i.material_id)?.name}</Text>
          <Text style={s.text}>
            {quantity(i.quantity)} {i.purchase_unit} · {money(i.unit_price)} / {i.purchase_unit}
          </Text>
          <Text style={s.muted}>
            1 {i.purchase_unit} = {quantity(i.base_qty_per_unit)}{' '}
            {a.data.materials.find((m) => m.id === i.material_id)?.base_unit} · đã nhận{' '}
            {quantity(i.received_qty)}
          </Text>
        </Card>
      ))}
      <Card>
        <View style={s.between}>
          <Text style={s.h3}>Giá trị đơn mua</Text>
          <Text style={s.h2}>
            {money(items.reduce((v, i) => v + i.quantity * i.unit_price, 0))}
          </Text>
        </View>
      </Card>
      {po.note && <Text style={s.text}>{po.note}</Text>}
      {po.status === 'draft' && (
        <>
          <Button title="Sửa đơn mua" secondary onPress={() => a.editPurchase(po)} />
          <Button title="Gửi duyệt" onPress={() => transition('submitted')} />
        </>
      )}
      {po.status === 'submitted' && (
        <Button title="Duyệt đơn mua" onPress={() => transition('confirmed')} />
      )}{' '}
      {['confirmed', 'partial'].includes(po.status) && (
        <Button title="Nhận nguyên liệu" onPress={receive} icon="cube-outline" />
      )}
      {!['completed', 'cancelled'].includes(po.status) && (
        <Button title="Hủy phần chưa nhận" secondary onPress={() => transition('cancelled')} />
      )}
    </View>
  );
}
type Line = {
  material_id: string;
  purchase_unit: string;
  quantity: string;
  base_qty_per_unit: string;
  unit_price: string;
};
export function PurchaseEditor({
  order,
  onClose,
  onSuccess,
}: {
  order?: Row<'purchase_orders'>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const a = useApp(),
    [supplier, setSupplier] = useState(order?.supplier_id ?? a.data.suppliers[0]?.id ?? ''),
    [date, setDate] = useState(order?.expected_date ?? today()),
    [note, setNote] = useState(order?.note ?? ''),
    [lines, setLines] = useState<Line[]>(() =>
      order
        ? a.data.purchaseItems
            .filter((i) => i.purchase_order_id === order.id)
            .map((i) => ({
              material_id: i.material_id,
              purchase_unit: i.purchase_unit,
              quantity: String(i.quantity),
              base_qty_per_unit: String(i.base_qty_per_unit),
              unit_price: String(i.unit_price),
            }))
        : [],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const key = useRef(Crypto.randomUUID());
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (!supplier) throw Error('Cần tạo/chọn nhà cung cấp trước.');
      if (!lines.length) throw Error('Thêm ít nhất một nguyên liệu.');
      await submitMutation(
        'save_purchase_order',
        {
          supplier_id: supplier,
          expected_date: validDate(date),
          note,
          ...(order ? { purchase_order_id: order.id, version: order.version } : {}),
          lines: lines.map((i) => ({
            material_id: i.material_id,
            purchase_unit: i.purchase_unit,
            quantity: decimal(i.quantity),
            base_qty_per_unit: decimal(i.base_qty_per_unit, 'Lượng cơ sở'),
            unit_price: decimal(i.unit_price, 'Giá mua', true),
          })),
        },
        key.current,
      );
      onSuccess();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function update(index: number, name: keyof Line, value: string) {
    setLines(lines.map((l, i) => (i === index ? { ...l, [name]: value } : l)));
  }
  return (
    <Sheet
      title={order ? 'Sửa đơn mua' : 'Tạo đơn mua nguyên liệu'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <Select
          label="Nhà cung cấp"
          value={supplier}
          onChange={setSupplier}
          options={a.data.suppliers.map((s) => ({ value: s.id, label: s.name }))}
        />
        {!a.data.suppliers.length && (
          <View style={s.banner}>
            <Text style={s.text}>
              Chưa có nhà cung cấp. Vào Thêm → Nhà cung cấp để bổ sung, sau đó tạo đơn mua.
            </Text>
          </View>
        )}
        <Text style={s.muted}>Ngày dự kiến nhận · YYYY-MM-DD</Text>
        <TextInput
          accessibilityLabel="Ngày dự kiến nhận"
          value={date}
          onChangeText={setDate}
          style={s.input}
        />
        {lines.map((l, index) => (
          <Card key={index}>
            <View style={s.between}>
              <Text style={s.h3}>Nguyên liệu {index + 1}</Text>
              <Pressable
                accessibilityLabel={`Xóa nguyên liệu ${index + 1}`}
                onPress={() => setLines(lines.filter((_, i) => i !== index))}
              >
                <Icon name="trash-outline" color={C.red} size={20} />
              </Pressable>
            </View>
            <Select
              label="Nguyên liệu"
              value={l.material_id}
              onChange={(v) => update(index, 'material_id', v)}
              options={a.data.materials
                .filter((m) => m.is_active)
                .map((m) => ({
                  value: m.id,
                  label: m.name,
                  detail: `Đơn vị cơ sở: ${m.base_unit}`,
                }))}
            />
            {[
              {
                key: 'purchase_unit' as const,
                label: 'Đơn vị mua (bao/thùng/kg...)',
                number: false,
              },
              { key: 'quantity' as const, label: 'Số lượng mua', number: true },
              {
                key: 'base_qty_per_unit' as const,
                label: `Lượng ${a.data.materials.find((m) => m.id === l.material_id)?.base_unit ?? 'cơ sở'} trong 1 đơn vị mua`,
                number: true,
              },
              { key: 'unit_price' as const, label: 'Giá cho 1 đơn vị mua (đ)', number: true },
            ].map((f) => (
              <View key={f.key} style={{ gap: 6 }}>
                <Text style={s.muted}>{f.label}</Text>
                <TextInput
                  accessibilityLabel={`${f.label} dòng ${index + 1}`}
                  value={l[f.key]}
                  onChangeText={(v) => update(index, f.key, v)}
                  keyboardType={f.number ? 'decimal-pad' : 'default'}
                  style={s.input}
                />
              </View>
            ))}
          </Card>
        ))}
        <Button
          title="Thêm nguyên liệu"
          secondary
          icon="add-outline"
          onPress={() =>
            setLines([
              ...lines,
              {
                material_id: a.data.materials.find((m) => m.is_active)?.id ?? '',
                purchase_unit: 'kg',
                quantity: '1',
                base_qty_per_unit: '1',
                unit_price: '',
              },
            ])
          }
        />
        <TextInput
          accessibilityLabel="Ghi chú mua"
          value={note}
          onChangeText={setNote}
          placeholder="Ghi chú đơn mua…"
          style={s.input}
        />
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: C.red }}>
            {error}
          </Text>
        )}
        {busy ? (
          <ActivityIndicator color={C.green} />
        ) : (
          <Button title="Lưu đơn mua nháp" onPress={() => void save()} />
        )}
      </ScrollView>
    </Sheet>
  );
}
