"use client";

// The configurator, embedded, and the frame it opens in.
//
// WHY AN EMBED AT ALL. The spec page and the configurator were two properties
// with a navigation between them: the reader left the academy, the academy's
// header and footer went away, and coming back meant a browser Back that landed
// on a page that had forgotten why they left. The whole thing read as disjointed
// because it WAS disjointed.
//
// WHAT THIS IS
//   - The frame is FIXED, and it starts BELOW the app header. The header is
//     `sticky top-0 z-40`; this sits at z-30, so the academy chrome stays
//     visible and clickable the whole time the configurator is open. That was
//     the explicit requirement, and it is the reason this is not a full-screen
//     takeover with its own close button in a corner.
//   - It GROWS OUT OF THE BUTTON that opened it (a FLIP: the trigger's rect is
//     captured on click, and the panel is animated from that rect to its final
//     one), and shrinks back into it on close. Under `prefers-reduced-motion`
//     both are a plain fade.
//   - Once opened, the iframe STAYS MOUNTED and is hidden with `display: none`.
//     Unmounting would be simpler and would throw away the visitor's build every
//     time they closed the panel to re-read a dimension. A frame with no layout
//     box is not rendered, so its `requestAnimationFrame` loop stops on its own
//     and a hidden configurator costs no GPU; the risk that moves to is the
//     browser reclaiming its WebGL context, which the configurator handles.
//
// THE SAVE, WHICH IS THE PART WITH TEETH. A save has to happen on THIS origin:
// the session cookie is ours and the server action is ours. The configurator
// therefore does not save, it ASKS -- it posts a `save-request` and this
// component opens a panel in the academy's own DOM. No message performs a
// write; the write is gated on a click here, on a form the visitor can see.
//
// THE TWO EXCEPTIONS to "no message performs a write" both write the same two
// integer columns, the visitor's print bed. `bed-changed` writes it straight
// through with no click on this side, because the value is bounded, idempotent,
// visible on /account and undoable there -- and because a confirmation dialog
// for "which printer do you own" is chrome nobody reads. `promote-bed` writes it
// only if the account has none, decided in one conditional statement at the
// database rather than by the child, which cannot see the account and cannot
// tell "it has none" from "it has not answered yet". The reasoning in full, and
// the line past which it stops applying, is in the protocol's security model.
// Everything else still goes through a click.
//
// Every message is validated by `parseMessage`, and the peer is pinned by BOTH
// its origin and `event.source === iframe.contentWindow`. Origin alone is not
// enough: any other frame or popup on a permitted origin could otherwise post a
// `save-request` this page would act on with the visitor's session.
//
// WHERE THE CLOSE CONTROL WENT. This used to open with a strip of academy chrome
// -- "▸ CLUSTER CONFIGURATOR ... CLOSE" -- sitting between the app header and
// the configurator's own toolbar. Three bands of chrome down the top of the
// screen, the middle one holding a single word. The configurator now draws its
// own close chip in that toolbar, in the row it belongs to, and says so with a
// `hello` capability. The academy keeps a fallback close for exactly one case:
// a child build that predates that chip (the two origins deploy separately, and
// the iframe loads whatever the other one is serving right now). No `hello`
// within `CLOSE_FALLBACK_MS` and the academy draws the control itself.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  HexConfiguratorContext,
  type HexConfiguratorApi,
  type OpenOptions,
} from "@/components/hex/hex-configurator-context";
import { EmbeddedSavePanel } from "@/components/hex/EmbeddedSavePanel";
import { loadHexRecall } from "@/lib/actions/hex-recall";
import {
  getPrintBed,
  promotePrintBed,
  setPrintBed,
} from "@/lib/actions/print-bed";
import {
  hexConfiguratorOrigin,
  hexConfiguratorSrc,
} from "@/lib/hex-configurator-url";
import type { HexRecall } from "@/lib/hex-recall";
import {
  CAP_CLOSE,
  CHANNEL,
  PROTOCOL_VERSION,
  parseMessage,
  type Bed,
  type SaveRequest,
} from "@/lib/hex-embed-protocol";
import { getPosthog } from "@/lib/posthog-client";

/** Matches the transition durations below, and the `--hex-frame-*` timings. */
const OPEN_MS = 340;
const CLOSE_MS = 220;

