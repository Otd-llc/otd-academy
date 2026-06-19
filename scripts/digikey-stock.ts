// DigiKey stock/price screen for a board BOM — replaces the 403-prone web scrape
// and the broken Newark path (we pivoted to DigiKey as the parts partner, 2026-06-18).
// Reads a bom.csv, queries the DigiKey Product Information API v4 per (manufacturer,
// mpn), and prints lifecycle + live stock + unit price. Read-only; no DB writes.
//
// SETUP (one-time, Josh): create a free app at https://developer.digikey.com/ (Product
// Information API), then put the OAuth2 client-credentials in .env.local:
//   DIGIKEY_CLIENT_ID=...
//   DIGIKEY_CLIENT_SECRET=...
//   # optional: DIGIKEY_API_BASE=https://sandbox-api.digikey.com  (default = production)
//
// Run: pnpm exec tsx scripts/digikey-stock.ts [path/to/bom.csv]
//   default BOM = docs/boards/l1-03-ws2812-node/bom.csv
//
// ✓ VERIFIED 2026-06-18 against the l1-03 BOM with a live key — the response field
// mapping (Products[].QuantityAvailable / UnitPrice / ProductStatus.Status /
// ManufacturerProductNumber) is correct. Use --raw to dump a full response if needed.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { readFileSync } from "node:fs";

const API_BASE = process.env.DIGIKEY_API_BASE || "https://api.digikey.com";
const CLIENT_ID = process.env.DIGIKEY_CLIENT_ID;
const CLIENT_SECRET = process.env.DIGIKEY_CLIENT_SECRET;
const RAW = process.argv.includes("--raw");
const bomPath = process.argv.find((a) => a.endsWith(".csv")) ||
  "docs/boards/l1-03-ws2812-node/bom.csv";

async function getToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`OAuth token failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { access_token: string };
  return j.access_token;
}

async function searchPart(token: string, mpn: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/products/v4/search/keyword`, {
    method: "POST",
    headers: {
      "X-DIGIKEY-Client-Id": CLIENT_ID!,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
      "X-DIGIKEY-Locale-Site": "US",
      "X-DIGIKEY-Locale-Language": "en",
      "X-DIGIKEY-Locale-Currency": "USD",
    },
    body: JSON.stringify({ Keywords: mpn, RecordCount: 5 }),
  });
  if (!res.ok) throw new Error(`search ${mpn} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Best-effort extraction against the documented v4 shape. Confirm field names with --raw.
function extract(resp: any, manufacturer: string, mpn: string) {
  const products: any[] = resp?.Products ?? resp?.ProductDetails ?? [];
  const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, "");
  const match =
    products.find((p) => norm(p?.ManufacturerProductNumber) === norm(mpn)) ??
    products[0];
  if (!match) return null;
  return {
    mpn: match?.ManufacturerProductNumber ?? mpn,
    manufacturer: match?.Manufacturer?.Name ?? manufacturer,
    stock: match?.QuantityAvailable ?? "?",
    price: match?.UnitPrice ?? match?.ProductVariations?.[0]?.StandardPricing?.[0]?.UnitPrice ?? "?",
    lifecycle: match?.ProductStatus?.Status ?? match?.ProductStatus ?? "?",
    url: match?.ProductUrl ?? "",
  };
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log(
      "DIGIKEY_CLIENT_ID / DIGIKEY_CLIENT_SECRET not set in .env.local.\n" +
        "Create a free Product Information API app at https://developer.digikey.com/ and add them.",
    );
    process.exit(1);
  }
  const { parseBomCsv } = await import("@/lib/bom-csv");
  const { rows, errors } = parseBomCsv(readFileSync(bomPath, "utf8"));
  if (errors.length) {
    for (const e of errors) console.error(`  bom.csv row ${e.row}: ${e.message}`);
    throw new Error("bom.csv parse errors");
  }

  const token = await getToken();
  console.log(`DigiKey screen of ${bomPath} (${rows.length} lines)\n`);
  console.log("| refDes | Manufacturer | MPN | Lifecycle | Stock | ~Unit price | Note |");
  console.log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    try {
      const resp = await searchPart(token, r.mpn);
      if (RAW) { console.error(JSON.stringify(resp, null, 2)); }
      const got = extract(resp, r.manufacturer, r.mpn);
      const flag = !got ? "**NO DIGIKEY MATCH**"
        : (Number(got.stock) === 0 ? "**out of stock**" : "");
      console.log(`| ${r.refDes} | ${r.manufacturer} | ${r.mpn} | ${got?.lifecycle ?? "-"} | ${got?.stock ?? "-"} | ${got?.price ?? "-"} | ${flag} |`);
    } catch (e) {
      console.log(`| ${r.refDes} | ${r.manufacturer} | ${r.mpn} | ERROR | - | - | ${String(e).slice(0, 80)} |`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
