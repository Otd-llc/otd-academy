"use client";

// Quick-glance modal (Task 8 / design §6). Opened from a per-row "glance"
// IconButton on the parts list; renders a COMPACT read projection of a part's
// VERIFIED facts.
//
// DATA PATH: on open we call the `glancePart(partId)` server action, which is a
// thin wrapper over the shared `lookupPart(db, …)` read layer — verified-only,
// FLAGGED excluded, each fact carrying its required non-null `citation` (we do
// NOT re-filter trust in the client). The result is the same `LookupPartResult`
// envelope the Stage B MCP server consumes; a miss is `{ found: false }`.
//
// PROJECTION (compact): a pinout table (number/name/function/type), key
// parametrics (label: value unit), the bypass list, and a small derating
// SPARKLINE — a plain inline-SVG polyline of one curve's points, no chart lib.
// Each rendered fact shows its citation; a "view full part →" link drops to
// `/parts/[id]`. If the part has no verified facts we show a muted empty state.
//
// DISMISSAL + FOCUS: backed by a native <dialog> (`showModal()`), so we inherit
// platform modality + top-layer stacking. Escape and the close button dismiss
// (the dialog's `cancel`/`close` events bubble to `onClose`); a backdrop click
// is caught by comparing the click target to the dialog element. On open we move
// focus to the dialog; `autoFocus` on the close button keeps focus inside.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { glancePart } from "@/lib/actions/part-glance";
import type {
  LookupPartResult,
  VerifiedFact,
} from "@/lib/parts-knowledge/query";
import { CloseIcon, ChevronRightIcon } from "@/components/icons";

// ─── narrowing helpers for the per-group `data: unknown` ────────────────────
type PinRow = { number?: string; name?: string; function?: unknown; type?: string };
type EntryRow = { label?: string; value?: string; unit?: string };
type BypassRow = { value?: string; qty?: number; placement?: string };
type CurvePoint = { x?: number; y?: number };
type CurveRow = {
  kind?: string;
  xUnit?: string;
  yUnit?: string;
  points?: CurvePoint[];
};

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** A pin function may be `string | string[]`; join lists for compact display. */
function fnText(fn: unknown): string {
  if (Array.isArray(fn)) return fn.filter((s) => typeof s === "string").join(" / ");
  return typeof fn === "string" ? fn : "";
}

function factByGroup(facts: VerifiedFact[], group: string): VerifiedFact | undefined {
  return facts.find((f) => f.group === group);
}

export function PartGlanceModal({
  partId,
  mpn,
  open,
  onClose,
}: {
  partId: string;
  mpn: string;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<LookupPartResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Sync the open prop to the native dialog's modal state.
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // Fetch the verified projection each time the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setResult(null);
    glancePart(partId)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, partId]);

  // Backdrop click: a click whose target is the <dialog> itself (not its inner
  // content) lands on the backdrop → dismiss.
  function onDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === ref.current) onClose();
  }

  const hit = result && result.found ? result : null;
  const facts = hit?.facts ?? [];

  const pinout = factByGroup(facts, "PINOUT");
  const parametrics = factByGroup(facts, "PARAMETRICS");
  const power = factByGroup(facts, "POWER");
  const derating = factByGroup(facts, "DERATING");

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={onDialogClick}
      aria-label={`Quick glance: ${mpn}`}
      className="w-full max-w-2xl rounded border border-panel-border bg-navy-dark p-0 text-link-muted backdrop:bg-deep-space/80"
    >
      {/* inner content wrapper — clicks here do NOT hit the backdrop */}
      <div className="max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold-dim">
              Quick glance · verified facts
            </p>
            <h2 className="mt-1 font-display text-2xl tracking-wider text-white">
              {mpn}
            </h2>
          </div>
          <button
            type="button"
            autoFocus
            aria-label="Close quick glance"
            onClick={onClose}
            className="inline-flex shrink-0 items-center justify-center rounded p-2 text-muted transition-colors hover:bg-navy-dark/40 hover:text-command-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-command-gold"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {loading ? (
            <p className="font-mono text-xs uppercase tracking-wider text-muted">
              Loading…
            </p>
          ) : error ? (
            <p
              role="alert"
              className="rounded border border-alert-red bg-deep-space px-4 py-3 font-mono text-sm text-alert-red"
            >
              Could not load this part — try again.
            </p>
          ) : !hit ? (
            <p className="font-mono text-xs uppercase tracking-wider text-muted">
              Part not in library.
            </p>
          ) : facts.length === 0 ? (
            <p className="font-mono text-xs uppercase tracking-wider text-muted">
              No verified facts yet.
            </p>
          ) : (
            <>
              {pinout ? <PinoutBlock fact={pinout} /> : null}
              {parametrics ? <ParametricsBlock fact={parametrics} /> : null}
              {power ? <BypassBlock fact={power} /> : null}
              {derating ? <DeratingBlock fact={derating} /> : null}
            </>
          )}
        </div>

        <div className="mt-6 border-t border-panel-border pt-4">
          <Link
            href={`/parts/${partId}`}
            className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-signal-blue transition-colors hover:text-command-gold"
          >
            View full part
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </dialog>
  );
}

