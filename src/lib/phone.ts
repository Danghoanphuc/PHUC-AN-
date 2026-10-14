/** One canonical login identifier for Vietnamese mobile numbers. */
export function normalizePhone(value: string) {
  const phone = value
    .trim()
    .replace(/[\s().-]/g, '')
    .replace(/^0/, '+84');
  if (!/^\+84[35789]\d{8}$/.test(phone))
    throw Error('Nhập số di động Việt Nam hợp lệ, ví dụ 09… hoặc +84…');
  return phone;
}
// Internal Auth identifier; no email delivery or email verification is involved.
export function phoneIdentity(value: string) {
  return `${normalizePhone(value).slice(1)}@phone.phucan.invalid`;
}
