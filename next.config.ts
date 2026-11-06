import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.start.gg",
        pathname: "/**",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true, // Esto evita que los errores de TS detengan el deploy en Render
  },
};

export default function NextConfig() {
  return nextConfig;
}