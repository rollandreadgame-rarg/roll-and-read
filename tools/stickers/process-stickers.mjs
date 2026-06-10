// tools/stickers/process-stickers.mjs
// For each manifest entry: render thumb(256) + full(512) WebP from the master
// SVG, upload both to R2, and emit convex/stickerData/stickers.json with public
// URLs. Idempotent: skips an upload if the object already exists.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true }); // node + dotenv loads .env by default; we need .env.local

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "out", "manifest.json"), "utf8"));

const {
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE,
} = process.env;
for (const [k, v] of Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE })) {
  if (!v) { console.error("Missing env:", k); process.exit(1); }
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function exists(key) {
  try { await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); return true; }
  catch { return false; }
}

async function renderAndUpload(sourceFile, key, size) {
  if (await exists(key)) return;
  const buf = await sharp(sourceFile, { density: 200 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 82 })
    .toBuffer();
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET, Key: key, Body: buf, ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
  }));
}

const out = [];
let done = 0, failed = 0;
for (const m of manifest) {
  const thumbKey = `stickers/${m.slug}_256.webp`;
  const fullKey = `stickers/${m.slug}_512.webp`;
  try {
    await renderAndUpload(m.sourceFile, thumbKey, 256);
    await renderAndUpload(m.sourceFile, fullKey, 512);
  } catch (e) {
    console.error("FAILED:", m.slug, e.message);
    failed++;
    continue;
  }
  out.push({
    name: m.name,
    category: m.category,
    subcategory: m.subcategory,
    rarity: m.rarity,
    description: m.description || "",
    imageThumbUrl: `${R2_PUBLIC_BASE}/${thumbKey}`,
    imageFullUrl: `${R2_PUBLIC_BASE}/${fullKey}`,
  });
  if (++done % 50 === 0) console.log(`${done}/${manifest.length}`);
}

const outPath = path.join(__dirname, "..", "..", "convex", "stickerData", "stickers.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${out.length} stickers (failed ${failed}) → ${outPath}`);
