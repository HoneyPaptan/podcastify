import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  serverExternalPackages: ["jsdom", "lingo.dev"],
};

export default nextConfig;
