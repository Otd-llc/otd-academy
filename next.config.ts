import type { NextConfig } from "next";

// Files a Library PDF route's serverless function must carry: the bundled fonts
// and the exported diagram rasters (public/ isn't traced by default). The `sharp`
// native binary is handled via serverExternalPackages below — do NOT glob it in
// from node_modules/.pnpm here: those are symlinked dirs and Vercel rejects the
// function package ("invalid deployment package ... symlinked directories").
const LIBRARY_PDF_TRACE = [
  "./src/lib/pdf/fonts/**",
  "./public/guide-diagrams/**",
];

const nextConfig: NextConfig = {
  // `sharp` is a NATIVE module (the Library PDF routes use it to transcode the
  // diagram WebP rasters to PNG for react-pdf). Keep it external so Node loads the
  // platform binary via require() at runtime instead of bundling it.
  serverExternalPackages: ["sharp"],
  // Bundle the certificate fonts into the cert routes' serverless functions —
  // they're read from disk at render (react-pdf + satori), so Vercel's tracer
  // must include them or the routes 500 in prod.
  outputFileTracingIncludes: {
    "/learn/[slug]/certificate/[token]/pdf": ["./src/lib/pdf/fonts/**", "./src/lib/pdf/seal.png"],
    "/learn/[slug]/certificate/[token]/image": ["./src/lib/pdf/fonts/**", "./src/lib/pdf/seal.png"],
    // The Library PDFs read the bundled fonts + the exported diagram rasters
    // (public/ is NOT bundled into serverless functions by default). sharp (the
    // WebP->PNG transcode) is external + lazily loaded, so a runtime load
    // failure degrades diagrams to caption-only instead of 500ing the route.
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
