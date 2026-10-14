import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { AppContext, type Detail, type Page } from './src/lib/context';
import { loadData, emptyData, type Data } from './src/lib/data';
import { supabase, type Role, type Row } from './src/lib/supabase';
import { errorMessage } from './src/lib/format';
import { Button, C, Empty, FormSheet, Icon, s, type FormSpec } from './src/components/ui';
import { Auth } from './src/screens/Auth';
import { Home } from './src/screens/Home';
import { Orders, OrderDetail, OrderEditor } from './src/screens/Orders';
import { PurchaseDetail, PurchaseEditor } from './src/screens/Purchases';
import { Customers, CustomerDetail } from './src/screens/Customers';
import { Prices } from './src/screens/Prices';
import { SaleDetail } from './src/screens/Sales';
import { More } from './src/screens/More';
import { POS } from './src/screens/POS';
import { MySales } from './src/screens/MySales';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Workspace />
    </SafeAreaProvider>
  );
}
function Workspace() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [member, setMember] = useState<Row<'app_members'> | null>(null),
    [data, setData] = useState<Data>(emptyData),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState('');
  const [page, setPage] = useState<Page>('home'),
    [detail, setDetail] = useState<Detail | null>(null),
    [form, setForm] = useState<FormSpec | null>(null),
    [orderEditor, setOrderEditor] = useState<{
      order?: Row<'customer_orders'>;
      customerId?: string;
    } | null>(null),
    [purchaseEditor, setPurchaseEditor] = useState<{ order?: Row<'purchase_orders'> } | null>(null);
  const generation = useRef(0),
    actor = useRef<string | null>(null);
  const initialNavigation = useRef<string | null>(null);
  useEffect(() => {
    if (!session) {
      initialNavigation.current = null;
      return;
    }
    if (member && initialNavigation.current !== session.user.id) {
      initialNavigation.current = session.user.id;
      if (member.role === 'staff') setPage('pos');
    }
  }, [member, session?.user.id]);
  const clear = useCallback(() => {
    setData(emptyData);
    setMember(null);
    setPage('home');
    setDetail(null);
    setForm(null);
    setOrderEditor(null);
    setPurchaseEditor(null);
    setError('');
  }, []);
  useEffect(() => {
    let live = true;
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (live) {
          setSession(data.session);
          setReady(true);
        }
      })
      .catch(() => {
        if (live) setReady(true);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!live) return;
      if (actor.current !== next?.user.id) {
        generation.current++;
        clear();
        actor.current = next?.user.id ?? null;
      }
      setSession(next);
      setReady(true);
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, [clear]);
  const refresh = useCallback(async () => {
    const id = session?.user.id;
    if (!id) {
      clear();
      return;
    }
    const request = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const { data: profile, error } = await supabase
        .from('app_members')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();
      if (error) throw error;
      if (request !== generation.current) return;
      if (!profile?.active) {
        clear();
        return;
      }
      const result = await loadData(profile.role as Role);
      if (request === generation.current) {
        setData(result);
        setMember(profile);
      }
    } catch (e) {
      if (request === generation.current) setError(errorMessage(e));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [session?.user.id, clear]);
  useEffect(() => {
    if (ready) void refresh();
  }, [ready, refresh]);
  useEffect(() => {
    const handler = (state: string) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
        if (session) void refresh();
      } else supabase.auth.stopAutoRefresh();
    };
    const subscription = AppState.addEventListener('change', handler);
    if (Platform.OS !== 'web') handler(AppState.currentState);
    return () => subscription.remove();
  }, [refresh, session?.user.id]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (form) {
        setForm(null);
        return true;
      }
      if (orderEditor) {
        setOrderEditor(null);
        return true;
      }
      if (purchaseEditor) {
        setPurchaseEditor(null);
        return true;
      }
      if (detail) {
        setDetail(null);
        return true;
      }
      if (page !== 'home') {
        setPage('home');
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [form, orderEditor, purchaseEditor, detail, page]);
  async function run(work: () => Promise<unknown>, success?: string) {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      if (success) setToast(success);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const success = () => {
    setForm(null);
    setOrderEditor(null);
    setPurchaseEditor(null);
    setToast('Đã lưu thành công');
    void refresh();
  };
  const nav: {
    id: Page;
    label: string;
    icon: React.ComponentProps<typeof Icon>['name'];
    selected: React.ComponentProps<typeof Icon>['name'];
  }[] = [
    { id: 'home', label: 'Hôm nay', icon: 'home-outline', selected: 'home' },
    { id: 'pos', label: 'POS', icon: 'calculator-outline', selected: 'calculator' },
    { id: 'orders', label: 'Đơn hàng', icon: 'receipt-outline', selected: 'receipt' },
    { id: 'customers', label: 'Khách hàng', icon: 'people-outline', selected: 'people' },
    { id: 'prices', label: 'Giá', icon: 'pricetag-outline', selected: 'pricetag' },
    { id: 'more', label: 'Thêm', icon: 'grid-outline', selected: 'grid' },
  ];
  const role = member?.role as Role | undefined;
  const content = detail ? (
    detail.kind === 'order' ? (
      <OrderDetail id={detail.id} />
    ) : detail.kind === 'purchase' ? (
      <PurchaseDetail id={detail.id} />
    ) : detail.kind === 'customer' ? (
      <CustomerDetail id={detail.id} />
    ) : (
      <SaleDetail id={detail.id} />
    )
  ) : page === 'pos' ? (
    <POS />
  ) : page === 'my-sales' ? (
    <MySales />
  ) : page === 'home' ? (
    <Home />
  ) : page === 'orders' ? (
    <Orders />
  ) : page === 'customers' ? (
    <Customers />
  ) : page === 'prices' ? (
    <Prices />
  ) : (
    <More />
  );
  return (
    <View style={{ flex: 1, backgroundColor: '#E8ECE4' }}>
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: C.bg,
          maxWidth: 580,
          width: '100%',
          alignSelf: 'center',
        }}
        edges={['top', 'left', 'right', 'bottom']}
      >
        {!ready ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <ActivityIndicator color={C.green} />
          </View>
        ) : !session ? (
          <Auth />
        ) : !member ? (
          <View style={[s.page, { flex: 1, justifyContent: 'center' }]}>
            {loading ? (
              <ActivityIndicator color={C.green} />
            ) : (
              <>
                <Empty
                  title="Đang chờ cấp quyền"
                  body="Tài khoản chưa có quyền hoạt động hoặc đã bị khóa. Liên hệ chủ doanh nghiệp để được cấp quyền."
                  icon="shield-checkmark-outline"
                />
                <Text style={[s.muted, { textAlign: 'center' }]}>
                  {data.profiles.find((p) => p.user_id === session.user.id)?.contact_phone ??
                    'Tài khoản nội bộ'}
                </Text>
                {!!error && (
                  <Text accessibilityRole="alert" style={{ color: C.red }}>
                    {error}
                  </Text>
                )}
                <Button title="Kiểm tra quyền lại" onPress={() => void refresh()} />
                <Button title="Đăng xuất" secondary onPress={() => void supabase.auth.signOut()} />
              </>
            )}
          </View>
        ) : (
          role && (
            <AppContext.Provider
              value={{
                data,
                role,
                userId: session.user.id,
                email: session.user.email ?? session.user.phone ?? '',
                busy,
                openForm: setForm,
                openDetail: setDetail,
                go: (p) => {
                  setPage(p);
                  setDetail(null);
                },
                editOrder: (order, customerId) => setOrderEditor({ order, customerId }),
                editPurchase: (order) => setPurchaseEditor({ order }),
                run,
                refresh,
              }}
            >
              <View
                style={{ flex: 1 }}
                aria-hidden={!!(form || orderEditor || purchaseEditor)}
                accessibilityElementsHidden={!!(form || orderEditor || purchaseEditor)}
                importantForAccessibility={
                  form || orderEditor || purchaseEditor ? 'no-hide-descendants' : 'auto'
                }
              >
                {detail && (
                  <View style={[s.sheetHeader, { paddingVertical: 10 }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Quay lại"
                      onPress={() => setDetail(null)}
                      style={s.row}
                    >
                      <Icon name="arrow-back-outline" />
                      <Text style={s.h3}>Quay lại</Text>
                    </Pressable>
                    <Text style={s.label}>PHÚC AN</Text>
                  </View>
                )}
                {!!error && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void refresh()}
                    style={[s.banner, { marginHorizontal: 18, marginTop: 12 }]}
                  >
                    <Text accessibilityRole="alert" style={[s.text, { color: C.red }]}>
                      {error}
                    </Text>
                    <Text style={s.muted}>Chạm để tải lại dữ liệu.</Text>
                  </Pressable>
                )}
                {!!toast && (
                  <View
                    accessibilityRole="alert"
                    style={[
                      s.banner,
                      {
                        backgroundColor: C.soft,
                        borderColor: C.line,
                        marginHorizontal: 18,
                        marginTop: 12,
                      },
                    ]}
                  >
                    <Text style={s.text}>{toast}</Text>
                  </View>
                )}
                {!detail && page === 'pos' ? (
                  content
                ) : (
                  <ScrollView
                    key={detail?.id ?? page}
                    contentContainerStyle={{ flexGrow: 1 }}
                    refreshControl={
                      <RefreshControl
                        refreshing={loading}
                        onRefresh={() => void refresh()}
                        tintColor={C.green}
                      />
                    }
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {content}
                  </ScrollView>
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    borderTopWidth: 1,
                    borderTopColor: C.line,
                    backgroundColor: C.paper,
                    paddingTop: 10,
                    paddingBottom: 8,
                    display: !detail && page === 'pos' ? 'none' : 'flex',
                  }}
                >
                  {nav.map((n) => (
                    <Pressable
                      key={n.id}
                      accessibilityRole="tab"
                      accessibilityLabel={n.label}
                      accessibilityState={{ selected: page === n.id }}
                      onPress={() => {
                        setPage(n.id);
                        setDetail(null);
                      }}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 48,
                        gap: 4,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: page === n.id ? C.soft : 'transparent',
                          paddingHorizontal: 14,
                          paddingVertical: 4,
                          borderRadius: 12,
                        }}
                      >
                        <Icon
                          name={page === n.id ? n.selected : n.icon}
                          size={22}
                          color={page === n.id ? C.green : C.muted}
                        />
                      </View>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: page === n.id ? '700' : '500',
                          color: page === n.id ? C.green : C.muted,
                        }}
                      >
                        {n.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {form && (
                <FormSheet
                  key={form.title}
                  spec={form}
                  onClose={() => setForm(null)}
                  onSuccess={success}
                />
              )}
              {orderEditor && (
                <OrderEditor
                  {...orderEditor}
                  onClose={() => setOrderEditor(null)}
                  onSuccess={success}
                />
              )}
              {purchaseEditor && (
                <PurchaseEditor
                  {...purchaseEditor}
                  onClose={() => setPurchaseEditor(null)}
                  onSuccess={success}
                />
              )}
            </AppContext.Provider>
          )
        )}
      </SafeAreaView>
    </View>
  );
}
