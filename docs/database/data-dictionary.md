# Từ điển dữ liệu hiện trạng

Khảo sát ngày 14/10/2026 (Asia/Saigon). Project `phuc-an-db`, PostgreSQL 17. Chỉ metadata; không chứa bản ghi khách hàng, nhân viên hoặc thông tin đăng nhập.

## public.suppliers

Số bản ghi: 0. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| code | text | Có | — | UNIQUE |
| name | text | Không | — | — |
| phone | text | Có | — | — |
| note | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (code)`

## public.materials

Số bản ghi: 60. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| code | text | Không | — | UNIQUE |
| name | text | Không | — | — |
| base_unit | text | Không | — | — |
| category | text | Có | — | — |
| is_active | bool | Không | true | — |
| created_at | timestamptz | Không | now() | — |
| min_stock_qty | numeric | Không | 0 | — |

Khóa chính: id.

- `UNIQUE (code)`

## public.material_prices

Số bản ghi: 96. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| material_id | uuid | Không | — | — |
| supplier_id | uuid | Có | — | — |
| effective_date | date | Không | — | — |
| package_price | numeric | Không | — | package_price >= 0::numeric |
| package_qty | numeric | Không | — | package_qty > 0::numeric |
| package_unit | text | Không | — | — |
| unit_cost | numeric | Có | (package_price / package_qty) | — |
| note | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (material_id, supplier_id, effective_date, package_price, package_qty)`
- `FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE`
- `FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL`

## public.products

Số bản ghi: 28. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| sku | text | Không | — | UNIQUE |
| name | text | Không | — | — |
| sale_unit | text | Không | 'cai'::text | — |
| pack_qty | numeric | Không | 1 | pack_qty > 0::numeric |
| list_price | numeric | Có | — | — |
| wholesale_price | numeric | Có | — | — |
| category | text | Có | — | — |
| is_active | bool | Không | true | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (sku)`

## public.recipes

Số bản ghi: 20. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| product_id | uuid | Không | — | — |
| version_no | int4 | Không | 1 | — |
| effective_date | date | Không | CURRENT_DATE | — |
| yield_qty | numeric | Không | — | yield_qty > 0::numeric |
| yield_unit | text | Không | — | — |
| note | text | Có | — | — |
| is_active | bool | Không | true | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (product_id, version_no)`
- `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE`

## public.recipe_items

Số bản ghi: 206. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| recipe_id | uuid | Không | — | — |
| material_id | uuid | Không | — | — |
| qty | numeric | Không | — | qty >= 0::numeric |
| unit | text | Không | — | — |
| wastage_pct | numeric | Không | 0 | wastage_pct >= 0::numeric |
| note | text | Có | — | — |

Khóa chính: id.

- `UNIQUE (recipe_id, material_id)`
- `FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE`
- `FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE RESTRICT`

## public.routes

