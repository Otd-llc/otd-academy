// The academy <-> configurator wire format.
//
// Two origins, two repos, two deploy pipelines, no shared package. This file
// therefore exists TWICE, byte-identical, at:
//   project-foundry/src/lib/hex-embed-protocol.ts
//   bioscale-viz/src/hex/embed-protocol.ts
// `PROTOCOL_VERSION` is what makes that survivable: the two sides ship
// independently, so a version mismatch must degrade loudly and predictably
// (the child falls back to navigating) rather than dropping messages in
// silence, which is what an unversioned channel does.
//
// SECURITY MODEL, which is the whole point of this file:
//
//   1. Origin is necessary but NOT sufficient. A four-lens review of the first
//      draft found the original check accepted any `*.onethousanddrones.com`
//      host and ANY `localhost` port, in production. An XSS on the apex site,
//      on a parked subdomain, or a process on the user's own machine could
//      then post a message the academy would act on with the user's session.
//      Callers MUST additionally pin the peer: the parent compares
//      `event.source` to its own iframe's `contentWindow`, the child replies
//      only to the origin it learned from the parent's `ready` handshake.
//   2. `parseMessage` VALIDATES. It does not cast. `share` in particular flows
//      into a Prisma `where` clause that is not runtime-checked, so a
//      non-string here is a filter-object injection.
//   3. No message performs a write. A `save-request` may only open a panel;
//      the write is gated on a click in the academy's own DOM.

export const CHANNEL = "otd-hex";

/** Bump when a message shape changes incompatibly. Both copies must move
 *  together; the mismatch path is a fallback, not an error to swallow.
 *
 *  ADDING A MESSAGE TYPE IS NOT INCOMPATIBLE and must NOT bump this. `parseMessage`
 *  already returns null for a type it does not know, so an older peer ignores a
 *  new message instead of breaking on it — which is the property `hello` relies
 *  on to tell an old child build from a new one. Bumping for an additive type
 *  would do the opposite: it would make every OLD message unreadable to the new
 *  peer, i.e. break the thing that still works. */
export const PROTOCOL_VERSION = 1;

/**
 * Is this a plausible OTD origin at all?
 *
 * A coarse gate, deliberately: it exists to reject obvious noise cheaply, and
 * it is NEVER sufficient on its own. Both anchors matter — without `^` and `$`,
 * `onethousanddrones.com.evil.test` and `evil-onethousanddrones.com` both pass.
 *
 * `localhost` is dev-only. In production the parent pins one exact origin
 * anyway, but leaving a localhost hole in a shipped bundle is the kind of thing
 * that outlives the reason for it.
 */
const OTD = /^https:\/\/([a-z0-9-]+\.)*onethousanddrones\.com$/;
const LOCAL = /^http:\/\/localhost(:\d+)?$/;
const LAN = /^http:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;

export function isPlausibleOtdOrigin(
  origin: string,
  opts?: { allowDev?: boolean },
): boolean {
  if (OTD.test(origin)) return true;
  if (!opts?.allowDev) return false;
  return LOCAL.test(origin) || LAN.test(origin);
}

export type SaveMode = "new" | "rev";

export type Ready = {
  channel: typeof CHANNEL;
  protocolVersion: number;
  type: "ready";
  /** The parent's own origin, stated explicitly so the child never has to
   *  derive a reply target from `document.referrer` — which is empty under
   *  Lockdown Mode, a `no-referrer` policy, and several mobile webviews. */
  parentOrigin: string;
  theme: "dark" | "light";
};

export type SetTheme = {
  channel: typeof CHANNEL;
  protocolVersion: number;
  type: "set-theme";
  theme: "dark" | "light";
};

export type SaveRequest = {
  channel: typeof CHANNEL;
  protocolVersion: number;
  type: "save-request";
  /** Correlates a reply with this request. A `saved` that does not match the
   *  in-flight id is ignored, which is what stops a stale reply landing on an
   *  edited scene. */
  requestId: string;
  mode: SaveMode;
  share: string | null;
  envelope: { p: string; h: string; v: number; s: unknown; n: string };
};

export type Saved = {
  channel: typeof CHANNEL;
  protocolVersion: number;
  type: "saved";
  requestId: string;
  drawingLabel: string;
  revLabel: string;
  shareCode: string;
  name: string;
  savedAt: string;
};

