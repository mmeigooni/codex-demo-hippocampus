import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@ast-grep/napi"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
