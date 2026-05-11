// next.config.ts - CORRECT VERSION for Next.js 16
// import type { NextConfig } from 'next';

const nextConfig= {
  // ✅ React strict mode (optional)
  reactStrictMode: true,
  
  // ✅ Headers for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, HEAD, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Range, Content-Type' },
          { key: 'Access-Control-Expose-Headers', value: 'Content-Length, Content-Range, Accept-Ranges' },
          { key: 'Accept-Ranges', value: 'bytes' },
        ],
      },
    ];
  },
  
  // ✅ Required for Next.js 16 to silence Turbopack warning
  turbopack: {},
  
  // ✅ If you have Cloudinary images
  images: {
    domains: ['res.cloudinary.com'],
  },
     typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;