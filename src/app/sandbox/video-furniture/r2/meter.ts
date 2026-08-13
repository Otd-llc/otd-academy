// THE METER. Everything animates on beats, whether or not there is sound.
//
// A duration written as "0.55 s" is a number somebody liked once. Written as
// "1 beat" it is a relationship, and when the bed lands at a different tempo the
// whole set retimes with it instead of drifting out of sync with its own music.
// That is the entire argument for this file.
//
// WHY THE TEMPO IS NOT FREE. Frames per beat = fps * 60 / BPM. A non-integer
// means every accent rounds to a fractional frame, which is a +/-1 frame jitter
// exactly the size of the effect we are trying to control. For an integer at
// 24, 30 AND 60 fps the BPM must divide 360, which leaves:
//
//     40, 45, 60, 72, 90, 120, 180
//
// 128 BPM - the reflex tempo, the one everybody reaches for - is frame-illegal
// at every common rate. 120 is legal and is the house tempo.
//
// ONE TEMPO, VARIED BY SUBDIVISION. Energy comes from the accent grid, not from
// the tempo, so every asset stays beat-matchable to every other and the
// identity does not drift between a Short and a lesson.
//
// BUT THE SUBDIVISION TABLE IN THE RESEARCH IS FRAME-ILLEGAL AT 30 FPS, and it
// is worth naming rather than copying. It reads 1/8 note = 0.250 s = 15 frames,
// and prints only the 60 fps column, where that is true. At 30 fps an eighth at
// 120 BPM is 7.5 frames. The frame-legal rule was applied to the BEAT and never
// to the fractions of it - see `legalDenominators` below, which derives the
// answer instead of restating the table.
//
// ASCII only.

/** BPMs with an integer frame count per beat at 24, 30 and 60 fps. */
export const FRAME_LEGAL_BPM = [40, 45, 60, 72, 90, 120, 180] as const;
export type FrameLegalBpm = (typeof FRAME_LEGAL_BPM)[number];

/** The house tempo. */
export const BPM: FrameLegalBpm = 120;

export const FPS_TARGETS = [24, 30, 60] as const;

/**
 * Is this tempo frame-legal at every rate we deliver?
 *
 * Computed rather than looked up, so the list above cannot rot: it is a cache
 * of this function's answer, not the source of it.
 */
export function isFrameLegal(bpm: number): boolean {
  return FPS_TARGETS.every((fps) => Number.isInteger((fps * 60) / bpm));
}

/** Frames per beat at a given rate. Fractional means the tempo is illegal. */
export function framesPerBeat(bpm: number, fps: number): number {
  return (fps * 60) / bpm;
}

/** Seconds per beat. */
export const beatSeconds = (bpm: number = BPM) => 60 / bpm;

/** Beats to seconds. The conversion the whole mixer runs on. */
export const beats = (n: number, bpm: number = BPM) => n * beatSeconds(bpm);

/** Seconds to beats, for reading an existing hand-tuned number in beats. */
export const toBeats = (seconds: number, bpm: number = BPM) => seconds / beatSeconds(bpm);

/**
 * WHICH SUBDIVISIONS ARE FRAME-LEGAL, which is NOT the same question as which
 * tempo is frame-legal, and the difference bites at exactly our tempo.
 *
 * "BPM divides 360" makes the BEAT land on a whole frame at 24/30/60. It says
 * nothing about a fraction of a beat. A subdivision 1/n is legal at all three
 * rates only when n divides 360/BPM.
 *
 *     BPM 120 -> 360/120 = 3 -> n in {1, 3}
 *
 * So at 120 BPM a beat is 15 frames at 30 fps - an ODD number - and it cannot
 * be halved. An eighth note is 7.5 frames, which is precisely the +/-1 frame
 * jitter the frame-legal rule exists to prevent. 120 BPM buys whole beats and
 * TRIPLETS, and nothing finer.
 *
 * THIS IS A DECISION, NOT A DETAIL: if sixteenth-note control turns out to
 * matter, the tempo is 90, not 120. Better to see it here than to discover it
 * after every duration in the set has been typed in eighths.
 */
const divisors = (n: number) => {
  const out: number[] = [];
  for (let d = 1; d <= n; d += 1) if (n % d === 0) out.push(d);
  return out;
};

/** Legal subdivision denominators at this tempo, across every delivery rate. */
export const legalDenominators = (bpm: number = BPM) => divisors(360 / bpm);

/** The finest subdivision this tempo can express, in beats. */
export const finestStep = (bpm: number = BPM) => 1 / Math.max(...legalDenominators(bpm));

/**
 * The accent grid, DERIVED from what the tempo can legally express rather than
 * typed. At 120 this yields whole beats, triplets and bars - and deliberately
 * not the eighths and sixteenths an earlier version of this file offered, both
 * of which are off-frame at 30 fps.
 */
export const GRID: Record<string, number> = Object.fromEntries([
  ...legalDenominators().map((d) => [d === 1 ? "beat" : `1/${d}`, 1 / d] as const),
  ["bar", 4],
]);

/**
 * Snap a duration in beats to the nearest LEGAL subdivision.
 *
 * The default is the finest the tempo allows, so snapping can never move a
 * value onto a grid the frame rate cannot hit.
 */
export function snapBeats(b: number, grid: number = finestStep()): number {
  return Math.round(b / grid) * grid;
}

/** Is this duration on a frame boundary at every delivery rate? */
export function onGrid(b: number, bpm: number = BPM): boolean {
  return FPS_TARGETS.every((fps) => Number.isInteger(b * framesPerBeat(bpm, fps)));
}

/**
 * PRE-ROLL, and why it is not one number.
 *
 * Landing a visual 2-4 frames BEFORE the beat reads as correct; landing exactly
 * on the downbeat reads as late. The usual explanation - "the brain processes
 * visuals faster than audio" - is backwards: audio reaches cortex 30-50 ms
 * FASTER, which is precisely why the picture has to lead.
 *
 * But AV latency does not cover the size of it. Our own finding was measured at
 * 30 fps, so 2-4 frames is 67-133 ms, far more than the 30-50 ms gap. The
 * likely remainder is PERCEPTUAL ATTACK TIME: an event's perceived centre sits
 * later than its physical onset, and how much later depends on its rise time.
 *
 * So pre-roll is a property of the ACCENT'S ATTACK, not a global constant. A
 * percussive hit's centre is near its onset and needs little lead; a filtered
 * or soft accent's centre is tens of ms later and needs more.
 */
export const ACCENT_CLASSES = {
  transient: { label: "transient", preRollMs: 67, note: "A hard hit. Perceptual centre sits near the physical onset, so it needs the least lead." },
  soft: { label: "soft", preRollMs: 100, note: "A filtered or swelling accent. Its centre is later than its onset, so the picture leads further." },
  pad: { label: "pad", preRollMs: 133, note: "A slow rise with no attack to speak of. The most lead of the three." },
} as const;
export type AccentClass = keyof typeof ACCENT_CLASSES;

/** Pre-roll in seconds for an accent class. */
export const preRoll = (accent: AccentClass) => ACCENT_CLASSES[accent].preRollMs / 1000;

/**
 * When an effect assigned to `beat` should actually START, in seconds.
 *
 * The pre-roll is subtracted, never added, and clamped at zero so an effect on
 * beat 0 cannot be asked to begin before the piece exists.
 */
export function cueSeconds(beat: number, accent: AccentClass = "transient", bpm: number = BPM): number {
  return Math.max(0, beats(beat, bpm) - preRoll(accent));
}
