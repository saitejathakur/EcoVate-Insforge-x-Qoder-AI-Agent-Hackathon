import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output as standalone for server deployment
  output: 'standalone',
  
  // Ensure images work with external URLs
  images: {
    unoptimized: true,
  },
  
  // Environment variables available at build time
  env: {
    NEXT_PUBLIC_INSFORGE_URL: process.env.NEXT_PUBLIC_INSFORGE_URL,
    NEXT_PUBLIC_INSFORGE_ANON_KEY: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  },
};

export default nextConfig;
