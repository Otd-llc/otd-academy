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
//   3. No message performs a write, with TWO bounded exceptions -- and both
//      write the SAME place: the two integer columns holding this visitor's
//      print bed. A `save-request` is NOT one of them; it may only open a panel,
//      and the write is gated on a click in the academy's own DOM, because it
//      creates named, quota-bearing rows in the drawing register.
//        - `bed-changed` writes UNCONDITIONALLY, because it is a choice the
//          visitor just made in the picker. It is allowed because that write is
//          bounded by BED_MIN/BED_MAX, idempotent, visible on /account and
//          undoable there -- and because the alternative, a confirmation dialog
//          for "which printer do you own", is chrome nobody reads.
//        - `promote-bed` writes CONDITIONALLY: only if BOTH columns are still
//          null, decided in one statement at the database. It is strictly
//          weaker than `bed-changed` -- same columns, same bounds, plus a
//          precondition -- and it exists precisely BECAUSE the child cannot be
//          trusted with the condition: `Ready.bed` spells "no answer" and "no
//          bed" the same way, so a child that waits for an answer and gives up
//          would eventually overwrite a bed the visitor deliberately set. See
//          `PromoteBed`.
//      Widen this to anything that creates a row, spends a quota, or touches
//      another person's data and the rule is not bent, it is gone.
//
// THE ONE IMPORT, and the only line the twin cannot share. `BED_MIN`/`BED_MAX`
// come from the pack endpoint's own module rather than being restated here: a
// third copy of those numbers drifts, and the symptom is a bed one surface
// accepts and another refuses with no stated cause. The configurator's copy
// imports the same two constants from its own bed module, so across the repos
// the bounds are shared by VALUE, not by module -- which is exactly why the
// RECEIVER validates rather than trusting the sender's range.
import { BED_MAX, BED_MIN, type Bed } from "@/lib/hex-pack";

export type { Bed };

export const CHANNEL = "otd-hex";

/** Bump when a message shape changes incompatibly. Both copies must move
 *  together; the mismatch path is a fallback, not an error to swallow.
 *
 *  ADDING A MESSAGE TYPE IS NOT INCOMPATIBLE and must NOT bump this. `parseMessage`
 *  already returns null for a type it does not know, so an older peer ignores a
 *  new message instead of breaking on it â€” which is the property `hello` relies
 *  on to tell an old child build from a new one. Bumping for an additive type
 *  would do the opposite: it would make every OLD message unreadable to the new
 *  peer, i.e. break the thing that still works. */
export const PROTOCOL_VERSION = 1;

/**
 * Is this a plausible OTD origin at all?
 *
 * A coarse gate, deliberately: it exists to reject obvious noise cheaply, and
 * it is NEVER sufficient on its own. Both anchors matter â€” without `^` and `$`,
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
   *  derive a reply target from `document.referrer` â€” which is empty under
   *  Lockdown Mode, a `no-referrer` policy, and several mobile webviews. */
  parentOrigin: string;
  theme: "dark" | "light";
  /** The print bed the visitor's ACCOUNT holds, when there is one and we know
   *  it yet.
   *
   *  OPTIONAL, and that asymmetry is deliberate for the same reason `hello`
   *  exists: the two sides deploy separately and each embeds whatever the other
   *  origin is serving right now. A parent that predates this field sends no
   *  bed; a child that predates it ignores one. Both directions of the deploy
   *  gap keep working, and the child falls back to its own store.
   *
   *  Absent is not "no bed", it is "no answer" -- the visitor may be signed out,
   *  may have stored nothing, or the read may simply not have landed (it is a
   *  database round trip the frame refuses to block the open on). All three mean
   *  the same thing to the child, which is "resolve it yourself", so they share
   *  one spelling. A late answer arrives as `set-bed`.
   *
   *  Which is why a child must never read an absent bed as "the account is
   *  empty" and act on it. The one action that needs to know is the one-time
   *  promotion of a local bed, and it asks with `promote-bed` instead, so the
   *  condition is settled at the database where it is actually knowable. */
  bed?: Bed;
};

