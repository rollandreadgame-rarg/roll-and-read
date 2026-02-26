/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as e2eSetup from "../e2eSetup.js";
import type * as gameSessions from "../gameSessions.js";
import type * as profiles from "../profiles.js";
import type * as seedStickers from "../seedStickers.js";
import type * as seedWordLists from "../seedWordLists.js";
import type * as stickersDb from "../stickersDb.js";
import type * as users from "../users.js";
import type * as wordBank from "../wordBank.js";
import type * as wordData_level1 from "../wordData/level1.js";
import type * as wordData_level2 from "../wordData/level2.js";
import type * as wordData_level3 from "../wordData/level3.js";
import type * as wordData_level4 from "../wordData/level4.js";
import type * as wordData_level5 from "../wordData/level5.js";
import type * as wordLists from "../wordLists.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  e2eSetup: typeof e2eSetup;
  gameSessions: typeof gameSessions;
  profiles: typeof profiles;
  seedStickers: typeof seedStickers;
  seedWordLists: typeof seedWordLists;
  stickersDb: typeof stickersDb;
  users: typeof users;
  wordBank: typeof wordBank;
  "wordData/level1": typeof wordData_level1;
  "wordData/level2": typeof wordData_level2;
  "wordData/level3": typeof wordData_level3;
  "wordData/level4": typeof wordData_level4;
  "wordData/level5": typeof wordData_level5;
  wordLists: typeof wordLists;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
