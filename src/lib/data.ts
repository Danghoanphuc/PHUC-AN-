import { readRows, supabase, type Role, type Row } from './supabase';
export interface Data {
  packagePrices: Row<'pos_package_prices'>[];
  packageSales: Row<'pos_package_sales'>[];
  packageLines: Row<'pos_package_lines'>[];
  packageAllocations: Row<'pos_package_allocations'>[];
  aliases: Row<'order_product_name_rules'>[];
  assignments: Row<'route_assignments'>[];
  products: Row<'products'>[];
  units: Row<'product_units'>[];
  customers: Row<'customers'>[];
  routes: Row<'routes'>[];
  orders: Row<'customer_orders'>[];
  orderItems: Row<'customer_order_items'>[];
  requests: Row<'customer_order_requests'>[];
  prices: Row<'selling_prices'>[];
  sales: Row<'sales'>[];
  saleItems: Row<'sale_items'>[];
  receivables: Row<'receivables'>[];
  activities: Row<'customer_activities'>[];
  tasks: Row<'customer_tasks'>[];
  accounts: Row<'cash_accounts'>[];
  suppliers: Row<'suppliers'>[];
  purchases: Row<'purchase_orders'>[];
  purchaseItems: Row<'purchase_order_items'>[];
  materials: Row<'materials'>[];
  payables: Row<'supplier_payables'>[];
  cash: Row<'cash_movements'>[];
  members: Row<'app_members'>[];
  reviews: Row<'data_review_issues'>[];
  profiles: Row<'member_profiles'>[];
  stock: {
    material_id: string | null;
    name: string | null;
    base_unit: string | null;
    qty_on_hand: number | null;
    baseline_date: string | null;
    is_reconciled: boolean | null;
  }[];
}
export const emptyData: Data = {
  packagePrices: [],
  packageSales: [],
  packageLines: [],
  packageAllocations: [],
  aliases: [],
  assignments: [],
  products: [],
  units: [],
  customers: [],
  routes: [],
  orders: [],
  orderItems: [],
  requests: [],
  prices: [],
  sales: [],
  saleItems: [],
  receivables: [],
  activities: [],
  tasks: [],
  accounts: [],
  suppliers: [],
  purchases: [],
  purchaseItems: [],
  materials: [],
  payables: [],
  cash: [],
  members: [],
  reviews: [],
  stock: [],
  profiles: [],
};
export async function loadData(role: Role): Promise<Data> {
  const manager = role !== 'staff';
  const base = await Promise.all([
    readRows('products'),
    readRows('product_units'),
    readRows('customers'),
    readRows('routes'),
    readRows('customer_orders'),
    readRows('customer_order_items'),
    readRows('customer_order_requests'),
    readRows('selling_prices'),
    readRows('sales'),
    readRows('sale_items'),
    readRows('receivables'),
    readRows('customer_activities'),
    readRows('customer_tasks'),
  ]);
  const [
    products,
    units,
    customers,
    routes,
    orders,
    orderItems,
    requests,
    prices,
    sales,
    saleItems,
    receivables,
    activities,
    tasks,
  ] = base;
  let result: Data = {
    ...emptyData,
    products,
    units,
    customers,
    routes,
    orders,
    orderItems,
    requests,
    prices,
    sales,
    saleItems,
    receivables,
    activities,
    tasks,
  };
  if (manager) {
    const [
      accounts,
      suppliers,
      purchases,
      purchaseItems,
      materials,
      payables,
      cash,
      reviews,
      stockResult,
    ] = await Promise.all([
      readRows('cash_accounts'),
      readRows('suppliers'),
      readRows('purchase_orders'),
      readRows('purchase_order_items'),
      readRows('materials'),
      readRows('supplier_payables'),
      readRows('cash_movements'),
      readRows('data_review_issues'),
      supabase
        .from('v_material_stock')
        .select('material_id,name,base_unit,qty_on_hand,baseline_date,is_reconciled')
        .order('material_id'),
    ]);
    if (stockResult.error) throw stockResult.error;
    result = {
      ...result,
      accounts,
      suppliers,
      purchases,
      purchaseItems,
      materials,
      payables,
      cash,
      reviews,
      stock: stockResult.data ?? [],
    };
  }
  if (manager) result.members = await readRows('app_members');
  result.profiles = await readRows('member_profiles');
  [result.aliases, result.assignments] = await Promise.all([
    readRows('order_product_name_rules'),
    readRows('route_assignments'),
  ]);
  [result.packagePrices, result.packageSales, result.packageLines, result.packageAllocations] =
    await Promise.all([
      readRows('pos_package_prices'),
      readRows('pos_package_sales'),
      readRows('pos_package_lines'),
      readRows('pos_package_allocations'),
    ]);
  return result;
}
