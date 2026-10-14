# Phác thảo Phúc An Mobile sau khảo sát DB

Ngày 14/10/2026. Bản thiết kế chức năng sơ bộ dựa trên DB đã khảo sát. Người dùng đã xác nhận app nội bộ và cả hai loại đơn. Các tên bảng bổ sung bên dưới là đề xuất, chưa tạo trong Supabase.

## Phạm vi phiên bản đầu

Ưu tiên nhân viên nhận đơn, tra giá, xem khách theo tuyến, theo dõi giao và nhắc chăm sóc; chủ/quản lý duyệt giá, mua nguyên liệu, kiểm soát công nợ và thu tiền. Chưa đưa lương, quản lý tài sản hay kế hoạch sản xuất đầy đủ vào mobile MVP, dù DB có dữ liệu.

| Chức năng | Dữ liệu sẵn có | Cần bổ sung |
|---|---|---|
| Hồ sơ khách | customers, routes, sales, receivables | Địa chỉ, liên hệ, nhân viên phụ trách, lịch sử chăm sóc, hạn thanh toán |
| CRM | customers.note | customer_activities, customer_tasks; trạng thái chăm sóc và kết quả |
| Giá bán | products.list_price/wholesale_price | Giá theo khách, ngày hiệu lực, đơn vị giá, lịch sử và quyền override |
| Đơn khách đặt | Danh mục, alias, quy ước bì | customer_orders, customer_order_items, allocations, trạng thái và ngày giao |
| Giao / bán | sales, sale_items, returns, create_sale_order | Contract ghi bán mới, liên kết order/delivery, snapshot và idempotency |
| Mua nguyên liệu | materials, suppliers, material_prices | purchase_orders/items, goods_receipts/items, supplier_payables |
| Thu / công nợ | receivables, cash_accounts/movements | RPC thu nợ, phân bổ thanh toán và đối soát trạng thái |

## Điều hướng trên điện thoại

5 mục: Hôm nay · Đơn hàng · Khách hàng · Giá · Thêm. “Tạo đơn” nổi bật trong Đơn hàng; tab con “Khách đặt / Mua nguyên liệu”. Thêm chứa công nợ, kho nguyên liệu, nhà cung cấp, thành viên và cài đặt theo quyền.

```text
HÔM NAY
Ngày làm việc · tuyến được phân công
Đơn cần xử lý | Giao hôm nay | Công việc chăm sóc
[Tạo đơn khách] [Ghi chăm sóc]
Danh sách việc: ưu tiên, giờ hẹn, người phụ trách
Quản lý: đơn mua chờ duyệt, thu tiền cần đối soát

ĐƠN KHÁCH ĐẶT
Tìm mã đơn / khách · trạng thái · ngày giao · tuyến
Tạo đơn:
  1. Khách + điểm giao + ngày giao
  2. Sản phẩm / tên khách hay gọi
  3. Số bì đặt → số cái → đơn vị giá → thành tiền
  4. Cảnh báo thiếu giá / nhóm cần phân bổ
  5. Lưu nháp / xác nhận theo quyền
Chi tiết: dòng hàng · giao từng đợt · trả · thu · lịch sử

HỒ SƠ KHÁCH
Tên · loại khách · tuyến · phụ trách
[Gọi khi có số] [Tạo đơn] [Ghi chăm sóc]
Tổng quan | Đơn | Công nợ | Chăm sóc | Thông tin
Thiếu số/địa chỉ: hiện “Chưa cập nhật”

GIÁ
Giá bán | Giá nguyên liệu (quản lý)
Tên · giá và đơn vị rõ ràng · ngày hiệu lực
Chi tiết: giá theo khách, quy đổi, lịch sử đổi giá
Giá vốn chỉ quản lý xem và gắn nhãn “ước tính”

MUA NGUYÊN LIỆU
Nhà cung cấp → nguyên liệu → quy cách mua
Số bao/thùng → lượng cơ sở → giá mua
Ngày dự kiến nhận · điều khoản thanh toán
Nháp → gửi duyệt → xác nhận → nhận từng phần → đóng
```

Không dùng các số giao dịch giả làm dashboard thật. DB bán hàng còn trống thì hiển thị trạng thái bắt đầu; số liệu demo nếu dùng phải có nhãn rõ. Tồn kho hiện ngày snapshot, giá thiếu không thay bằng 0. Nhân viên không được thấy giá vốn/lương nếu chưa có quyền tương ứng.

## Luồng nghiệp vụ

