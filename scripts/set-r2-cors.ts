// One-off: set the R2 bucket CORS policy so the browser → R2 presigned PUT
// (the datasheet upload, and the revision/build artifact uploads) is allowed
// from localhost + production.
//
// Uses the R2 S3 credentials already in .env.local (the same ones the app uses
// to presign) via the S3 PutBucketCors API — NO Cloudflare API token / wrangler
// login required. The rules come from the repo-root `cors.json`.
//
// NON-DESTRUCTIVE: reads the bucket's current CORS first and MERGES (preserves
// every existing rule that isn't byte-identical to one we're adding), so it
// can't clobber a rule the prod artifact pipeline relies on. Idempotent.
//
// Run:  pnpm exec tsx scripts/set-r2-cors.ts
import { readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });

import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
  type CORSRule,
} from "@aws-sdk/client-s3";

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing R2_* env — need R2_ACCOUNT_ID / R2_BUCKET / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in .env.local.",
    );
  }

  const desired: CORSRule[] = JSON.parse(
    readFileSync(new URL("../cors.json", import.meta.url), "utf8"),
  );

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  // Current rules (NoSuchCORSConfiguration → none yet).
  let existing: CORSRule[] = [];
  try {
    const got = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
    existing = got.CORSRules ?? [];
  } catch (err) {
    if ((err as { name?: string })?.name !== "NoSuchCORSConfiguration") throw err;
  }
  console.log(`Bucket "${bucket}" — existing CORS rules: ${existing.length}`);
  console.log(JSON.stringify(existing, null, 2));

  // Merge: keep existing rules that aren't byte-identical to a desired one.
  const desiredKeys = new Set(desired.map((r) => JSON.stringify(r)));
  const merged = [
    ...existing.filter((r) => !desiredKeys.has(JSON.stringify(r))),
    ...desired,
  ];

  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: { CORSRules: merged },
    }),
  );
  console.log(`\n✓ CORS applied to "${bucket}" (${merged.length} rule(s)).`);

  const after = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log("\nFinal CORS rules:");
  console.log(JSON.stringify(after.CORSRules ?? [], null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
