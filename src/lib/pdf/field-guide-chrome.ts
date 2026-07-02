// Book-only "chrome" for the combined Field Guide PDF: the front-matter intro,
// the five part dividers, and the closing page + CTA. This is the ONLY field-
// guide content NOT compiled from live lesson contentBlocks, so it lives here in
// code (book-specific, rarely changes) rather than on the DB no-drift path.
//
// Voice: otd-content-writing house rules (no em-dashes; the `·` is the separator;
// answer-first; no "not X, it's Y" flourish). Disclosure: the academy surface is
// generic education only, so the CTA points to the course waitlist, never the
// paid-build recipe (OTD-AFE-001A values live in the gated L3.01 lesson only).

export type FieldGuidePart = {
  n: number;
  title: string;
  blurb: string;
  /** slug of the first lesson in this part; the divider renders just before it */
  startsAtSlug: string;
};

// The five narrative acts of the reading order (concept → signal → sensing →
// electronics → decode). Each divider renders inline before its first guide.
export const FIELD_GUIDE_PARTS: FieldGuidePart[] = [
  {
    n: 1,
    title: "Foundations",
    startsAtSlug: "what-is-a-bci",
    blurb:
      "What a brain-computer interface is, what EEG measures, and the whole build in one map.",
  },
  {
    n: 2,
    title: "The Signal",
    startsAtSlug: "eeg-frequency-bands",
    blurb:
      "EEG is many rhythms at once. Which ones carry intent, and how the mu rhythm reveals imagined movement.",
  },
  {
    n: 3,
    title: "Sensing",
    startsAtSlug: "eeg-electrodes-10-20-system",
    blurb:
      "Getting microvolts off the scalp. Where the electrodes go, and the safety rule that comes before everything else.",
  },
  {
    n: 4,
    title: "Electronics",
    startsAtSlug: "biopotential-afe",
    blurb:
      "The amplifier that makes microvolts measurable, the chip that folds the whole front-end into one part, and how you beat mains hum.",
  },
  {
    n: 5,
    title: "Decode & Payoff",
    startsAtSlug: "eeg-classification-csp-eegnet",
    blurb:
      "Turning a noisy window of signal into a command, and closing the loop on a real drone.",
  },
];

export const FIELD_GUIDE_INTRO = {
  eyebrow: "How to read this volume",
  title: "Start Here",
  paras: [
    "A brain-computer interface reads intent straight from the scalp and turns it into a command, with no muscles in the loop. Read non-invasively, that intent arrives as a few microvolts of EEG, buried under interference far larger than itself. Everything hard about building one follows from that.",
    "This volume is twelve reference guides that take the problem apart, ordered as one build: from what the signal is, through the electronics that pull it out of the noise, to turning it into a drone's next move.",
    "Read them front to back and each guide assumes the one before. Read them out of order and each still stands on its own, with cross-links at its foot to carry you sideways.",
    "The path runs in five parts: the foundations, the signal itself, sensing it off the head, the electronics that capture it, and turning it into a command.",
  ],
};

export const FIELD_GUIDE_OUTRO = {
  eyebrow: "Where this goes",
  title: "You Have The Map",
  paras: [
    "Twelve guides back, this started at what a brain signal is. Now the whole chain is yours: electrodes, a quiet front-end, an ADC, a filter, a classifier, a command. The map is done. The build is the good part.",
    "You build it a board at a time, and each one is a real instrument that works the day you finish it. A USB-C breakout that talks to your computer. A power module that cuts the cord. A precision ADC that reads microvolts off a sensor. A galvanic isolator that keeps a person safe. A front-end that picks a heartbeat out of the noise. Then the eight-channel EEG board this whole library is about.",
    "By the last one you are holding a brain-computer interface you designed and brought up yourself, made of parts you understand down to the register. It reads your own brainwaves off your own scalp.",
  ],
  cta: {
    label: "Start the first board",
    body: "It opens with the ESP32-S3 USB-C Breakout, the core board every project here is built on. Start there and the whole path opens from it.",
    href: "https://academy.onethousanddrones.com/courses/l1-01-wroom-breakout",
    hrefLabel: "academy.onethousanddrones.com/courses/l1-01-wroom-breakout",
    secondaryLabel: "See the whole path",
    secondaryHref: "https://academy.onethousanddrones.com/courses",
    secondaryHrefLabel: "academy.onethousanddrones.com/courses",
  },
};
