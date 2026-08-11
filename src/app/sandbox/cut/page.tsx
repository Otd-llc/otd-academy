// SANDBOX — the full 10 s cut, scored. DEV ONLY.
import { notFound } from "next/navigation";
import { CutViewer, type CutKit } from "./CutViewer";

const KITS: CutKit[] = [
  { id: "bench", family: "Bench", title: "Bench", note: "Anvil carries it. A 125 kg Lokomo on 6 mm steel, a light switch on LEARN" },
  { id: "bench-arc", family: "Bench", title: "Arc", note: "An electrical arc rising into every landing instead of a reversed cymbal" },
  { id: "bench-shop", family: "Bench", title: "Shop", note: "A working shop. Drill and dropped metal tick between the landings" },
  { id: "bench-forge", family: "Bench", title: "Forge", note: "Heaviest. Anvil and plate layered, the hot-steel strike on EARN" },
  { id: "forge", family: "Hex family", title: "Taiko", note: "The Hex palette, for comparison. Same arrangement, struck skin instead of struck metal" },
  { id: "sparse", family: "Hex family", title: "Taiko sparse", note: "The Hex palette, minimal. Almost no kit between the landings" },
];

export default function CutSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ THE CUT · ten seconds, five bars, four words
      </p>
      <h1 className="title-section mt-3">The full loop</h1>

      <p className="mt-3 max-w-3xl font-serif text-base text-text">
        Picture and track together, so the timing can be judged instead of
        imagined. Every version below was muxed from ONE render of 300 frames, so
        switching kit changes only the audio and anything you hear differently is
        the arrangement rather than a re-render that drifted. Switching keeps
        your place and keeps playing.
      </p>
      <p className="mt-3 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Click a word on the grid to jump to its downbeat. Frame buttons step a
        thirtieth of a second.
      </p>

      <div className="mt-8">
        <CutViewer kits={KITS} />
      </div>

      <section className="mt-16 border-t border-alert-red/40 pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-alert-red">
          KNOWN WRONG, BEFORE YOU JUDGE IT
        </p>
        <ul className="mt-3 max-w-3xl border-t border-panel-border/60">
          {[
            [
              "EARN collides with the certificate",
              "The word sits in the top-left cell and the card is centred over it, clipping the hollow period. Either the card moves right and down, or EARN moves to a corner the card does not reach",
            ],
            [
              "The finish beats are stills, not motion",
              "LEARN and EARN were rebuilt from the two clean plates with a slow push-in, because the earlier clip carried browser chrome, the old radio-button exam, and a RE-TAKES ARE ALLOWED banner that spoiled the ending three bars early. The fanfare's own animation is not in here yet",
            ],
            [
              "The certificate does not rotate",
              "Still the one static element, as you flagged. It reads as a photograph pasted over the cut rather than an object in it",
            ],
            [
              "The spin is the old constant rate",
              "Parked deliberately until the beat exists. It exists now, so the whip can be placed against a downbeat rather than guessed",
            ],
            [
              "Bench Persona",
              "The certificate carries the test persona's name. Fine for judging layout, not for anything published",
            ],
          ].map(([what, why]) => (
            <li key={what} className="border-b border-panel-border/60 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-title">{what}</p>
              <p className="mt-1 font-serif text-sm text-muted">{why}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
