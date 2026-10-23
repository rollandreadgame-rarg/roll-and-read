import path from "node:path";
import dotenv from "dotenv";

export const AUTH_FILE = path.join(__dirname, ".auth", "dev-user.json");
export const ARTIFACTS_DIR = path.join(__dirname, "artifacts");

/** The dev Clerk user the suite signs in as (free plan, one reader "Dev"). */
export const DEV_USER_ID = "user_3L0caSepahTnACkQD3eBwNQz3hY";

/**
 * Reads .env.local into a private object (never into process.env and never
 * logged). Only the DEV keys are ever used by the suite.
 */
export function readEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  dotenv.config({ path: path.join(__dirname, "..", ".env.local"), processEnv: env, quiet: true });
  return env;
}

export const BASE_URL = "http://localhost:3000";
