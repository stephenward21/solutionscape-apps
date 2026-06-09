/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["csv-parse", "xlsx", "jszip", "pdf-parse"],
  },
};

export default nextConfig;
