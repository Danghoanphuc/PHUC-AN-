import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Button, Card, C, Empty, Icon, Search, Tag, s } from '../components/ui';
import { useApp, managerRole } from '../lib/context';
import { money, quantity, shortId, today, validDate } from '../lib/format';
import { submitMutation } from '../lib/mutations';
import { supabase } from '../lib/supabase';
import { CustomerPackagePrices } from '../components/CustomerPackagePrices';
import { defaultCustomerRoute } from '../lib/customerRoute';
export function Customers() {
  const a = useApp(),
    [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const showArchived = managerRole(a.role) && archived;
  const customers = a.data.customers.filter(
    (c) =>
      c.is_active !== showArchived &&
      `${c.name} ${c.code ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );
  function create() {
    a.openForm({
      title: 'Thêm khách hàng',
      fields: [
        { name: 'name', label: 'Tên khách hàng', required: true },
        { name: 'phone', label: 'Số điện thoại' },
        { name: 'address', label: 'Địa chỉ giao', multiline: true },
        {
          name: 'type',
          label: 'Loại khách',
          value: 'Đại lý',
          options: ['Đại lý', 'Bạn hàng', 'Khách lẻ'].map((t) => ({ value: t, label: t })),
        },
        {
          name: 'route',
          label: 'Tuyến',
          required: true,
          value: defaultCustomerRoute(a.data.routes),
          options: a.data.routes
            .filter((r) => r.is_active)
            .map((r) => ({ value: r.id, label: r.name })),
        },
      ],
      submit: async (v) => {
        const { error } = await supabase.from('customers').insert({
          name: v.name ?? '',
          phone: v.phone || null,
          address: v.address || null,
          customer_type: v.type,
          route_id: v.route || defaultCustomerRoute(a.data.routes) || null,
        });
        if (error) throw error;
      },
    });
  }
  return (
    <View style={s.page}>
      <View style={s.between}>
        <View>
          <Text style={s.label}>KẾT NỐI VÀ CHĂM SÓC</Text>
          <Text style={s.title}>Khách hàng</Text>
        </View>
        {managerRole(a.role) && (
          <Pressable accessibilityLabel="Thêm khách hàng" onPress={create} style={s.avatar}>
            <Icon name="person-add-outline" />
          </Pressable>
        )}
      </View>
      <Search value={search} onChange={setSearch} placeholder="Tìm tên, mã hoặc số điện thoại…" />
      {managerRole(a.role) && (
        <View style={[s.row, { gap: 8 }]}>
          {[false, true].map((value) => (
            <Pressable
              key={String(value)}
              accessibilityRole="button"
              accessibilityLabel={value ? 'Khách đã xóa' : 'Khách đang dùng'}
              accessibilityState={{ selected: showArchived === value }}
              onPress={() => setArchived(value)}
              style={{
                minHeight: 36,
                paddingHorizontal: 12,
                justifyContent: 'center',
                borderRadius: 9,
                backgroundColor: showArchived === value ? C.green : C.soft,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: showArchived === value ? C.paper : C.green,
                }}
              >
                {value ? 'Đã xóa' : 'Đang dùng'} ·{' '}
                {a.data.customers.filter((c) => c.is_active !== value).length}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={s.muted}>{customers.length} khách trong phạm vi của bạn</Text>
      {customers.map((c) => (
        <Card key={c.id} onPress={() => a.openDetail({ kind: 'customer', id: c.id })}>
          <View style={s.row}>
            <View style={s.avatar}>
              <Text style={s.h3}>{c.name.trim().slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.h3}>{c.name}</Text>
              <Text style={s.muted}>
                {c.customer_type ?? 'Chưa phân loại'} ·{' '}
                {a.data.routes.find((r) => r.id === c.route_id)?.name ?? 'Chưa có tuyến'}
              </Text>
            </View>
            <Icon name="chevron-forward-outline" size={18} />
          </View>
          <View style={s.between}>
            <Text style={s.muted}>{c.phone ?? 'Chưa cập nhật số điện thoại'}</Text>
            <Text style={s.text}>
              {money(
                a.data.receivables
                  .filter((r) => r.customer_id === c.id)
                  .reduce((v, r) => v + r.amount - r.paid_amount, 0),
              )}{' '}
              nợ
            </Text>
          </View>
        </Card>
      ))}
      {!customers.length && (
        <Empty
          title="Chưa có khách phù hợp"
          body="Nhân viên chỉ thấy khách và tuyến được phân công."
          icon="people-outline"
        />
      )}
    </View>
  );
}
export function CustomerDetail({ id }: { id: string }) {
  const a = useApp(),
    c = a.data.customers.find((c) => c.id === id);
  if (!c) return <Empty title="Khách ngoài phạm vi truy cập" />;
  const debt = a.data.receivables
    .filter((r) => r.customer_id === id)
    .reduce((v, r) => v + r.amount - r.paid_amount, 0);
  const openOrders = a.data.orders.filter(
    (o) => o.customer_id === id && ['draft', 'confirmed', 'partial'].includes(o.status),
  ).length;
  const pendingBakes = a.data.packageSales.filter(
    (p) => p.customer_id === id && p.status !== 'complete',
  ).length;
  const archiveBlockers = [
    debt > 0 ? 'Còn công nợ ' + money(debt) : '',
    openOrders ? openOrders + ' đơn chưa xử lý xong' : '',
    pendingBakes ? pendingBakes + ' đơn POS chưa điền đủ bánh' : '',
  ].filter(Boolean);
  function changeActive() {
    const restoring = !c!.is_active;
    a.openForm({
      title: restoring ? 'Khôi phục khách' : 'Xóa khách',
      description: restoring
        ? 'Đưa ' + c!.name + ' trở lại danh sách bán hàng, dùng lại hồ sơ và giá riêng đã lưu.'
        : 'Ẩn ' +
          c!.name +
          ' khỏi danh sách bán hàng. Giữ nguyên lịch sử, chứng từ và giá riêng; có thể khôi phục tại mục Đã xóa.',
      fields: [
        {
          name: 'reason',
          label: restoring ? 'Lý do khôi phục' : 'Lý do xóa',
          required: true,
          value: restoring ? 'Khôi phục khách' : '',
          multiline: true,
        },
      ],
      submitLabel: restoring ? 'Khôi phục khách' : 'Xác nhận xóa khách',
      danger: !restoring,
      submit: async (v, key) => {
        await submitMutation(
          'set_customer_active',
          {
            customer_id: id,
            is_active: restoring,
            expected_is_active: c!.is_active,
            reason: (v.reason || '').trim(),
          },
          key,
        );
      },
    });
  }
  function activity() {
    a.openForm({
      title: 'Ghi chăm sóc khách',
      fields: [
        {
          name: 'kind',
          label: 'Loại tương tác',
          value: 'call',
          options: [
            { value: 'call', label: 'Cuộc gọi' },
            { value: 'visit', label: 'Ghé thăm' },
            { value: 'note', label: 'Ghi chú' },
          ],
        },
        { name: 'body', label: 'Nội dung', required: true, multiline: true },
      ],
      submit: async (v) => {
        const { error } = await supabase.from('customer_activities').insert({
          customer_id: id,
          kind: v.kind ?? 'note',
          body: v.body ?? '',
          created_by: a.userId,
        });
        if (error) throw error;
      },
    });
  }
  function task() {
    a.openForm({
      title: 'Hẹn việc tiếp theo',
      fields: [
        { name: 'title', label: 'Việc cần làm', required: true },
        { name: 'date', label: 'Ngày hẹn · YYYY-MM-DD', value: today(), required: true },
      ],
      submit: async (v) => {
        const date = validDate(v.date ?? '');
        const { error } = await supabase.from('customer_tasks').insert({
          customer_id: id,
          assigned_to: a.userId,
          title: v.title ?? '',
          due_at: `${date}T09:00:00+07:00`,
          created_by: a.userId,
        });
        if (error) throw error;
      },
    });
  }
  function edit() {
    a.openForm({
      title: 'Sửa hồ sơ khách',
      fields: [
        { name: 'name', label: 'Tên khách', value: c!.name, required: true },
        { name: 'phone', label: 'Số điện thoại', value: c!.phone ?? '' },
        { name: 'address', label: 'Địa chỉ', value: c!.address ?? '', multiline: true },
        {
          name: 'type',
          label: 'Loại khách',
          value: c!.customer_type ?? 'Đại lý',
          options: ['Đại lý', 'Bạn hàng', 'Khách lẻ'].map((t) => ({ value: t, label: t })),
        },
        {
          name: 'route',
          label: 'Tuyến',
          value: c!.route_id ?? '',
          options: a.data.routes
            .filter((r) => r.is_active || r.id === c!.route_id)
            .map((r) => ({ value: r.id, label: r.name + (r.is_active ? '' : ' · Ngừng dùng') })),
        },
        {
          name: 'policy',
          label: 'Chính sách công nợ',
          value: c!.credit_policy,
          options: [
            { value: 'review', label: 'Quản lý duyệt từng lần' },
            { value: 'limited', label: 'Có hạn mức' },
            { value: 'unlimited', label: 'Không giới hạn (đã duyệt)' },
          ],
        },
        {
          name: 'limit',
          label: 'Hạn mức (đ)',
          value: c!.credit_limit?.toString() ?? '',
          numeric: true,
        },
        {
          name: 'terms',
          label: 'Số ngày thanh toán',
          value: String(c!.payment_terms_days),
          numeric: true,
        },
      ],
      submit: async (v) => {
        const { error } = await supabase
          .from('customers')
          .update({
            name: v.name,
            phone: v.phone || null,
            address: v.address || null,
            customer_type: v.type,
            route_id: v.route || null,
            credit_policy: v.policy,
            credit_limit: v.limit ? Number(v.limit) : null,
            payment_terms_days: Number(v.terms),
          })
          .eq('id', id);
        if (error) throw error;
      },
    });
  }
  return (
    <View style={s.page}>
      <View style={s.between}>
        <Text style={s.label}>HỒ SƠ KHÁCH HÀNG</Text>
        {managerRole(a.role) && (
          <View style={[s.row, { gap: 12 }]}>
            {c.is_active && (
              <Pressable accessibilityLabel="Sửa hồ sơ" onPress={edit}>
                <Icon name="create-outline" />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={c.is_active ? 'Xóa khách' : 'Khôi phục khách'}
              disabled={a.busy || (c.is_active && archiveBlockers.length > 0)}
              onPress={changeActive}
              style={{
                minHeight: 36,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                opacity: a.busy || (c.is_active && archiveBlockers.length > 0) ? 0.45 : 1,
              }}
            >
              <Icon
                name={c.is_active ? 'trash-outline' : 'refresh-outline'}
                size={17}
                color={c.is_active ? C.red : C.green}
              />
              <Text
                style={{ fontSize: 12, fontWeight: '600', color: c.is_active ? C.red : C.green }}
              >
                {c.is_active ? 'Xóa khách' : 'Khôi phục'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
      <Text style={s.title}>{c.name}</Text>
      {managerRole(a.role) && c.is_active && archiveBlockers.length > 0 && (
        <Text style={[s.muted, { color: C.orange }]}>
          Chưa thể xóa: {archiveBlockers.join(' · ')}. Hoàn tất các việc này trước.
        </Text>
      )}
      {!c.is_active && (
        <Text style={[s.text, { color: C.orange }]}>
          Khách đã xóa khỏi danh sách bán hàng. Lịch sử và giá riêng được giữ nguyên.
        </Text>
      )}
      <Text style={s.muted}>
        {c.customer_type ?? 'Chưa phân loại'} ·{' '}
        {a.data.routes.find((r) => r.id === c.route_id)?.name ?? 'Chưa có tuyến'}
      </Text>
      <CustomerPackagePrices customerId={id} disabled={!c.is_active} />
      <Card>
        <Text style={s.text}>{c.phone ?? 'Chưa cập nhật điện thoại'}</Text>
        <Text style={s.muted}>{c.address || 'Chưa cập nhật địa chỉ'}</Text>
        {c.phone && (
          <Button
            title="Gọi khách hàng"
            secondary
            icon="call-outline"
            onPress={() => void a.run(() => Linking.openURL(`tel:${c.phone}`))}
          />
        )}
      </Card>
      <View style={s.row}>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.muted}>Công nợ còn</Text>
          <Text style={s.h2}>{money(debt)}</Text>
        </View>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.muted}>Chiết khấu</Text>
          <Text style={s.h2}>{quantity(c.default_discount_pct)}%</Text>
        </View>
      </View>
      <Button
        title="Tạo đơn cho khách"
        disabled={!c.is_active}
        icon="add-outline"
        onPress={() => a.editOrder(undefined, id)}
      />
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Button title="Ghi chăm sóc" disabled={!c.is_active} secondary onPress={activity} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Hẹn việc" disabled={!c.is_active} secondary onPress={task} />
        </View>
      </View>
      <Text style={s.h2}>Việc cần theo dõi</Text>
      {a.data.tasks
        .filter((t) => t.customer_id === id && t.status === 'open')
        .map((t) => (
          <Card key={t.id}>
            <View style={s.between}>
              <Text style={[s.h3, { flex: 1 }]}>{t.title}</Text>
              {(managerRole(a.role) || t.assigned_to === a.userId) && (
                <Pressable
                  accessibilityLabel={`Hoàn thành ${t.title}`}
                  onPress={() =>
                    void a.run(async () => {
                      const { error } = await supabase
                        .from('customer_tasks')
                        .update({ status: 'done' })
                        .eq('id', t.id);
                      if (error) throw error;
                    }, 'Đã hoàn thành công việc')
                  }
                >
                  <Icon name="checkmark-circle-outline" size={25} />
                </Pressable>
              )}
            </View>
            <Text style={s.muted}>
              {new Date(t.due_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
            </Text>
          </Card>
        ))}
      <Text style={s.h2}>Lịch sử chăm sóc</Text>
      {a.data.activities
        .filter((x) => x.customer_id === id)
        .sort((x, y) => y.occurred_at.localeCompare(x.occurred_at))
        .map((x) => (
          <Card key={x.id}>
            <View style={s.between}>
              <Tag value={x.kind} />
              <Text style={s.muted}>
                {new Date(x.occurred_at).toLocaleDateString('vi-VN', {
                  timeZone: 'Asia/Ho_Chi_Minh',
                })}
              </Text>
            </View>
            <Text style={s.text}>{x.body}</Text>
          </Card>
        ))}
      {!a.data.activities.some((x) => x.customer_id === id) && (
        <Text style={s.muted}>Chưa có lịch sử chăm sóc. Ghi lại tương tác đầu tiên với khách.</Text>
      )}
      <Text style={s.h2}>Đơn của khách</Text>
      {a.data.orders
        .filter((o) => o.customer_id === id)
        .map((o) => (
          <Card key={o.id} onPress={() => a.openDetail({ kind: 'order', id: o.id })}>
            <View style={s.between}>
              <Text style={s.h3}>#{shortId(o.id)}</Text>
              <Tag value={o.status} />
            </View>
            <Text style={s.muted}>Ngày giao {o.delivery_date}</Text>
          </Card>
        ))}
    </View>
  );
}
