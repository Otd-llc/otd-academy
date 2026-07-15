import { notFound } from "next/navigation";
import { resolveDiagramKey } from "./resolve";
import { DiagramChromeProvider } from "@/components/guide/diagrams/DiagramChrome";

// Dev/CI-only surface for the diagram exporter: renders exactly one diagram by
// basename, centered in the standard 36rem frame width, with global CSS applied
// so brand tokens resolve. 404s in production unless DIAGRAM_EXPORT is set.
export const dynamic = "force-dynamic";

export default async function DiagramRenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ bare?: string }>;
}) {
  if (process.env.NODE_ENV === "production" && !process.env.DIAGRAM_EXPORT) {
    notFound();
  }
  const { key } = await params;
  const { bare } = await searchParams;
  const found = resolveDiagramKey(key);
  if (!found) notFound();
  const { Comp } = found;
  // `?bare=1` renders the stripped figure (frame + graphic, no title/eyebrow/
  // caption) — the exporter uses it for the Library PDF's `-light.png`, which the
  // in-lesson bare style should match. The dark webp (SEO/share) stays full.
  return (
    <main
      id="diagram-export-root"
      style={{ width: "min(36rem, 100%)", marginInline: "auto", padding: 16 }}
    >
      {bare ? (
        <DiagramChromeProvider bare fig={null}>
          <Comp />
        </DiagramChromeProvider>
      ) : (
        <Comp />
      )}
    </main>
  );
}
