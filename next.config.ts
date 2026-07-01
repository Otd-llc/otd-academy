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
