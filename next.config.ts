import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @arcgis/core requires transpilation
  transpilePackages: ["@arcgis/core"],
  // Allow ArcGIS thumbnail images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.arcgis.com",
      },
      {
        protocol: "https",
        hostname: "www.arcgis.com",
      },
    ],
  },
};

export default nextConfig;
