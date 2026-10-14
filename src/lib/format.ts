export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const money = (value: number | string | null | undefined) =>
  value == null
    ? 'Chưa có giá'
    : new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 2,
      }).format(Number(value));
export const quantity = (value: number | string | null) =>
  value == null
    ? 'Chưa xác định'
    : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 }).format(Number(value));
export const shortId = (id: string) => id.slice(0, 8).toUpperCase();
export const dateLabel = (date: string) => date.split('-').reverse().join('/');
export const labels: Record<string, string> = {
  draft: 'Nháp',
  confirmed: 'Đã xác nhận',
  partial: 'Một phần',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  submitted: 'Chờ duyệt',
  paid: 'Đã thanh toán',
  unpaid: 'Chưa thanh toán',
  open: 'Chưa hoàn tất',
  done: 'Đã hoàn thành',
  owner: 'Chủ doanh nghiệp',
  manager: 'Quản lý',
  staff: 'Nhân viên',
  call: 'Cuộc gọi',
  visit: 'Ghé thăm',
  note: 'Ghi chú',
  retail: 'Giá lẻ',
  wholesale: 'Giá sỉ',
};
export function decimal(text: string, name = 'Số lượng', allowZero = false) {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,4})?$/.test(normalized))
    throw Error(`${name} phải là số hợp lệ, tối đa 4 chữ số thập phân.`);
  const value = Number(normalized);
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0))
    throw Error(`${name} phải ${allowZero ? 'không âm' : 'lớn hơn 0'}.`);
  return value;
}
export function validDate(text: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    !Number.isFinite(Date.parse(text)) ||
    new Date(text).toISOString().slice(0, 10) !== text
  )
    throw Error('Ngày phải có dạng YYYY-MM-DD và tồn tại.');
  return text;
}
export const errorMessage = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : ((error as { message?: string })?.message ??
        'Không thể hoàn tất thao tác. Vui lòng thử lại.');
  const rules: [string, string][] = [
    ['Version conflict', 'Dữ liệu đã thay đổi. Tải lại trước khi tiếp tục.'],
    ['outside assigned scope', 'Khách hàng ngoài phạm vi được giao.'],
    ['No effective selling price', 'Chưa có giá phù hợp cho khách và ngày giao.'],
    ['Credit limit exceeded', 'Đơn vượt hạn mức công nợ của khách.'],
    ['POS total changed', 'Giá hoặc đơn đã thay đổi. Tải lại dữ liệu trước khi chốt.'],
    ['POS quantity exceeds', 'Số lượng vượt phần còn được giao của đơn đặt.'],
    ['Active assigned route', 'Cần chọn tuyến đang hoạt động và được phân công.'],
    ['approval reason', 'Vui lòng ghi lý do quản lý duyệt công nợ.'],
    ['Not authorized', 'Tài khoản chưa có quyền thực hiện thao tác này.'],
    ['Invalid login credentials', 'Email hoặc mật khẩu chưa đúng.'],
    ['Email not confirmed', 'Vui lòng xác nhận email trước khi đăng nhập.'],
    [
      'payload conflict',
      'Nội dung đã thay đổi sau lần gửi. Đóng biểu mẫu, tải lại và tạo thao tác mới.',
    ],
    ['Resolve and allocate', 'Cần chọn sản phẩm cho tất cả dòng trước khi xác nhận.'],
    ['rate limit', 'Đã gửi quá nhiều yêu cầu. Vui lòng chờ rồi thử lại.'],
    ['Failed to fetch', 'Kết nối bị gián đoạn. Thử lại với yêu cầu đã lưu trong mục Thêm.'],
    ['Network request failed', 'Kết nối bị gián đoạn. Thử lại với yêu cầu đã lưu trong mục Thêm.'],
    [
      'Invalid delivery/return quantity',
      'Số giao/trả phải là cái nguyên và không vượt số còn được giao.',
    ],
    ['Return exceeds', 'Số trả vượt lượng còn bán hoặc chưa đúng đơn vị.'],
    ['Invalid collection amount', 'Tiền thu phải lớn hơn 0 và không vượt công nợ còn lại.'],
    ['Collection exceeds sale net', 'Tiền thu vượt giá trị bán. Kiểm tra lại số lượng và giá.'],
    ['Invalid receipt quantity', 'Số nhận phải lớn hơn 0 và không vượt phần PO chưa nhận.'],
    ['price history', 'Ngày giá mới phải sau ngày giá đã lưu gần nhất.'],
  ];
  const mapped = rules.find(([source]) =>
    message.toLowerCase().includes(source.toLowerCase()),
  )?.[1];
  if (mapped) return mapped;
  const code = (error as { code?: string })?.code;
  if (code === '23505') return 'Dữ liệu này đã tồn tại. Kiểm tra danh sách trước khi thêm lại.';
  if (code === '23514' || code === '22003')
    return 'Số lượng, giá hoặc quy đổi chưa hợp lệ. Kiểm tra lại thông tin.';
  if (code === '42501') return 'Tài khoản không có quyền thực hiện thao tác này.';
  return message;
};
