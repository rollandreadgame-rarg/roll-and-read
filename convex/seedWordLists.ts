// @ts-nocheck
import { mutation } from "./_generated/server";

// Level coin values
const COIN_VALUES: Record<number, number> = {
  1: 5,
  2: 8,
  3: 12,
  4: 18,
  5: 25,
};

interface WordEntry {
  word: string;
  isNonsense: boolean;
  level: string;
  levelNumber: number;
  coinValue: number;
  phonicFamily: string;
  phonicPattern: string;
}

const WORD_DATA: WordEntry[] = [
  // ─── LEVEL 1A — Short Vowels a/i + Basic Consonants ───
  { word: "bat", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-at", phonicPattern: "short-a" },
  { word: "cat", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-at", phonicPattern: "short-a" },
  { word: "fat", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-at", phonicPattern: "short-a" },
  { word: "hat", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-at", phonicPattern: "short-a" },
  { word: "mat", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-at", phonicPattern: "short-a" },
  { word: "rat", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-at", phonicPattern: "short-a" },
  { word: "sat", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-at", phonicPattern: "short-a" },
  { word: "tab", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ab", phonicPattern: "short-a" },
  { word: "cab", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ab", phonicPattern: "short-a" },
  { word: "jab", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ab", phonicPattern: "short-a" },
  { word: "map", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ap", phonicPattern: "short-a" },
  { word: "cap", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ap", phonicPattern: "short-a" },
  { word: "nap", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ap", phonicPattern: "short-a" },
  { word: "tap", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ap", phonicPattern: "short-a" },
  { word: "bit", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-it", phonicPattern: "short-i" },
  { word: "fit", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-it", phonicPattern: "short-i" },
  { word: "hit", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-it", phonicPattern: "short-i" },
  { word: "kit", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-it", phonicPattern: "short-i" },
  { word: "sit", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-it", phonicPattern: "short-i" },
  { word: "tip", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ip", phonicPattern: "short-i" },
  { word: "dip", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ip", phonicPattern: "short-i" },
  { word: "hip", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ip", phonicPattern: "short-i" },
  { word: "bin", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-in", phonicPattern: "short-i" },
  { word: "fin", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-in", phonicPattern: "short-i" },
  { word: "kin", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-in", phonicPattern: "short-i" },
  { word: "tin", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-in", phonicPattern: "short-i" },
  { word: "him", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-im", phonicPattern: "short-i" },
  { word: "dim", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-im", phonicPattern: "short-i" },
  { word: "rim", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-im", phonicPattern: "short-i" },
  { word: "big", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ig", phonicPattern: "short-i" },
  { word: "fig", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ig", phonicPattern: "short-i" },
  { word: "jig", isNonsense: false, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ig", phonicPattern: "short-i" },
  // 1A nonsense
  { word: "vat", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-at", phonicPattern: "short-a" },
  { word: "baf", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-af", phonicPattern: "short-a" },
  { word: "mab", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ab", phonicPattern: "short-a" },
  { word: "kap", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ap", phonicPattern: "short-a" },
  { word: "zat", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-at", phonicPattern: "short-a" },
  { word: "mib", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ib", phonicPattern: "short-i" },
  { word: "fip", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ip", phonicPattern: "short-i" },
  { word: "wib", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ib", phonicPattern: "short-i" },
  { word: "kip", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ip", phonicPattern: "short-i" },
  { word: "bim", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-im", phonicPattern: "short-i" },
  { word: "zit", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-it", phonicPattern: "short-i" },
  { word: "tig", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ig", phonicPattern: "short-i" },
  { word: "nig", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ig", phonicPattern: "short-i" },
  { word: "vip", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ip", phonicPattern: "short-i" },
  { word: "dilt", isNonsense: true, level: "1A", levelNumber: 1, coinValue: 5, phonicFamily: "-ilt", phonicPattern: "short-i" },

  // ─── LEVEL 1B — Short Vowels o/u/e ───
  { word: "dog", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-og", phonicPattern: "short-o" },
  { word: "fog", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-og", phonicPattern: "short-o" },
  { word: "log", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-og", phonicPattern: "short-o" },
  { word: "hog", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-og", phonicPattern: "short-o" },
  { word: "hot", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ot", phonicPattern: "short-o" },
  { word: "lot", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ot", phonicPattern: "short-o" },
  { word: "got", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ot", phonicPattern: "short-o" },
  { word: "not", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ot", phonicPattern: "short-o" },
  { word: "rod", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-od", phonicPattern: "short-o" },
  { word: "nod", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-od", phonicPattern: "short-o" },
  { word: "cod", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-od", phonicPattern: "short-o" },
  { word: "cup", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-up", phonicPattern: "short-u" },
  { word: "pup", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-up", phonicPattern: "short-u" },
  { word: "bud", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ud", phonicPattern: "short-u" },
  { word: "mud", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ud", phonicPattern: "short-u" },
  { word: "run", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-un", phonicPattern: "short-u" },
  { word: "sun", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-un", phonicPattern: "short-u" },
  { word: "fun", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-un", phonicPattern: "short-u" },
  { word: "bun", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-un", phonicPattern: "short-u" },
  { word: "hen", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-en", phonicPattern: "short-e" },
  { word: "ten", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-en", phonicPattern: "short-e" },
  { word: "men", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-en", phonicPattern: "short-e" },
  { word: "den", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-en", phonicPattern: "short-e" },
  { word: "bed", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ed", phonicPattern: "short-e" },
  { word: "red", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ed", phonicPattern: "short-e" },
  { word: "led", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ed", phonicPattern: "short-e" },
  { word: "fed", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ed", phonicPattern: "short-e" },
  { word: "leg", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-eg", phonicPattern: "short-e" },
  { word: "peg", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-eg", phonicPattern: "short-e" },
  { word: "web", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-eb", phonicPattern: "short-e" },
  { word: "yet", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-et", phonicPattern: "short-e" },
  { word: "get", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-et", phonicPattern: "short-e" },
  { word: "bet", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-et", phonicPattern: "short-e" },
  { word: "net", isNonsense: false, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-et", phonicPattern: "short-e" },
  // 1B nonsense
  { word: "fob", isNonsense: true, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ob", phonicPattern: "short-o" },
  { word: "vot", isNonsense: true, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ot", phonicPattern: "short-o" },
  { word: "zog", isNonsense: true, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-og", phonicPattern: "short-o" },
  { word: "fub", isNonsense: true, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ub", phonicPattern: "short-u" },
  { word: "zug", isNonsense: true, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ug", phonicPattern: "short-u" },
  { word: "mub", isNonsense: true, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ub", phonicPattern: "short-u" },
  { word: "feb", isNonsense: true, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-eb", phonicPattern: "short-e" },
  { word: "zem", isNonsense: true, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-em", phonicPattern: "short-e" },
  { word: "wep", isNonsense: true, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ep", phonicPattern: "short-e" },
  { word: "ked", isNonsense: true, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-ed", phonicPattern: "short-e" },
  { word: "veg", isNonsense: true, level: "1B", levelNumber: 1, coinValue: 5, phonicFamily: "-eg", phonicPattern: "short-e" },

  // ─── LEVEL 1C — Digraphs + Floss Rule ───
  { word: "chip", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "ch-ip", phonicPattern: "digraph-ch" },
  { word: "chin", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "ch-in", phonicPattern: "digraph-ch" },
  { word: "chat", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "ch-at", phonicPattern: "digraph-ch" },
  { word: "chop", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "ch-op", phonicPattern: "digraph-ch" },
  { word: "ship", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "sh-ip", phonicPattern: "digraph-sh" },
  { word: "shin", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "sh-in", phonicPattern: "digraph-sh" },
  { word: "shop", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "sh-op", phonicPattern: "digraph-sh" },
  { word: "shed", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "sh-ed", phonicPattern: "digraph-sh" },
  { word: "thin", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "th-in", phonicPattern: "digraph-th" },
  { word: "than", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "th-an", phonicPattern: "digraph-th" },
  { word: "that", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "th-at", phonicPattern: "digraph-th" },
  { word: "this", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "th-is", phonicPattern: "digraph-th" },
  { word: "then", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "th-en", phonicPattern: "digraph-th" },
  { word: "when", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "wh-en", phonicPattern: "digraph-wh" },
  { word: "whip", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "wh-ip", phonicPattern: "digraph-wh" },
  { word: "shall", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-all", phonicPattern: "floss-ll" },
  { word: "shell", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-ell", phonicPattern: "floss-ll" },
  { word: "chill", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-ill", phonicPattern: "floss-ll" },
  { word: "fill", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-ill", phonicPattern: "floss-ll" },
  { word: "hill", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-ill", phonicPattern: "floss-ll" },
  { word: "will", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-ill", phonicPattern: "floss-ll" },
  { word: "bill", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-ill", phonicPattern: "floss-ll" },
  { word: "bell", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-ell", phonicPattern: "floss-ll" },
  { word: "well", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-ell", phonicPattern: "floss-ll" },
  { word: "tell", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-ell", phonicPattern: "floss-ll" },
  { word: "fell", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-ell", phonicPattern: "floss-ll" },
  { word: "puff", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-uff", phonicPattern: "floss-ff" },
  { word: "buff", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-uff", phonicPattern: "floss-ff" },
  { word: "jazz", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-azz", phonicPattern: "floss-zz" },
  { word: "fizz", isNonsense: false, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-izz", phonicPattern: "floss-zz" },
  // 1C nonsense
  { word: "chiv", isNonsense: true, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "ch-iv", phonicPattern: "digraph-ch" },
  { word: "shup", isNonsense: true, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "sh-up", phonicPattern: "digraph-sh" },
  { word: "thef", isNonsense: true, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "th-ef", phonicPattern: "digraph-th" },
  { word: "whin", isNonsense: true, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "wh-in", phonicPattern: "digraph-wh" },
  { word: "chab", isNonsense: true, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "ch-ab", phonicPattern: "digraph-ch" },
  { word: "vell", isNonsense: true, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-ell", phonicPattern: "floss-ll" },
  { word: "ziff", isNonsense: true, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-iff", phonicPattern: "floss-ff" },
  { word: "fult", isNonsense: true, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "-ult", phonicPattern: "floss" },
  { word: "chelt", isNonsense: true, level: "1C", levelNumber: 1, coinValue: 5, phonicFamily: "ch-elt", phonicPattern: "digraph-ch" },

  // ─── Levels 1D through 5E follow the same pattern ───
  // Add entries for 1D (Blends: bl, cl, fl, gl, pl, sl),
  // 1E (Blends: br, cr, dr, fr, gr, pr, tr),
  // 1F (Short vowel review + CVC-e intro),
  // 2A (Long vowel a: a_e, ai, ay),
  // 2B (Long vowel e: ee, ea, e_e),
  // 2C (Long vowel i: i_e, igh, ie),
  // 2D (Long vowel o: o_e, oa, ow),
  // 2E (Long vowel u: u_e, ue, ew),
  // 2F (R-controlled vowels: ar, or, er, ir, ur),
  // 2G (Diphthongs: oi, oy, ou, ow),
  // 3A (Soft c/g, dge, tch),
  // 3B (Silent letters: kn, wr, gn, mb),
  // 3C (Prefixes: un-, re-, pre-, dis-),
  // 3D (Suffixes: -ing, -ed, -er, -est),
  // 3E (Compound words),
  // 3F (Multisyllabic words),
  // 4A-4D (Advanced patterns and multisyllabic),
  // 5A-5E (Academic vocabulary and complex patterns)
  // using the same WordEntry structure above.
];

export const seedWordLists = mutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let skipped = 0;

    for (const entry of WORD_DATA) {
      // Check if already exists
      const existing = await ctx.db
        .query("word_lists")
        .withIndex("by_level", (q) => q.eq("level", entry.level))
        .filter((q) => q.eq(q.field("word"), entry.word))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("word_lists", entry);
      inserted++;
    }

    return { inserted, skipped, total: WORD_DATA.length };
  },
});
