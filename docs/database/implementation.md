# Kết quả xử lý 6 đề xuất

Ngày 14/10/2026, Asia/Saigon. Đã triển khai vào project Supabase phuc-an-db bằng hai migrations; không tạo project hoặc branch trả phí.

## Kết quả theo đề xuất

| Đề xuất | Đã triển khai |
|---|---|
| 1. Đơn vị / giá / alias | product_units lưu quy cách giá và đặt riêng; 1 bì đặt = 10 cái, hỗ trợ số lượng tương đương cái nguyên. 32 giá sẵn có được sao chép sang lịch sử giá theo ngày hiệu lực, giữ nguyên giá nguồn. Alias có customer_id và resolver theo scope; nhóm có allocations, kiểm tra đúng SKU và tổng yêu cầu gốc. Các ánh xạ chưa xác minh được giữ trong data_review_issues. |
| 2. Phân quyền | Thay toàn bộ policy cũ bằng owner/manager/staff; staff chỉ khách được giao trực tiếp hoặc theo tuyến; không đọc lương, nguyên liệu/giá vốn. Ghi tài chính/đơn qua RPC, không cho client ghi trực tiếp; loại grants anon và TRUNCATE/REFERENCES/TRIGGER. Bảng rules có policy đọc theo scope; mọi bảng public có RLS. |
| 3. Đơn đặt tách bán | customer_orders/requests/items, nháp → xác nhận → giao một phần → hoàn tất hoặc hủy; giữ yêu cầu gốc, đóng băng giá/đơn vị/chiết khấu. Chống retry trùng bằng key+actor+payload, khóa giao dịch và kiểm tra version. Audit mỗi thao tác nghiệp vụ. |
| 4. Bán / thu / nợ | post_delivery ghi sale/items/returns/receivable/ledger nguyên tử. Công nợ lưu toàn bộ net và paid_amount; thu ban đầu khác thu nợ sau. Trả hết dòng được phép, trả sau bán giảm nợ và hoàn phần thu dư. Đảo thanh toán ghi dòng đảo; cash/inventory/audit có trigger bất biến. Ngày mặc định theo Việt Nam. |
| 5. Mua / nhận / tồn | purchase_orders/items, duyệt, nhận từng phần, goods_receipts/items, supplier_payables, pay_supplier và reversal. Tạo PO chưa tăng tồn/chi tiền; nhận hàng tăng nguyên liệu theo hệ cơ sở và ghi công nợ. v_material_stock dùng baseline cố định + ledger phát sinh; reconcile_material_stock nhận số kiểm kê thật và giữ lịch sử cũ. |
| 6. Kiểm chứng | 32 kịch bản trên PostgreSQL WASM với schema/cột chính xác của DB khảo sát; 28 assertion trên PostgreSQL thật trong transaction rollback. Advisor bảo mật trả lints rỗng. Advisor hiệu năng không còn FK thiếu index, chỉ có INFO index chưa được dùng. |

## Thay đổi đã áp dụng

- 20261014023700_mobile_operations_v1.sql
- 20261014030554_reporting_snapshots_v1.sql

46 bảng public sau triển khai (thêm 17 bảng), bảng private.operation_requests lưu idempotency. TypeScript types được sinh từ Supabase sau migration tại src/types/database.ts. File migration local đã khớp version trong lịch sử remote.

Giá vốn khi ghi bán được snapshot riêng trong sale_item_costs và chỉ manager/owner đọc; nhân viên không thấy giá vốn qua sale_items hoặc view margin. Thiếu BOM/giá nguyên liệu/quy đổi chắc chắn trả NULL, không đổi thành 0. Báo cáo tuyến lấy cost snapshot, trả sau bán tính vào ngày trả, bao gồm ngày chỉ có chi phí. Công thức cost hiện tại không lấy giá tương lai; overhead lọc ngày hiệu lực. Báo cáo tuyến vẫn là contribution ước tính, không phải lợi nhuận ròng; phí tuyến lấy cấu hình logistics_cost_per_day hiện tại.

## Bằng chứng kiểm thử

`npm test`: 32/32 pass. Kiểm tra:

- scope tuyến/khách, anon, nonmember, thành viên bị khóa; nhân viên không tự nâng quyền/duyệt/thu/mua;
- quy đổi donut 40.000đ, kem bông 35.000đ, bánh tiêu 15.000đ cho 1 bì đặt trong fixture;
- thiếu/malformed/empty lines, giá thiếu, sản phẩm inactive, alias nhóm, allocations sai tổng/SKU;
- version conflict, retry cùng key, đổi payload cùng key, giao từng phần, giao/trả vượt số lượng;
- thu ban đầu, thu nợ, trả hết/cùng giao/trả muộn, hoàn tiền, đảo thu/chi, rollback nguyên tử;
- PO không đổi tồn, nhận từng phần, công nợ nhà cung cấp, chống nhận vượt, kiểm kê không xóa ledger;
- giá mới không thay snapshot đơn/giá vốn, trả hàng vào đúng ngày báo cáo, expense-only day, thiếu giá vốn giữ NULL;
- chặn sửa/xóa/truncate ledger, RLS mọi bảng, không có SECURITY DEFINER trong public; NaN bị từ chối.

