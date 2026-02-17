import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiBase = process.env.DRAFTED_API_BASE ?? "http://127.0.0.1:8000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiBase}/api/v1/:path*`,
      },
      {
        source: "/healthz",
        destination: `${apiBase}/healthz`,
      },
    ];
  },
};

export default nextConfig;
