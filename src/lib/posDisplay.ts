/** Compact menu labels only; orders, search and receipts retain the full product name. */
export function shortProductName(name: string) {
  const label = name.trim().replace(/^bánh\s+/iu, '');
  if (/^chiên\s+xù$/iu.test(label)) return 'Xù';
  const words = label.split(/\s+/).filter(Boolean);
  const short = words.slice(-2).join(' ') || name.trim();
  return short.charAt(0).toLocaleUpperCase('vi') + short.slice(1);
}
