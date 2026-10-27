import type { NextConfig } from "next";
const rawBackendUrl = process.env.BACKEND_URL ?? "http://backend:8000";
const backendUrl = rawBackendUrl.replace(/\/+$/, "");

const config: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};
export default config;
