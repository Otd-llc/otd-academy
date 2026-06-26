// Pre-generate the capability-brief PDFs as static files with WORKING links.
//
// Why static instead of the browser's "Download PDF" (window.print): on Windows,
// the "Microsoft Print to PDF" driver rasterizes the page and drops every <a>
// link annotation, so the CTA / academy / verify links die. Headless Chromium's
// page.pdf() embeds them, and serving the file as a direct download bypasses the
// user's print dialog entirely, so the links work in any viewer.
//
// The HTML brief (BriefDocument) stays the single source — this just renders it
// through print media. Re-run after changing a brief:
//   pnpm dev   (in another shell)         # or point BRIEF_PDF_BASE at prod
//   node scripts/generate-brief-pdfs.mjs
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BRIEF_PDF_BASE ?? "http://localhost:3001";
const KEYS = ["overview", "learner"]; // keep in sync with BRIEF_KEYS

const browser = await chromium.launch();
try {
  await mkdir("public/briefs", { recursive: true });
  for (const key of KEYS) {
    const page = await browser.newPage();
    await page.goto(`${BASE}/briefs/${key}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: `public/briefs/${key}.pdf`,
      preferCSSPageSize: true,
      printBackground: true,
    });
    await page.close();
    console.log(`wrote public/briefs/${key}.pdf`);
  }
} finally {
  await browser.close();
}
