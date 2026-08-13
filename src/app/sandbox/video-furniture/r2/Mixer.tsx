"use client";

// THE MIXING TABLE.
//
// Owner's brief, verbatim in substance: buttons proved the point, now I need a
// mixing table where I can adjust the curves and duration of each effect.
//
// TWO STACKS, NOT ONE. An ENTRY stack and an EXIT stack, each an ordered list.
// Exits were already a pulled-out dimension; entrances were not, and an
// inventory found all sixty round-2 treatments arriving on nine underlying
// gestures expressed sixty times, with two hardcoded curves. A dimension hidden
// inside sixty variants is a dimension nobody can dial, which is the same
// argument that pulled exits out in the first place.
//
// PER EFFECT, THREE CONTROLS, and each earns its place:
//   curve     remaps `p` before the effect sees it, so one effect can be
//             exponential and the next linear. Stored as control points, never
//             as a name - a named easing list is where this stops being a mixer.
//   duration  in BEATS. "0.55 s" is a number somebody liked; "1 beat" is a
//             relationship that survives a change of tempo.
//   offset    when it starts relative to the stack. Everything starting
//             together is a special case, not the only case.
//
// LAYOUT is work-area-left, mixer-right, sticky for the whole scroll and
// attached to the transport, so the controls and the thing they control are one
// object rather than two panels that happen to be adjacent.
//
// DESIGN LAW. Hairlines on the bare field, no filled cards, square corners,
// mono labels, tokens only. A control surface is still a content surface.
//
// ASCII only.

import { CurveEditor } from "./CurveEditor";
import { ENTRIES, TARGETS, defaultEffect, entryProgress, type EntryEffect, type EntryKind, type EntryTarget } from "./entries";
import { EXITS, type FurnitureOut } from "./exits";
import { BPM, beats, snapBeats, finestStep, framesPerBeat, ACCENT_CLASSES, type AccentClass } from "./meter";

const ROW = "border-b border-panel-border/60 py-3";
const LABEL = "font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold";
const SUB = "font-mono text-[9px] uppercase tracking-[0.16em] text-muted";

/** A number the owner drags, shown in beats and in the seconds it resolves to. */
function BeatField({
  label,
  value,
  onChange,
  max = 8,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
}) {
  return (
    <label className="block">
      <span className={SUB}>
        {label}{" "}
        <span className="text-text">{value.toFixed(2)}</span> beat
        {value === 1 ? "" : "s"}{" "}
        <span className="text-gray-3">({beats(value).toFixed(3)}s)</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={finestStep()}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-command-gold"
      />
    </label>
  );
}

