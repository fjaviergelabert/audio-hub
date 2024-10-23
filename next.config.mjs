/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    config.module.rules.push({
      test: /\.worker\.ts$/,
      loader: "worker-loader",
      options: {
        filename: "static/[hash].worker.js",
        publicPath: "/_next/",
      },
    });

    return config;
  },
};

export default nextConfig;
