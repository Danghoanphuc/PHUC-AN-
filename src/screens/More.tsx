import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, C, Empty, Icon, Tag, s } from '../components/ui';
import { useApp, managerRole } from '../lib/context';
import { decimal, labels, money, quantity, shortId, today } from '../lib/format';
import { pendingMutation, submitMutation, type Pending } from '../lib/mutations';
import { supabase } from '../lib/supabase';
import { manageAccount } from '../lib/accounts';
function reviewText(kind: string, ref: string, raw: unknown) {
  const d = (raw ?? {}) as Record<string, unknown>;
  return kind === 'material_unit_review'
    ? [
        'Nguyên liệu ',
        String(d.material_code ?? ''),
        ': nhãn quy cách nhập ',
        String(d.package_unit ?? ''),
        ', đơn vị cơ sở ',
        String(d.base_unit ?? ''),
        '. Cần đối chiếu chứng từ trước khi dùng giá vốn.',
      ].join('')
    : [ref, ' → ', String(d.canonical_name ?? 'Chưa gắn sản phẩm')].join('');
}
export function More() {
  const a = useApp(),
    [page, setPage] = useState('menu'),
    [pending, setPending] = useState<Pending | null>(null);
  const manager = managerRole(a.role),
    profile = a.data.profiles.find((p) => p.user_id === a.userId);
  useEffect(() => {
    void pendingMutation(a.userId).then(setPending);
  }, [a.userId, a.data, a.role]);
  const accountOptions = a.data.accounts
    .filter((x) => x.is_active)
    .map((x) => ({ value: x.id, label: x.name }));
  function addSupplier() {
    a.openForm({
      title: 'Thêm nhà cung cấp',
      fields: [
        { name: 'name', label: 'Tên nhà cung cấp', required: true },
        { name: 'phone', label: 'Điện thoại' },
        { name: 'note', label: 'Ghi chú', multiline: true },
      ],
      submit: async (v) => {
        const { error } = await supabase
          .from('suppliers')
          .insert({ name: v.name ?? '', phone: v.phone || null, note: v.note || null });
        if (error) throw error;
      },
    });
  }
  function invite() {
    a.openForm({
      title: 'Cấp tài khoản nhân sự',
      description:
        'Cấp số điện thoại và mật khẩu ban đầu từ 12 ký tự. Người dùng đăng nhập ngay và có thể tự đổi mật khẩu.',
      fields: [
        { name: 'name', label: 'Họ tên', required: true },
        { name: 'phone', label: 'Số điện thoại', required: true },
        { name: 'password', label: 'Mật khẩu ban đầu', required: true, secure: true },
        { name: 'confirm', label: 'Nhập lại mật khẩu', required: true, secure: true },
        {
          name: 'role',
          label: 'Vai trò',
          value: 'staff',
          options: [
            { value: 'staff', label: 'Nhân viên' },
            { value: 'manager', label: 'Quản lý' },
          ],
        },
      ],
      submit: async (v, key) => {
        if ((v.password?.length ?? 0) < 12) throw Error('Cần tối thiểu 12 ký tự.');
        if (v.password !== v.confirm) throw Error('Hai mật khẩu chưa khớp.');
        await manageAccount({
          action: 'create',
          phone: v.phone,
          password: v.password,
          role: v.role,
          full_name: v.name,
          request_key: key,
        });
      },
    });
  }
  if (page !== 'menu')
    return (
      <View style={s.page}>
        <Pressable
          accessibilityLabel="Quay lại mục Thêm"
          onPress={() => setPage('menu')}
          style={s.row}
        >
          <Icon name="arrow-back-outline" />
          <Text style={s.muted}>Thêm</Text>
        </Pressable>
        <Text style={s.title}>
          {
            {
              debt: 'Công nợ',
              stock: 'Kho nguyên liệu',
              suppliers: 'Nhà cung cấp',
              team: 'Đội ngũ',
              cash: 'Sổ tiền',
              review: 'Cần đối chiếu',
            }[page]
          }
        </Text>
        {page === 'debt' && (
          <>
            <Text style={s.h2}>Khách còn phải thu</Text>
            {a.data.receivables
              .filter((r) => r.amount > r.paid_amount)
              .map((r) => (
                <Card
                  key={r.id}
                  onPress={() => r.sale_id && a.openDetail({ kind: 'sale', id: r.sale_id })}
                >
                  <View style={s.between}>
                    <Text style={s.h3}>
                      {a.data.customers.find((c) => c.id === r.customer_id)?.name}
                    </Text>
                    <Text style={s.h2}>{money(r.amount - r.paid_amount)}</Text>
                  </View>
                  <Text style={s.muted}>
                    Hạn {r.due_date ?? 'chưa có'}
                    {r.due_date && r.due_date < today() ? ' · Quá hạn' : ''}
                  </Text>
                </Card>
              ))}
            {!a.data.receivables.some((r) => r.amount > r.paid_amount) && (
              <Empty title="Chưa có công nợ khách" />
            )}
            {manager && (
              <>
                <Text style={s.h2}>Nhà cung cấp cần trả</Text>
                {a.data.payables
                  .filter((p) => p.amount > p.paid_amount)
                  .map((p) => (
                    <Card key={p.id}>
                      <Text style={s.h3}>
                        {a.data.suppliers.find((s) => s.id === p.supplier_id)?.name}
                      </Text>
                      <Text style={s.h2}>{money(p.amount - p.paid_amount)}</Text>
                      <Text style={s.muted}>Hạn {p.due_date}</Text>
                      <Button
                        title="Thanh toán nhà cung cấp"
                        secondary
                        onPress={() =>
                          a.openForm({
                            title: 'Trả tiền nhà cung cấp',
                            fields: [
                              {
                                name: 'amount',
                                label: 'Tiền trả (đ)',
                                value: String(p.amount - p.paid_amount),
                                numeric: true,
                                required: true,
                              },
                              {
                                name: 'account',
                                label: 'Tài khoản chi',
                                value: accountOptions[0]?.value,
                                options: accountOptions,
                                required: true,
                              },
                            ],
                            submit: async (v, key) => {
                              await submitMutation(
                                'pay_supplier',
                                {
                                  payable_id: p.id,
                                  account_id: v.account,
                                  amount: decimal(v.amount ?? '', 'Tiền trả'),
                                  txn_date: today(),
                                },
                                key,
                              );
                            },
                          })
                        }
                      />
                    </Card>
                  ))}
                {!a.data.payables.some((p) => p.amount > p.paid_amount) && (
                  <Empty title="Chưa có khoản cần trả" />
                )}
              </>
            )}
          </>
        )}
        {page === 'stock' && (
          <>
            <View style={s.banner}>
              <Text style={s.text}>
                Tồn kế thừa cần kiểm kê thật. “Chưa đối soát” không phải tồn kho đã xác nhận.
              </Text>
            </View>
            {a.data.stock.map((m, index) => (
              <Card key={m.material_id ?? index}>
                <View style={s.between}>
                  <Text style={[s.h3, { flex: 1 }]}>{m.name}</Text>
                  <Tag value={m.is_reconciled ? 'Đã đối soát' : 'Chưa đối soát'} />
                </View>
                <Text style={s.h2}>
                  {quantity(m.qty_on_hand)} {m.base_unit}
                </Text>
                <Text style={s.muted}>
                  Baseline {m.baseline_date ?? 'từ kiểm kê mới / chưa có'}
                </Text>
                <Button
                  title="Ghi kiểm kê thực tế"
                  secondary
                  onPress={() =>
                    a.openForm({
                      title: 'Đối soát tồn nguyên liệu',
                      description:
                        'Nhập số đã kiểm đếm thực tế ở thời điểm hiện tại, bao gồm hàng đã nhận. Ledger trước đó được giữ nguyên.',
                      fields: [
                        {
                          name: 'qty',
                          label: `Số kiểm kê (${m.base_unit})`,
                          numeric: true,
                          required: true,
                        },
                        {
                          name: 'reason',
                          label: 'Lý do / chứng từ kiểm kê',
                          required: true,
                          multiline: true,
                        },
                      ],
                      submit: async (v, key) => {
                        await submitMutation(
                          'reconcile_material_stock',
                          {
                            material_id: m.material_id,
                            counted_qty: decimal(v.qty ?? '', 'Số kiểm kê', true),
                            reason: v.reason,
                          },
                          key,
                        );
                      },
                    })
                  }
                />
              </Card>
            ))}
          </>
        )}
        {page === 'suppliers' && (
          <>
            <Button title="Thêm nhà cung cấp" icon="add-outline" onPress={addSupplier} />
            {a.data.suppliers.map((supplier) => (
              <Card key={supplier.id}>
                <Text style={s.h2}>{supplier.name}</Text>
                <Text style={s.muted}>{supplier.phone ?? 'Chưa có số điện thoại'}</Text>
                <Text style={s.text}>{supplier.note}</Text>
                <Button title="Tạo đơn mua" secondary onPress={() => a.editPurchase()} />
              </Card>
            ))}
            {!a.data.suppliers.length && (
              <Empty
                title="Chưa có nhà cung cấp"
                body="Bổ sung nhà cung cấp để bắt đầu mua nguyên liệu."
              />
            )}
          </>
        )}
        {page === 'team' && (
          <>
            <Button title="Cấp tài khoản mới" icon="person-add-outline" onPress={invite} />
            {a.data.members.map((m) => {
              const p = a.data.profiles.find((p) => p.user_id === m.user_id);
              return (
                <Card key={m.user_id}>
                  <View style={s.between}>
                    <Text style={s.h3}>{p?.full_name || shortId(m.user_id)}</Text>
                    <Tag value={m.role} />
                  </View>
                  <Text style={s.muted}>
                    {p?.contact_phone ?? 'Chưa có số điện thoại'} ·{' '}
                    {m.active ? 'Đang hoạt động' : 'Đã khóa'}
                  </Text>
                  {m.user_id !== a.userId && (
                    <Button
                      title="Sửa vai trò / trạng thái"
                      secondary
                      onPress={() =>
                        a.openForm({
                          title: 'Quản lý thành viên',
                          fields: [
                            {
                              name: 'role',
                              label: 'Vai trò',
                              value: m.role,
                              options: ['owner', 'manager', 'staff'].map((r) => ({
                                value: r,
                                label: labels[r] ?? r,
                              })),
                            },
                            {
                              name: 'active',
                              label: 'Trạng thái',
                              value: String(m.active),
                              options: [
                                { value: 'true', label: 'Hoạt động' },
                                { value: 'false', label: 'Khóa truy cập' },
                              ],
                            },
                          ],
                          submit: async (v, key) => {
                            await submitMutation(
                              'manage_member',
                              { user_id: m.user_id, role: v.role, active: v.active === 'true' },
                              key,
                            );
                          },
                        })
                      }
                    />
                  )}{' '}
                  {m.role !== 'owner' && (
                    <Button
                      title="Đặt lại mật khẩu"
                      secondary
                      onPress={() =>
                        a.openForm({
                          title: 'Đặt lại mật khẩu nhân viên',
                          description:
                            'Cấp mật khẩu mới từ 12 ký tự và thông báo trực tiếp cho người dùng.',
                          fields: [
                            {
                              name: 'password',
                              label: 'Mật khẩu mới',
                              required: true,
                              secure: true,
                            },
                            {
                              name: 'confirm',
                              label: 'Nhập lại mật khẩu',
                              required: true,
                              secure: true,
                            },
                          ],
                          submit: async (v) => {
                            if (v.password !== v.confirm) throw Error('Hai mật khẩu chưa khớp.');
                            await manageAccount({
                              action: 'reset',
                              user_id: m.user_id,
                              password: v.password,
                            });
                          },
                        })
                      }
                    />
                  )}
                  {m.role === 'staff' && (
                    <Button
                      title="Phân công tuyến"
                      secondary
                      onPress={() =>
                        a.openForm({
                          title: 'Phân công tuyến cho nhân viên',
                          fields: [
                            {
                              name: 'route',
                              label: 'Tuyến được giao',
                              options: a.data.routes.map((r) => ({ value: r.id, label: r.name })),
                              required: true,
                            },
                          ],
                          submit: async (v) => {
                            const { error } = await supabase
                              .from('route_assignments')
                              .upsert({ user_id: m.user_id, route_id: v.route ?? '' });
                            if (error) throw error;
                          },
                        })
                      }
                    />
                  )}
                </Card>
              );
            })}
          </>
        )}
        {page === 'cash' && (
          <>
            {a.data.accounts.map((account) => (
              <Card key={account.id}>
                <Text style={s.h3}>{account.name}</Text>
                <Text style={s.h2}>
                  {money(
                    a.data.cash
                      .filter((m) => m.account_id === account.id)
                      .reduce((v, m) => v + (m.direction === 'in' ? m.amount : -m.amount), 0),
                  )}
                </Text>
              </Card>
            ))}
            <Text style={s.h2}>Giao dịch gần đây</Text>
            {[...a.data.cash]
              .sort((x, y) => y.created_at.localeCompare(x.created_at))
              .map((m) => (
                <Card key={m.id}>
                  <View style={s.between}>
                    <Text style={s.h3}>
                      {m.direction === 'in' ? 'Thu' : 'Chi'} · {money(m.amount)}
                    </Text>
                    <Text style={s.muted}>{m.txn_date}</Text>
                  </View>
                  <Text style={s.muted}>
                    {a.data.accounts.find((a) => a.id === m.account_id)?.name} · #{shortId(m.id)}
                    {m.reverses_id ? ' · Giao dịch đảo' : ''}
                  </Text>
                  {!m.reverses_id &&
                    ['sale_collection', 'debt_collection', 'supplier_payment'].includes(m.kind) &&
                    !a.data.cash.some((x) => x.reverses_id === m.id) && (
                      <Button
                        title="Đảo giao dịch"
                        secondary
                        onPress={() =>
                          a.openForm({
                            title: 'Đảo thu / chi',
                            fields: [
                              {
                                name: 'reason',
                                label: 'Lý do ghi sai',
                                required: true,
                                multiline: true,
                              },
                            ],
                            submit: async (v, key) => {
                              await submitMutation(
                                'reverse_cash_movement',
                                { movement_id: m.id, reason: v.reason },
                                key,
                              );
                            },
                          })
                        }
                      />
                    )}
                </Card>
              ))}
            {!a.data.cash.length && <Empty title="Sổ tiền chưa có giao dịch" />}
          </>
        )}
        {page === 'review' &&
          a.data.reviews
            .filter((r) => r.status === 'open')
            .map((r) => (
              <Card key={r.id}>
                <Text style={s.h3}>
                  {{
                    unbound_alias_scope: 'Tên khách cần đối chiếu',
                    unallocated_alias: 'Tên hàng cần phân bổ',
                    material_unit_review: 'Đơn vị nguyên liệu cần xác minh',
                  }[r.kind] ?? r.kind}
                </Text>
                <Text style={s.text}>{reviewText(r.kind, r.entity_ref, r.details)}</Text>
                {r.kind === 'unbound_alias_scope' && (
                  <Button
                    title="Gắn đúng khách hàng"
                    secondary
                    onPress={() =>
                      a.openForm({
                        title: 'Xác nhận tên khách',
                        fields: [
                          {
                            name: 'customer',
                            label: 'Khách trong danh mục',
                            options: a.data.customers.map((c) => ({ value: c.id, label: c.name })),
                            required: true,
                          },
                        ],
                        submit: async (v, key) => {
                          const ref = r.entity_ref.lastIndexOf('/');
                          await submitMutation(
                            'bind_order_alias',
                            {
                              alias: r.entity_ref.slice(0, ref),
                              scope: r.entity_ref.slice(ref + 1),
                              customer_id: v.customer,
                            },
                            key,
                          );
                        },
                      })
                    }
                  />
                )}
              </Card>
            ))}
      </View>
    );
  return (
    <View style={s.page}>
      <View>
        <Text style={s.label}>CÔNG CỤ VÀ TÀI KHOẢN</Text>
        <Text style={s.title}>Thêm</Text>
      </View>
      <Card>
        <View style={s.row}>
          <View style={s.avatar}>
            <Icon name="person-outline" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>{profile?.full_name || 'Đội ngũ Phúc An'}</Text>
            <Text style={s.muted}>{profile?.contact_phone}</Text>
          </View>
        </View>
        <Tag value={a.role} />
      </Card>
      <Button title="Bán hàng của tôi / Chốt tiền" onPress={() => a.go('my-sales')} />
      {pending && (
        <Card>
          <Text style={s.h3}>Thao tác chờ xác nhận</Text>
          <Text style={s.muted}>
            Yêu cầu trước đó chưa xác định kết quả do kết nối. Thử lại sẽ dùng đúng mã cũ và không
            ghi trùng.
          </Text>
          <Button
            title="Thử lại thao tác đã lưu"
            onPress={() =>
              void a.run(
                () => submitMutation(pending.name, pending.payload, pending.key),
                'Đã xác nhận kết quả thao tác',
              )
            }
          />
        </Card>
      )}
      {[
        { id: 'debt', label: 'Bán hàng & công nợ', icon: 'wallet-outline' as const, show: true },
        { id: 'stock', label: 'Kho nguyên liệu', icon: 'cube-outline' as const, show: manager },
        {
          id: 'suppliers',
          label: 'Nhà cung cấp',
          icon: 'business-outline' as const,
          show: manager,
        },
        { id: 'cash', label: 'Sổ thu – chi', icon: 'cash-outline' as const, show: manager },
        {
          id: 'team',
          label: 'Đội ngũ & phân quyền',
          icon: 'people-outline' as const,
          show: a.role === 'owner',
        },
        {
          id: 'review',
          label: `Dữ liệu cần đối chiếu (${a.data.reviews.filter((r) => r.status === 'open').length})`,
          icon: 'alert-circle-outline' as const,
          show: manager,
        },
      ]
        .filter((m) => m.show)
        .map((m) => (
          <Card key={m.id} onPress={() => setPage(m.id)}>
            <View style={s.row}>
              <Icon name={m.icon} />
              <Text style={[s.h3, { flex: 1 }]}>{m.label}</Text>
              <Icon name="chevron-forward-outline" size={18} />
            </View>
          </Card>
        ))}
      <Button
        title="Đổi mật khẩu"
        secondary
        onPress={() =>
          a.openForm({
            title: 'Đổi mật khẩu',
            description: 'Dùng mật khẩu từ 12 ký tự. Không chia sẻ mật khẩu với người khác.',
            fields: [
              { name: 'password', label: 'Mật khẩu mới', required: true, secure: true },
              { name: 'confirm', label: 'Nhập lại mật khẩu', required: true, secure: true },
            ],
            submit: async (v) => {
              if ((v.password?.length ?? 0) < 12 || (v.password?.length ?? 0) > 128)
                throw Error('Mật khẩu cần từ 12 đến 128 ký tự.');
              if (v.password !== v.confirm) throw Error('Hai mật khẩu chưa khớp.');
              const { error } = await supabase.auth.updateUser({ password: v.password ?? '' });
              if (error) throw error;
            },
          })
        }
      />
      <Button
        title="Đăng xuất"
        secondary
        icon="log-out-outline"
        onPress={() =>
          void a.run(async () => {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
          })
        }
      />
      <Text style={[s.muted, { textAlign: 'center' }]}>
        Phúc An · Phiên bản 1.0{'\n'}Dữ liệu thật · Quyền truy cập theo tài khoản
      </Text>
    </View>
  );
}