function EffectRow({
  effect,
  index,
  t,
  onChange,
  onRemove,
  onMove,
}: {
  effect: EntryEffect;
  index: number;
  t: number;
  onChange: (next: EntryEffect) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const p = entryProgress(effect, t);
  const meta = ENTRIES.find((e) => e.id === effect.kind);
  return (
    <li className={ROW}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={LABEL}>
          <span>{index + 1}</span> {meta?.label ?? effect.kind}
          <span className="text-muted"> &rarr; {effect.target}</span>
        </span>
        <span className="flex items-center gap-2">
          {/* Order is the applied order, so moving a row is a real edit, not a
              display preference: the browser composes outermost first. */}
          <button type="button" onClick={() => onMove(-1)} className={`${SUB} hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none`}>
            up
          </button>
          <button type="button" onClick={() => onMove(1)} className={`${SUB} hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none`}>
            down
          </button>
          <button type="button" onClick={onRemove} className={`${SUB} text-muted hover:text-danger-coral focus-visible:text-danger-coral focus-visible:outline-none`}>
            remove
          </button>
        </span>
      </div>
      {meta ? <p className="mt-1 text-xs leading-relaxed text-muted">{meta.note}</p> : null}

      <div className="mt-3 flex flex-wrap gap-4">
        <CurveEditor value={effect.curve} onChange={(curve) => onChange({ ...effect, curve })} p={p} />
        <div className="min-w-[9rem] flex-1">
          <BeatField
            label="duration"
            value={effect.durationBeats}
            onChange={(durationBeats) => onChange({ ...effect, durationBeats })}
          />
          <div className="mt-3">
            <BeatField
              label="offset"
              value={effect.offsetBeats}
              onChange={(offsetBeats) => onChange({ ...effect, offsetBeats })}
            />
          </div>
          {/* WHICH PART, so a stack can choreograph a treatment rather than
              only fade it in as one object. */}
          <label className="mt-3 block">
            <span className={SUB}>drives</span>
            <select
              value={effect.target}
              onChange={(e) => onChange({ ...effect, target: e.target.value as EntryTarget })}
              className="mt-1 w-full border border-panel-border bg-transparent px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text focus:border-command-gold focus:outline-none"
            >
              {TARGETS.map((tg) => (
                <option key={tg} value={tg} className="bg-deep-space">
                  {tg}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block">
            <span className={SUB}>accent / pre-roll</span>
            <select
              value={effect.accent}
              onChange={(e) => onChange({ ...effect, accent: e.target.value as AccentClass })}
              className="mt-1 w-full border border-panel-border bg-transparent px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text focus:border-command-gold focus:outline-none"
            >
              {Object.entries(ACCENT_CLASSES).map(([id, a]) => (
                <option key={id} value={id} className="bg-deep-space">
                  {a.label} &middot; {a.preRollMs}ms
                </option>
              ))}
            </select>
          </label>
          <p className={`${SUB} mt-2`}>
            p at cursor <span className="text-text">{p.toFixed(3)}</span>
          </p>
        </div>
      </div>
    </li>
  );
}

export function Mixer({
  t,
  seconds,
  onSeek,
  entry,
  setEntry,
  exit,
  setExit,
}: {
  t: number;
  seconds: number;
  onSeek: (t: number) => void;
  entry: EntryEffect[];
  setEntry: (next: EntryEffect[]) => void;
  exit: FurnitureOut[];
  setExit: (next: FurnitureOut[]) => void;
}) {
  const patch = (i: number, next: EntryEffect) => setEntry(entry.map((e, n) => (n === i ? next : e)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= entry.length) return;
    const next = [...entry];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setEntry(next);
  };

  return (
    <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto border-l border-panel-border/60 pl-5">
      {/* TRANSPORT FIRST, and attached rather than adjacent: every control below
          is read against the frame the scrubber is showing. */}
      <div className="border-b border-panel-border/60 pb-3">
        <div className="flex items-baseline justify-between">
          <span className={LABEL}>&#9656; transport</span>
          <span className={SUB}>
            <span className="text-text">{t.toFixed(2)}</span>s &middot;{" "}
            <span className="text-text">{(t / (60 / BPM)).toFixed(2)}</span> beats
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={seconds}
          step={1 / 30}
          value={t}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="mt-2 w-full accent-command-gold"
        />
        <p className={`${SUB} mt-1`}>
          {BPM} bpm &middot; 1 beat = {(60 / BPM).toFixed(3)}s &middot;{" "}
          {framesPerBeat(BPM, 30)} frames @30 &middot; finest legal step 1/
          {(1 / finestStep()).toFixed(0)} beat
        </p>
      </div>

      {/* ENTRY */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className={LABEL}>&#9656; entry stack</span>
          <button
            type="button"
            onClick={() => setEntry(entry.map((e) => ({ ...e, durationBeats: snapBeats(e.durationBeats), offsetBeats: snapBeats(e.offsetBeats) })))}
            className={`${SUB} hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none`}
          >
            snap to grid
          </button>
        </div>
        <ul className="mt-2 border-t border-panel-border/60">
          {entry.map((e, i) => (
            <EffectRow
              key={`${e.kind}-${i}`}
              effect={e}
              index={i}
              t={t}
              onChange={(next) => patch(i, next)}
              onRemove={() => setEntry(entry.filter((_, n) => n !== i))}
              onMove={(d) => move(i, d)}
            />
          ))}
          {entry.length === 0 ? (
            <li className="py-3 text-xs text-muted">
              No entrance, so the piece is simply there on the first frame. That is a legal choice
              (a cut), and it is the only arrival that costs a reader nothing.
            </li>
          ) : null}
        </ul>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
          {ENTRIES.map((e) => (
            <button
              key={e.id}
              type="button"
              title={e.note}
              onClick={() => setEntry([...entry, defaultEffect(e.id as EntryKind)])}
              className="border border-panel-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted hover:border-gold-light hover:text-gold-light focus-visible:border-command-gold focus-visible:outline-none"
            >
              + {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* EXIT - already a dimension, so this is the picker it always had, moved
          into the same column as its opposite number. */}
      <div className="mt-6">
        <span className={LABEL}>&#9656; exit stack</span>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
          {EXITS.map((x) => {
            const on = exit.includes(x.id);
            const order = exit.indexOf(x.id) + 1;
            return (
              <button
                key={x.id}
                type="button"
                title={x.note}
                onClick={() => setExit(on ? exit.filter((k) => k !== x.id) : [...exit, x.id])}
                className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] focus-visible:border-command-gold focus-visible:outline-none ${
                  on ? "border-command-gold text-command-gold" : "border-panel-border text-muted hover:border-gold-light hover:text-gold-light"
                }`}
              >
                {on ? <span>{order} </span> : null}
                {x.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {exit.length === 0
            ? "No exit selected, so the piece simply stops."
            : exit.map((id) => EXITS.find((x) => x.id === id)?.note).join(" ")}
        </p>
      </div>
    </div>
  );
}
