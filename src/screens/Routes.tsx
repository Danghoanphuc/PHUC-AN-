import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Button, C, Empty, Icon, Search, Sheet, s } from '../components/ui';
import { managerRole, useApp } from '../lib/context';
import { submitMutation } from '../lib/mutations';
import { searchText } from '../lib/pos';
import type { Row } from '../lib/supabase';

export function Routes({ onClose }: { onClose: () => void }) {
  const a = useApp(),
    manager = managerRole(a.role);
  const [search, setSearch] = useState(''),
    [inactive, setInactive] = useState(false);
  const [assigning, setAssigning] = useState<Row<'routes'> | null>(null);
  const [selected, setSelected] = useState<string[]>([]),
    [requestKey, setRequestKey] = useState('');
  const routes = a.data.routes
    .filter(
      (r) =>
        (manager ||
          a.data.assignments.some((x) => x.route_id === r.id && x.user_id === a.userId)) &&
        r.is_active !== (manager && inactive) &&
        searchText(r.name).includes(searchText(search)),
    )
    .sort((x, y) => x.name.localeCompare(y.name, 'vi'));
  function edit(route?: Row<'routes'>) {
    a.openForm({
      title: route ? 'Sửa tuyến bán hàng' : 'Thêm tuyến bán hàng',
      fields: [
        { name: 'name', label: 'Tên tuyến', required: true, value: route?.name || '' },
        { name: 'note', label: 'Ghi chú tuyến', multiline: true, value: route?.note || '' },
      ],
      submitLabel: 'Lưu tuyến',
      submit: async (v, key) => {
        await submitMutation(
          'save_sales_route',
          {
            ...(route ? { route_id: route.id, expected_version: route.version } : {}),
            name: (v.name || '').trim(),
            note: v.note || '',
          },
          key,
        );
      },
    });
  }
  function toggle(route: Row<'routes'>) {
    a.openForm({
      title: route.is_active ? 'Ngừng dùng tuyến' : 'Khôi phục tuyến',
      description: route.is_active
        ? 'Ẩn tuyến khỏi lựa chọn cho khách mới. Khách, phân công và chứng từ cũ vẫn giữ nguyên; có thể khôi phục sau.'
        : 'Đưa tuyến trở lại danh sách lựa chọn, giữ phân công đã có.',
      fields: [],
      submitLabel: route.is_active ? 'Ngừng dùng tuyến' : 'Khôi phục tuyến',
      danger: route.is_active,
      submit: async (_, key) => {
        await submitMutation(
          'save_sales_route',
          {
            route_id: route.id,
            expected_version: route.version,
            name: route.name,
            note: route.note,
            is_active: !route.is_active,
          },
          key,
        );
      },
    });
  }
  function assign(route: Row<'routes'>) {
    setAssigning(route);
    setSelected(
      a.data.assignments
        .filter(
          (x) =>
            x.route_id === route.id &&
            a.data.members.some((m) => m.user_id === x.user_id && m.role === 'staff' && m.active),
        )
        .map((x) => x.user_id),
    );
    setRequestKey(Crypto.randomUUID());
  }
  return (
    <View style={{ padding: 14, gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lại mục Thêm"
        onPress={onClose}
        style={[s.row, { minHeight: 32 }]}
      >
        <Icon name="arrow-back-outline" size={18} />
        <Text style={s.muted}>Thêm</Text>
      </Pressable>
      <View style={s.between}>
        <Text style={s.h2}>{manager ? 'Tuyến bán hàng' : 'Tuyến được giao'}</Text>
        {manager && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thêm tuyến bán hàng"
            onPress={() => edit()}
            style={{ padding: 8 }}
          >
            <Icon name="add-outline" />
          </Pressable>
        )}
      </View>
      <Search value={search} onChange={setSearch} placeholder="Tìm tuyến…" />
      {manager ? (
        <View style={[s.row, { gap: 8 }]}>
          {[false, true].map((value) => (
            <Pressable
              key={String(value)}
              accessibilityRole="button"
              accessibilityLabel={value ? 'Tuyến ngừng dùng' : 'Tuyến đang dùng'}
              accessibilityState={{ selected: inactive === value }}
              onPress={() => setInactive(value)}
              style={{
                minHeight: 34,
                paddingHorizontal: 12,
                justifyContent: 'center',
                borderRadius: 8,
                backgroundColor: inactive === value ? C.green : C.soft,
              }}
            >
              <Text style={{ fontSize: 12, color: inactive === value ? C.paper : C.green }}>
                {value ? 'Ngừng dùng' : 'Đang dùng'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={s.muted}>
          Chỉ chọn được tuyến được phân công. Nhờ quản lý giao thêm tuyến khi cần.
        </Text>
      )}
      <Text style={s.muted}>{routes.length} tuyến · Chọn khi tạo khách mới.</Text>
      <View style={{ backgroundColor: C.paper, borderRadius: 12, overflow: 'hidden' }}>
        {routes.map((route, index) => {
          const users = a.data.assignments.filter((x) => x.route_id === route.id);
          return (
            <View
              key={route.id}
              style={{ padding: 12, gap: 6, borderTopWidth: index ? 1 : 0, borderTopColor: C.line }}
            >
              <View style={s.between}>
                <Text style={[s.h3, { flex: 1 }]}>{route.name}</Text>
                {manager && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Sửa tuyến ${route.name}`}
                    onPress={() => edit(route)}
                    style={{ padding: 6 }}
                  >
                    <Icon name="create-outline" size={18} />
                  </Pressable>
                )}
              </View>
              <Text style={s.muted}>
                {a.data.customers.filter((c) => c.route_id === route.id && c.is_active).length}{' '}
                khách đang dùng{manager ? ` · ${users.length} nhân viên` : ''}
              </Text>
              {manager && (
                <View style={[s.row, { gap: 18 }]}>
                  {route.is_active && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Phân công tuyến ${route.name}`}
                      onPress={() => assign(route)}
                      style={{ minHeight: 34, justifyContent: 'center' }}
                    >
                      <Text style={{ color: C.green, fontSize: 12, fontWeight: '600' }}>
                        Phân công
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${route.is_active ? 'Ngừng dùng' : 'Khôi phục'} tuyến ${route.name}`}
                    onPress={() => toggle(route)}
                    style={{ minHeight: 34, justifyContent: 'center' }}
                  >
                    <Text style={{ color: route.is_active ? C.red : C.green, fontSize: 12 }}>
                      {route.is_active ? 'Ngừng dùng' : 'Khôi phục'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </View>
      {!routes.length && (
        <Empty
          title="Chưa có tuyến phù hợp"
          body={
            manager
              ? 'Thêm tuyến mới hoặc kiểm tra mục Ngừng dùng.'
              : 'Nhờ chủ/quản lý phân công tuyến.'
          }
        />
      )}
      {assigning && (
        <Sheet
          title={`Phân công · ${assigning.name}`}
          onClose={() => {
            if (!a.busy) setAssigning(null);
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            <Text style={s.muted}>
              Tích để giao, bỏ tích để thu hồi tuyến. Quyền khách được giao trực tiếp vẫn giữ
              nguyên.
            </Text>
            {a.data.members
              .filter((m) => m.role === 'staff' && m.active)
              .map((member) => {
                const name =
                  a.data.profiles.find((p) => p.user_id === member.user_id)?.full_name ||
                  'Nhân viên';
                const checked = selected.includes(member.user_id);
                return (
                  <Pressable
                    key={member.user_id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Giao tuyến cho ${name}`}
                    accessibilityState={{ checked }}
                    disabled={a.busy}
                    onPress={() => {
                      setSelected((old) =>
                        checked
                          ? old.filter((id) => id !== member.user_id)
                          : [...old, member.user_id],
                      );
                      setRequestKey(Crypto.randomUUID());
                    }}
                    style={[s.between, { paddingVertical: 12 }]}
                  >
                    <Text style={s.text}>{name}</Text>
                    <Icon name={checked ? 'checkbox-outline' : 'square-outline'} size={22} />
                  </Pressable>
                );
              })}
            <Button
              title="Lưu phân công"
              disabled={a.busy}
              onPress={() =>
                void a.run(async () => {
                  await submitMutation(
                    'set_sales_route_staff',
                    {
                      route_id: assigning.id,
                      expected_version: assigning.version,
                      user_ids: selected,
                    },
                    requestKey,
                  );
                  setAssigning(null);
                }, 'Đã cập nhật phân công tuyến')
              }
            />
          </ScrollView>
        </Sheet>
      )}
    </View>
  );
}