export type SaveFailed = {
  channel: typeof CHANNEL;
  protocolVersion: number;
  type: "save-failed";
  requestId: string;
  code: string;
  message: string;
};

export type SaveCancelled = {
  channel: typeof CHANNEL;
  protocolVersion: number;
  type: "save-cancelled";
  requestId: string;
};

export type CloseRequest = {
  channel: typeof CHANNEL;
  protocolVersion: number;
  type: "close-request";
};

export type ContextLost = {
  channel: typeof CHANNEL;
  protocolVersion: number;
  type: "context-lost";
};

/**
 * Child -> parent, once, right after it accepts the handshake: what this build
 * of the configurator can do for itself.
 *
 * It exists because the two sides deploy separately and the parent embeds
 * whatever the OTHER origin is serving right now. The academy stopped drawing a
 * close control of its own once the configurator grew one — so without this
 * message, the window between the academy's deploy and the configurator's (or a
 * cached old child bundle) is a panel a mouse cannot close. The parent shows its
 * own fallback close unless a `hello` says it does not need to.
 *
 * Capabilities are strings, not booleans, so the next one costs no message.
 */
export type Hello = {
  channel: typeof CHANNEL;
  protocolVersion: number;
  type: "hello";
  capabilities: string[];
};

/** The child draws its own close control, so the parent must not draw one. */
export const CAP_CLOSE = "close";

export type HexMessage =
  | Ready
  | SetTheme
  | SaveRequest
  | Saved
  | SaveFailed
  | SaveCancelled
  | CloseRequest
  | ContextLost
  | Hello;

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isTheme = (v: unknown): v is "dark" | "light" =>
  v === "dark" || v === "light";

/**
 * Narrow an untrusted `event.data`, or return null.
 *
 * Returns null rather than throwing: a malformed message from an allowed
 * origin must be ignored, not crash the page that received it. A version
 * mismatch also returns null here; callers that care about degrading (the
 * child, which falls back to navigating) check `readVersion` first.
 */
export function parseMessage(data: unknown): HexMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.channel !== CHANNEL) return null;
  if (d.protocolVersion !== PROTOCOL_VERSION) return null;
  if (typeof d.type !== "string") return null;

  switch (d.type) {
    case "ready":
      return isStr(d.parentOrigin) && isTheme(d.theme)
        ? (d as unknown as Ready)
        : null;
    case "set-theme":
      return isTheme(d.theme) ? (d as unknown as SetTheme) : null;
    case "save-request": {
      // Every field, because `share` reaches a Prisma `where` unchecked and a
      // filter object there turns "the drawing whose code I hold" into "any of
      // my drawings".
      if (!isStr(d.requestId)) return null;
      if (d.mode !== "new" && d.mode !== "rev") return null;
      if (d.share !== null && !isStr(d.share)) return null;
      const e = d.envelope;
      if (typeof e !== "object" || e === null) return null;
      const env = e as Record<string, unknown>;
      if (!isStr(env.p) || !isStr(env.h) || !isStr(env.n)) return null;
      if (typeof env.v !== "number") return null;
      return d as unknown as SaveRequest;
    }
    case "saved":
      return isStr(d.requestId) &&
        isStr(d.drawingLabel) &&
        isStr(d.revLabel) &&
        isStr(d.shareCode) &&
        isStr(d.name) &&
        isStr(d.savedAt)
        ? (d as unknown as Saved)
        : null;
    case "save-failed":
      return isStr(d.requestId) && isStr(d.code) ? (d as unknown as SaveFailed) : null;
    case "save-cancelled":
      return isStr(d.requestId) ? (d as unknown as SaveCancelled) : null;
    case "hello":
      return Array.isArray(d.capabilities) && d.capabilities.every(isStr)
        ? (d as unknown as Hello)
        : null;
    case "close-request":
    case "context-lost":
      return d as unknown as HexMessage;
    default:
      return null;
  }
}

/** The version on an envelope that is otherwise unreadable, so a peer speaking
 *  a different version can be told apart from noise. */
export function readVersion(data: unknown): number | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.channel !== CHANNEL) return null;
  return typeof d.protocolVersion === "number" ? d.protocolVersion : null;
}
