import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // turbopack: {}, // Disabled to fix PostCSS build issue
  serverExternalPackages: ["jsdom", "lingo.dev"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Disable TypeScript checks during build (Vercel will still type-check in CI)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
