// SANDBOX - cut sheets for Library cluster explainers. DEV ONLY.
//
// A PLAIN MODULE, so a server component gets values rather than client refs.
//
// THIS IS THE WHOLE COST OF A NEW EXPLAINER. Four diagram basenames, four
// words, one payoff line. No rig, no capture, no three.js: every plate is a
// `.webp` this repo already exports and already ships to the image sitemap.
// Compare the beta film, which needed a gerber handoff rig, a signed-in exam
// capture and a certificate card before a single frame existed.
//
// THE ALT TEXT IS NOT WRITTEN HERE EITHER. It is lifted from
// diagram-export-manifest.json, which the exporter REFUSES to write without an
// aria-label, so every plate arrives with a caption already authored and
// already reviewed. That is 86 scripts nobody has to write.
//
// PICKING FOUR OUT OF TWELVE IS THE EDITORIAL ACT. The order below is a
// teaching order, not the registry's: what a volt is, then what it costs you in
// heat, then the two things you put on a rail because of that.
//
// ASCII only.

export type Beat = {
  /** Downbeat, seconds. 120 BPM, five bars, cues on 2/4/6/8. */
  at: number;
  src: string;
  /** One word, the way the film uses one word. */
  word: string;
  alt: string;
};

export type Cluster = {
  id: string;
  label: string;
  /** The line that lands where EARN's URL does. */
  payoff: string;
  beats: Beat[];
};

const d = (basename: string) => `/guide-diagrams/${basename}.webp`;

export const CLUSTERS: Cluster[] = [
  {
    id: "fundamentals",
    label: "Fundamentals",
    payoff: "academy.onethousanddrones.com/library",
    beats: [
      {
        at: 2.0,
        src: d("fund-vir-relationship"),
        word: "VOLTS",
        alt: "Voltage, current, and resistance drawn as a crowd at a doorway.",
      },
      {
        at: 4.0,
        src: d("fund-power-heat"),
        word: "HEAT",
        alt: "A resistor turning power into heat.",
      },
      {
        at: 6.0,
        src: d("fund-decoupling-cap"),
        word: "RAILS",
        alt: "Two supply-rail traces showing what a decoupling capacitor does.",
      },
      {
        at: 8.0,
        src: d("fund-schematic-anatomy"),
        word: "SYMBOLS",
        alt: "A key of common schematic symbols with their reference-designator letters.",
      },
    ],
  },
  {
    // A second sheet, to show the cost of another one is four lines.
    id: "comms",
    label: "Communication",
    payoff: "academy.onethousanddrones.com/library",
    beats: [
      { at: 2.0, src: d("comms-serial-vs-parallel"), word: "SERIAL", alt: "Serial against parallel data lines." },
      { at: 4.0, src: d("comms-uart-frame"), word: "FRAMES", alt: "A UART frame, start bit to stop bit." },
      { at: 6.0, src: d("comms-i2c-bus"), word: "BUSES", alt: "An I2C bus with its pull-ups and addressed devices." },
      { at: 8.0, src: d("comms-level-shift"), word: "LEVELS", alt: "Level shifting between a 5 V and a 3.3 V device." },
    ],
  },
];

export const byId = (id: string) => CLUSTERS.find((c) => c.id === id) ?? CLUSTERS[0];
