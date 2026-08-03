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
// Every message is validated by `parseMessage`, and the peer is pinned by BOTH
// its origin and `event.source === iframe.contentWindow`. Origin alone is not
// enough: any other frame or popup on a permitted origin could otherwise post a
// `save-request` this page would act on with the visitor's session.

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
  hexConfiguratorOrigin,
  hexConfiguratorSrc,
} from "@/lib/hex-configurator-url";
import type { HexRecall } from "@/lib/hex-recall";
import {
  CHANNEL,
  PROTOCOL_VERSION,
  parseMessage,
  type SaveRequest,
} from "@/lib/hex-embed-protocol";
import { getPosthog } from "@/lib/posthog-client";

/** Matches the transition durations below, and the `--hex-frame-*` timings. */
const OPEN_MS = 340;
const CLOSE_MS = 220;

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
  /** Bumped to remount the iframe, which is the only reload available across
   *  origins. Part of the `key`, so it also resets the handshake. */
  const [reloadKey, setReloadKey] = useState(0);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const originRectRef = useRef<DOMRect | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const animationRef = useRef<Animation | null>(null);

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
        default:
          // `ready` / `saved` / `save-failed` / `save-cancelled` are ours to
          // send, not to receive.
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled, origin, close]);

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
    });
  }, [post]);

  const onFrameLoad = useCallback(() => {
    setContextLost(false);
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
            <FrameToolbar onClose={close} recallFailed={recallFailed} />

            <div className="relative flex-1">
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

/** A hairline strip, not a filled bar: the frame is an instrument on the field,
 *  and a toolbar with a fill would read as a second site header. */
function FrameToolbar({
  onClose,
  recallFailed,
}: {
  onClose: () => void;
  recallFailed: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-4 border-b border-panel-border/60 px-4 py-2 sm:px-6">
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ Cluster configurator
      </span>
      {recallFailed && (
        // One line, in the strip that is already there. A saved build that
        // cannot be reopened is worth saying out loud, but it is not an error
        // state for the whole page: the configurator below is perfectly usable.
        <span className="font-serif text-xs text-muted">
          That saved build could not be opened. It may have been archived.
        </span>
      )}
      <button
        type="button"
        onClick={onClose}
        className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-muted underline underline-offset-4 hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none"
      >
        Close
      </button>
    </div>
  );
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
