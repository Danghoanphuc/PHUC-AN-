import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, Card, C, Empty, s } from '../components/ui';
import { PackageAllocation } from '../components/PackageAllocation';
import { packageLabel } from '../lib/packagePrices';
import { useApp } from '../lib/context';
import { dateLabel, decimal, errorMessage, money, quantity, shortId } from '../lib/format';
import { supabase, readRows, type Row } from '../lib/supabase';
import { submitMutation } from '../lib/mutations';
import { searchText } from '../lib/pos';

type Sale = {
  id: string;
  sale_date: string;
  created_at: string;
  customer_name: string | null;
  net_amount: number;
  collected_amount: number;
  note: string | null;
  items: { name: string; pieces: number; amount: number }[] | null;
};
type Summary = { balance: number; sales: Sale[] };
export function MySales() {
  const a = useApp();
  const [allocation, setAllocation] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null),
    [reports, setReports] = useState<Row<'pos_cash_closes'>[]>([]),
    [error, setError] = useState(''),
    [search, setSearch] = useState('');
  useEffect(() => {
    let live = true;
    void Promise.all([supabase.rpc('pos_summary'), readRows('pos_cash_closes')])
      .then(([r, closes]) => {
        if (r.error) throw r.error;
        if (live) {
          setSummary(r.data as unknown as Summary);
          setReports(closes);
          setError('');
        }
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [a.userId, a.data]);
  const pending = reports.some((r) => r.user_id === a.userId && r.status === 'pending');
  function close() {
    if (!summary) return;
    a.openForm({
      title: 'Chốt tiền đang giữ',
      description: `Sổ ghi còn ${money(summary.balance)}. Nhập toàn bộ tiền POS thực đếm, gồm cả số còn từ ca trước. Tiền chỉ được chuyển sổ khi quản lý xác nhận nhận.`,
      fields: [
        { name: 'counted', label: 'Tiền thực đếm (đồng)', numeric: true, required: true },
        { name: 'note', label: 'Ghi chú chênh lệch / bàn giao', multiline: true },
      ],
      submitLabel: 'Gửi phiếu chốt',
      submit: async (v, key) => {
        const amount = decimal(v.counted || '', 'Tiền thực đếm', true);
        if (!Number.isSafeInteger(amount) || amount < 0)
          throw Error('Nhập số tiền đồng nguyên, không âm.');
        await submitMutation(
          'submit_pos_close',
          { expected_amount: summary.balance, counted_amount: amount, note: v.note || '' },
          key,
        );
      },
    });
  }
  function review(r: Row<'pos_cash_closes'>, receive: boolean) {
    const accounts = a.data.accounts.filter(
      (c) => c.is_active && c.account_type === 'cash' && !c.code.startsWith('POS-'),
    );
    a.openForm({
      title: receive ? 'Xác nhận đã nhận tiền' : 'Yêu cầu đếm lại',
      description: `Phiếu ${shortId(r.id)} · thực đếm ${money(r.counted_amount)} · chênh ${money(r.counted_amount - r.expected_amount)}. ${receive ? 'Chỉ xác nhận sau khi đã kiểm đếm và nhận đúng số tiền này.' : ''}`,
      fields: [
        ...(receive
          ? [
              {
                name: 'destination',
                label: 'Quỹ nhận tiền',
                required: true,
                options: accounts.map((c) => ({ value: c.id, label: c.name })),
              },
            ]
          : []),
        { name: 'note', label: 'Ghi chú xử lý', required: !receive, multiline: true },
      ],
      submitLabel: receive ? 'Đã nhận đủ tiền' : 'Gửi yêu cầu đếm lại',
      submit: async (v, key) => {
        await submitMutation(
          'review_pos_close',
          {
            close_id: r.id,
            action: receive ? 'received' : 'rejected',
            ...(receive ? { destination_id: v.destination } : {}),
            note: v.note || '',
          },
          key,
        );
      },
    });
  }
  const sales =
    summary?.sales.filter((x) =>
      searchText(
        `${x.customer_name || ''} ${x.note || ''} ${shortId(x.id)} ${x.sale_date}`,
      ).includes(searchText(search)),
    ) || [];
  return (
    <View style={s.page}>
      <Text style={s.title}>Bán hàng của tôi</Text>
      <Text style={s.muted}>
        200 lần bán gần nhất của bạn · tìm theo khách, mã, ghi chú hoặc ngày YYYY-MM-DD.
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: C.red }}>
          {error}
        </Text>
      )}
      <Button title="Tải lại đối soát" secondary onPress={() => void a.run(a.refresh)} />
      {summary && (
        <Card>
          <Text style={s.label}>Tiền POS còn trên sổ</Text>
          <Text style={s.title}>{money(summary.balance)}</Text>
          <Text style={s.muted}>
            Số dư cộng dồn sau bán hàng, hoàn tiền và bàn giao. Chênh lệch cần quản lý đối chiếu,
            không tự xóa.
          </Text>
          <Button
            title={pending ? 'Đang chờ quản lý nhận tiền' : 'Chốt tiền / bàn giao'}
            disabled={pending || a.busy || !!error}
            onPress={close}
          />
        </Card>
      )}
      <Text style={s.h2}>Phiếu bàn giao</Text>
      {reports.length === 0 && <Text style={s.muted}>Chưa có phiếu bàn giao.</Text>}
      {[...reports]
        .sort((x, y) => y.created_at.localeCompare(x.created_at))
        .map((r) => (
          <Card key={r.id}>
            <Text style={s.h3}>
              {r.user_id === a.userId
                ? 'Bạn'
                : a.data.profiles.find((p) => p.user_id === r.user_id)?.full_name ||
                  shortId(r.user_id)}{' '}
              · {dateLabel(r.business_date)}
            </Text>
            <Text style={s.text}>
              Thực đếm {money(r.counted_amount)} · Sổ {money(r.expected_amount)}
            </Text>
            <Text style={{ color: r.counted_amount === r.expected_amount ? C.green : C.red }}>
              Chênh lệch {money(r.counted_amount - r.expected_amount)}
            </Text>
            <Text style={s.muted}>
              {r.status === 'pending'
                ? 'Chờ nhận tiền'
                : r.status === 'received'
                  ? 'Đã nhận tiền'
                  : 'Cần đếm lại'}
              {r.note ? ` · ${r.note}` : ''}
            </Text>
            {!!r.review_note && <Text style={s.text}>Quản lý: {r.review_note}</Text>}
            {r.status === 'pending' && a.role !== 'staff' && (
              <>
                <Button title="Nhận tiền" onPress={() => review(r, true)} />
                <Button title="Yêu cầu đếm lại" secondary onPress={() => review(r, false)} />
              </>
            )}
          </Card>
        ))}
      <Text style={s.h2}>Lịch sử bán hàng</Text>
      <TextInput
        accessibilityLabel="Tìm lịch sử bán"
        placeholder="Khách, mã, ghi chú, ngày…"
        style={s.input}
        value={search}
        onChangeText={setSearch}
      />
      {summary && sales.length === 0 && <Empty title="Chưa có lần bán phù hợp" />}
      {sales.map((x) => (
        <Card key={x.id}>
          <Text style={s.h3}>
            {x.customer_name || 'Khách hàng'} · {money(x.net_amount)}
          </Text>
          <Text style={s.muted}>
            {dateLabel(x.sale_date)} · #{shortId(x.id)} · Đã thu {money(x.collected_amount)}
          </Text>
          {x.items?.map((i, index) => (
            <Text key={index} style={s.text}>
              {i.name} · {quantity(i.pieces)} cái · {money(i.amount)}
            </Text>
          ))}
          {!!x.note && <Text style={s.text}>Ghi chú: {x.note}</Text>}
          {a.data.packageSales.some((p) => p.id === x.id) && (
            <>
              <Text style={s.text}>
                {a.data.packageLines
                  .filter((l) => l.sale_id === x.id)
                  .map((l) => `${quantity(l.quantity)} ${packageLabel(l.package_unit)}`)
                  .join(' · ')}
              </Text>
              <Button
                title={
                  a.data.packageSales.find((p) => p.id === x.id)?.status === 'complete'
                    ? 'Xem loại bánh đã điền'
                    : 'Điền loại bánh'
                }
                secondary
                onPress={() => setAllocation(x.id)}
              />
            </>
          )}
          {a.data.sales.some((sale) => sale.id === x.id) && (
            <Button
              title={a.role === 'staff' ? 'Chi tiết bán hàng' : 'Chi tiết / trả hàng'}
              secondary
              onPress={() => a.openDetail({ kind: 'sale', id: x.id })}
            />
          )}
        </Card>
      ))}
      {!!allocation && <PackageAllocation saleId={allocation} onClose={() => setAllocation('')} />}
    </View>
  );
}
