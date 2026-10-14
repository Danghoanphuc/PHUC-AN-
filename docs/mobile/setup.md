# Phúc An Mobile – iOS trước

Triển khai ngày 14/10/2026. Expo SDK 57.0.28, React Native 0.86.3, React 19.2.3, Supabase JS 2.117.3; version được pin và có lockfile. Expo xác định SDK 57 hỗ trợ iOS 16.4+ trong [bảng phiên bản chính thức](https://docs.expo.dev/versions/latest/).

## Giao diện và chức năng

- Hôm nay: doanh thu, lịch giao, công nợ và việc chăm sóc từ dữ liệu trong phạm vi tài khoản; có trạng thái rỗng, không dùng doanh thu demo.
- Đơn hàng: đơn khách/đơn mua, tìm kiếm và trạng thái; tạo/sửa nháp, alias nhóm, xác nhận, giao từng phần, trả cùng giao, thu ban đầu và duyệt công nợ.
- Khách hàng: danh mục/hồ sơ, điện thoại, địa chỉ/tuyến, công nợ, ghi tương tác, lịch hẹn, hoàn thành việc và tạo đơn từ khách.
- Giá: sỉ/lẻ/giá riêng theo khách, đơn vị giá tách số bì đặt, thêm giá mới theo hiệu lực.
- Thêm: thu nợ khách, trả hàng sau bán, thanh toán nhà cung cấp, đảo thu/chi, PO/nhận nguyên liệu, kiểm kê, danh sách cần đối chiếu, nhân sự và gán tuyến cho staff.
- Tài khoản: số điện thoại + mật khẩu; owner cấp/đặt lại mật khẩu, người dùng tự đổi mật khẩu và đăng xuất.

Giao diện có safe area, cuộn biểu mẫu tránh bàn phím iOS, nút touch tối thiểu cho thao tác chính, tên accessibility, modal ẩn nền khỏi screen reader, trạng thái tải/lỗi và kéo tải lại. Khi mở lại app, đọc lại membership để kiểm tra quyền hiện tại.

## Tài khoản bằng số điện thoại

Đăng nhập chỉ cần số di động Việt Nam và mật khẩu được owner cấp. Không yêu cầu SMS, email, liên kết xác minh hay tự đăng ký. Số 0… và +84… quy về cùng một định danh.

Supabase phone provider đang tắt. App dùng alias nội bộ dạng 84…@phone.phucan.invalid cho password Auth; alias không phải email liên hệ, không gửi thư và không hiển thị trong giao diện. Mật khẩu chỉ được Supabase Auth băm/lưu, không lưu trong bảng nghiệp vụ, audit hay hàng chờ retry. Session/RLS tiếp tục dùng Auth UUID.

Owner đầu tiên đặt mật khẩu trên màn hình thiết lập mở từ liên kết riêng ở bản xem thử. Token ngẫu nhiên 256 bit, chỉ lưu hash trong private.phone_owner_setup, gắn đúng UUID/số điện thoại, hết hạn sau 72 giờ và dùng một lần. Không commit token hoặc mật khẩu. Liên kết mất tác dụng khi đã có owner hoạt động.

Thêm → Đội ngũ & phân quyền → Cấp tài khoản mới: nhập tên, số, mật khẩu ban đầu và manager/staff. Owner có thể đặt lại mật khẩu, khóa hoặc phân công tuyến. Mỗi người tự đổi trong Thêm → Đổi mật khẩu. Mật khẩu cấp/đổi cần 12–128 ký tự. Không bắt buộc đổi lần đầu.

Edge Function phone-accounts dùng Auth Admin ở máy chủ. Mọi thao tác tạo/reset kiểm tra JWT bằng Auth.getUser và membership owner đang hoạt động; reset không áp dụng cho owner. verify_jwt=false để hỗ trợ bootstrap, nhưng hàm tự xác thực đầy đủ. RPC provisioning chỉ cấp execute cho service_role, wrapper SECURITY INVOKER và implementation private. Yêu cầu tạo dùng UUID cố định theo actor/request_key; retry không đổi mật khẩu, role hay tái kích hoạt tài khoản cũ.

Trigger/email invite cũ đã bị vô hiệu hóa trong migration mới. Hồ sơ hiển thị số điện thoại, client không được sửa số đăng nhập. Chưa có chức năng đổi số đăng nhập trong phiên bản này.

Advisor vẫn báo Leaked Password Protection Disabled; đây là cấu hình Auth hiện có, chưa được bật. [Tài liệu bảo vệ mật khẩu](https://supabase.com/docs/guides/auth/password-security).

## Session và retry giao dịch

### POS đang triển khai

Staff vào POS sau đăng nhập; chủ/quản lý vào bằng tab POS hoặc Bán nhanh POS ở Hôm nay. Trang chính trong POS quay về các công cụ khác. Thanh tổng tiền và chốt là phần tử cố định của bố cục, nằm ngoài ScrollView và trên safe area iOS; không bị cuộn theo menu/giỏ. Không cần thanh toán qua nhiều màn hình.

Danh mục/nhóm lấy từ products.category thật; không chép món hoặc giá minh họa của bản thiết kế vào DB. Thiếu giá/quy cách thì nút món bị khóa. Món hay lấy xếp theo số lượng trong lịch sử đơn khách; chưa có lịch sử thì hiện nhãn gợi ý món có giá. Alias tìm kiếm có scope khách. Giá riêng ưu tiên theo customer_id rồi bảng giá của loại khách, tính tiền decimal theo quy đổi và chiết khấu đã cấu hình; không có nút sửa giá, giảm giá hoặc bán chịu trong POS.

Tạo nhanh khách bằng create_pos_customer: tên, số liên hệ tùy chọn, tuyến đang hoạt động. Staff chỉ chọn tuyến đã giao qua route_assignments; tạo assigned_to là chính người thao tác, hạn mức nợ mặc định 0. Manager/owner có thể quản lý hồ sơ sau đó. Tài khoản nhân viên cần được phân công tuyến trước khi thêm bạn hàng trong tuyến.

Nút Chốt bán ghi rõ xác nhận đã thu đủ tiền mặt. post_pos_sale chọn giá/đơn vị/snapshot ở server, xác nhận đơn và ghi delivery, receivable đã trả đủ, cash ledger trong một transaction. Wallet POS nội bộ tạo riêng theo Auth UUID người bán, cash account được quản lý xem trong sổ tiền hiện có. Không tự coi POS là chuyển khoản hoặc ghi nợ. Đơn đặt đã xác nhận dùng giá snapshot và version, có thể giao từng phần; không tạo trùng một đơn mới. Đơn nháp cần xác nhận theo luồng quản lý hiện hành.

Giỏ nháp tự lưu riêng theo Auth UUID (SecureStore trên iOS, sessionStorage của tab web), gồm khách/đơn, số lượng, nội dung đang nhập, ghi chú và mã chống trùng. Chuyển màn hình/mở lại native app khôi phục giỏ, kiểm tra lại quyền/giá/trạng thái đơn. Xóa giỏ lưu trước khi báo chốt thành công. Web khôi phục khi reload cùng tab; đóng tab không bảo đảm giữ giỏ. Chưa đồng bộ giỏ giữa các thiết bị.

POS → Lịch sử / Chốt tiền (hoặc Thêm → Bán hàng của tôi / Chốt tiền): xem 200 lần bán gần nhất của chính người đăng nhập, chi tiết món/ghi chú và số dư ví POS cộng dồn. Nhân viên nhập toàn bộ tiền thực đếm; nếu khác sổ cần ghi chú. Mỗi người chỉ có một phiếu chờ. Quản lý nhận đúng số tiền khai vào quỹ công ty bằng hai bút toán transfer cân bằng hoặc yêu cầu đếm lại. Phiếu giữ số dư tại lúc gửi; bán tiếp sau đó được cộng vào số dư mới. Phần thiếu/thừa vẫn tồn tại trên ví để xử lý, không tự ghi chi phí hoặc xóa chênh lệch. Mọi lần nhận/gửi retry đều idempotent. Trả hàng/hoàn tiền tiếp tục dùng luồng quản lý hiện có.

Phiên bản này chưa quản lý tồn thành phẩm trên xe/chuyến hoặc đồng bộ nhiều đơn offline. Timeout giữ nguyên payload/key, khóa giỏ và cho retry cùng yêu cầu. Chưa chạy UI bằng tài khoản thật của người dùng hoặc trên iPhone vật lý; kiểm thử UI dùng fixture cô lập và kiểm tra RPC thật dùng dữ liệu rollback.

Session native lưu bằng expo-secure-store, chia chunk dưới giới hạn mỗi giá trị; web dùng sessionStorage của tab. Danh mục/hồ sơ/tiền không được lưu offline, dữ liệu trong RAM được xóa khi đổi tài khoản hoặc logout. Không đưa secret/service_role vào mobile.

Mỗi RPC ghi có request_key. Trước gửi, lưu yêu cầu đang chạy theo actor trong storage bảo vệ; nếu kết nối không xác định kết quả, giữ nguyên payload/key. Mục Thêm hiển thị thao tác chờ và cho retry đúng yêu cầu. Các lỗi SQL/PostgREST đã từ chối giao dịch được gỡ khỏi hàng chờ. Không phát triển đồng bộ offline đầy đủ trong bản này. Ghi CRM/danh mục đơn bảng hiện dùng Data API/RLS và chưa có retry queue tương đương RPC tài chính.

## Chạy và build

`npm ci` → `npm start` → mở Expo Go trên iPhone cùng mạng và quét QR. Cấu hình app dùng scheme phucan, bundleIdentifier com.phucan.ops, icon/splash riêng. Trước phân phối chính thức cần xác nhận bundle identifier, đăng ký Apple Developer, EAS project và thiết bị/certificates phù hợp.

`npm run build:ios` xuất bundle Hermes. Đây là kiểm tra JS/asset iOS trên Windows, không phải IPA/TestFlight. `eas.json` tách simulator, preview cho iPhone thật (ad hoc) và production cho TestFlight; xem [quy trình phát hành](release.md). Máy hiện chưa có phiên Expo hoặc EXPO_TOKEN, app chưa liên kết EAS project; cần chủ tài khoản đăng nhập để ký và phát hành.

`npm run build:web` xuất dist; `node scripts/serve-preview.mjs` xem tại http://127.0.0.1:8081. Preview local không phải website đã publish.

## Kiểm chứng

- TypeScript: `npm run typecheck` pass.
- Backend: 47 kịch bản, gồm DB, phân quyền service-only, bootstrap một lần, JWT/owner, POS, bàn giao tiền/chênh lệch và idempotency.
- UI: 10 kịch bản Playwright trên viewport 390×844: đăng nhập số điện thoại, cấp/reset tài khoản, CRM, đơn bán/mua, POS cố định footer, giỏ qua reload, chốt/nhận tiền và retry.
- iOS bundle: export thành công; Expo Doctor 21/21 pass.
- Auth/Data API thật: settings trả phone=false/email=true; anon bị chặn HTTP 401 ở customers/products/cash_movements/member_profiles.
- Edge Function thật: yêu cầu cấp tài khoản không đăng nhập trả 401; bootstrap sai token trả 403. SQL smoke trên Supabase: 28 assertions pass và rollback toàn bộ fixture. Màn hình owner setup đã kiểm tra tại bản preview; token được xóa khỏi URL sau khi mở.
- Snapshot ảnh ở test-output/screenshots chỉ chứa fixture kiểm thử, không phải hồ sơ hoặc giao dịch thật. Test không bypass Auth/RLS trong code app; mock chỉ được cài trong Playwright.

Owner đã hoạt động. Chưa thực hiện UI end-to-end bằng mật khẩu người dùng thật hoặc trên iPhone vật lý/Simulator. Chưa stress-test nhiều connection, Apple distribution, SMS, push notification, máy in hay offline sync.

`npm audit` ghi nhận 24 cảnh báo dependency transitive trong toolchain Expo/Metro/Xcode tại các phiên bản đang dùng. Có báo cáo local trong test-output/dependency-audit.json; không dùng audit fix --force để hạ Expo/RN xuống SDK cũ không tương thích. Tiếp tục theo dõi bản vá upstream; không expose Metro dev server ra internet hoặc đưa vào production hosting. App data/auth RLS được kiểm chứng riêng, không suy ra audit dependency đã sạch từ kết quả RLS.

## Migrations bổ sung

- mobile_onboarding_v1: whitelist email, profile, trigger xác minh, RPC invite/list và route label cho khách giao trực tiếp.
- invitation_lookup_indexes: index FK của invite.
- phone_password_accounts: onboarding bằng số điện thoại, bootstrap riêng và RPC service-only; thay thế onboarding email.

Version local khớp lịch sử remote sau triển khai. Không commit email/phone whitelist ban đầu vào migration/source; chỉ ghi trực tiếp theo chỉ định của người dùng. Không chạy db reset/push một DB mới chỉ bằng các migration bổ sung trong repo; baseline migrations cũ chưa được export đầy đủ.
