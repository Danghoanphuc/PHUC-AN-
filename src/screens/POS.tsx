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
import { errorMessage, money, quantity, shortId } from '../lib/format';
import { favoriteProducts, posLineTotal, posPrice, searchText } from '../lib/pos';
import { pendingMutation, submitMutation, type Pending } from '../lib/mutations';
import { readPosDraft, savePosDraft } from '../lib/posDraft';
import { shortProductName } from '../lib/posDisplay';
import { QuantityPOS } from './QuantityPOS';
import { Segment } from '../components/ui';
import { defaultCustomerRoute } from '../lib/customerRoute';

export function POS() {
  const a = useApp();
  const [mode, setMode] = useState('quantity');
  useEffect(() => {
    let live = true;
    void pendingMutation(a.userId).then((p) => {
      if (live && p?.name === 'post_pos_sale') setMode('product');
    });
    return () => {
      live = false;
    };
  }, [a.userId]);
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
        <Segment
          values={[
            { value: 'quantity', label: 'Bán theo số lượng' },
            { value: 'product', label: 'Chọn theo món' },
          ]}
          selected={mode}
          onSelect={setMode}
        />
      </View>
      {mode === 'quantity' ? <QuantityPOS /> : <ProductPOS />}
    </View>
  );
}
function ProductPOS() {
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
  const [pane, setPane] = useState<'menu' | 'cart'>('menu');
  const [width, setWidth] = useState(0);
  const wide = width >= 900;
  const columns = wide ? (width >= 1200 ? 8 : 5) : width >= 540 ? 5 : 3;
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
  const selectedRoute = routeId || defaultCustomerRoute(routes);
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
  const cart = products.filter((p) => (pieces[p.id] || 0) > 0 || p.id in typed);
  const totalBags =
    pending?.name === 'post_pos_sale'
      ? (pending.payload.lines as { order_qty: number }[]).reduce(
          (sum, line) => sum + line.order_qty,
          0,
        )
      : cart.reduce(
          (sum, p) => sum + (quote(p.id) ? (pieces[p.id] || 0) / quote(p.id)!.pack : 0),
          0,
        );
  const total = cart.reduce((n, p) => {
    const q = quote(p.id);
    return n + (q ? posLineTotal(pieces[p.id]!, q.amount, q.pricePieces, q.discount) : 0);
  }, 0);
  const invalid = Object.entries(typed).some(([id, t]) => {
    const q = quote(id),
      v = Number(t.replace(',', '.'));
    return (
      !q ||
      !/^\d+(?:[.,]\d+)?$/.test(t) ||
      !Number.isSafeInteger(Math.round(v * q.pack)) ||
      v <= 0 ||
      Math.abs(v * q.pack - Math.round(v * q.pack)) > 1e-7
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
    setPieces((v) => ({
      ...v,
      [id]: Math.min(q.remaining, Math.max(0, (v[id] || 0) + delta * q.pack)),
    }));
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
    setPane('menu');
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
    const r = selectedRoute;
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
      setPane('menu');
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
      setPane('menu');
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
  const groups = [
    { id: 'favorite', name: 'Hay lấy', icon: 'sparkles-outline' as const },
    { id: 'all', name: 'Tất cả', icon: 'grid-outline' as const },
    ...categories.map((c) => ({
      id: c,
      name: c === 'BOM legacy' ? 'Danh mục khác' : c,
      icon: 'pricetag-outline' as const,
    })),
  ];
  const openCustomer = () => {
    setRouteId('');
    setCustomerSearch('');
    setPhone('');
    setPicker(true);
  };
  const cartPanel = (
    <ScrollView
      testID="pos-cart-scroll"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
    >
      <View style={styles.cart}>
        <View style={s.between}>
          <View>
            <Text style={s.label}>ĐƠN ĐANG BÁN</Text>
            <Text style={s.h2}>Giỏ hàng · {cart.length} món</Text>
          </View>
          <View style={styles.cartIcon}>
            <Icon name="bag-handle-outline" color={C.orange} />
          </View>
        </View>
        {cart.map((p) => {
          const q = quote(p.id);
          return (
            <View key={p.id} style={styles.line}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text numberOfLines={2} style={styles.cartName}>
                  {p.name}
                </Text>
                <Text style={styles.cartAmount}>
                  {q
                    ? money(posLineTotal(pieces[p.id]!, q.amount, q.pricePieces, q.discount))
                    : '—'}
                </Text>
                {!q && (
                  <Text style={{ fontSize: 11, color: C.red }}>
                    Giá / đơn đặt đã thay đổi. Tải lại.
                  </Text>
                )}
              </View>
              <View style={[s.row, { gap: 3 }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Giảm số bì ${p.name}`}
                  disabled={locked}
                  onPress={() => change(p.id, -1)}
                  style={[styles.qtyButton, styles.cartQtyButton]}
                >
                  <Icon name="remove" size={17} />
                </Pressable>
                <TextInput
                  accessibilityLabel={`Số bì ${p.name}`}
                  editable={!locked && !!q}
                  value={
                    typed[p.id] ?? (q ? String(Number((pieces[p.id]! / q.pack).toFixed(4))) : '')
                  }
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  style={styles.qtyInput}
                  onChangeText={(t) => {
                    setTyped((v) => ({ ...v, [p.id]: t }));
                    const n = Number(t.replace(',', '.')) * (q?.pack || 10);
                    if (
                      /^\d+(?:[.,]\d+)?$/.test(t) &&
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
                  style={[styles.qtyButton, styles.cartQtyButton]}
                >
                  <Icon name="add" size={17} />
                </Pressable>
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
                  style={[
                    styles.qtyButton,
                    styles.cartQtyButton,
                    { backgroundColor: 'transparent' },
                  ]}
                >
                  <Icon name="trash-outline" size={17} color={C.muted} />
                </Pressable>
              </View>
            </View>
          );
        })}
        {!cart.length && (
          <Empty
            icon="bag-handle-outline"
            title="Giỏ hàng đang trống"
            body="Chọn món từ menu. Số lượng và thành tiền sẽ xuất hiện tại đây."
          />
        )}
        {invalid && (
          <Text style={{ color: C.red }}>
            Nhập số bì lớn hơn 0, đủ số cái. Dùng nút thùng rác để bỏ món.
          </Text>
        )}
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
    </ScrollView>
  );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flex: 1, minHeight: 0 }}
    >
      <View style={styles.head}>
        <View style={s.between}>
          <View style={s.row}>
            <View style={styles.brandIcon}>
              <Icon name="storefront-outline" color={C.paper} />
            </View>
            <View>
              <Text style={s.h3}>POS · Bán nhanh</Text>
              <Text style={styles.caption}>PHÚC AN · QUẦY BÁN HÀNG</Text>
            </View>
          </View>
          <View style={[s.row, { gap: 6 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lịch sử / Chốt tiền"
              disabled={locked}
              onPress={() => a.go('my-sales')}
              style={styles.qtyButton}
            >
              <Icon name="time-outline" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Trang chính"
              disabled={locked}
              onPress={() => a.go('home')}
              style={styles.qtyButton}
            >
              <Icon name="home-outline" />
            </Pressable>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn hoặc tạo khách POS"
          disabled={locked}
          onPress={openCustomer}
          style={styles.customer}
        >
          <View style={styles.customerAvatar}>
            <Icon name="person-outline" size={19} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={s.h3}>
              {customer?.name || 'Chọn / tạo khách'}
            </Text>
            <Text style={styles.caption}>
              {customer
                ? `${customer.customer_type || 'Bạn hàng'} · Giá theo khách`
                : 'Tìm tên, số điện thoại hoặc tạo nhanh'}
            </Text>
          </View>
          <Text style={styles.customerAction}>{customer ? 'Đổi khách' : 'Chọn khách'}</Text>
          <Icon name="chevron-forward" size={16} />
        </Pressable>
      </View>
      {(!!notice || !!error || !!pending || draftUnavailable) && (
        <ScrollView
          style={{ maxHeight: 140, flexGrow: 0 }}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          keyboardShouldPersistTaps="handled"
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
                Khách, món hoặc đơn trong giỏ đã ngừng dùng hay không còn trong quyền của bạn. Tạo
                giỏ mới để tiếp tục.
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
        </ScrollView>
      )}
      {!customer ? (
        <View style={styles.welcome}>
          <View style={styles.welcomeMark}>
            <Icon name="storefront-outline" size={38} />
          </View>
          <Text style={[s.title, { textAlign: 'center', fontSize: 26 }]}>Sẵn sàng cho đơn mới</Text>
          <Text style={[s.muted, { textAlign: 'center', maxWidth: 320 }]}>
            Chọn khách để mở thực đơn và giá bán phù hợp. Món khách hay lấy sẽ được gợi ý trước.
          </Text>
          <Button
            title="Chọn khách để bắt đầu"
            icon="person-add-outline"
            disabled={locked}
            onPress={openCustomer}
          />
          <View style={[s.row, { gap: 6 }]}>
            <Icon name="shield-checkmark-outline" size={15} color={C.muted} />
            <Text style={styles.caption}>Giỏ hàng tự lưu trên thiết bị</Text>
          </View>
        </View>
      ) : (
        <>
          {!wide && (
            <View style={styles.shortcuts}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Về menu món"
                accessibilityState={{ selected: pane === 'menu' }}
                onPress={() => setPane('menu')}
                style={[styles.paneTab, pane === 'menu' && styles.activeTab]}
              >
                <Icon name="grid-outline" size={18} color={pane === 'menu' ? C.green : C.muted} />
                <Text style={[styles.tabText, pane === 'menu' && { color: C.green }]}>
                  Chọn món
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xem giỏ hàng POS"
                accessibilityState={{ selected: pane === 'cart' }}
                onPress={() => setPane('cart')}
                style={[styles.paneTab, pane === 'cart' && styles.activeTab]}
              >
                <Icon
                  name="bag-handle-outline"
                  size={18}
                  color={pane === 'cart' ? C.green : C.muted}
                />
                <Text style={[styles.tabText, pane === 'cart' && { color: C.green }]}>
                  Giỏ hàng
                </Text>
                <View style={styles.tabCount}>
                  <Text style={styles.tabCountText}>{cart.length}</Text>
                </View>
              </Pressable>
            </View>
          )}
          <View style={[styles.workspace, wide && { flexDirection: 'row' }]}>
            <View
              testID="pos-catalog-pane"
              style={[styles.catalog, !wide && pane !== 'menu' && { display: 'none' }]}
            >
              <View style={styles.catalogTools}>
                {wide && (
                  <View style={s.between}>
                    <Text style={s.h2}>Chọn món</Text>
                    <Text style={s.muted}>Chạm để thêm 1 bì</Text>
                  </View>
                )}
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

                <View style={styles.searchBox}>
                  <Icon name="search-outline" color={C.muted} />
                  <TextInput
                    accessibilityLabel="Tìm món POS"
                    value={query}
                    onChangeText={setQuery}
                    editable={!locked}
                    placeholder="Tên món, mã, tên thường gọi…"
                    placeholderTextColor={C.muted}
                    style={styles.searchInput}
                  />
                  {!!query && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Xóa tìm món"
                      disabled={locked}
                      onPress={() => setQuery('')}
                      style={styles.clearSearch}
                    >
                      <Icon name="close-circle" size={19} color={C.muted} />
                    </Pressable>
                  )}
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 7 }}
                  style={{ flexGrow: 0 }}
                >
                  {groups.map((g) => (
                    <Pressable
                      key={g.id}
                      accessibilityRole="button"
                      accessibilityLabel={g.id === 'favorite' ? 'Món hay lấy' : g.name}
                      accessibilityState={{ selected: group === g.id && !query.trim() }}
                      disabled={locked}
                      onPress={() => {
                        setGroup(g.id);
                        setQuery('');
                      }}
                      style={[styles.group, group === g.id && !query.trim() && styles.activeGroup]}
                    >
                      <Icon
                        name={g.icon}
                        size={15}
                        color={group === g.id && !query.trim() ? C.paper : C.muted}
                      />
                      <Text
                        style={[
                          styles.groupText,
                          group === g.id && !query.trim() && { color: C.paper },
                        ]}
                      >
                        {g.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <ScrollView
                testID="pos-scroll"
                keyboardShouldPersistTaps="handled"
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 24 }}
              >
                <View style={s.between}>
                  <Text style={s.h3}>
                    {query.trim()
                      ? 'Kết quả tìm kiếm'
                      : group === 'favorite'
                        ? 'Món hay lấy'
                        : groups.find((g) => g.id === group)?.name}
                  </Text>
                  <Text style={s.muted}>{menu.length} món</Text>
                </View>
                {group === 'favorite' && !query.trim() && (
                  <Text style={styles.caption}>
                    {favorites.size
                      ? 'Gợi ý theo lịch sử đặt hàng của khách'
                      : 'Chưa có lịch sử · Ưu tiên món có giá'}
                  </Text>
                )}
                <View testID="pos-menu" style={styles.grid}>
                  {menu.map((p) => {
                    const q = quote(p.id),
                      count = q ? (pieces[p.id] || 0) / q.pack : 0;
                    const full = !!q && (pieces[p.id] || 0) >= q.remaining;
                    return (
                      <View key={p.id} style={{ width: `${100 / columns}%`, padding: 4 }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Thêm 1 bì ${p.name}`}
                          accessibilityHint={`${p.name}. ${q ? `Một bì ${quantity(q.pack)} cái. Đã chọn ${quantity(count)} bì.` : 'Chưa có giá.'}`}
                          disabled={locked || !q || full}
                          onPress={() => change(p.id, 1)}
                          style={({ pressed }) => [
                            styles.tile,
                            count > 0 && styles.selectedTile,
                            !q && { opacity: 0.6 },
                            pressed && { backgroundColor: C.soft },
                          ]}
                        >
                          <View
                            style={[styles.productMark, count > 0 && { backgroundColor: C.green }]}
                          >
                            <Icon
                              name={
                                searchText(p.name).includes('donut')
                                  ? 'disc-outline'
                                  : searchText(p.name).includes('kem')
                                    ? 'ice-cream-outline'
                                    : 'fast-food-outline'
                              }
                              size={28}
                              color={count > 0 ? C.paper : C.green}
                            />
                          </View>
                          <Text numberOfLines={1} style={styles.productName}>
                            {shortProductName(p.name)}
                          </Text>
                          <Text style={[styles.price, !q && { color: C.muted, fontSize: 13 }]}>
                            {q
                              ? money(posLineTotal(q.pack, q.amount, q.pricePieces, q.discount))
                              : 'Chưa có giá'}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
                {!menu.length && (
                  <View style={{ gap: 8 }}>
                    <Empty
                      icon="search-outline"
                      title="Chưa tìm thấy món"
                      body="Thử tên khác, mã món hoặc mở tất cả thực đơn."
                    />
                    <Button
                      title="Xem tất cả món"
                      secondary
                      disabled={locked}
                      onPress={() => {
                        setGroup('all');
                        setQuery('');
                      }}
                    />
                  </View>
                )}
              </ScrollView>
              {!wide && cart.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mở giỏ hàng vừa chọn"
                  onPress={() => setPane('cart')}
                  style={styles.cartPeek}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.peekTitle}>Đã chọn {cart.length} món</Text>
                    <Text numberOfLines={1} style={styles.caption}>
                      {cart.map((p) => p.name).join(' · ')}
                    </Text>
                  </View>
                  <Text style={styles.customerAction}>Xem đơn</Text>
                  <Icon name="arrow-forward" size={18} />
                </Pressable>
              )}
            </View>
            <View
              testID="pos-cart-pane"
              style={[
                styles.cartPane,
                wide ? { width: 350 } : { flex: 1 },
                !wide && pane !== 'cart' && { display: 'none' },
              ]}
            >
              {cartPanel}
              {!wide && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tiếp tục chọn món"
                  onPress={() => setPane('menu')}
                  style={styles.continueButton}
                >
                  <Icon name="add-circle-outline" size={18} />
                  <Text style={styles.customerAction}>Chọn thêm món</Text>
                </Pressable>
              )}
            </View>
          </View>
        </>
      )}
      <View style={styles.footer} accessibilityLabel="Tổng tiền và chốt POS">
        <View style={{ flex: 1 }}>
          <Text style={s.muted}>Tổng tiền</Text>
          <Text style={[s.h2, { fontSize: 26 }]}>
            {invalid && !pending
              ? '—'
              : money(
                  pending?.name === 'post_pos_sale'
                    ? Number(pending.payload.expected_total)
                    : total,
                )}
          </Text>
          <Text accessibilityLabel="Tổng bì POS" style={styles.bagTotal}>
            Tổng bì: {invalid && !pending ? '—' : quantity(totalBags)}
          </Text>
        </View>
        <View style={{ flex: 1.3, gap: 3, maxWidth: wide ? 322 : undefined }}>
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
                      value={selectedRoute}
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
  caption: { fontSize: 11, color: C.muted, lineHeight: 17 },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAction: { fontSize: 12, fontWeight: '700', color: C.green },
  workspace: { flex: 1, minHeight: 0 },
  catalog: { flex: 1, minWidth: 0, minHeight: 0 },
  catalogTools: {
    padding: 14,
    gap: 10,
    backgroundColor: C.paper,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    borderRadius: 13,
    backgroundColor: '#F5F6F1',
    borderWidth: 1,
    borderColor: C.line,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingVertical: 12,
    fontSize: 14,
    color: C.ink,
  },
  clearSearch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  paneTab: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 10,
  },
  activeTab: { backgroundColor: C.paper },
  tabText: { fontSize: 14, fontWeight: '600', color: C.muted },
  tabCount: { backgroundColor: C.green, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  tabCountText: { color: C.paper, fontSize: 11, fontWeight: '700' },
  activeGroup: { backgroundColor: C.green, borderColor: C.green },
  groupText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  selectedTile: { backgroundColor: '#F1F6EE', borderColor: C.green },
  productMark: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.soft,
  },
  productName: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: C.ink,
    textAlign: 'center',
    width: '100%',
  },
  price: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: C.green },
  bagTotal: { fontSize: 12, lineHeight: 18, color: C.green, fontWeight: '600' },
  cartPane: {
    minHeight: 0,
    backgroundColor: '#EEEFE8',
    borderLeftWidth: 1,
    borderLeftColor: C.line,
  },
  cartIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartPeek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.soft,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  peekTitle: { fontSize: 12, fontWeight: '700', color: C.green },
  continueButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
    gap: 6,
    margin: 10,
    backgroundColor: C.paper,
    borderRadius: 12,
  },
  welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 },
  welcomeMark: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    backgroundColor: C.paper,
  },
  shortcuts: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    marginHorizontal: 14,
    marginVertical: 10,
    borderRadius: 13,
    backgroundColor: '#E6E9DF',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -4 },
  tile: {
    minHeight: 112,
    padding: 8,
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.paper,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.line,
  },
  cart: {
    backgroundColor: C.paper,
    padding: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.line,
    gap: 8,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  cartName: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: C.ink },
  cartAmount: { fontSize: 12, lineHeight: 17, fontWeight: '600', color: C.green },
  cartQtyButton: { minWidth: 32, minHeight: 36, borderRadius: 8 },
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
    width: 42,
    minHeight: 36,
    textAlign: 'center',
    fontSize: 15,
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
