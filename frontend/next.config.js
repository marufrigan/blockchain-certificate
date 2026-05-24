/** @type {import('next').NextConfig} */
// Use 127.0.0.1 (not "localhost") so the Node server always hits IPv4; same fix as the browser.
const BACKEND = process.env.BACKEND_PROXY_URL || "http://127.0.0.1:4000";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