Số bản ghi: 4. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| code | text | Không | — | UNIQUE |
| name | text | Không | — | — |
| logistics_cost_per_day | numeric | Không | 0 | — |
| note | text | Có | — | — |
| is_active | bool | Không | true | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (code)`

## public.customers

Số bản ghi: 4. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| code | text | Có | — | UNIQUE |
| name | text | Không | — | — |
| route_id | uuid | Có | — | — |
| phone | text | Có | — | — |
| customer_type | text | Có | — | — |
| default_discount_pct | numeric | Không | 0 | default_discount_pct >= 0::numeric AND default_discount_pct <= 100::numeric |
| credit_limit | numeric | Có | — | — |
| is_active | bool | Không | true | — |
| created_at | timestamptz | Không | now() | — |
| note | text | Có | — | — |

Khóa chính: id.

- `UNIQUE (code)`
- `FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL`

## public.sales

Số bản ghi: 0. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| sale_date | date | Không | — | — |
| customer_id | uuid | Có | — | — |
| route_id | uuid | Có | — | — |
| invoice_no | text | Có | — | — |
| gross_amount | numeric | Không | 0 | — |
| discount_amount | numeric | Không | 0 | — |
| collected_amount | numeric | Không | 0 | — |
| payment_status | text | Không | 'unpaid'::text | payment_status = ANY (ARRAY['unpaid'::text, 'partial'::text, 'paid'::text]) |
| note | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |
| net_amount | numeric | Có | GREATEST((gross_amount - discount_amount), (0)::numeric) | — |

Khóa chính: id.

- `FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL`
- `FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL`

## public.sale_items

Số bản ghi: 0. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| sale_id | uuid | Không | — | — |
| product_id | uuid | Không | — | — |
| qty | numeric | Không | — | qty > 0::numeric |
| unit_price | numeric | Không | — | unit_price >= 0::numeric |
| discount_pct | numeric | Không | 0 | discount_pct >= 0::numeric AND discount_pct <= 100::numeric |
| line_amount | numeric | Có | ((qty * unit_price) * ((1)::numeric - (discount_pct / 100.0))) | — |
| qty_delivered | numeric | Không | 0 | — |
| qty_returned | numeric | Không | 0 | — |

Khóa chính: id.

- `FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE`
- `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT`

## public.returns

Số bản ghi: 0. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| return_date | date | Không | — | — |
| sale_id | uuid | Có | — | — |
| customer_id | uuid | Có | — | — |
| route_id | uuid | Có | — | — |
| product_id | uuid | Không | — | — |
| qty | numeric | Không | — | qty > 0::numeric |
| refund_amount | numeric | Không | 0 | — |
| reason | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL`
- `FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL`
- `FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL`
- `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT`

## public.expenses

Số bản ghi: 0. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| expense_date | date | Không | — | — |
| category | text | Không | — | — |
| route_id | uuid | Có | — | — |
| amount | numeric | Không | — | amount >= 0::numeric |
| is_fixed | bool | Không | false | — |
| note | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL`

## public.receivables

Số bản ghi: 0. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| sale_id | uuid | Có | — | — |
| customer_id | uuid | Có | — | — |
| due_date | date | Có | — | — |
| amount | numeric | Không | — | amount >= 0::numeric |
| paid_amount | numeric | Không | 0 | paid_amount >= 0::numeric |
| status | text | Không | 'open'::text | status = ANY (ARRAY['open'::text, 'partial'::text, 'paid'::text, 'overdue'::text]) |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE`
- `FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL`

## public.product_aliases

Số bản ghi: 1. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| alias_sku | text | Không | — | — |
| product_id | uuid | Không | — | — |
| source_system | text | Không | 'google_sheets'::text | — |
| note | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: alias_sku.

- `FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE`

## public.inventory_snapshots

Số bản ghi: 40. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| material_id | uuid | Không | — | — |
| snapshot_date | date | Không | — | — |
| opening_qty | numeric | Không | 0 | — |
| in_qty | numeric | Không | 0 | — |
| out_qty | numeric | Không | 0 | — |
| closing_qty | numeric | Không | 0 | — |
| source_system | text | Không | 'google_sheets'::text | — |
| source_ref | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (material_id, snapshot_date, source_system)`
- `FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE`

## public.inventory_transactions

Số bản ghi: 1. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| txn_date | date | Không | — | — |
| txn_no | text | Có | — | — |
| material_id | uuid | Không | — | — |
| txn_type | text | Không | — | txn_type = ANY (ARRAY['nhap'::text, 'xuat'::text, 'hao_hut'::text, 'dieu_chinh'::text]) |
| qty | numeric | Không | — | qty >= 0::numeric |
| unit_cost | numeric | Có | — | — |
| counterparty | text | Có | — | — |
| source_system | text | Không | 'google_sheets'::text | — |
| source_ref | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (txn_no, material_id, txn_type, qty)`
- `FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE RESTRICT`

## public.sync_runs

Số bản ghi: 1. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| source_system | text | Không | — | — |
| source_ref | text | Có | — | — |
| started_at | timestamptz | Không | now() | — |
| completed_at | timestamptz | Có | — | — |
| status | text | Không | 'running'::text | status = ANY (ARRAY['running'::text, 'success'::text, 'failed'::text, 'partial'::text]) |
| stats | jsonb | Không | '{}'::jsonb | — |
| note | text | Có | — | — |

Khóa chính: id.



## public.app_members

