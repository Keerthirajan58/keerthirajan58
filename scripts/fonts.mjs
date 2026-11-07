// Turns the OFL fonts in scripts/fonts/ into scripts/lib/glyphs.json: one outline per
// character, plus advances and kerning. The SVGs draw text from these outlines, so they
// look the same in every browser and need no font loading (GitHub serves README images
// with a policy that blocks fonts). Dev-only: `npm run fonts` (needs opentype.js and the
// TTFs listed below, which are not committed; see scripts/fonts/SOURCES.md).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "fonts");

// key: [file, prefix used in SVG ids]
const FONTS = {
  mono: ["JetBrainsMono-Regular.ttf", "m"],
  monoBold: ["JetBrainsMono-Bold.ttf", "mb"],
  sans: ["Inter-Regular.ttf", "s"],
  sansSemi: ["Inter-SemiBold.ttf", "ss"],
  display: ["Unbounded-ExtraBold.ttf", "d"],
};

// Printable ASCII plus the few symbols the profile uses.
const EXTRA = "·—–→↗←↑↓●○◆✓✕×’‘“”…•é▸▪█▌≥≤±°%↻⏵";
const CHARS = [...new Set([...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)), ...EXTRA])];

const UNITS = 1000; // outlines are stored at 1000 units per em
const round = (n) => Math.round(n);

const out = { units: UNITS, fonts: {} };
for (const [key, [file, prefix]] of Object.entries(FONTS)) {
  const font = opentype.loadSync(path.join(dir, file));
  const k = UNITS / font.unitsPerEm;
  const glyphs = {};
  const missing = [];
  for (const ch of CHARS) {
    const g = font.charToGlyph(ch);
    if (!g || g.index === 0) {
      missing.push(ch);
      continue;
    }
    const p = g.getPath(0, 0, UNITS);
    // Integer coordinates at 1000 units/em are far below a pixel at any size we use.
    const d = p.commands
      .map((c) => {
        switch (c.type) {
          case "M": return `M${round(c.x)} ${round(c.y)}`;
          case "L": return `L${round(c.x)} ${round(c.y)}`;
          case "Q": return `Q${round(c.x1)} ${round(c.y1)} ${round(c.x)} ${round(c.y)}`;
          case "C": return `C${round(c.x1)} ${round(c.y1)} ${round(c.x2)} ${round(c.y2)} ${round(c.x)} ${round(c.y)}`;
          case "Z": return "Z";
          default: throw new Error(`Unknown path command ${c.type}`);
        }
      })
      .join("")
      .replace(/ -/g, "-");
    glyphs[ch] = { a: round(g.advanceWidth * k), d };
  }
  // Kerning pairs that differ from zero (proportional fonts only).
  const kern = {};
  if (!key.startsWith("mono")) {
    const present = Object.keys(glyphs);
    for (const l of present)
      for (const r of present) {
        const v = font.getKerningValue(font.charToGlyph(l), font.charToGlyph(r));
        if (v) kern[l + r] = round(v * k);
      }
  }
  out.fonts[key] = {
    prefix,
    ascender: round(font.ascender * k),
    descender: round(font.descender * k),
    capHeight: round((font.tables.os2?.sCapHeight ?? font.ascender * 0.7) * k),
    xHeight: round((font.tables.os2?.sxHeight ?? font.ascender * 0.5) * k),
    glyphs,
    kern,
  };
  console.log(`${key}: ${Object.keys(glyphs).length} glyphs, ${Object.keys(kern).length} kerning pairs` + (missing.length ? `, missing ${missing.join("")}` : ""));
}
fs.writeFileSync(path.join(here, "lib", "glyphs.json"), JSON.stringify(out));
console.log("wrote scripts/lib/glyphs.json", fs.statSync(path.join(here, "lib", "glyphs.json")).size, "bytes");
