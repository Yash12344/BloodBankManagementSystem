/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile shared workspace packages.
  transpilePackages: ["@bloodline/types", "@bloodline/ui"],
  // Proxy API calls to the backend during local dev.
  async rewrites() {
    const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";
    return [{ source: "/api/:path*", destination: `${apiBase}/api/:path*` }];
  },
};

export default nextConfig;
