// 9-slot stage tracker (design §8.3, Task 7.2).
//
// Renders the revision's stage progression as nine slots, each with one of
// four treatments per design §8.3:
//
//   • Active     — currentStage. glass-button-active gold-glow treatment.
//   • Completed  — order < currentStage. Outlined command-gold.
//   • Blocked    — active AND exitGate(ctx) fails. Outlined alert-red.
//                  The failure reason is rendered as a banner BELOW the
//                  grid, never inside the chip.
//   • Future     — order > currentStage. Outlined panel-border + muted.
//
// Responsive labels:
//   • ≥ 2xl (1536px+): full "01 / REQUIREMENTS"-style labels.
//   • sm–2xl: compact "01 / REQ" 3-letter codes.
//   • < sm:   numeric chips ("01"…) plus a "Current stage" banner above.
//
// Overflow policy — bulletproof: every chip <li> has min-w-0 +
// overflow-hidden, and every text span has max-w-full + truncate so the
// chip border is the ALWAYS-RESPECTED visual boundary. The failure reason
// is rendered OUTSIDE the chip grid (above the grid on mobile, below the
// grid on sm+) so no long error string can ever push a chip wider than its
// grid track.
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
        <p className="mt-1 break-words font-display text-2xl tracking-wider text-command-gold">
          {String(currentIdx + 1).padStart(2, "0")} / {STAGE_LABELS[currentStage]}
        </p>
        {firstReason ? (
          <p className="mt-1 break-words font-mono text-[10px] tracking-normal text-alert-red">
            {firstReason}
          </p>
        ) : null}
      </div>

      <ol className="grid grid-cols-9 gap-1.5 sm:gap-2">
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
            // Native `title=` (hover-only, hydration-safe) rather than a Radix
            // Tooltip: these chips are non-interactive status indicators (not
            // tab stops), and wrapping all 9 in a Radix Tooltip under SSR churned
            // `useId` and tripped a hydration mismatch. `aria-label` carries the
            // full label for assistive tech regardless of hover.
            <li
              key={stage}
              title={fullLabel}
              aria-label={fullLabel}
              className={`
                flex min-w-0 flex-col items-center justify-center
                overflow-hidden
                rounded border
                px-1 py-1.5
                sm:px-2 sm:py-2
                font-mono text-[10px] uppercase tracking-wider
                sm:text-xs
                ${slotClass}
              `}
            >
              {/* < sm: just the number. */}
              <span className="block max-w-full truncate sm:hidden">
                {num}
              </span>
              {/* sm–2xl: number + 3-letter short code. */}
              <span className="hidden max-w-full truncate sm:block 2xl:hidden">
                {shortLabel}
              </span>
              {/* ≥ 2xl: full label. */}
              <span className="hidden max-w-full truncate 2xl:block">
                {fullLabel}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Failure reason banner — rendered OUTSIDE the chip grid so a long
          error string can never push a chip wider than its grid track.
          Only renders on sm+ (the mobile banner above the grid already
          surfaces it). break-words handles unbreakable identifier-style
          tokens (POST_ASSEMBLY_CONTINUITY etc.) without overflow. */}
      {firstReason ? (
        <p className="mt-3 hidden break-words font-mono text-xs tracking-normal text-alert-red sm:block">
          {firstReason}
        </p>
      ) : null}
    </nav>
  );
}