`tests/live-smoke.sql`: 28 assertion pass trên project thật. Kiểm thử diễn ra bằng tài khoản quản trị, chuyển role authenticated và JWT subject giả để thực thi RLS/RPC. Toàn bộ sản phẩm/khách/tài khoản/đơn/tiền giả đã rollback; xác minh lại 28 sản phẩm, 4 khách, 60 nguyên liệu, 1 inventory transaction nguồn; không còn TEST_% products. Đây là kiểm thử SQL authorization, chưa phải đăng nhập HTTP/Auth hay chạy app trên thiết bị.

Các kiểm thử retry và stale-version đã chạy. Chưa stress-test nhiều connection đồng thời hoặc lỗi mạng trên thiết bị; advisory lock/row lock có trong contract nhưng không coi test WASM tuần tự là bằng chứng chịu tải thực tế.

Advisor bảo mật: không có lint sau hai migrations. Advisor hiệu năng còn index chưa dùng là điều bình thường ở DB chưa có giao dịch; giữ lại index FK và lookup. [Giải thích unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## 21 mục dữ liệu còn cần đối chiếu thực tế

| Loại | Số mục | Cách xử lý |
|---|---:|---|
| unbound_alias_scope | 3 | Người quản lý chọn đúng customer_id cho tên scope rồi gọi bind_order_alias. Không tự coi Cô Năm=Năm hoặc Kon Thụp=Đak Kon Thụp. |
| unallocated_alias | 9 | Một phần là nhóm hợp lệ, một phần chưa có SKU. Nhóm dùng allocations; tên chưa có SKU giữ nháp cho tới khi chọn/bổ sung danh mục. |
| material_unit_review | 9 | Xác nhận kg/lít/cuộn/cái/phần và lượng cơ sở của package_qty từ chứng từ nguồn. Chưa sửa giá nguồn tự động. Cost của nguyên liệu có nhãn không chắc chắn được coi là chưa hoàn chỉnh. |

Đây là giới hạn dữ liệu nguồn, không thể hoàn tất bằng cách suy đoán. Danh sách được lưu tại data_review_issues, chỉ manager/owner đọc. Tồn ban đầu kế thừa snapshot ngày 24/09/2026 và gắn verified=false; cần kiểm kê thật bằng reconcile_material_stock trước khi coi là tồn đã đối soát. Nguyên liệu chưa có baseline hiển thị qty_on_hand=NULL.

## Quy tắc vận hành được chọn

- Owner quản trị thành viên; manager xác nhận giao dịch và duyệt mua; staff tạo nháp/CRM theo phạm vi được giao.
- Giá mặc định theo customer_type: Khách lẻ dùng retail; các loại còn lại wholesale. Thiếu giá đúng tier thì báo lỗi. Giá khách riêng ưu tiên hơn giá chung.
- Chiết khấu mặc định của khách áp ở dòng; manager có thể chọn discount_pct khi lưu nháp. Không cho staff override và không nhận giá tùy ý từ payload.
- credit_policy mặc định review; công nợ phát sinh cần manager ghi credit_approval_reason. limited cần credit_limit hợp lệ; unlimited phải được manager cấu hình rõ. Không mặc định null hạn mức là không giới hạn.
- Ghi nhận bán khi post_delivery; trả cùng giao tính qty net ngay. Trả sau bán giảm net balance và ghi hoạt động trả tại ngày trả. Không hỗ trợ tiền đặt cọc/thu dư ở phiên bản này.
- Công nợ nhà cung cấp ghi nhận khi nhận hàng theo giá PO đã duyệt; không cần số hóa đơn để tạo accrual. Đối chiếu invoice, thuế/VAT, giá thực chênh PO, hoàn hàng nhà cung cấp và đảo receipt là các luồng chưa đưa vào phiên bản này.
- Mobile là nguồn ghi giao dịch mới. Đồng bộ Google Sheets cũ không được tự cộng vào tồn; cập nhật nhập liệu cũ cần kiểm kê/đối soát lại baseline. Chưa thay đổi hoặc triển khai hệ đồng bộ ngoài Supabase.

## Bắt đầu sử dụng và giới hạn triển khai

auth.users/app_members thật còn trống. Cần người dùng cung cấp danh tính owner đầu tiên; tạo tài khoản bằng Supabase Auth và gắn owner qua thao tác quản trị tin cậy. Mobile không có API tự bootstrap/nâng quyền. Sau đó owner dùng manage_member để cấp quyền và manager gán route_assignments hoặc customers.assigned_to.

Không có giao diện mobile trong lượt xử lý backend này; contract/types đã sẵn sàng để triển khai app. Chưa push GitHub. Tám migrations ban đầu chưa có bản SQL đầy đủ trong repository; local tests tái dựng baseline từ snapshot, không coi thư mục migrations hiện tại là bộ bootstrap DB hoàn chỉnh. Không chạy db push/db reset trên DB mới chỉ với hai migrations bổ sung.

Migration đầu đã thay contract create_sale_order cũ: payload cũ không có order_id/version/request_key bị từ chối. Client cũ nếu có phải chuyển sang save_customer_order/transition_customer_order/post_delivery. Không rollback production bằng cách drop bảng khi đã có giao dịch; sửa bằng migration tiến tới và giữ ledger.
