// The Hex Cluster kill switches: one for packed downloads, one for account saves.
//
// A SEPARATE Edge Config store from the abuse-defense one (`EDGE_CONFIG`, read by
// `abuse-defense-flag.ts`). Two reasons. The two are flipped by different incidents
// and a patch to one store must never be able to touch the other's keys; and the
// staging deployment needs its own flags store (plan 5.8) so a staging flip leaves
// prod unchanged, which is only true if the store is chosen by its own variable.
// Hence `createClient` with `HEX_FLAGS_EDGE_CONFIG`, never the default `get()`,
// which silently reads `EDGE_CONFIG`.
//
// FAIL-OPEN, the opposite of the abuse flag, and on purpose. These switch features
// OFF; a store blip must not turn off downloads and saves for everyone. So an
// unset variable, a malformed connection string, a read error or a timeout all
// read as "enabled", and only an explicit `false` disables. The configurator
// treats a failed fetch of `/api/hex-flags` the same way ("no change").
//
// A PLAIN module, not "use server": it is imported by a route handler and by the
// save action, and a "use server" file may export only async functions.
import { createClient, type EdgeConfigClient } from "@vercel/edge-config";

export interface HexFlags {
  hexPackEnabled: boolean;
  hexSaveEnabled: boolean;
  /** The molded-line tap counter (plan 1.2.3). FEATURE-OFF only: it stops the
   *  button, never bypasses the limiter. */
  hexInterestEnabled: boolean;
}

export const HEX_FLAG_KEYS = [
  "hexPackEnabled",
  "hexSaveEnabled",
  "hexInterestEnabled",
] as const;
export type HexFlagKey = (typeof HEX_FLAG_KEYS)[number];

const READ_TIMEOUT_MS = 200;

/** The production configurator. Staging overrides it with
 *  `HEX_FLAGS_ALLOW_ORIGIN`; a missing or malformed override falls back here. */
export const HEX_FLAGS_DEFAULT_ORIGIN = "https://hex.onethousanddrones.com";

let cached: { conn: string; client: EdgeConfigClient } | null = null;

function client(): EdgeConfigClient | null {
  const conn = process.env.HEX_FLAGS_EDGE_CONFIG;
  if (!conn) return null;
  if (cached?.conn === conn) return cached.client;
  try {
    cached = { conn, client: createClient(conn) };
    return cached.client;
  } catch {
    // A malformed connection string throws here. Fail open, like every other
    // failure in this file.
    return null;
  }
}

/** One flag. Only an explicit `false` disables. */
export async function hexFlag(key: HexFlagKey): Promise<boolean> {
  const c = client();
  if (!c) return true;
  try {
    const value = await Promise.race([
      c.get<boolean>(key),
      new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), READ_TIMEOUT_MS),
      ),
    ]);
    return value !== false;
  } catch {
    return true;
  }
}

/** Both flags, each by its own explicit `get()`. Not `getAll()`: that would hand
 *  back whatever else someone put in the store, and the route's body is exactly
 *  these two keys. */
export async function readHexFlags(): Promise<HexFlags> {
  const [hexPackEnabled, hexSaveEnabled, hexInterestEnabled] =
    await Promise.all([
      hexFlag("hexPackEnabled"),
      hexFlag("hexSaveEnabled"),
      hexFlag("hexInterestEnabled"),
    ]);
  return { hexPackEnabled, hexSaveEnabled, hexInterestEnabled };
}

/** The one origin allowed to read the flags cross-origin. STATIC: it comes from
 *  configuration, never from the request, so no request can choose its own
 *  answer. Origin form only (scheme + host + port); anything else falls back to
 *  the production configurator. */
export function hexFlagsAllowOrigin(): string {
  const raw = process.env.HEX_FLAGS_ALLOW_ORIGIN?.trim();
  if (!raw) return HEX_FLAGS_DEFAULT_ORIGIN;
  try {
    const u = new URL(raw);
    if (u.origin === "null" || u.origin !== raw.replace(/\/$/, "")) {
      return HEX_FLAGS_DEFAULT_ORIGIN;
    }
    return u.origin;
  } catch {
    return HEX_FLAGS_DEFAULT_ORIGIN;
  }
}
