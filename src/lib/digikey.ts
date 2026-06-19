import { env } from "@/env";

const BASE = env.DIGIKEY_API_BASE || "https://api.digikey.com";

export interface DkSnapshot {
  matched: boolean;
  stockQty: number | null;
  unitPriceCents: number | null;
  inStock: boolean | null;
  lifecycle: string | null;
  productUrl: string | null;
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
        headers: {
          "X-DIGIKEY-Client-Id": env.DIGIKEY_CLIENT_ID!,
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          accept: "application/json",
          "X-DIGIKEY-Locale-Site": "US",
          "X-DIGIKEY-Locale-Language": "en",
          "X-DIGIKEY-Locale-Currency": "USD",
        },
        body: JSON.stringify({ Keywords: mpn, RecordCount: 5 }),
      });
      if (!res.ok) throw new Error(`DigiKey search ${res.status}`);
      const json = (await res.json()) as { Products?: any[] };
      const products = json.Products ?? [];
      const match =
        products.find((p) => norm(p?.ManufacturerProductNumber ?? "") === norm(mpn)) ??
        products[0];
      return normalizeDkProduct(match, mpn);
    },
  };
}
