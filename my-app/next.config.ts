import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
      {
        source: '/availability',
        destination: 'http://localhost:3000/availability',
      },
    ];
  },
};

export default nextConfig;
