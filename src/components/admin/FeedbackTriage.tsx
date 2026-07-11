"use client";

// Admin feedback triage (design §9.4/§9.6). Hairline rows on the deep-space field
// (never a filled table). NEW rows carry USEFUL / DISMISS actions; USEFUL confirms
// first (it pays the author +25 XP + the Shipped It patch). Body renders as PLAIN
// TEXT. Status tabs filter the list. markFeedback is the admin-gated server action.
import { useState } from "react";
import Link from "next/link";
import { markFeedback } from "@/lib/actions/feedback";

export type FeedbackRow = {
  id: string;
  slug: string;
  pageRef: string;
  body: string;
  status: "NEW" | "USEFUL" | "DISMISSED";
  date: string;
  author: string;
};

const TABS = ["NEW", "USEFUL", "DISMISSED"] as const;

export function FeedbackTriage({ rows: initial }: { rows: FeedbackRow[] }) {
  const [rows, setRows] = useState(initial);
  const [tab, setTab] = useState<(typeof TABS)[number]>("NEW");
  const [busy, setBusy] = useState<string | null>(null);

  const counts = { NEW: 0, USEFUL: 0, DISMISSED: 0 };
  for (const r of rows) counts[r.status] += 1;
  const shown = rows.filter((r) => r.status === tab);

  async function mark(id: string, status: "USEFUL" | "DISMISSED") {
    if (
      status === "USEFUL" &&
      !window.confirm(
        "Mark useful? This pays the author +25 XP and the Shipped It patch.",
      )
    ) {
      return;
    }
    setBusy(id);
    const res = await markFeedback({ id, status });
    if (res && "ok" in res && res.ok) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    }
    setBusy(null);
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-5 border-b border-panel-border/60 pb-3">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
              tab === t ? "text-command-gold" : "text-muted hover:text-gold-light"
            }`}
          >
            {t}{" "}
            <span className="font-numeral tabular-nums">{counts[t]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 font-serif text-sm text-muted">Nothing here.</p>
      ) : (
        <ul className="mt-2">
          {shown.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 border-b border-panel-border/50 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
                  <Link
                    href={`/library/${r.slug}`}
                    className="text-command-gold hover:text-gold-light"
                  >
                    {r.pageRef}
                  </Link>
                  <span className="text-gray-3">·</span>
                  <span>{r.author}</span>
                  <span className="text-gray-3">·</span>
                  <span>{r.date}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words font-serif text-sm text-text">
                  {r.body}
                </p>
              </div>
              {r.status === "NEW" ? (
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => mark(r.id, "USEFUL")}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-status-green transition-colors hover:text-gold-light disabled:opacity-50"
                  >
                    Useful
                  </button>
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => mark(r.id, "DISMISSED")}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-alert-red disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <span
                  className={`shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] ${
                    r.status === "USEFUL" ? "text-status-green" : "text-gray-3"
                  }`}
                >
                  {r.status}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