export type SetTheme = {
  channel: typeof CHANNEL;
  protocolVersion: number;
  type: "set-theme";
  theme: "dark" | "light";
};

/**
 * Parent -> child: lay out for this bed.
 *
 * Mirrors `SetTheme`, and for a sharper version of the same reason. The parent
 * routinely learns the answer AFTER the handshake has gone (the account read is
 * a round trip, and blocking the configurator's open on it would trade a
 * correct plate count for a visibly slower panel), so the channel needs a way to
 * say so later. Reloading the frame is not that way: it would throw away the
 * visitor's build.
 *
 * NOT nullable, on purpose. "Clear my stored bed" is an account action with a
 * control on /account; giving it a wire spelling would make an absent or
 * malformed field indistinguishable from a deliberate clear -- the exact
 * confusion `setPrintBed` avoids by checking for null explicitly BEFORE it
 * validates.
 */
export type SetBed = {
  channel: typeof CHANNEL;
  protocolVersion: number;
  type: "set-bed";
  bed: Bed;
};

/**
 * Child -> parent: the visitor picked this bed in the configurator.
 *
 * One of the two messages that reach a write (see the security model above); the
 * other is `promote-bed`, which is CONDITIONAL. This one is not: a pick is the
 * visitor's deliberate choice and must win over whatever is stored. It exists
 * because the picker belongs at the point of use -- in the export bar, beside
 * Download -- while the value has to live on the ACCOUNT to survive a new
 * browser, and only the academy holds the session that can write it. A pick that
 * stayed in the configurator's localStorage would be a setting the visitor's
 * phone never hears about.
 */
export type BedChanged = {
  channel: typeof CHANNEL;
  protocolVersion: number;
  type: "bed-changed";
  bed: Bed;
};

/**
 * Child -> parent: "this browser has a local bed and believes the account has
 * none; store it ONLY if that is true."
 *
 * The second half of that sentence is the message. It is a REQUEST TO WRITE
 * UNDER A CONDITION the child is not able to evaluate, so the condition is
 * evaluated where it is knowable -- in one conditional statement at the
 * database, which either finds both columns null and writes, or finds a bed and
 * does nothing.
 *
 * WHY IT CANNOT BE A `bed-changed`. The design says a locally-stored bed is
 * promoted to the account once, on sign-in, when the account has none. Nothing
 * on the wire tells the child that last part: `Ready.bed` is optional and an
 * absent one means "no answer" -- signed out, nothing stored, OR an account read
 * still in flight (the frame deliberately does not await it, and a cold database
 * can take seconds). "The account has none" and "the account has not answered"
 * are therefore the SAME wire state, and any child-side rule for telling them
 * apart is a timer. A timer converts the race into a wait; a read slower than
 * the wait still clobbers a bed the visitor set on another device. The condition
 * has to travel WITH the write or it is a guess.
 *
 * DISTINCT FROM `bed-changed`, which stays exactly as it was: an unconditional
 * write, because it carries a choice the visitor made in the picker seconds ago
 * and their newest choice must win. Collapsing the two in either direction
 * breaks one of them -- a conditional `bed-changed` would silently ignore every
 * pick after the first, and an unconditional `promote-bed` is the bug this type
 * exists to remove.
 *
 * NOT VERSION-BUMPING. A new type is additive by construction here (see
 * `PROTOCOL_VERSION`): a parent that predates it drops it in `parseMessage`'s
 * default, which costs the promotion and nothing else -- the child's local bed
 * still lays out its own downloads.
 */
