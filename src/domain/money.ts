/**
 * Money helpers. All amounts are integers in satang.
 */

/** The largest amount the app takes: ฿1,000,000,000 (the database caps goals at the same value). */
export const MAX_SATANG = 100_000_000_000;

/** "๑๒๓" -> "123": Thai digits typed on a Thai keyboard. */
export function toAsciiDigits(s: string): string {
  return s.replace(/[\u0E50-\u0E59]/g, (d) => String(d.charCodeAt(0) - 0x0e50));
}

/**
 * Parse what a user (or a slip) wrote into satang.
 * Accepts "1,234.50", "1234.5", "฿85", "85 บาท", " 1 234.00 ", Thai digits "๘๕", and a decimal
 * comma as typed on phones set to such regions ("85,50" = 85.50, "12,34" = 12.34; never 1,234).
 * Other commas must group thousands ("1,234.50"); anything else ("1,23,4") is refused.
 * Returns null for anything that is not a positive amount with at most 2 decimals, or above
 * MAX_SATANG. With `allowZero`, "0" and "0.00" give 0 (an opening balance may be zero).
 */
export function parseBahtToSatang(input: string | number | null | undefined, opts: { allowZero?: boolean } = {}): number | null {
  if (input === null || input === undefined) return null;
  const ok = (satang: number) => (satang > MAX_SATANG ? null : satang > 0 || (opts.allowZero && satang === 0) ? satang : null);
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null;
    return ok(Math.round(input * 100));
  }
  let cleaned = toAsciiDigits(input)
    .replace(/฿|บาท|THB|baht/gi, '')
    .replace(/\s/g, '');
  if (/^\d+,\d{1,2}$/.test(cleaned)) cleaned = cleaned.replace(',', '.');
  else if (cleaned.includes(',')) {
    if (!/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) return null;
    cleaned = cleaned.replace(/,/g, '');
  }
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  if (whole.length > 12) return null;
  return ok(Number(whole) * 100 + Number((frac + '00').slice(0, 2)));
}

/** 123450 -> "1,234.50" */
export function formatSatang(satang: number, opts: { decimals?: boolean } = {}): string {
  const decimals = opts.decimals ?? true;
  const negative = satang < 0;
  const abs = Math.abs(Math.round(satang));
  // Whole baht only: round to the nearest baht (฿99.99 reads ฿100, not ฿99).
  const whole = decimals ? Math.floor(abs / 100) : Math.round(abs / 100);
  const frac = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = decimals ? `${grouped}.${String(frac).padStart(2, '0')}` : grouped;
  return negative ? `-${body}` : body;
}

/** 123450 -> "฿1,234.50"; with sign: "+฿1,234.50" / "−฿1,234.50" */
export function formatBaht(
  satang: number,
  opts: { decimals?: boolean; sign?: boolean } = {},
): string {
  const body = formatSatang(Math.abs(satang), opts);
  if (opts.sign) return `${satang < 0 ? '−' : '+'}฿${body}`;
  return `${satang < 0 ? '−' : ''}฿${body}`;
}

/** Satang -> an amount field's text that keeps every satang but hides ".00": 350075 -> "3500.75", 350000 -> "3500". */
export function amountToInput(satang: number | null | undefined): string {
  if (satang === null || satang === undefined) return '';
  return satang % 100 === 0 ? String(satang / 100) : (satang / 100).toFixed(2);
}

/** Satang -> the plain number string used inside an amount text field ("85.5" -> "85.50"). */
export function satangToInput(satang: number | null): string {
  if (satang === null) return '';
  return (satang / 100).toFixed(2);
}
