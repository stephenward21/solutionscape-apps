/** @type {import('next').NextConfig} */
const nextConfig = {
  // googleapis is a large CJS package that doesn't bundle cleanly through
  // webpack. Marking it as external tells Next.js to require() it at runtime
  // via Node.js instead of bundling it, which avoids the __webpack_require__.n error.
  serverExternalPackages: ["googleapis", "google-auth-library"],
};

module.exports = nextConfig;
