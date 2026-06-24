"use client";

// Export-PDF affordance for the in-lesson BOM (BOM Sourcing). No separate page:
// a body-level print portal renders a clean WHITE parts sheet that is the ONLY
// thing that prints (everything else is hidden in @media print), so "Export BOM
// PDF" → the browser's Save-as-PDF gives a light, branded bench shopping sheet.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BrandMark } from "@/components/BrandMark";

export interface BomPdfRow {
  refDes: string;
  qty: number;
  mpn: string | null;
  manufacturer: string | null;
  description: string | null;
  lifecycle?: string | null;
}

// Print only the portal sheet, on white paper, with its accent colors intact, and
// never split a table row across a page break (the header repeats per page instead).
const PRINT_CSS =
  "@media print{@page{margin:14mm}html,body{background:#fff!important}" +
  "body>*:not(#bom-pdf-portal){display:none!important}" +
  "#bom-pdf-portal{display:block!important}" +
  "#bom-pdf-portal *{-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
  "#bom-pdf-portal thead{display:table-header-group}" +
  "#bom-pdf-portal tr{break-inside:avoid;page-break-inside:avoid}}";

export function BomPdfExport({
  title,
  revision,
  rows,
}: {
  title: string;
  revision: string;
  rows: BomPdfRow[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!rows.length) return null;
  const totalParts = rows.reduce((n, r) => n + (r.qty || 0), 0);

  const sheet = (
    <div id="bom-pdf-portal" className="hidden bg-white text-[#111] print:block">
      <div className="font-mono">
        <div className="mb-4 border-b-2 border-[#c8963e] pb-3">
          <div className="flex items-center gap-2">
            <BrandMark className="h-6 w-6 text-[#c8963e]" />
            <span className="font-display text-[13px] tracking-[0.22em] text-[#555]">
              OTD ACADEMY
            </span>
          </div>
          <div className="mt-2.5 font-display text-[26px] leading-none tracking-[0.06em] text-[#111]">
            {title}
          </div>
          <div className="mt-1 text-[11px] text-[#555]">
            Bill of Materials · Rev {revision} · {rows.length} line{rows.length === 1 ? "" : "s"} ·{" "}
            {totalParts} part{totalParts === 1 ? "" : "s"}
          </div>
        </div>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              {["Ref", "Qty", "Mfr Part No.", "Manufacturer", "Description"].map((h) => (
                <th
                  key={h}
                  className="border-b-[1.5px] border-[#111] px-2 py-1.5 text-left font-display text-[11px] font-normal uppercase tracking-[0.14em] text-[#8b6428]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="even:bg-[#f4f4f6]">
                <td className="border-b border-[#ddd] px-2 py-1.5 font-bold">{r.refDes}</td>
                <td className="border-b border-[#ddd] px-2 py-1.5">{r.qty}×</td>
                <td className="border-b border-[#ddd] px-2 py-1.5">
                  {r.mpn ?? "—"}
                  {r.lifecycle && r.lifecycle !== "ACTIVE" ? (
                    <span className="ml-1 font-bold text-[#c0392b]">({r.lifecycle})</span>
                  ) : null}
                </td>
                <td className="border-b border-[#ddd] px-2 py-1.5">{r.manufacturer ?? "—"}</td>
                <td className="border-b border-[#ddd] px-2 py-1.5 text-[#333]">
                  {r.description ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 border-t border-[#ccc] pt-2 text-[9px] leading-relaxed text-[#888]">
          One Thousand Drones Academy · academy.onethousanddrones.com · Auto-generated — verify
          availability &amp; specs against the datasheet before ordering.
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => window.print()}
        className="glass-button inline-flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.14em]"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        Export BOM PDF
      </button>
      {mounted
        ? createPortal(
            <>
              {sheet}
              <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
            </>,
            document.body,
          )
        : null}
    </>
  );
}
