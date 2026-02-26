import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@popper/core', '@popper/auth', '@popper/server'],
  typedRoutes: true,
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
