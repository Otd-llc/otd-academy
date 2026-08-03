"use client";

// Saving an embedded build, on the academy's own origin.
//
// THE RULE THIS ENFORCES: no message from the frame performs a write. The
// configurator posts a `save-request`; this panel opens; the write happens
// behind a click on a form in the academy's own DOM, with a name the visitor
// confirms. That is why the drawing register cannot be driven by anything the
// child says.
//
// AUTH IS DISCOVERED, NOT KNOWN. /hex is a static, prerendered page with no
// session provider and no `useSession` -- deliberately, since it is a public
// spec page that must serve from cache to crawlers. So this panel does not ask
// "are you signed in", it TRIES to save and reads the answer:
// `saveHexClusterEmbedded` returns `{ auth: "signed-out" }` rather than
// throwing, and only then does a sign-in appear.
//
// SIGN-IN IS A POPUP, and it has to be. The ordinary gate
// (`SaveSignInGate`) does a top-level `location.replace`, which would destroy
// the frame and the build inside it; and Google and GitHub both refuse to
// render their consent screens inside an iframe (`X-Frame-Options`), so a
// nested sign-in is not an option either. A popup is the only shape that keeps
// the build alive. When the popup is BLOCKED, the fallback is the pre-embed
// path that still works: stash the envelope in localStorage and send the top
// window to the save page.

import { useCallback, useEffect, useRef, useState } from "react";

import { InlineBanner } from "@/components/InlineBanner";
import {
  HEX_STASH_KEY,
  HEX_STASH_TTL_MS,
  type HexStash,
} from "@/components/hex/hex-stash";
import { saveHexClusterEmbedded } from "@/lib/actions/hex-clusters";
import { MAX_NAME_CHARS, type SaveErrCode } from "@/lib/hex-cluster";
import type { SaveRequest } from "@/lib/hex-embed-protocol";
import { fireHexSaveCompleted } from "@/lib/analytics-client";

/** How often the popup's progress is checked, and for how long. Long enough to
 *  find a magic link in an email client; short enough that an abandoned popup
 *  does not leave a poll running for the rest of the session. */
const POLL_MS = 1200;
const POLL_LIMIT_MS = 5 * 60 * 1000;

type Phase =
  | { kind: "form" }
  | { kind: "saving" }
  | { kind: "signed-out" }
  | { kind: "signing-in" }
  | { kind: "error"; code: SaveErrCode | "unknown"; message: string };

