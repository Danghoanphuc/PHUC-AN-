# Cloudflare Pages

Production: https://phuc-an.pages.dev · Project: `phuc-an` · Branch: `main`.
Deployment production ngày 16/10/2026: https://d31fbb0a.phuc-an.pages.dev · source commit `bcf9a1e`. Có xóa/khôi phục khách cho chủ/quản lý, giữ nguyên lịch sử và giá, chặn công nợ/đơn chưa xong/POS chưa điền đủ bánh. Migration đã áp dụng; smoke máy chủ rollback toàn bộ dữ liệu tạm. Typecheck, 58 bài nghiệp vụ, 30 bài giao diện và build iOS đạt; HTML production trùng bản build. POS gọn và icon SVG nội tuyến giữ nguyên.
Triển khai dạng Direct Upload bằng Wrangler, chưa liên kết tự deploy qua GitHub. Sau mỗi bản sửa đã kiểm thử, chạy lại build/deploy bên dưới; địa chỉ production không đổi.

Ứng dụng web Expo xuất thành thư mục `dist`. Supabase tiếp tục xử lý đăng nhập, phân quyền và nghiệp vụ; không cần Worker hoặc database Cloudflare.

Build: `npm ci` rồi `npm run build:web`. Node 22. Tệp `public/_headers` được Expo sao chép sang dist để trình duyệt kiểm tra phiên bản HTML mới, cache tài nguyên có hash và thiết lập HTTP headers.

Icon web dùng SVG nội tuyến từ Ionicons, không tải icon font hoặc phụ thuộc rewrite đường dẫn font. `scripts/generate-web-icons.mjs` tự lấy các icon đang dùng trước khi build; iOS/Android vẫn dùng bộ icon native. Test giao diện chặn toàn bộ tải font, kiểm tra icon sau tải mới và reload. `scripts/prepare-web.mjs` đặt ngôn ngữ trang là tiếng Việt và giữ xử lý assets/vendor cho tài nguyên Expo khác; không bỏ bước này khi deploy.

Deploy bằng Wrangler 4.151.0: `npx --yes wrangler@4.151.0 pages deploy dist --project-name phuc-an --branch main`. Cần đăng nhập Cloudflare qua `wrangler login` hoặc token Pages có quyền trên đúng tài khoản. Không lưu token vào source hay biến EXPO_PUBLIC_*.

Wrangler 4.151.0 có thể chuyển lệnh tạo Pages mới sang Workers. Project này đã được tạo bằng `pages project create phuc-an --production-branch main --force` để dùng Pages. Không cần cờ force khi deploy vào project đã tồn tại.

Chỉ upload dist, không upload thư mục dự án, .local, .env, test-output hoặc mã Supabase. Pages mặc định phục vụ index.html cho SPA khi không có 404.html ở gốc. Không chạy Metro hoặc server preview trên production.

Bản web dùng sessionStorage theo tab cho phiên đăng nhập và giỏ nháp; đóng tab có thể mất giỏ chưa chốt. Dữ liệu đã ghi trên Supabase không bị ảnh hưởng. Chốt bán cần mạng.

Kiểm tra sau deploy: HTTPS, trang đăng nhập, tải JS/font, tải lại đường dẫn, Auth/RPC đến Supabase. Không dùng giao dịch giả để kiểm thử trên DB thật. Khi cần rollback, chọn deployment thành công trước đó trong Cloudflare Pages. Hosting có thể đổi về sau mà không chuyển dữ liệu Supabase.

Đã kiểm tra production trả HTTP 200, HTML no-cache, JS hash immutable, font loaded, không lỗi JavaScript/không tràn ngang ở 390×844. Từ trình duyệt trên origin production: Supabase Auth settings 200, truy cập customers chưa đăng nhập 401. Chạy 11 Playwright UI scenarios trên bản production với API mock cô lập bằng biến `PLAYWRIGHT_BASE_URL=https://phuc-an.pages.dev`; tất cả đạt, không ghi dữ liệu giả vào Supabase thật. Chưa đăng nhập bằng mật khẩu người dùng thật trong kiểm thử tự động.
