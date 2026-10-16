# Tuyến bán hàng linh hoạt

Chủ/quản lý mở Thêm → Tuyến bán hàng để thêm tên tuyến tùy ý, sửa tên/ghi chú, ngừng dùng, khôi phục và phân công nhiều nhân viên. Nhân viên xem Thêm → Tuyến được giao; chỉ được chọn tuyến đang dùng đã được phân công khi tạo khách.

Danh mục ban đầu gồm 12 địa bàn huyện Mang Yang trước sắp xếp năm 2025: Kon Dơng, Ayun, Đak Ta Ley, Đăk Yă, Đak Djrăng, Hra, Kon Thụp, Đak Jơ Ta, Lơ Pang, Đê Ar, Kon Chiêng, Đăk Trôi. Đây là gợi ý ban đầu, không phải danh sách cố định. Đối chiếu [Nghị định 98/2006/NĐ-CP](https://vanban.chinhphu.vn/default.aspx?docid=16197&pageid=27160) và [kế hoạch triển khai tại 12 xã/thị trấn năm 2024 của Bệnh viện Lao và Bệnh phổi Gia Lai](https://bvphoigialai.vn/wp-content/uploads/2024/06/227.KH-SL-lao.signed.pdf). Cách viết Đak Djrăng theo văn bản sắp xếp năm 2025; các nguồn cũ còn dùng Đak Drjăng/Đắk Drjăng.

Migration chỉ thêm địa bàn thiếu, không thay mã, đổi tên, khôi phục tuyến đã tắt hoặc chuyển khách khỏi tuyến cũ. Kon Dơng tiếp tục giữ mã liên kết cũ. Không tự phân công các tuyến mới cho nhân viên: chủ/quản lý chọn Phân công tại từng tuyến.

Không còn ưu tiên cứng Kon Dơng trong mã ứng dụng hoặc RPC tạo khách. Khi có nhiều tuyến được phép, phải chọn rõ tuyến; nếu chỉ có đúng một tuyến đang dùng được phép thì tự chọn tuyến đó. Áp dụng tại thêm khách, POS số lượng và POS chọn món.

Ngừng dùng chỉ ẩn tuyến khỏi lựa chọn cho khách mới. Khách, lịch sử, chứng từ và phân công cũ vẫn giữ nguyên. Khôi phục dùng lại đúng tuyến đó. Nếu muốn đổi tuyến của khách đang có, sửa hồ sơ khách riêng. Thu hồi phân công tuyến không xóa quyền đối với khách đã được giao trực tiếp cho nhân viên theo quy tắc phân quyền hiện có.

`save_sales_route` và `set_sales_route_staff` kiểm tra chủ/quản lý đang hoạt động, trạng thái phiên bản và request key; ghi nhật ký thay đổi. Client không được ghi trực tiếp bảng tuyến/phân công. Tên trùng bị chặn kể cả với tuyến ngừng dùng để tránh tạo hồ sơ trùng. Quản lý chỉ được đọc thêm danh sách nhân viên cần cho phân công, không đọc hoặc sửa quyền của chủ/quản lý khác.
