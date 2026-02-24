// @ts-nocheck
import { mutation } from "./_generated/server";

const STICKERS = [
  // Animals - Common - Free tier
  { name: "Cat", category: "animals", rarity: "common" as const, emoji: "🐱", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Dog", category: "animals", rarity: "common" as const, emoji: "🐶", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Rabbit", category: "animals", rarity: "common" as const, emoji: "🐰", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Bear", category: "animals", rarity: "common" as const, emoji: "🐻", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Fox", category: "animals", rarity: "common" as const, emoji: "🦊", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Wolf", category: "animals", rarity: "common" as const, emoji: "🐺", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Deer", category: "animals", rarity: "common" as const, emoji: "🦌", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Frog", category: "animals", rarity: "common" as const, emoji: "🐸", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Duck", category: "animals", rarity: "common" as const, emoji: "🦆", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Owl", category: "animals", rarity: "uncommon" as const, emoji: "🦉", coinCost: 100, isAnimated: false, isPaidOnly: false },
  { name: "Penguin", category: "animals", rarity: "uncommon" as const, emoji: "🐧", coinCost: 100, isAnimated: false, isPaidOnly: false },
  { name: "Horse", category: "animals", rarity: "uncommon" as const, emoji: "🐴", coinCost: 100, isAnimated: false, isPaidOnly: false },
  { name: "Lion", category: "animals", rarity: "rare" as const, emoji: "🦁", coinCost: 200, isAnimated: false, isPaidOnly: false },
  { name: "Tiger", category: "animals", rarity: "rare" as const, emoji: "🐯", coinCost: 200, isAnimated: false, isPaidOnly: false },
  { name: "Elephant", category: "animals", rarity: "rare" as const, emoji: "🐘", coinCost: 200, isAnimated: false, isPaidOnly: false },
  { name: "Giraffe", category: "animals", rarity: "rare" as const, emoji: "🦒", coinCost: 200, isAnimated: false, isPaidOnly: false },
  { name: "Panda", category: "animals", rarity: "rare" as const, emoji: "🐼", coinCost: 200, isAnimated: false, isPaidOnly: false },
  { name: "Koala", category: "animals", rarity: "legendary" as const, emoji: "🐨", coinCost: 500, isAnimated: true, isPaidOnly: false },
  { name: "Kangaroo", category: "animals", rarity: "legendary" as const, emoji: "🦘", coinCost: 500, isAnimated: true, isPaidOnly: false },
  { name: "Hamster", category: "animals", rarity: "legendary" as const, emoji: "🐹", coinCost: 500, isAnimated: true, isPaidOnly: false },
  // Space - Common - Free tier
  { name: "Rocket", category: "space", rarity: "common" as const, emoji: "🚀", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Planet", category: "space", rarity: "common" as const, emoji: "🪐", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Star", category: "space", rarity: "common" as const, emoji: "⭐", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Moon", category: "space", rarity: "common" as const, emoji: "🌙", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Comet", category: "space", rarity: "common" as const, emoji: "☄️", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Satellite", category: "space", rarity: "common" as const, emoji: "🛸", coinCost: 50, isAnimated: false, isPaidOnly: false },
  { name: "Alien", category: "space", rarity: "uncommon" as const, emoji: "👽", coinCost: 100, isAnimated: false, isPaidOnly: false },
  { name: "Astronaut", category: "space", rarity: "uncommon" as const, emoji: "👨‍🚀", coinCost: 100, isAnimated: false, isPaidOnly: false },
  { name: "Galaxy", category: "space", rarity: "rare" as const, emoji: "🌌", coinCost: 200, isAnimated: false, isPaidOnly: false },
  { name: "Black Hole", category: "space", rarity: "legendary" as const, emoji: "🕳️", coinCost: 500, isAnimated: true, isPaidOnly: false },
  // Ocean - Uncommon - Paid
  { name: "Dolphin", category: "ocean", rarity: "uncommon" as const, emoji: "🐬", coinCost: 100, isAnimated: false, isPaidOnly: true },
  { name: "Whale", category: "ocean", rarity: "uncommon" as const, emoji: "🐋", coinCost: 100, isAnimated: false, isPaidOnly: true },
  { name: "Octopus", category: "ocean", rarity: "uncommon" as const, emoji: "🐙", coinCost: 100, isAnimated: false, isPaidOnly: true },
  { name: "Crab", category: "ocean", rarity: "uncommon" as const, emoji: "🦀", coinCost: 100, isAnimated: false, isPaidOnly: true },
  { name: "Starfish", category: "ocean", rarity: "uncommon" as const, emoji: "⭐", coinCost: 100, isAnimated: false, isPaidOnly: true },
  { name: "Seahorse", category: "ocean", rarity: "rare" as const, emoji: "🦄", coinCost: 200, isAnimated: false, isPaidOnly: true },
  { name: "Turtle", category: "ocean", rarity: "rare" as const, emoji: "🐢", coinCost: 200, isAnimated: false, isPaidOnly: true },
  { name: "Shark", category: "ocean", rarity: "rare" as const, emoji: "🦈", coinCost: 200, isAnimated: false, isPaidOnly: true },
  { name: "Jellyfish", category: "ocean", rarity: "rare" as const, emoji: "🪼", coinCost: 200, isAnimated: false, isPaidOnly: true },
  { name: "Narwhal", category: "ocean", rarity: "legendary" as const, emoji: "🦄", coinCost: 500, isAnimated: true, isPaidOnly: true },
  // Fantasy - Paid
  { name: "Dragon", category: "fantasy", rarity: "rare" as const, emoji: "🐉", coinCost: 200, isAnimated: false, isPaidOnly: true },
  { name: "Wizard", category: "fantasy", rarity: "uncommon" as const, emoji: "🧙", coinCost: 100, isAnimated: false, isPaidOnly: true },
  { name: "Fairy", category: "fantasy", rarity: "uncommon" as const, emoji: "🧚", coinCost: 100, isAnimated: false, isPaidOnly: true },
  { name: "Unicorn", category: "fantasy", rarity: "rare" as const, emoji: "🦄", coinCost: 200, isAnimated: false, isPaidOnly: true },
  { name: "Phoenix", category: "fantasy", rarity: "legendary" as const, emoji: "🔥", coinCost: 500, isAnimated: true, isPaidOnly: true },
  // Characters - Paid only - Legendary
  { name: "Reading Ranger", category: "characters", rarity: "legendary" as const, emoji: "🦸", coinCost: 500, isAnimated: true, isPaidOnly: true },
  { name: "Word Wizard", category: "characters", rarity: "legendary" as const, emoji: "🧙‍♂️", coinCost: 500, isAnimated: true, isPaidOnly: true },
  { name: "Phonics Phoenix", category: "characters", rarity: "legendary" as const, emoji: "🦅", coinCost: 500, isAnimated: true, isPaidOnly: true },
  { name: "Decode Dragon", category: "characters", rarity: "legendary" as const, emoji: "🐲", coinCost: 500, isAnimated: true, isPaidOnly: true },
  { name: "Literacy Legend", category: "characters", rarity: "legendary" as const, emoji: "📚", coinCost: 500, isAnimated: true, isPaidOnly: true },
];

export const seedStickers = mutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let skipped = 0;

    for (const sticker of STICKERS) {
      const existing = await ctx.db
        .query("stickers")
        .withIndex("by_category", (q) => q.eq("category", sticker.category))
        .filter((q) => q.eq(q.field("name"), sticker.name))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("stickers", sticker);
      inserted++;
    }

    return { inserted, skipped };
  },
});
