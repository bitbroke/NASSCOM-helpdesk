import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["onnxruntime-node", "@xenova/transformers"],
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {}, // Silence webpack vs turbopack error
  webpack: (config) => {
    config.module.rules.push({
      test: /\.node$/,
      use: "raw-loader",
    });
    return config;
  }
};

export default nextConfig;
