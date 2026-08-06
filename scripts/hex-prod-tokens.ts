/**
 * READ-ONLY: decode every saved prod payload and report which enum tokens it
 * uses, so we can tell whether any stored build references a type that has
 * since been deleted from the configurator.
 *
 * Why: locally, one saved build carries `tb-1-power-full`, a CarrierType removed
 * on 2026-08-02 with no `migrate()` case — it decodes as `malformed`, so its
 * /c/ link boots the demo instead of the build. Nothing in CI catches an enum
 * deletion. This checks whether prod has the same class of row.
 *
 * Payloads are opaque, PII-free scene state (schema.prisma:1497-1499).
 * Throwaway: delete once the answer is recorded.
 */
import { inflateRawSync } from "node:zlib";

// The live unions, copied from bioscale-viz/src/hex/state-url.ts. If a stored
// payload uses a token absent here, that build can no longer be restored.
const CARRIER = new Set([
  "empty-base",
  "hex-tb-carrier-solid",
  "hex-tb-carrier-parts-tray",
  "hex-tb-carrier-half-N-solid",
  "hex-tb-carrier-half-N-parts-tray",
  "hex-tb-carrier-half-S-solid",
  "hex-tb-carrier-half-S-parts-tray",
  "hex-tb-carrier-half-E-solid",
  "hex-tb-carrier-half-E-parts-tray",
  "hex-tb-carrier-half-W-solid",
  "hex-tb-carrier-half-W-parts-tray",
]);
const BASE_TYPE = new Set(["full", "half-solid", "half-1h", "half-2h", "half-3h"]);
const SUBSLOT = new Set(["full", "half-N", "half-S", "half-W", "half-E"]);

function decode(payload: string): unknown {
  const eq = payload.indexOf("=");
  const prefix = payload.slice(0, eq);
  const body = payload.slice(eq + 1);
  const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Buffer.from(b64, "base64");
  const json = prefix === "s" ? inflateRawSync(bytes).toString() : bytes.toString();
  return JSON.parse(json);
}

async function main() {
  const { db } = await import("@/lib/db");
  const revs = await db.hexClusterRevision.findMany({
    select: {
      shareCode: true,
      revNo: true,
      payload: true,
      schemaVersion: true,
      summary: true,
      cluster: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  let broken = 0;
  for (const r of revs) {
    let state: any;
    try {
      state = decode(r.payload);
    } catch (e) {
      broken++;
      console.log(`BROKEN (decode threw)  ${r.shareCode}  "${r.cluster.name}"  ${String(e)}`);
      continue;
    }
    const carriers = new Set<string>();
    const baseTypes = new Set<string>();
    const subSlots = new Set<string>();
    for (const c of state.c ?? []) {
      carriers.add(c.cr);
      baseTypes.add(c.bt);
      subSlots.add(c.ss);
    }
    const bad = [
      ...[...carriers].filter((x) => !CARRIER.has(x)).map((x) => `carrier:${x}`),
      ...[...baseTypes].filter((x) => !BASE_TYPE.has(x)).map((x) => `baseType:${x}`),
      ...[...subSlots].filter((x) => !SUBSLOT.has(x)).map((x) => `subSlot:${x}`),
    ];
    if (bad.length) broken++;
    console.log(
      `${bad.length ? "RETIRED TOKENS" : "ok            "}  ${r.shareCode}  rev${r.revNo}  ` +
        `v${r.schemaVersion}  cells=${(state.c ?? []).length}  ` +
        `chars=${r.payload.length}  "${r.cluster.name}"` +
        (bad.length ? `\n     -> ${bad.join(", ")}` : ""),
    );
    console.log(`     carriers: ${[...carriers].join(", ")}`);
  }
  console.log(`\n${broken} of ${revs.length} revisions cannot be restored by today's configurator.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
