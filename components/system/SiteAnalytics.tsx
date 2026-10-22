"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Anonymous, cookieless page-view counts and page-speed measurements (Vercel).
// Query strings are dropped: sign-in links carry one-time tokens, and nothing
// else in a URL is needed to count a visit.
function stripQuery<T extends { url: string }>(event: T): T {
  return { ...event, url: event.url.split("?")[0].split("#")[0] };
}

export default function SiteAnalytics() {
  return (
    <>
      <Analytics beforeSend={stripQuery} />
      <SpeedInsights beforeSend={stripQuery} />
    </>
  );
}
