import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 複数枚の写真（base64）をAPIに送るため上限を緩和
  experimental: {
    proxyClientMaxBodySize: "20mb",
  },
};

export default nextConfig;