Đơn khách: nháp → xác nhận → đang thực hiện → giao một phần → hoàn tất; có hủy với lý do. Trạng thái thanh toán độc lập. Đơn nháp chưa tạo doanh thu/công nợ. Alias nhóm giữ yêu cầu gốc và allocations SKU riêng; tổng số cái phân bổ phải khớp yêu cầu trước chốt giao. Khi xác nhận, đóng băng đơn vị/giá/chiết khấu; chỉnh sau đó tạo revision/audit.

Giao hàng: xác nhận lượng giao/trả theo dòng và đợt; sinh chứng từ bán tương ứng với quy tắc ghi nhận được chốt. Không trừ trả hai lần. Thu tiền tạo cash_movements và phân bổ tới hóa đơn/công nợ trong một transaction. Hoàn/đảo tiền ghi giao dịch đảo, không xóa dòng cũ.

Đơn mua: nháp → chờ duyệt → xác nhận → nhận một phần → nhận đủ → đóng; hủy phần chưa nhận với lý do. Tạo PO chưa tăng tồn/chưa ghi chi tiền. Nhận hàng mới tạo goods_receipt và lượng nhập cơ sở; invoice nhà cung cấp tạo payable theo quy tắc được chốt; thanh toán ghi ledger và allocation. Giá mua thực trên receipt/invoice phải tách khỏi lịch sử báo giá material_prices.

CRM tối thiểu: ghi cuộc gọi/ghé thăm/ghi chú, hẹn việc tiếp theo, người phụ trách, trạng thái hoàn thành. Hồ sơ khách liên kết đơn/công nợ/timeline. Chưa cần pipeline marketing phức tạp ở giai đoạn đầu.

## Mô hình bổ sung đề xuất

| Thực thể | Trường / invariant quan trọng |
|---|---|
| customer_orders | customer_id, route_id, delivery_address_snapshot, requested_delivery_at, status, created_by, version, idempotency_key UNIQUE |
| customer_order_items | order_id, product_id nullable cho dòng chưa phân bổ, requested_name, order_unit, order_qty, pieces_per_unit_snapshot, pieces_qty, price_unit, unit_price_snapshot, discount, line_total |
| order_item_allocations | order_item_id, product_id, pieces_qty; kiểm tra tổng allocations, không đoán phân bổ |
| deliveries / delivery_items | order_id, ngày giao, giao/trả theo SKU, chứng từ nguồn; chặn tổng vượt số lượng hợp lệ |
| product_units | product_id, unit_code, pieces_per_unit, hiệu lực; không sửa pack_qty cũ hàng loạt |
| selling_prices / customer_price_overrides | product_id, customer_id nếu có, price_unit, amount, effective_from/to, approved_by; chặn khoảng hiệu lực mâu thuẫn |
| customer_contacts / addresses | customer_id FK, số điện thoại, người liên hệ, địa chỉ, mặc định giao; xác định chính sách trùng số |
| customer_activities / tasks | customer_id, assigned_to, loại, occurred_at/due_at, trạng thái, kết quả, created_by |
| purchase_orders / items | supplier_id, trạng thái, purchase_unit, qty, base_qty_snapshot, unit_price, ngày nhận dự kiến |
| goods_receipts / items | PO item, qty_received, base_qty, unit_cost, ngày nhận, idempotency; không nhận vượt PO ngoài quyền override |
| supplier_payables / payment_allocations | supplier invoice, amount, due_date, payment ledger id, amount allocated; chặn phân bổ vượt tiền/nợ |
| audit_events | actor, action, entity, revision, thời điểm; không ghi secrets/token |
| user_assignments | app_members.user_id, tuyến/khách được giao; liên kết employees riêng khi cần |

Chọn hệ cơ sở theo cái cho sản phẩm và materials.base_unit cho nguyên liệu. Hệ số quy đổi snapshot luôn >0. Lưu tiền/số lượng trong numeric ở Postgres; client tránh phép tính tiền bằng floating point thiếu quy tắc làm tròn. Số lượng bì lẻ, làm tròn VND, thu dư/đặt cọc cần chốt trước contract.

## Ma trận quyền đề xuất, chưa áp dụng

