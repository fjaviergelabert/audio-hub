/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "sharp",
      "onnxruntime-node",
      "@ffmpeg-installer/ffmpeg",
    ],
  },
};

export default nextConfig;
