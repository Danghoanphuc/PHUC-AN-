import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import {
  Button,
  Card,
  C,
  Empty,
  Icon,
  Search,
  Segment,
  Select,
  Sheet,
  Tag,
  s,
} from '../components/ui';
import { useApp, managerRole } from '../lib/context';
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
import { supabase, type Row } from '../lib/supabase';
import { CustomerContact } from '../components/CustomerContact';

export function Orders() {
  const a = useApp(),
    [kind, setKind] = useState('customer'),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all');
  const isPurchase = kind === 'purchase';
  const orders = isPurchase ? a.data.purchases : a.data.orders;
  const filtered = orders
    .filter(
      (o) =>
        (filter === 'all' || o.status === filter) &&
        `${o.id} ${'customer_id' in o ? a.data.customers.find((c) => c.id === o.customer_id)?.name : a.data.suppliers.find((c) => c.id === o.supplier_id)?.name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((x, y) => y.created_at.localeCompare(x.created_at));
  return (
    <View style={s.page}>
      <View style={s.between}>
        <View>
          <Text style={s.label}>TỪ ĐẶT HÀNG ĐẾN GIAO HÀNG</Text>
          <Text style={s.title}>Đơn hàng</Text>
        </View>
        <Pressable
          accessibilityLabel="Tạo đơn mới"
          onPress={() => (isPurchase ? a.editPurchase() : a.editOrder())}
          style={[s.avatar, { backgroundColor: C.green }]}
        >
          <Icon name="add-outline" color="white" size={24} />
        </Pressable>
      </View>
      {managerRole(a.role) && (
        <Segment
          selected={kind}
          onSelect={(v) => {
            setKind(v);
            setFilter('all');
          }}
          values={[
            { value: 'customer', label: 'Khách đặt' },
            { value: 'purchase', label: 'Mua nguyên liệu' },
          ]}
        />
      )}
      <Search
        value={search}
        onChange={setSearch}
        placeholder={isPurchase ? 'Tìm mã đơn, nhà cung cấp…' : 'Tìm mã đơn, tên khách…'}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {[
          { v: 'all', t: 'Tất cả' },
          { v: 'draft', t: 'Nháp' },
          { v: 'confirmed', t: 'Đã xác nhận' },
          { v: 'partial', t: 'Một phần' },
          { v: 'completed', t: 'Hoàn tất' },
        ].map((f) => (
          <Pressable
            key={f.v}
            accessibilityRole="button"
            onPress={() => setFilter(f.v)}
            style={[s.pill, filter === f.v && { backgroundColor: C.green }]}
          >
            <Text style={[s.pillText, filter === f.v && { color: 'white' }]}>{f.t}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={s.muted}>{filtered.length} đơn hàng</Text>
      {filtered.map((o) => (
        <Card
          key={o.id}
          onPress={() => a.openDetail({ kind: isPurchase ? 'purchase' : 'order', id: o.id })}
        >
          <View style={s.between}>
            <Text style={s.label}>#{shortId(o.id)}</Text>
            <Tag value={o.status} />
          </View>
          <Text style={s.h2}>
            {'customer_id' in o
              ? a.data.customers.find((c) => c.id === o.customer_id)?.name
              : a.data.suppliers.find((c) => c.id === o.supplier_id)?.name}
          </Text>
          <View style={s.between}>
            <Text style={s.muted}>
              {isPurchase ? 'Dự kiến nhận' : 'Ngày giao'} ·{' '}
              {dateLabel('delivery_date' in o ? o.delivery_date : o.expected_date)}
            </Text>
            <Icon name="arrow-forward-outline" size={19} />
          </View>
        </Card>
      ))}
      {!filtered.length && (
        <Card>
          <Empty
            title={search || filter !== 'all' ? 'Không có đơn phù hợp' : 'Chưa có đơn hàng'}
            body="Tạo đơn đầu tiên để theo dõi yêu cầu, giao nhận và thanh toán."
          />
          <Button
            title={isPurchase ? 'Tạo đơn mua' : 'Tạo đơn khách'}
            onPress={() => (isPurchase ? a.editPurchase() : a.editOrder())}
          />
        </Card>
      )}
    </View>
  );
}
export function OrderDetail({ id }: { id: string }) {
  const a = useApp();
  const o = a.data.orders.find((o) => o.id === id);
  if (!o) return <Empty title="Đơn không còn trong phạm vi truy cập" />;
  const items = a.data.orderItems.filter((i) => i.order_id === id),
    customer = a.data.customers.find((c) => c.id === o.customer_id),
    canManage = managerRole(a.role);
  const total = items.every((i) => i.unit_price_snapshot !== null)
    ? items.reduce(
        (v, i) =>
          v +
          ((i.pieces_qty ?? 0) / (i.pieces_per_price_unit ?? 1)) *
            (i.unit_price_snapshot ?? 0) *
            (1 - o.discount_pct / 100),
        0,
      )
    : null;
  const transition = (status: string) =>
    a.openForm({
      title: status === 'confirmed' ? 'Xác nhận đơn khách' : 'Hủy phần chưa giao',
      description:
        status === 'confirmed'
          ? 'Giá và đơn vị đã lưu trong đơn được dùng cho các lần giao.'
          : 'Các giao dịch đã ghi trước đó được giữ nguyên.',
      fields:
        status === 'cancelled'
          ? [{ name: 'reason', label: 'Lý do hủy', required: true, multiline: true }]
          : [],
      submitLabel: status === 'confirmed' ? 'Xác nhận đơn' : 'Hủy đơn',
      submit: async (v, key) => {
        await submitMutation(
          'transition_customer_order',
          {
            order_id: id,
            version: o.version,
            status,
            ...(status === 'cancelled' ? { reason: v.reason } : {}),
          },
          key,
        );
      },
    });
  const deliver = () =>
    a.openForm({
      title: 'Ghi giao hàng',
      description:
        'Nhập số cái thực giao và trả ngay trong lần này. Thu tiền và công nợ được ghi cùng giao dịch.',
      fields: [
        ...items
          .filter((i) => i.delivered_pieces < (i.pieces_qty ?? 0))
          .flatMap((i) => [
            {
              name: `d_${i.id}`,
              label: `${a.data.products.find((p) => p.id === i.product_id)?.name ?? i.requested_name} · giao (cái)`,
              value: String((i.pieces_qty ?? 0) - i.delivered_pieces),
              numeric: true,
              required: true,
            },
            { name: `r_${i.id}`, label: 'Trả cùng lần giao (cái)', value: '0', numeric: true },
          ]),
        { name: 'collected', label: 'Tiền đã thu (đ)', value: '0', numeric: true },
        {
          name: 'account',
          label: 'Tài khoản thu',
          value: a.data.accounts[0]?.id,
          options: a.data.accounts
            .filter((x) => x.is_active)
            .map((x) => ({ value: x.id, label: x.name })),
        },
        {
          name: 'credit',
          label: 'Lý do duyệt công nợ',
          hint: 'Cần nhập nếu khách chưa có chính sách công nợ',
          multiline: true,
        },
      ],
      submitLabel: 'Ghi giao & thanh toán',
      submit: async (v, key) => {
        const lines = items
          .filter((i) => i.delivered_pieces < (i.pieces_qty ?? 0))
          .map((i) => ({
            order_item_id: i.id,
            delivered_pieces: decimal(v[`d_${i.id}`] ?? '0', 'Số giao', true),
            returned_pieces: decimal(v[`r_${i.id}`] ?? '0', 'Số trả', true),
          }))
          .filter((i) => i.delivered_pieces > 0);
        if (!lines.length) throw Error('Nhập ít nhất một số lượng giao lớn hơn 0.');
        await submitMutation(
          'post_delivery',
          {
            order_id: id,
            version: o.version,
            lines,
            sale_date: today(),
            collected_amount: decimal(v.collected ?? '0', 'Tiền thu', true),
            account_id: v.account || null,
            credit_approval_reason: v.credit || null,
          },
          key,
        );
      },
    });
  return (
    <View style={s.page}>
      <View style={s.between}>
        <Text style={s.label}>
          ĐƠN #{shortId(id)} · V{o.version}
        </Text>
        <Tag value={o.status} />
      </View>
      <Text style={s.title}>{customer?.name ?? 'Khách hàng'}</Text>
      <CustomerContact customer={customer} />
      <Card>
        <Text style={s.muted}>
          Giao {dateLabel(o.delivery_date)} ·{' '}
          {a.data.routes.find((r) => r.id === o.route_id)?.name ?? 'Chưa có tuyến'}
        </Text>
        <Text style={s.text}>{o.delivery_address_snapshot || 'Chưa cập nhật địa chỉ giao'}</Text>
        {o.note && <Text style={s.muted}>{o.note}</Text>}
      </Card>
      <Text style={s.h2}>Sản phẩm · {items.length} dòng</Text>
      {items.map((i) => (
        <Card key={i.id}>
          <Text style={s.h3}>
            {a.data.products.find((p) => p.id === i.product_id)?.name ?? i.requested_name}
          </Text>
          <Text style={s.muted}>
            {quantity(i.order_qty)} bì đặt = {quantity(i.pieces_qty)} cái
          </Text>
          <View style={s.between}>
            <Text style={s.text}>
              {i.unit_price_snapshot === null
                ? 'Chờ chọn sản phẩm'
                : `${money(i.unit_price_snapshot)} / ${i.price_unit}`}
            </Text>
            <Text style={s.muted}>Đã giao {quantity(i.delivered_pieces)} cái</Text>
          </View>
        </Card>
      ))}
      <Card>
        <View style={s.between}>
          <Text style={s.text}>Chiết khấu</Text>
          <Text style={s.h3}>{quantity(o.discount_pct)}%</Text>
        </View>
        <View style={s.between}>
          <Text style={s.h3}>Giá trị dự kiến</Text>
          <Text style={s.h2}>{money(total)}</Text>
        </View>
      </Card>
      {o.status === 'draft' && (canManage || o.created_by === a.userId) && (
        <Button title="Sửa đơn nháp" secondary onPress={() => a.editOrder(o)} />
      )}
      {canManage && o.status === 'draft' && (
        <Button title="Xác nhận đơn" onPress={() => transition('confirmed')} />
      )}
      {canManage && ['confirmed', 'partial'].includes(o.status) && (
        <Button title="Ghi giao hàng" icon="bicycle-outline" onPress={deliver} />
      )}
      {canManage && ['draft', 'confirmed', 'partial'].includes(o.status) && (
        <Button title="Hủy phần chưa giao" secondary onPress={() => transition('cancelled')} />
      )}
      {a.data.sales
        .filter((x) => x.customer_order_id === id)
        .map((x) => (
          <Card key={x.id} onPress={() => a.openDetail({ kind: 'sale', id: x.id })}>
            <View style={s.between}>
              <Text style={s.h3}>Lần giao #{shortId(x.id)}</Text>
              <Tag value={x.payment_status} />
            </View>
            <Text style={s.muted}>
              {dateLabel(x.sale_date)} · {money(x.net_amount)}
            </Text>
          </Card>
        ))}
    </View>
  );
}
type DraftLine = {
  product_id?: string;
  requested_name?: string;
  order_qty: string;
  allocations?: { product_id: string; order_qty: number }[];
};
export function OrderEditor({
  order,
  customerId,
  onClose,
  onSuccess,
}: {
  order?: Row<'customer_orders'>;
  customerId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const a = useApp(),
    [customer, setCustomer] = useState(
      order?.customer_id ?? customerId ?? a.data.customers.find((c) => c.is_active)?.id ?? '',
    ),
    [date, setDate] = useState(order?.delivery_date ?? today()),
    [note, setNote] = useState(order?.note ?? ''),
    [lines, setLines] = useState<DraftLine[]>(() =>
      order
        ? a.data.requests
            .filter((r) => r.order_id === order.id)
            .map((r) => ({
              ...(r.original_request as unknown as DraftLine),
              order_qty: String(r.order_qty),
            }))
        : [],
    ),
    [search, setSearch] = useState(''),
    [alias, setAlias] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [group, setGroup] = useState<{ name: string; skus: string[] } | null>(null);
  const key = useRef(Crypto.randomUUID());
  const c = a.data.customers.find((c) => c.id === customer),
    tier = c?.customer_type === 'Khách lẻ' ? 'retail' : 'wholesale';
  function price(id: string) {
    return a.data.prices
      .filter(
        (p) =>
          p.product_id === id &&
          p.price_tier === tier &&
          (p.customer_id === customer || p.customer_id === null) &&
          p.effective_from <= date &&
          (!p.effective_to || p.effective_to >= date),
      )
      .sort(
        (p, q) =>
          Number(q.customer_id === customer) - Number(p.customer_id === customer) ||
          q.effective_from.localeCompare(p.effective_from),
      )[0];
  }
  function add(id: string) {
    const index = lines.findIndex((l) => l.product_id === id && !l.allocations);
    if (index < 0) setLines([...lines, { product_id: id, order_qty: '1' }]);
    else
      setLines(
        lines.map((l, i) =>
          i === index ? { ...l, order_qty: String((Number(l.order_qty) || 0) + 1) } : l,
        ),
      );
  }
  async function resolve() {
    if (!alias.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { data, error } = await supabase.rpc('resolve_order_alias', {
        customer_id: customer,
        alias: alias.trim(),
      });
      if (error) throw error;
      const resolved = data as { status: string; product_id?: string; member_skus?: string[] };
      if (resolved.status === 'resolved' && resolved.product_id)
        setLines([
          ...lines,
          { product_id: resolved.product_id, requested_name: alias.trim(), order_qty: '1' },
        ]);
      else if (resolved.status === 'allocation_required')
        setGroup({ name: alias.trim(), skus: resolved.member_skus ?? [] });
      else setLines([...lines, { requested_name: alias.trim(), order_qty: '1' }]);
      setAlias('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (!customer) throw Error('Chọn khách hàng.');
      if (!lines.length) throw Error('Thêm ít nhất một sản phẩm.');
      const payload = {
        customer_id: customer,
        delivery_date: validDate(date),
        note,
        lines: lines.map((l) => ({ ...l, order_qty: decimal(l.order_qty) })),
        ...(order ? { order_id: order.id, version: order.version } : {}),
      };
      await submitMutation('save_customer_order', payload, key.current);
      onSuccess();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={order ? 'Sửa đơn nháp' : 'Tạo đơn khách'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <Select
          label="Khách hàng"
          value={customer}
          disabled={!!order || busy}
          onChange={setCustomer}
          options={a.data.customers
            .filter((c) => c.is_active)
            .map((c) => ({
              value: c.id,
              label: c.name,
              detail: a.data.routes.find((r) => r.id === c.route_id)?.name,
            }))}
        />
        <View style={s.row}>
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={s.muted}>Ngày giao · YYYY-MM-DD</Text>
            <TextInput
              accessibilityLabel="Ngày giao"
              editable={!busy}
              value={date}
              onChangeText={setDate}
              style={s.input}
            />
          </View>
          <View style={[s.pill, { marginTop: 25 }]}>
            <Text style={s.pillText}>1 bì = 10 cái</Text>
          </View>
        </View>
        <Text style={s.h2}>Sản phẩm trong đơn</Text>
        {!lines.length && <Text style={s.muted}>Chọn sản phẩm bên dưới để bắt đầu.</Text>}
        {lines.map((l, index) => {
          const p = a.data.products.find((p) => p.id === l.product_id),
            rate = l.product_id ? price(l.product_id) : undefined;
          return (
            <Card key={index}>
              <View style={s.between}>
                <View style={{ flex: 1 }}>
                  <Text style={s.h3}>{p?.name ?? l.requested_name}</Text>
                  <Text style={s.muted}>
                    {l.allocations
                      ? `${l.allocations.length} loại đã phân bổ`
                      : rate
                        ? `${money(rate.amount)} / ${rate.price_unit}`
                        : 'Chờ phân bổ hoặc chưa có giá'}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={`Xóa dòng ${index + 1}`}
                  disabled={busy}
                  onPress={() => setLines(lines.filter((_, i) => i !== index))}
                >
                  <Icon name="trash-outline" size={19} color={C.red} />
                </Pressable>
              </View>
              <View style={s.row}>
                <Text style={s.text}>Số bì đặt</Text>
                <TextInput
                  accessibilityLabel={`Số bì dòng ${index + 1}`}
                  editable={!busy && !l.allocations}
                  value={l.order_qty}
                  onChangeText={(v) =>
                    setLines(lines.map((x, i) => (i === index ? { ...x, order_qty: v } : x)))
                  }
                  keyboardType="decimal-pad"
                  style={[s.input, { flex: 1 }]}
                />
                <Text style={s.muted}>{quantity((Number(l.order_qty) || 0) * 10)} cái</Text>
              </View>
              {rate && (
                <Text style={[s.text, { fontWeight: '600' }]}>
                  Ước tính{' '}
                  {money(
                    (((Number(l.order_qty) || 0) * 10) / rate.pieces_per_price_unit) *
                      rate.amount *
                      (1 - (c?.default_discount_pct ?? 0) / 100),
                  )}
                </Text>
              )}
            </Card>
          );
        })}
        <View style={[s.banner, { gap: 10 }]}>
          <Text style={s.h3}>Khách dùng tên gọi khác?</Text>
          <TextInput
            accessibilityLabel="Tên khách gọi"
            value={alias}
            onChangeText={setAlias}
            placeholder="Ví dụ: bao nhỏ, bông lan lớn…"
            style={s.input}
          />
          <Button
            title="Tra tên & thêm dòng"
            secondary
            disabled={!customer || busy}
            onPress={() => void resolve()}
          />
        </View>
        <Search value={search} onChange={setSearch} placeholder="Tìm sản phẩm, mã SKU…" />
        {a.data.products
          .filter(
            (p) => p.is_active && `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()),
          )
          .map((p) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Thêm ${p.name}`}
              key={p.id}
              disabled={busy}
              onPress={() => add(p.id)}
              style={[s.card, s.between, { padding: 14 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.h3}>{p.name}</Text>
                <Text style={s.muted}>
                  {money(price(p.id)?.amount)} / {p.sale_unit}
                </Text>
              </View>
              <Icon name="add-circle-outline" size={23} />
            </Pressable>
          ))}
        <TextInput
          accessibilityLabel="Ghi chú đơn"
          editable={!busy}
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Ghi chú giao hàng…"
          style={[s.input, { minHeight: 80 }]}
        />
        {!!error && (
          <Text accessibilityRole="alert" style={[s.text, { color: C.red }]}>
            {error}
          </Text>
        )}
        {busy ? (
          <ActivityIndicator color={C.green} />
        ) : (
          <Button title="Lưu đơn nháp" onPress={() => void save()} icon="checkmark-outline" />
        )}
      </ScrollView>
      {group && (
        <GroupAllocation
          name={group.name}
          skus={group.skus}
          onClose={() => setGroup(null)}
          onSave={(allocations) => {
            setLines([
              ...lines,
              {
                requested_name: group.name,
                order_qty: String(allocations.reduce((sum, l) => sum + l.order_qty, 0)),
                allocations,
              },
            ]);
            setGroup(null);
          }}
        />
      )}
    </Sheet>
  );
}
function GroupAllocation({
  name,
  skus,
  onClose,
  onSave,
}: {
  name: string;
  skus: string[];
  onClose: () => void;
  onSave: (v: { product_id: string; order_qty: number }[]) => void;
}) {
  const a = useApp(),
    [counts, setCounts] = useState<Record<string, string>>({}),
    [error, setError] = useState('');
  const products = a.data.products.filter((p) => skus.includes(p.sku) && p.is_active);
  return (
    <Sheet title={`Phân bổ ${name}`} onClose={onClose}>
      <ScrollView contentContainerStyle={s.page}>
        <Text style={s.muted}>
          Nhập số bì cho từng loại khách yêu cầu. Tổng được lưu cùng yêu cầu gốc.
        </Text>
        {products.map((p) => (
          <View key={p.id} style={{ gap: 7 }}>
            <Text style={s.h3}>{p.name}</Text>
            <TextInput
              accessibilityLabel={`Số bì ${p.name}`}
              value={counts[p.id] ?? '0'}
              onChangeText={(v) => setCounts({ ...counts, [p.id]: v })}
              keyboardType="decimal-pad"
              style={s.input}
            />
          </View>
        ))}
        {!!error && <Text style={{ color: C.red }}>{error}</Text>}
        <Button
          title="Thêm nhóm đã phân bổ"
          onPress={() => {
            try {
              const values = products
                .map((p) => ({
                  product_id: p.id,
                  order_qty: decimal(counts[p.id] ?? '0', 'Số bì', true),
                }))
                .filter((p) => p.order_qty > 0);
              if (!values.length) throw Error('Chọn ít nhất một loại.');
              onSave(values);
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        />
      </ScrollView>
    </Sheet>
  );
}
