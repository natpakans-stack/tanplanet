import type { NextConfig } from 'next';
import path from 'path';

// served at tanplanet.work/hangun (rewritten from the tanplanet-index project)
const basePath = '/hangun';

const nextConfig: NextConfig = {
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // pin the workspace root (a stray lockfile in the home dir confuses inference)
  turbopack: { root: path.join(__dirname) },
  images: {
    // member photos / payment QR images are served from Supabase Storage
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  experimental: {
    // headroom for image uploads (client also compresses before sending)
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
