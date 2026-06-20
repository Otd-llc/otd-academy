import { afterEach, describe, expect, test, vi } from "vitest";
import { makeDigikeyClient, normalizeDkProduct } from "@/lib/digikey";

afterEach(() => vi.restoreAllMocks());

describe("normalizeDkProduct", () => {
  test("maps the v4 product fields", () => {
    const snap = normalizeDkProduct(
      {
        ManufacturerProductNumber: "SN74AHCT125DR",
        QuantityAvailable: 11173,
        UnitPrice: 0.9,
        ProductStatus: { Status: "Active" },
        ProductUrl: "https://www.digikey.com/x",
      },
      "SN74AHCT125DR",
    );
    expect(snap).toEqual({
      matched: true,
      stockQty: 11173,
      unitPriceCents: 90,
      inStock: true,
      lifecycle: "Active",
      productUrl: "https://www.digikey.com/x",
      partNumber: null,
    });
  });

  test("picks the lowest-MOQ variation's DigiKey part number (Cut Tape for learners)", () => {
    const snap = normalizeDkProduct(
      {
        ManufacturerProductNumber: "RC0805FR-0710KL",
        QuantityAvailable: 50000,
        UnitPrice: 0.1,
        ProductStatus: { Status: "Active" },
        ProductVariations: [
          { DigiKeyProductNumber: "311-10.0KCRTR-ND", MinimumOrderQuantity: 5000, PackageType: { Name: "Tape & Reel (TR)" } },
          { DigiKeyProductNumber: "311-10.0KCRCT-ND", MinimumOrderQuantity: 1, PackageType: { Name: "Cut Tape (CT)" } },
          { DigiKeyProductNumber: "311-10.0KCRDKR-ND", MinimumOrderQuantity: 1, PackageType: { Name: "Digi-Reel®" } },
        ],
      },
      "RC0805FR-0710KL",
    );
    expect(snap.partNumber).toBe("311-10.0KCRCT-ND");
  });

  test("no variations → partNumber null", () => {
    const snap = normalizeDkProduct(
      { ManufacturerProductNumber: "X", QuantityAvailable: 1, UnitPrice: 1 },
      "X",
    );
    expect(snap.partNumber).toBeNull();
  });

  test("zero stock → inStock false", () => {
    const snap = normalizeDkProduct(
      { ManufacturerProductNumber: "X", QuantityAvailable: 0, UnitPrice: 1 },
      "X",
    );
    expect(snap.inStock).toBe(false);
  });

  test("null product → not matched", () => {
    const snap = normalizeDkProduct(null, "X");
    expect(snap.matched).toBe(false);
  });
});

// V4: searchByMpn must pick the EXACT-MPN match, not Products[0], and throw on non-OK.
function tokenResponse(): Response {
  return new Response(JSON.stringify({ access_token: "tok" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("searchByMpn", () => {
  test("picks the exact-MPN match, not Products[0]", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Products: [
              {
                ManufacturerProductNumber: "SOMETHING-ELSE",
                QuantityAvailable: 999,
                UnitPrice: 5,
                ProductStatus: { Status: "Active" },
              },
              {
                ManufacturerProductNumber: "SN74AHCT125DR",
                QuantityAvailable: 42,
                UnitPrice: 1.5,
                ProductStatus: { Status: "Active" },
                ProductUrl: "https://www.digikey.com/exact",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const client = await makeDigikeyClient();
    const snap = await client.searchByMpn("SN74AHCT125DR");
    expect(snap.stockQty).toBe(42);
    expect(snap.productUrl).toBe("https://www.digikey.com/exact");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("non-OK search status throws", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response("nope", { status: 500 }));

    const client = await makeDigikeyClient();
    await expect(client.searchByMpn("X")).rejects.toThrow(/DigiKey search 500/);
  });

  test("uses ProductDetails (real-time) for price/stock when a DK part number resolves", async () => {
    const keywordBody = {
      Products: [
        {
          ManufacturerProductNumber: "SN74AHCT125DR",
          QuantityAvailable: 1, // stale keyword value
          UnitPrice: 9.99,
          ProductStatus: { Status: "Active" },
          ProductVariations: [{ DigiKeyProductNumber: "296-XYZ-ND", MinimumOrderQuantity: 1 }],
        },
      ],
    };
    const detailsBody = {
      Product: {
        ManufacturerProductNumber: "SN74AHCT125DR",
        QuantityAvailable: 4242, // fresh ProductDetails value
        UnitPrice: 1.23,
        ProductStatus: { Status: "Active" },
        ProductUrl: "https://www.digikey.com/fresh",
        ProductVariations: [{ DigiKeyProductNumber: "296-XYZ-ND", MinimumOrderQuantity: 1 }],
      },
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify(keywordBody), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(detailsBody), { status: 200, headers: { "content-type": "application/json" } }));

    const client = await makeDigikeyClient();
    const snap = await client.searchByMpn("SN74AHCT125DR");
    expect(snap.stockQty).toBe(4242);
    expect(snap.unitPriceCents).toBe(123);
    expect(snap.productUrl).toBe("https://www.digikey.com/fresh");
  });

  test("falls back to the keyword snapshot when ProductDetails is unavailable", async () => {
    const keywordBody = {
      Products: [
        {
          ManufacturerProductNumber: "X",
          QuantityAvailable: 7,
          UnitPrice: 2,
          ProductStatus: { Status: "Active" },
          ProductVariations: [{ DigiKeyProductNumber: "296-XYZ-ND", MinimumOrderQuantity: 1 }],
        },
      ],
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify(keywordBody), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response("err", { status: 500 }));

    const client = await makeDigikeyClient();
    const snap = await client.searchByMpn("X");
    expect(snap.stockQty).toBe(7); // keyword fallback, no throw
  });
});
