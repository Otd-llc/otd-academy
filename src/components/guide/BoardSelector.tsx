"use client";

// Per-board scope selector for the ASSEMBLY / BRINGUP guide cards (M9 / Task
// 9.2; design decision B). The build cards' completion (POST_ASSEMBLY_CONTINUITY
// checklist, bring-up measurements, board status) is tracked PER BOARD, so the
// card route carries a `?board=<id>` search param that scopes the StageGate
// widget. Changing the selection navigates to the same card with the new param
// (router.replace keeps history clean), and the RSC re-resolves the widget for
// that board.
//
// Rendered only when there's an active build WITH boards; the page handles the
// no-build / no-boards states separately (StageGate shows "blocked").

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function BoardSelector({
  boards,
  selectedBoardId,
}: {
  boards: { id: string; serial: string; status: string }[];
  selectedBoardId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(boardId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("board", boardId);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 font-mono text-xs uppercase tracking-wider text-muted">
      <label htmlFor="guide-board-selector" className="text-command-gold">
        Board
      </label>
      <select
        id="guide-board-selector"
        value={selectedBoardId}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
      >
        {boards.map((b) => (
          <option key={b.id} value={b.id}>
            {b.serial} · {b.status}
          </option>
        ))}
      </select>
    </div>
  );
}
