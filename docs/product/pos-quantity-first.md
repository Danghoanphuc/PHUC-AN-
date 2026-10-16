# POS: số lượng trước, loại bánh sau

Luồng mặc định: chọn hoặc tạo khách → nhập số bì/hộp → báo giá theo khách → chốt bán và xác nhận thu đủ tiền mặt. Không cần chọn loại bánh trước khi chốt.

Chủ/quản lý thiết lập giá ngay trong POS qua “Thiết lập giá bì/hộp”, hoặc Bảng giá → chọn khách → Giá bì / hộp bán nhanh. Giá chung đã được xác nhận: 1 bì chuẩn 10 cái = 16.000đ, 1 hộp chuẩn 10 cái = 40.000đ. Bì nhỏ 8.000đ nhập 0,5 bì; hộp 5 cái nhập 0,5 hộp. Khách chưa có giá riêng tự dùng giá chung, kể cả khách mới. Giá riêng của khách được ưu tiên. Bảng giá cho phép sửa giá chung hoặc thiết lập riêng từng khách.

Sau chốt, đơn xuất hiện trong “Chờ điền loại bánh”. Có thể lưu một phần và quay lại. Mỗi đơn vị bì/hộp có chỉ báo đã điền / tổng / còn lại. Lưu vượt tổng, dùng bánh ngừng bán hoặc dùng phiên bản đơn cũ đều bị chặn. Khi điền đủ toàn bộ bì và hộp, chi tiết được hoàn tất và chỉ xem lại được. Lịch sử bán hàng và trang chi tiết bán hàng cũng mở được phần điền/xem bánh này.

## Dữ liệu và tiền

- `pos_package_prices`: giá theo khách/đơn vị, quy cách và phiên bản báo giá. Chỉ chủ/quản lý được thiết lập.
- `pos_package_sales`, `pos_package_lines`: liên kết lần bán với tổng số lượng, giá và quy cách đã chốt.
- `pos_package_allocations`: bản phân bổ loại bánh theo dòng bì/hộp; có thể lưu dở.
- `post_pos_package_sale`: ghi `sales`, khoản phải thu đã thanh toán đủ và dòng thu vào ví POS trong cùng transaction. Retry cùng mã không ghi trùng.
- `allocate_pos_packages`: lưu chi tiết, không đổi tổng bán hoặc tạo dòng tiền. Khi đủ toàn bộ mới tạo `sale_items` và giá vốn theo ngày bán; không giả định giá vốn bằng 0 khi chưa có chi tiết/công thức.
- Giá đã chốt không thay đổi khi sửa bảng giá. Máy chủ kiểm tra phiên bản giá và tổng báo giá trước khi thu.
- Nhân viên chỉ xem giá trong phạm vi khách được giao; phần điền bánh chỉ cho lần bán của mình trong phạm vi đó. Chủ/quản lý xem và điền trong phạm vi quản lý.
- Đơn đang nhập tự lưu theo tài khoản. Kết quả mạng chưa rõ thì khóa đơn và thử lại yêu cầu đã lưu.

Chế độ “Chọn theo món” vẫn có để bán từng loại bánh và giao các đơn đặt đã xác nhận theo luồng cũ.

Kiểm thử: `npm test`, `npm run test:ui`. Smoke DB thật tại `tests/quantity-live-smoke.sql` dùng UUID ngẫu nhiên và rollback toàn bộ dữ liệu thử.

POS gọn gồm thanh khách, hai dòng số lượng với nút +½ / +1 và footer chốt tiền. Danh sách chờ điền bánh mở riêng qua nút Chờ điền bánh. Giá được kiểm tra bằng cả phiên bản và mã bảng giá, rồi chụp một lần trong transaction; không đọc lại giá sau khi tính tổng. Smoke giá chung tại `tests/common-package-live-smoke.sql` rollback toàn bộ dữ liệu thử.

Đơn hàng hiển thị chung đơn đặt và các lần bán theo số lượng POS, sắp theo thời gian mới nhất. Bộ lọc Bán POS / Chờ điền bánh tìm nhanh các lần đã thu tiền cần bổ sung bánh. Mở thẻ POS chuyển đến chi tiết bán hàng và phần phân bổ bánh. Danh sách dùng lại giao dịch đã ghi, không tạo thêm đơn hoặc thu lại tiền. Sau chốt có nút Xem trong Đơn hàng.

Giá riêng có thể mở trực tiếp tại Khách hàng → hồ sơ khách → Giá riêng bì / hộp, hoặc biểu tượng nhãn giá cạnh tên khách trong POS. Khung giá ghi rõ nguồn giá chung / giá riêng. Chủ và quản lý có nút Sửa; nhân viên xem giá kèm lời giải thích quyền, không được đổi giá.

Khách mới chọn tuyến từ danh mục được phép. Không còn mặc định cứng Kon Dơng: khi có nhiều tuyến phải chọn, chỉ tự chọn nếu có đúng một tuyến đang dùng được phép. Chủ/quản lý quản lý danh mục và phân công tại Thêm → Tuyến bán hàng. [Chi tiết tuyến linh hoạt và 12 địa bàn Mang Yang cũ](sales-routes.md).
