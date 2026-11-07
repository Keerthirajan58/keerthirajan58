// Signals: two charts on one sheet, redrawn every week from live data.
// Left, "Work by area" (profile.focus.title): a radar of how many of my roles and projects
// (profile.focus.items) involve each area (profile.focus.areas). Right, "Languages": each
// language's share of code averaged over my public repositories, each counting equally
// (live.languages), the top five plus "Other", as a thin segmented bar above a list that
// names every part and gives its share. outputs() also gives both as Markdown (live.md).
//
// Two layouts share one sheet, as in the Open source image (scripts/pulse.mjs). The wide
// one above is the default. When the image is shown narrower than BREAKPOINT css px (a
// phone), a media query swaps in a compact layout whose text stays readable there: the
// areas as rows with a bar each, the largest count first, and the top three languages plus
// "Other" under their own bar. Renderers without CSS keep the wide layout.
import { createText } from "./lib/text.mjs";
import { svgDoc, rect, n } from "./lib/svg.mjs";
import { dayDate } from "./lib/dates.mjs";

const W = 1000;
const H = 440;
const PAD = 32;
const SPLIT = 584; // the radar's panel is wider: its side labels need the room
const BREAKPOINT = 700; // css px: the banner's, so the full-width images change layout together

// The compact layout. The image shows about 308 px wide on a 390 px phone, so 30 units is
// about 9.2 px there; no text goes below 30 units. Its divider sits further left than
// the wide one: "Jupyter Notebook" and its share need 412 units, "Agents & tool use" and
// a bar less.
const PHONE = {
  split: 524,
  edge: 40, // sheet edge to the titles' cap tops, and the last baseline to the bottom edge
  title: 34,
  text: 30,
  titleGap: 44, // title baseline to the first row's cap top
  pitch: 56, // most room between row baselines
  minPitch: 44, // least; a longer list of areas ends with "+N more"
  accent: 6, // area bar thickness
  bar: 14, // language bar thickness
  barGap: 4,
  langs: 3, // languages named; the rest fold into "Other"
};

// Language colours: a categorical palette, stepped per mode and checked against this sheet's
// canvas for contrast and colour-blind separation. Colour follows the language, never its
// rank.
const HUES = {
  light: { blue: "#2a78d6", orange: "#eb6834", aqua: "#1baf7a", yellow: "#eda100", magenta: "#e87ba4", green: "#008300", violet: "#6250d6", red: "#e34948" },
  dark: { blue: "#3987e5", orange: "#d95926", aqua: "#199e70", yellow: "#c98500", magenta: "#d55181", green: "#008300", violet: "#9085e9", red: "#e66767" },
};
const LANGUAGE_HUE = {
  Python: "blue", "Jupyter Notebook": "orange", TypeScript: "violet", JavaScript: "yellow",
  Dart: "aqua", Go: "aqua", Kotlin: "violet", "C++": "magenta", CSS: "magenta", SCSS: "magenta",
  Java: "red", HTML: "red", Rust: "red", Ruby: "red", Swift: "red", Svelte: "red",
  Shell: "green", "C#": "green", Vue: "green", Cython: "yellow", PHP: "violet",
};
// When a language cannot keep its colour, it takes the first of these that fits: the
// hues fewest common languages claim come first.
const FALLBACK = ["green", "magenta", "aqua", "violet", "yellow", "orange", "red", "blue"];
// Colour pairs too close to tell apart in light or dark mode (normal-vision ΔE < 15 or
// colour-blind ΔE < 6, OKLab ×100). They never touch in the bar.
// "neutral" is the gray of "Other" and of languages without a colour of their own.
const CLASH = new Set([
  "blue:violet", "orange:yellow", "magenta:orange", "green:orange", "orange:red",
  "aqua:magenta", "aqua:green", "red:yellow", "magenta:red", "neutral:neutral",
]);

const hexMix = (fg, bg, a) =>
  "#" + [1, 3, 5].map((i) => {
    const f = parseInt(fg.slice(i, i + 2), 16);
    const b = parseInt(bg.slice(i, i + 2), 16);
    return Math.round(b + (f - b) * a).toString(16).padStart(2, "0");
  }).join("");

