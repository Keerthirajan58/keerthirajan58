// Turns a photo and its subject mask into data/portrait.json: a small grid of brightness
// and coverage values that scripts/banner.mjs draws as dots.
// Dev-only (needs sharp):
//   mkdir -p .cache && swift scripts/mask.swift <photo.jpg> .cache/mask.png
//   npm run portrait -- <photo.jpg> .cache/mask.png
// The photo is the portfolio's contact photo; neither it nor the mask is committed.
import fs from "node:fs";
import sharp from "sharp";

const [photo, mask] = process.argv.slice(2);
if (!photo || !mask) throw new Error("Usage: node scripts/portrait.mjs <photo> <mask>");

// The cut-out is worked on at 800 px wide; the crop keeps head and shoulders, and the
// grid is fine enough for any dot pitch we use.
const WIDTH = 800;
const CROP = { left: 60, top: 50, width: 640, height: 720 };
const GRID = { cols: 160, rows: 180 };

// The subject on a transparent background: the photo with the mask as its alpha.
const { width, height } = await sharp(photo).metadata();
const rgb = await sharp(photo).removeAlpha().raw().toBuffer();
const coverage = await sharp(mask).resize(width, height).toColourspace("b-w").raw().toBuffer();
const pixels = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) {
  pixels[i * 4] = rgb[i * 3];
  pixels[i * 4 + 1] = rgb[i * 3 + 1];
  pixels[i * 4 + 2] = rgb[i * 3 + 2];
  pixels[i * 4 + 3] = coverage[i];
}
const cutout = await sharp(pixels, { raw: { width, height, channels: 4 } }).resize({ width: WIDTH }).png().toBuffer();

const crop = sharp(cutout).extract(CROP);
const rgba = await crop.clone().resize(GRID.cols, GRID.rows, { fit: "fill" }).ensureAlpha().raw().toBuffer();
// Brightness with local contrast, so the face reads in a few hundred dots.
const lum = await crop
  .clone()
  .flatten({ background: "#808080" })
  .greyscale()
  .clahe({ width: 48, height: 48, maxSlope: 3 })
  .resize(GRID.cols, GRID.rows, { fit: "fill" })
  .raw()
  .toBuffer();
const alpha = Buffer.alloc(GRID.cols * GRID.rows);
for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];

fs.writeFileSync(
  "data/portrait.json",
  JSON.stringify({
    width: WIDTH,
    crop: CROP,
    cols: GRID.cols,
    rows: GRID.rows,
    lum: Buffer.from(lum).toString("base64"),
    alpha: alpha.toString("base64"),
  }) + "\n",
);
console.log("wrote data/portrait.json", GRID.cols + "x" + GRID.rows);
