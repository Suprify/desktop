/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: {
    unoptimized: true
  },
  serverRuntimeConfig: {
    port: 3333,
  },
};

export default nextConfig;