export function EmbeddedSavePanel({
  request,
  onSaved,
  onFailed,
  onCancelled,
}: {
  request: SaveRequest;
  onSaved: (
    requestId: string,
    fields: {
      drawingLabel: string;
      revLabel: string;
      shareCode: string;
      name: string;
      savedAt: string;
    },
  ) => void;
  onFailed: (requestId: string, code: string, message: string) => void;
  onCancelled: (requestId: string) => void;
}) {
  // The configurator's draft name, treated as a SUGGESTION: it is re-validated
  // here and again on the server, and `nameAtSave` is stamped from whatever is
  // confirmed below, so nothing unreviewed reaches the register.
  const [name, setName] = useState(() => request.envelope.n?.trim() ?? "");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  // The user can fork a failed revision save into a new drawing without
  // re-sending anything from the frame, so mode is state here, not a prop.
  const [mode, setMode] = useState(request.mode);
  const [share, setShare] = useState(request.share);
  const [allowUnarchive, setAllowUnarchive] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const pollRef = useRef<number | null>(null);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // A poll that outlives its panel is a leak with a `save` on the end of it.
  useEffect(
    () => () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    },
    [],
  );

  const save = useCallback(
    async (opts?: { unarchive?: boolean; asNew?: boolean }) => {
      const useMode = opts?.asNew ? "new" : mode;
      const useShare = opts?.asNew ? null : share;
      setPhase({ kind: "saving" });

      let outcome;
      try {
        outcome = await saveHexClusterEmbedded({
          mode: useMode,
          share: useShare ?? undefined,
          name,
          payload: request.envelope.p,
          payloadHash: request.envelope.h,
          schemaVersion: request.envelope.v,
          summary: request.envelope.s,
          allowUnarchive: opts?.unarchive ?? allowUnarchive,
        });
      } catch {
        // A network drop or a server-action deserialisation failure. The build
        // is still in the frame, so this is retryable in place.
        setPhase({
          kind: "error",
          code: "unknown",
          message: "That did not reach the server. Try again.",
        });
        return;
      }

      if (outcome.auth === "signed-out") {
        setPhase({ kind: "signed-out" });
        return;
      }

      const result = outcome.result;
      if (!result.ok) {
        setPhase({ kind: "error", code: result.code, message: result.message });
        // Tell the frame now rather than when the panel closes: its Save
        // control is disabled while a request is in flight, and a visitor
        // reading an error here should still be able to go back and edit.
        onFailed(request.requestId, result.code, result.message);
        return;
      }

      fireHexSaveCompleted({
        mode: useMode,
        embedded: true,
        rev: result.revLabel,
      });
      onSaved(request.requestId, {
        drawingLabel: result.drawingLabel,
        revLabel: result.revLabel,
        shareCode: result.shareCode,
        name: result.name,
        savedAt: result.savedAt,
      });
    },
    [allowUnarchive, mode, name, onFailed, onSaved, request, share],
  );

  /** Stash the build and send the TOP window to the save page.
   *
   *  The pre-embed path, kept as the fallback for a blocked popup. It loses the
   *  frame, which is the thing the embed exists to avoid, but it does not lose
   *  the BUILD -- and a visitor whose browser blocks popups still gets to save. */
  const fallbackToTopLevel = useCallback(() => {
    const search = new URLSearchParams({ mode });
    if (mode === "rev" && share) search.set("share", share);
    const stash: HexStash = {
      // Re-encoded here rather than carried on the wire: the envelope crossed
      // as an object, and the save page reads base64url from the fragment.
      envelope: toBase64Url(JSON.stringify(request.envelope)),
      search: search.toString(),
      at: Date.now(),
    };
    try {
      window.localStorage.setItem(HEX_STASH_KEY, JSON.stringify(stash));
    } catch {
      // Private mode. The fragment below still carries the build.
    }
    const target = `/account/hex-clusters/save?${search}#${stash.envelope}`;
    window.location.assign(target);
  }, [mode, request.envelope, share]);

  const signIn = useCallback(() => {
    // Opened synchronously in the click handler, or the browser treats it as
    // an unrequested popup and blocks it.
    const popup = window.open(
      "/sign-in?callbackUrl=%2Faccount%2Fhex-clusters",
      "otd-sign-in",
      "width=480,height=760,noopener=no",
    );
    if (!popup) {
      fallbackToTopLevel();
      return;
    }
    popupRef.current = popup;
    setPhase({ kind: "signing-in" });

    const startedAt = Date.now();
    pollRef.current = window.setInterval(() => {
      void (async () => {
        if (Date.now() - startedAt > POLL_LIMIT_MS) {
          stopPolling();
          setPhase({ kind: "signed-out" });
          return;
        }
        let signedIn = false;
        try {
          // `/api/auth/session` is exempt from the route gate's matcher, so it
          // answers for an anonymous caller instead of redirecting to /sign-in.
          const res = await fetch("/api/auth/session", { cache: "no-store" });
          const body = (await res.json()) as { user?: unknown } | null;
          signedIn = Boolean(body?.user);
        } catch {
          // Transient. Keep polling; the limit above ends it.
        }
        if (signedIn) {
          stopPolling();
          try {
            popup.close();
          } catch {
            // A cross-origin popup mid-OAuth may refuse. It is the visitor's to
            // close, and the save proceeds regardless.
          }
          void save();
          return;
        }
        // A magic link opens a NEW TAB, orphaning this popup, so a closed
        // popup is not proof the visitor gave up -- only that this window is
        // gone. Keep polling until the limit; the cookie is shared either way.
        if (popup.closed && Date.now() - startedAt > 4000) {
          // ...but stop asking the user to look at a window that is not there.
          setPhase((p) =>
            p.kind === "signing-in" ? { kind: "signed-out" } : p,
          );
        }
      })();
    }, POLL_MS);

    function stopPolling() {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [fallbackToTopLevel, save]);

  const cancel = useCallback(() => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    onCancelled(request.requestId);
  }, [onCancelled, request.requestId]);

  const busy = phase.kind === "saving";

  return (
    // A DIMMED backdrop plus an elevated deep-space surface, not a filled card:
    // the dim and the shadow do the lifting. z-50 puts it above the frame AND
    // above the app header, because it is the only thing that should be
    // interactive while it is up.
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-deep-space/70 p-4 sm:items-center"
      onMouseDown={(e) => {
        // Backdrop click cancels, but only when the press STARTED on the
        // backdrop -- otherwise a drag that ends outside the panel (selecting
        // the name field to the edge) would throw the save away.
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hex-save-title"
        className="w-full max-w-md border border-command-gold/25 bg-deep-space p-6 [box-shadow:var(--elev-card)]"
        style={{ borderRadius: "8px" }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Saved builds
        </p>
        <h2 id="hex-save-title" className="title-card mt-2">
          {mode === "rev" ? "Save the next revision." : "Save this build."}
        </h2>

        {phase.kind === "signed-out" && (
          <div className="mt-5">
            <p className="font-serif text-sm leading-relaxed text-muted">
              Saving puts this build in your drawing register, with a number and
              a revision. That needs an account.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={signIn}
                className="glass-button glass-button-cta px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
              >
                Sign in to save
              </button>
              <button
                type="button"
                onClick={cancel}
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted underline underline-offset-4 hover:text-gold-light"
              >
                Not now
              </button>
            </div>
            <p className="mt-4 font-serif text-xs leading-relaxed text-muted">
              Your cluster stays exactly as it is while you sign in.
            </p>
          </div>
        )}

        {phase.kind === "signing-in" && (
          <div className="mt-5">
            <p className="font-serif text-sm leading-relaxed text-muted">
              Finish signing in in the window that just opened. This panel picks
              up as soon as you are through, and saves on its own.
            </p>
            <p className="mt-4 font-serif text-xs leading-relaxed text-muted">
              If you asked for a magic link, it opens in a new tab. Come back
              here afterwards; this keeps waiting.
            </p>
            <button
              type="button"
              onClick={cancel}
              className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted underline underline-offset-4 hover:text-gold-light"
            >
              Cancel
            </button>
          </div>
        )}

        {(phase.kind === "form" ||
          phase.kind === "saving" ||
          phase.kind === "error") && (
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {phase.kind === "error" && (
              <div className="mb-5">
                <InlineBanner variant="error">{phase.message}</InlineBanner>
                {phase.code === "cluster-archived" && (
                  <button
                    type="button"
                    onClick={() => {
                      setAllowUnarchive(true);
                      void save({ unarchive: true });
                    }}
                    className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-command-gold underline underline-offset-4"
                  >
                    Unarchive and save
                  </button>
                )}
                {phase.code === "not-found" && mode === "rev" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("new");
                      setShare(null);
                      void save({ asNew: true });
                    }}
                    className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-command-gold underline underline-offset-4"
                  >
                    Save as a new drawing
                  </button>
                )}
              </div>
            )}

            <label
              htmlFor="hex-embed-name"
              className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold"
            >
              ▸ Name
            </label>
            <input
              id="hex-embed-name"
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME_CHARS}
              required
              disabled={busy}
              placeholder="Bench cluster"
              className="mt-2 w-full border border-panel-border/60 bg-transparent px-3 py-2 font-serif text-sm text-title outline-none focus-visible:border-command-gold"
            />
            <p className="mt-2 font-serif text-xs leading-relaxed text-muted">
              {mode === "rev"
                ? "This saves the next revision of an existing drawing. The name is stamped on this revision's sheet."
                : "This mints a new drawing number. The name is stamped on the sheet."}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={busy || name.trim().length === 0}
                className="glass-button glass-button-cta px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save build"}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={busy}
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted underline underline-offset-4 hover:text-gold-light disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** UTF-8, then base64url. TextEncoder rather than a bare btoa: the summary
 *  carries U+00D7 and U+00B7 in its dimension strings, and a name may carry
 *  anything at all. */
function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
