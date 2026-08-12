// SANDBOX - cut sheets for Library cluster explainers. DEV ONLY.
//
// A PLAIN MODULE, so a server component gets values rather than client refs.
//
// THIS IS THE WHOLE COST OF A NEW EXPLAINER. Four diagram basenames, four terms,
// four one-liners. No rig, no capture: every plate is a component this repo
// already renders, and the reveal it already animates. Compare the beta film,
// which needed a gerber handoff rig, a signed-in exam capture and a certificate
// card before a single frame existed.
//
// PICKING FOUR OUT OF TWELVE IS THE EDITORIAL ACT, and the order is a teaching
// order rather than the registry's: what a volt is, then what it costs you in
// heat, then the two things you put on a rail because of that.
//
// `alt` IS LIFTED FROM diagram-export-manifest.json, not written here. The
// exporter refuses to run without an aria-label, so all 86 diagrams arrive with
// a reviewed sentence already attached.
//
// ASCII only.

/** Which treatment the type uses. See ClusterType. */
export type TextStyle = "word" | "term" | "caption";

export type Beat = {
  /** Downbeat, seconds. 120 BPM, five bars, cues on 2/4/6/8. */
  at: number;
  /** Registry basename. The component and the raster share it. */
  basename: string;
  /** One word, the way the film uses one word. */
  word: string;
  /** What it means, for the term treatment. One line, no hedging. */
  line: string;
  /** The diagram's own aria-label, for the caption treatment. */
  alt: string;
};

export type Cluster = {
  id: string;
  label: string;
  payoff: string;
  beats: Beat[];
};

export const CLUSTERS: Cluster[] = [
  {
    id: "fundamentals",
    label: "Fundamentals",
    payoff: "academy.onethousanddrones.com/library",
    beats: [
      {
        at: 2.0,
        basename: "fund-vir-relationship",
        word: "VOLTS",
        line: "Voltage pushes, resistance resists, and current is what gets through.",
        alt: "Voltage, current, and resistance drawn as a crowd at a doorway.",
      },
      {
        at: 4.0,
        basename: "fund-power-heat",
        word: "HEAT",
        line: "Every part you pick has a power rating, and that rating is a heat limit.",
        alt: "A resistor turning power into heat.",
      },
      {
        at: 6.0,
        basename: "fund-decoupling-cap",
        word: "RAILS",
        line: "A decoupling cap is the local reservoir a chip drinks from between gulps.",
        alt: "Two supply-rail traces showing what a decoupling capacitor does.",
      },
      {
        at: 8.0,
        basename: "fund-schematic-anatomy",
        word: "SYMBOLS",
        line: "Every symbol carries a reference designator, and that letter tells you the part.",
        alt: "A key of common schematic symbols with their reference-designator letters.",
      },
    ],
  },
  {
    // A second sheet, only to show the second one costs the same as the first.
    id: "comms",
    label: "Communication",
    payoff: "academy.onethousanddrones.com/library",
    beats: [
      {
        at: 2.0,
        basename: "comms-serial-vs-parallel",
        word: "SERIAL",
        line: "One wire, one bit at a time, and far fewer traces to route.",
        alt: "Serial against parallel data lines.",
      },
      {
        at: 4.0,
        basename: "comms-uart-frame",
        word: "FRAMES",
        line: "A start bit, your data, a stop bit. That frame is the whole agreement.",
        alt: "A UART frame, start bit to stop bit.",
      },
      {
        at: 6.0,
        basename: "comms-i2c-bus",
        word: "BUSES",
        line: "Two wires, many devices, each answering to its own address.",
        alt: "An I2C bus with its pull-ups and addressed devices.",
      },
      {
        at: 8.0,
        basename: "comms-level-shift",
        word: "LEVELS",
        line: "A 5 V part talking to a 3.3 V part needs something in between, or it damages it.",
        alt: "Level shifting between a 5 V and a 3.3 V device.",
      },
    ],
  },
];

export const byId = (id: string) => CLUSTERS.find((c) => c.id === id) ?? CLUSTERS[0];
