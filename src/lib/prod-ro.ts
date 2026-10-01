// Read-only PRODUCTION access for scripts that only report.
//
// The owner URLs (PROD_DATABASE_URL / PROD_DIRECT_URL, role neondb_owner) can
// write, and `pnpm db:prod` exists to make that deliberate. A report should
// not be able to write even by mistake, so it connects as `foundry_ro`
// instead: SELECT-only grants, a default ACL for future tables, and
// `default_transaction_read_only = on` on the role (provisioned 2026-06, see
// mcp/parts-server/README.md section 6; verified against pg_roles /
// pg_default_acl 2026-09-30).
//
// `classifyProdRoUrl` is PURE so the refusals can be unit-tested without a
// database. `openReadOnly` then adds the two things only a connection can:
// it sets the session read-only itself (belt, in case the role setting is
// ever dropped) and PROVES it before the caller runs anything, by issuing a
// no-op UPDATE that must be rejected. A script that reports "read-only" is
// making a claim; this is the measurement behind it. hex-prod-census.ts
// carried that claim for a month with no transaction at all.
import pg from "pg";

export const PROD_RO_ROLE = "foundry_ro";
export const PROD_RO_PLACEHOLDER = "REPLACE-WITH-NEW-PASSWORD";

export type ProdRoVerdict =
  { ok: true; host: string } | { ok: false; reason: string };

/** The process environment, or any bag with these keys. Typed as a plain
 *  record so `process.env` passes without a cast (a property-only type would
 *  trip TypeScript's weak-type check against ProcessEnv). The keys read:
 *  PROD_RO_DATABASE_URL (the foundry_ro string), PROD_DATABASE_URL and
 *  PROD_DIRECT_URL (the owner strings, refused), and DATABASE_URL (what the
 *  process would use as "the" database: under `pnpm db:prod` it has been
 *  swapped to the owner URL, the one way a read-only script could end up
 *  holding a writable connection, so a remote host there is refused). */
export type ProdRoEnv = Readonly<Record<string, string | undefined>>;

function parse(url: string): URL | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") return null;
    return u;
  } catch {
    return null;
  }
}

function isLocal(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/** Decide whether `env.PROD_RO_DATABASE_URL` may be opened by a read-only script. */
export function classifyProdRoUrl(env: ProdRoEnv): ProdRoVerdict {
  const raw = env.PROD_RO_DATABASE_URL;
  if (!raw) {
    return {
      ok: false,
      reason:
        "PROD_RO_DATABASE_URL is not set in .env.local (the foundry_ro connection string).",
    };
  }
  const u = parse(raw);
  if (!u)
    return {
      ok: false,
      reason: "PROD_RO_DATABASE_URL is not a postgresql:// URL.",
    };

  // First, because it is the refusal that matters most: a swapped DATABASE_URL
  // means pnpm db:prod, and a read-only script has no business there at all.
  if (env.DATABASE_URL) {
    const d = parse(env.DATABASE_URL);
    if (d && !isLocal(d.hostname)) {
      return {
        ok: false,
        reason:
          `DATABASE_URL points at ${d.hostname}, so this process is running under pnpm db:prod ` +
          "with the owner URL swapped in. Run the script with pnpm tsx directly; it opens its own read-only connection.",
      };
    }
  }
  const role = decodeURIComponent(u.username);
  if (role !== PROD_RO_ROLE) {
    return {
      ok: false,
      reason: `PROD_RO_DATABASE_URL connects as "${role}"; only ${PROD_RO_ROLE} may run a read-only report.`,
    };
  }
  if (
    decodeURIComponent(u.password) === PROD_RO_PLACEHOLDER ||
    u.password === ""
  ) {
    return {
      ok: false,
      reason:
        `PROD_RO_DATABASE_URL still carries the placeholder password. Rotate ${PROD_RO_ROLE} ` +
        "(ALTER ROLE … PASSWORD in the Neon SQL editor) and paste the new one in.",
    };
  }
  for (const [name, owner] of [
    ["PROD_DATABASE_URL", env.PROD_DATABASE_URL],
    ["PROD_DIRECT_URL", env.PROD_DIRECT_URL],
  ] as const) {
    if (!owner) continue;
    if (owner === raw) {
      return {
        ok: false,
        reason: `PROD_RO_DATABASE_URL is the same string as ${name} (an owner URL).`,
      };
    }
    const o = parse(owner);
    if (o && decodeURIComponent(o.username) === role) {
      return {
        ok: false,
        reason: `${name} also connects as ${role}; the owner URLs must stay on the owner role.`,
      };
    }
  }
  return { ok: true, host: u.hostname };
}

/**
 * Open the read-only connection and prove it cannot write.
 *
 * The proof is a no-op UPDATE (`WHERE false`) on a real table: under a
 * read-only transaction Postgres rejects it before it touches a row, and if
 * it were somehow accepted it would change nothing. Either "cannot execute
 * UPDATE in a read-only transaction" or "permission denied" counts; anything
 * else, including success, aborts the script.
 */
export async function openReadOnly(env: ProdRoEnv): Promise<pg.Client> {
  const verdict = classifyProdRoUrl(env);
  if (!verdict.ok) throw new Error(verdict.reason);
  const client = new pg.Client({ connectionString: env.PROD_RO_DATABASE_URL });
  await client.connect();
  try {
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
    let refused = false;
    try {
      await client.query('UPDATE "User" SET email = email WHERE false');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      refused = /read-only transaction|permission denied/i.test(msg);
      if (!refused) throw e;
    }
    if (!refused) {
      throw new Error(
        `${PROD_RO_ROLE} accepted an UPDATE on ${verdict.host}: the role is not read-only. Nothing was run.`,
      );
    }
    return client;
  } catch (e) {
    await client.end().catch(() => {});
    throw e;
  }
}
