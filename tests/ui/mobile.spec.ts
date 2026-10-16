import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const project = 'https://jirwetvjrgllghiikprf.supabase.co';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('web icons render on a cold load and reload with all font downloads blocked', async ({
  page,
}) => {
  const fontRequests: string[] = [];
  await page.route(/\.(ttf|otf|woff2?)(\?|$)/, (route) => {
    fontRequests.push(route.request().url());
    return route.abort();
  });
  await mock(page);
  await login(page);
  const homeIcon = page
    .getByRole('tab', { name: 'Hôm nay', exact: true })
    .locator('svg[data-icon="home"]');
  await expect(homeIcon).toBeVisible();
  await expect(homeIcon.locator('path')).not.toHaveCount(0);
  await page.getByRole('tab', { name: 'POS', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Trang chính', exact: true }).locator('svg'),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('svg[data-icon]').first()).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(/[\uE000-\uF8FF]/);
  expect(fontRequests).toEqual([]);
  await page.screenshot({ path: 'test-output/screenshots/icons-with-fonts-blocked.png' });
});

for (const mode of ['quantity', 'product', 'profile'])
  test(`new customer defaults to Kon Dong with multiple routes (${mode})`, async ({ page }) => {
    const { tables, calls } = await mock(page);
    tables.routes[0].name = 'Kon Dơng';
    tables.routes[0].code = 'R-CHO_HUYEN';
    tables.routes.unshift({ id: id(990), code: 'R-HRA', name: 'Hra', is_active: true });
    await login(page);
    if (mode === 'profile') {
      await page.getByRole('tab', { name: 'Khách hàng', exact: true }).click();
      await page.getByLabel('Thêm khách hàng', { exact: true }).click();
      await page.getByLabel('Tên khách hàng', { exact: true }).fill('Khách tuyến mặc định');
      await expect(page.getByRole('button', { name: 'Tuyến', exact: true })).toContainText(
        'Kon Dơng',
      );
      await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
      await expect(page.getByText('Khách tuyến mặc định', { exact: true })).toBeVisible();
      expect(tables.customers.at(-1).route_id).toBe(id(3));
    } else {
      await page.getByRole('tab', { name: 'POS', exact: true }).click();
      if (mode === 'product')
        await page.getByRole('tab', { name: 'Chọn theo món', exact: true }).click();
      await page.getByRole('button', { name: 'Chọn hoặc tạo khách POS', exact: true }).click();
      await page.getByLabel('Tìm khách POS', { exact: true }).fill('Khách tuyến mặc định');
      await expect(
        page.getByRole('button', { name: 'Tuyến của khách mới', exact: true }),
      ).toContainText('Kon Dơng');
      await page.getByRole('button', { name: 'Tạo khách & bán ngay', exact: true }).click();
      await expect(page.getByText('Khách tuyến mặc định', { exact: true })).toBeVisible();
      expect(calls.find((c) => c.name === 'create_pos_customer')!.body.payload.route_id).toBe(
        id(3),
      );
    }
  });

for (const role of ['owner', 'staff'])
  test(`customer price panel shows price source and editing permissions (${role})`, async ({
    page,
  }) => {
    const { tables, calls } = await mock(page, role);
    tables.pos_package_prices = [
      {
        id: id(200),
        customer_id: null,
        package_unit: 'bi',
        amount: 16000,
        pieces_per_package: 10,
        version: 1,
      },
      {
        id: id(201),
        customer_id: null,
        package_unit: 'hop',
        amount: 40000,
        pieces_per_package: 10,
        version: 1,
      },
    ];
    await login(page, role === 'staff');
    await page.getByRole('tab', { name: 'Khách hàng', exact: true }).click();
    await page.getByText('Khách kiểm thử', { exact: true }).click();
    await expect(page.getByText('Giá riêng bì / hộp', { exact: true })).toBeVisible();
    await expect(page.getByText('Đang dùng giá chung', { exact: false })).toHaveCount(2);
    if (role === 'owner') {
      await page.getByRole('button', { name: 'Sửa giá riêng bì', exact: true }).click();
      await page.getByLabel('Giá 1 bì (đ)', { exact: true }).fill('14000');
      await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
      await expect(page.getByText('Giá riêng của khách', { exact: false })).toBeVisible();
      expect(calls.find((x) => x.name === 'set_pos_package_price')!.body.payload.customer_id).toBe(
        id(2),
      );
      expect(
        tables.pos_package_prices.find((r) => r.customer_id === null && r.package_unit === 'bi')
          .amount,
      ).toBe(16000);
    } else {
      await expect(page.getByRole('button', { name: 'Sửa giá riêng bì', exact: true })).toHaveCount(
        0,
      );
      await expect(
        page.getByText('Tài khoản nhân viên chỉ được xem.', { exact: false }),
      ).toBeVisible();
    }
    await page.screenshot({ path: `test-output/screenshots/customer-prices-${role}.png` });
    await page.getByRole('tab', { name: 'POS', exact: true }).click();
    await page.getByRole('button', { name: 'Chọn hoặc tạo khách POS', exact: true }).click();
    await page.getByRole('button', { name: 'Chọn khách Khách kiểm thử', exact: true }).click();
    await page.getByRole('button', { name: 'Giá riêng của khách POS', exact: true }).click();
    await expect(page.getByText('Giá riêng bì / hộp', { exact: true })).toBeVisible();
    if (role === 'owner')
      await expect(
        page.getByRole('button', { name: 'Sửa giá riêng hộp', exact: true }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole('button', { name: 'Sửa giá riêng hộp', exact: true }),
      ).toHaveCount(0);
  });

test('compact POS uses common prices, half-package buttons and keeps both quantity rows above the footer', async ({
  page,
}) => {
  const { tables, calls } = await mock(page, 'staff');
  tables.pos_package_prices = [
    {
      id: id(200),
      customer_id: null,
      package_unit: 'bi',
      amount: 16000,
      pieces_per_package: 10,
      version: 1,
    },
    {
      id: id(201),
      customer_id: null,
      package_unit: 'hop',
      amount: 40000,
      pieces_per_package: 10,
      version: 1,
    },
  ];
  await login(page, true);
  await page.getByRole('tab', { name: 'POS', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn hoặc tạo khách POS', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn khách Khách kiểm thử', exact: true }).click();
  const rows = page.getByTestId('pos-quantity-row');
  expect((await rows.first().boundingBox())!.y).toBeLessThan(160);
  expect((await rows.last().boundingBox())!.height).toBeLessThanOrEqual(80);
  await expect(rows.last()).toBeInViewport();
  await page.getByRole('button', { name: 'Thêm nửa bì', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm nửa hộp', exact: true }).click();
  await expect(page.getByLabel('Tổng tiền và chốt POS', { exact: true })).toContainText('28.000');
  await expect(
    page.getByRole('button', { name: 'Chốt bán & thu tiền', exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: 'test-output/screenshots/pos-compact-common-prices.png' });
  await page.getByRole('button', { name: 'Chốt bán & thu tiền', exact: true }).click();
  await expect(
    page.getByText('Đã chốt bán và thu đủ tiền. Có thể điền loại bánh sau.', { exact: true }),
  ).toBeVisible();
  expect(calls.find((x) => x.name === 'post_pos_package_sale')!.body.payload).toMatchObject({
    expected_total: 28000,
    lines: [
      { package_unit: 'bi', quantity: 0.5, price_id: id(200) },
      { package_unit: 'hop', quantity: 0.5, price_id: id(201) },
    ],
  });
  await page.getByRole('button', { name: 'Xem trong Đơn hàng', exact: true }).click();
  await page.getByRole('button', { name: 'Bán POS', exact: true }).click();
  await expect(page.getByText('Chờ điền loại bánh', { exact: false })).toBeVisible();
  await expect(page.getByText('0,5 bì · 0,5 hộp', { exact: true })).toBeVisible();
  await page.getByText('Khách kiểm thử', { exact: true }).click();
  await page.getByRole('button', { name: 'Điền loại bánh', exact: true }).click();
  await page.getByLabel('Phân bổ Bánh donut', { exact: true }).fill('0.5');
  await page.getByRole('button', { name: 'Đang điền cho', exact: true }).click();
  await page.getByRole('button', { name: 'hộp', exact: true }).click();
  await page.getByLabel('Phân bổ Bánh donut', { exact: true }).fill('0.5');
  await page.getByRole('button', { name: 'Lưu chi tiết bánh', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Xem loại bánh đã điền', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await expect(page.getByText('Đã điền đủ loại bánh', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Chờ điền bánh', exact: true }).click();
  await expect(page.getByText('Không có đơn phù hợp', { exact: true })).toBeVisible();
  expect(calls.filter((x) => x.name === 'post_pos_package_sale')).toHaveLength(1);
  expect(tables.customer_orders).toHaveLength(0);
  await page.reload();
  await page.getByRole('button', { name: 'Trang chính', exact: true }).click();
  await page.getByRole('tab', { name: 'Đơn hàng', exact: true }).click();
  await expect(page.getByText('Đã điền đủ loại bánh', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'test-output/screenshots/orders-with-pos.png' });
});

for (const role of ['owner', 'staff'])
  test(`Kho lists active products and current general prices with search and groups (${role})`, async ({
    page,
  }) => {
    const { tables } = await mock(page, role);
    tables.products[0].category = 'Bánh ngọt';
    tables.products.push({
      ...tables.products[0],
      id: id(901),
      sku: 'TEST_RETIRED',
      name: 'Bánh ngừng bán',
      is_active: false,
    });
    tables.products.push({
      ...tables.products[0],
      id: id(902),
      sku: 'TEST_NEW',
      name: 'Bánh mới',
      category: 'Bánh mặn',
    });
    tables.selling_prices.push({
      ...tables.selling_prices[0],
      id: id(903),
      price_tier: 'retail',
      amount: 5000,
    });
    tables.selling_prices.push({
      ...tables.selling_prices[0],
      id: id(904),
      customer_id: id(2),
      amount: 1000,
    });
    tables.selling_prices.push({
      ...tables.selling_prices[0],
      id: id(905),
      effective_from: '2099-01-01',
      amount: 9000,
    });
    tables.selling_prices.push({
      ...tables.selling_prices[0],
      id: id(906),
      effective_from: '2025-01-01',
      effective_to: '2025-12-31',
      amount: 8000,
    });
    await login(page, role === 'staff');
    await page.getByRole('tab', { name: 'Kho', exact: true }).click();
    await expect(page.getByText('2 sản phẩm đang bán', { exact: true })).toBeVisible();
    await expect(page.getByTestId('inventory-product')).toHaveCount(2);
    await expect(page.getByText('Bánh ngừng bán', { exact: true })).toHaveCount(0);
    await page.getByLabel('Tìm sản phẩm, mã hoặc nhóm…', { exact: true }).fill('banh donut');
    const product = page.getByTestId('inventory-product');
    await expect(product).toHaveCount(1);
    await expect(product).toContainText('4.000');
    await expect(product).toContainText('5.000');
    await expect(product).toContainText('/ cái');
    await expect(product).not.toContainText('1.000');
    await expect(product).not.toContainText('9.000');
    await expect(product).not.toContainText('8.000');
    await page.getByLabel('Tìm sản phẩm, mã hoặc nhóm…', { exact: true }).fill('TEST_NEW');
    await expect(product).toContainText('Chưa có giá');
    await page.getByLabel('Tìm sản phẩm, mã hoặc nhóm…', { exact: true }).fill('khong co');
    await expect(page.getByText('Không tìm thấy sản phẩm', { exact: true })).toBeVisible();
    await page.getByLabel('Tìm sản phẩm, mã hoặc nhóm…', { exact: true }).fill('');
    await page.getByRole('button', { name: 'Nhóm sản phẩm', exact: true }).click();
    await page.getByRole('button', { name: 'Bánh ngọt', exact: true }).click();
    await expect(product).toHaveCount(1);
    await page.screenshot({ path: `test-output/screenshots/inventory-${role}.png` });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: 'Bảng giá chi tiết', exact: true }).click();
    await expect(page.getByText('Bảng giá', { exact: true })).toBeVisible();
  });

test('quantity-first POS sets customer prices, collects before products and allocates later without charging again', async ({
  page,
}) => {
  const { calls, tables } = await mock(page);
  await login(page);
  await page.getByRole('tab', { name: 'POS', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn hoặc tạo khách POS', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn khách Khách kiểm thử', exact: true }).click();
  await page.getByLabel('Số bì bán nhanh', { exact: true }).fill('3');
  await expect(
    page.getByRole('button', { name: 'Chốt bán & thu tiền', exact: true }),
  ).toBeDisabled();
  for (const [unit, amount, pack] of [
    ['bì', '40000', '10'],
    ['hộp', '60000', '6'],
  ]) {
    await page.getByRole('button', { name: `Thiết lập giá ${unit}`, exact: true }).click();
    await page.getByLabel(`Giá 1 ${unit} (đ)`, { exact: true }).fill(amount);
    await page.getByLabel(`Số cái trong 1 ${unit}`, { exact: true }).fill(pack);
    await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
    await expect(
      page.getByRole('button', { name: `Thiết lập giá ${unit}`, exact: true }),
    ).toBeVisible();
  }
  await page.getByLabel('Số hộp bán nhanh', { exact: true }).fill('1');
  await expect(page.getByLabel('Tổng tiền và chốt POS', { exact: true })).toContainText('180.000');
  await page.screenshot({ path: 'test-output/screenshots/pos-quantity-first.png' });
  await page.getByRole('button', { name: 'Chốt bán & thu tiền', exact: true }).click();
  await expect(
    page.getByText('Đã chốt bán và thu đủ tiền. Có thể điền loại bánh sau.', { exact: true }),
  ).toBeVisible();
  const sale = calls.find((x) => x.name === 'post_pos_package_sale')!.body;
  expect(sale.payload).toMatchObject({
    expected_total: 180000,
    customer_id: id(2),
    lines: [
      { package_unit: 'bi', quantity: 3, price_version: 1 },
      { package_unit: 'hop', quantity: 1, price_version: 1 },
    ],
  });
  expect(sale.payload.lines[0]).not.toHaveProperty('product_id');
  await page.getByRole('button', { name: 'Mở đơn chờ điền bánh', exact: true }).click();
  await page.getByRole('button', { name: /^Điền bánh đơn/ }).click();
  await page.getByLabel('Phân bổ Bánh donut', { exact: true }).fill('4');
  await expect(page.getByRole('button', { name: 'Lưu chi tiết bánh', exact: true })).toBeDisabled();
  await page.getByLabel('Phân bổ Bánh donut', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Lưu chi tiết bánh', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Điền bánh đơn/ })).toBeVisible();
  await page.getByRole('button', { name: /^Điền bánh đơn/ }).click();
  await expect(page.getByLabel('Phân bổ Bánh donut', { exact: true })).toHaveValue('2');
  await page.getByLabel('Phân bổ Bánh donut', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Đang điền cho', exact: true }).click();
  await page.getByRole('button', { name: 'hộp', exact: true }).click();
  await page.getByLabel('Phân bổ Bánh donut', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Lưu chi tiết bánh', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Điền bánh đơn/ })).toHaveCount(0);
  expect(tables.pos_package_sales[0].status).toBe('complete');
  expect(calls.filter((x) => x.name === 'post_pos_package_sale')).toHaveLength(1);
});

test('quantity-first draft restores silently and pending collection retries the same payload', async ({
  page,
}) => {
  const { tables, calls } = await mock(page, 'staff');
  tables.pos_package_prices = [
    {
      id: id(200),
      customer_id: id(2),
      package_unit: 'bi',
      amount: 40000,
      pieces_per_package: 10,
      version: 1,
    },
  ];
  await login(page, true);
  await page.getByRole('tab', { name: 'POS', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn hoặc tạo khách POS', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn khách Khách kiểm thử', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Thiết lập giá bì', exact: true })).toHaveCount(0);
  await page.getByLabel('Số bì bán nhanh', { exact: true }).fill('2.5');
  await page.getByLabel('Ghi chú bán nhanh', { exact: true }).fill('Điền bánh sau');
  await page.reload();
  await expect(page.getByLabel('Số bì bán nhanh', { exact: true })).toHaveValue('2.5');
  let request: any;
  await page.route(`${project}/rest/v1/rpc/post_pos_package_sale`, async (route) => {
    request = route.request().postDataJSON();
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Chốt bán & thu tiền', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Thử lại yêu cầu', exact: true })).toBeVisible();
  await expect(page.getByLabel('Số bì bán nhanh', { exact: true })).not.toBeEditable();
  await page.unroute(`${project}/rest/v1/rpc/post_pos_package_sale`);
  await page.getByRole('button', { name: 'Thử lại yêu cầu', exact: true }).click();
  await expect(
    page.getByText('Đã chốt bán và thu đủ tiền. Có thể điền loại bánh sau.', { exact: true }),
  ).toBeVisible();
  expect(calls.find((x) => x.name === 'post_pos_package_sale')!.body).toEqual(request);
  await page.reload();
  await expect(page.getByLabel('Số bì bán nhanh', { exact: true })).toHaveCount(0);
});

for (const role of ['owner', 'manager'])
  test(`customer removal is reversible and hides archived customers from selling (${role})`, async ({
    page,
  }) => {
    const { tables, calls } = await mock(page, role);
    await login(page);
    await page.getByRole('tab', { name: 'Khách hàng', exact: true }).click();
    await page.getByText('Khách kiểm thử', { exact: true }).click();
    await page.getByRole('button', { name: 'Xóa khách', exact: true }).click();
    await expect(page.getByText(/Giữ nguyên lịch sử, chứng từ và giá riêng/)).toBeVisible();
    await page.getByLabel('Lý do xóa', { exact: true }).fill('Khách ngừng mua');
    if (role === 'owner')
      await page.screenshot({ path: 'test-output/screenshots/customer-archive-confirm.png' });
    await page.getByRole('button', { name: 'Xác nhận xóa khách', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Khôi phục khách', exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Tạo đơn cho khách', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
    await expect(page.getByText('Khách kiểm thử', { exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: 'POS', exact: true }).click();
    await page.getByRole('button', { name: 'Chọn hoặc tạo khách POS', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Chọn khách Khách kiểm thử', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.getByRole('button', { name: 'Trang chính', exact: true }).click();
    await page.getByRole('tab', { name: 'Khách hàng', exact: true }).click();
    await page.getByRole('button', { name: 'Khách đã xóa', exact: true }).click();
    await page.getByText('Khách kiểm thử', { exact: true }).click();
    await page.getByRole('button', { name: 'Khôi phục khách', exact: true }).click();
    await page.getByRole('button', { name: 'Khôi phục khách', exact: true }).last().click();
    await expect(page.getByRole('button', { name: 'Xóa khách', exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Tạo đơn cho khách', exact: true }),
    ).toBeEnabled();
    expect(tables.customers[0].is_active).toBe(true);
    expect(
      calls.filter((c) => c.name === 'set_customer_active').map((c) => c.body.payload.is_active),
    ).toEqual([false, true]);
  });
for (const blocker of ['debt', 'order', 'allocation'])
  test(`customer removal explains unfinished work (${blocker})`, async ({ page }) => {
    const { tables } = await mock(page);
    if (blocker === 'debt')
      tables.receivables.push({ id: id(220), customer_id: id(2), amount: 10000, paid_amount: 0 });
    if (blocker === 'order')
      tables.customer_orders.push({ id: id(220), customer_id: id(2), status: 'draft' });
    if (blocker === 'allocation')
      tables.pos_package_sales = [{ id: id(220), customer_id: id(2), status: 'pending' }];
    await login(page);
    await page.getByRole('tab', { name: 'Khách hàng', exact: true }).click();
    await page.getByText('Khách kiểm thử', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Xóa khách', exact: true })).toBeDisabled();
    await expect(page.getByText(/Chưa thể xóa:/)).toBeVisible();
  });
test('staff cannot remove or restore customers and archived customers stay out of the active list', async ({
  page,
}) => {
  const { tables } = await mock(page, 'staff');
  tables.customers.push({
    ...tables.customers[0],
    id: id(222),
    name: 'Khách đã ngừng',
    is_active: false,
  });
  await login(page, true);
  await page.getByRole('tab', { name: 'Khách hàng', exact: true }).click();
  await expect(page.getByText('Khách đã ngừng', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Khách đã xóa', exact: true })).toHaveCount(0);
  await page.getByText('Khách kiểm thử', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Xóa khách', exact: true })).toHaveCount(0);
});

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
        contact_phone: '+84912345678',
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
      role === 'staff'
        ? []
        : [
            {
              id: id(8),
              code: 'TEST_CASH',
              account_type: 'cash',
              name: 'Tiền mặt kiểm thử',
              is_active: true,
            },
          ],
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
    order_product_name_rules: [],
    route_assignments: [{ user_id: id(1), route_id: id(3) }],
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
    if (url.pathname === '/auth/v1/user') {
      if (req.method() === 'PUT') calls.push({ name: 'change-password', body });
      return reply(user);
    }
    if (url.pathname === '/functions/v1/phone-accounts') {
      calls.push({ name: 'phone-accounts', body });
      if (body.action === 'create') {
        tables.app_members.push({ user_id: id(99), role: body.role, active: true });
        tables.member_profiles.push({
          user_id: id(99),
          full_name: body.full_name,
          contact_phone: body.phone,
        });
      }
      return reply({ user_id: id(99) });
    }
    if (url.pathname === '/auth/v1/logout') return reply({});
    const name = url.pathname.split('/').at(-1) ?? '';
    if (url.pathname.includes('/rpc/')) {
      calls.push({ name, body });
      const p = body?.payload;
      if (name === 'set_customer_active') {
        const customer = tables.customers.find((c) => c.id === p.customer_id);
        customer.is_active = p.is_active;
        return reply(customer.id);
      }
      if (name === 'set_pos_package_price') {
        const old = (tables.pos_package_prices ||= []).find(
          (r) => r.customer_id === p.customer_id && r.package_unit === p.package_unit,
        );
        if (old) Object.assign(old, p, { version: old.version + 1 });
        else
          tables.pos_package_prices.push({
            id: id(200 + tables.pos_package_prices.length),
            ...p,
            version: 1,
          });
        return reply(old?.id || tables.pos_package_prices.at(-1).id);
      }
      if (name === 'post_pos_package_sale') {
        const saleId = id(210 + tables.sales.length);
        tables.sales.push({
          id: saleId,
          created_at: new Date().toISOString(),
          customer_id: p.customer_id,
          sale_date: day,
          net_amount: p.expected_total,
          collected_amount: p.expected_total,
          note: p.note,
          created_by: id(1),
        });
        (tables.pos_package_sales ||= []).push({
          id: saleId,
          customer_id: p.customer_id,
          created_by: id(1),
          status: 'pending',
          version: 1,
          created_at: new Date().toISOString(),
        });
        for (const l of p.lines) {
          const rate =
            tables.pos_package_prices.find(
              (r) => r.customer_id === p.customer_id && r.package_unit === l.package_unit,
            ) ||
            tables.pos_package_prices.find(
              (r) => r.customer_id === null && r.package_unit === l.package_unit,
            );
          (tables.pos_package_lines ||= []).push({
            id: id(230 + tables.pos_package_lines.length),
            sale_id: saleId,
            package_unit: l.package_unit,
            quantity: l.quantity,
            unit_price: rate.amount,
            pieces_per_package: rate.pieces_per_package,
          });
        }
        return reply(saleId);
      }
      if (name === 'allocate_pos_packages') {
        const lines = tables.pos_package_lines.filter((l) => l.sale_id === p.sale_id);
        tables.pos_package_allocations = (tables.pos_package_allocations || []).filter(
          (x) => !lines.some((l) => l.id === x.line_id),
        );
        tables.pos_package_allocations.push(...p.lines.map((l, n) => ({ id: id(250 + n), ...l })));
        const sale = tables.pos_package_sales.find((x) => x.id === p.sale_id);
        sale.version++;
        sale.status = lines.every(
          (l) =>
            p.lines.filter((x) => x.line_id === l.id).reduce((n, x) => n + x.quantity, 0) ===
            l.quantity,
        )
          ? 'complete'
          : 'pending';
        return reply(sale.id);
      }
      if (name === 'update_retail_customer_contact') {
        const customer = tables.customers.find((c) => c.id === p.customer_id)!;
        customer.name = p.name;
        customer.phone = p.phone?.replace(/[\s().-]/g, '') || null;
        return reply(customer.id);
      }
      if (name === 'pos_summary')
        return reply({
          balance: 40000,
          sales: [
            {
              id: id(111),
              sale_date: day,
              created_at: new Date().toISOString(),
              customer_name: 'Khách kiểm thử',
              net_amount: 40000,
              collected_amount: 40000,
              note: 'Giao quầy trái',
              items: [{ name: 'Bánh donut', pieces: 10, amount: 40000 }],
            },
          ],
        });
      if (name === 'submit_pos_close') {
        tables.pos_cash_closes = [
          {
            id: id(120),
            user_id: id(1),
            business_date: day,
            created_at: new Date().toISOString(),
            expected_amount: p.expected_amount,
            counted_amount: p.counted_amount,
            note: p.note,
            status: 'pending',
          },
        ];
        return reply(id(120));
      }
      if (name === 'review_pos_close') {
        tables.pos_cash_closes![0].status = p.action;
        return reply(id(120));
      }
      if (name === 'create_pos_customer') {
        tables.customers.push({
          id: id(110),
          code: 'TEST_NEW',
          name: p.name,
          phone: p.phone || null,
          route_id: p.route_id,
          customer_type: 'Bạn hàng',
          is_active: true,
          default_discount_pct: 0,
          credit_policy: 'limited',
          credit_limit: 0,
          payment_terms_days: 0,
        });
        return reply(id(110));
      }
      if (name === 'post_pos_sale') {
        tables.sales.push({
          id: id(111),
          customer_id: p.customer_id,
          sale_date: day,
          net_amount: p.expected_total,
          collected_amount: p.expected_total,
          note: p.note,
          created_by: id(1),
        });
        return reply(id(111));
      }
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
        return reply(
          tables.app_members.filter((m) => `eq.${m.user_id}` === url.searchParams.get('user_id')),
        );
      return reply(tables[name] ?? []);
    }
    return reply({});
  });
  return { tables, calls };
}
async function login(page: Page, staff = false) {
  await page.goto('/');
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0912345678');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('TEST_PASSWORD_ONLY');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  if (staff)
    await expect(page.getByRole('tab', { name: 'Bán theo số lượng', exact: true })).toBeVisible();
  if (staff) await page.getByRole('button', { name: 'Trang chính', exact: true }).click();
  await expect(page.getByText('Chào ngày mới.')).toBeVisible();
}
test('real POS keeps checkout pinned, creates customer and posts quantity/notes with full-cash intent', async ({
  page,
}) => {
  const { calls } = await mock(page, 'staff');
  await login(page, true);
  await page.getByRole('tab', { name: 'POS', exact: true }).click();
  await page.getByRole('tab', { name: 'Chọn theo món', exact: true }).click();
  const total = page.getByLabel('Tổng tiền và chốt POS');
  await expect(total).toBeVisible();
  const before = await total.boundingBox();
  expect(before!.y + before!.height).toBeLessThanOrEqual(844);
  await page.getByRole('button', { name: 'Chọn hoặc tạo khách POS', exact: true }).click();
  await page.getByLabel('Tìm khách POS', { exact: true }).fill('Bạn hàng mới kiểm thử');
  await page.getByRole('button', { name: 'Tạo khách & bán ngay', exact: true }).click();
  await expect(page.getByText('Bạn hàng mới kiểm thử', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm 1 bì Bánh donut', exact: true }).click();
  await page.getByRole('button', { name: 'Xem giỏ hàng POS', exact: true }).click();
  await page.getByRole('button', { name: 'Tăng số bì Bánh donut', exact: true }).click();
  await page.getByLabel('Số bì Bánh donut', { exact: true }).fill('3');
  await expect(page.getByLabel('Tổng bì POS', { exact: true })).toHaveText('Tổng bì: 3');
  await page.getByLabel('Ghi chú POS', { exact: true }).fill('Giao quầy bên trái');
  await page.screenshot({ path: 'test-output/screenshots/iphone-pos-populated.png' });
  const footer = await total.boundingBox();
  expect(Math.abs(footer!.y - before!.y)).toBeLessThan(2);
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(844);
  await page.getByRole('button', { name: 'Chốt bán', exact: true }).click();
  await expect(
    page.getByText('Đã ghi bán và thu đủ tiền mặt. Chọn khách tiếp theo.', { exact: true }),
  ).toBeVisible();
  const body = calls.find((c) => c.name === 'post_pos_sale')!.body;
  expect(body.payload).toMatchObject({
    customer_id: id(110),
    expected_total: 120000,
    note: 'Giao quầy bên trái',
    lines: [{ product_id: id(4), order_qty: 3 }],
  });
  expect(body.request_key).toMatch(/[0-9a-f-]{36}/);
  expect(body.payload).not.toHaveProperty('account_id');
  await page.screenshot({ path: 'test-output/screenshots/iphone-real-pos.png' });
});
test('POS timeout locks basket and retries the exact same sale key without a new transaction', async ({
  page,
}) => {
  const { calls } = await mock(page);
  await login(page);
  await page.getByRole('tab', { name: 'POS', exact: true }).click();
  await page.getByRole('tab', { name: 'Chọn theo món', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn hoặc tạo khách POS', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn khách Khách kiểm thử', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm 1 bì Bánh donut', exact: true }).click();
  let interrupted: any;
  await page.route(`${project}/rest/v1/rpc/post_pos_sale`, async (route) => {
    interrupted = route.request().postDataJSON();
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Chốt bán', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Thử lại yêu cầu', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Thêm 1 bì Bánh donut', exact: true }),
  ).toBeDisabled();
  await page.unroute(`${project}/rest/v1/rpc/post_pos_sale`);
  await page.getByRole('button', { name: 'Thử lại yêu cầu', exact: true }).click();
  await expect(
    page.getByText('Đã ghi bán và thu đủ tiền mặt. Chọn khách tiếp theo.', { exact: true }),
  ).toBeVisible();
  expect(calls.find((c) => c.name === 'post_pos_sale')!.body).toEqual(interrupted);
});
test('POS draft survives navigation and reload, then clears after successful checkout', async ({
  page,
}) => {
  await mock(page);
  await login(page);
  await page.getByRole('tab', { name: 'POS', exact: true }).click();
  await page.getByRole('tab', { name: 'Chọn theo món', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn hoặc tạo khách POS', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn khách Khách kiểm thử', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm 1 bì Bánh donut', exact: true }).click();
  await page.getByRole('button', { name: 'Xem giỏ hàng POS', exact: true }).click();
  await page.getByLabel('Ghi chú POS', { exact: true }).fill('Giữ giỏ khi quay lại');
  await page.getByRole('button', { name: 'Trang chính', exact: true }).click();
  await page.getByRole('tab', { name: 'POS', exact: true }).click();
  await page.getByRole('tab', { name: 'Chọn theo món', exact: true }).click();
  await page.getByRole('button', { name: 'Xem giỏ hàng POS', exact: true }).click();
  await expect(page.getByLabel('Ghi chú POS', { exact: true })).toHaveValue('Giữ giỏ khi quay lại');
  await expect(
    page.getByText('Đã khôi phục giỏ đang bán. Giá và quyền truy cập được kiểm tra lại.', {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Số bì Bánh donut', { exact: true })).toHaveValue('1');
  await page.reload();
  await page.getByRole('tab', { name: 'POS', exact: true }).click();
  await page.getByRole('tab', { name: 'Chọn theo món', exact: true }).click();
  await page.getByRole('button', { name: 'Xem giỏ hàng POS', exact: true }).click();
  await expect(page.getByLabel('Ghi chú POS', { exact: true })).toHaveValue('Giữ giỏ khi quay lại');
  await page.getByRole('button', { name: 'Chốt bán', exact: true }).click();
  await expect(
    page.getByText('Đã ghi bán và thu đủ tiền mặt. Chọn khách tiếp theo.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'POS', exact: true }).click();
  await page.getByRole('tab', { name: 'Chọn theo món', exact: true }).click();
  await expect(page.getByLabel('Số bì Bánh donut', { exact: true })).toHaveCount(0);
});
test('personal sales and cash close submits counted cash, then waits for manager', async ({
  page,
}) => {
  const { calls } = await mock(page, 'staff');
  await login(page, true);
  await page.getByRole('tab', { name: 'Thêm', exact: true }).click();
  await page.getByRole('button', { name: 'Bán hàng của tôi / Chốt tiền', exact: true }).click();
  await expect(page.getByText('Ghi chú: Giao quầy trái', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chốt tiền / bàn giao', exact: true }).click();
  await page.getByLabel('Tiền thực đếm (đồng)', { exact: true }).fill('39000');
  await page
    .getByLabel('Ghi chú chênh lệch / bàn giao', { exact: true })
    .fill('Thiếu 1.000 cần đối chiếu');
  await page.getByRole('button', { name: 'Gửi phiếu chốt', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Đang chờ quản lý nhận tiền', exact: true }),
  ).toBeDisabled();
  expect(calls.find((c) => c.name === 'submit_pos_close')!.body.payload).toEqual({
    expected_amount: 40000,
    counted_amount: 39000,
    note: 'Thiếu 1.000 cần đối chiếu',
  });
  await expect(page.getByRole('button', { name: 'Nhận tiền', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-output/screenshots/iphone-pos-close.png', fullPage: true });
});
test('manager receives a cash handover into a company account', async ({ page }) => {
  const { tables, calls } = await mock(page);
  tables.pos_cash_closes = [
    {
      id: id(120),
      user_id: id(9),
      business_date: day,
      created_at: new Date().toISOString(),
      expected_amount: 40000,
      counted_amount: 39000,
      note: 'Thiếu 1.000',
      status: 'pending',
    },
  ];
  await login(page);
  await page.getByRole('tab', { name: 'Thêm', exact: true }).click();
  await page.getByRole('button', { name: 'Bán hàng của tôi / Chốt tiền', exact: true }).click();
  await page.getByRole('button', { name: 'Nhận tiền', exact: true }).click();
  await page.getByRole('button', { name: /Quỹ nhận tiền/ }).click();
  await page.getByRole('button', { name: 'Tiền mặt kiểm thử', exact: true }).click();
  await page.getByRole('button', { name: 'Đã nhận đủ tiền', exact: true }).click();
  await expect(page.getByText('Đã nhận tiền · Thiếu 1.000', { exact: true })).toBeVisible();
  expect(calls.find((c) => c.name === 'review_pos_close')!.body.payload).toMatchObject({
    close_id: id(120),
    action: 'received',
    destination_id: id(8),
  });
});
test('staff updates retail customer contact from a completed order without changing the order', async ({
  page,
}) => {
  const { tables, calls } = await mock(page, 'staff');
  tables.customers[0].customer_type = 'Khách lẻ';
  tables.customer_orders.push({
    id: id(50),
    customer_id: id(2),
    route_id: id(3),
    status: 'completed',
    delivery_date: day,
    created_at: new Date().toISOString(),
    version: 3,
    discount_pct: 0,
    note: 'Đơn đã giao',
  });
  const original = JSON.stringify(tables.customer_orders);
  await login(page, true);
  await page.getByRole('tab', { name: 'Đơn hàng', exact: true }).click();
  await page.getByText('Khách kiểm thử', { exact: true }).click();
  await page.getByRole('button', { name: 'Cập nhật thông tin khách', exact: true }).click();
  await page.getByLabel('Tên khách', { exact: true }).fill('Chị Lan');
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0912 345 678');
  await page.getByRole('button', { name: 'Lưu thông tin khách', exact: true }).click();
  await expect(page.getByText('Chị Lan', { exact: true })).toBeVisible();
  await expect(page.getByText('0912345678', { exact: true })).toBeVisible();
  expect(
    calls.find((c) => c.name === 'update_retail_customer_contact')!.body.payload,
  ).toMatchObject({
    customer_id: id(2),
    name: 'Chị Lan',
    expected_name: 'Khách kiểm thử',
    expected_phone: null,
  });
  expect(JSON.stringify(tables.customer_orders)).toBe(original);
});
test('phone-only login, owner provision and self password change', async ({ page }) => {
  const { calls } = await mock(page);
  await page.goto('/');
  await expect(page.getByLabel('Email', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Nhận mã xác minh', { exact: true })).toHaveCount(0);
  await login(page);
  await page.getByRole('tab', { name: 'Thêm', exact: true }).click();
  await page.getByText('Đội ngũ & phân quyền', { exact: true }).click();
  await page.getByRole('button', { name: 'Cấp tài khoản mới', exact: true }).click();
  await page.getByLabel('Họ tên', { exact: true }).fill('Nhân viên mới');
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0987654321');
  await page.getByLabel('Mật khẩu ban đầu', { exact: true }).fill('INITIAL_TEST_PASSWORD');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('INITIAL_TEST_PASSWORD');
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  await expect(page.getByText('Nhân viên mới', { exact: true })).toBeVisible();
  expect(calls.find((c) => c.name === 'phone-accounts')?.body).toMatchObject({
    action: 'create',
    phone: '+84987654321',
    role: 'staff',
  });
  expect(
    await page.evaluate(() => JSON.stringify(sessionStorage).includes('INITIAL_TEST_PASSWORD')),
  ).toBe(false);
  await page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click();
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('RESET_TEST_PASSWORD');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('RESET_TEST_PASSWORD');
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  expect(calls.filter((c) => c.name === 'phone-accounts').at(-1)?.body.action).toBe('reset');
  await page.getByLabel('Quay lại mục Thêm').click();
  await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('NEW_SELF_TEST_PASSWORD');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('NEW_SELF_TEST_PASSWORD');
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đổi mật khẩu', exact: true })).toBeVisible();
  expect(calls.find((c) => c.name === 'change-password')?.body.password).toBe(
    'NEW_SELF_TEST_PASSWORD',
  );
});
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
  await login(page, true);
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

test('POS separates catalog and cart, keeps search pinned and supports safe quantity editing', async ({
  page,
}) => {
  const { tables, calls } = await mock(page, 'staff');
  await page.setViewportSize({ width: 390, height: 700 });
  for (let n = 0; n < 20; n++) {
    tables.products.push({
      ...tables.products[0],
      id: id(500 + n),
      sku: `TEST_${n}`,
      name: `Bánh thử ${n}`,
      category: 'Bánh ngọt',
    });
    tables.product_units.push({ ...tables.product_units[0], product_id: id(500 + n) });
    tables.selling_prices.push({
      ...tables.selling_prices[0],
      id: id(600 + n),
      product_id: id(500 + n),
    });
  }
  await login(page, true);
  await page.getByRole('tab', { name: 'POS', exact: true }).click();
  await page.getByRole('tab', { name: 'Chọn theo món', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn hoặc tạo khách POS', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn khách Khách kiểm thử', exact: true }).click();
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  const menu = page.getByTestId('pos-menu');
  const tiles = menu.getByRole('button');
  const firstTile = await tiles.nth(0).boundingBox();
  const fourthTile = await tiles.nth(3).boundingBox();
  const twelfthTile = await tiles.nth(11).boundingBox();
  const checkoutFooter = await page
    .getByLabel('Tổng tiền và chốt POS', { exact: true })
    .boundingBox();
  expect(firstTile!.y).toBeLessThanOrEqual(225);
  expect(firstTile!.height).toBeLessThanOrEqual(96);
  expect(fourthTile!.y).toBe(firstTile!.y);
  expect(twelfthTile!.y + twelfthTile!.height).toBeLessThanOrEqual(checkoutFooter!.y);
  expect(checkoutFooter!.height).toBeLessThanOrEqual(72);
  await expect(page.getByText('POS · Bán nhanh', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-output/screenshots/pos-compact-iphone.png' });
  expect(await menu.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await page.getByTestId('pos-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.getByLabel('Tìm món POS', { exact: true })).toBeInViewport();
  await page.getByTestId('pos-scroll').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: 'test-output/screenshots/pos-menu-single-scroll.png' });
  await page.getByRole('button', { name: 'Thêm 1 bì Bánh donut', exact: true }).click();
  await page.getByRole('button', { name: 'Xem giỏ hàng POS', exact: true }).click();
  const qty = page.getByLabel('Số bì Bánh donut', { exact: true });
  await expect(qty).toBeInViewport();
  await qty.fill('');
  await expect(qty).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chốt bán', exact: true })).toBeDisabled();
  await qty.pressSequentially('2');
  await expect(qty).toHaveValue('2');
  await qty.fill('0');
  await expect(qty).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chốt bán', exact: true })).toBeDisabled();
  await qty.fill('2');
  await page.getByRole('button', { name: 'Về menu món', exact: true }).click();
  await expect(page.getByLabel('Tìm món POS', { exact: true })).toBeInViewport();
  await page.getByLabel('Tìm món POS', { exact: true }).fill('donut');
  await expect(menu.getByRole('button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Chốt bán', exact: true }).click();
  await expect(
    page.getByText('Đã ghi bán và thu đủ tiền mặt. Chọn khách tiếp theo.', { exact: true }),
  ).toBeVisible();
  expect(calls.find((c) => c.name === 'post_pos_sale')!.body.payload).toMatchObject({
    expected_total: 80000,
    lines: [{ product_id: id(4), order_qty: 2 }],
  });
});

test('POS shows menu beside cart on tablet and desktop, retains basket when resized to phone', async ({
  page,
}) => {
  const { tables } = await mock(page);
  for (let n = 0; n < 30; n++) {
    tables.products.push({
      ...tables.products[0],
      id: id(700 + n),
      sku: `PA_${n}`,
      name: n === 0 ? 'Bánh chiên xù' : n === 1 ? 'Bánh bao 2 màu' : `Bánh ngọt ${n}`,
      category: 'Bánh ngọt',
    });
    tables.product_units.push({ ...tables.product_units[0], product_id: id(700 + n) });
    tables.selling_prices.push({
      ...tables.selling_prices[0],
      id: id(800 + n),
      product_id: id(700 + n),
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.getByRole('tab', { name: 'POS', exact: true }).click();
  await page.getByRole('tab', { name: 'Chọn theo món', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn hoặc tạo khách POS', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn khách Khách kiểm thử', exact: true }).click();
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm 1 bì Bánh donut', exact: true }).click();
  const qty = page.getByLabel('Số bì Bánh donut', { exact: true });
  await qty.fill('2.5');
  await page.getByRole('button', { name: 'Thêm 1 bì Bánh chiên xù', exact: true }).click();
  await expect(page.getByTestId('pos-menu').getByText('Xù', { exact: true })).toBeVisible();
  await expect(page.getByTestId('pos-menu').getByText('2 màu', { exact: true })).toBeVisible();
  await expect(
    page.getByTestId('pos-menu').getByText('1 bì · 10 cái', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Tổng bì POS', { exact: true })).toHaveText('Tổng bì: 3,5');
  const compactCard = await page
    .getByRole('button', { name: 'Thêm 1 bì Bánh donut', exact: true })
    .boundingBox();
  expect(compactCard!.height).toBeLessThanOrEqual(120);
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const catalog = await page.getByTestId('pos-catalog-pane').boundingBox();
    const cart = await page.getByTestId('pos-cart-pane').boundingBox();
    expect(cart!.x).toBeGreaterThanOrEqual(catalog!.x + catalog!.width - 1);
    await page.getByTestId('pos-scroll').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(page.getByLabel('Tìm món POS', { exact: true })).toBeInViewport();
    await expect(qty).toBeInViewport();
    await expect(qty).toHaveValue('2.5');
    await expect(page.getByRole('button', { name: 'Chốt bán', exact: true })).toBeInViewport();
    await page.getByTestId('pos-scroll').evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({ path: `test-output/screenshots/pos-split-${width}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Tìm món POS', { exact: true }).fill('khong co mon nay');
  await expect(page.getByText('Chưa tìm thấy món', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xem tất cả món', exact: true }).click();
  await page.getByLabel('Tìm món POS', { exact: true }).fill('banh donut');
  await expect(page.getByTestId('pos-menu').getByRole('button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Xem giỏ hàng POS', exact: true }).click();
  await expect(qty).toHaveValue('2.5');
  await page.getByRole('button', { name: 'Tiếp tục chọn món', exact: true }).click();
  await expect(page.getByLabel('Tìm món POS', { exact: true })).toHaveValue('banh donut');
  await page.getByRole('button', { name: 'Xóa tìm món', exact: true }).click();
  await page.screenshot({ path: 'test-output/screenshots/pos-menu-redesigned.png' });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole('button', { name: 'Chốt bán', exact: true })).toBeInViewport();
});
