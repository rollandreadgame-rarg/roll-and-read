import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

// Two kinds of tests:
// - "convex": backend functions run against an in-memory Convex (convex-test)
//   in the same edge runtime Convex uses.
// - "unit": plain Node for lib/, hooks, API routes and the middleware.
// Browser end-to-end tests live in e2e/ and run with Playwright, not here.
export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        extends: true,
        test: {
          name: "unit",
          include: ["{lib,app,hooks,components,tests}/**/*.test.{ts,tsx,mjs}"],
          environment: "node",
        },
      },
    ],
  },
});
