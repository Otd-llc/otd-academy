import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import {
  loadClusterByShareCode,
  type PublicCluster,
} from "@/lib/hex-cluster-load";

// The public record for one saved hex cluster — what a printed build sheet's
// QR points at.
//
// A 200 INTERSTITIAL, not a cached 307. Three reasons, each fatal to the
// redirect: plain `use cache` is an in-memory LRU that does not persist across
// serverless instances; redirect() throws and cannot be cached; and a 307 has
// no body, so "removed by its owner" and an OG card have nowhere to live.
//
// It renders the SUMMARY, because comparison is the entire verification story:
// a reader holding paper checks the drawing number, the revision, the name and
// the bill of materials against this page. Without the summary they have
// nothing to compare, and the printed number becomes a claim rather than a
// reference.
//
// noindex, and robots.ts disallows /c/ — WITH the trailing slash, since
// Disallow is a prefix match and bare /c would de-index /courses and /checkout.

export const metadata: Metadata = {
  title: "Saved build",
  robots: { index: false, follow: false },
};

const CONFIGURATOR = "https://demo.onethousanddrones.com/hex";

/** The §3 return link, in full. Omitting h= would make the identity check
 *  vacuous, so a recall from here would land silently in the unsaved regime and
 *  print UNCONTROLLED on a build that is saved. */
function openInConfigurator(c: PublicCluster): string {
  const url = new URL(CONFIGURATOR);
  url.searchParams.set("d", c.drawingLabel);
  url.searchParams.set("r", c.revLabel);
  url.searchParams.set("s", c.shareCode);
  url.searchParams.set("h", c.payloadHash);
  url.searchParams.set("n", c.nameAtSave);
  url.searchParams.set("t", c.savedAt);
  return `${url.toString()}#${c.payload}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">{children}</main>
  );
}

export default async function SharedClusterPage({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const { shareCode } = await params;
  const result = await loadClusterByShareCode(shareCode);

  if (result.outcome === "unknown-code") {
    return (
      <Shell>
        <PageHeader
          eyebrow="SAVED BUILD"
          title="No such drawing."
          lead="That link does not match a saved build. Check the code on the sheet."
        />
      </Shell>
    );
  }

  if (result.outcome === "archived") {
    return (
      <Shell>
        <PageHeader
          eyebrow="SAVED BUILD"
          title="Removed by its owner."
          lead="This drawing was archived. The sheet you are holding is still a record of what was built."
        />
      </Shell>
    );
  }

  const c = result.cluster;
  const s = c.summary;

  return (
    <Shell>
      <PageHeader
        eyebrow="SAVED BUILD"
        title={c.drawingLabel}
        lead={`Rev ${c.revLabel} · ${c.nameAtSave}`}
        meta={[
          { label: "Revision", value: c.revLabel },
          { label: "Saved", value: c.savedAt.slice(0, 10) },
          { label: "Cells", value: String(s?.cells ?? "·") },
          { label: "Pieces", value: String(s?.pieces ?? "·") },
        ]}
      />

      <section className="mt-8 border-t border-panel-border/60 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Envelope
        </p>
        <p className="mt-2 font-mono text-sm text-title">
          {s?.envelope
            ? `${s.envelope.mm.join(" × ")} mm  ·  ${s.envelope.in.join(" × ")} in`
            : "·"}
        </p>
      </section>

      <section className="mt-10 border-t border-panel-border/60 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Bill of materials
        </p>
        <table className="mt-3 w-full text-left">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              <th className="py-1 pr-3 font-normal">Item</th>
              <th className="py-1 pr-3 font-normal">Qty</th>
              <th className="py-1 pr-3 font-normal">Part</th>
              <th className="py-1 font-normal">X × Y × Z (mm)</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs text-title">
            {(s?.bom ?? []).map((line) => (
              <tr key={line.item} className="border-t border-panel-border/40">
                <td className="py-1.5 pr-3">{line.item}</td>
                <td className="py-1.5 pr-3">{line.qty}×</td>
                <td className="py-1.5 pr-3">{line.label}</td>
                {/* dims is stored null, never the print glyph — the page
                    renders the placeholder, the record keeps the null. */}
                <td className="py-1.5">{line.dims ?? "·"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 font-serif text-xs text-muted">
          {s?.caps ?? 0} caps · {s?.spikes ?? 0} spikes
        </p>
      </section>

      {result.outcome === "account-deleted" ? null : (
        <section className="mt-10 border-t border-panel-border/60 pt-6">
          <a
            href={openInConfigurator(c)}
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-command-gold underline underline-offset-4"
          >
            Open in the configurator
          </a>
        </section>
      )}
    </Shell>
  );
}
