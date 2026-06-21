import { env } from "@/env";

const BASE = env.DIGIKEY_API_BASE || "https://api.digikey.com";

export interface DkSnapshot {
  matched: boolean;
  stockQty: number | null;
  unitPriceCents: number | null;
  inStock: boolean | null;
  lifecycle: string | null;
  productUrl: string | null;
  // DigiKey part number of the lowest-MOQ variation (typically Cut Tape, MOQ 1),
  // the right one for learners buying singles. Used to build FastAdd cart URLs
  // (which key on DigiKey part numbers, not MPNs). Null when no variation present.
  partNumber: string | null;
}

// Pick the variation a learner should buy: lowest MinimumOrderQuantity (Cut Tape
// over reels), falling back to the first variation. Returns its DigiKey part
// number, or null when the product carries no variations.
function pickDkPartNumber(variations: unknown): string | null {
  if (!Array.isArray(variations) || variations.length === 0) return null;
  const withMoq = variations.filter(
    (v) => v && typeof v.DigiKeyProductNumber === "string",
  );
  if (withMoq.length === 0) return null;
  const best = withMoq.reduce((a, b) => {
    const am = typeof a.MinimumOrderQuantity === "number" ? a.MinimumOrderQuantity : Infinity;
    const bm = typeof b.MinimumOrderQuantity === "number" ? b.MinimumOrderQuantity : Infinity;
    return bm < am ? b : a;
  });
  return best.DigiKeyProductNumber as string;
}

export function digikeyConfigured(): boolean {
  return Boolean(env.DIGIKEY_CLIENT_ID && env.DIGIKEY_CLIENT_SECRET);
}

export function normalizeDkProduct(p: any, _mpn: string): DkSnapshot {
  if (!p) {
    return {
      matched: false,
      stockQty: null,
      unitPriceCents: null,
      inStock: null,
      lifecycle: null,
      productUrl: null,
      partNumber: null,
    };
  }
  const qty = typeof p.QuantityAvailable === "number" ? p.QuantityAvailable : null;
  const price = typeof p.UnitPrice === "number" ? Math.round(p.UnitPrice * 100) : null;
  return {
    matched: true,
    stockQty: qty,
    unitPriceCents: price,
    inStock: qty == null ? null : qty > 0,
    lifecycle:
      p.ProductStatus?.Status ??
      (typeof p.ProductStatus === "string" ? p.ProductStatus : null),
    productUrl: p.ProductUrl ?? null,
    partNumber: pickDkPartNumber(p.ProductVariations),
  };
}

function dkHeaders(token: string): Record<string, string> {
  return {
    "X-DIGIKEY-Client-Id": env.DIGIKEY_CLIENT_ID!,
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    accept: "application/json",
    "X-DIGIKEY-Locale-Site": "US",
    "X-DIGIKEY-Locale-Language": "en",
    "X-DIGIKEY-Locale-Currency": "USD",
  };
}

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DIGIKEY_CLIENT_ID!,
      client_secret: env.DIGIKEY_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`DigiKey OAuth ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export interface DkClient {
  searchByMpn(mpn: string): Promise<DkSnapshot>;
}

export async function makeDigikeyClient(): Promise<DkClient> {
  const token = await getToken();
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  return {
    async searchByMpn(mpn: string): Promise<DkSnapshot> {
      const res = await fetch(`${BASE}/products/v4/search/keyword`, {
        method: "POST",
        headers: dkHeaders(token),
        body: JSON.stringify({ Keywords: mpn, RecordCount: 5 }),
      });
      if (!res.ok) throw new Error(`DigiKey search ${res.status}`);
      const json = (await res.json()) as { Products?: any[] };
      const products = json.Products ?? [];
      const match =
        products.find((p) => norm(p?.ManufacturerProductNumber ?? "") === norm(mpn)) ??
        products[0];
      const keywordSnap = normalizeDkProduct(match, mpn);

      // Keyword data may be up to 24h stale; ProductDetails is real-time. Resolve
      // the DK part number from the keyword hit, then refresh price/stock from
      // ProductDetails. Any failure → keep the keyword snapshot (no regression).
      if (!keywordSnap.partNumber) return keywordSnap;
      try {
        const dres = await fetch(
          `${BASE}/products/v4/search/${encodeURIComponent(keywordSnap.partNumber)}/productdetails`,
          { method: "GET", headers: dkHeaders(token) },
        );
        if (!dres.ok) return keywordSnap;
        const djson = (await dres.json()) as { Product?: any };
        const detailed = normalizeDkProduct(djson.Product, mpn);
        if (!detailed.matched) return keywordSnap;
        // Prefer ProductDetails' fresh value PER FIELD, but fall back to the
        // keyword snapshot for any field ProductDetails didn't yield. A 200-OK
        // ProductDetails response can be sparse (e.g. price nested under
        // ProductVariations[].StandardPricing, QuantityAvailable absent), which
        // would make `detailed` "matched" with null stock/price — adopting that
        // wholesale would WIPE good keyword price/stock on the nightly run.
        // Per-field `??` is never worse than the keyword snapshot.
        return {
          matched: true,
          stockQty: detailed.stockQty ?? keywordSnap.stockQty,
          unitPriceCents: detailed.unitPriceCents ?? keywordSnap.unitPriceCents,
          inStock: detailed.inStock ?? keywordSnap.inStock,
          lifecycle: detailed.lifecycle ?? keywordSnap.lifecycle,
          productUrl: detailed.productUrl ?? keywordSnap.productUrl,
          partNumber: detailed.partNumber ?? keywordSnap.partNumber,
        };
      } catch {
        return keywordSnap;
      }
    },
  };
}
