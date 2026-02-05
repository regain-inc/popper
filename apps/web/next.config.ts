import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@popper/core', '@popper/db', '@popper/server'],
  typedRoutes: true,
  output: 'standalone',
};

export default nextConfig;
