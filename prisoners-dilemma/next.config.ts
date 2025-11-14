import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Polling-based multiplayer - no WebSockets needed
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
