/**
 * Money helpers. All amounts are integers in satang.
 */

/**
 * Parse what a user (or a slip) wrote into satang.
 * Accepts "1,234.50", "1234.5", "฿85", "85 บาท", " 1 234.00 ".
 * Returns null for anything that is not a positive amount with at most 2 decimals.
 */
export function parseBahtToSatang(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) return null;
    return Math.round(input * 100);
  }
  const cleaned = input
    .replace(/฿|บาท|THB|baht/gi, '')
    .replace(/[,\s]/g, '')
    .trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const satang = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  return satang > 0 ? satang : null;
}

/** 123450 -> "1,234.50" */
export function formatSatang(satang: number, opts: { decimals?: boolean } = {}): string {
  const decimals = opts.decimals ?? true;
  const negative = satang < 0;
  const abs = Math.abs(Math.round(satang));
  const whole = Math.floor(abs / 100);
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

/** Satang -> the plain number string used inside an amount text field ("85.5" -> "85.50"). */
export function satangToInput(satang: number | null): string {
  if (satang === null) return '';
  return (satang / 100).toFixed(2);
}
