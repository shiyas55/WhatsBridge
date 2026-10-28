import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "https://whatsbridge-backend.onrender.com/api/v1/:path*",
      },
      {
        source: "/api/:path*",
        destination: "https://whatsbridge-backend.onrender.com/api/:path*",
      },
      {
        source: "/baileys_qr",
        destination: "https://whatsbridge-backend.onrender.com/baileys_qr",
      },
    ];
  },
};

export default nextConfig;