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
