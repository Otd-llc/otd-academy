"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { InlineBanner } from "@/components/InlineBanner";
import { saveHexCluster } from "@/lib/actions/hex-clusters";
import { MAX_NAME_CHARS, type SaveErrCode } from "@/lib/hex-cluster";
import {
  HEX_STASH_KEY,
  HEX_STASH_TTL_MS,
  type HexStash,
} from "@/components/hex/FragmentStash";

/**
 * Confirm a name and save a build.
 *
 * The build arrives in the URL FRAGMENT as a base64url envelope { p, h, v, s }:
 * the payload, its hash, the schema version and the summary. All four are
 * required on write and none is derivable here — the academy stores the payload
 * opaque and cannot recompute a BOM. The fragment carries them because a query
 * string would put a whole cluster into access logs and the Referer of every
 * asset this page loads.
 *
 * A client component cannot read location during prerender, so "loading" is a
 * real state and not a nicety.
 */

interface Envelope {
  p: string;
  h: string;
  v: number;
  s: unknown;
}

type Phase =
  | { kind: "loading" }
  | { kind: "no-payload" }
  | { kind: "malformed" }
  | { kind: "lost-in-signin" }
  | {
      kind: "form";
      envelope: Envelope;
      mode: "new" | "rev";
      share: string | null;
    }
  | {
      kind: "saving";
      envelope: Envelope;
      mode: "new" | "rev";
      share: string | null;
    }
  | {
      kind: "error";
      code: SaveErrCode;
      message: string;
      envelope: Envelope;
      mode: "new" | "rev";
      share: string | null;
    }
  | { kind: "done"; label: string };