/** How long to wait for the child's `hello` before drawing a close control of
 *  our own. Long enough that a current build never flashes one (its hello lands
 *  with the handshake, inside a frame load), short enough that an old build does
 *  not leave a mouse user stuck. */
const CLOSE_FALLBACK_MS = 1500;

/** The academy's own theme event, dispatched by ThemeToggle. Subscribed to
 *  rather than polled: the attribute on <html> is the source of truth and this
 *  is how the toggle announces a change to everything else on the page. */
const THEME_EVENT = "otd-theme-change";

function currentTheme(): "dark" | "light" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

type Phase = "idle" | "open" | "closed";

export function HexConfiguratorFrame({
  children,
  /** The kill switch. When false this renders nothing but its children, and
   *  every `ConfiguratorLink` under it falls back to a plain cross-origin
   *  navigation -- the behaviour that shipped before the embed existed. */
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [src, setSrc] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState<SaveRequest | null>(null);
  const [contextLost, setContextLost] = useState(false);
  /** A `?build=` was asked for and could not be resolved -- unknown code,
   *  archived, or a deleted account. The frame still opens; saying nothing
   *  would leave someone who clicked "Open in the configurator" on a specific
   *  saved build staring at an empty bench with no explanation. */
  const [recallFailed, setRecallFailed] = useState(false);
  /** The child said it draws its own close control. Sticky once true: a remount
   *  re-announces it, and un-drawing a control the visitor has already seen
   *  would be worse than drawing one they do not need. */
  const [childCloses, setChildCloses] = useState(false);
  const [fallbackClose, setFallbackClose] = useState(false);
  /** Bumped on every `load` of the frame. The fallback timer hangs off THIS,
   *  not off the panel opening — see the effect below. */
  const [loadCount, setLoadCount] = useState(0);
  /** Bumped to remount the iframe, which is the only reload available across
   *  origins. Part of the `key`, so it also resets the handshake. */
  const [reloadKey, setReloadKey] = useState(0);
  /** What the ACCOUNT holds, and only that. It drives the `set-bed` relay below,
   *  so a `bed-changed` must never be written here: echoing the child's own pick
   *  straight back at it is a message it did not ask for, and a loop if a future
   *  child build treats an inbound bed as a change worth announcing. */
  const [accountBed, setAccountBed] = useState<Bed | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const originRectRef = useRef<DOMRect | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const animationRef = useRef<Animation | null>(null);
  /** The best bed known to this page, read at SEND time rather than captured.
   *  It can arrive from either side -- the account read in `open`, or a pick the
   *  visitor makes inside the configurator -- and the handshake fires again on a
   *  frame remount (the context-lost reload), so a value captured when the
   *  callback was built would hand a reloaded frame a stale bed. Exactly why the
   *  theme is read with `currentTheme()` at send time rather than closed over. */
  const bedRef = useRef<Bed | null>(null);
  /** The bed already stored on the account, as `WxH`, so an identical pick is
   *  not re-written. A repeat is the cheapest way for a compromised child to
   *  turn one slider into a stream of database writes with the visitor's
   *  session; it is also just what a picker emits when someone clicks the chip
   *  they are already on. */
  const persistedRef = useRef<string | null>(null);
  /** A promotion has been offered on this page-load. The child already promotes
   *  once and remembers it, but the guard belongs on this side too: the child is
   *  the untrusted half of the channel, and without this a compromised one could
   *  turn a message it is allowed to send into a stream of conditional writes.
   *  Cleared on FAILURE only -- a decline is a real answer (the account has a
   *  bed), and re-asking would never get a different one. */
  const promotedRef = useRef(false);

  const origin = enabled ? hexConfiguratorOrigin() : "";

  // -- posting -----------------------------------------------------------

  const post = useCallback(
    (message: Record<string, unknown>) => {
      const win = iframeRef.current?.contentWindow;
      if (!win || !origin) return;
      // The exact origin, never "*". A build payload and a theme are not for
      // whatever happens to be loaded in the frame after a redirect.
      win.postMessage(
        { channel: CHANNEL, protocolVersion: PROTOCOL_VERSION, ...message },
        origin,
      );
    },
    [origin],
  );

  // -- open / close ------------------------------------------------------

  const open = useCallback(
    (options: OpenOptions) => {
      if (!enabled) return;
      originRectRef.current = options.originRect ?? null;
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      // The src is built ONCE, on first open, and never rebuilt: changing it
      // would reload the app and throw away the visitor's cluster. The person
      // id is read here rather than at render because a prerendered page would
      // otherwise bake one visitor's id into HTML served to everyone else.
      if (!src) {
        // The account's bed, on its own promise and deliberately NOT awaited
        // below: it is a database round trip, and blocking the panel's open on
        // it would trade a correct plate count for a visibly slower open. The
        // child resolves account -> this browser -> default, so a late answer
        // costs nothing -- it arrives as `set-bed` (see the relay below) rather
        // than as a delay nobody asked for.
        //
        // TRIED, not asked. /hex is prerendered with no session provider, so
        // there is no client-side "am I signed in" to consult; `getPrintBed`
        // throws for an anonymous caller and that throw IS the answer. Same
        // discovery pattern EmbeddedSavePanel documents, one layer down.
        void (async () => {
          try {
            const { bed } = await getPrintBed();
            if (!bed) return;
            bedRef.current = bed;
            persistedRef.current = `${bed.x}x${bed.y}`;
            setAccountBed(bed);
          } catch {
            // Signed out, or the read failed. Neither is an error state here:
            // the child has its own store and a shipped default, and a bed the
            // academy cannot supply is exactly what that fallback is for.
          }
        })();

        void (async () => {
          let distinctId: string | null = null;
          try {
            distinctId = (await getPosthog())?.get_distinct_id?.() ?? null;
          } catch {
            // No consent, blocked, or not loaded. The embed works without it;
            // only the cross-property funnel join is lost.
          }

          // A recall, when one was asked for. Resolved HERE rather than woven
          // into the URL by the linking page, so the payload never touches the
          // academy's own address bar -- PostHog captures `location.href` for a
          // pageview, fragment included, and a build payload in analytics is a
          // leak nobody would notice.
          let recalled: { payload: string; recall: HexRecall } | null = null;
          const build = options.build ?? null;
          if (build) {
            try {
              const result = await loadHexRecall(build);
              if (result.ok) {
                recalled = { payload: result.payload, recall: result.recall };
              } else {
                setRecallFailed(true);
              }
            } catch {
              // Network or action failure. The configurator still opens, just
              // empty, and the notice below says so rather than pretending the
              // visitor asked for a blank bench.
              setRecallFailed(true);
            }
          }

          setSrc(
            hexConfiguratorSrc({
              distinctId,
              payload: recalled?.payload ?? null,
              recall: recalled?.recall ?? null,
              // Read at OPEN time, not at render: the page is prerendered, so a
              // build-time value would bake one visitor's theme into HTML served
              // to everyone. The handshake keeps it in step from here on.
              theme: currentTheme(),
            }),
          );
        })();
      }
      setPhase("open");
    },
    [enabled, src],
  );

  const close = useCallback(() => {
    setPhase((p) => (p === "open" ? "closed" : p));
    setPendingSave(null);
  }, []);

  // -- the deep link -----------------------------------------------------
  //
  // `/hex?open=1` lands on the spec page with the configurator already open.
  // It exists so a nav link can point INTO the academy rather than off it: the
  // footer's "Configurator" used to jump straight to the other property, which
  // is the disjointed hop this whole feature removes.
  //
  // Read from `window.location` rather than `useSearchParams`, deliberately.
  // This page is prerendered whole; `useSearchParams` would force a Suspense
  // boundary and pull the route toward dynamic rendering to answer a question
  // that only matters after hydration anyway.
  useEffect(() => {
    if (!enabled) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("open") !== "1") return;
    // No origin rect: nothing was clicked, so there is nothing to grow out of
    // and the FLIP falls back to a fade.
    //
    // `build` is a share code, never a payload. It is the whole reason a recall
    // link can stay short enough to read.
    open({ placement: "deep_link", build: params.get("build") });
    // Mount only. Re-running on `open`'s identity would reopen the frame every
    // time the callback was rebuilt, including right after the visitor closed
    // it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // -- the FLIP ----------------------------------------------------------
  //
  // Runs in a layout-ish effect on the phase change rather than in CSS, because
  // the start rectangle is only knowable at click time and a CSS transition
  // cannot be given one.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || phase === "idle") return;

    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    animationRef.current?.cancel();

    const from = originRectRef.current;
    const to = panel.getBoundingClientRect();
    if (reduced || !from || to.width === 0 || to.height === 0) {
      // A fade is still a state change the eye can follow, and it is what the
      // reduced-motion setting asks for: no travel, no scaling.
      animationRef.current =
        panel.animate?.(
          [
            { opacity: phase === "open" ? 0 : 1 },
            { opacity: phase === "open" ? 1 : 0 },
          ],
          { duration: phase === "open" ? OPEN_MS / 2 : CLOSE_MS, fill: "both" },
        ) ?? null;
      return;
    }

    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const sx = Math.max(from.width / to.width, 0.02);
    const sy = Math.max(from.height / to.height, 0.02);

    const collapsed = {
      transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
      opacity: 0.2,
    };
    const full = { transform: "none", opacity: 1 };

    animationRef.current =
      panel.animate?.(
        phase === "open" ? [collapsed, full] : [full, collapsed],
        {
          duration: phase === "open" ? OPEN_MS : CLOSE_MS,
          // Fast out of the button, settling into place. Deliberately not a
          // bounce: this is an instrument opening, not a notification.
          easing:
            phase === "open"
              ? "cubic-bezier(0.16, 0.84, 0.28, 1)"
              : "cubic-bezier(0.4, 0, 0.9, 0.4)",
          fill: "both",
        },
      ) ?? null;
  }, [phase]);

  // Focus follows the frame, in both directions. Without the return leg a
  // keyboard user who closes the panel is dropped at the top of the document.
  useEffect(() => {
    if (phase === "open") {
      // The panel itself, not the iframe: focusing a cross-origin frame hands
      // the keyboard to a document this page cannot describe to a screen
      // reader, and the visitor lands on the toolbar's own controls instead.
      panelRef.current?.focus({ preventScroll: true });
    } else if (phase === "closed") {
      returnFocusRef.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  // -- scroll lock -------------------------------------------------------
  //
  // The wheel belongs to the configurator while it is open (it zooms). Without
  // this the page scrolls underneath, and closing leaves the reader somewhere
  // they never navigated to.
  useEffect(() => {
    if (phase !== "open") return;
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, [phase]);

  // -- the header offset -------------------------------------------------
  //
  // Measured, not hardcoded: the app header wraps its nav to a second row on
  // narrow viewports, so its height is a range, not a number. A wrong value
  // here either hides the header behind the frame or leaves a strip of page
  // showing through.
  useEffect(() => {
    if (!enabled) return;
    const header = document.querySelector<HTMLElement>(".app-shell-header");
    if (!header) return;
    const sync = () => {
      document.documentElement.style.setProperty(
        "--hex-frame-top",
        `${Math.round(header.getBoundingClientRect().height)}px`,
      );
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(header);
    return () => ro.disconnect();
  }, [enabled]);

  // -- theme -------------------------------------------------------------

  // Bound to the frame EXISTING, not to it being open.
  //
  // This used to be `if (phase !== "open") return`, which desynced the theme
  // permanently the first time anyone toggled with the panel closed: nothing was
  // listening, so the child never heard it -- and REOPENING cannot repair it,
  // because the iframe is deliberately never reloaded (that would throw away the
  // build), so there is no second `load` and therefore no second handshake. The
  // frame stayed on the old theme until a full page reload.
  //
  // A `display: none` iframe still has a live document and still runs its
  // message handlers; only its rAF loop is stopped. So it can be told about a
  // theme change while hidden and is simply correct when shown again.
  useEffect(() => {
    if (!src) return;
    const send = () => post({ type: "set-theme", theme: currentTheme() });
    window.addEventListener(THEME_EVENT, send);
    return () => window.removeEventListener(THEME_EVENT, send);
  }, [src, post]);

  // And state it again on every open. The listener above covers a toggle while
  // the frame is alive, but not one that lands in the gap between the visitor
  // clicking open and `src` resolving (it is set inside an async effect, after
  // a PostHog read and possibly a recall fetch). Re-stating on open is one
  // message and makes "the frame is open" mean "the frame agrees with us",
  // rather than depending on when a listener happened to attach.
  useEffect(() => {
    if (phase !== "open" || !src) return;
    post({ type: "set-theme", theme: currentTheme() });
  }, [phase, src, post]);

  // -- the bed -----------------------------------------------------------
  //
  // Bound to the frame EXISTING, like the theme relay and for a sharper version
  // of the same reason: the account read is fired at open and not awaited, so it
  // routinely lands AFTER the handshake has already gone. Without this the
  // visitor's stored bed would be ignored for the rest of the session and the
  // download would lay out for whatever this browser happened to remember --
  // which is the "220 here, 350 there" support question the account copy exists
  // to answer.
  //
  // Sent again when the frame appears, so it does not matter which of the two
  // won the race. Fires only for an account value: `accountBed` is never written
  // from an inbound `bed-changed`, so this cannot echo the child's own pick back
  // at it.
  useEffect(() => {
    if (!src || !accountBed) return;
    post({ type: "set-bed", bed: accountBed });
  }, [src, accountBed, post]);

  /**
   * A bed picked inside the configurator, written through to the account.
   *
   * The one inbound message that reaches a write; the reasoning, and the line
   * past which it stops applying, is in the protocol's security model. The peer
   * is already pinned by origin AND `event.source`, and `parseMessage` has
   * already held the numbers to the same bounds the pack endpoint and the
   * settings action use, so what is left to guard here is repetition.
   *
   * A failure is SWALLOWED, deliberately. The common one is "signed out", which
   * is not an error: the configurator keeps the pick in its own store, which is
   * precisely what the resolver's second tier is for. The optimistic mark is
   * cleared on failure so a later attempt at the same size is not suppressed by
   * a write that never landed -- someone can sign in through the save panel
   * moments later, inside this same frame.
   */
  const persistBed = useCallback((bed: Bed) => {
    bedRef.current = bed;
    const key = `${bed.x}x${bed.y}`;
    if (persistedRef.current === key) return;
    persistedRef.current = key;
    void setPrintBed(bed).catch(() => {
      if (persistedRef.current === key) persistedRef.current = null;
    });
  }, []);

  /**
   * A bed this browser was already holding, offered to an account that may have
   * none.
   *
   * NOT `persistBed`, and the difference is the whole message. A `bed-changed`
   * is a choice the visitor made seconds ago and must win; a `promote-bed` is an
   * older local value offered on the child's BELIEF that the account is empty --
   * a belief it cannot check, because an absent `Ready.bed` means "no answer",
   * which covers an account read still in flight. So the condition is not
   * evaluated here either: `promotePrintBed` writes only if both columns are
   * still null, in one statement, which is why a slow read can no longer clobber
   * a bed the visitor set on another device.
   *
   * A DECLINE IS NOT AN ERROR and deliberately posts nothing back. The academy's
   * own account read is already relayed as `set-bed` by the effect above, and
   * that effect is driven by `accountBed`, which has exactly one writer. Letting
   * a value the child sent reach `accountBed` -- even the account's own answer,
   * returned to us -- would put an inbound message on the path that posts back
   * out, which is the echo the single-writer rule exists to prevent.
   *
   * A failure is swallowed for the same reason `persistBed` swallows one: the
   * common case is "signed out", which is exactly the state the child's own
   * local store is for.
   */
  const promoteBed = useCallback((bed: Bed) => {
    if (promotedRef.current) return;
    promotedRef.current = true;
    void promotePrintBed(bed)
      .then(({ promoted }) => {
        // Only when it TOOK. On a decline the account holds something else, and
        // recording the child's bed here would hand a stale value to the next
        // handshake and suppress a later identical pick from being written.
        if (!promoted) return;
        bedRef.current = bed;
        persistedRef.current = `${bed.x}x${bed.y}`;
      })
      .catch(() => {
        promotedRef.current = false;
      });
  }, []);

  // -- the inbound channel -----------------------------------------------

  useEffect(() => {
    if (!enabled) return;
    function onMessage(event: MessageEvent) {
      // BOTH checks. Origin alone would accept any other window on a permitted
      // origin -- another tab, a popup, a nested frame -- and this handler acts
      // with the visitor's session.
      if (event.origin !== origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      const message = parseMessage(event.data);
      if (!message) return;

      switch (message.type) {
        case "hello":
          if (message.capabilities.includes(CAP_CLOSE)) setChildCloses(true);
          break;
        case "save-request":
          // Opens a panel. It does NOT save: the write is behind a click on a
          // form in this document.
          setPendingSave(message);
          break;
        case "close-request":
          close();
          break;
        case "context-lost":
          setContextLost(true);
          break;
        case "bed-changed":
          // The child owns the picker; the academy owns the account. Writing it
          // through here is what makes a bed picked on a laptop true on a phone.
          // UNCONDITIONAL, and it stays that way: the visitor's newest choice
          // wins, which is the one thing `promote-bed` must never do.
          persistBed(message.bed);
          break;
        case "promote-bed":
          // Deliberately NOT `persistBed`. Same two columns, same bounds, but
          // this one writes only into a null pair -- see `promoteBed`.
          promoteBed(message.bed);
          break;
        default:
          // `ready` / `set-theme` / `set-bed` / `saved` / `save-failed` /
          // `save-cancelled` are ours to send, not to receive.
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled, origin, close, persistBed, promoteBed]);

  // -- the close fallback ------------------------------------------------
  //
  // Timed from the frame's LOAD, not from the panel opening. Measured against a
  // cold dev build of the child, the difference is the whole feature: a slow
  // bundle took about five seconds to boot, so a timer started at open drew a
  // second close control that then vanished when the real `hello` landed --
  // two close buttons, one of them a flicker. After `load` the child's module
  // has executed, so `hello` follows in milliseconds and this timer only ever
  // expires on a build that genuinely cannot close itself.
  useEffect(() => {
    if (loadCount === 0 || childCloses) return;
    const t = window.setTimeout(
      () => setFallbackClose(true),
      CLOSE_FALLBACK_MS,
    );
    return () => window.clearTimeout(t);
  }, [loadCount, childCloses]);

  // -- the handshake -----------------------------------------------------
  //
  // The child learns its reply target ONLY from this message. It cannot derive
  // one from `document.referrer`, which is empty under Lockdown Mode, a
  // `no-referrer` policy, and several mobile webviews -- and the failure mode
  // there is a save that silently goes nowhere.
  const handshake = useCallback(() => {
    post({
      type: "ready",
      parentOrigin: window.location.origin,
      theme: currentTheme(),
      // OMITTED, not sent as null, when there is no answer yet. The field means
      // "the account says this", and absent is the only spelling of "no answer"
      // the protocol defines -- a null would be a third state the child would
      // have to guess at. See `Ready.bed`.
      ...(bedRef.current ? { bed: bedRef.current } : {}),
    });
  }, [post]);

  const onFrameLoad = useCallback(() => {
    setContextLost(false);
    // A remount is a different build's chance to answer for itself.
    setFallbackClose(false);
    setLoadCount((n) => n + 1);
    handshake();
    // A module script has executed by the time `load` fires, so one post is
    // enough in theory. The retry costs a single message and covers the case
    // where the child's listener registration is pushed behind something slow.
    const t = window.setTimeout(handshake, 600);
    return () => window.clearTimeout(t);
  }, [handshake]);

  // -- the save reply ----------------------------------------------------

  const replySaved = useCallback(
    (
      requestId: string,
      fields: {
        drawingLabel: string;
        revLabel: string;
        shareCode: string;
        name: string;
        savedAt: string;
      },
    ) => {
      post({ type: "saved", requestId, ...fields });
      setPendingSave(null);
    },
    [post],
  );

  const replyFailed = useCallback(
    (requestId: string, code: string, message: string) => {
      post({ type: "save-failed", requestId, code, message });
      // The panel STAYS OPEN on a failure: several of the failure codes are
      // recoverable in place (an archived drawing, a revision cap), and the
      // message the visitor needs to read is in this document. The configurator
      // has been told, so its Save control is live again either way.
    },
    [post],
  );

  const replyCancelled = useCallback(
    (requestId: string) => {
      post({ type: "save-cancelled", requestId });
      setPendingSave(null);
    },
    [post],
  );

  const api: HexConfiguratorApi = { open, close, isOpen: phase === "open" };

  return (
    <HexConfiguratorContext.Provider value={api}>
      {children}
      {enabled && phase !== "idle" && (
        <FramePortal>
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-label="Hex cluster configurator"
            tabIndex={-1}
            // `display: none` rather than unmounting: closing must not throw
            // away the build. `visibility` would keep the frame rendered and
            // its animation loop running.
            style={{ display: phase === "open" ? "flex" : "none" }}
            className="fixed inset-x-0 bottom-0 top-[var(--hex-frame-top,3.5rem)] z-30 flex-col bg-deep-space outline-none"
          >
            <div className="relative flex-1">
              {/* Everything the academy still draws over the frame, stacked at
                  the top-left -- the opposite end of the band from the child's
                  toolbar, so neither can ever cover the other. Empty in the
                  normal case, which is the point of the pass. */}
              <div className="pointer-events-none absolute left-[18px] top-[18px] z-10 flex max-w-[min(24rem,calc(100%-6rem))] flex-col items-start gap-2">
                {fallbackClose && !childCloses && (
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close the configurator"
                    className="pointer-events-auto flex h-[38px] min-w-[38px] items-center justify-center rounded-[9px] border border-command-gold/30 bg-deep-space px-3 font-mono text-[15px] leading-none text-muted transition-colors hover:border-command-gold hover:text-gold-light focus-visible:border-command-gold focus-visible:text-gold-light focus-visible:outline-none"
                  >
                    ✕
                  </button>
                )}
                {recallFailed && (
                  // A saved build that cannot be reopened is worth saying out
                  // loud, but it is not an error state for the page: the
                  // configurator below is perfectly usable. Framed by a gold
                  // accent bar rather than a filled card.
                  <p className="pointer-events-auto border-l-2 border-l-command-gold bg-deep-space/95 py-1 pl-3 font-serif text-xs text-muted">
                    That saved build could not be opened. It may have been
                    archived.
                  </p>
                )}
              </div>

              {src && (
                <iframe
                  // Remounting is the reload: `contentWindow.location.reload()`
                  // is a cross-origin call that throws, and reassigning `.src`
                  // to the same string does not always re-navigate.
                  key={reloadKey}
                  ref={iframeRef}
                  src={src}
                  title="Hex cluster configurator"
                  onLoad={onFrameLoad}
                  // Everything the configurator needs, and the reasons:
                  //   same-origin  its OWN origin (not ours) -- it reads its
                  //                localStorage drawing register
                  //   downloads    the 3MF/STL export
                  //   modals       window.print() for the build sheet
                  //   popups       the print view
                  //   top-navigation-BY-USER-ACTIVATION  the child's fallback
                  //                when the handshake never landed: it sends
                  //                the TOP window to the save page. Without
                  //                this flag that fallback is blocked and the
                  //                Save button is silently dead -- the exact
                  //                failure the fallback exists to prevent.
                  //                The `-by-user-activation` form keeps a
                  //                drive-by redirect impossible: only a real
                  //                gesture in the frame can move the tab.
                  sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-popups-to-escape-sandbox allow-modals allow-forms allow-top-navigation-by-user-activation"
                  allow="fullscreen; clipboard-write"
                  className="h-full w-full border-0 bg-deep-space"
                />
              )}
              {contextLost && (
                <ContextLostNotice
                  onReload={() => {
                    setContextLost(false);
                    setReloadKey((n) => n + 1);
                  }}
                />
              )}
            </div>
          </div>

          {pendingSave && (
            <EmbeddedSavePanel
              request={pendingSave}
              onSaved={replySaved}
              onFailed={replyFailed}
              onCancelled={replyCancelled}
            />
          )}
        </FramePortal>
      )}
    </HexConfiguratorContext.Provider>
  );
}

/** Portals to <body> so the frame is not trapped by any `overflow` or
 *  `transform` on an ancestor section of the spec page -- a transformed
 *  ancestor makes `position: fixed` resolve against IT, not the viewport, and
 *  the frame would open inside a paragraph. */
function FramePortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/**
 * The WebGL context is gone.
 *
 * Real, and mobile-first: a backgrounded tab on iOS loses its context routinely,
 * and the configurator comes back as a black rectangle with no error anywhere.
 * The child reports it; this offers the only fix there is, which is a reload of
 * the frame. Note what a reload COSTS: the build in the frame is gone with it,
 * which is why this is an explicit button rather than something automatic.
 */
function ContextLostNotice({ onReload }: { onReload: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-deep-space px-6 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ Graphics context lost
      </p>
      <p className="max-w-sm font-serif text-sm leading-relaxed text-muted">
        The browser reclaimed the configurator&apos;s graphics memory, which it
        does to background tabs on some devices. Reloading brings it back.
      </p>
      <button
        type="button"
        onClick={onReload}
        className="glass-button px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
      >
        Reload the configurator
      </button>
    </div>
  );
}
