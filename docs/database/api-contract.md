# Contract RPC cho mobile

Các RPC public là SECURITY INVOKER, gọi implementation private SECURITY DEFINER có kiểm tra auth/member/role/scope trong từng entrypoint. Client chỉ dùng publishable key + JWT của người dùng; không dùng service_role. private không được expose trong Data API. [Mô hình bảo vệ frontend](https://supabase.com/docs/guides/database/secure-data).

Mọi RPC ghi (trừ compatibility wrapper create_sale_order) nhận `{payload: object, request_key: string}` và trả UUID. request_key 8–200 ký tự, dùng UUID mới cho mỗi thao tác; khi retry giữ nguyên key và payload. Cùng actor/key nhưng payload hoặc operation đổi sẽ lỗi; bị khóa thành viên không được retry đọc kết quả cũ. `version` bắt buộc cho chỉnh nháp, chuyển trạng thái, post_delivery và receive_purchase_order. SQLSTATE 40001 là version conflict; tải lại dữ liệu rồi cho người dùng quyết định, không retry mù.

## Đơn khách

```ts
await supabase.rpc('save_customer_order', {
  request_key: crypto.randomUUID(),
  payload: {
    customer_id, delivery_date: '2026-10-14', note: '',
    lines: [{ product_id, order_qty: 1 }]
  }
})
```

order_qty theo bi10; 0.1 bì = 1 cái, không cho phần lẻ dưới 1 cái. Giá lấy từ selling_prices theo ngày giao, tier khách và customer override; không lấy unit_price từ client. customer_type Khách lẻ chọn retail, khác chọn wholesale. Manager có thể truyền discount_pct (0–100, tối đa 2 chữ số thập phân). Staff dùng default_discount_pct của khách.

Sửa nháp thêm order_id và version hiện tại; request_key mới. Nhân viên chỉ sửa nháp do mình tạo. Thay thế toàn bộ lines trong một transaction.

Dòng chưa ánh xạ: `{requested_name:'tên khách đặt',order_qty:2}`; lưu được nháp, chưa xác nhận. Nhóm phân bổ:

```json
{
  "requested_name": "bông lan lớn",
  "order_qty": 3,
  "allocations": [
    {"product_id": "UUID-SKU-1", "order_qty": 1},
    {"product_id": "UUID-SKU-2", "order_qty": 2}
  ]
}
```

Tổng allocations phải đúng order_qty, SKU thuộc nhóm nếu resolver xác định group. customer_order_requests giữ nguyên yêu cầu; customer_order_items giữ dòng đã phân bổ. Các UUID ở ví dụ là placeholder, không phải ID hợp lệ để gửi nguyên trạng.

`resolve_order_alias(customer_id,alias)` trả JSON status resolved/allocation_required/unresolved, product_id/member_skus và quy ước đặt. Alias đã bind customer_id ưu tiên general. Tên scope chưa bind không tự khớp bằng tên khách.

`transition_customer_order`: `{order_id,version,status:'confirmed'}` (manager/owner); hủy `{order_id,version,status:'cancelled',reason}`. Không chuyển trực tiếp completed bằng client.

`post_delivery` (manager/owner):

```json
{
  "order_id": "UUID-ORDER", "version": 2, "sale_date": "2026-10-14",
  "collected_amount": 10000, "account_id": "UUID-ACCOUNT",
  "credit_approval_reason": "Quản lý đã duyệt công nợ",
  "lines": [{"order_item_id":"UUID-LINE","delivered_pieces":10,"returned_pieces":0}]
}
```

Lượng giao/trả theo cái nguyên, server quy đổi sang đơn vị giá snapshot. Không trùng order_item_id, không vượt số đã đặt, không giao đơn chưa xác nhận. collected_amount <= giá trị bán net; khi >0 cần cash account active. receipt, sale, receivable và ledger cùng thành công hoặc cùng rollback. Kết quả là sale UUID; order version tăng và status partial/completed dựa trên lượng đã giao. Hàng trả không tự tạo một yêu cầu giao thay thế; nếu cần giao bù tạo/chỉnh yêu cầu nghiệp vụ riêng.

create_sale_order(payload) chỉ là compatibility wrapper: payload phải có contract post_delivery và request_key. Payload API cũ không được hỗ trợ.

## Thu nợ, trả hàng và đảo tiền

- collect_receivable: `{receivable_id,account_id,amount,txn_date?}`. Thu >0, không vượt số còn nợ; ngày thu không trước ngày bán. Trả cash movement UUID.
- return_sale_item: `{sale_item_id,returned_pieces,reason,return_date?,account_id?}`. Không vượt lượng còn bán; nếu trả khiến tiền đã thu vượt net mới, account_id là tài khoản hoàn tiền bắt buộc. Trả return UUID.
- reverse_cash_movement: `{movement_id,reason}`. Chỉ đảo sale_collection/debt_collection/supplier_payment chưa đảo; không đảo dòng reversal hoặc hoàn hàng. Nếu collection đã được refund và không còn đủ paid balance để đảo toàn bộ thì từ chối; cần nghiệp vụ điều chỉnh cụ thể thay vì tự tạo tiền âm.

receivables.amount là toàn bộ net hiện tại; paid_amount là thực thu net sau refund/reversal. Nợ còn = amount-paid_amount. sales.discount_amount sau trả muộn phản ánh điều chỉnh trả, không phải chiết khấu cộng thêm; chiết khấu gốc được lưu trong order/sale_items. Báo cáo dùng return_phase để tránh trừ hai lần.

## Mua và nhận nguyên liệu

save_purchase_order (manager/owner):

```json
{
  "supplier_id":"UUID-SUPPLIER","expected_date":"2026-10-14",
  "lines":[{"material_id":"UUID-MATERIAL","purchase_unit":"thùng",
    "quantity":2,"base_qty_per_unit":20,"unit_price":880000}]
}
```

quantity theo purchase_unit; base_qty_per_unit là lượng materials.base_unit trong 1 đơn vị mua, phải được người quản lý xác nhận. unit_price là tiền cho 1 đơn vị mua. Không suy ra hệ số từ nhãn package_unit của lịch sử import. Chỉnh nháp thêm purchase_order_id/version.

transition_purchase_order: `{purchase_order_id,version,status}` theo draft → submitted → confirmed; hủy có reason. Người quản lý có thể vừa tạo vừa duyệt ở MVP; chưa cấu hình hạn mức/phân tách người duyệt.

receive_purchase_order: `{purchase_order_id,version,received_date?,due_date?,invoice_no?,lines:[{purchase_order_item_id,quantity}]}`. Nhận không vượt phần chưa nhận. Trả receipt UUID; tạo inventory_transactions và payable theo receipt. Giá theo PO đã duyệt, chưa hỗ trợ invoice price variance.

pay_supplier: `{payable_id,account_id,amount,txn_date?}`. Trả cash movement UUID, không vượt phần payable còn nợ. Đảo qua reverse_cash_movement.

reconcile_material_stock: `{material_id,counted_qty,reason}`. counted_qty theo base_unit, phản ánh kiểm kê thật tại thời điểm thao tác. Server khóa material, lưu baseline/cutoff và audit, không xóa ledger. Kiểm kê phải tính cả hàng đã nhận trước cutoff; mobile không thể dùng số snapshot cũ như kiểm kê mới.

## Giá, alias và thành viên

POS: public.post_pos_sale(payload,request_key) trả UUID sale. Payload `{customer_id,expected_total,note?,lines:[{product_id,order_qty}],order_id?,version?}`; order_qty luôn là đơn vị bì đặt 10 cái. Chốt mặc định thu đủ tiền mặt vào wallet POS của actor, không nhận account_id/collected_amount/discount_pct do client gửi. expected_total phải khớp giá server hoặc snapshot đơn đã chốt; mismatch rollback cả giao dịch. Nhân viên chỉ thao tác trong customer scope; helper posting riêng không cấp execute cho authenticated/anon. Retry cùng actor/key/payload trả cùng sale.

public.create_pos_customer(payload,request_key) trả UUID customer. Payload `{name,phone?,route_id}`. Route phải active; staff cần route_assignments đúng actor/tuyến. Gán assigned_to tại server, customer_type Bạn hàng, credit_policy limited/limit 0. Không nhận cấp hạn mức/chiết khấu/phân công từ client.

- set_selling_price: `{product_id,customer_id?,price_tier:'retail'|'wholesale',amount,effective_from}`. Dùng product_units đã verified. Ngày mới phải sau giá cùng scope/tier mới nhất; đóng giá trước ngày hiệu lực mới. Giá đang snapshot trong đơn không đổi.
- bind_order_alias: `{alias,scope,customer_id}`. Manager xác nhận scope khách, cập nhật review tương ứng.
- manage_member: `{user_id,role:'owner'|'manager'|'staff',active:boolean}`. Chỉ owner. Auth user phải đã tồn tại; không tự tạo tài khoản/Auth email trong RPC, không cho owner tự hạ quyền/khóa mình.

Manager được INSERT/UPDATE các danh mục được cấp policy, gán route_assignments, customers.assigned_to/address/payment_terms_days/credit_policy. Mọi tài chính/đơn/price history chỉ ghi qua RPC. product_units là quy cách đơn vị giá; sửa quy cách không sửa snapshot giá cũ. Khi thay quy cách, tạo giá mới phù hợp, không đổi giá cũ ngầm.

## Đối soát POS

- `pos_summary()` không nhận actor từ client: trả số dư cộng dồn wallet POS và tối đa 200 lần bán gần nhất có created_by=auth.uid(), gồm tên khách/món, số lượng, thành tiền, ghi chú. Không trả giá vốn, ví hoặc giao dịch người khác. Cần membership active.
- `submit_pos_close(payload,request_key)`: `{expected_amount,counted_amount,note}`. Server tính lại số dư sau khóa wallet. expected_amount phải khớp; counted_amount nguyên không âm <1e12; khác sổ cần note. Một phiếu pending/actor. Không chuyển tiền ngay.
- `review_pos_close(payload,request_key)`: manager/owner, `{close_id,action:'received'|'rejected',destination_id?,note?}`. Received yêu cầu quỹ cash công ty active, không phải wallet POS. Chuyển counted_amount bằng hai bút toán transfer cùng transfer_group=close_id, không cộng doanh thu. Rejected cần lý do, không phát sinh tiền. Chênh lệch được giữ trên wallet; không tự xóa/ghi chi phí. Retry giữ nguyên kết quả.
- `pos_cash_closes`: authenticated chỉ SELECT, staff chỉ phiếu của mình, manager/owner thấy toàn bộ. Ghi qua RPC private definer được kiểm tra vai trò; wrappers public invoker. Phiếu received/rejected không sửa bằng API. Không có RPC đảo phiếu received trong phiên bản pilot.

## CRM và dữ liệu đọc

customer_activities cho phép INSERT `{customer_id,kind:'call'|'visit'|'note',body,occurred_at?}`, created_by phải là auth.uid. customer_tasks cho phép INSERT việc cho bản thân (staff) hoặc thành viên khác (manager); staff chỉ sửa status của việc được giao trong phạm vi khách. Không cho sửa created_by.

Đọc danh mục, customer_orders/requests/items, sales/items/returns/receivables bằng RLS. Manager đọc PO/receipts/payables, sale_item_costs, v_material_stock, cash views và data_review_issues. `v_material_stock.is_reconciled=false` hoặc baseline_date cũ phải được thể hiện rõ trong UX; qty NULL là chưa biết, không phải 0.

Date ISO YYYY-MM-DD; thời điểm ISO có timezone. Số tiền tối đa 2 chữ số thập phân theo numeric DB, số lượng lưu tối đa 4; reject NaN/infinite. Supabase sinh numeric thành number trong TS; phía mobile nên giữ input dạng chuỗi decimal và dùng phép tính decimal để hiển thị, server là nguồn xác nhận thành tiền.
