import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const project = 'https://jirwetvjrgllghiikprf.supabase.co';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const day = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
async function mock(page: Page, role = 'owner') {
  const tables: Record<string, any[]> = {
    app_members: [{ user_id: id(1), role, active: true }],
    member_profiles: [
      {
        user_id: id(1),
        full_name: 'Nhóm kiểm thử Phúc An',
        email: 'test@example.test',
        contact_phone: '',
        updated_at: new Date().toISOString(),
      },
    ],
    customers: [
      {
        id: id(2),
        name: 'Khách kiểm thử',
        customer_type: 'Đại lý',
        route_id: id(3),
        is_active: true,
        default_discount_pct: 0,
        phone: null,
        address: 'Địa chỉ kiểm thử',
        credit_policy: 'review',
        payment_terms_days: 7,
        credit_limit: null,
      },
    ],
    routes: [{ id: id(3), name: 'Tuyến kiểm thử', code: 'TEST', is_active: true }],
    products: [
      {
        id: id(4),
        name: 'Bánh donut',
        sku: 'TEST_DONUT',
        sale_unit: 'cái',
        wholesale_price: 4000,
        list_price: null,
        is_active: true,
      },
    ],
    product_units: [
      {
        product_id: id(4),
        price_unit: 'cái',
        pieces_per_price_unit: 1,
        pieces_per_order_unit: 10,
        verified: true,
      },
    ],
    selling_prices: [
      {
        id: id(5),
        product_id: id(4),
        price_tier: 'wholesale',
        amount: 4000,
        price_unit: 'cái',
        pieces_per_price_unit: 1,
        effective_from: '2026-01-01',
        effective_to: null,
        customer_id: null,
      },
    ],
    materials:
      role === 'staff'
        ? []
        : [
            {
              id: id(6),
              name: 'Bột kiểm thử',
              code: 'TEST_FLOUR',
              base_unit: 'kg',
              is_active: true,
            },
          ],
    suppliers: role === 'staff' ? [] : [{ id: id(7), name: 'Nhà cung cấp kiểm thử' }],
    cash_accounts:
      role === 'staff' ? [] : [{ id: id(8), name: 'Tiền mặt kiểm thử', is_active: true }],
    customer_orders: [],
    customer_order_items: [],
    customer_order_requests: [],
    sales: [],
    sale_items: [],
    receivables: [],
    customer_activities: [],
    customer_tasks: [],
    purchase_orders: [],
    purchase_order_items: [],
    supplier_payables: [],
    cash_movements: [],
    data_review_issues: [],
    v_material_stock: [],
  };
  const calls: { name: string; body: any }[] = [];
  const user = {
    id: id(1),
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.test',
    email_confirmed_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.TEST_SIGNATURE`;
  await page.route(`${project}/**`, async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      body = req.postDataJSON();
    const reply = (value: any, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(value),
        headers: { 'access-control-allow-origin': '*' },
      });
    if (url.pathname === '/auth/v1/settings')
      return reply({ external: { phone: false, email: true } });
    if (url.pathname === '/auth/v1/token')
      return reply({
        access_token: token,
        refresh_token: 'TEST_REFRESH_TOKEN',
        token_type: 'bearer',
        expires_in: 3600,
        user,
      });
    if (url.pathname === '/auth/v1/user') return reply(user);
    if (url.pathname === '/auth/v1/logout') return reply({});
    const name = url.pathname.split('/').at(-1) ?? '';
    if (url.pathname.includes('/rpc/')) {
      calls.push({ name, body });
      const p = body?.payload;
      if (name === 'list_member_invites') return reply([]);
      if (name === 'save_customer_order') {
        const orderId = id(20 + tables.customer_orders!.length);
        tables.customer_orders!.push({
          id: orderId,
          ...p,
          status: 'draft',
          version: 1,
          created_by: user.id,
          created_at: new Date().toISOString(),
          discount_pct: 0,
          route_id: id(3),
        });
        for (const l of p.lines) {
          tables.customer_order_items!.push({
            id: id(40 + tables.customer_order_items!.length),
            order_id: orderId,
            product_id: l.product_id,
            requested_name: 'Bánh donut',
            order_qty: l.order_qty,
            pieces_qty: l.order_qty * 10,
            pieces_per_order_unit: 10,
            pieces_per_price_unit: 1,
            unit_price_snapshot: 4000,
            price_unit: 'cái',
            delivered_pieces: 0,
          });
          tables.customer_order_requests!.push({
            id: id(60),
            order_id: orderId,
            order_qty: l.order_qty,
            original_request: l,
          });
        }
        return reply(orderId);
      }
      if (name === 'save_purchase_order') {
        const po = id(80);
        tables.purchase_orders!.push({
          id: po,
          ...p,
          status: 'draft',
          version: 1,
          created_at: new Date().toISOString(),
        });
        for (const l of p.lines)
          tables.purchase_order_items!.push({
            id: id(81),
            purchase_order_id: po,
            ...l,
            received_qty: 0,
          });
        return reply(po);
      }
      if (name === 'transition_customer_order') {
        const o = tables.customer_orders!.find((o) => o.id === p.order_id);
        o.status = p.status;
        o.version++;
        return reply(o.id);
      }
      return reply(id(99));
    }
    if (url.pathname.includes('/rest/v1/')) {
      if (req.method() === 'POST') {
        const rows = Array.isArray(body) ? body : [body];
        for (const row of rows)
          (tables[name] ??= []).push({
            id: id(100 + (tables[name]?.length ?? 0)),
            occurred_at: new Date().toISOString(),
            ...row,
          });
        return reply(null, 201);
      }
      if (name === 'app_members' && url.searchParams.has('user_id'))
        return reply(tables.app_members);
      return reply(tables[name] ?? []);
    }
    return reply({});
  });
  return { tables, calls };
}
async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('test@example.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('TEST_PASSWORD_ONLY');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByText('Chào ngày mới.')).toBeVisible();
}
test('iPhone layout, real navigation, customer profile and CRM write', async ({ page }) => {
  const { calls, tables } = await mock(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  mkdirSync('test-output/screenshots', { recursive: true });
  await page.screenshot({ path: 'test-output/screenshots/iphone-login.png' });
  await login(page);
  await page.screenshot({ path: 'test-output/screenshots/iphone-home.png' });
  await expect(page.getByText('Hôm nay chưa có lịch giao')).toBeVisible();
  await page.getByRole('tab', { name: 'Khách hàng', exact: true }).click();
  await page.getByText('Khách kiểm thử', { exact: true }).click();
  await expect(page.getByText('HỒ SƠ KHÁCH HÀNG')).toBeVisible();
  await page.getByRole('button', { name: 'Ghi chăm sóc', exact: true }).click();
  await page.getByLabel('Nội dung', { exact: true }).fill('Ghi chú kiểm thử');
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  await expect(page.getByText('Ghi chú kiểm thử', { exact: true })).toBeVisible();
  expect(tables.customer_activities![0].body).toBe('Ghi chú kiểm thử');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});
test('create order uses bi10 quantity and idempotency key then supports confirmation', async ({
  page,
}) => {
  const { calls } = await mock(page);
  await login(page);
  await page.getByRole('button', { name: 'Tạo đơn khách', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm Bánh donut', exact: true }).click();
  await page.getByLabel('Số bì dòng 1', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Lưu đơn nháp', exact: true }).click();
  await expect(page.getByText('Đã lưu thành công')).toBeVisible();
  const call = calls.find((c) => c.name === 'save_customer_order')!;
  expect(call.body.payload.lines[0].order_qty).toBe(2);
  expect(call.body.request_key.length).toBeGreaterThan(8);
  await page.getByRole('tab', { name: 'Đơn hàng', exact: true }).click();
  await page.getByText('Khách kiểm thử', { exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận đơn', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận đơn', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ghi giao hàng', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-output/screenshots/iphone-order.png' });
  expect(calls.find((c) => c.name === 'transition_customer_order')!.body.payload.version).toBe(1);
  await page.getByRole('button', { name: 'Ghi giao hàng', exact: true }).click();
  await page.getByLabel('Lý do duyệt công nợ', { exact: true }).fill('Kiểm thử duyệt nợ');
  await page.getByRole('button', { name: 'Ghi giao & thanh toán', exact: true }).click();
  await expect(page.getByText('Đã lưu thành công')).toBeVisible();
  const delivery = calls.find((c) => c.name === 'post_delivery')!;
  expect(delivery.body.payload.lines[0].delivered_pieces).toBe(20);
  expect(delivery.body.payload.version).toBe(2);
});
test('purchase form sends explicit base conversion and staff has no purchase or team UI', async ({
  page,
}) => {
  const { calls } = await mock(page);
  await login(page);
  await page.getByRole('tab', { name: 'Đơn hàng', exact: true }).click();
  await page.getByRole('tab', { name: 'Mua nguyên liệu', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo đơn mua', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm nguyên liệu', exact: true }).click();
  await page.getByLabel('Đơn vị mua (bao/thùng/kg...) dòng 1').fill('thùng');
  await page.getByLabel('Số lượng mua dòng 1').fill('2');
  await page.getByLabel('Lượng kg trong 1 đơn vị mua dòng 1').fill('20');
  await page.getByLabel('Giá cho 1 đơn vị mua (đ) dòng 1').fill('880000');
  await page.getByRole('button', { name: 'Lưu đơn mua nháp', exact: true }).click();
  await expect(page.getByText('Đã lưu thành công')).toBeVisible();
  expect(calls.find((c) => c.name === 'save_purchase_order')!.body.payload.lines[0]).toMatchObject({
    quantity: 2,
    base_qty_per_unit: 20,
    unit_price: 880000,
    purchase_unit: 'thùng',
  });
  await page.getByRole('tab', { name: 'Thêm', exact: true }).click();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.unroute(`${project}/**`);
  await mock(page, 'staff');
  await login(page);
  await page.getByRole('tab', { name: 'Đơn hàng', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Mua nguyên liệu', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Thêm', exact: true }).click();
  await expect(page.getByText('Đội ngũ & phân quyền')).toHaveCount(0);
  await expect(page.getByText('Kho nguyên liệu', { exact: true })).toHaveCount(0);
});
test('uncertain network result keeps request key and supports safe retry from account tools', async ({
  page,
}) => {
  const { calls } = await mock(page);
  const keys: string[] = [];
  await page.route(`${project}/rest/v1/rpc/save_customer_order`, async (route) => {
    keys.push(route.request().postDataJSON().request_key);
    if (keys.length === 1) await route.abort('failed');
    else await route.fallback();
  });
  await login(page);
  await page.getByRole('button', { name: 'Tạo đơn khách', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm Bánh donut', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu đơn nháp', exact: true }).click();
  await expect(
    page.getByText('Kết nối bị gián đoạn. Thử lại với yêu cầu đã lưu trong mục Thêm.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('tab', { name: 'Thêm', exact: true }).click();
  await page.getByRole('button', { name: 'Thử lại thao tác đã lưu', exact: true }).click();
  await expect(page.getByText('Đã xác nhận kết quả thao tác')).toBeVisible();
  expect(keys.length).toBe(2);
  expect(keys[0]).toBe(keys[1]);
  expect(calls.filter((c) => c.name === 'save_customer_order')).toHaveLength(1);
});
