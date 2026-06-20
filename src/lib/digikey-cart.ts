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
      typeof l.dkPartNumber === "string" && l.dkPartNumber.length > 0,
  );
  if (usable.length === 0) return null;

  const params = new URLSearchParams();
  usable.forEach((l, i) => {
    const n = i + 1;
    params.set(`part${n}`, l.dkPartNumber);
    params.set(`qty${n}`, String(l.quantity));
    if (l.refDes) params.set(`cref${n}`, l.refDes);
  });
  params.set("utm_source", opts.utmSource ?? "otd-academy");

  return `${FASTADD_URL}?${params.toString()}`.slice(0, MAX_URL_LEN);
}
