// Pure builder for the Google image sitemap XML (separate from the route so it
// is unit-testable without the DB). Each <url> carries the page plus one
// <image:image> per diagram that appears on it.
export type SitemapImage = { loc: string; caption: string };
export type SitemapImagePage = { pageUrl: string; images: SitemapImage[] };

const esc = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!,
  );

export function buildImageSitemapXml(pages: SitemapImagePage[]): string {
  const body = pages
    .map(
      (p) =>
        `  <url>\n    <loc>${esc(p.pageUrl)}</loc>\n` +
        p.images
          .map(
            (i) =>
              `    <image:image>\n      <image:loc>${esc(i.loc)}</image:loc>\n      <image:caption>${esc(i.caption)}</image:caption>\n    </image:image>`,
          )
          .join("\n") +
        `\n  </url>`,
    )
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    `${body}\n</urlset>`
  );
}
