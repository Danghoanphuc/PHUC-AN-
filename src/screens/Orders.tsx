import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
  labels,
} from '../lib/format';
import { submitMutation } from '../lib/mutations';
import { supabase, type Row } from '../lib/supabase';
import { d, DetailDisclosure } from '../components/OrderDetailLayout';
import { CustomerContact } from '../components/CustomerContact';
import { packageLabel } from '../lib/packagePrices';
import { searchText } from '../lib/pos';

export function Orders() {
  const a = useApp(),
    [kind, setKind] = useState('customer'),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const isPurchase = kind === 'purchase';
  const orders = isPurchase ? a.data.purchases : a.data.orders;
  const entries = orders.map((o) => ({
    id: o.id,
    detailKind: (isPurchase ? 'purchase' : 'order') as 'purchase' | 'order' | 'sale',
    status: o.status as string,
    name:
      'customer_id' in o
        ? a.data.customers.find((c) => c.id === o.customer_id)?.name
        : a.data.suppliers.find((c) => c.id === o.supplier_id)?.name,
    date: 'delivery_date' in o ? o.delivery_date : o.expected_date,
    createdAt: o.created_at,
    pos: false,
    waiting: false,
    description: '',
    total: null as number | null,
    collected: null as number | null,
    note: o.note || '',
  }));
  if (!isPurchase) {
    for (const order of a.data.packageSales) {
      const sale = a.data.sales.find((x) => x.id === order.id);
      if (!sale) continue;
      entries.push({
        id: sale.id,
        detailKind: 'sale',
        status: order.status === 'complete' ? 'completed' : 'pos_paid',
        name: a.data.customers.find((c) => c.id === order.customer_id)?.name,
        date: sale.sale_date,
        createdAt: sale.created_at,
        pos: true,
        waiting: order.status !== 'complete',
        description: a.data.packageLines
          .filter((l) => l.sale_id === sale.id)
          .map((l) => `${quantity(l.quantity)} ${packageLabel(l.package_unit)}`)
          .join(' · '),
        total: sale.net_amount,
        collected: sale.collected_amount,
        note: sale.note || '',
      });
    }
  }
  const filtered = entries
    .filter(
      (o) =>
        (filter === 'all' ||
          (filter === 'pos' ? o.pos : filter === 'waiting' ? o.waiting : o.status === filter)) &&
        searchText(`${o.id} ${o.name || ''} ${o.note}`).includes(searchText(search.trim())),
    )
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const filters = [
    { v: 'all', t: 'Tất cả' },
    ...(!isPurchase
      ? [
          { v: 'pos', t: 'Bán POS' },
          { v: 'waiting', t: 'Chờ điền bánh' },
        ]
      : []),
    { v: 'draft', t: 'Nháp' },
    { v: 'confirmed', t: 'Đã xác nhận' },
    { v: 'partial', t: 'Một phần' },
    { v: 'completed', t: 'Hoàn tất' },
  ];
  const quickFilters = filters.filter(
    (f) => ['all', 'pos', 'waiting'].includes(f.v) || f.v === filter,
  );
  return (
    <View style={orderListStyles.page}>
      <View style={s.between}>
        <View style={[s.row, { gap: 10 }]}>
          <Text style={s.h2}>Đơn hàng</Text>
          <Text style={orderListStyles.meta}>{filtered.length} đơn hàng</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tạo đơn mới"
          onPress={() => (isPurchase ? a.editPurchase() : a.editOrder())}
          style={orderListStyles.add}
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
            { value: 'customer', label: 'Đơn bán' },
            { value: 'purchase', label: 'Mua nguyên liệu' },
          ]}
        />
      )}
      <View style={[s.row, { gap: 8 }]}>
        <View style={orderListStyles.search}>
          <Icon name="search-outline" size={18} color={C.muted} />
          <TextInput
            accessibilityLabel={isPurchase ? 'Tìm mã đơn, nhà cung cấp…' : 'Tìm mã đơn, tên khách…'}
            placeholder={isPurchase ? 'Tìm mã đơn, nhà cung cấp…' : 'Tìm mã đơn, tên khách…'}
            value={search}
            onChangeText={setSearch}
            style={orderListStyles.searchInput}
          />
          {!!search && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xóa tìm đơn"
              onPress={() => setSearch('')}
              style={orderListStyles.tool}
            >
              <Icon name="close-circle" size={17} color={C.muted} />
            </Pressable>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lọc đơn hàng"
          accessibilityState={{ expanded: filterOpen }}
          onPress={() => setFilterOpen(true)}
          style={[orderListStyles.tool, { backgroundColor: filter !== 'all' ? C.soft : C.paper }]}
        >
          <Icon name="options-outline" size={20} />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: 6 }}
      >
        {quickFilters.map((f) => (
          <Pressable
            key={f.v}
            accessibilityRole="button"
            accessibilityLabel={f.t}
            accessibilityState={{ selected: filter === f.v }}
            onPress={() => setFilter(f.v)}
            style={[orderListStyles.filter, filter === f.v && { backgroundColor: C.green }]}
          >
            <Text style={[s.pillText, filter === f.v && { color: 'white' }]}>{f.t}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={orderListStyles.list}>
        {filtered.map((o, index) => (
          <Pressable
            key={o.id}
            testID="order-list-row"
            accessibilityRole="button"
            onPress={() => a.openDetail({ kind: o.detailKind, id: o.id })}
            style={({ pressed }) => [
              orderListStyles.row,
              index > 0 && { borderTopWidth: 1, borderTopColor: C.line },
              pressed && { backgroundColor: C.soft },
            ]}
          >
            <View style={s.between}>
              <Text numberOfLines={1} style={orderListStyles.name}>
                {o.name || 'Chưa có tên'}
              </Text>
              {o.pos ? (
                <Text style={orderListStyles.amount}>{money(o.total)}</Text>
              ) : (
                <Text
                  style={[
                    orderListStyles.status,
                    { color: o.status === 'completed' ? C.green : C.muted },
                  ]}
                >
                  {labels[o.status] || o.status}
                </Text>
              )}
            </View>
            {o.pos && (
              <View style={s.between}>
                <Text numberOfLines={1} style={[orderListStyles.meta, { flex: 1 }]}>
                  {o.description}
                </Text>
                <Text style={[orderListStyles.status, { color: o.waiting ? C.orange : C.green }]}>
                  {o.waiting ? 'Chờ điền loại bánh' : 'Đã điền đủ loại bánh'}
                </Text>
              </View>
            )}
            <View style={s.between}>
              <Text style={orderListStyles.meta}>
                {o.pos ? 'POS · ' : ''}#{shortId(o.id)} · {dateLabel(o.date)}
              </Text>
              <View style={[s.row, { gap: 5 }]}>
                {o.pos && (
                  <Text style={[orderListStyles.meta, { color: C.green }]}>
                    {o.collected === o.total ? 'Đã thu đủ' : `Đã thu ${money(o.collected)}`}
                  </Text>
                )}
                <Icon name="chevron-forward" size={14} color={C.muted} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>
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
      {filterOpen && (
        <Sheet title="Lọc đơn hàng" onClose={() => setFilterOpen(false)}>
          <ScrollView contentContainerStyle={{ padding: 14, gap: 6 }}>
            {filters.map((f) => (
              <Pressable
                key={f.v}
                accessibilityRole="button"
                accessibilityLabel={f.t}
                accessibilityState={{ selected: filter === f.v }}
                onPress={() => {
                  setFilter(f.v);
                  setFilterOpen(false);
                }}
                style={[
                  s.between,
                  {
                    minHeight: 48,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    backgroundColor: filter === f.v ? C.soft : C.paper,
                  },
                ]}
              >
                <Text style={s.text}>{f.t}</Text>
                {filter === f.v && <Icon name="checkmark" size={18} />}
              </Pressable>
            ))}
          </ScrollView>
        </Sheet>
      )}
    </View>
  );
}
const orderListStyles = StyleSheet.create({
  page: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 20, gap: 6 },
  add: {
    width: 40,
    minHeight: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.green,
  },
  search: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    fontSize: 13,
    color: C.ink,
    paddingVertical: 8,
    paddingRight: 8,
  },
  tool: {
    width: 40,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  filter: {
    minHeight: 36,
    paddingHorizontal: 11,
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: C.soft,
  },
  list: { backgroundColor: C.paper, borderRadius: 12, overflow: 'hidden' },
  row: { minHeight: 70, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  name: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, fontWeight: '600', color: C.ink },
  amount: { fontSize: 15, fontWeight: '700', color: C.green },
  meta: { fontSize: 11, lineHeight: 16, color: C.muted },
  status: { fontSize: 11, lineHeight: 17, fontWeight: '600' },
});
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
  const deliveries = a.data.sales.filter((x) => x.customer_order_id === id);
  return (
    <View style={d.page}>
      <View style={d.header}>
        <View style={s.between}>
          <Text style={d.title}>{customer?.name ?? 'Khách hàng'}</Text>
          <Tag value={o.status} />
        </View>
        <Text style={d.meta}>
          #{shortId(id)} · Giao {dateLabel(o.delivery_date)} ·{' '}
          {a.data.routes.find((r) => r.id === o.route_id)?.name ?? 'Chưa có tuyến'}
        </Text>
        <CustomerContact customer={customer} compact />
        {!!o.delivery_address_snapshot && <Text style={d.meta}>{o.delivery_address_snapshot}</Text>}
        {!!o.note && <Text style={d.meta}>Ghi chú: {o.note}</Text>}
      </View>
      <View style={d.summary}>
        <View style={s.between}>
          <Text style={d.name}>Giá trị dự kiến</Text>
          <Text style={d.total}>{money(total)}</Text>
        </View>
        {o.discount_pct > 0 && <Text style={d.meta}>Đã giảm {quantity(o.discount_pct)}%</Text>}
      </View>
      <Text style={d.section}>Sản phẩm · {items.length} dòng</Text>
      <View style={d.group}>
        {items.map((i, index) => (
          <View key={i.id} style={[d.row, index > 0 && d.divided]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={d.name}>
                {a.data.products.find((p) => p.id === i.product_id)?.name ?? i.requested_name}
              </Text>
              <Text style={d.meta}>
                {quantity(i.pieces_qty)} cái · Đã giao {quantity(i.delivered_pieces)} cái
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={d.amount}>{quantity(i.order_qty)} bì</Text>
              <Text style={d.meta}>
                {i.unit_price_snapshot === null
                  ? 'Chờ chọn sản phẩm'
                  : money(
                      ((i.pieces_qty ?? 0) / (i.pieces_per_price_unit ?? 1)) *
                        i.unit_price_snapshot *
                        (1 - o.discount_pct / 100),
                    )}
              </Text>
            </View>
          </View>
        ))}
      </View>
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
        <DetailDisclosure title="Thao tác khác">
          <Button title="Hủy phần chưa giao" secondary onPress={() => transition('cancelled')} />
        </DetailDisclosure>
      )}
      {deliveries.length > 0 && (
        <>
          <Text style={d.section}>Lịch sử giao · {deliveries.length} lần</Text>
          <View style={d.group}>
            {deliveries.map((x, index) => (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                onPress={() => a.openDetail({ kind: 'sale', id: x.id })}
                style={[d.row, index > 0 && d.divided]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={d.name}>Lần giao #{shortId(x.id)}</Text>
                  <Text style={d.meta}>{dateLabel(x.sale_date)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={d.amount}>{money(x.net_amount)}</Text>
                  <Tag value={x.payment_status} />
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}
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
