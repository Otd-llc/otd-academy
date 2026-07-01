import type { NextConfig } from "next";

// Files a Library PDF route's serverless function must carry: the bundled fonts,
// the exported diagram rasters (public/ isn't traced by default), and the `sharp`
// native binary + libvips shared lib from the pnpm store (globbed across versions
// so a sharp bump doesn't silently drop the .so and 500 the route on Vercel).
const SHARP_TRACE = [
  "./src/lib/pdf/fonts/**",
  "./public/guide-diagrams/**",
  "./node_modules/.pnpm/sharp@**/**",
  "./node_modules/.pnpm/@img+sharp-linux-x64@**/**",
  "./node_modules/.pnpm/@img+sharp-libvips-linux-x64@**/**",
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
    // The Library PDFs read the bundled fonts, the exported diagram rasters
    // (public/ is NOT bundled into serverless functions by default), AND the
    // `sharp` native binary + its libvips shared lib (the tracer misses the
    // platform `.so`, so the route 500s with ERR_DLOPEN_FAILED on Vercel's
    // linux-x64 runtime). Trace all three or these routes 500 in prod.
    "/library/[slug]/pdf": SHARP_TRACE,
    "/library/field-guide/pdf": SHARP_TRACE,
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
