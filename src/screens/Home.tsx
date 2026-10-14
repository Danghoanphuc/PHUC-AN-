import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, C, Empty, Icon, Tag, s } from '../components/ui';
import { useApp, managerRole } from '../lib/context';
import { dateLabel, money, shortId, today } from '../lib/format';
import { supabase } from '../lib/supabase';
export function Home() {
  const a = useApp(),
    day = today(),
    manager = managerRole(a.role);
  const deliveries = a.data.orders.filter(
      (o) => o.delivery_date === day && !['completed', 'cancelled'].includes(o.status),
    ),
    tasks = a.data.tasks.filter((t) => t.status === 'open' && t.assigned_to === a.userId),
    revenue = a.data.sales
      .filter((s) => s.sale_date === day)
      .reduce((v, s) => v + (s.net_amount ?? 0), 0),
    debt = a.data.receivables.reduce((v, r) => v + r.amount - r.paid_amount, 0);
  return (
    <View style={s.page}>
      <View style={s.between}>
        <View>
          <Text style={[s.label, { color: C.orange }]}>PHÚC AN · {dateLabel(day)}</Text>
          <Text style={s.title}>Chào ngày mới.</Text>
        </View>
        <Pressable
          accessibilityLabel="Tài khoản của tôi"
          onPress={() => a.go('more')}
          style={[s.avatar, { backgroundColor: C.green }]}
        >
          <Icon name="person-outline" color="white" />
        </Pressable>
      </View>
      <View
        style={[s.card, { backgroundColor: C.green, borderColor: C.green, padding: 24, gap: 20 }]}
      >
        <View style={s.between}>
          <View style={{ flex: 1 }}>
            <Text style={[s.muted, { color: '#CBD8C9' }]}>
              {manager ? 'DOANH THU HÔM NAY' : 'GIAO HÀNG HÔM NAY'}
            </Text>
            <Text
              style={{
                fontSize: 36,
                fontWeight: '700',
                color: 'white',
                letterSpacing: -1,
                marginTop: 5,
              }}
            >
              {manager ? money(revenue) : `${deliveries.length} đơn`}
            </Text>
          </View>
          <View style={{ backgroundColor: '#3D6652', borderRadius: 18, padding: 14 }}>
            <Icon
              name={manager ? 'trending-up-outline' : 'bicycle-outline'}
              color="#DBE7C8"
              size={29}
            />
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: '#42634F' }} />
        <View style={s.between}>
          <Text style={{ color: '#DAE4D6', fontSize: 13 }}>
            Công việc của bạn · {tasks.length} việc đang mở
          </Text>
          <Icon name="sunny-outline" color="#DDB073" size={20} />
        </View>
      </View>
      <View style={s.row}>
        {[
          { title: 'Cần giao', value: String(deliveries.length), icon: 'bicycle-outline' as const },
          {
            title: manager ? 'Công nợ còn' : 'Khách phụ trách',
            value: manager ? money(debt) : String(a.data.customers.length),
            icon: manager ? ('wallet-outline' as const) : ('people-outline' as const),
          },
        ].map((m) => (
          <View key={m.title} style={[s.card, { flex: 1, padding: 16, gap: 8 }]}>
            <Icon name={m.icon} size={21} />
            <Text style={s.muted}>{m.title}</Text>
            <Text style={[s.h2, { fontSize: 20 }]}>{m.value}</Text>
          </View>
        ))}
      </View>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Button title="Tạo đơn khách" icon="add-outline" onPress={() => a.editOrder()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Chăm sóc khách"
            secondary
            icon="people-outline"
            onPress={() => a.go('customers')}
          />
        </View>
      </View>
      <View style={s.between}>
        <Text style={s.h2}>Lịch giao hôm nay</Text>
        <Pressable onPress={() => a.go('orders')}>
          <Text style={[s.muted, { color: C.green, fontWeight: '600' }]}>Xem tất cả →</Text>
        </Pressable>
      </View>
      {deliveries.slice(0, 5).map((o) => (
        <Card key={o.id} onPress={() => a.openDetail({ kind: 'order', id: o.id })}>
          <View style={s.between}>
            <View style={{ flex: 1 }}>
              <Text style={s.h3}>{a.data.customers.find((c) => c.id === o.customer_id)?.name}</Text>
              <Text style={s.muted}>
                #{shortId(o.id)} ·{' '}
                {a.data.routes.find((r) => r.id === o.route_id)?.name ?? 'Chưa có tuyến'}
              </Text>
            </View>
            <Tag value={o.status} />
          </View>
        </Card>
      ))}
      {!deliveries.length && (
        <Card>
          <Empty
            title="Hôm nay chưa có lịch giao"
            body="Các đơn cần xử lý sẽ xuất hiện ở đây."
            icon="calendar-outline"
          />
        </Card>
      )}
      <Text style={s.h2}>Chăm sóc cần theo dõi</Text>
      {tasks.slice(0, 5).map((t) => (
        <Card key={t.id}>
          <View style={s.between}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.h3}>{t.title}</Text>
              <Text style={s.muted}>
                {a.data.customers.find((c) => c.id === t.customer_id)?.name} ·{' '}
                {new Date(t.due_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
              </Text>
            </View>
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
              <Icon name="checkmark-circle-outline" size={26} />
            </Pressable>
          </View>
        </Card>
      ))}
      {!tasks.length && (
        <Text style={s.muted}>Chưa có việc được giao. Đặt lịch chăm sóc từ hồ sơ khách hàng.</Text>
      )}
    </View>
  );
}
