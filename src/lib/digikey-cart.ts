// DigiKey FastAdd cart URL builder. FastAdd is DigiKey's official scheme for
// bulk-adding a BOM to a cart from third-party tooling via a plain GET URL
// (forum.digikey.com thread 61356): the learner's browser navigates to it, so it
// sidesteps the Cloudflare bot-challenge that blocks server-to-server POSTs to
// the newer mylists/api/thirdparty endpoint. FastAdd keys on DigiKey part
// numbers (e.g. "311-10.0KCRCT-ND"), NOT MPNs — hence Part.dkPartNumber, captured
// by the availability watchdog. The URL is built server-side from the DB BOM.
const FASTADD_URL = "https://www.digikey.com/classic/ordering/fastadd.aspx";
const MAX_URL_LEN = 1700; // FastAdd's documented safe ceiling.

export interface FastAddLine {
  dkPartNumber: string | null;
  quantity: number;
  refDes: string;
}

export interface FastAddOptions {
  // Attribution tag DigiKey reads for referral tracking.
  utmSource?: string;
}

// Build a FastAdd URL from BOM lines. Lines without a DigiKey part number are
// skipped (and the rest renumbered part1..partN). Returns null when no line is
// usable, so the caller can hide the button. cref carries the refDes.
export function buildFastAddUrl(
  lines: FastAddLine[],
  opts: FastAddOptions = {},
): string | null {
  const usable = lines.filter(
    (l): l is FastAddLine & { dkPartNumber: string } =>
      typeof l.dkPartNumber === "string" &&
      l.dkPartNumber.length > 0 &&
      Number.isInteger(l.quantity) &&
      l.quantity > 0,
  );
  if (usable.length === 0) return null;

  // Add lines one at a time, keeping the FULL URL under MAX_URL_LEN. A naive
  // `.slice(MAX_URL_LEN)` would cut mid-parameter (e.g. `&qty12=10` → `&qty1`, or
  // mid-`%2C`), silently producing a malformed / partial cart. Instead, drop WHOLE
  // lines once the next one wouldn't fit — a short, correct cart beats a broken one.
  // utm_source is set first so it's always present and counted in the budget.
  const params = new URLSearchParams();
  params.set("utm_source", opts.utmSource ?? "otd-academy");
  let n = 0;
  for (const l of usable) {
    const k = n + 1;
    params.set(`part${k}`, l.dkPartNumber);
    params.set(`qty${k}`, String(l.quantity));
    if (l.refDes) params.set(`cref${k}`, l.refDes);
    if (`${FASTADD_URL}?${params.toString()}`.length > MAX_URL_LEN) {
      params.delete(`part${k}`);
      params.delete(`qty${k}`);
      params.delete(`cref${k}`);
      break;
    }
    n = k;
  }
  if (n === 0) return null; // not even one line fits the budget

  return `${FASTADD_URL}?${params.toString()}`;
}
