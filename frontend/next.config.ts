import type { NextConfig } from "next";

/**
 * Development-only API proxy (architecture §9): the Next.js dev server
 * forwards /api/* to the Go backend. The target is developer configuration
 * (default 127.0.0.1:8090 per server.bind/server.port) and is never a
 * browser input. Production (native packaging) serves the bundle from the
 * Go binary, which owns all /api/* routing.
 */
const DEV_API_TARGET = process.env.DASHBOARD_API_TARGET ?? "http://127.0.0.1:8090";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Production (native packaging) embeds a static bundle served by the Go
  // binary (architecture §9). `output: "export"` makes `next build` emit the
  // bundle to frontend/out/, which backend/build.sh copies into the Go embed
  // package. Static export is required because the binary is the only server
  // in production; there is no Next.js runtime. Rewrites below are
  // development-only (the dev server proxies /api/* to the Go backend).
  output: "export",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${DEV_API_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
