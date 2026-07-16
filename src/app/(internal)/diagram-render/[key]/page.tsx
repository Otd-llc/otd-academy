import { notFound } from "next/navigation";
import { resolveDiagramKey } from "./resolve";
import { DiagramChromeProvider } from "@/components/guide/diagrams/DiagramChrome";

// Dev/CI-only surface for the diagram exporter: renders exactly one diagram by
// basename, centered in the standard 36rem frame width, with global CSS applied
// so brand tokens resolve. 404s in production unless DIAGRAM_EXPORT is set.
// Reads searchParams, so it runs per request; under cacheComponents dynamic is the
// default and a route-segment config is rejected outright.

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
      {/* Export-only: neutralize the frame's query container so the raster always
          bakes the DESKTOP (wide) layout. In the guide `.dgfrm` keeps
          `container-type:inline-size` for real mobile/narrow-rail reflow; here the
          frame's content-box sits right at the diagrams' 520px `@container`
          breakpoint, which would otherwise tip every raster into its stacked mobile
          form. With no container context the `@container` rules never match and each
          diagram falls back to its desktop layout — the canonical raster for OG
          cards + the field-guide PDF. */}
      <style dangerouslySetInnerHTML={{ __html: "#diagram-export-root .dgfrm{container-type:normal!important}" }} />
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
