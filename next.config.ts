import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@ast-grep/napi"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.githubusercontent.com",
      },
    ],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
