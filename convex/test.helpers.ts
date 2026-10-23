/// <reference types="vite/client" />
// Shared fixtures for the convex-test suites. The extra dot in the file name
// keeps it out of Convex deploys and out of the `modules` glob.
import { convexTest, type TestConvex } from "convex-test";
import { vi } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";
import type { Doc, Id } from "./_generated/dataModel";
// Raw source, only to read the PUBLIC SHA-256 digests baked into it (a digest
// is not a credential). The real secrets are never read or embedded here.
import authHelpersSource from "./authHelpers.ts?raw";

export type T = TestConvex<typeof schema>;
type Plan = Doc<"users">["plan"];

export function setup(): T {
  return convexTest(schema, modules);
}

/** A signed-in client for the given Clerk user id. */
export function as(t: T, clerkId: string) {
  return t.withIdentity({ subject: clerkId });
}

export async function seedUser(
  t: T,
  clerkId: string,
  plan: Plan = "free",
  extra: Partial<Doc<"users">> = {}
): Promise<Id<"users">> {
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId,
      email: `${clerkId}@example.test`,
      plan,
      createdAt: 1,
      updatedAt: 1,
      ...extra,
    })
  );
}

export async function seedProfile(
  t: T,
  userId: Id<"users">,
  extra: Partial<Doc<"profiles">> = {}
): Promise<Id<"profiles">> {
  return await t.run((ctx) =>
    ctx.db.insert("profiles", {
      userId,
      name: "Kid",
      avatarEmoji: "🐱",
      currentLevel: "1A",
      boardsClearedAtLevel: 0,
      totalBoardsCleared: 0,
      coins: 0,
      lifetimeCoins: 0,
      streakDays: 0,
      accuracyHistory: [],
      wordMode: "mixed",
      hasSeenTutorial: false,
      selectedTheme: "ocean",
      createdAt: 1,
      ...extra,
    })
  );
}

/** A user + one profile, ready to call functions as. */
export async function seedFamily(
  t: T,
  clerkId: string,
  plan: Plan = "free",
  profile: Partial<Doc<"profiles">> = {}
) {
  const userId = await seedUser(t, clerkId, plan);
  const profileId = await seedProfile(t, userId, profile);
  return { userId, profileId, client: as(t, clerkId) };
}

const COIN_BY_LEVEL: Record<string, number> = { "1": 5, "2": 8, "3": 12, "4": 18, "5": 25 };

export async function seedWord(
  t: T,
  word: string,
  level: string,
  isNonsense = false
): Promise<Id<"word_lists">> {
  return await t.run((ctx) =>
    ctx.db.insert("word_lists", {
      word,
      isNonsense,
      level,
      levelNumber: Number(level[0]),
      coinValue: COIN_BY_LEVEL[level[0]] ?? 5,
      phonicFamily: "-x",
      phonicPattern: "test",
    })
  );
}

export async function seedSticker(
  t: T,
  name: string,
  rarity: Doc<"stickers">["rarity"] = "common",
  category = "animals"
): Promise<Id<"stickers">> {
  return await t.run((ctx) =>
    ctx.db.insert("stickers", {
      name,
      category,
      rarity,
      coinCost: 50,
      isAnimated: false,
      isPaidOnly: false,
      imageThumbUrl: `https://img.test/${name}.png`,
    })
  );
}

// ── Trusted-caller paths ────────────────────────────────────────────────────
// Server routes prove themselves with secrets whose SHA-256 is baked into
// authHelpers.ts. To exercise what happens AFTER that check without ever
// touching the real secrets, we make crypto.subtle.digest map two obviously
// fake strings onto those public digests. Every other input (PIN hashes, real
// secret checks with wrong values) still goes through the real digest.
export const TEST_SYNC_SECRET = "test-only-fake-sync-secret";
export const TEST_MAINTENANCE_SECRET = "test-only-fake-maintenance-secret";

function bakedDigest(name: string): string {
  const m = new RegExp(`${name}\\s*=\\s*"([0-9a-f]{64})"`).exec(authHelpersSource);
  if (!m) throw new Error(`Could not find ${name} in authHelpers.ts`);
  return m[1];
}

function hexToBuffer(hex: string): ArrayBuffer {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out.buffer;
}

export function installFakeTrustedSecrets() {
  const sync = hexToBuffer(bakedDigest("SYNC_SECRET_SHA256"));
  const maintenance = hexToBuffer(bakedDigest("MAINTENANCE_SECRET_SHA256"));
  const subtle = crypto.subtle;
  const realDigest = subtle.digest.bind(subtle);
  return vi
    .spyOn(subtle, "digest")
    .mockImplementation(async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
      const bytes = ArrayBuffer.isView(data)
        ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        : new Uint8Array(data);
      const text = new TextDecoder().decode(bytes);
      if (text === TEST_SYNC_SECRET) return sync.slice(0);
      if (text === TEST_MAINTENANCE_SECRET) return maintenance.slice(0);
      return realDigest(algorithm, data);
    });
}
