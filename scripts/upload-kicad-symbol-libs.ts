// Upload the KiCad 10 standard SYMBOL-lib sources to R2 so the layered export
// resolver (Task 5) can fetch + flatten a referenced symbol on a cache miss.
// Footprints are NOT uploaded — they stay referenced from the learner's local
// fp-lib-table at PCB time.
//
// Idempotent: HEAD-skips libs already present under the version prefix.
// Run (needs R2_ENABLED + R2_BUCKET): pnpm exec tsx scripts/upload-kicad-symbol-libs.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

import { KICAD_LIB_VERSION } from "@/lib/kicad/version";

const SYM_DIR = "C:\\Program Files\\KiCad\\10.0\\share\\kicad\\symbols";

async function main() {
  // Deferred: `@/env` / `@/lib/r2` read process.env at import — ESM hoists static
  // imports ABOVE the dotenv call above, so import them only after env is loaded.
  const { env } = await import("@/env");
  const { r2 } = await import("@/lib/r2");

  if (!env.R2_ENABLED || !env.R2_BUCKET) {
    console.error(
      "R2 is not enabled (need R2_ENABLED=true + R2_BUCKET in .env.local). Aborting.",
    );
    process.exit(1);
  }
  const bucket = env.R2_BUCKET;

  const exists = async (key: string): Promise<boolean> => {
    try {
      await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  };

  const files = readdirSync(SYM_DIR).filter((f) => f.endsWith(".kicad_sym"));
  let uploaded = 0;
  let skipped = 0;
  for (const file of files) {
    const lib = file.slice(0, -".kicad_sym".length);
    const key = `kicad/symbols/${KICAD_LIB_VERSION}/${lib}.kicad_sym`;
    if (await exists(key)) {
      skipped++;
      continue;
    }
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: readFileSync(join(SYM_DIR, file)),
        ContentType: "text/plain; charset=utf-8",
      }),
    );
    uploaded++;
  }

  console.log(
    `R2 kicad/symbols/${KICAD_LIB_VERSION}: ${uploaded} uploaded, ${skipped} skipped (of ${files.length}).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
