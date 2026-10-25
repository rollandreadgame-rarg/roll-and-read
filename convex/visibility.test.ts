// Every exported Convex function is reachable by anyone who knows the
// deployment URL unless it is internal. This test pins the exact public
// surface so a new public function (or a dangerous one flipped to public) has
// to be reviewed and added here on purpose.
import { describe, expect, test } from "vitest";
import { modules } from "./test.setup";

const PUBLIC = new Set([
  "clientErrors:report",
  "clientErrors:recent", // maintenance-secret gated
  "gameSessions:save",
  "gameSessions:getForProfile",
  "maintenance:runDataFixes", // maintenance-secret gated
  "parentPin:setParentPin",
  "parentPin:verifyParentPin",
  "parentPin:changeParentPin",
  "parentPin:removeParentPin",
  "parentPin:resetParentPin",
  "profiles:getByUser",
  "profiles:get",
  "profiles:create",
  "profiles:update",
  "profiles:remove",
  "profiles:awardCoins",
  "profiles:spendCoins",
  "profiles:advanceLevel",
  "profiles:setLevel",
  "profiles:completedBoard",
  "profiles:startBoard",
  "shop:openPack",
  "stickersDb:getAll",
  "stickersDb:getForProfile",
  "stickersDb:awardStickerFromCategory",
  "subscriptions:getByClerkId",
  "subscriptions:setStripeCustomerId", // sync-secret gated
  "subscriptions:syncFromStripe", // sync-secret gated
  "subscriptions:canAccessLevel",
  "users:createUser",
  "users:getByClerkId",
  "users:markTeacherTourSeen",
  "users:updateEmailFromClerk", // sync-secret gated
  "wordBank:getForProfile",
  "wordBank:addWord",
  "wordBank:getTotalValue",
  "wordBank:getPracticeWords",
  "wordBank:getStats",
  "wordBank:markPracticed",
  "wordLists:getReviewPool",
  "wordLists:getForLevel",
  "wordLists:getForLevels",
]);

// Admin / seed / test-fixture functions: must never be callable from a browser.
const MUST_BE_INTERNAL = [
  "adminTesters:grantPlan",
  "adminTesters:revokeToFree",
  "adminTesters:listUsers",
  "adminStickers:removeLegacyStickers",
  "adminStickers:cleanStickerNames",
  "e2eSetup:ensureTestUser",
  "maintenance:inspectWords",
  "maintenance:purgeWords",
  "seedStickers:seedStickers",
  "seedStickersReal:seedStickersReal",
  "seedWordLists:seedWordLists",
];

type Registered = { isPublic?: boolean; isInternal?: boolean };

async function registeredFunctions() {
  const out = new Map<string, Registered>();
  for (const [path, load] of Object.entries(modules)) {
    if (path.includes("/_generated/")) continue;
    const name = path.replace(/^\.\//, "").replace(/\.[jt]s$/, "");
    const mod = (await load()) as Record<string, unknown>;
    for (const [exportName, value] of Object.entries(mod)) {
      if (typeof value !== "function" && typeof value !== "object") continue;
      const fn = value as Registered;
      if (fn && (fn.isPublic || fn.isInternal)) out.set(`${name}:${exportName}`, fn);
    }
  }
  return out;
}

describe("function visibility", () => {
  test("the public API is exactly the reviewed list", async () => {
    const fns = await registeredFunctions();
    const publicNames = [...fns].filter(([, f]) => f.isPublic).map(([n]) => n).sort();
    expect(publicNames).toEqual([...PUBLIC].sort());
  });

  test.each(MUST_BE_INTERNAL)("%s is internal", async (name) => {
    const fn = (await registeredFunctions()).get(name);
    expect(fn, `${name} not found`).toBeDefined();
    expect(fn?.isInternal).toBe(true);
    expect(fn?.isPublic).toBeFalsy();
  });
});
