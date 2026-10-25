#!/usr/bin/env node
// Comp testers on the live site (no Stripe, no payment).
//
//   node scripts/testers.mjs list
//   node scripts/testers.mjs comp tester@example.com family     (individual | family | classroom)
//   node scripts/testers.mjs uncomp tester@example.com
//
// Add --dev to work on the dev deployment instead of production.
// Reads MAINTENANCE_SECRET and the deployment URL from .env.local; never prints them.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";

// convex/_generated/api.js is ESM in a CommonJS package; hide Node's notice about it.
process.removeAllListeners("warning");
const { api } = await import("../convex/_generated/api.js");

const env = readFileSync(fileURLToPath(new URL("../.env.local", import.meta.url)), "utf8");
const get = (k) => {
  const m = new RegExp(`^#?\\s*${k}=(.*)$`, "m").exec(env);
  return m ? m[1].trim().replace(/^"|"$/g, "") : null;
};

const args = process.argv.slice(2).filter((a) => a !== "--dev");
const dev = process.argv.includes("--dev");
const url = dev ? get("NEXT_PUBLIC_CONVEX_URL") : get("PROD_CONVEX_URL");
const maintenanceSecret = get("MAINTENANCE_SECRET");
if (!url || !maintenanceSecret) {
  console.error("Missing PROD_CONVEX_URL / NEXT_PUBLIC_CONVEX_URL or MAINTENANCE_SECRET in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(url);
const [command, email, plan] = args;
const PLANS = ["individual", "family", "classroom"];

try {
  if (command === "list") {
    const { count, users } = await client.query(api.adminTesters.listAccounts, { maintenanceSecret });
    console.log(`${count} accounts on ${dev ? "dev" : "production"}:`);
    for (const u of users) {
      const how = u.paying ? "pays through Stripe" : u.comped ? "comped" : u.plan === "free" ? "free" : u.status ?? "set by hand";
      console.log(`  ${u.email || "(no email)"}: ${u.plan}, ${how}, ${u.profiles} of ${u.profileLimit} readers`);
    }
  } else if (command === "comp" && email && PLANS.includes(plan)) {
    const r = await client.mutation(api.adminTesters.comp, { maintenanceSecret, email, plan });
    console.log(`Comped ${r.email} to ${r.plan} (up to ${r.profileLimit} readers, all levels).`);
  } else if (command === "uncomp" && email) {
    const r = await client.mutation(api.adminTesters.uncomp, { maintenanceSecret, email });
    console.log(`${r.email} is back on the free plan.`);
  } else {
    console.error("Usage: list | comp <email> <individual|family|classroom> | uncomp <email>  [--dev]");
    process.exit(1);
  }
} catch (e) {
  // Convex wraps thrown errors; show just our message.
  const msg = String(e?.data ?? e?.message ?? e).match(/Uncaught Error: (.*?)(\n|$)/)?.[1] ?? String(e?.message ?? e);
  console.error(msg);
  process.exit(1);
}
