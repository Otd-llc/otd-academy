// Render a branded PDF from an OTD external-document markdown file.
//
//   pnpm tsx scripts/render-external-doc.tsx <in.md> <out.pdf>
//
// The generator (src/lib/pdf/external-doc-pdf.tsx) reuses the Field Guide house
// system, so the output matches the Library PDFs. Input docs live in the private
// out-of-tree store; this script only reads a path and writes a path. Confidential
// output still obeys the destination matrix (deliver by link, never email the PDF).
import { renderToBuffer } from "@react-pdf/renderer";
import { readFileSync, writeFileSync } from "node:fs";
import { registerLibraryFonts } from "@/lib/pdf/library-fonts";
import { parseExternalMarkdown, ExternalDocPdf } from "@/lib/pdf/external-doc-pdf";

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) {
  console.error("usage: pnpm tsx scripts/render-external-doc.tsx <in.md> <out.pdf>");
  process.exit(2);
}

async function main() {
  const md = readFileSync(inPath, "utf8");
  const doc = parseExternalMarkdown(md);
  registerLibraryFonts();
  const buffer = await renderToBuffer(<ExternalDocPdf doc={doc} />);
  writeFileSync(outPath, buffer);
  console.log(`rendered ${doc.classification} · ${doc.title}`);
  console.log(`  -> ${outPath} (${buffer.length} bytes, ${doc.blocks.length} blocks)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
