// Unit tests for setProjectPrice (A5). Fully mocked — no live Stripe, no live DB,
// no real admin session. We mock:
//   - @/lib/stripe        → getStripe (products.create + prices.create)
//   - @/lib/auth-helpers  → requireAdmin (the admin gate)
//   - @/lib/db            → db.project.findUnique / db.project.update
//   - next/cache          → revalidatePath
//
// Guarantees asserted:
//   - a non-admin (requireAdmin throws) is rejected and NO Stripe calls happen.
//   - invalid input (priceCents 0 / negative / non-integer, or a non-cuid
//     projectId) is rejected by Zod before any Stripe call.
//   - a missing project throws and creates no price.
//   - on success: creates a Stripe Product (name = project.name,
//     metadata.projectId) then a one-time Price (product, currency "usd",
//     unit_amount = priceCents, NO recurring), persists stripePriceId + priceCents
//     on the project, and returns { stripePriceId }.
import { beforeEach, describe, expect, test, vi } from "vitest";

const productsCreate = vi.fn();
const pricesCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    products: { create: productsCreate },
    prices: { create: pricesCreate },
  }),
}));

const requireAdmin = vi.fn();
vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: () => requireAdmin(),
}));

const projectFindUnique = vi.fn();
const projectUpdate = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findUnique: (...a: unknown[]) => projectFindUnique(...a),
      update: (...a: unknown[]) => projectUpdate(...a),
    },
  },
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));

import { setProjectPrice } from "@/lib/actions/project-price";

// A valid cuid so the Zod `z.cuid()` gate passes (matches checkout's PROJECT_ID).
const PROJECT_ID = "clh1234567890abcdefghijkl";
const PROJECT = { id: PROJECT_ID, name: "WROOM L1.01", slug: "wroom-l1-01" };

beforeEach(() => {
  productsCreate.mockReset();
  pricesCreate.mockReset();
  requireAdmin.mockReset();
  projectFindUnique.mockReset();
  projectUpdate.mockReset();
  revalidatePath.mockReset();

  requireAdmin.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
  projectFindUnique.mockResolvedValue(PROJECT);
  productsCreate.mockResolvedValue({ id: "prod_123" });
  pricesCreate.mockResolvedValue({ id: "price_123" });
  projectUpdate.mockResolvedValue({ ...PROJECT, stripePriceId: "price_123", priceCents: 4900 });
});

describe("setProjectPrice — authz", () => {
  test("rejects a non-admin and makes no Stripe calls", async () => {
    requireAdmin.mockRejectedValue(new Error("Forbidden: admin only"));

    await expect(
      setProjectPrice({ projectId: PROJECT_ID, priceCents: 4900 }),
    ).rejects.toThrow(/admin only/i);

    expect(productsCreate).not.toHaveBeenCalled();
    expect(pricesCreate).not.toHaveBeenCalled();
    expect(projectUpdate).not.toHaveBeenCalled();
  });
});

describe("setProjectPrice — input validation", () => {
  test("rejects a non-cuid projectId via Zod (no Stripe calls)", async () => {
    await expect(
      setProjectPrice({ projectId: "not-a-cuid", priceCents: 4900 }),
    ).rejects.toThrow();
    expect(productsCreate).not.toHaveBeenCalled();
    expect(pricesCreate).not.toHaveBeenCalled();
  });

  test("rejects priceCents of 0 (no Stripe calls)", async () => {
    await expect(
      setProjectPrice({ projectId: PROJECT_ID, priceCents: 0 }),
    ).rejects.toThrow();
    expect(productsCreate).not.toHaveBeenCalled();
    expect(pricesCreate).not.toHaveBeenCalled();
  });

  test("rejects a negative priceCents (no Stripe calls)", async () => {
    await expect(
      setProjectPrice({ projectId: PROJECT_ID, priceCents: -100 }),
    ).rejects.toThrow();
    expect(productsCreate).not.toHaveBeenCalled();
    expect(pricesCreate).not.toHaveBeenCalled();
  });

  test("rejects a non-integer priceCents (no Stripe calls)", async () => {
    await expect(
      setProjectPrice({ projectId: PROJECT_ID, priceCents: 49.5 }),
    ).rejects.toThrow();
    expect(productsCreate).not.toHaveBeenCalled();
    expect(pricesCreate).not.toHaveBeenCalled();
  });
});

describe("setProjectPrice — missing project", () => {
  test("throws when the project does not exist and creates no price", async () => {
    projectFindUnique.mockResolvedValue(null);

    await expect(
      setProjectPrice({ projectId: PROJECT_ID, priceCents: 4900 }),
    ).rejects.toThrow(/not found|does not exist/i);

    expect(productsCreate).not.toHaveBeenCalled();
    expect(pricesCreate).not.toHaveBeenCalled();
    expect(projectUpdate).not.toHaveBeenCalled();
  });
});

describe("setProjectPrice — success", () => {
  test("creates a Product then a one-time Price, persists, and returns the price id", async () => {
    const result = await setProjectPrice({
      projectId: PROJECT_ID,
      priceCents: 4900,
    });

    expect(result).toEqual({ stripePriceId: "price_123" });

    // Product: name = project.name, metadata.projectId = project.id.
    expect(productsCreate).toHaveBeenCalledTimes(1);
    expect(productsCreate).toHaveBeenCalledWith({
      name: "WROOM L1.01",
      metadata: { projectId: PROJECT_ID },
    });

    // Price: one-time — product, currency usd, unit_amount, and NO recurring.
    expect(pricesCreate).toHaveBeenCalledTimes(1);
    const priceArg = pricesCreate.mock.calls[0]![0] as {
      product: string;
      currency: string;
      unit_amount: number;
      recurring?: unknown;
    };
    expect(priceArg.product).toBe("prod_123");
    expect(priceArg.currency).toBe("usd");
    expect(priceArg.unit_amount).toBe(4900);
    expect(priceArg).not.toHaveProperty("recurring");

    // Persist stripePriceId + priceCents on the project row.
    expect(projectUpdate).toHaveBeenCalledWith({
      where: { id: PROJECT_ID },
      data: { stripePriceId: "price_123", priceCents: 4900 },
    });
  });

  test("creates the Product before the Price (ordering)", async () => {
    const order: string[] = [];
    productsCreate.mockImplementation(async () => {
      order.push("product");
      return { id: "prod_123" };
    });
    pricesCreate.mockImplementation(async () => {
      order.push("price");
      return { id: "price_123" };
    });

    await setProjectPrice({ projectId: PROJECT_ID, priceCents: 4900 });

    expect(order).toEqual(["product", "price"]);
  });

  test("revalidates the project admin page and the guide hub", async () => {
    await setProjectPrice({ projectId: PROJECT_ID, priceCents: 4900 });

    expect(revalidatePath).toHaveBeenCalledWith("/projects/wroom-l1-01");
    expect(revalidatePath).toHaveBeenCalledWith("/learn/wroom-l1-01");
  });
});
