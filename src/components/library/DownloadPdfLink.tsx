// The "share / download" affordance for the Library PDFs. The PDF is generated
// live from the same content the page renders, so this IS the shareable,
// always-current artifact (no separate export, no drift). PdfBuildButton owns the
// fresh-build wait: a spinner + a "built fresh, never stale, one moment" toast,
// then it opens the rendered PDF in a new tab.
//
// A gold-outline action (glass-button) — sanctioned for an action even on a
// content surface; the brand's gold ladder, restrained radius, mono label.
import { PdfBuildButton } from "./PdfBuildButton";

export function DownloadPdfLink({
  href,
  label,
  className = "",
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return <PdfBuildButton href={href} label={label} className={className} />;
}
