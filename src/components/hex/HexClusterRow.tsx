"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  archiveHexCluster,
  renameHexCluster,
  unarchiveHexCluster,
} from "@/lib/actions/hex-clusters";
import { MAX_NAME_CHARS } from "@/lib/hex-cluster";

// One drawing in the register: its number, its latest revision, and the row
// actions. Rename, archive and unarchive all live here so archiving is not a
// one-way trip.

export interface RevisionSummary {
  revLabel: string;
  shareCode: string;
  savedAt: string;
}

export function HexClusterRow({
  id,
  drawingLabel,
  name,
  archived,
  latestRevLabel,
  savedAt,
  cells,
  pieces,
  openHref,
  revisions,
}: {
  id: string;
  drawingLabel: string;
  name: string;
  archived: boolean;
  latestRevLabel: string;
  savedAt: string;
  cells: number;
  pieces: number;
  openHref: string | null;
  revisions: RevisionSummary[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.message ?? "That did not work.");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <li className="border-t border-panel-border/60 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="font-mono text-sm text-command-gold">{drawingLabel}</p>
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => renameHexCluster(id, draft));
              }}
              className="mt-1 flex gap-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX_NAME_CHARS}
                autoFocus
                disabled={pending}
                className="border border-panel-border/60 bg-transparent px-2 py-1 font-serif text-sm text-title outline-none focus-visible:border-command-gold"
              />
              <button
                type="submit"
                disabled={pending}
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-command-gold"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(name);
                  setError(null);
                }}
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted"
              >
                Cancel
              </button>
            </form>
          ) : (
            <p className="mt-0.5 font-serif text-sm text-title">{name}</p>
          )}
        </div>
        <p className="font-mono text-[11px] text-muted">
          Rev {latestRevLabel} · saved {savedAt} · {cells} cells · {pieces}{" "}
          pieces
        </p>
      </div>

      {error && (
        <p className="mt-2 font-serif text-xs text-alert-red">{error}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.16em]">
        {openHref && (
          <a
            href={openHref}
            className="text-command-gold underline underline-offset-4"
          >
            Open in the configurator
          </a>
        )}
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-muted"
          >
            Rename
          </button>
        )}
        {archived ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => unarchiveHexCluster(id))}
            className="text-muted"
          >
            Unarchive
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => archiveHexCluster(id))}
            className="text-muted"
          >
            Archive
          </button>
        )}
        {revisions.length > 1 && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-muted"
          >
            {showHistory ? "Hide" : `History (${revisions.length})`}
          </button>
        )}
      </div>

      {showHistory && (
        <ul className="mt-3 border-l border-panel-border/60 pl-4">
          {revisions.map((r) => (
            <li
              key={r.shareCode}
              className="py-1 font-mono text-[11px] text-muted"
            >
              <Link
                href={`/c/${r.shareCode}`}
                className="text-command-gold underline underline-offset-4"
              >
                Rev {r.revLabel}
              </Link>{" "}
              · saved {r.savedAt}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
