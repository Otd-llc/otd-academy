// Golden-reference operator panel for the Lesson Complete screen (WS5). Shows the
// derived golden verdict (published && vetted) + the three-deliverable "kit"
// worklist, with an inline freeze-exempt uploader for each admin-attachable leg
// (gerbers + measurements; the KiCad starter is generator-produced, surfaced as a
// present/missing indicator only). Admin-only. Mirrors BoardReadinessPanel.
import type {
  GoldenDeliverableKey,
  GoldenReference,
} from "@/lib/golden-reference";
import { ReferenceAssetAdmin } from "@/components/learn/ReferenceAssetAdmin";

// Which deliverables have a freeze-exempt admin uploader (the starter does not).
const UPLOAD_KIND: Record<
  GoldenDeliverableKey,
  "gerbers" | "measurements" | null
> = {
  kicadStarter: null,
  referenceGerbers: "gerbers",
  measurementsCsv: "measurements",
};

export function GoldenReferencePanel({
  golden,
  projectId,
  published,
}: {
  golden: GoldenReference;
  projectId: string;
  published: boolean;
}) {
  const verdict = golden.isGolden
    ? "✓ Golden reference"
    : published
      ? "Not golden yet. Needs vetted (real media everywhere + a brought-up board)"
      : "Not golden yet: not published";
  const kitCount = golden.bundle.filter((d) => d.present).length;

  return (
    <section className="w-full max-w-2xl border-t border-panel-border/60 pt-5 text-left">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-command-gold">
          ▸ Golden reference
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          admin · proven-kit handoff
        </span>
      </div>

      <div
        className={`mt-4 border-l-2 pl-4 ${
          golden.isGolden ? "border-status-green/60" : "border-panel-border"
        }`}
      >
        <span
          className={`font-mono text-xs font-bold uppercase tracking-[0.18em] ${
            golden.isGolden ? "text-status-green" : "text-muted"
          }`}
        >
          {verdict}
        </span>
        <p className="mt-1 font-serif text-xs italic text-muted">
          Golden = published &amp; vetted · kit {kitCount}/3 deliverables attached
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {golden.bundle.map((d) => {
          const uploadKind = UPLOAD_KIND[d.key];
          return (
            <li key={d.key} className="space-y-2">
              <div className="flex items-baseline gap-2 font-mono text-xs">
                <span
                  aria-hidden
                  className={`w-3 shrink-0 font-bold ${
                    d.present ? "text-status-green" : "text-muted"
                  }`}
                >
                  {d.present ? "✓" : "○"}
                </span>
                <span className="text-text">{d.label}</span>
                <span className="text-muted">
                  · {d.present ? "attached" : uploadKind ? "attach below" : "generate via the KiCad export flow"}
                </span>
              </div>
              {uploadKind ? (
                <ReferenceAssetAdmin
                  kind={uploadKind}
                  projectId={projectId}
                  hasAsset={d.present}
                  published={published}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
