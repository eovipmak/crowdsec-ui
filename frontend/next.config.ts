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