| Nghiệp vụ | Owner | Manager | Staff |
|---|---|---|---|
| Thành viên và quyền | Quản trị | Không tự nâng quyền | Không |
| Khách / CRM | Toàn bộ | Theo phạm vi quản lý | Khách/tuyến được giao |
| Đơn khách | Toàn bộ | Duyệt/chốt | Tạo nháp, xử lý theo phân công |
| Giá | Duyệt/chỉnh | Theo quyền được cấp | Tra giá; không tùy ý override |
| Mua nguyên liệu | Duyệt | Tạo/duyệt theo hạn mức | Nhận hàng khi được phân công |
| Thu / đảo tiền | Toàn bộ | Ghi/đảo theo quyền | Ghi đề nghị thu; chưa post ledger |
| Lương / giá vốn | Có | Theo quyền cụ thể | Không mặc định |

Các quyền phải được DB/RPC cưỡng chế; ẩn nút trong app chỉ là UX. Không mở SELECT rules bằng policy thành viên chung nếu thông tin scope cần giới hạn theo tuyến/khách.

## Kiến trúc sơ bộ

Đề xuất React Native + Expo + TypeScript để làm Android/iOS từ một codebase; đây là lựa chọn sơ bộ, chưa cài dependency. Supabase có [hướng dẫn Expo React Native](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native). Cần xác định nền tảng thử nghiệm đầu tiên và yêu cầu máy in/quét mã trước khi chốt framework.

Mobile → Supabase Auth → đọc bảng/view với publishable key + RLS; ghi nhiều bảng qua RPC transaction có kiểm tra quyền, version và idempotency. Tác vụ tích hợp bí mật/import/notification có thể qua Edge Functions khi cần. Không đưa service_role/secret key vào mobile; [mô hình bảo vệ frontend Supabase](https://supabase.com/docs/guides/database/secure-data).

Giai đoạn đầu ưu tiên online: cache danh mục và nháp local theo tài khoản, gắn nhãn chưa đồng bộ; không hiển thị đã chốt bán/thu khi server chưa xác nhận. Retry dùng cùng idempotency key. Đồng bộ ghi offline đầy đủ và xử lý xung đột là phạm vi riêng, không mặc định đã được hỗ trợ. Logout phải xóa cache nhạy cảm theo tài khoản.

## Cổng kiểm chứng trước dùng thật

- Nhân viên truy cập tuyến/khách khác bị từ chối; không đọc lương/giá vốn; thành viên bị khóa mất quyền ở DB.
- 1 bì đặt donut quy đổi 10 cái; kem bông bì đặt 10 cái khác bì giá 5 cái; giữ giá snapshot khi bảng giá đổi.
- Alias theo khách ưu tiên đúng scope; nhóm chưa phân bổ không được chốt giao; thiếu SKU/giá không tự về 0.
- Thiếu lines, qty âm/0, trả hết, trả vượt giao, thu vượt tiền, giảm giá vượt quyền có lỗi rõ ràng.
- Retry sau timeout không tạo thêm đơn/receipt/payment; cập nhật đồng thời phát hiện version conflict.
- Bán + thu + nợ cùng thành công hoặc cùng rollback; trả sau bán/đảo tiền không trừ hai lần.
- Nhận PO từng phần tăng tồn đúng hệ cơ sở; tạo PO không đổi tồn; snapshot và ledger reconcile theo một công thức.
- Ngày nghiệp vụ theo Việt Nam, kể cả quanh 00:00; báo cáo lịch sử không thay cost snapshot khi nhập giá mới.

## Các quyết định còn cần chốt

1. Staff có được trực tiếp thu tiền hay chỉ ghi đề nghị; ai duyệt đơn mua và hạn mức?
2. Tất cả đơn vẫn 1 bì=10 cái hay có ngoại lệ/đặt lẻ? Giá đang bán theo từng loại khách có đúng hai cột hiện tại không?
3. Ghi nhận bán khi giao hay khi đối soát cuối tuyến? Trả cùng đơn và trả sau ngày bán được xử lý thế nào?
4. Nguồn Google Sheets cũ còn tiếp tục ghi hay mobile trở thành nguồn chuẩn? DB có metadata google_sheets nhưng chưa xác minh nguồn/chu kỳ đồng bộ thực tế.
5. Thử Android hay iOS trước; mức độ cần làm việc mất mạng, in hóa đơn, quét mã?

Thứ tự triển khai: chốt nghiệp vụ/đơn vị/quyền → bổ sung schema và contract trên môi trường phát triển → app đăng nhập/danh mục/khách → đơn khách/CRM → giao bán/thu nợ → mua và nhận nguyên liệu → chạy thử với giao dịch kiểm chứng. Không tạo project Supabase mới vì đã có nguồn dữ liệu hiện hữu.
