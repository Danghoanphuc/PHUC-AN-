# Phát hành thử Phúc An

## Bản chuẩn bị ngày 14/10/2026

Đã triển khai RPC đối soát/chuyển tiền POS trên Supabase, cùng giỏ nháp theo tài khoản và lịch sử bán cá nhân. Preview local: http://127.0.0.1:8081. Không coi bản export Hermes là IPA đã ký.

Đối chiếu DB tại thời điểm kiểm tra: 1 staff hoạt động đã có tuyến; 1 quỹ tiền mặt công ty; 21 sản phẩm active, trong đó bán thành phẩm “Nhân mặn hỗn hợp (BOM trộn nhân)” không có đơn vị bán/giá và bị khóa trong POS. Có 21 vấn đề dữ liệu cũ cần quản lý đối chiếu nguyên liệu/alias, không tự suy diễn quy đổi. Kiểm tra lại giá/khách/tuyến thật trước ca thử.

## Ký iOS và TestFlight

Máy hiện chưa đăng nhập Expo, không có EXPO_TOKEN, app.json chưa có extra.eas.projectId. Người sở hữu cần đăng nhập Expo và Apple Developer/App Store Connect; không gửi mật khẩu hay token vào chat.

Sau khi đăng nhập EAS CLI và liên kết đúng project Phúc An:

1. Kiểm tra bundle identifier `com.phucan.ops` thuộc đúng Apple team.
2. `eas build --platform ios --profile preview`: bản cài iPhone qua ad hoc, phải đăng ký UDID. `simulator` là profile riêng.
3. `eas build --platform ios --profile production`: bản App Store/TestFlight có ký.
4. `eas submit --platform ios --profile production`: chọn đúng build và App Store Connect app. Thêm người thử nội bộ trong TestFlight.

Lệnh cần EAS CLI đã cài, xác thực và chứng chỉ của chủ ứng dụng. Các bước có tương tác tài khoản/chữ ký chưa thực hiện. Tài liệu: [Expo TestFlight](https://docs.expo.dev/submit/testflight/), [internal distribution](https://docs.expo.dev/build/internal-distribution/).

## Ca nghiệm thu trên iPhone thật

- Owner cấp một staff, gán tuyến đúng; staff đăng nhập số điện thoại, tự đổi mật khẩu.
- Chọn khách cũ/tạo bạn hàng; kiểm tra giá riêng, bì/cái với người bán và chứng từ.
- Nhập giỏ, ghi chú, đổi màn hình, khóa/mở app: giỏ giữ nguyên; đổi tài khoản không thấy giỏ của nhau.
- Chốt một đơn thực đã thu đủ; làm một giao đơn đặt trước. Kiểm tra tiền/khách/ghi chú/lịch sử.
- Mất mạng lúc chốt, bật lại và retry: chỉ một lần bán, một lần thu tiền.
- Cuối ca đếm tiền, gửi phiếu; quản lý kiểm đếm nhận vào quỹ công ty. Thử phiếu lệch có ghi chú và yêu cầu đếm lại bằng môi trường kiểm thử/fixture, không tạo tiền giả trên hệ thống thật.
- Quản lý xử lý trả hàng có hoàn tiền từ đúng quỹ đã chi, đối chiếu sổ. Staff không có quyền tự sửa giao dịch đã ghi.
- Kiểm tra bàn phím, safe area, footer tổng/chốt, cuộn danh mục trên iPhone thực tế.

Ghi kết quả và người xác nhận ca thử trước mở rộng đội bán.

## Vận hành trước mở rộng

Xác nhận backup/khả năng restore và chính sách lưu giữ của project Supabase trong dashboard. Chưa thực hiện restore drill. Kiểm tra log Auth/Edge Functions khi đăng nhập/cấp tài khoản lỗi; đối chiếu audit_events cho RPC tài chính. Chưa tích hợp dịch vụ theo dõi crash native tự động.

Advisor hiện còn cảnh báo [Leaked Password Protection Disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); bật nếu gói hỗ trợ. Bảng bootstrap private cố ý không có policy đọc client. Không thêm service_role vào mobile. Không expose Metro/preview server ra internet.

Khi phát hiện lỗi tài chính: dừng thao tác đang lỗi, giữ request_key, thử lại đúng yêu cầu ở Thêm. Không sửa/xóa ledger bằng SQL. Rollback app về commit đã kiểm thử nếu cần; migration đối soát là bổ sung nên phiên bản POS trước vẫn chạy. Phiếu nhận tiền đã ghi phải được đối chiếu bằng chứng từ, không đảo riêng một vế transfer.

Giới hạn pilot: mạng cần thiết để chốt bán; không có tồn thành phẩm trên xe, nhiều đơn offline, máy in, push notification hoặc chuyển khoản trong POS. Chưa có công cụ hủy/sửa phiếu bàn giao đã nhận; kiểm tra đúng số tiền và quỹ trước xác nhận.
