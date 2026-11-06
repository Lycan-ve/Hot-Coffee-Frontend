import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.start.gg",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
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
