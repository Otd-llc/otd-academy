"use client";

// Print bed size for /account, "Printing" group. The value is what the hex
// configurator lays downloads out for; storing it on the account is what makes
// the answer survive a new browser, which is the whole reason this control exists
// rather than living only in the configurator's localStorage.
//
// SIZES, NOT PRINTER MODELS. A model list means maintaining a printer database
// and being wrong about it the first time a vendor reuses a name across a bed
// revision. A size is a number the owner can read off their own machine.
//
// Optimistic like EmailPreferences: the chip moves at once and reverts on error,
// and router.refresh() re-pulls the server value so two tabs cannot disagree for
// long. Validation runs through the SAME normalizeBed the action uses, so the
// Save button can never be enabled for a value the server would refuse.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPrintBed } from "@/lib/actions/print-bed";
import {
  BED_MAX,
  BED_MIN,
  BED_PRESETS,
  FALLBACK_BED,
  formatBed,
  normalizeBed,
  type StoredBed,
} from "@/lib/print-bed";

const CHIP =
  "rounded-md border px-3 py-1.5 font-numeral text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-gold disabled:opacity-50";
const CHIP_ON = "border-command-gold bg-command-gold text-deep-space";
const CHIP_OFF =
  "border-panel-border text-muted hover:border-command-gold hover:text-gold-light";
// Custom and Clear are words, not numerals, so they take the mono face the rest
// of the page uses for labels. Same box, same radius, same focus ring.
const WORD_CHIP =
  "rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-gold disabled:opacity-50";
const FIELD =
  "w-20 rounded-md border border-panel-border bg-deep-space px-2 py-1.5 font-numeral text-sm tabular-nums text-text focus:border-command-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-command-gold";

/** A stored bed matches a preset only when it is that size SQUARE. 300 x 220 is a
 *  custom bed that happens to share a number with one, and lighting the 300 chip
 *  for it would misreport what is saved. */
function presetOf(bed: StoredBed): number | null {
  if (!bed || bed.x !== bed.y) return null;
  return (BED_PRESETS as readonly number[]).includes(bed.x) ? bed.x : null;
}

export function PrintBedSetting({ initialBed }: { initialBed: StoredBed }) {
  const router = useRouter();
  const [bed, setBed] = useState<StoredBed>(initialBed);
  const [custom, setCustom] = useState(presetOf(initialBed) === null && !!initialBed);
  const [cx, setCx] = useState(String(initialBed?.x ?? FALLBACK_BED.x));
  const [cy, setCy] = useState(String(initialBed?.y ?? FALLBACK_BED.y));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = presetOf(bed);

  function save(next: StoredBed) {
    const previous = bed;
    setError(null);
    setBed(next); // optimistic
    startTransition(async () => {
      try {
        const res = await setPrintBed(next);
        setBed(res.bed);
        router.refresh();
      } catch {
        setBed(previous); // revert
        setError("Could not save that. Try again.");
      }
    });
  }

  // Number() on an empty string is 0, which is a number and would sail past a
  // typeof check; parsing here and validating with the shared rule means the
  // button is disabled for exactly the values the server would reject.
  const typed = normalizeBed(
    cx.trim() === "" ? NaN : Number(cx),
    cy.trim() === "" ? NaN : Number(cy),
  );

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-5 border-y border-panel-border/60 py-3.5">
        <p className="font-serif text-sm text-text">Print bed size</p>
        <p className="font-numeral text-lg tabular-nums text-command-gold">
          {bed ? formatBed(bed) : "Not set"}
        </p>
      </div>

      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-gray-3">
        {bed
          ? "Saved to your account · used on every device you sign in on"
          : `Not set · downloads lay out for ${formatBed(FALLBACK_BED)}`}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {BED_PRESETS.map((mm) => (
          <button
            key={mm}
            type="button"
            aria-pressed={active === mm && !custom}
            disabled={pending}
            onClick={() => {
              setCustom(false);
              save({ x: mm, y: mm });
            }}
            className={`${CHIP} ${active === mm && !custom ? CHIP_ON : CHIP_OFF}`}
          >
            {mm}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={custom}
          aria-expanded={custom}
          disabled={pending}
          onClick={() => setCustom((c) => !c)}
          className={`${WORD_CHIP} ${custom ? CHIP_ON : CHIP_OFF}`}
        >
          Custom
        </button>
        {bed ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setCustom(false);
              save(null);
            }}
            className={`${WORD_CHIP} ${CHIP_OFF}`}
          >
            Clear
          </button>
        ) : null}
      </div>

      {custom ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
            X
            <input
              type="number"
              inputMode="numeric"
              min={BED_MIN}
              max={BED_MAX}
              step={1}
              value={cx}
              disabled={pending}
              onChange={(e) => setCx(e.target.value)}
              className={`ml-2 ${FIELD}`}
            />
          </label>
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
            Y
            <input
              type="number"
              inputMode="numeric"
              min={BED_MIN}
              max={BED_MAX}
              step={1}
              value={cy}
              disabled={pending}
              onChange={(e) => setCy(e.target.value)}
              className={`ml-2 ${FIELD}`}
            />
          </label>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-gray-3">
            mm
          </span>
          <button
            type="button"
            disabled={pending || !typed}
            onClick={() => typed && save(typed)}
            className={`${WORD_CHIP} border-command-gold text-command-gold hover:bg-command-gold hover:text-deep-space`}
          >
            Save
          </button>
        </div>
      ) : null}

      <p className="mt-3 font-serif text-xs leading-relaxed text-muted">
        Sizes, not printer names: read the bed off your machine. A bigger bed only
        means fewer plates in a download, never a part that will not fit. Anything
        from {BED_MIN} to {BED_MAX} mm.
      </p>

      {error ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-alert-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
