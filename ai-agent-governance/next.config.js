/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // googleapis is a large CJS package that doesn't bundle cleanly through
    // webpack. Marking it as external tells Next.js to require() it at runtime
    // via Node.js instead of bundling it, which avoids the __webpack_require__.n error.
    // (Promoted to top-level serverExternalPackages in Next.js 15.)
    serverComponentsExternalPackages: ["googleapis", "google-auth-library"],
  },
};

module.exports = nextConfig;
