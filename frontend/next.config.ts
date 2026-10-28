/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'https://whatsbridge-backend.onrender.com/api/v1/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'https://whatsbridge-backend.onrender.com/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
// (If your file has "export default", change the last line to: export default nextConfig;)