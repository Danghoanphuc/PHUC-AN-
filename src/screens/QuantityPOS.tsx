import React, { useEffect, useRef, useState } from 'react';
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
import { Button, C, Icon, Select, Sheet, s } from '../components/ui';
import { PackageAllocation } from '../components/PackageAllocation';
import { CustomerPackagePrices } from '../components/CustomerPackagePrices';
import { useApp, managerRole } from '../lib/context';
import { errorMessage, money, quantity, shortId } from '../lib/format';
import { pendingMutation, submitMutation, type Pending } from '../lib/mutations';
import { readPackageDraft, savePackageDraft } from '../lib/packageDraft';
import {
  editPackagePrice,
  packageLabel,
  packageQuantity,
  packagePrice,
  type PackageUnit,
} from '../lib/packagePrices';
import { searchText } from '../lib/pos';
import { defaultCustomerRoute } from '../lib/customerRoute';

export function QuantityPOS() {
  const a = useApp();
  const [customerId, setCustomerId] = useState(''),
    [counts, setCounts] = useState({ bi: '', hop: '' }),
    [note, setNote] = useState('');
  const [picker, setPicker] = useState(false),
    [search, setSearch] = useState(''),
    [phone, setPhone] = useState(''),
    [routeId, setRouteId] = useState('');
  const [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false),
    [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [allocation, setAllocation] = useState('');
  const [waitingOpen, setWaitingOpen] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);
  const key = useRef(Crypto.randomUUID()),
    createKey = useRef(Crypto.randomUUID()),
    posting = useRef(false);
  const customer = a.data.customers.find((c) => c.id === customerId && c.is_active);
  const locked = !ready || saving || a.busy || !!pending;
  const routes = a.data.routes.filter(
    (r) =>
      r.is_active &&
      (a.role !== 'staff' ||
        a.data.assignments.some((x) => x.user_id === a.userId && x.route_id === r.id)),
  );
  const selectedRoute = routeId || defaultCustomerRoute(routes);
  useEffect(() => {
    let live = true;
    void Promise.all([readPackageDraft(a.userId), pendingMutation(a.userId)])
      .then(([draft, request]) => {
        if (!live) return;
        if (draft) {
          setCustomerId(draft.customerId);
          setCounts({ bi: draft.bi, hop: draft.hop });
          setNote(draft.note);
          key.current = draft.key;
        }
        if (request?.name === 'post_pos_package_sale') {
          setCustomerId(String(request.payload.customer_id));
          setNote(String(request.payload.note || ''));
          const lines = request.payload.lines as { package_unit: string; quantity: number }[];
          setCounts({
            bi: String(lines.find((l) => l.package_unit === 'bi')?.quantity || ''),
            hop: String(lines.find((l) => l.package_unit === 'hop')?.quantity || ''),
          });
        }
        setPending(request);
        setReady(true);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [a.userId]);
  useEffect(() => {
    if (!ready || saving || pending) return;
    void savePackageDraft(
      a.userId,
      customerId || counts.bi || counts.hop || note
        ? { customerId, ...counts, note, key: key.current }
        : null,
    ).catch(() => setError('Không lưu được đơn trên thiết bị. Giữ màn hình này đến khi chốt.'));
  }, [a.userId, ready, saving, pending, customerId, counts, note]);
  const units: PackageUnit[] = ['bi', 'hop'];
  const quote = units.map((unit) => ({
    unit,
    qty: packageQuantity(counts[unit]),
    rate: packagePrice(a.data, customerId, unit),
  }));
  const invalid = quote.some(
    (l) =>
      !Number.isFinite(l.qty) ||
      l.qty < 0 ||
      l.qty > 100000 ||
      (l.qty > 0 &&
        (!l.rate ||
          Math.abs(
            l.qty * l.rate.pieces_per_package - Math.round(l.qty * l.rate.pieces_per_package),
          ) > 1e-7)),
  );
  const total = quote.reduce(
    (sum, l) => sum + (Number.isFinite(l.qty) && l.rate ? l.qty * l.rate.amount : 0),
    0,
  );
  const valid = !!customer && !invalid && total > 0;
  const customers = a.data.customers.filter(
    (c) =>
      c.is_active &&
      searchText(`${c.name} ${c.phone || ''} ${c.code || ''}`).includes(searchText(search)),
  );
  const waiting = a.data.packageSales.filter((x) => x.status === 'pending');
  function openPicker() {
    setRouteId('');
    setSearch('');
    setPhone('');
    setPicker(true);
  }
  async function checkout() {
    if (posting.current || saving || !ready || a.busy || (!pending && !valid)) return;
    posting.current = true;
    setSaving(true);
    setError('');
    const operation = pending?.name || 'post_pos_package_sale';
    try {
      const id = await submitMutation(
        operation,
        pending?.payload || {
          customer_id: customerId,
          note,
          expected_total: total,
          lines: quote
            .filter((l) => l.qty > 0)
            .map((l) => ({
              package_unit: l.unit,
              quantity: l.qty,
              price_version: l.rate!.version,
              price_id: l.rate!.id,
            })),
        },
        pending?.key || key.current,
      );
      setPending(null);
      if (operation === 'post_pos_package_sale') {
        setCounts({ bi: '', hop: '' });
        setCustomerId('');
        setNote('');
        key.current = Crypto.randomUUID();
        setNotice('Đã chốt bán và thu đủ tiền. Có thể điền loại bánh sau.');
      } else if (operation === 'create_pos_customer') {
        setCustomerId(id);
        setPicker(false);
      } else setNotice('Đã xác nhận yêu cầu trước.');
      await a.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setPending(await pendingMutation(a.userId));
    } finally {
      posting.current = false;
      setSaving(false);
    }
  }
  async function createCustomer() {
    const route = selectedRoute;
    if (locked || posting.current) return;
    if (!route) {
      setError('Chọn tuyến để tạo khách.');
      return;
    }
    posting.current = true;
    setSaving(true);
    setError('');
    try {
      const id = await submitMutation(
        'create_pos_customer',
        { name: search.trim(), phone: phone.trim(), route_id: route },
        createKey.current,
      );
      setCustomerId(id);
      setPicker(false);
      createKey.current = Crypto.randomUUID();
      await a.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setPending(await pendingMutation(a.userId));
    } finally {
      posting.current = false;
      setSaving(false);
    }
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, minHeight: 0 }}
    >
      <View style={st.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn hoặc tạo khách POS"
          disabled={locked}
          onPress={openPicker}
          style={st.customer}
        >
          <Icon name="person-outline" size={18} />
          <Text numberOfLines={1} style={[s.h3, { flex: 1 }]}>
            {customer?.name || 'Chọn / tạo khách'}
          </Text>
          <Icon name="chevron-down" size={16} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Giá riêng của khách POS"
          disabled={locked || !customer}
          onPress={() => setPricesOpen(true)}
          style={st.icon}
        >
          <Icon name="pricetag-outline" size={20} color={customer ? C.green : C.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lịch sử / Chốt tiền"
          disabled={locked}
          onPress={() => a.go('my-sales')}
          style={st.icon}
        >
          <Icon name="time-outline" size={20} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Trang chính"
          disabled={locked}
          onPress={() => a.go('home')}
          style={st.icon}
        >
          <Icon name="home-outline" size={20} />
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={st.body}
      >
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: C.red }}>
            {error}
          </Text>
        )}
        {!!notice && (
          <View style={{ gap: 6 }}>
            <Text accessibilityRole="alert" style={{ color: C.green }}>
              {notice}
            </Text>
            {notice.startsWith('Đã chốt bán') && (
              <Button title="Xem trong Đơn hàng" secondary onPress={() => a.go('orders')} />
            )}
          </View>
        )}
        {!!pending && (
          <Text style={s.muted}>Yêu cầu trước đang chờ xác nhận. Thử lại để tránh ghi trùng.</Text>
        )}
        {!ready && !error && <Text style={s.muted}>Đang mở đơn…</Text>}
        {!!customerId && !customer && ready && (
          <Text style={{ color: C.red }}>
            Khách đã ngừng hoạt động hoặc không còn trong phạm vi của bạn. Hãy chọn khách khác.
          </Text>
        )}
        {!customer ? (
          <View style={{ gap: 8, paddingVertical: 16 }}>
            <Text style={s.muted}>Chọn khách, nhập số lượng và thu tiền. Loại bánh điền sau.</Text>
            <Button title="Chọn khách để bắt đầu" onPress={openPicker} disabled={locked} />
          </View>
        ) : (
          <>
            <View style={st.quantities}>
              {quote.map(({ unit, qty, rate }) => (
                <View key={unit} style={st.quantityRow} testID="pos-quantity-row">
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.h3}>{unit === 'bi' ? 'Bì' : 'Hộp'}</Text>
                    <Text style={st.caption}>
                      {rate
                        ? `${money(rate.amount)} / ${rate.pieces_per_package} cái`
                        : 'Chưa có giá'}
                    </Text>
                  </View>
                  <View style={st.stepper}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Bớt nửa ${packageLabel(unit)}`}
                      disabled={locked}
                      onPress={() =>
                        setCounts((old) => ({
                          ...old,
                          [unit]: String(Math.max(0, (Number.isFinite(qty) ? qty : 0) - 0.5)),
                        }))
                      }
                      style={st.step}
                    >
                      <Icon name="remove" size={17} />
                    </Pressable>
                    <TextInput
                      accessibilityLabel={`Số ${packageLabel(unit)} bán nhanh`}
                      value={counts[unit]}
                      onChangeText={(v) => {
                        setCounts((old) => ({ ...old, [unit]: v }));
                        setNotice('');
                      }}
                      editable={!locked}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                      placeholder="0"
                      style={st.numberInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Thêm nửa ${packageLabel(unit)}`}
                      disabled={locked}
                      onPress={() =>
                        setCounts((old) => ({
                          ...old,
                          [unit]: String((Number.isFinite(qty) ? qty : 0) + 0.5),
                        }))
                      }
                      style={st.step}
                    >
                      <Text style={st.link}>+½</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Thêm 1 ${packageLabel(unit)}`}
                      disabled={locked}
                      onPress={() =>
                        setCounts((old) => ({
                          ...old,
                          [unit]: String((Number.isFinite(qty) ? qty : 0) + 1),
                        }))
                      }
                      style={st.step}
                    >
                      <Text style={st.link}>+1</Text>
                    </Pressable>
                  </View>
                  {managerRole(a.role) && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Thiết lập giá ${packageLabel(unit)}`}
                      disabled={locked}
                      onPress={() => editPackagePrice(a, customerId, unit)}
                      style={st.icon}
                    >
                      <Icon name="create-outline" size={18} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
            <Text style={st.caption}>
              {quote.every((l) => !l.rate || l.rate.pieces_per_package === 10)
                ? 'Bì nhỏ = 0,5 · Bì lớn = 1 · Hộp 5 cái = 0,5'
                : 'Nhập theo đơn vị chuẩn ghi ở trên.'}
            </Text>
            {quote.some((l) => l.qty > 0 && !l.rate) ? (
              <View style={st.priceWarning}>
                <Text accessibilityRole="alert" style={{ color: C.red, fontSize: 12 }}>
                  Chưa có giá{' '}
                  {quote
                    .filter((l) => l.qty > 0 && !l.rate)
                    .map((l) => packageLabel(l.unit))
                    .join(' / ')}{' '}
                  cho khách này.
                </Text>
                <Button
                  title="Cập nhật báo giá"
                  secondary
                  disabled={locked}
                  onPress={() => void a.refresh()}
                />
              </View>
            ) : (
              invalid && (
                <Text style={{ color: C.red, fontSize: 12 }}>
                  Số lượng cần tối đa 2 số lẻ và đủ số cái.
                </Text>
              )
            )}
            <TextInput
              accessibilityLabel="Ghi chú bán nhanh"
              value={note}
              onChangeText={setNote}
              editable={!locked}
              placeholder="Ghi chú (nếu có)…"
              style={st.note}
            />
          </>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở đơn chờ điền bánh"
          disabled={locked}
          onPress={() => setWaitingOpen(true)}
          style={st.waitingLink}
        >
          <Icon name="list-outline" size={18} />
          <Text style={[st.link, { flex: 1 }]}>Chờ điền bánh · {waiting.length}</Text>
          <Icon name="chevron-forward" size={16} />
        </Pressable>
      </ScrollView>
      <View style={st.footer} accessibilityLabel="Tổng tiền và chốt POS">
        <View style={{ flex: 1 }}>
          <Text style={st.caption}>Tổng tiền</Text>
          <Text style={[s.h2, { fontSize: 24 }]}>
            {pending?.name === 'post_pos_package_sale'
              ? money(Number(pending.payload.expected_total))
              : invalid
                ? '—'
                : money(total)}
          </Text>
          <Text style={st.caption}>
            Tổng bì: {Number.isFinite(quote[0]!.qty) ? quantity(quote[0]!.qty) : '—'} · Hộp:{' '}
            {Number.isFinite(quote[1]!.qty) ? quantity(quote[1]!.qty) : '—'}
          </Text>
        </View>
        <View style={{ flex: 1, maxWidth: 322, gap: 3 }}>
          <Button
            title={saving ? 'Đang ghi…' : pending ? 'Thử lại yêu cầu' : 'Chốt bán & thu tiền'}
            disabled={!ready || saving || a.busy || (!pending && !valid)}
            onPress={() => void checkout()}
          />
          <Text style={{ fontSize: 10, color: C.muted, textAlign: 'center' }}>
            Đã thu đủ tiền mặt
          </Text>
        </View>
      </View>
      {waitingOpen && (
        <Sheet title="Chờ điền loại bánh" onClose={() => setWaitingOpen(false)}>
          <ScrollView contentContainerStyle={{ padding: 14, gap: 8 }}>
            {!waiting.length && <Text style={s.muted}>Đã điền đủ bánh cho các đơn.</Text>}
            {waiting.map((x) => (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                accessibilityLabel={`Điền bánh đơn ${shortId(x.id)}`}
                disabled={locked}
                onPress={() => {
                  setWaitingOpen(false);
                  setAllocation(x.id);
                }}
                style={st.waiting}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.h3}>
                    {a.data.customers.find((c) => c.id === x.customer_id)?.name}
                  </Text>
                  <Text style={st.caption}>
                    {a.data.packageLines
                      .filter((l) => l.sale_id === x.id)
                      .map((l) => `${quantity(l.quantity)} ${packageLabel(l.package_unit)}`)
                      .join(' · ')}{' '}
                    · #{shortId(x.id)}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={17} />
              </Pressable>
            ))}
          </ScrollView>
        </Sheet>
      )}
      {pricesOpen && customer && (
        <Sheet title={`Giá riêng · ${customer.name}`} onClose={() => setPricesOpen(false)}>
          <View style={{ padding: 14 }}>
            <CustomerPackagePrices customerId={customer.id} disabled={locked} />
          </View>
        </Sheet>
      )}
      {picker && (
        <Sheet
          title="Chọn / tạo bạn hàng"
          onClose={() => {
            if (!saving) setPicker(false);
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, gap: 10 }}
          >
            {!!error && (
              <Text accessibilityRole="alert" style={{ color: C.red }}>
                {error}
              </Text>
            )}
            <TextInput
              accessibilityLabel="Tìm khách POS"
              value={search}
              onChangeText={(v) => {
                setSearch(v);
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
                onPress={() => {
                  setCustomerId(c.id);
                  setPicker(false);
                  setError('');
                  setNotice('');
                }}
                style={s.card}
              >
                <Text style={s.h3}>{c.name}</Text>
                <Text style={s.muted}>
                  {c.phone || a.data.routes.find((r) => r.id === c.route_id)?.name}
                </Text>
              </Pressable>
            ))}
            {!!search.trim() &&
              !customers.some((c) => searchText(c.name) === searchText(search.trim())) && (
                <View style={[s.card, { gap: 10 }]}>
                  <Text style={s.h3}>Tạo “{search.trim()}”</Text>
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
                    <Text style={s.muted}>{routes[0]?.name || 'Chưa được phân công tuyến.'}</Text>
                  )}
                  <Button
                    title="Tạo khách & bán ngay"
                    disabled={locked || !selectedRoute}
                    onPress={() => void createCustomer()}
                  />
                </View>
              )}
          </ScrollView>
        </Sheet>
      )}
      {!!allocation && (
        <PackageAllocation
          saleId={allocation}
          onClose={() => {
            setAllocation('');
            setWaitingOpen(true);
            void pendingMutation(a.userId).then(setPending);
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}
const st = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.paper,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  customer: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: C.soft,
  },
  icon: { width: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  body: {
    padding: 12,
    gap: 10,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 20,
  },
  quantities: {
    backgroundColor: C.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 10,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 76,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  caption: { fontSize: 11, lineHeight: 17, color: C.muted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  step: {
    minWidth: 34,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberInput: {
    width: 52,
    minHeight: 44,
    padding: 4,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 23,
    fontWeight: '700',
    color: C.green,
  },
  note: {
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: C.ink,
    backgroundColor: C.paper,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
  },
  priceWarning: { gap: 8, padding: 10, borderRadius: 10, backgroundColor: C.orangeSoft },
  link: { fontSize: 12, fontWeight: '600', color: C.green },
  waitingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: 8,
    paddingHorizontal: 8,
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.paper,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
});
