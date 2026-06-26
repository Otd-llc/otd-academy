/**
 * Throwaway live-stock screen: pass MPNs as args, prints DigiKey snapshot per MPN.
 *   pnpm exec tsx scripts/digikey-stock.ts "MPN1" "MPN2" ...
 * Read-only (no DB writes). Needs DIGIKEY_CLIENT_ID/SECRET in .env.local.
 * Inlines the DigiKey calls (process.env) to avoid the strict @/env validator.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const BASE = process.env.DIGIKEY_API_BASE || "https://api.digikey.com";
const ID = process.env.DIGIKEY_CLIENT_ID;
const SECRET = process.env.DIGIKEY_CLIENT_SECRET;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ID!,
      client_secret: SECRET!,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`OAuth ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

function headers(token: string): Record<string, string> {
  return {
    "X-DIGIKEY-Client-Id": ID!,
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    accept: "application/json",
    "X-DIGIKEY-Locale-Site": "US",
    "X-DIGIKEY-Locale-Language": "en",
    "X-DIGIKEY-Locale-Currency": "USD",
  };
}

async function screen(token: string, mpn: string) {
  const res = await fetch(`${BASE}/products/v4/search/keyword`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ Keywords: mpn, RecordCount: 5 }),
  });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const json = (await res.json()) as { Products?: any[] };
  const products = json.Products ?? [];
  const p =
    products.find((x) => norm(x?.ManufacturerProductNumber ?? "") === norm(mpn)) ?? products[0];
  if (!p) return `${mpn.padEnd(22)} NO MATCH`;
  const qty = typeof p.QuantityAvailable === "number" ? p.QuantityAvailable : null;
  const price = typeof p.UnitPrice === "number" ? `$${p.UnitPrice.toFixed(2)}` : "—";
  const status = p.ProductStatus?.Status ?? p.ProductStatus ?? "—";
  const mfr = p.Manufacturer?.Name ?? p.Manufacturer ?? "—";
  return `${mpn.padEnd(22)} ${mfr.toString().padEnd(22)} stock=${qty ?? "—"} price=${price} status=${status}`;
}

async function main() {
  if (!ID || !SECRET) {
    console.error("missing DIGIKEY_CLIENT_ID/SECRET");
    process.exit(1);
  }
  const mpns = process.argv.slice(2);
  const token = await getToken();
  for (const mpn of mpns) {
    try {
      console.log(await screen(token, mpn));
    } catch (e) {
      console.log(`${mpn.padEnd(22)} ERROR ${(e as Error).message}`);
    }
  }
}

main();