Số bản ghi: 0. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| user_id | uuid | Không | — | — |
| role | text | Không | 'staff'::text | role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]) |
| active | bool | Không | true | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: user_id.

- `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`

## public.employees

Số bản ghi: 6. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| code | text | Không | — | UNIQUE |
| name | text | Không | — | — |
| role_group | text | Không | — | role_group = ANY (ARRAY['direct_labor'::text, 'management'::text]) |
| is_active | bool | Không | true | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (code)`

## public.employee_compensation_terms

Số bản ghi: 6. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| employee_id | uuid | Không | — | — |
| effective_from | date | Không | — | — |
| effective_to | date | Có | — | — |
| monthly_salary | numeric | Không | 0 | monthly_salary >= 0::numeric |
| monthly_allowance | numeric | Không | 0 | monthly_allowance >= 0::numeric |
| monthly_attendance_bonus | numeric | Không | 0 | monthly_attendance_bonus >= 0::numeric |
| overtime_rate_per_hour | numeric | Không | 0 | overtime_rate_per_hour >= 0::numeric |
| default_overtime_hours_per_day | numeric | Không | 0 | default_overtime_hours_per_day >= 0::numeric |
| meal_cost_per_day | numeric | Không | 0 | meal_cost_per_day >= 0::numeric |
| costing_days_per_month | numeric | Không | 30 | costing_days_per_month > 0::numeric |
| note | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (employee_id, effective_from)`
- `FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE`

## public.fixed_costs

Số bản ghi: 12. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| code | text | Không | — | UNIQUE |
| name | text | Không | — | — |
| category | text | Không | — | — |
| cost_type | text | Không | 'fixed'::text | cost_type = ANY (ARRAY['fixed'::text, 'semi_variable'::text]) |
| monthly_amount_standard | numeric | Không | 0 | monthly_amount_standard >= 0::numeric |
| monthly_amount_min | numeric | Có | — | — |
| monthly_amount_max | numeric | Có | — | — |
| baseline_flour_kg_min | numeric | Có | — | — |
| baseline_flour_kg_max | numeric | Có | — | — |
| step_flour_kg | numeric | Có | — | — |
| step_monthly_amount | numeric | Có | — | — |
| effective_from | date | Không | — | — |
| effective_to | date | Có | — | — |
| is_active | bool | Không | true | — |
| note | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (code)`

## public.assets

Số bản ghi: 3. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| code | text | Không | — | UNIQUE |
| name | text | Không | — | — |
| acquisition_cost | numeric | Không | — | acquisition_cost >= 0::numeric |
| useful_life_months | int4 | Có | — | — |
| depreciation_method | text | Không | 'straight_line'::text | depreciation_method = ANY (ARRAY['straight_line'::text, 'manual'::text]) |
| monthly_depreciation | numeric | Không | — | monthly_depreciation >= 0::numeric |
| in_service_date | date | Có | — | — |
| is_active | bool | Không | true | — |
| note | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (code)`

## public.production_daily

Số bản ghi: 3. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| production_date | date | Không | — | UNIQUE |
| gross_profit_estimate | numeric | Có | — | — |
| direct_labor_cost_estimate | numeric | Có | — | — |
| management_cost_estimate | numeric | Có | — | — |
| fixed_overhead_cost_estimate | numeric | Có | — | — |
| contribution_before_route_estimate | numeric | Có | — | — |
| estimate_status | text | Không | 'estimated'::text | estimate_status = ANY (ARRAY['estimated'::text, 'confirmed'::text]) |
| note | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (production_date)`

## public.production_daily_items

Số bản ghi: 50. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| production_daily_id | uuid | Không | — | — |
| product_id | uuid | Có | — | — |
| item_label | text | Không | — | — |
| reported_qty | numeric | Có | — | — |
| reported_unit | text | Có | — | — |
| estimated_output_qty | numeric | Có | — | — |
| estimated_output_unit | text | Có | — | — |
| estimated_gross_profit | numeric | Có | — | — |
| is_estimate | bool | Không | true | — |
| note | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (production_daily_id, item_label)`
- `FOREIGN KEY (production_daily_id) REFERENCES production_daily(id) ON DELETE CASCADE`
- `FOREIGN KEY (product_id) REFERENCES products(id)`

