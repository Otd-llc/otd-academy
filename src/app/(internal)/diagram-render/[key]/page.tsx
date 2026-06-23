import { notFound } from "next/navigation";
import { resolveDiagramKey } from "./resolve";

// Dev/CI-only surface for the diagram exporter: renders exactly one diagram by
// basename, centered in the standard 36rem frame width, with global CSS applied
// so brand tokens resolve. 404s in production unless DIAGRAM_EXPORT is set.
export const dynamic = "force-dynamic";

export default async function DiagramRenderPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  if (process.env.NODE_ENV === "production" && !process.env.DIAGRAM_EXPORT) {
    notFound();
  }
  const { key } = await params;
  const found = resolveDiagramKey(key);
  if (!found) notFound();
  const { Comp } = found;
  return (
    <main
      id="diagram-export-root"
      style={{ width: "min(36rem, 100%)", marginInline: "auto", padding: 16 }}
    >
      <Comp />
    </main>
  );
}