export type PromoteBed = {
  channel: typeof CHANNEL;
  protocolVersion: number;
  type: "promote-bed";
  bed: Bed;
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
 * close control of its own once the configurator grew one â€” so without this
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
  | SetBed
  | BedChanged
  | PromoteBed
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
 * A bed on the wire: two integers, inside the SAME range the pack endpoint
 * enforces.
 *
 * INDEPENDENT of `normalizeBed` in `@/lib/print-bed`, deliberately -- what is
 * shared is the two NUMBERS, not the function:
 *   1. This file is transcribed into the configurator's repo, which has no
 *      account, no Prisma and no `print-bed.ts`. Depending on that module would
 *      mean re-pointing the import at something that carries the same name and
 *      different contents on the other side, and a same-name-different-rule pair
 *      is worse than a restated four-line rule.
 *   2. The jobs differ. `normalizeBed(x, y)` COERCES a pair the caller has
 *      already pulled apart; this answers a question about a whole untrusted
 *      OBJECT, so it also has to reject an array, a null, a missing axis and an
 *      extra one -- checks `normalizeBed` cannot see and should not carry.
 *   3. The bounds are the part that actually drifts, and they are imported. The
 *      rule is restated; the numbers are not.
 * A test pins the two together in the direction that matters: anything this
 * accepts, `normalizeBed` must accept too, or a `bed-changed` would parse here
 * and throw in the action, and the visitor's pick would silently never store.
 *
 * INTEGERS, not merely finite numbers. `Number.isInteger` also excludes NaN and
 * both infinities, which is what makes the range comparison below safe --
 * `NaN < BED_MIN` is false, so a bare range check waves NaN straight through.
 * The integer part is not decoration either: `setPrintBed` THROWS on a
 * fractional bed, so accepting 220.5 here would move a refusal from this
 * function, where it is a dropped message, into a handler where it is an
 * unhandled rejection. (`Number.isInteger` subsumes the `typeof` pair at
 * RUNTIME -- it is false for every non-number -- so a mutation test finds that
 * line survivable, and it survives on purpose: it is what NARROWS `unknown` for
 * the comparisons below. Deleting it does not loosen the check, it stops the
 * file compiling, which is the louder of the two failures.)
 *
 * EXACTLY two keys. A third means the sender is describing something we do not
 * understand about a value we are about to act on (a build height, a units tag),
 * and laying out for the two axes we happened to recognise would be answering a
 * question nobody asked. Note this is the opposite of how an unknown message
 * TYPE is treated, and the asymmetry is the point: an unknown type is a whole
 * message we can decline to read, which is what keeps an older peer working.
 */
function isBed(v: unknown): v is Bed {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  if (Object.keys(b).length !== 2) return false;
  if (typeof b.x !== "number" || typeof b.y !== "number") return false;
  if (!Number.isInteger(b.x) || !Number.isInteger(b.y)) return false;
  if (b.x < BED_MIN || b.x > BED_MAX) return false;
  if (b.y < BED_MIN || b.y > BED_MAX) return false;
  return true;
}

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
      // The bed is optional; the rest is not. PRESENT-AND-MALFORMED is still a
      // refusal of the whole handshake: `ready` is sent only by our own parent,
      // so a bad bed here is our bug or a hostile parent, and neither is worth
      // half-reading. The compatibility direction that actually matters is the
      // other one -- an older child never looks at the field at all.
      if (!isStr(d.parentOrigin) || !isTheme(d.theme)) return null;
      if (d.bed !== undefined && !isBed(d.bed)) return null;
      return d as unknown as Ready;
    case "set-theme":
      return isTheme(d.theme) ? (d as unknown as SetTheme) : null;
    case "set-bed":
    case "bed-changed":
    case "promote-bed":
      // All three REQUIRE a bed. A bed message with no bed is not a smaller
      // instruction, it is a broken one -- and two of these three reach a write.
      //
      // ONE branch, not three, deliberately: the two inbound ones must be held
      // to IDENTICAL numbers, because a `promote-bed` validated more loosely
      // than a `bed-changed` would be a second, weaker door into the same two
      // columns. What differs between them is what the RECEIVER does with the
      // parsed message, which is decided by `type` and stays decided by `type`.
      return isBed(d.bed)
        ? (d as unknown as SetBed | BedChanged | PromoteBed)
        : null;
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
