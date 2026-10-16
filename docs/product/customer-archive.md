# Xóa và khôi phục khách hàng

Chủ/quản lý mở Khách hàng → hồ sơ khách → Xóa khách, nhập lý do và xác nhận. Đây là xóa khỏi danh sách đang bán (`is_active=false`), có thể khôi phục tại Khách hàng → Đã xóa. Nhân viên không có quyền xóa hoặc khôi phục.

Máy chủ chặn xóa khi còn khoản phải thu chưa thanh toán, đơn đặt ở trạng thái nháp/đã xác nhận/giao một phần, hoặc đơn bán theo số lượng chưa điền đủ bánh. Không tự hủy đơn, xóa nợ hay thay đổi dòng tiền để vượt các điều kiện này.

Hồ sơ, tên khách trên chứng từ, giá riêng, đơn hàng, lịch sử bán và chăm sóc vẫn giữ nguyên. Khách đã xóa không xuất hiện trong bộ chọn bán hàng và không thể tạo đơn mới. Khôi phục dùng lại đúng hồ sơ và giá riêng cũ. Việc chăm sóc đang mở vẫn được giữ để người phụ trách xử lý.

RPC `set_customer_active` kiểm tra chủ/quản lý đang hoạt động, khóa dòng khách cùng cơ chế với tạo đơn/bán POS, kiểm tra trạng thái kỳ vọng và ghi audit `customer.archived` / `customer.restored` kèm người thực hiện và lý do. Thử lại cùng request key không ghi trùng hoặc áp dụng lại sau khi đã khôi phục. Trigger chặn client sửa trực tiếp cột `is_active` để bỏ qua kiểm tra.

Kiểm thử: `npm test` xác minh điều kiện chặn, phân quyền, trạng thái cũ, retry, giữ nguyên chứng từ và giá; `npm run test:ui` kiểm tra xóa/khôi phục và bộ lọc khách cho owner/manager/staff. Smoke máy chủ dùng khách và tài khoản tạm trong một transaction rồi rollback, không xóa khách thật.
