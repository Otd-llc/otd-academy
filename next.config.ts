import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle the certificate fonts into the cert routes' serverless functions —
  // they're read from disk at render (react-pdf + satori), so Vercel's tracer
  // must include them or the routes 500 in prod.
  outputFileTracingIncludes: {
    "/learn/[slug]/certificate/[token]/pdf": ["./src/lib/pdf/fonts/**", "./src/lib/pdf/seal.png"],
    "/learn/[slug]/certificate/[token]/image": ["./src/lib/pdf/fonts/**", "./src/lib/pdf/seal.png"],
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
