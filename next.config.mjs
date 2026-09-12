/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: '/bundle-lab',
  trailingSlash: true,
};

export default nextConfig;
