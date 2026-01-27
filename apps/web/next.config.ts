import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@popper/core', '@popper/db'],
  typedRoutes: true,
};

export default nextConfig;
