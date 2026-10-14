# Cloudflare Pages

Production: https://phuc-an.pages.dev · Project: `phuc-an` · Branch: `main`.
Triển khai dạng Direct Upload bằng Wrangler, chưa liên kết tự deploy qua GitHub. Sau mỗi bản sửa đã kiểm thử, chạy lại build/deploy bên dưới; địa chỉ production không đổi.

Ứng dụng web Expo xuất thành thư mục `dist`. Supabase tiếp tục xử lý đăng nhập, phân quyền và nghiệp vụ; không cần Worker hoặc database Cloudflare.

Build: `npm ci` rồi `npm run build:web`. Node 22. Tệp `public/_headers` được Expo sao chép sang dist để trình duyệt kiểm tra phiên bản HTML mới, cache tài nguyên có hash và thiết lập HTTP headers.

Pages bỏ qua thư mục node_modules, kể cả trong assets do Expo export. `scripts/prepare-web.mjs` sao chép tài nguyên đó sang assets/vendor; public/_redirects rewrite URL cũ sang thư mục mới để giữ nguyên bundle có hash. Không bỏ bước prepare-web khi deploy.

Deploy bằng Wrangler 4.151.0: `npx --yes wrangler@4.151.0 pages deploy dist --project-name phuc-an --branch main`. Cần đăng nhập Cloudflare qua `wrangler login` hoặc token Pages có quyền trên đúng tài khoản. Không lưu token vào source hay biến EXPO_PUBLIC_*.

Wrangler 4.151.0 có thể chuyển lệnh tạo Pages mới sang Workers. Project này đã được tạo bằng `pages project create phuc-an --production-branch main --force` để dùng Pages. Không cần cờ force khi deploy vào project đã tồn tại.

Chỉ upload dist, không upload thư mục dự án, .local, .env, test-output hoặc mã Supabase. Pages mặc định phục vụ index.html cho SPA khi không có 404.html ở gốc. Không chạy Metro hoặc server preview trên production.

Bản web dùng sessionStorage theo tab cho phiên đăng nhập và giỏ nháp; đóng tab có thể mất giỏ chưa chốt. Dữ liệu đã ghi trên Supabase không bị ảnh hưởng. Chốt bán cần mạng.

Kiểm tra sau deploy: HTTPS, trang đăng nhập, tải JS/font, tải lại đường dẫn, Auth/RPC đến Supabase. Không dùng giao dịch giả để kiểm thử trên DB thật. Khi cần rollback, chọn deployment thành công trước đó trong Cloudflare Pages. Hosting có thể đổi về sau mà không chuyển dữ liệu Supabase.