function decodeEnvelope(raw: string): Envelope | null {
  try {
    const padded =
      raw.replace(/-/g, "+").replace(/_/g, "/") +
      "===".slice((raw.length + 3) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // TextDecoder, not a bare atob: the summary carries U+00D7 and U+00B7 in
    // its dimension strings, and a byte-wise read mojibakes them visibly on
    // the first /c/ render.
    const env = JSON.parse(new TextDecoder().decode(bytes)) as Envelope;
    if (typeof env?.p !== "string" || typeof env?.h !== "string") return null;
    if (typeof env?.v !== "number" || env?.s === undefined) return null;
    return env;
  } catch {
    return null;
  }
}

export function SaveHexClusterForm({
  mode,
  share,
}: {
  mode: "new" | "rev";
  share: string | null;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [name, setName] = useState("");

  useEffect(() => {
    // Straight from the fragment, when the user got here signed in.
    const direct = window.location.hash.replace(/^#/, "");
    if (direct) {
      const env = decodeEnvelope(direct);
      setPhase(
        env
          ? { kind: "form", envelope: env, mode, share }
          : { kind: "malformed" },
      );
      return;
    }

    // Otherwise this is the far side of a magic-link round trip, and the
    // fragment is gone. /sign-in stashed it before sending the email.
    let stash: HexStash | null = null;
    try {
      const raw = window.localStorage.getItem(HEX_STASH_KEY);
      stash = raw ? (JSON.parse(raw) as HexStash) : null;
    } catch {
      stash = null;
    }
    if (!stash || Date.now() - stash.at > HEX_STASH_TTL_MS) {
      setPhase({ kind: stash ? "lost-in-signin" : "no-payload" });
      return;
    }
    try {
      window.localStorage.removeItem(HEX_STASH_KEY);
    } catch {
      /* cleared on a best-effort basis */
    }

    const env = decodeEnvelope(stash.envelope);
    if (!env) {
      setPhase({ kind: "malformed" });
      return;
    }
    // The mode choice rode in the stash too: it lives only in the query, and
    // the query is what the round trip is most likely to drop.
    const stashed = new URLSearchParams(stash.search);
    setPhase({
      kind: "form",
      envelope: env,
      mode: stashed.get("mode") === "rev" ? "rev" : mode,
      share: stashed.get("share") ?? share,
    });
  }, [mode, share]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phase.kind !== "form" && phase.kind !== "error") return;
    const { envelope, mode: m, share: sh } = phase;
    setPhase({ kind: "saving", envelope, mode: m, share: sh });

    const res = await saveHexCluster({
      mode: m,
      share: sh ?? undefined,
      name,
      payload: envelope.p,
      payloadHash: envelope.h,
      schemaVersion: envelope.v,
      summary: envelope.s,
    });

    if (!res.ok) {
      setPhase({
        kind: "error",
        code: res.code,
        message: res.message,
        envelope,
        mode: m,
        share: sh,
      });
      return;
    }

    // CLIENT-SIDE, not a server redirect(): the payload rides the fragment and
    // a fragment that large would not survive a Location response header.
    const url = new URL("https://demo.onethousanddrones.com/hex");
    url.searchParams.set("d", res.drawingLabel);
    url.searchParams.set("r", res.revLabel);
    url.searchParams.set("s", res.shareCode);
    url.searchParams.set("h", envelope.h);
    url.searchParams.set("n", res.name);
    url.searchParams.set("t", res.savedAt);
    setPhase({
      kind: "done",
      label: `${res.drawingLabel} Rev ${res.revLabel}`,
    });
    // Query BEFORE the fragment — everything after '#' is fragment.
    window.location.assign(`${url.toString()}#${envelope.p}`);
  }

  async function retryUnarchived() {
    if (phase.kind !== "error") return;
    const { envelope, mode: m, share: sh } = phase;
    setPhase({ kind: "saving", envelope, mode: m, share: sh });
    const res = await saveHexCluster({
      mode: m,
      share: sh ?? undefined,
      name,
      payload: envelope.p,
      payloadHash: envelope.h,
      schemaVersion: envelope.v,
      summary: envelope.s,
      // ONE transaction: the unarchive, the cap re-check and the insert. Two
      // calls would not be atomic, and this page holds a share code and no
      // cluster id to call unarchiveHexCluster with.
      allowUnarchive: true,
    });
    if (!res.ok) {
      setPhase({
        kind: "error",
        code: res.code,
        message: res.message,
        envelope,
        mode: m,
        share: sh,
      });
      return;
    }
    setPhase({
      kind: "done",
      label: `${res.drawingLabel} Rev ${res.revLabel}`,
    });
    const url = new URL("https://demo.onethousanddrones.com/hex");
    url.searchParams.set("d", res.drawingLabel);
    url.searchParams.set("r", res.revLabel);
    url.searchParams.set("s", res.shareCode);
    url.searchParams.set("h", envelope.h);
    url.searchParams.set("n", res.name);
    url.searchParams.set("t", res.savedAt);
    window.location.assign(`${url.toString()}#${envelope.p}`);
  }

  const busy = phase.kind === "saving";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="SAVED BUILDS"
        title="Save this build."
        lead="Name it, and it joins your drawing register."
      />

      <section className="mt-8 border-t border-panel-border/60 pt-6">
        {phase.kind === "loading" && (
          <p className="font-serif text-sm text-muted">Reading your build…</p>
        )}

        {phase.kind === "no-payload" && (
          <InlineBanner variant="error">
            There is no build to save here. Open the configurator, press Export,
            then Save.
          </InlineBanner>
        )}

        {phase.kind === "malformed" && (
          <InlineBanner variant="error">
            That build could not be read. Go back to the configurator and press
            Save again.
          </InlineBanner>
        )}

        {phase.kind === "lost-in-signin" && (
          <InlineBanner variant="error">
            Your build could not be carried through sign-in. Go back to the
            configurator and press Save again — you are signed in now, so it
            will go straight through.
          </InlineBanner>
        )}

        {phase.kind === "done" && (
          <p className="font-serif text-sm text-muted">
            Saved as <span className="font-mono text-title">{phase.label}</span>
            . Returning you to the configurator…
          </p>
        )}

        {(phase.kind === "form" ||
          phase.kind === "saving" ||
          phase.kind === "error") && (
          <form onSubmit={submit}>
            {phase.kind === "error" && (
              <div className="mb-5">
                <InlineBanner variant="error">{phase.message}</InlineBanner>
                {phase.code === "cluster-archived" && (
                  <button
                    type="button"
                    onClick={retryUnarchived}
                    className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-command-gold underline underline-offset-4"
                  >
                    Unarchive and save
                  </button>
                )}
                {phase.code === "not-found" && phase.mode === "rev" && (
                  <button
                    type="button"
                    onClick={() =>
                      setPhase({
                        kind: "form",
                        envelope: phase.envelope,
                        mode: "new",
                        share: null,
                      })
                    }
                    className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-command-gold underline underline-offset-4"
                  >
                    Save as a new drawing
                  </button>
                )}
              </div>
            )}

            <label
              htmlFor="hex-name"
              className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold"
            >
              ▸ Name
            </label>
            <input
              id="hex-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME_CHARS}
              required
              autoFocus
              disabled={busy}
              placeholder="Bench cluster"
              className="mt-2 w-full border border-panel-border/60 bg-transparent px-3 py-2 font-serif text-sm text-title outline-none focus-visible:border-command-gold"
            />
            <p className="mt-2 font-serif text-xs text-muted">
              {phase.mode === "rev"
                ? "This saves the next revision of an existing drawing. The name is stamped on this revision's sheet."
                : "This mints a new drawing number. The name is stamped on the sheet."}
            </p>

            <button
              type="submit"
              disabled={busy || name.trim().length === 0}
              className="mt-6 border border-command-gold/60 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-command-gold disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save build"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