// ---------------------------------------------------------------- data

function focusData(focus) {
  const items = focus.items || [];
  const list = Array.isArray(focus.areas) ? focus.areas : [];
  const ids = new Set(list.map((a) => a.id));
  const areas = list.map((a) => ({
    label: a.label,
    count: items.filter((it) => (it.areas || []).includes(a.id)).length,
  }));
  if (areas.length < 3) throw new Error("signals: profile.focus.areas needs at least 3 areas for a radar");
  const max = Math.max(0, ...areas.map((a) => a.count));
  let step = 2; // rings sit at even counts; at most five of them
  while (Math.ceil(max / step) > 5) step *= 2;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const shared = items.some((it) => (it.areas || []).filter((id) => ids.has(id)).length > 1);
  const note = `${items.length} ${items.length === 1 ? "role or project" : "roles and projects"}${shared ? " · some cover several areas" : ""}`;
  // The compact layout lists the areas by count, largest first; ties keep the radar's order.
  const ranked = areas.map((a, i) => ({ ...a, i })).sort((a, b) => b.count - a.count || a.i - b.i);
  return { title: focus.title, subtitle: focus.subtitle, areas, ranked, step, top, note, items: items.length, shared };
}

/** The top `keep` languages and "Other", or every language when at most keep + 1 exist. */
function fold(all, keep, total) {
  const shown = all.length <= keep + 1 ? all : all.slice(0, keep);
  const rest = all.slice(shown.length);
  const parts = shown.map((l) => ({ name: l.name, share: l.value / total }));
  if (rest.length)
    parts.push({ name: "Other", other: true, count: rest.length, share: rest.reduce((s, l) => s + l.value, 0) / total });
  return parts;
}

function languageData(languages) {
  const weight = (l) => (+l.bytes > 0 ? +l.bytes : Math.max(0, +l.share || 0));
  const all = (languages?.list || [])
    .filter((l) => l && l.name)
    .map((l) => ({ name: String(l.name), value: weight(l) }))
    .filter((l) => l.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const total = all.reduce((s, l) => s + l.value, 0);
  return { parts: fold(all, 5, total), phone: fold(all, PHONE.langs, total), count: all.length, repos: languages?.repos };
}

/** Keeps each language's own colour where it can, the largest first, while no two parts
 * share a hue and no clashing pair sits side by side. A language with a colour of its own
 * turns gray only when nothing else fits. `prefer` (name → hue) overrides the own colours:
 * the compact bar passes the wide bar's choices, so a language looks the same in both. */
function assignColours(parts, prefer = {}) {
  const own = parts.map((p) => (p.other ? "neutral" : prefer[p.name] || LANGUAGE_HUE[p.name] || "neutral"));
  const key = (a, b) => [a, b].sort().join(":");
  const pick = [];
  let best = null;
  let bestCost = Infinity;
  (function walk(i, cost) {
    if (cost >= bestCost) return;
    if (i === parts.length) { best = [...pick]; bestCost = cost; return; }
    const options = parts[i].other ? ["neutral"] : [own[i], ...FALLBACK.filter((h) => h !== own[i]), "neutral"];
    for (const c of options) {
      if (c !== "neutral" && pick.includes(c)) continue;
      if (i && CLASH.has(key(pick[i - 1], c))) continue;
      const change = c === own[i] ? 0 : c === "neutral" ? 2 ** (parts.length + 2) : 2 ** (parts.length - i);
      pick.push(c);
      walk(i + 1, cost + change);
      pick.pop();
    }
  })(0, 0);
  return best || own;
}

const pct = (s) => {
  const v = s * 100;
  return v > 0 && v < 0.05 ? "<0.1%" : `${v.toFixed(1)}%`;
};

/** "Nov 6, 2026" in the owner's time zone, like the Open source image, so both show the same day. */
function updated(iso, timeZone) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return null;
  return dayDate(d, timeZone);
}

/** A sentence-case title as it reads inside a sentence ("Work by area" → "work by area"). */
const inSentence = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

// ---------------------------------------------------------------- drawing helpers

