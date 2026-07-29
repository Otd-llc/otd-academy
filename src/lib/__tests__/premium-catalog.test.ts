import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { countPublishedPremiumProjects } from "@/lib/premium-catalog";

// Throwaway rows: each DB-test file leases its own branch, so creating and
// deleting projects here cannot disturb the shared seed fixture.
const SLUGS = ["zz-count-published", "zz-count-unpublished", "zz-count-archived"];

afterAll(async () => {
  // Revision.projectId cascades, so deleting the projects is sufficient.
  await db.project.deleteMany({ where: { slug: { in: SLUGS } } });
});

describe("countPublishedPremiumProjects", () => {
  it("counts published PREMIUM projects and excludes unpublished + archived", async () => {
    const owner = await db.user.findFirst({ select: { id: true } });
    if (!owner) throw new Error("no User rows -- run pnpm db:seed first");

    const before = await countPublishedPremiumProjects();
    const base = { accessTier: "PREMIUM" as const, createdById: owner.id };

    // (1) PREMIUM + published + not archived -> counts.
    const live = await db.project.create({
      data: { ...base, slug: SLUGS[0], name: "zz count published" },
    });
    const liveRev = await db.revision.create({
      data: { projectId: live.id, label: "A" },
    });
    await db.project.update({
      where: { id: live.id },
      data: { publishedRevisionId: liveRev.id },
    });

    // (2) PREMIUM, priced-but-never-published -> must NOT count. This is the
    // real-world case: 16 such projects carry live Stripe prices today.
    await db.project.create({
      data: { ...base, slug: SLUGS[1], name: "zz count unpublished" },
    });

    // (3) PREMIUM + published but archived -> must NOT count.
    const arch = await db.project.create({
      data: { ...base, slug: SLUGS[2], name: "zz count archived" },
    });
    const archRev = await db.revision.create({
      data: { projectId: arch.id, label: "A" },
    });
    await db.project.update({
      where: { id: arch.id },
      data: { publishedRevisionId: archRev.id, archivedAt: new Date() },
    });

    expect(await countPublishedPremiumProjects()).toBe(before + 1);
  });
});
