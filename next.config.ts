import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cbu01.alicdn.com" },
      { protocol: "https", hostname: "img.alicdn.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // Supabase Storage — for the product-images bucket where
      // imported products (Phase 15a / admin uploads) live.
      { protocol: "https", hostname: "xgudiwguopfxqiwofkuz.supabase.co" },
      // Pinduoduo CDN domains — fallback if the next/image
      // component is used directly on a remote Pinduoduo image.
      { protocol: "https", hostname: "pddpic.com" },
      { protocol: "https", hostname: "yangkeduo.com" },
      { protocol: "https", hostname: "taobaocdn.com" },
      { protocol: "https", hostname: "alicdn.com" },
    ],
  },
  // Redirects for the /ops → /admin migration (Phase 9).
  async redirects() {
    return [
      {
        source: "/ops",
        destination: "/admin",
        permanent: true,
      },
      {
        source: "/ops/:path*",
        destination: "/admin/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
