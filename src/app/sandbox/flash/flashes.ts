// SANDBOX - CTA flash styles. DEV ONLY.
//
// A PLAIN MODULE. The table is pure data, but anything a server component
// imports from a "use client" file arrives as a client REFERENCE rather than a
// value, so the page could not map over it. Being serialisable is not enough;
// the file it lives in is what decides.
//
// ASCII only.

export type FlashStyle = {
  id: string;
  label: string;
  note: string;
  /** Keyframe body. Percentages are positions in a 1.75s loop. */
  frames: string;
};

/**
 * The two beats the box can hit after it settles: 9.0 and 9.5 of a cut whose
 * cue starts at 8.25, which over 1.75s is 42.9% and 71.4%.
 */
export const FLASHES: FlashStyle[] = [
  {
    id: "press",
    label: "Press",
    note: "The box depresses and releases, like the button it looks like. Hex's arrow is an ACTUATION; this is the same idea without borrowing its parts",
    frames: `
      40%{transform:none;background-color:transparent;border-color:var(--command-gold)}
      44%{transform:scale(.965);background-color:rgba(200,150,62,.22);border-color:var(--gold-light)}
      52%{transform:none;background-color:transparent;border-color:var(--command-gold)}
      69%{transform:none;background-color:transparent;border-color:var(--command-gold)}
      73%{transform:scale(.965);background-color:rgba(200,150,62,.22);border-color:var(--gold-light)}
      81%{transform:none;background-color:transparent;border-color:var(--command-gold)}`,
  },
  {
    id: "edge",
    label: "Edge only",
    note: "Just the hairline brightening. No wash, no movement. The most restrained thing that still reads as a flash",
    frames: `
      41%{border-color:var(--command-gold);color:var(--command-gold)}
      44%{border-color:var(--gold-light);color:var(--gold-light)}
      50%{border-color:var(--command-gold);color:var(--command-gold)}
      70%{border-color:var(--command-gold);color:var(--command-gold)}
      73%{border-color:var(--gold-light);color:var(--gold-light)}
      79%{border-color:var(--command-gold);color:var(--command-gold)}`,
  },
  {
    id: "fill",
    label: "Invert",
    note: "The box fills solid gold and the type knocks out to deep space. The loudest, and unmistakably a button",
    frames: `
      41%{background-color:transparent;color:var(--command-gold)}
      44%{background-color:var(--command-gold);color:#08090d}
      54%{background-color:var(--command-gold);color:#08090d}
      60%{background-color:transparent;color:var(--command-gold)}
      70%{background-color:transparent;color:var(--command-gold)}
      73%{background-color:var(--command-gold);color:#08090d}
      83%{background-color:var(--command-gold);color:#08090d}
      89%{background-color:transparent;color:var(--command-gold)}`,
  },
  {
    id: "sweep",
    label: "Sweep",
    note: "A bright band travels across the box. Reads as a scan rather than a hit, and never changes the resting colour",
    frames: `
      40%{background-position:-140% 0}
      56%{background-position:240% 0}
      69%{background-position:-140% 0}
      85%{background-position:240% 0}
      100%{background-position:240% 0}`,
  },
  {
    id: "blink",
    label: "Blink",
    note: "Two hard on-off pairs, a few frames each. Electrical rather than mechanical",
    frames: `
      41%{opacity:1}42%{opacity:.15}43.5%{opacity:1}45%{opacity:.15}46.5%{opacity:1}
      70%{opacity:1}71%{opacity:.15}72.5%{opacity:1}74%{opacity:.15}75.5%{opacity:1}`,
  },
  {
    id: "underline",
    label: "Underline",
    note: "A gold bar strikes beneath the box and fades. Leaves the box itself alone",
    frames: `
      40%{box-shadow:inset 0 -2px 0 -1px rgba(232,184,101,0)}
      44%{box-shadow:inset 0 -3px 0 0 rgba(232,184,101,1)}
      56%{box-shadow:inset 0 -3px 0 0 rgba(232,184,101,0)}
      69%{box-shadow:inset 0 -2px 0 -1px rgba(232,184,101,0)}
      73%{box-shadow:inset 0 -3px 0 0 rgba(232,184,101,1)}
      85%{box-shadow:inset 0 -3px 0 0 rgba(232,184,101,0)}`,
  },
  {
    id: "swell",
    label: "Swell",
    note: "A scale pulse with no colour change at all. The quietest option, and it survives being seen twenty times",
    frames: `
      40%{transform:none}
      45%{transform:scale(1.035)}
      54%{transform:none}
      69%{transform:none}
      74%{transform:scale(1.035)}
      83%{transform:none}`,
  },
  {
    id: "corners",
    label: "Halo tick",
    note: "A second frame springs outward and fades. Instrument-panel language rather than advertising",
    frames: `
      40%{outline-color:rgba(232,184,101,0);outline-offset:0px}
      44%{outline-color:rgba(232,184,101,1);outline-offset:4px}
      58%{outline-color:rgba(232,184,101,0);outline-offset:9px}
      69%{outline-color:rgba(232,184,101,0);outline-offset:0px}
      73%{outline-color:rgba(232,184,101,1);outline-offset:4px}
      87%{outline-color:rgba(232,184,101,0);outline-offset:9px}`,
  },
];
