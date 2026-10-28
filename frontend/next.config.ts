import type {NextConfig} from 'next';
const backendUrl = process.env.BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'https://whatsbridge-backend.onrender.com' : 'http://127.0.0.1:8001');
const config: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`
      }
    ];
  }
};
export default config;