## public.cash_accounts

Số bản ghi: 2. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| code | text | Không | — | UNIQUE |
| name | text | Không | — | — |
| account_type | text | Không | — | account_type = ANY (ARRAY['cash'::text, 'bank'::text, 'other'::text]) |
| is_active | bool | Không | true | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (code)`

## public.cash_movements

Số bản ghi: 0. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| txn_date | date | Không | ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date | — |
| account_id | uuid | Không | — | — |
| direction | text | Không | — | direction = ANY (ARRAY['in'::text, 'out'::text]) |
| amount | numeric | Không | — | amount > 0::numeric |
| flow_class | text | Không | — | flow_class = ANY (ARRAY['operating'::text, 'investing'::text, 'financing'::text, 'transfer'::text, 'opening'::text]) |
| kind | text | Không | — | — |
| counterparty | text | Có | — | — |
| route_id | uuid | Có | — | — |
| customer_id | uuid | Có | — | — |
| sale_id | uuid | Có | — | — |
| receivable_id | uuid | Có | — | — |
| expense_id | uuid | Có | — | — |
| source_ref | text | Có | — | — |
| transfer_group | uuid | Có | — | — |
| reverses_id | uuid | Có | — | UNIQUE |
| idempotency_key | text | Có | — | UNIQUE |
| note | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |
| created_by | uuid | Có | auth.uid() | — |

Khóa chính: id.

- `FOREIGN KEY (sale_id) REFERENCES sales(id)`
- `UNIQUE (reverses_id)`
- `UNIQUE (idempotency_key)`
- `FOREIGN KEY (account_id) REFERENCES cash_accounts(id)`
- `FOREIGN KEY (route_id) REFERENCES routes(id)`
- `FOREIGN KEY (customer_id) REFERENCES customers(id)`
- `FOREIGN KEY (receivable_id) REFERENCES receivables(id)`
- `FOREIGN KEY (expense_id) REFERENCES expenses(id)`
- `FOREIGN KEY (reverses_id) REFERENCES cash_movements(id)`

## public.employee_attendance

Số bản ghi: 108. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| employee_id | uuid | Không | — | — |
| work_date | date | Không | — | — |
| start_time | time | Có | — | — |
| end_time | time | Có | — | — |
| day_fraction | numeric | Có | — | — |
| status | text | Không | — | status = ANY (ARRAY['worked'::text, 'off'::text, 'left_early'::text, 'makeup'::text, 'planned'::text]) |
| early_leave_minutes | int4 | Không | 0 | early_leave_minutes >= 0 |
| makeup_minutes | int4 | Không | 0 | makeup_minutes >= 0 |
| note | text | Có | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (employee_id, work_date)`
- `FOREIGN KEY (employee_id) REFERENCES employees(id)`

## public.compensation_policy_drafts

Số bản ghi: 1. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| id | uuid | Không | gen_random_uuid() | — |
| policy_code | text | Không | — | UNIQUE |
| title | text | Không | — | — |
| status | text | Không | 'draft'::text | status = ANY (ARRAY['draft'::text, 'approved'::text, 'archived'::text]) |
| proposed_on | date | Không | — | — |
| effective_from | date | Có | — | — |
| details | jsonb | Không | — | — |
| created_at | timestamptz | Không | now() | — |

Khóa chính: id.

- `UNIQUE (policy_code)`

## public.order_product_name_rules

Số bản ghi: 18. RLS: true.

| Cột | Kiểu | Nullable | Mặc định / sinh tự động | Ràng buộc |
|---|---|---|---|---|
| alias | text | Không | — | — |
| scope | text | Không | 'general'::text | — |
| canonical_name | text | Không | — | — |
| product_id | uuid | Có | — | — |
| member_skus | _text | Không | '{}'::text[] | — |
| order_unit | text | Không | 'bì'::text | — |
| pieces_per_order_unit | int4 | Không | 10 | pieces_per_order_unit > 0 |
| note | text | Có | — | — |
| confirmed_on | date | Không | — | — |

Khóa chính: alias, scope.

- `FOREIGN KEY (product_id) REFERENCES products(id)`
