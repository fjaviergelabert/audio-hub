/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: [
      "sharp",
      "onnxruntime-node",
      "@ffmpeg-installer/ffmpeg",
    ],
  },
};

export default nextConfig;
