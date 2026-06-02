// 9-slot stage tracker (design §8.3, Task 7.2).
//
// Renders the revision's stage progression as nine slots, each with one of
// four treatments per design §8.3:
//
//   • Active     — currentStage. glass-button-active gold-glow treatment.
//   • Completed  — order < currentStage. Outlined command-gold.
//   • Blocked    — active AND exitGate(ctx) fails. Outlined alert-red,
//                  first failure reason inline.
//   • Future     — order > currentStage. Outlined panel-border + muted.
//
// Responsive layout (revised — no internal scrollbar):
//   • ≥ 2xl (1536px+): single row, all 9 slots show "01 / REQUIREMENTS"-
//     style full labels. Below this width the longest full label
//     ("01 / BOM SOURCING") exceeds the per-chip track width even at xl
//     because the page caps at max-w-7xl (1280px); the chips themselves
//     are only ~130px wide.
//   • sm–2xl (640–1536px): single row, compact "01 / REQ"-style 3-letter
//     code abbreviations so chips stay readable.
//   • < sm (mobile): numeric-only chips ("01", "02", ...) plus a separate
//     "Current stage" banner above the grid for the active label + first
//     failure reason. No horizontal scroll anywhere.
//
// Defence-in-depth: every chip has `min-w-0` and every label span has
// `truncate` so even if a future label exceeds the chip width, the text
// is ellipsised instead of bleeding past the chip border.
//
// Server component — caller loads `ctx` via `loadGateContext` and passes
// it in. Treats the tracker as a pure render of `(revision, ctx)`.

import type { Revision } from "@prisma/client";
import {
  STAGES,
  STAGE_LABELS,
  STAGE_ORDER,
  type GateContext,
  type GateResult,
  type StageName,
} from "@/lib/stages";

const STAGE_SHORT: Record<StageName, string> = {
  REQUIREMENTS: "REQ",
  SCHEMATIC: "SCH",
  BOM_SOURCING: "BOM",
  LAYOUT: "LAY",
  DRC_GERBER: "DRC",
  ORDERING: "ORD",
  ASSEMBLY: "ASM",
  BRINGUP: "BRG",
  REVISION: "REV",
};

type Props = {
  revision: Pick<Revision, "currentStage">;
  ctx: GateContext;
};

export async function StageTracker({ revision, ctx }: Props) {
  const currentStage = revision.currentStage as StageName;
  const currentIdx = STAGE_ORDER.indexOf(currentStage);

  // Evaluate the active stage's exitGate (if any). Async because gate
  // functions return `GateResult | Promise<GateResult>` per the StageDef
  // signature.
  let activeGateResult: GateResult | null = null;
  const activeDef = STAGES[currentStage];
  if (activeDef.exitGate) {
    activeGateResult = await activeDef.exitGate(ctx);
  }
  const activeIsBlocked = activeGateResult?.ok === false;
  const firstReason =
    activeGateResult && activeGateResult.ok === false
      ? activeGateResult.reasons[0]
      : null;

  return (
    <nav aria-label="Stage tracker" className="glass-card p-3 sm:p-4">
      {/* Mobile-only "current stage" banner — gives the user a one-glance
          read of where they are without having to parse 9 small chips. */}
      <div className="mb-3 sm:hidden">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold-dim">
          Current stage
        </p>
        <p className="mt-1 font-display text-2xl tracking-wider text-command-gold">
          {String(currentIdx + 1).padStart(2, "0")} / {STAGE_LABELS[currentStage]}
        </p>
        {firstReason ? (
          <p className="mt-1 font-mono text-[10px] tracking-normal text-alert-red">
            {firstReason}
          </p>
        ) : null}
      </div>

      <ol
        className="
          grid grid-cols-9 gap-1.5
          sm:gap-2
        "
      >
        {STAGE_ORDER.map((stage, idx) => {
          const isActive = idx === currentIdx;
          const isCompleted = idx < currentIdx;
          const isBlocked = isActive && activeIsBlocked;

          let slotClass: string;
          if (isBlocked) {
            slotClass = "border-alert-red text-alert-red bg-deep-space/60";
          } else if (isActive) {
            slotClass = "glass-button glass-button-active border";
          } else if (isCompleted) {
            slotClass =
              "border-command-gold text-command-gold bg-deep-space/60";
          } else {
            slotClass = "border-panel-border text-muted bg-deep-space/40";
          }

          const num = String(idx + 1).padStart(2, "0");
          const shortLabel = `${num} / ${STAGE_SHORT[stage]}`;
          const fullLabel = `${num} / ${STAGE_LABELS[stage]}`;

          return (
            <li
              key={stage}
              title={fullLabel}
              className={`
                flex min-w-0 flex-col items-center justify-center
                rounded border
                px-1 py-1.5
                sm:px-2 sm:py-2
                font-mono text-[10px] uppercase tracking-wider
                sm:text-xs
                ${slotClass}
              `}
            >
              {/* < sm: just the number. */}
              <span className="block sm:hidden">{num}</span>
              {/* sm–2xl: number + 3-letter short code. */}
              <span className="hidden max-w-full truncate sm:block 2xl:hidden">
                {shortLabel}
              </span>
              {/* ≥ 2xl: full label. Truncate-with-ellipsis fallback if any
                  future label still doesn't fit. */}
              <span className="hidden max-w-full truncate 2xl:block">
                {fullLabel}
              </span>
              {/* Blocked-slot inline reason — only on the active slot when its
                  gate fails. Rendered at ≥ 2xl only (the < sm banner above
                  already surfaces it on mobile; sm–2xl keeps the row tight). */}
              {isBlocked && firstReason ? (
                <span className="mt-1 hidden font-mono text-[10px] normal-case tracking-normal text-alert-red 2xl:block">
                  {firstReason}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
