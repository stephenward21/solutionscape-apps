/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone output bundles everything needed to run Next.js without
  // node_modules present — required for Electron packaging via electron-builder.
  output: "standalone",

  experimental: {
    serverComponentsExternalPackages: [
      "googleapis",
      "google-auth-library",
      "pdf-parse",
      "mammoth",
    ],
  },
};

module.exports = nextConfig;
