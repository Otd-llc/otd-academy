"use client";

// Per-page lesson feedback (design §9.4): the "no forum" channel. Collapsed to a
// one-line affordance on a hairline; expanded to a bench-style underline textarea.
// Routes to admin (private, never a public thread). Signed-out shows a sign-in
// prompt. On submit: optimistic thanks + an XP tick with the SERVER's amount (the
// daily cap may make it 0 XP; we still thank them). Body is plain text only.
import { useState } from "react";
import Link from "next/link";
import { submitLessonFeedback } from "@/lib/actions/feedback";
import { XpTick } from "@/components/library/XpTick";

export function FeedbackBox({
  pageRef,
  signedIn,
}: {
  pageRef: string;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [xp, setXp] = useState(0);
  const slug = pageRef.replace(/^library\//, "");

  if (!signedIn) {
    return (
      <div className="mt-10 border-t border-panel-border/60 pt-4">
        <Link
          href={`/sign-in?callbackUrl=/library/${slug}`}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-command-gold"
        >
          ▸ Sign in to suggest an improvement
        </Link>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-10 border-t border-panel-border/60 pt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-command-gold focus-visible:text-command-gold focus-visible:outline-none"
        >
          ▸ Suggest an improvement
        </button>
      </div>
    );
  }

  async function submit() {
    if (body.trim().length < 10) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    const res = await submitLessonFeedback({ pageRef, body: body.trim() });
    if (res && "ok" in res && res.ok) {
      setXp("xp" in res ? res.xp : 0);
      setStatus("done");
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="mt-10 border-t border-panel-border/60 pt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ Suggest an improvement
      </p>
      {status === "done" ? (
        <p className="mt-3 flex items-center gap-3 font-mono text-xs uppercase tracking-wider text-status-green">
          Logged. Thank you.
          {xp > 0 ? <XpTick amount={xp} /> : null}
        </p>
      ) : (
        <div className="mt-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What would make this lesson clearer or more correct?"
            className="w-full resize-y border-0 border-b border-panel-border bg-transparent px-0 py-1 font-serif text-sm text-text placeholder:text-gray-3 focus:border-command-gold focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={submit}
              disabled={status === "sending"}
              className="glass-button inline-flex items-center px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]"
            >
              {status === "sending" ? "Sending" : "Send"}
            </button>
            {status === "error" ? (
              <span className="font-mono text-[10px] uppercase tracking-wider text-alert-red">
                Add a little more detail (10 characters or more).
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
