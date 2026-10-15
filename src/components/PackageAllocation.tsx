import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Button, C, Search, Select, Sheet, s } from './ui';
import { useApp } from '../lib/context';
import { errorMessage, money, quantity } from '../lib/format';
import { pendingMutation, submitMutation, type Pending } from '../lib/mutations';
import { packageLabel, packageQuantity } from '../lib/packagePrices';
import { searchText } from '../lib/pos';
import { d } from './OrderDetailLayout';

export function PackageAllocation({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const a = useApp();
  const sale = a.data.packageSales.find((x) => x.id === saleId)!;
  const lines = a.data.packageLines.filter((l) => l.sale_id === saleId);
  const [lineId, setLineId] = useState(lines[0]?.id || ''),
    [search, setSearch] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      a.data.packageAllocations
        .filter((x) => lines.some((l) => l.id === x.line_id))
        .map((x) => [`${x.line_id}:${x.product_id}`, String(x.quantity)]),
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [pending, setPending] = useState<Pending | null>(null);
  const key = useRef(Crypto.randomUUID()),
    posting = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void pendingMutation(a.userId)
      .then((p) => {
        if (live) {
          setPending(p);
          setReady(true);
        }
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [a.userId]);
  const foreignPending =
    !!pending && (pending.name !== 'allocate_pos_packages' || pending.payload.sale_id !== saleId);
  const readOnly = sale.status === 'complete';
  const totals = lines.map((l) => ({
    ...l,
    assigned: Object.entries(counts)
      .filter(([k]) => k.startsWith(l.id + ':'))
      .reduce((n, [, v]) => n + packageQuantity(v), 0),
  }));
  const invalid =
    totals.some((l) => !Number.isFinite(l.assigned) || l.assigned > l.quantity + 1e-7) ||
    Object.entries(counts).some(([k, v]) => {
      const l = lines.find((l) => k.startsWith(l.id + ':'));
      const n = packageQuantity(v);
      return (
        !l ||
        !Number.isFinite(n) ||
        n < 0 ||
        (n > 0 &&
          !readOnly &&
          !a.data.products.some((p) => p.id === k.split(':')[1] && p.is_active)) ||
        Math.abs(n * l.pieces_per_package - Math.round(n * l.pieces_per_package)) > 1e-7
      );
    });
  const products = a.data.products.filter(
    (p) =>
      (p.is_active || `${lineId}:${p.id}` in counts) &&
      searchText(`${p.name} ${p.sku}`).includes(searchText(search)),
  );
  async function save() {
    if (!ready || posting.current || foreignPending || (!pending && (invalid || readOnly))) return;
    posting.current = true;
    setBusy(true);
    setError('');
    try {
      await submitMutation(
        'allocate_pos_packages',
        pending?.payload || {
          sale_id: saleId,
          version: sale.version,
          lines: Object.entries(counts)
            .filter(([, v]) => packageQuantity(v) > 0)
            .map(([k, v]) => {
              const [line_id, product_id] = k.split(':');
              return { line_id, product_id, quantity: packageQuantity(v) };
            }),
        },
        pending?.key || key.current,
      );
      setPending(null);
      await a.refresh();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setPending(await pendingMutation(a.userId));
    } finally {
      posting.current = false;
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={readOnly ? 'Chi tiết bánh đã điền' : 'Điền loại bánh sau bán'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={{ padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View style={s.between}>
          <Text style={d.name}>
            {a.data.customers.find((c) => c.id === sale.customer_id)?.name}
          </Text>
          <Text style={d.meta}>
            {money(lines.reduce((n, l) => n + l.quantity * l.unit_price, 0))} đã chốt
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {totals.map((l) => (
            <Text key={l.id} style={[d.meta, l.assigned > l.quantity && { color: C.red }]}>
              {packageLabel(l.package_unit)}:{' '}
              {Number.isFinite(l.assigned) ? quantity(l.assigned) : '—'}/{quantity(l.quantity)} đã
              điền
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Search value={search} onChange={setSearch} placeholder="Tìm bánh để điền…" />
          </View>
          {lines.length > 1 && (
            <View style={{ width: 96 }}>
              <Select
                compact
                label="Đang điền cho"
                value={lineId}
                onChange={setLineId}
                options={lines.map((l) => ({ value: l.id, label: packageLabel(l.package_unit) }))}
                disabled={busy || !!pending}
              />
            </View>
          )}
        </View>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 4 }}
      >
        {products
          .filter((p) => !readOnly || packageQuantity(counts[`${lineId}:${p.id}`] || '') > 0)
          .map((p) => (
            <View
              key={p.id}
              style={[
                s.between,
                { paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.line },
              ]}
            >
              <Text style={[s.text, { flex: 1 }]}>
                {p.name}
                {!p.is_active ? ' · Ngừng bán' : ''}
              </Text>
              <TextInput
                accessibilityLabel={`Phân bổ ${p.name}`}
                keyboardType="decimal-pad"
                selectTextOnFocus
                editable={ready && !busy && !pending && !readOnly}
                value={counts[`${lineId}:${p.id}`] || ''}
                placeholder="0"
                style={[
                  s.input,
                  { width: 76, minHeight: 40, paddingVertical: 6, textAlign: 'center' },
                ]}
                onChangeText={(v) => setCounts((old) => ({ ...old, [`${lineId}:${p.id}`]: v }))}
              />
              <Text style={s.muted}>
                {packageLabel(lines.find((l) => l.id === lineId)?.package_unit || 'bi')}
              </Text>
            </View>
          ))}
      </ScrollView>
      <View style={{ padding: 16, gap: 8 }}>
        {foreignPending && (
          <Text style={{ color: C.red }}>
            Có yêu cầu khác đang chờ xác nhận. Quay lại POS để thử lại yêu cầu đó trước.
          </Text>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: C.red }}>
            {error}
          </Text>
        )}
        {invalid && (
          <Text style={{ color: C.red }}>
            Số lượng phải đủ số cái, không vượt số bì/hộp đã bán và chỉ gồm bánh đang bán.
          </Text>
        )}
        {!readOnly && (
          <Button
            title={busy ? 'Đang lưu…' : pending ? 'Thử lại lưu chi tiết' : 'Lưu chi tiết bánh'}
            disabled={!ready || busy || a.busy || foreignPending || (!pending && invalid)}
            onPress={() => void save()}
          />
        )}
      </View>
    </Sheet>
  );
}