/** Draws runs of text with different fonts and colours as one line. Data text is drawn
 * leniently: a character the fonts lack shows as "?" instead of failing the weekly run. */
function runs(tx, parts, { x, y, anchor = "start" }) {
  const widths = parts.map((p) => tx.measure(p.str, p));
  const w = widths.reduce((a, b) => a + b, 0);
  let cx = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  return parts.map((p, i) => {
    const out = tx.draw(p.str, { ...p, x: cx, y, strict: false });
    cx += widths[i];
    return out;
  }).join("");
}
const runsWidth = (tx, parts) => parts.reduce((a, p) => a + tx.measure(p.str, p), 0);

/** Data text in characters the fonts have: an accented letter the font lacks loses its
 * accent ("É" → "E"); anything else unknown becomes "?". */
function plain(tx, str, font) {
  const has = (ch) => tx.normalize(ch, font, { strict: false }) !== "?" || ch === "?";
  return [...String(str ?? "")].map((ch) => {
    if (has(ch)) return ch;
    const base = ch.normalize("NFD").replace(/\p{M}/gu, "");
    return base && [...base].every(has) ? base : "?";
  }).join("");
}

/** A thin segmented bar: parts side by side with `gap` of canvas between them, fully
 * rounded ends, no text. A part never gets narrower than `min`; the largest pays for it. */
function segmentedBar(parts, colours, { x, y, w, h, gap, min, id }) {
  const gaps = gap * (parts.length - 1);
  let widths = parts.map((p) => p.share * (w - gaps));
  const short = widths.reduce((s, v) => s + Math.max(0, min - v), 0);
  if (short > 0) {
    const big = widths.indexOf(Math.max(...widths));
    widths = widths.map((v, i) => (i === big ? v - short : Math.max(min, v)));
  }
  let bx = x;
  const segs = widths.map((v, i) => {
    const s = rect({ x: bx, y, w: v, h, fill: colours[i] });
    bx += v + gap;
    return s;
  }).join("");
  return `<clipPath id="${id}">${rect({ x, y, w, h, r: h / 2 })}</clipPath><g clip-path="url(#${id})">${segs}</g>`;
}

function barColours(t, names) {
  const hues = HUES[t.mode];
  const neutral = hexMix(t.muted, t.canvas, 0.4);
  return names.map((c) => (c === "neutral" ? neutral : hues[c]));
}

// ---------------------------------------------------------------- focus map (radar)

const LABEL = 15; // axis label size
const GAP = 14; // outer ring → axis label

/** An axis label as one or two lines no wider than maxW, ending with its count. */
function labelLines(tx, t, raw, count, maxW) {
  const font = { font: "sans", size: LABEL };
  const label = plain(tx, raw, "sans");
  const name = (str) => ({ str, ...font, fill: t.textSoft });
  const tail = [{ str: " · ", ...font, fill: t.muted }, { str: String(count), font: "sansSemi", size: LABEL, fill: t.text }];
  const tailW = runsWidth(tx, tail);
  const w = (s) => tx.measure(s, font);
  if (w(label) + tailW <= maxW) return [[name(label), ...tail]];
  const words = label.split(" ");
  let first = words[0];
  let k = 1;
  while (k < words.length && w(`${first} ${words[k]}`) <= maxW) first += ` ${words[k++]}`;
  const rest = words.slice(k).join(" ");
  if (!rest) return [[name(tx.fit(label, maxW - tailW, font)), ...tail]];
  return [[name(tx.fit(first, maxW, font))], [name(tx.fit(rest, maxW - tailW, font)), ...tail]];
}

function radarLabels(tx, t, areas, maxW, boxW) {
  const N = areas.length;
  return areas.map((a, i) => {
    const th = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const anchor = Math.abs(c) < 0.2 ? "middle" : c > 0 ? "start" : "end";
    // Labels above and below the radar cost height, not width: they stay on one line.
    const lines = labelLines(tx, t, a.label, a.count, anchor === "middle" ? boxW : maxW);
    return { th, c, s, anchor, lines, w: Math.max(...lines.map((l) => runsWidth(tx, l))) };
  });
}