// ─── per-group compact blocks ───────────────────────────────────────────────

function Citation({ text }: { text: string }) {
  return (
    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-gold-dim">
      {text}
    </p>
  );
}

function BlockHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-command-gold">
      {children}
    </h3>
  );
}

function PinoutBlock({ fact }: { fact: VerifiedFact }) {
  const d = (fact.data ?? {}) as { pins?: unknown };
  const pins = asArray<PinRow>(d.pins);
  if (pins.length === 0) return null;
  return (
    <section>
      <BlockHeading>Pinout</BlockHeading>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-panel-border text-left text-muted">
              <th className="py-1 pr-3 font-normal">#</th>
              <th className="py-1 pr-3 font-normal">Name</th>
              <th className="py-1 pr-3 font-normal">Function</th>
              <th className="py-1 pr-3 font-normal">Type</th>
            </tr>
          </thead>
          <tbody>
            {pins.map((p, i) => (
              <tr key={i} className="border-b border-panel-border/50">
                <td className="py-1 pr-3 text-link-muted">{p.number ?? "—"}</td>
                <td className="py-1 pr-3 text-link-muted">{p.name ?? "—"}</td>
                <td className="py-1 pr-3 text-link-muted">
                  {fnText(p.function) || "—"}
                </td>
                <td className="py-1 pr-3 text-muted">{p.type ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Citation text={fact.citation} />
    </section>
  );
}

function ParametricsBlock({ fact }: { fact: VerifiedFact }) {
  const d = (fact.data ?? {}) as { entries?: unknown };
  const entries = asArray<EntryRow>(d.entries);
  if (entries.length === 0) return null;
  return (
    <section>
      <BlockHeading>Key parametrics</BlockHeading>
      <dl className="mt-2 grid grid-cols-1 gap-1 font-mono text-xs sm:grid-cols-2">
        {entries.map((e, i) => (
          <div key={i} className="flex gap-2">
            <dt className="text-muted">{e.label ?? ""}</dt>
            <dd className="text-link-muted">
              {e.value ?? ""}
              {e.unit ? ` ${e.unit}` : ""}
            </dd>
          </div>
        ))}
      </dl>
      <Citation text={fact.citation} />
    </section>
  );
}

function BypassBlock({ fact }: { fact: VerifiedFact }) {
  const d = (fact.data ?? {}) as { bypass?: unknown };
  const bypass = asArray<BypassRow>(d.bypass);
  if (bypass.length === 0) return null;
  return (
    <section>
      <BlockHeading>Bypass</BlockHeading>
      <ul className="mt-2 space-y-1 font-mono text-xs text-link-muted">
        {bypass.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-command-gold">
              {b.qty && b.qty > 1 ? `${b.qty}× ` : ""}
              {b.value ?? ""}
            </span>
            <span className="text-muted">@ {b.placement ?? ""}</span>
          </li>
        ))}
      </ul>
      <Citation text={fact.citation} />
    </section>
  );
}

function DeratingBlock({ fact }: { fact: VerifiedFact }) {
  const d = (fact.data ?? {}) as { curves?: unknown };
  const curves = asArray<CurveRow>(d.curves);
  // Project the FIRST curve with ≥2 numeric points (the compact glance shows
  // one representative sparkline; the full curve list lives on the detail page).
  const curve = curves.find(
    (c) =>
      Array.isArray(c.points) &&
      c.points.filter(
        (p) => typeof p.x === "number" && typeof p.y === "number",
      ).length >= 2,
  );
  if (!curve) return null;
  const points = (curve.points ?? []).filter(
    (p): p is { x: number; y: number } =>
      typeof p.x === "number" && typeof p.y === "number",
  );
  return (
    <section>
      <BlockHeading>
        Derating{curve.kind ? ` · ${curve.kind}` : ""}
      </BlockHeading>
      <div className="mt-2 flex items-center gap-3">
        <Sparkline points={points} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {curve.yUnit ?? "y"} vs {curve.xUnit ?? "x"}
        </span>
      </div>
      <Citation text={fact.citation} />
    </section>
  );
}

// ─── sparkline ──────────────────────────────────────────────────────────────
// A dependency-free inline-SVG polyline of one curve's points. Maps the data
// domain (min..max x, min..max y) into a fixed viewBox with a small inset, then
// renders the points as a single <polyline>. A flat axis (zero span) is pinned
// to the vertical mid-line so a single-value curve still renders sanely. No
// chart lib — this is intentionally the smallest thing that reads as a trend.
function Sparkline({ points }: { points: { x: number; y: number }[] }) {
  const W = 160;
  const H = 44;
  const PAD = 4;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const coords = points.map((p) => {
    const px = PAD + ((p.x - minX) / spanX) * (W - 2 * PAD);
    // Invert y so larger values sit higher; a zero-span y pins to the mid-line.
    const py =
      maxY === minY
        ? H / 2
        : PAD + (1 - (p.y - minY) / spanY) * (H - 2 * PAD);
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label="Derating curve sparkline"
      className="shrink-0 rounded border border-panel-border bg-deep-space"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-command-gold"
      />
    </svg>
  );
}
