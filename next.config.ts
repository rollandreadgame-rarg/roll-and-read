import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  // The old Vercel address is still linked from earlier Stripe emails and
  // settings, but sign-in only works on the real domain. API routes are left
  // alone so webhooks that still point there keep working (they don't follow
  // redirects).
  async redirects() {
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "roll-and-read.vercel.app" }],
        destination: "https://rollandreadgame.com/:path",
        permanent: true,
      },
    ];
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
