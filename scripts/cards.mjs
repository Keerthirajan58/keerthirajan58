// Featured-work cards: one small sheet per profile.featured item, shown two per row in
// the README (each <img width="49%"> in a link). Every card shares one size and one
// baseline grid, so the six read as a set: eyebrow, title, a two-line summary, three
// facts (the first one emphasised), and a footer with the link and an arrow.
//
// Two states share one sheet. The wide one above is the default. On a phone each card
// is only about 151 css px wide, so a media query (max-width BREAKPOINT) swaps in a
// compact state: the title, larger and on up to two lines, and the card's phoneLine
// under it. Renderers without CSS keep the wide state.
import { createText, FONTS, UNITS } from "./lib/text.mjs";
import { svgDoc, rect, n } from "./lib/svg.mjs";

const W = 480;
const PAD = 26;
const CW = W - 2 * PAD; // content width

const EYEBROW = { font: "mono", size: 13, tracking: 0.03 };
const TITLE = { font: "display", tracking: -0.03, max: 26, min: 18 };
const LINE = { font: "sans", max: 16, min: 14, leading: 1.4 };
const FACT = { font: "sans", size: 14 };
const LEAD_FACT = { font: "sansSemi", size: 14 };
const LABEL = { font: "mono", size: 13 };

// Baselines, identical on every card.
const Y = { eyebrow: 36, title: 68.5, line: 96.5, fact: 147, factStep: 20 };
Y.divider = Y.fact + 2 * Y.factStep + 14.5; // on a half unit, so the 1px rule is crisp
Y.label = Y.divider + 23;
const H = Math.round(Y.label + 24);

// The compact (phone) state. Sizes are SVG units: at 151 px (a 390 px phone) a unit is
// 0.31 px, so the title shows at about 11 px and the phone line at about 9.4 px. Both
// sizes are shared by the set, like the wide state's.
const BREAKPOINT = 343; // css px: 49% of 700, so the cards change state with the full-width images
const P_TITLE = { font: "display", tracking: -0.03, max: 36, min: 28, leading: 1.12 };
const P_LINE = { font: "sans", max: 30, min: 28, leading: 1.3 };
const P_GAP = 30; // least room between the title's baseline and the phone line's caps
const P_STROKE = 3; // the sheet's 1px edge on a phone
const P_TAB = { w: 48, h: 6 };

const plan = createText(); // for measuring only

/** Typographic quotes and apostrophes. */
const smart = (s) => String(s ?? "").replace(/"([^"]*)"/g, "“$1”").replace(/'/g, "’");
/** Upper case for ASCII letters only (the fonts carry no accented capitals). */
const upper = (s) => s.replace(/[a-z]/g, (c) => c.toUpperCase());

