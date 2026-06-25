// Fab-drawing frame: a sharp-cornered panel with corner fiducial marks and an
// optional monospace title-block strip, evoking a PCB fabrication drawing. The
// shared signature device for the marketing surfaces (/pricing, /briefs). Sharp
// corners are intentional: they read as an engineering drawing against the
// rounded glass-cards used elsewhere on the site.
import type { ReactNode } from "react";

// Four L-shaped corner registration marks, drawn just inside the frame edge.
function Fiducials() {
  const base = "pointer-events-none absolute h-2.5 w-2.5 border-command-gold";
  return (
    <>
      <span aria-hidden="true" className={`${base} left-1.5 top-1.5 border-l border-t`} />
      <span aria-hidden="true" className={`${base} right-1.5 top-1.5 border-r border-t`} />
      <span aria-hidden="true" className={`${base} bottom-1.5 left-1.5 border-b border-l`} />
      <span aria-hidden="true" className={`${base} bottom-1.5 right-1.5 border-b border-r`} />
    </>
  );
}

// The monospace title-block strip an engineering drawing carries: key/value
// fields separated by hairlines. Each field states something true.
export function TitleBlock({ fields }: { fields: [string, string][] }) {
  return (
    <dl className="flex flex-wrap items-stretch border-b border-panel-border font-mono text-[10px] uppercase tracking-[0.18em]">
      {fields.map(([k, v], i) => (
        <div
          key={k}
          className={`flex flex-col gap-0.5 px-4 py-2.5 ${
            i > 0 ? "border-l border-panel-border" : ""
          }`}
        >
          <dt className="text-muted">{k}</dt>
          <dd className="text-command-gold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DrawingFrame({
  title,
  children,
  className = "",
}: {
  title?: [string, string][];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative border border-command-gold/25 bg-bg-2/40 ${className}`}
    >
      <Fiducials />
      {title ? <TitleBlock fields={title} /> : null}
      {children}
    </div>
  );
}