function radarGeometry(tx, labels, box) {
  const m = tx.metrics("sans", LABEL);
  const cap = m.capHeight;
  const desc = -m.descender;
  const lh = LABEL + 5;
  const place = (L, R) => {
    const px = (R + GAP) * L.c;
    const py = (R + GAP) * L.s;
    const bh = cap + (L.lines.length - 1) * lh;
    const top = py - (bh * (1 - L.s)) / 2;
    const x0 = L.anchor === "start" ? px : L.anchor === "end" ? px - L.w : px - L.w / 2;
    return { px, top, x0, bh };
  };
  const extent = (R) => {
    let l = -R, r = R, t = -R, b = R;
    for (const L of labels) {
      const p = place(L, R);
      l = Math.min(l, p.x0);
      r = Math.max(r, p.x0 + L.w);
      t = Math.min(t, p.top);
      b = Math.max(b, p.top + p.bh + desc);
    }
    return { l, r, t, b };
  };
  let lo = 30;
  let hi = 200;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    const e = extent(mid);
    if (e.r - e.l <= box.x1 - box.x0 && e.b - e.t <= box.y1 - box.y0) lo = mid;
    else hi = mid;
  }
  const R = Math.floor(lo);
  const e = extent(R);
  const cx = box.x0 + (box.x1 - box.x0 - (e.r - e.l)) / 2 - e.l;
  const cy = box.y0 + (box.y1 - box.y0 - (e.b - e.t)) / 2 - e.t;
  return { R, cx, cy, cap, lh, place };
}