/** Greedy word wrap to `max` width. */
function wrap(str, max, opts) {
  const lines = [];
  let cur = "";
  for (const word of str.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || plan.measure(next, opts) <= max) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Sets `str` on one line or, when it does not fit, on two. A break at a " · " separator
 * comes first (the dot is dropped: the break separates); then the break that leaves the
 * two lines most even, avoiding a single word on line two where another break fits.
 * Returns null when no break fits.
 */
function breakTwo(str, max, opts) {
  if (plan.measure(str, opts) <= max) return [str];
  const words = str.split(" ");
  const seen = new Set();
  const cands = [];
  for (let k = 1; k < words.length; k++) {
    let a = words.slice(0, k).join(" ");
    let b = words.slice(k).join(" ");
    let sep = false;
    if (b.startsWith("· ")) [b, sep] = [b.slice(2), true];
    else if (a.endsWith(" ·")) [a, sep] = [a.slice(0, -2), true];
    if (!a || !b || seen.has(a + "\n" + b)) continue;
    seen.add(a + "\n" + b);
    const wide = Math.max(plan.measure(a, opts), plan.measure(b, opts));
    if (wide <= max) cands.push({ lines: [a, b], wide, sep, lone: !b.includes(" ") });
  }
  if (!cands.length) return null;
  const rank = (c) => (c.sep ? 0 : 2) + (c.lone ? 1 : 0);
  cands.sort((p, q) => rank(p) - rank(q) || p.wide - q.wide);
  return cands[0].lines;
}

/** Shortens `str` to the content width with an ellipsis, at a word break if one fits. */
function clip(str, opts) {
  if (plan.measure(str, opts) <= CW) return str;
  const words = str.split(" ");
  while (words.length > 1) {
    words.pop();
    const s = `${words.join(" ").replace(/[\s·,;:—–-]+$/, "")}…`;
    if (plan.measure(s, opts) <= CW) return s;
  }
  return plan.fit(str, CW, opts);
}

/** Left edge of a glyph's ink, in font units (its left side bearing). */
function inkLeft(font, ch) {
  const d = FONTS[font].glyphs[ch]?.d;
  if (!d) return 0;
  let min = Infinity;
  for (const seg of d.match(/[MLQ][^MLQZ]*/g) || []) {
    const v = seg.slice(1).match(/-?\d*\.?\d+/g) || [];
    for (let i = 0; i < v.length; i += 2) min = Math.min(min, +v[i]);
  }
  return Number.isFinite(min) ? min : 0;
}

/**
 * Sizes shared by the whole set: the largest title size at which every title fits
 * one line, and the largest summary size at which every summary fits two lines.
 * An outlier that would not fit even at the minimum is left out (it is shrunk or
 * shortened on its own card), so it cannot drag the other cards down with it.
 * The phone state does the same for its title (two lines) and phone line (two lines).
 */
function planSet(items) {
  const perUnit = (it) => plan.measure(smart(it.title), { font: TITLE.font, size: 1, tracking: TITLE.tracking });
  const fits = items.map((it) => CW / perUnit(it)).filter((s) => s >= TITLE.min);
  const titleSize = Math.floor(Math.min(TITLE.max, ...fits) * 4) / 4;
  const twoLines = (it, size) => wrap(smart(it.line), CW, { font: LINE.font, size }).length <= 2;
  const lines = items.filter((it) => twoLines(it, LINE.min));
  let lineSize = LINE.max;
  while (lineSize > LINE.min && !lines.every((it) => twoLines(it, lineSize))) lineSize -= 0.5;
  return { titleSize, lineSize, phone: planPhone(items) };
}

/** The phone state's shared sizes, line breaks and baselines. */
function planPhone(items) {
  const largest = (strs, o, step) => {
    const ok = (s, size) => breakTwo(s, CW, { font: o.font, size, tracking: o.tracking || 0 });
    const counted = strs.filter((s) => ok(s, o.min));
    let size = o.max;
    while (size > o.min && !counted.every((s) => ok(s, size))) size -= step;
    return size;
  };
  const titles = items.map((it) => smart(it.title));
  const phones = items.map((it) => smart(it.phoneLine || it.facts?.[0] || ""));
  const tSize = largest(titles, P_TITLE, 0.25);
  const lSize = largest(phones, P_LINE, 0.5);
  const tOpts = { font: P_TITLE.font, size: tSize, tracking: P_TITLE.tracking };
  const lOpts = { font: P_LINE.font, size: lSize };
  const tLead = tSize * P_TITLE.leading;
  const lLead = lSize * P_LINE.leading;
  const tCap = plan.metrics(P_TITLE.font, tSize).capHeight;
  const lCap = plan.metrics(P_LINE.font, lSize).capHeight;
  // Each card's lines. An outlier that cannot fit two lines is wrapped and shortened.
  const set = (str, o) => {
    const two = breakTwo(str, CW, o);
    if (two) return two;
    const w = wrap(str, CW, o);
    return [clip(w[0], o), clip(w.slice(1).join(" "), o)].filter(Boolean);
  };
  const cards = items.map((it, i) => ({ title: set(titles[i], tOpts), phone: phones[i] ? set(phones[i], lOpts) : [] }));
  const tMax = Math.max(1, ...cards.map((c) => c.title.length));
  const lMax = Math.max(1, ...cards.map((c) => c.phone.length));
  return { tOpts, lOpts, tLead, lLead, tCap, lCap, cards, tMax, lMax };
}

/** An up-right arrow in a size-by-size box whose bottom-left corner is (x, y). */
function arrow(x, y, size, color) {
  const d = `M${n(x)} ${n(y)}L${n(x + size)} ${n(y - size)}M${n(x + size * 0.3)} ${n(y - size)}H${n(x + size)}V${n(y - size * 0.3)}`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** The wide state: eyebrow, title, summary, facts and footer. */
function wide(item, t, set, tx) {
  const out = [];

  // Eyebrow: mono capitals, muted.
  const eyebrow = upper(smart(item.eyebrow));
  out.push(tx.draw(tx.fit(eyebrow, CW, EYEBROW), { x: PAD, y: Y.eyebrow, ...EYEBROW, fill: t.muted }));

  // Title at the set's size; only a title that still overflows shrinks, then shortens.
  const title = smart(item.title);
  const tOpts = { font: TITLE.font, size: set.titleSize, tracking: TITLE.tracking };
  while (tOpts.size > 14 && tx.measure(title, tOpts) > CW) tOpts.size -= 0.25;
  out.push(tx.draw(tx.fit(title, CW, tOpts), { x: PAD, y: Y.title, ...tOpts, fill: t.text }));

  // Summary: at most two lines.
  const lOpts = { font: LINE.font, size: set.lineSize };
  let lines = wrap(smart(item.line), CW, lOpts);
  if (lines.length > 2) lines = [lines[0], tx.fit(lines.slice(1).join(" "), CW, lOpts)];
  lines.forEach((s, i) => {
    out.push(tx.draw(s, { x: PAD, y: Y.line + i * set.lineSize * LINE.leading, ...lOpts, fill: t.textSoft }));
  });

  // Facts: a compact list with square bullets; the first, the headline, in ink semibold.
  const facts = (item.facts || []).slice(0, 3);
  facts.forEach((f, i) => {
    const y = Y.fact + i * Y.factStep;
    const o = i === 0 ? LEAD_FACT : FACT;
    out.push(rect({ x: PAD + 1, y: y - 7.5, w: 5, h: 5, r: 1, fill: t.muted }));
    out.push(tx.draw(tx.fit(smart(f), CW - 16, o), { x: PAD + 16, y, ...o, fill: i === 0 ? t.text : t.textSoft }));
  });

  // Footer: hairline, link label and the accent arrow.
  const label = item.label || String(item.href || "").replace(/^https?:\/\//, "");
  out.push(`<path d="M${PAD} ${Y.divider}H${W - PAD}" stroke="${t.line}"/>`);
  out.push(tx.draw(tx.fit(label, CW - 28, LABEL), { x: PAD, y: Y.label, ...LABEL, fill: t.muted }));
  out.push(arrow(W - PAD - 10, Y.label, 10, t.accent));

  // One quiet accent: a short crimson tab on the top edge.
  const tab = rect({ x: PAD, y: 0, w: 32, h: 3, r: [0, 0, 1.5, 1.5], fill: t.accent });
  return { body: tab + out.join(""), facts, label };
}

/**
 * The phone state: the title and the phone line, every line's ink on the text inset.
 * The title hangs from one top line and the phone line stands on one bottom line, the
 * same on every card, so the cards of a row align at both ends whatever their line
 * counts, and every card has the same top and bottom margins.
 */
function compact(i, t, set, tx) {
  const P = set.phone;
  const card = P.cards[i];
  const out = [];
  const line = (s, y, o, fill) => {
    const x = PAD - (inkLeft(o.font, s[0]) * o.size) / UNITS;
    out.push(tx.draw(s, { x, y, ...o, fill }));
  };
  // The tallest block in the set (two title lines and two phone lines at the least gap)
  // sets the margin; every card then uses the same title and phone-line baselines.
  const block = P.tCap + (P.tMax - 1) * P.tLead + P_GAP + P.lCap + (P.lMax - 1) * P.lLead;
  const margin = (H - block) / 2;
  const yTitle = margin + P.tCap;
  const yPhone = H - margin - (card.phone.length - 1) * P.lLead;
  card.title.forEach((s, k) => line(s, yTitle + k * P.tLead, P.tOpts, t.text));
  card.phone.forEach((s, k) => line(s, yPhone + k * P.lLead, P.lOpts, t.textSoft));

  // A thicker edge (1px at 158 px) inside the sheet's, with the same outer corner.
  const sw = P_STROKE;
  const edge = rect({ x: sw / 2, y: sw / 2, w: W - sw, h: H - sw, r: 16.5 - sw / 2, stroke: t.line, sw });
  const tab = rect({ x: PAD, y: 0, w: P_TAB.w, h: P_TAB.h, r: [0, 0, P_TAB.h / 2, P_TAB.h / 2], fill: t.accent });
  return edge + tab + out.join("");
}

function renderCard(item, i, t, set) {
  const tx = createText();
  const w = wide(item, t, set, tx);
  const c = compact(i, t, set, tx);

  // Solid sheet.
  const sheet = rect({ x: 0.5, y: 0.5, w: W - 1, h: H - 1, r: 16, fill: t.canvas, stroke: t.line });
  const style = `.c{display:none}@media (max-width:${BREAKPOINT}px){.w{display:none}.c{display:inline}}`;

  return svgDoc({
    width: W,
    height: H,
    title: `${item.title}: ${item.eyebrow}`,
    desc: [item.line, ...w.facts, w.label].join(" · "),
    defs: tx.defs(),
    style,
    body: `${sheet}<g class="w">${w.body}</g><g class="c" display="none">${c}</g>`,
  });
}

export function outputs({ profile }) {
  const items = profile.featured || [];
  const set = planSet(items);
  return items.map((item, i) => ({
    file: `card-${item.slug}`,
    render: (theme) => renderCard(item, i, theme, set),
  }));
}
