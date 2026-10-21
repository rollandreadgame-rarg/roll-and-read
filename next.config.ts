import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/api/webhooks/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        // Word/SFX audio: cache for a day so each spoken word doesn't
        // revalidate with the server. Not immutable — regenerated MP3s keep
        // their filenames, so updates still reach players within a day.
        source: "/audio/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
