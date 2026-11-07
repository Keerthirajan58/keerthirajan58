// Text as outlines. Every character is drawn from scripts/lib/glyphs.json: each glyph
// used in a document is defined once in <defs> (at 1000 units per em) and placed with
// <use>, so text renders identically everywhere without loading a font.
import fs from "node:fs";

const data = JSON.parse(
  fs.readFileSync(new URL("./glyphs.json", import.meta.url), "utf8"),
);
export const UNITS = data.units;
export const FONTS = data.fonts;

// Typographic characters that live data (titles, names) may contain, mapped to ones
// every font has.
const FALLBACK = {
  "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-",
  "—": "-", "…": "...", " ": " ", "−": "-",
};

const hex = (ch) => ch.codePointAt(0).toString(16);
const num = (n) => +n.toFixed(2);

/**
 * A text context for one SVG document: draw() returns markup and records the glyphs
 * used; defs() returns their <path> definitions for the document's <defs>.
 */
export function createText() {
  const used = new Map(); // id -> d

  function font(key) {
    const f = FONTS[key];
    if (!f) throw new Error(`Unknown font "${key}"`);
    return f;
  }

  /** Replaces characters a font lacks with a fallback, or throws for unknown ones. */
  function normalize(str, key, { strict = true } = {}) {
    const f = font(key);
    let out = "";
    for (const ch of String(str)) {
      if (f.glyphs[ch]) out += ch;
      else if (FALLBACK[ch] && [...FALLBACK[ch]].every((c) => f.glyphs[c])) out += FALLBACK[ch];
      else if (strict) throw new Error(`Font "${key}" has no glyph for "${ch}" (U+${hex(ch)}) in "${str}"`);
      else out += "?";
    }
    return out;
  }

  /** Width of a string in px at `size`, with optional tracking in em. */
  function measure(str, { font: key = "sans", size = 16, tracking = 0 } = {}) {
    const f = font(key);
    const s = normalize(str, key, { strict: false });
    let w = 0;
    let prev = null;
    for (const ch of s) {
      w += f.glyphs[ch].a + (prev ? f.kern[prev + ch] || 0 : 0) + tracking * UNITS;
      prev = ch;
    }
    if (s.length) w -= tracking * UNITS;
    return (w * size) / UNITS;
  }

  /** Shortens a string with an ellipsis until it fits `maxWidth`. */
  function fit(str, maxWidth, opts = {}) {
    let s = String(str);
    if (measure(s, opts) <= maxWidth) return s;
    while (s.length > 1 && measure(s + "…", opts) > maxWidth) s = s.slice(0, -1).trimEnd();
    return s + "…";
  }

  /**
   * Draws a single line of text. `y` is the baseline. Options:
   * font, size, fill, anchor ("start" | "middle" | "end"), tracking (em), opacity,
   * cls (class name, for CSS animation), strict (throw on missing glyphs; default true).
   */
  function draw(str, {
    x = 0, y = 0, font: key = "sans", size = 16, fill, anchor = "start",
    tracking = 0, opacity, cls, strict = true, attrs = "",
  } = {}) {
    const f = font(key);
    const s = normalize(str, key, { strict });
    const width = measure(s, { font: key, size, tracking });
    const x0 = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
    const scale = size / UNITS;
    let cursor = 0;
    let prev = null;
    const uses = [];
    for (const ch of s) {
      if (prev) cursor += f.kern[prev + ch] || 0;
      const g = f.glyphs[ch];
      if (g.d) {
        const id = f.prefix + hex(ch);
        used.set(id, g.d);
        uses.push(cursor ? `<use href="#${id}" x="${Math.round(cursor)}"/>` : `<use href="#${id}"/>`);
      }
      cursor += g.a + tracking * UNITS;
      prev = ch;
    }
    const a = [
      `transform="translate(${num(x0)} ${num(y)}) scale(${+scale.toFixed(5)})"`,
      fill ? `fill="${fill}"` : "",
      opacity != null ? `opacity="${opacity}"` : "",
      cls ? `class="${cls}"` : "",
      attrs,
    ].filter(Boolean).join(" ");
    return `<g ${a}>${uses.join("")}</g>`;
  }

  /** Font metrics in px at `size`: ascender, descender (negative), capHeight, xHeight. */
  function metrics(key, size) {
    const f = font(key);
    const k = size / UNITS;
    return { ascender: f.ascender * k, descender: f.descender * k, capHeight: f.capHeight * k, xHeight: f.xHeight * k };
  }

  function defs() {
    return [...used].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join("");
  }

  return { draw, measure, fit, metrics, normalize, defs };
}
