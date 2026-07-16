import type { NextConfig } from "next";

// Files a Library PDF route's serverless function must carry: the bundled OTD
// fonts and the exported diagram rasters (public/ isn't traced by default). The
// PDF reads the committed `<name>.png` diagram directly (no runtime image codec),
// so there is no native binary to trace — sharp is gone from these routes.
const LIBRARY_PDF_TRACE = [
  "./src/lib/pdf/fonts/**",
  "./public/guide-diagrams/**",
];

const nextConfig: NextConfig = {
  // Partial Prerendering. Makes public-page DB reads a function of TIME (24/day at
  // hourly revalidation) instead of TRAFFIC. Enabling it is all-or-nothing: every
  // route-segment `dynamic`/`revalidate`/`runtime` export is rejected outright, so all
  // 57 came off in the same change (`runtime` is rejected too — the docs' removal list
  // is misleading and the compiler is the authority). Dynamic is the default here;
  // caching is opt-in via `use cache`. See docs/caching.md.
  cacheComponents: true,
  // Bundle the certificate fonts into the cert routes' serverless functions —
  // they're read from disk at render (react-pdf + satori), so Vercel's tracer
  // must include them or the routes 500 in prod.
  outputFileTracingIncludes: {
    "/learn/[slug]/certificate/[token]/pdf": ["./src/lib/pdf/fonts/**", "./src/lib/pdf/seal.png"],
    "/learn/[slug]/certificate/[token]/image": ["./src/lib/pdf/fonts/**", "./src/lib/pdf/seal.png"],
    // The Library PDFs read the bundled fonts + the exported diagram PNGs
    // (public/ is NOT bundled into serverless functions by default). Trace both
    // or these routes render text-only / 500 on a missing font.
    "/library/[slug]/pdf": LIBRARY_PDF_TRACE,
    "/library/field-guide/pdf": LIBRARY_PDF_TRACE,
    // Per-cluster Field Guide book — same fonts + diagram rasters as the combined
    // book, but a distinct dynamic path, so it needs its own tracing entry or it
    // 500s on a missing font in prod (dev masks it with on-disk files).
    "/library/field-guide/[cluster]/pdf": LIBRARY_PDF_TRACE,
    // The per-lesson OG social card reads the lesson's first diagram PNG from
    // public/guide-diagrams at render (@vercel/og, not react-pdf, so no fonts
    // needed). A dynamic (variable-name) fs read can't be nft-traced, so without
    // this the card silently drops its diagram to a text-only card in prod.
    "/library/[slug]/opengraph-image": ["./public/guide-diagrams/**"],
  },
  experimental: {
    serverActions: {
      allowedOrigins: process.env.VERCEL_URL
        ? [process.env.VERCEL_URL, "localhost:3000"]
        : ["localhost:3000"],
    },
  },
  async headers() {
    return [
      {
        // The calculator embed widgets are meant to be dropped into other sites
        // via <iframe>, so explicitly allow any origin to frame them. Nothing
        // else in the app sets X-Frame-Options, so every other route keeps the
        // browser default (frameable same-origin only is not enforced anywhere).
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

export default nextConfig;