function focusPanel(tx, t, focus, box) {
  // Labels stay on one line while the radar keeps a useful size; long ones wrap.
  let labels;
  let g;
  for (const maxW of [Infinity, 150, 124, 100]) {
    const L = radarLabels(tx, t, focus.areas, maxW, box.x1 - box.x0);
    const G = radarGeometry(tx, L, box);
    if (!g || G.R > g.R) [labels, g] = [L, G];
    if (G.R >= 100) { [labels, g] = [L, G]; break; }
  }
  const { R, cx, cy, cap, lh } = g;
  const rings = [];
  for (let v = focus.step; v <= focus.top; v += focus.step) rings.push((R * v) / focus.top);
  const at = (th, r) => [cx + r * Math.cos(th), cy + r * Math.sin(th)];
  const verts = focus.areas.map((a, i) => at(labels[i].th, (R * a.count) / focus.top));

  const out = [];
  const title = plain(tx, focus.title, "sansSemi");
  const subtitle = plain(tx, focus.subtitle, "sans");
  out.push(tx.draw(tx.fit(title, box.x1 - box.x0, { font: "sansSemi", size: 22 }), { x: box.x0, y: PAD + 16, font: "sansSemi", size: 22, fill: t.text, strict: false }));
  if (subtitle) out.push(tx.draw(tx.fit(subtitle, box.x1 - box.x0, { font: "sans", size: 15 }), { x: box.x0, y: PAD + 38, font: "sans", size: 15, fill: t.muted, strict: false }));

  // Grid: rings and spokes, hairline and recessive; the outer ring one step stronger. The
  // rings carry no values: every axis label states its count.
  out.push(`<g fill="none" stroke="${t.line}" stroke-width="1">`);
  out.push(rings.map((r, i) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"${i === rings.length - 1 ? ` stroke="${t.lineStrong}"` : ""}/>`).join(""));
  out.push(labels.map((L) => `<path d="M${n(cx)} ${n(cy)}L${at(L.th, R).map(n).join(" ")}"/>`).join("") + "</g>");

  // The data: one series in the accent.
  const d = verts.map(([x, y], i) => `${i ? "L" : "M"}${n(x)} ${n(y)}`).join("") + "Z";
  out.push(`<path d="${d}" fill="${t.accent}" fill-opacity="0.11" stroke="${t.accent}" stroke-width="2" stroke-linejoin="round"/>`);
  out.push(verts.map(([x, y]) => `<circle cx="${n(x)}" cy="${n(y)}" r="5" fill="${t.accent}" stroke="${t.canvas}" stroke-width="2"/>`).join(""));

  // Axis labels: area name and count.
  labels.forEach((L) => {
    const p = g.place(L, R);
    L.lines.forEach((line, k) => {
      const y = cy + p.top + cap + k * lh;
      out.push(runs(tx, line, { x: cx + p.px, y, anchor: L.anchor }));
    });
  });

  out.push(tx.draw(tx.fit(focus.note, box.x1 - box.x0, { font: "mono", size: 13 }), { x: box.x0, y: H - PAD, font: "mono", size: 13, fill: t.muted }));
  return out.join("");
}

// ---------------------------------------------------------------- languages

function languagesPanel(tx, t, langs, meta, colours, box) {
  const out = [];
  const x0 = box.x0;
  const x1 = box.x1;
  out.push(tx.draw("Languages", { x: x0, y: PAD + 16, font: "sansSemi", size: 22, fill: t.text }));
  out.push(tx.draw("Average share of code per public repo", { x: x0, y: PAD + 38, font: "sans", size: 15, fill: t.muted }));

  const foot = [meta.updated && `Updated ${meta.updated}`, Number.isFinite(+langs.repos) && langs.repos > 0 && `${langs.repos} repositories`].filter(Boolean).join(" · ");
  if (foot) out.push(tx.draw(tx.fit(foot, x1 - x0, { font: "mono", size: 13 }), { x: x0, y: H - PAD, font: "mono", size: 13, fill: t.muted }));

  const { parts } = langs;
  if (!parts.length) {
    out.push(tx.draw("No language data this week", { x: x0, y: box.y0 + 40, font: "sans", size: 15, fill: t.muted }));
    return out.join("");
  }

  // Thin segmented bar: 8 tall, fully rounded ends, 2 of canvas between parts, no text.
  const barY = box.y0 + 4;
  out.push(segmentedBar(parts, colours, { x: x0, y: barY, w: x1 - x0, h: 8, gap: 2, min: 4, id: "sg-bar" }));

  // The list: swatch, name, share.
  const size = 15;
  const cap = tx.metrics("sans", size).capHeight;
  const pitch = 44;
  const first = barY + 8 + 36;
  parts.forEach((p, i) => {
    const y = first + i * pitch;
    const mid = y - cap / 2;
    if (i) out.push(`<path d="M${x0} ${n(mid - pitch / 2) + 0.5}H${x1}" stroke="${t.line}"/>`);
    out.push(rect({ x: x0, y: mid - 4, w: 16, h: 8, r: 4, fill: colours[i] }));
    const share = pct(p.share);
    const shareW = tx.measure(share, { font: "mono", size });
    const nameX = x0 + 28;
    const space = x1 - shareW - 16 - nameX;
    const name = tx.fit(plain(tx, p.name, "sans"), space, { font: "sans", size });
    out.push(tx.draw(name, { x: nameX, y, font: "sans", size, fill: t.text, strict: false }));
    if (p.other) {
      const more = `${p.count} ${p.count === 1 ? "language" : "languages"}`;
      const mx = nameX + tx.measure(name, { font: "sans", size }) + 8;
      if (mx + tx.measure(more, { font: "sans", size }) <= x1 - shareW - 16)
        out.push(tx.draw(more, { x: mx, y, font: "sans", size, fill: t.muted }));
    }
    out.push(tx.draw(share, { x: x1, y, font: "mono", size, fill: t.text, anchor: "end" }));
  });
  return out.join("");
}

// ---------------------------------------------------------------- compact layout (phones)

/** The vertical grid both compact panels share: the titles' baseline, then one baseline
 * per area row (a longer list of areas ends with a "+N more" row). */
function phoneGrid(tx, areas) {
  const title = PHONE.edge + tx.metrics("sansSemi", PHONE.title).capHeight;
  const first = title + PHONE.titleGap + tx.metrics("sans", PHONE.text).capHeight;
  const last = H - PHONE.edge;
  const room = 1 + Math.floor((last - first) / PHONE.minPitch);
  const shown = areas <= room ? areas : room - 1;
  const lines = shown + (areas > shown ? 1 : 0);
  const pitch = lines > 1 ? Math.min(PHONE.pitch, (last - first) / (lines - 1)) : 0;
  const rows = Array.from({ length: lines }, (_, k) => first + k * pitch);
  return { title, rows, shown, pitch, mid: tx.metrics("sans", PHONE.text).capHeight / 2 };
}

/** Left: one row per area (name, an accent bar from a shared baseline, the count at its
 * tip), the largest count first. */
function focusPhone(tx, t, focus, box, grid) {
  const size = PHONE.text;
  const font = { font: "sans", size };
  const num = { font: "sansSemi", size };
  const out = [];
  const title = plain(tx, focus.title, "sansSemi");
  out.push(tx.draw(tx.fit(title, box.x1 - box.x0, { font: "sansSemi", size: PHONE.title }), { x: box.x0, y: grid.title, font: "sansSemi", size: PHONE.title, fill: t.text, strict: false }));

  const rows = focus.ranked.slice(0, grid.shown);
  const more = focus.ranked.length - rows.length;
  const names = rows.map((r) => plain(tx, r.label, "sans"));
  const countW = Math.max(...rows.map((r) => tx.measure(String(r.count), num)));
  const inner = box.x1 - box.x0;
  const tip = 12; // bar tip → count
  // Names keep their full width unless the bars would get shorter than a quarter of the panel.
  const nameW = Math.min(Math.max(...names.map((s) => tx.measure(s, font))), inner - 24 - inner / 4 - tip - countW);
  const base = box.x0 + nameW + 24;
  const len = box.x1 - tip - countW - base;
  const max = Math.max(0, ...rows.map((r) => r.count));
  const a = PHONE.accent;
  rows.forEach((r, k) => {
    const y = grid.rows[k];
    const mid = y - grid.mid;
    out.push(tx.draw(tx.fit(names[k], nameW, font), { x: box.x0, y, ...font, fill: t.textSoft, strict: false }));
    const w = max ? (len * r.count) / max : 0;
    const end = Math.min(a / 2, w);
    if (w > 0) out.push(rect({ x: base, y: mid - a / 2, w, h: a, r: [0, end, end, 0], fill: t.accent }));
    out.push(tx.draw(String(r.count), { x: base + w + (w > 0 ? tip : 0), y, ...num, fill: t.text }));
  });
  if (more) out.push(tx.draw(`+${more} more`, { x: box.x0, y: grid.rows[rows.length], ...font, fill: t.muted }));
  return out.join("");
}

/** Right: the top languages and "Other" under their own segmented bar. */
function languagesPhone(tx, t, parts, colours, box, grid) {
  const size = PHONE.text;
  const out = [tx.draw("Languages", { x: box.x0, y: grid.title, font: "sansSemi", size: PHONE.title, fill: t.text })];
  if (!parts.length) {
    out.push(tx.draw(tx.fit("No language data this week", box.x1 - box.x0, { font: "sans", size }), { x: box.x0, y: grid.rows[0], font: "sans", size, fill: t.muted }));
    return out.join("");
  }
  // The bar lines up with the first area row, and each language row with the next ones,
  // so both lists read across on one baseline grid.
  const h = PHONE.bar;
  const barY = grid.rows[0] - grid.mid - h / 2;
  out.push(segmentedBar(parts, colours, { x: box.x0, y: barY, w: box.x1 - box.x0, h, gap: PHONE.barGap, min: 8, id: "sg-bar-c" }));
  const sw = 2 * h; // swatch: a pill as tall as the bar
  parts.forEach((p, i) => {
    const y = grid.rows[0] + (i + 1) * grid.pitch;
    const mid = y - grid.mid;
    out.push(rect({ x: box.x0, y: mid - h / 2, w: sw, h, r: h / 2, fill: colours[i] }));
    const share = pct(p.share);
    const shareW = tx.measure(share, { font: "mono", size });
    const nameX = box.x0 + sw + 14;
    const name = tx.fit(plain(tx, p.name, "sans"), box.x1 - shareW - 24 - nameX, { font: "sans", size });
    out.push(tx.draw(name, { x: nameX, y, font: "sans", size, fill: t.text, strict: false }));
    out.push(tx.draw(share, { x: box.x1, y, font: "mono", size, fill: t.text, anchor: "end" }));
  });
  return out.join("");
}

// ---------------------------------------------------------------- document

function describe(focus, langs, meta) {
  const areas = focus.areas.map((a) => `${a.label} ${a.count}`).join(", ");
  const parts = langs.parts.map((p) => `${p.name} ${pct(p.share)}`).join(", ");
  return `${focus.title}${focus.subtitle ? ` (${focus.subtitle})` : ""}: ${areas}. Languages (average share of code per public repository): ${parts || "no data"}.${meta.updated ? ` Updated ${meta.updated}.` : ""}`;
}

/** Both charts as Markdown, for the text version the README links under the image. */
function markdown(focus, langs, meta) {
  const out = ["## Signals", "", `### ${focus.title}`, ""];
  out.push(`${focus.subtitle || "Roles and projects per area"} (${focus.items} in all${focus.shared ? "; some cover several areas" : ""}).`, "");
  out.push("| Area | Roles and projects |", "| --- | --- |");
  for (const a of focus.ranked) out.push(`| ${a.label} | ${a.count} |`); // largest first, as on phones
  const repos = Number.isFinite(+langs.repos) && langs.repos > 0 ? ` (${langs.repos} repositories)` : "";
  out.push("", "### Languages", "", `Average share of code per public repository, each counting equally${repos}.`, "");
  if (langs.parts.length) {
    out.push("| Language | Share |", "| --- | --- |");
    for (const p of langs.parts) out.push(`| ${p.other ? `Other (${p.count} languages)` : p.name} | ${pct(p.share)} |`);
  } else out.push("No language data yet.");
  if (meta.updated) out.push("", `Updated ${meta.updated}.`);
  return out.join("\n") + "\n";
}

export function outputs({ profile, live }) {
  const focus = focusData({ title: "Work by area", ...profile.focus });
  const langs = languageData(live?.languages);
  const meta = { updated: updated(live?.fetchedAt, profile.timeZone) };
  const wideHues = assignColours(langs.parts);
  const prefer = Object.fromEntries(langs.parts.map((p, i) => [p.name, wideHues[i]]).filter(([, h]) => h !== "neutral"));
  const phoneHues = assignColours(langs.phone, prefer);
  return [{
    file: "signals",
    text: markdown(focus, langs, meta),
    render: (t) => {
      const tx = createText();
      const top = PAD + 64; // below the titles
      const bottom = H - PAD - 36; // above the notes
      const wide = [
        rect({ x: 0.5, y: 0.5, w: W - 1, h: H - 1, r: 16, fill: t.canvas, stroke: t.line }),
        `<path d="M${SPLIT + 0.5} ${PAD}V${H - PAD}" stroke="${t.line}"/>`,
        focusPanel(tx, t, focus, { x0: PAD, x1: SPLIT - PAD, y0: top, y1: bottom }),
        languagesPanel(tx, t, langs, meta, barColours(t, wideHues), { x0: SPLIT + PAD, x1: W - PAD, y0: top, y1: bottom }),
      ].join("");
      // Compact: the border and divider are drawn heavier, so they stay visible at phone size.
      const grid = phoneGrid(tx, focus.ranked.length);
      const S = PHONE.split;
      const compact = [
        rect({ x: 1.125, y: 1.125, w: W - 2.25, h: H - 2.25, r: 16, fill: t.canvas, stroke: t.line, sw: 2.25 }),
        `<path d="M${S} ${PHONE.edge}V${H - PHONE.edge}" stroke="${t.line}" stroke-width="2"/>`,
        focusPhone(tx, t, focus, { x0: PAD, x1: S - PAD }, grid),
        languagesPhone(tx, t, langs.phone, barColours(t, phoneHues), { x0: S + PAD, x1: W - PAD }, grid),
      ].join("");
      return svgDoc({
        width: W,
        height: H,
        title: `Signals: ${inSentence(focus.title)} and languages`,
        desc: describe(focus, langs, meta),
        defs: tx.defs(),
        style: `.c{display:none}@media (max-width:${BREAKPOINT}px){.w{display:none}.c{display:inline}}`,
        body: `<g class="w">${wide}</g><g class="c" display="none">${compact}</g>`,
      });
    },
  }];
}
