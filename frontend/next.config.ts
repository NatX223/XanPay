import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  
  // 1. Add the ngrok host directly to the root of the config
  allowedDevOrigins: ['3a8f-105-117-11-244.ngrok-free.app'],

  // 2. Your existing iframe header exceptions
  async headers() {
    return [
      {
        source: "/connect-modal/:path*",
        headers: [
          { 
            key: "Content-Security-Policy", 
            value: "frame-ancestors *;" 
          },
          { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },
        ],
      },
    ];
  },
};

export default nextConfig;