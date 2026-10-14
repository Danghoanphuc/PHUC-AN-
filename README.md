# Phúc An Mobile

Ứng dụng Expo React Native dành cho chủ, quản lý và nhân viên Phúc An. Ưu tiên iOS; giao diện tiếng Việt cho bán hàng, CRM, hồ sơ khách, giá, mua nguyên liệu, tồn kho và công nợ.

Dự án bắt đầu bằng khảo sát DB hiện có, trước khi triển khai giao diện và thay đổi schema.

- [Báo cáo khảo sát DB](docs/database/research.md)
- [Từ điển dữ liệu](docs/database/data-dictionary.md)
- [Snapshot metadata](docs/database/schema-snapshot.json)
- [Phác thảo chức năng và kiến trúc](docs/product/mobile-blueprint.md)
- [SQL kiểm tra chỉ đọc](docs/database/verification.sql)

Khảo sát và triển khai ngày 14/10/2026. Supabase: `phuc-an-db`, region Singapore, PostgreSQL 17. Repository bắt đầu từ checkout trống; ứng dụng đọc/ghi DB thật qua Auth + RLS + RPC.

Hai migrations đã áp dụng vào Supabase: mobile_operations_v1 và reporting_snapshots_v1. Danh mục, công thức và giá cũ được giữ nguyên; thêm đơn khách, CRM, mua/nhận nguyên liệu, ledger thu/chi và phân quyền nội bộ.

- [Báo cáo triển khai và kiểm thử](docs/database/implementation.md)
- [Contract RPC cho mobile](docs/database/api-contract.md)
- [TypeScript types từ Supabase](src/types/database.ts)

Chạy kiểm thử local: `npm ci --ignore-scripts` rồi `npm test`. Dùng PostgreSQL WASM (PGlite) với schema cũ và fixture giả, không cần Docker. SQL smoke test trên DB thật nằm trong tests/live-smoke.sql và luôn rollback toàn bộ fixture.

Đã có giao diện mobile và luồng kích hoạt người dùng theo email được duyệt. Owner đầu tiên được đăng ký bằng Supabase Auth và cần tự xác minh email; số điện thoại là liên hệ, SMS chưa cấu hình. 21 vấn đề dữ liệu nguồn giữ ở data_review_issues để quản lý đối chiếu.

## Chạy trên iPhone

```sh
npm ci
npm start
```

Mở Expo Go trên iPhone tương thích SDK 57 và quét QR từ Metro khi điện thoại và máy tính cùng mạng. Trên Windows, `npm run ios` không mở được iOS Simulator; dùng iPhone thật hoặc EAS/macOS theo [hướng dẫn mobile](docs/mobile/setup.md).

Đăng nhập bằng email/mật khẩu hoặc liên kết email. Với liên kết đã nhận, chọn “Tôi đã có liên kết xác minh”, sao chép địa chỉ liên kết từ email và dán trong ứng dụng. Sau xác minh, owner nhận quyền theo email đã được duyệt; có thể đặt mật khẩu ở Thêm. Không gửi liên kết xác minh, mật khẩu hay mã OTP vào issue/GitHub/chat.

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
