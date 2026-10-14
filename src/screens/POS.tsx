import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { Button, C, Empty, Icon, Select, Sheet, s } from '../components/ui';
import { useApp } from '../lib/context';
import { errorMessage, money, quantity, shortId, today } from '../lib/format';
import { favoriteProducts, posLineTotal, posPrice, searchText } from '../lib/pos';
import { pendingMutation, submitMutation, type Pending } from '../lib/mutations';
import { readPosDraft, savePosDraft } from '../lib/posDraft';

export function POS() {
  const a = useApp();
  const [customerId, setCustomerId] = useState(''),
    [pieces, setPieces] = useState<Record<string, number>>({}),
    [typed, setTyped] = useState<Record<string, string>>({});
  const [note, setNote] = useState(''),
    [query, setQuery] = useState(''),
    [group, setGroup] = useState('favorite');
  const [picker, setPicker] = useState(false),
    [customerSearch, setCustomerSearch] = useState(''),
    [phone, setPhone] = useState(''),
    [routeId, setRouteId] = useState('');
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [pending, setPending] = useState<Pending | null>(null);
  const [orderId, setOrderId] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const key = useRef(Crypto.randomUUID()),
    createKey = useRef(Crypto.randomUUID()),
    posting = useRef(false);
  const customer = a.data.customers.find((c) => c.id === customerId && c.is_active),
    order = a.data.orders.find((o) => o.id === orderId);
  const products = a.data.products.filter((p) => p.is_active),
    units = new Map(a.data.units.map((u) => [u.product_id, u]));
  const locked = !draftReady || saving || a.busy || !!pending;
  const routes = a.data.routes.filter(
    (r) =>
      r.is_active &&
      (a.role !== 'staff' ||
        a.data.assignments.some((x) => x.user_id === a.userId && x.route_id === r.id)),
  );
  const favorites = useMemo(() => favoriteProducts(a.data, customerId), [a.data, customerId]);
  const categories = [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))];
  useEffect(() => {
    let live = true;
    void Promise.all([pendingMutation(a.userId), readPosDraft(a.userId)])
      .then(([p, draft]) => {
        if (!live) return;
        if (draft && !p) {
          setCustomerId(draft.customerId);
          setOrderId(draft.orderId);
          setPieces(draft.pieces);
          setTyped(draft.typed);
          setNote(draft.note);
          key.current = draft.key;
          setNotice('Đã khôi phục giỏ đang bán. Giá và quyền truy cập được kiểm tra lại.');
        }
        setPending(p);
        if (p?.name === 'post_pos_sale') {
          setCustomerId(String(p.payload.customer_id));
          setOrderId(String(p.payload.order_id || ''));
          setNote(String(p.payload.note || ''));
          setPieces(
            Object.fromEntries(
              (p.payload.lines as { product_id: string; order_qty: number }[]).map((l) => [
                l.product_id,
                l.order_qty * 10,
              ]),
            ),
          );
          key.current = p.key;
        }
        setDraftReady(true);
      })
      .catch(() => {
        if (live) {
          setError('Không đọc được giỏ đã lưu. Hãy mở lại màn hình.');
        }
      });
    return () => {
      live = false;
    };
  }, [a.userId]);
  useEffect(() => {
    if (!draftReady || pending || saving) return;
    void savePosDraft(
      a.userId,
      customerId || note || Object.keys(pieces).length
        ? { customerId, orderId, pieces, typed, note, key: key.current }
        : null,
    ).catch(() => setError('Không lưu được giỏ trên thiết bị. Giữ màn hình này cho đến khi chốt.'));
  }, [a.userId, draftReady, customerId, orderId, pieces, typed, note, pending, saving]);
  function quote(id: string) {
    if (!customer) return null;
    if (order) {
      const items = a.data.orderItems.filter(
        (i) =>
          i.order_id === order.id &&
          i.product_id === id &&
          (i.pieces_qty ?? 0) > i.delivered_pieces,
      );
      if (!items.length) return null;
      const first = items[0]!;
      if (first.unit_price_snapshot == null || first.pieces_per_price_unit == null) return null;
      if (
        items.some(
          (i) =>
            i.unit_price_snapshot !== first.unit_price_snapshot ||
            i.pieces_per_price_unit !== first.pieces_per_price_unit,
        )
      )
        return null;
      return {
        amount: first.unit_price_snapshot!,
        pricePieces: first.pieces_per_price_unit!,
        pack: 10,
        discount: order.discount_pct,
        remaining: items.reduce((n, i) => n + (i.pieces_qty ?? 0) - i.delivered_pieces, 0),
      };
    }
    const u = units.get(id),
      p = posPrice(a.data, customer, id);
    if (!u?.verified || !p) return null;
    return {
      amount: p.amount,
      pricePieces: p.pieces_per_price_unit,
      pack: u.pieces_per_order_unit,
      discount: customer.default_discount_pct,
      remaining: Infinity,
    };
  }
  const cart = products.filter((p) => (pieces[p.id] || 0) > 0);
  const total = cart.reduce((n, p) => {
    const q = quote(p.id);
    return n + (q ? posLineTotal(pieces[p.id]!, q.amount, q.pricePieces, q.discount) : 0);
  }, 0);
  const invalid = Object.entries(typed).some(([id, t]) => {
    const q = quote(id),
      v = Number(t.replace(',', '.'));
    return (
      !q || !Number.isFinite(v) || v < 0 || Math.abs(v * q.pack - Math.round(v * q.pack)) > 1e-7
    );
  });
  const draftUnavailable =
    (!!customerId && !customer) ||
    Object.entries(pieces).some(([id, qty]) => qty > 0 && !products.some((p) => p.id === id)) ||
    (!!orderId && (!order || !['confirmed', 'partial'].includes(order.status)));
  const valid =
    !!customer &&
    cart.length > 0 &&
    !draftUnavailable &&
    !invalid &&
    cart.every((p) => {
      const q = quote(p.id);
      return q && (pieces[p.id] || 0) <= q.remaining;
    }) &&
    total > 0;
  const visible = products
    .filter(
      (p) =>
        !order ||
        a.data.orderItems.some(
          (i) =>
            i.order_id === order.id &&
            i.product_id === p.id &&
            (i.pieces_qty ?? 0) > i.delivered_pieces,
        ),
    )
    .filter((p) => {
      if (query.trim()) {
        const aliases = a.data.aliases
          .filter(
            (r) => r.product_id === p.id && (r.scope === 'general' || r.customer_id === customerId),
          )
          .map((r) => r.alias)
          .join(' ');
        return searchText(`${p.name} ${p.sku} ${aliases}`).includes(searchText(query.trim()));
      }
      return group === 'all' || group === 'favorite' || p.category === group;
    })
    .sort((p, q) =>
      group === 'favorite' && !query.trim()
        ? (favorites.get(q.id) || 0) - (favorites.get(p.id) || 0) ||
          Number(!!quote(q.id)) - Number(!!quote(p.id)) ||
          p.name.localeCompare(q.name, 'vi')
        : p.name.localeCompare(q.name, 'vi'),
    );
  const menu =
    group === 'favorite' && !query.trim()
      ? visible.filter((p) => !favorites.size || favorites.has(p.id)).slice(0, 8)
      : visible;
  const orders = a.data.orders.filter(
    (o) => o.customer_id === customerId && ['confirmed', 'partial'].includes(o.status),
  );
  function change(id: string, delta: number) {
    if (locked) return;
    const q = quote(id);
    if (!q) return;
    setTyped((v) => {
      const next = { ...v };
      delete next[id];
      return next;
    });
    setPieces((v) => ({ ...v, [id]: Math.max(0, (v[id] || 0) + delta * q.pack) }));
    setError('');
    setNotice('');
  }
  function selectCustomer(id: string) {
    if (locked) return;
    if (orderId && id !== customerId) {
      setError('Đóng đơn đặt đang giao trước khi đổi khách.');
      return;
    }
    setCustomerId(id);
    setPicker(false);
    setQuery('');
    setGroup('favorite');
    setTyped({});
    setNotice(cart.length ? 'Giữ giỏ hàng, cập nhật giá theo khách.' : '');
    setError('');
  }
  function loadOrder(id: string) {
    const o = a.data.orders.find((o) => o.id === id);
    if (!o) return;
    const counts: Record<string, number> = {};
    for (const i of a.data.orderItems.filter((i) => i.order_id === id && i.product_id)) {
      counts[i.product_id!] =
        (counts[i.product_id!] || 0) + (i.pieces_qty ?? 0) - i.delivered_pieces;
    }
    setOrderId(id);
    setPieces(counts);
    setTyped({});
    setNote(o.note || '');
    setGroup('all');
    setQuery('');
    key.current = Crypto.randomUUID();
    setError('');
  }
  async function createCustomer() {
    if (posting.current || locked) return;
    const r = routeId || (routes.length === 1 ? routes[0]!.id : customer?.route_id || '');
    if (!r) {
      setError('Chọn tuyến được giao trước khi tạo khách.');
      return;
    }
    posting.current = true;
    setSaving(true);
    setError('');
    try {
      const id = await submitMutation(
        'create_pos_customer',
        { name: customerSearch.trim(), phone: phone.trim(), route_id: r },
        createKey.current,
      );
      await a.refresh();
      setCustomerId(id);
      setPicker(false);
      setPhone('');
      setCustomerSearch('');
      createKey.current = Crypto.randomUUID();
      setNotice('Đã tạo bạn hàng.');
    } catch (e) {
      setError(errorMessage(e));
      setPending(await pendingMutation(a.userId));
    } finally {
      posting.current = false;
      setSaving(false);
    }
  }
  async function checkout() {
    if (!draftReady || posting.current || saving || a.busy || (!pending && !valid)) return;
    posting.current = true;
    setSaving(true);
    setError('');
    try {
      if (pending && pending.name !== 'post_pos_sale') {
        const id = await submitMutation(pending.name, pending.payload, pending.key);
        await a.refresh();
        if (pending.name === 'create_pos_customer') {
          setCustomerId(id);
          setPicker(false);
        }
        setPending(null);
        setNotice('Đã xác nhận kết quả yêu cầu trước.');
        return;
      }
      const payload = pending?.payload || {
        customer_id: customerId,
        note,
        expected_total: total,
        lines: cart.map((p) => ({ product_id: p.id, order_qty: pieces[p.id]! / 10 })),
        ...(order ? { order_id: order.id, version: order.version } : {}),
      };
      await submitMutation('post_pos_sale', payload, pending?.key || key.current);
      setPending(null);
      setPieces({});
      setTyped({});
      setNote('');
      setOrderId('');
      setCustomerId('');
      setNotice('Đã ghi bán và thu đủ tiền mặt. Chọn khách tiếp theo.');
      key.current = Crypto.randomUUID();
      await a.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setPending(await pendingMutation(a.userId));
    } finally {
      posting.current = false;
      setSaving(false);
    }
  }
  const customers = a.data.customers.filter(
    (c) =>
      c.is_active &&
      searchText(`${c.name} ${c.phone || ''} ${c.code || ''}`).includes(searchText(customerSearch)),
  );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={styles.head}>
        <View style={s.between}>
          <Text style={[s.label, { flex: 1 }]}>
            PHÚC AN ·{' '}
            {a.data.routes.find((r) => r.id === customer?.route_id)?.name || 'BÁN HÀNG THEO TUYẾN'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Trang chính"
            disabled={locked}
            onPress={() => a.go('home')}
            style={{ padding: 10 }}
          >
            <Icon name="home-outline" />
          </Pressable>
        </View>
        <Text style={s.h2}>POS · Bán nhanh</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lịch sử / Chốt tiền"
          disabled={locked}
          onPress={() => a.go('my-sales')}
        >
          <Text style={s.muted}>Lịch sử / Chốt tiền →</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn hoặc tạo khách POS"
          disabled={locked}
          onPress={() => {
            setCustomerSearch('');
            setPhone('');
            setPicker(true);
          }}
          style={styles.customer}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.h3}>{customer?.name || 'Chọn / tạo khách'}</Text>
            <Text style={s.muted}>
              {customer
                ? `${customer.customer_type || 'Bạn hàng'} · Giá theo khách`
                : 'Tìm tên, số điện thoại hoặc tạo nhanh'}
            </Text>
          </View>
          <Icon name="chevron-down" />
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 20 }}
      >
        {!!notice && (
          <Text accessibilityRole="alert" style={[s.text, { color: C.green }]}>
            {notice}
          </Text>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={[s.text, { color: C.red }]}>
            {error}
          </Text>
        )}
        {!!pending && (
          <Text style={s.muted}>
            Yêu cầu trước chưa rõ kết quả. Thử lại giữ nguyên mã, không ghi trùng. Giỏ được khóa
            trong lúc chờ.
          </Text>
        )}
        {draftUnavailable && !pending && (
          <View style={s.banner}>
            <Text style={s.text}>
              Khách, món hoặc đơn trong giỏ đã ngừng dùng hay không còn trong quyền của bạn. Tạo giỏ
              mới để tiếp tục.
            </Text>
            <Button
              title="Bỏ giỏ cũ, tạo giỏ mới"
              disabled={locked}
              secondary
              onPress={() => {
                setCustomerId('');
                setOrderId('');
                setPieces({});
                setTyped({});
                setNote('');
                key.current = Crypto.randomUUID();
              }}
            />
          </View>
        )}
        {!customer ? (
          <Empty
            title="Chọn khách để bắt đầu bán"
            body="Giá và món hiển thị theo khách trong phạm vi của bạn."
          />
        ) : (
          <>
            {!!order && (
              <View style={[s.banner, s.between]}>
                <Text style={s.text}>Giao đơn #{shortId(order.id)} · Giá đã chốt</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng đơn đặt POS"
                  disabled={locked}
                  onPress={() => {
                    setOrderId('');
                    setPieces({});
                    setTyped({});
                    setNote('');
                    key.current = Crypto.randomUUID();
                  }}
                >
                  <Icon name="close" />
                </Pressable>
              </View>
            )}
            {!order && orders.length > 0 && (
              <Select
                label="Đơn đã đặt cần giao"
                value=""
                options={orders.map((o) => ({
                  value: o.id,
                  label: `#${shortId(o.id)} · ${o.delivery_date}`,
                }))}
                onChange={loadOrder}
                disabled={locked}
              />
            )}
            <TextInput
              accessibilityLabel="Tìm món POS"
              value={query}
              onChangeText={setQuery}
              editable={!locked}
              placeholder="Tìm món, mã hoặc tên thường gọi…"
              style={s.input}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {[
                { id: 'favorite', name: 'Món hay lấy' },
                ...categories.map((c) => ({
                  id: c,
                  name: c === 'BOM legacy' ? 'Danh mục khác' : c,
                })),
                { id: 'all', name: 'Tất cả' },
              ].map((g) => (
                <Pressable
                  key={g.id}
                  accessibilityRole="button"
                  accessibilityLabel={g.name}
                  accessibilityState={{ selected: group === g.id }}
                  disabled={locked}
                  onPress={() => {
                    setGroup(g.id);
                    setQuery('');
                  }}
                  style={[styles.group, group === g.id && { backgroundColor: C.green }]}
                >
                  <Text style={{ color: group === g.id ? C.paper : C.ink, fontSize: 12 }}>
                    {g.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={s.muted}>
              {query
                ? `${menu.length} kết quả`
                : group === 'favorite' && !favorites.size
                  ? 'Chưa có lịch sử · Gợi ý món có giá'
                  : `${menu.length} món`}{' '}
              · Chạm món thêm 1 bì
            </Text>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 244 }}
              contentContainerStyle={styles.grid}
            >
              {menu.map((p) => {
                const q = quote(p.id),
                  count = q ? (pieces[p.id] || 0) / q.pack : 0;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Thêm 1 bì ${p.name}`}
                    disabled={locked || !q}
                    onPress={() => change(p.id, 1)}
                    style={[
                      styles.tile,
                      count > 0 && { borderColor: C.green },
                      !q && { opacity: 0.55 },
                    ]}
                  >
                    <Text numberOfLines={2} style={[s.text, { fontWeight: '600', minHeight: 38 }]}>
                      {p.name}
                    </Text>
                    <Text style={[s.text, { fontWeight: '700' }]}>
                      {q
                        ? money(posLineTotal(q.pack, q.amount, q.pricePieces, q.discount))
                        : 'Chưa có giá'}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.muted }}>
                      {q ? `Bì ${quantity(q.pack)} cái` : 'Chưa xác minh quy cách'}
                    </Text>
                    {count > 0 && (
                      <View style={styles.badge}>
                        <Text style={{ color: C.paper, fontSize: 11 }}>{quantity(count)}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
              {!menu.length && (
                <Text style={s.muted}>Không có món phù hợp. Thử tên khác hoặc Tất cả.</Text>
              )}
            </ScrollView>
            <View style={styles.cart}>
              <Text style={s.h3}>Giỏ hàng · {cart.length} món</Text>
              {cart.map((p) => {
                const q = quote(p.id);
                return (
                  <View key={p.id} style={styles.line}>
                    <View style={s.between}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.h3}>{p.name}</Text>
                        <Text style={s.muted}>
                          {q
                            ? `${money(posLineTotal(q.pack, q.amount, q.pricePieces, q.discount))} / bì ${quantity(q.pack)}`
                            : 'Giá / đơn đặt đã thay đổi. Tải lại.'}
                        </Text>
                      </View>
                      <Text style={s.h3}>
                        {q
                          ? money(posLineTotal(pieces[p.id]!, q.amount, q.pricePieces, q.discount))
                          : '—'}
                      </Text>
                    </View>
                    <View style={[s.row, { gap: 7 }]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Giảm số bì ${p.name}`}
                        disabled={locked}
                        onPress={() => change(p.id, -1)}
                        style={styles.qtyButton}
                      >
                        <Icon name="remove" />
                      </Pressable>
                      <TextInput
                        accessibilityLabel={`Số bì ${p.name}`}
                        editable={!locked && !!q}
                        value={
                          typed[p.id] ??
                          (q ? String(Number((pieces[p.id]! / q.pack).toFixed(4))) : '')
                        }
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                        style={styles.qtyInput}
                        onChangeText={(t) => {
                          setTyped((v) => ({ ...v, [p.id]: t }));
                          const n = Number(t.replace(',', '.')) * (q?.pack || 10);
                          if (
                            Number.isSafeInteger(Math.round(n)) &&
                            n >= 0 &&
                            Math.abs(n - Math.round(n)) < 1e-7
                          )
                            setPieces((v) => ({ ...v, [p.id]: Math.round(n) }));
                        }}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Tăng số bì ${p.name}`}
                        disabled={locked}
                        onPress={() => change(p.id, 1)}
                        style={styles.qtyButton}
                      >
                        <Icon name="add" />
                      </Pressable>
                      <Text style={s.muted}>bì</Text>
                      <View style={{ flex: 1 }} />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Xóa ${p.name} khỏi giỏ`}
                        disabled={locked}
                        onPress={() => {
                          setPieces((v) => {
                            const n = { ...v };
                            delete n[p.id];
                            return n;
                          });
                          setTyped((v) => {
                            const n = { ...v };
                            delete n[p.id];
                            return n;
                          });
                        }}
                        style={styles.qtyButton}
                      >
                        <Icon name="trash-outline" color={C.muted} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {!cart.length && <Text style={s.muted}>Chạm món phía trên để thêm hàng.</Text>}
              <TextInput
                accessibilityLabel="Ghi chú POS"
                value={note}
                onChangeText={setNote}
                editable={!locked}
                multiline
                placeholder="Ghi chú đơn…"
                style={[s.input, { minHeight: 58, marginTop: 10 }]}
              />
            </View>
          </>
        )}
      </ScrollView>
      <View style={styles.footer} accessibilityLabel="Tổng tiền và chốt POS">
        <View style={{ flex: 1 }}>
          <Text style={s.muted}>Tổng tiền</Text>
          <Text style={[s.h2, { fontSize: 26 }]}>
            {money(
              pending?.name === 'post_pos_sale' ? Number(pending.payload.expected_total) : total,
            )}
          </Text>
        </View>
        <View style={{ flex: 1.3, gap: 3 }}>
          <Button
            title={saving ? 'Đang ghi…' : pending ? 'Thử lại yêu cầu' : 'Chốt bán'}
            disabled={saving || a.busy || (!pending && !valid)}
            onPress={() => void checkout()}
          />
          <Text style={{ fontSize: 10, color: C.muted, textAlign: 'center' }}>
            Xác nhận đã thu đủ tiền mặt
          </Text>
        </View>
      </View>
      {picker && (
        <Sheet
          title="Chọn / tạo bạn hàng"
          onClose={() => {
            if (!saving) setPicker(false);
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            {!!error && (
              <Text accessibilityRole="alert" style={[s.text, { color: C.red }]}>
                {error}
              </Text>
            )}
            {!!pending && (
              <Button
                title="Thử lại yêu cầu đang chờ"
                disabled={saving || a.busy}
                onPress={() => void checkout()}
              />
            )}
            <TextInput
              accessibilityLabel="Tìm khách POS"
              value={customerSearch}
              onChangeText={(t) => {
                setCustomerSearch(t);
                createKey.current = Crypto.randomUUID();
              }}
              editable={!locked}
              placeholder="Tên, mã hoặc số điện thoại…"
              style={s.input}
            />
            {customers.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`Chọn khách ${c.name}`}
                disabled={locked}
                onPress={() => selectCustomer(c.id)}
                style={s.card}
              >
                <Text style={s.h3}>{c.name}</Text>
                <Text style={s.muted}>
                  {c.phone ||
                    a.data.routes.find((r) => r.id === c.route_id)?.name ||
                    'Khách được giao trực tiếp'}
                </Text>
              </Pressable>
            ))}
            {customerSearch.trim() &&
              !customers.some((c) => searchText(c.name) === searchText(customerSearch.trim())) && (
                <View style={[s.card, { gap: 10 }]}>
                  <Text style={s.h3}>Tạo “{customerSearch.trim()}”</Text>
                  <TextInput
                    accessibilityLabel="Số điện thoại khách mới POS"
                    value={phone}
                    onChangeText={setPhone}
                    editable={!locked}
                    keyboardType="phone-pad"
                    placeholder="Số điện thoại (không bắt buộc)"
                    style={s.input}
                  />
                  {routes.length > 1 ? (
                    <Select
                      label="Tuyến của khách mới"
                      value={routeId || customer?.route_id || ''}
                      options={routes.map((r) => ({ value: r.id, label: r.name }))}
                      onChange={setRouteId}
                      disabled={locked}
                    />
                  ) : (
                    <Text style={s.muted}>
                      {routes[0]?.name || 'Bạn chưa được phân công tuyến để tạo khách.'}
                    </Text>
                  )}
                  <Button
                    title="Tạo khách & bán ngay"
                    disabled={locked || !routes.length}
                    onPress={() => void createCustomer()}
                  />
                </View>
              )}
          </ScrollView>
        </Sheet>
      )}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  head: {
    padding: 16,
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    backgroundColor: C.paper,
  },
  customer: {
    backgroundColor: C.soft,
    padding: 12,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  group: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 1 },
  tile: {
    width: '31.5%',
    minHeight: 108,
    padding: 9,
    gap: 3,
    backgroundColor: C.paper,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.line,
  },
  badge: {
    position: 'absolute',
    right: 3,
    top: 3,
    backgroundColor: C.green,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  cart: {
    backgroundColor: C.paper,
    padding: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.line,
    gap: 8,
  },
  line: { gap: 7, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  qtyButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.paper,
    borderRadius: 11,
    width: 66,
    minHeight: 44,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: C.ink,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.paper,
  },
});
