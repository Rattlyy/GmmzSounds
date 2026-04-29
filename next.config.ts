import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bun:sqlite", "music-tempo", "music-metadata"],
};

export default nextConfig;
