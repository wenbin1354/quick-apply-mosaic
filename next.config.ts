import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';
const isLocal = process.env.NEXT_PUBLIC_BASE_PATH === '';

const nextConfig: NextConfig = {
  ...(isProd && { 
    output: 'export',
    ...((!isLocal) && {
      basePath: '/quick-apply-mosaic',
      assetPrefix: '/quick-apply-mosaic/'
    })
  }),
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;
