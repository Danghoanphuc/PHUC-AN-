# Phúc An Mobile – iOS trước

Triển khai ngày 14/10/2026. Expo SDK 57.0.28, React Native 0.86.3, React 19.2.3, Supabase JS 2.117.3; version được pin và có lockfile. Expo xác định SDK 57 hỗ trợ iOS 16.4+ trong [bảng phiên bản chính thức](https://docs.expo.dev/versions/latest/).

## Giao diện và chức năng

- Hôm nay: doanh thu, lịch giao, công nợ và việc chăm sóc từ dữ liệu trong phạm vi tài khoản; có trạng thái rỗng, không dùng doanh thu demo.
- Đơn hàng: đơn khách/đơn mua, tìm kiếm và trạng thái; tạo/sửa nháp, alias nhóm, xác nhận, giao từng phần, trả cùng giao, thu ban đầu và duyệt công nợ.
- Khách hàng: danh mục/hồ sơ, điện thoại, địa chỉ/tuyến, công nợ, ghi tương tác, lịch hẹn, hoàn thành việc và tạo đơn từ khách.
- Giá: sỉ/lẻ/giá riêng theo khách, đơn vị giá tách số bì đặt, thêm giá mới theo hiệu lực.
- Thêm: thu nợ khách, trả hàng sau bán, thanh toán nhà cung cấp, đảo thu/chi, PO/nhận nguyên liệu, kiểm kê, danh sách cần đối chiếu, nhân sự và gán tuyến cho staff.
- Tài khoản: email/mật khẩu, liên kết email không mật khẩu, khung SMS chỉ bật khi project có provider, đặt/đổi mật khẩu và đăng xuất.

Giao diện có safe area, cuộn biểu mẫu tránh bàn phím iOS, nút touch tối thiểu cho thao tác chính, tên accessibility, modal ẩn nền khỏi screen reader, trạng thái tải/lỗi và kéo tải lại. Khi mở lại app, đọc lại membership để kiểm tra quyền hiện tại.

## Tài khoản thật và xác minh

Owner đầu tiên đã được đăng ký qua Auth API theo email người dùng cung cấp. Yêu cầu gửi email xác minh trả HTTP 200. Không tự đánh dấu email_confirmed_at, không sinh hoặc công khai mật khẩu tạm, không lấy token email của người dùng.

private.approved_invites chứa email/role/contact do quản trị duyệt. Trigger auth.users chỉ tạo membership khi email đã xác minh đúng whitelist, với thời hạn invite 14 ngày. Mỗi invite gắn một auth user; xác minh lại không khôi phục tài khoản đã bị khóa hoặc tự đổi role. approved_invites không expose và không cấp quyền đọc cho client. Số điện thoại liên hệ không được coi là số đã xác minh SMS.

Trong app, có thể dùng “Nhận liên kết đăng nhập email”. Nếu redirect URL/deep link của project chưa được cấu hình cho app, sao chép địa chỉ liên kết trong email và dán vào “Tôi đã có liên kết xác minh”. App chỉ nhận token hash từ endpoint auth của đúng project; không gửi credential sang URL khác. Cách này dùng API verifyOtp của Supabase, không tự xác minh danh tính. [Tài liệu passwordless](https://supabase.com/docs/guides/auth/auth-email-passwordless).

Sau khi owner xác minh email và đăng nhập, vào Thêm → Đội ngũ → Cấp quyền người mới. Người mới dùng đúng email được duyệt để kích hoạt trong app, rồi owner phân công tuyến cho staff. RPC invite_member cấp quyền chờ, không tự gửi email thay cho người mới; người dùng yêu cầu liên kết từ màn hình đăng nhập. Owner có thể đổi role/khóa member đã tồn tại.

SMS đang tắt ở project. Muốn dùng số điện thoại đăng nhập cần cấu hình SMS provider và xác minh số qua OTP; không tự bật auto-confirm. Sử dụng email trong thời gian này.

Supabase Advisor hiện báo **Leaked Password Protection Disabled** ở Auth. Kiểm tra và bật trong cấu hình Auth phù hợp với plan trước khi triển khai chính sách đăng nhập mật khẩu rộng rãi; không giả định đã bật. Owner có thể ưu tiên đăng nhập bằng liên kết email. [Hướng dẫn bảo vệ mật khẩu](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Session và retry giao dịch

Session native lưu bằng expo-secure-store, chia chunk dưới giới hạn mỗi giá trị; web dùng sessionStorage của tab. Danh mục/hồ sơ/tiền không được lưu offline, dữ liệu trong RAM được xóa khi đổi tài khoản hoặc logout. Không đưa secret/service_role vào mobile.

Mỗi RPC ghi có request_key. Trước gửi, lưu yêu cầu đang chạy theo actor trong storage bảo vệ; nếu kết nối không xác định kết quả, giữ nguyên payload/key. Mục Thêm hiển thị thao tác chờ và cho retry đúng yêu cầu. Các lỗi SQL/PostgREST đã từ chối giao dịch được gỡ khỏi hàng chờ. Không phát triển đồng bộ offline đầy đủ trong bản này. Ghi CRM/danh mục đơn bảng hiện dùng Data API/RLS và chưa có retry queue tương đương RPC tài chính.

## Chạy và build

`npm ci` → `npm start` → mở Expo Go trên iPhone cùng mạng và quét QR. Cấu hình app dùng scheme phucan, bundleIdentifier com.phucan.ops, icon/splash riêng. Trước phân phối chính thức cần xác nhận bundle identifier, đăng ký Apple Developer, EAS project và thiết bị/certificates phù hợp.

`npm run build:ios` đã xuất bundle Hermes thành công. Đây là kiểm tra bundle JS/asset iOS trên Windows, không phải native Xcode build, IPA, TestFlight hoặc thử thiết bị thật. `eas.json` có preview simulator và production; thực hiện build ký cần Expo/Apple account hoặc môi trường macOS. Không bắt đầu dịch vụ build trả phí hoặc tự tạo chứng chỉ trong lượt này.

`npm run build:web` xuất dist; `node scripts/serve-preview.mjs` xem tại http://127.0.0.1:8081. Preview local không phải website đã publish.

## Kiểm chứng

- TypeScript: `npm run typecheck` pass.
- DB: 34 kịch bản pass, gồm whitelist xác minh email, không tái kích hoạt member bị khóa, owner-only invite và các invariant bán/mua/tiền từ giai đoạn trước.
- UI: 4 kịch bản Playwright trên viewport 390×844 pass: login/navigation/CRM, tạo/xác nhận/giao đơn, tạo PO và phân quyền staff, timeout giữ request key và retry qua Thêm.
- iOS bundle: export thành công; Expo Doctor 21/21 pass.
- Auth/Data API thật: settings trả phone=false/email=true; anon bị chặn HTTP 401 ở customers/products/cash_movements/member_profiles.
- Snapshot ảnh ở test-output/screenshots chỉ chứa fixture kiểm thử, không phải hồ sơ hoặc giao dịch thật. Test không bypass Auth/RLS trong code app; mock chỉ được cài trong Playwright.

Chưa thực hiện UI end-to-end bằng tài khoản người dùng thật vì bước xác minh email do người dùng hoàn thành; chưa chạy trên iPhone vật lý/Simulator. Chưa stress-test nhiều connection, Apple distribution, SMS, push notification, máy in hay offline sync.

`npm audit` ghi nhận 24 cảnh báo dependency transitive trong toolchain Expo/Metro/Xcode tại các phiên bản đang dùng. Có báo cáo local trong test-output/dependency-audit.json; không dùng audit fix --force để hạ Expo/RN xuống SDK cũ không tương thích. Tiếp tục theo dõi bản vá upstream; không expose Metro dev server ra internet hoặc đưa vào production hosting. App data/auth RLS được kiểm chứng riêng, không suy ra audit dependency đã sạch từ kết quả RLS.

## Migrations bổ sung

- mobile_onboarding_v1: whitelist email, profile, trigger xác minh, RPC invite/list và route label cho khách giao trực tiếp.
- invitation_lookup_indexes: index FK của invite.

Version local khớp lịch sử remote sau triển khai. Không commit email/phone whitelist ban đầu vào migration/source; chỉ ghi trực tiếp theo chỉ định của người dùng. Không chạy db reset/push một DB mới chỉ bằng các migration bổ sung trong repo; baseline migrations cũ chưa được export đầy đủ.
