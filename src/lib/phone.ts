/**
 * Normalises a Nigerian mobile number to E.164 (+234XXXXXXXXXX).
 * Accepts 0803…, 803…, 234803… and +234 803… forms with spaces or dashes.
 * Returns null when the input isn't a valid Nigerian mobile number.
 */
export function normalizeNigerianPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  let national: string;
  if (/^234\d{10}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{10}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{10}$/.test(digits)) national = digits;
  else return null;
  // Mobile ranges: 70x, 80x, 81x, 90x, 91x.
  if (!/^[789][01]\d{8}$/.test(national)) return null;
  return `+234${national}`;
}

/** +2348031234567 → 0803 123 4567 */
export function formatNigerianPhone(e164: string): string {
  const m = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}
