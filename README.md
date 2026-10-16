# Phúc An Mobile

Bản web: **https://phuc-an.pages.dev** · [Cách cập nhật Cloudflare Pages](docs/mobile/cloudflare-pages.md).

Ứng dụng Expo React Native dành cho chủ, quản lý và nhân viên Phúc An. Ưu tiên iOS; giao diện tiếng Việt cho bán hàng, CRM, hồ sơ khách, giá, mua nguyên liệu, tồn kho và công nợ.

Mục Kho trên thanh điều hướng hiển thị sản phẩm đang bán, giá sỉ/giá lẻ chung còn hiệu lực và đơn vị giá. Hỗ trợ tìm tên/mã/nhóm không dấu, lọc nhóm và mở Bảng giá chi tiết. Kho nguyên liệu vẫn nằm trong Thêm cho chủ/quản lý.

Dự án bắt đầu bằng khảo sát DB hiện có, trước khi triển khai giao diện và thay đổi schema.

POS mặc định bán theo số lượng: chọn/tạo khách → nhập số bì/hộp → báo giá theo khách → chốt và thu đủ tiền mặt ngay. Chi tiết loại bánh điền sau trong mục Chờ điền loại bánh hoặc Lịch sử bán hàng; không thu tiền lần nữa. Chủ/quản lý thiết lập giá và quy cách bì/hộp riêng cho từng khách ngay tại POS hoặc Bảng giá. [Luồng số lượng trước, loại bánh sau](docs/product/pos-quantity-first.md). Chế độ Chọn theo món vẫn hỗ trợ menu icon gọn, giỏ mỏng, báo tổng bì và giao đơn đã đặt.

- [Báo cáo khảo sát DB](docs/database/research.md)
- [Từ điển dữ liệu](docs/database/data-dictionary.md)
- [Snapshot metadata](docs/database/schema-snapshot.json)
- [Phác thảo chức năng và kiến trúc](docs/product/mobile-blueprint.md)
- [SQL kiểm tra chỉ đọc](docs/database/verification.sql)

Khảo sát và triển khai ngày 14/10/2026. Supabase: `phuc-an-db`, region Singapore, PostgreSQL 17. Repository bắt đầu từ checkout trống; ứng dụng đọc/ghi DB thật qua Auth + RLS + RPC.

Các migration bổ sung trong supabase/migrations đã áp dụng vào Supabase, gồm nghiệp vụ, phân quyền/tài khoản, POS và đối soát bàn giao tiền. Danh mục, công thức và giá nguồn được giữ lại để đối chiếu.

POS tự lưu giỏ theo tài khoản. Mục Lịch sử / Chốt tiền hiển thị lần bán cá nhân, nhận tiền thực đếm và phiếu chờ quản lý xác nhận vào quỹ công ty. [Hướng dẫn chạy thử và phát hành iOS](docs/mobile/release.md) ghi rõ các bước ký TestFlight và nghiệm thu trên thiết bị thật còn lại.

Chủ/quản lý có thể [xóa và khôi phục khách](docs/product/customer-archive.md). Khách bị ẩn khỏi danh sách bán nhưng giữ lịch sử và giá riêng; chặn xóa khi còn công nợ, đơn chưa xong hoặc POS chưa điền đủ bánh.

- [Báo cáo triển khai và kiểm thử](docs/database/implementation.md)
- [Contract RPC cho mobile](docs/database/api-contract.md)
- [TypeScript types từ Supabase](src/types/database.ts)

Chạy kiểm thử local: `npm ci --ignore-scripts` rồi `npm test`. Dùng PostgreSQL WASM (PGlite) với schema cũ và fixture giả, không cần Docker. SQL smoke test trên DB thật nằm trong tests/live-smoke.sql và luôn rollback toàn bộ fixture.

Đã có giao diện mobile và đăng nhập bằng số điện thoại + mật khẩu do owner cấp. Owner đầu tiên đặt mật khẩu qua màn hình thiết lập riêng. 21 vấn đề dữ liệu nguồn giữ ở data_review_issues để quản lý đối chiếu.

## Chạy trên iPhone

```sh
npm ci
npm start
```

Mở Expo Go trên iPhone tương thích SDK 57 và quét QR từ Metro khi điện thoại và máy tính cùng mạng. Trên Windows, `npm run ios` không mở được iOS Simulator; dùng iPhone thật hoặc EAS/macOS theo [hướng dẫn mobile](docs/mobile/setup.md).

Đăng nhập bằng số điện thoại và mật khẩu. Owner cấp tài khoản trong Thêm → Đội ngũ & phân quyền, người dùng tự đổi mật khẩu trong Thêm. Không gửi mật khẩu hoặc liên kết thiết lập owner vào issue/GitHub/chat.

`npm run web` mở giao diện preview. Config chứa **publishable key** được phép dùng trong client; mọi bảng nghiệp vụ chặn truy cập anon. Không có service_role/secret key trong ứng dụng.

## Kiểm thử

```sh
npm run typecheck
npm test
npm run build:web
npx playwright install chromium
npm run test:ui
npm run build:ios
npx expo-doctor
```

Các test UI dùng fixture giả và chặn request tới Supabase bằng mock; app chạy bình thường dùng DB thật. `build:ios` xuất bundle Hermes, không phải IPA đã ký. [Phạm vi và kết quả kiểm thử](docs/mobile/setup.md).

Đăng nhập hiện dùng số điện thoại + mật khẩu. Chủ doanh nghiệp cấp tài khoản và đặt lại mật khẩu trong Đội ngũ; người dùng tự đổi mật khẩu trong Thêm. Xem [hướng dẫn tài khoản](docs/mobile/setup.md).
