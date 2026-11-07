// The typing line under the banner, set as the terminal's next prompt: a crimson ">" on the
// banner's inner column, then profile.typing typed out character by character. One line is
// typed once and stays, with a steady caret. Several lines take turns (each held while the
// caret blinks, then erased, and line 1 typed again at the end). Either way the motion ends by
// itself on a complete frame, and the build stops if it would run longer than MAX_SECONDS:
// a README image has no pause button, so motion must end within 5 s (WCAG 2.2.2). In practice
// that means one line. Without motion (prefers-reduced-motion) the same frame shows: line 1 in
// full with its caret.
//
// Pure CSS: each row of text is revealed by a clip rect that moves one character cell per
// step, and the caret moves with the same steps. Every glyph is one cell wide, so a clip edge
// never cuts a letter.
//
// Two layouts share one canvas and one clock. Wide (the default): each line on one row.
// Phone (the image narrower than BREAKPOINT css px): each line on two rows split at its ": ",
// in larger type: the prompt, the ink part and the colon on row 1, the muted part on row 2,
// under the ink text. The hidden layout is only made invisible, so its animations keep
// running and the two stay in step if the width changes mid-way (a phone turned sideways).
import { createText, FONTS, UNITS } from "./lib/text.mjs";
import { svgDoc, n } from "./lib/svg.mjs";

const W = 1000;
const X = 48; // the banner's inner column: its status dot and PORTRAIT label start here,
// and so does the prompt's ink (its glyph is set left of X by its side bearing)
const MARGIN = 48; // least space right of the widest row and its caret
const BREAKPOINT = 700; // css px: the banner's, so the full-width images change layout together
const FONT = "mono"; // every glyph is one cell wide, so a step is exactly one character
const PROMPT = { char: ">", font: "monoBold" };
const WIDE = { size: 24, min: 20, height: 64 }; // 24 units ≈ 20px on a desktop profile
// 32 units ≈ 9.9px when the image is 308px wide (a 390px phone); the floor, 30, is 9.2px.
// Rows 1.4 em apart.
const PHONE = { size: 32, min: 30, rows: 2, pitch: 1.4, pad: 8 };
// The caret, per unit of font size: its gap after the text and how far it reaches above the
// capitals and below the baseline. Widths are in units: about 2px on desktop, 1.5px on a phone.
const CARET = { gap: 0.125, up: 0.146, down: 0.229, wide: 2.5, phone: 4.5 };

// Rhythm, in seconds.
const TIME = {
  start: 0.5, // the empty prompt, before line 1
  type: 0.055, // per character typed
  beat: { ":": 0.3, ",": 0.16 }, // extra pause after these characters while typing
  hold: 2.4, // a finished line stays up this long; the caret blinks only here
  blink: 1.2, // one blink (off and on again): under one a second
  fade: 0.15, // each blink eases out and back in rather than snapping
  erase: 0.022, // per character erased
  pause: 0.5, // the empty prompt, before the next line
};

const MAX_SECONDS = 5; // WCAG 2.2.2: motion that starts by itself must end within 5 s
const EASE = "ease-in-out";
const close = (a, b) => Math.abs(a - b) < 1e-6;
// The left edge of a glyph's ink in font units. Outlines use absolute M, L and Q commands
// only, so every second number is an x.
const inkLeft = (glyph) => Math.min(...glyph.d.match(/-?\d*\.?\d+/g).filter((_, i) => i % 2 === 0).map(Number));
// Where a line's first ": " is (with text after it), or -1: the ink part ends there.
const colon = (chars) => chars.findIndex((ch, i) => ch === ":" && chars[i + 1] === " " && i + 2 < chars.length);

/**
 * A line's rows on a phone, as [start, end) character ranges: split at its first ": " (the
 * colon ends row 1), then at spaces wherever a row would pass `max` characters. The space at
 * each break is not drawn, so a row starts one character after the previous one ends.
 */
function wrap(chars, max) {
  const c = colon(chars);
  const parts = c < 0 ? [[0, chars.length]] : [[0, c + 1], [c + 2, chars.length]];
  const rows = [];
  for (const [a, b] of parts) {
    let start = a;
    while (b - start > max) {
      const cut = chars.lastIndexOf(" ", start + max);
      if (cut <= start) throw new Error(`typing: "${chars.slice(start, b).join("")}" has a word too long for a phone row of ${max} characters`);
      rows.push({ start, end: cut });
      start = cut + 1;
    }
    rows.push({ start, end: b });
  }
  return rows;
}

/**
 * The clock. Each line is typed, held and erased in turn; then line 1 is typed again and
 * stays. A move is a run of characters typed or erased at an even pace: line `li` goes from
 * j0 to j1 characters shown between t0 and t1. Runs split after a beat character and at each
 * phone row break (`cuts`), so a run never moves the phone caret across rows: the break
 * itself (the space between the rows) is a one-character run of its own.
 */
function schedule(lines, cuts) {
  const moves = [];
  const holds = [];
  const order = lines.length > 1 ? [...lines.keys(), 0] : [0]; // a single line is typed once
  let t = TIME.start;
  order.forEach((li, pass) => {
    const chars = lines[li];
    const end = chars.length;
    const beats = chars.flatMap((ch, i) => (TIME.beat[ch] && i + 1 < end ? [i + 1] : []));
    const stops = [...new Set([...beats, ...cuts[li]])].filter((j) => j > 0 && j < end).sort((a, b) => a - b);
    const up = [0, ...stops, end];
    for (let k = 1; k < up.length; k++) {
      const [j0, j1] = [up[k - 1], up[k]];
      moves.push({ li, j0, j1, t0: t, t1: (t += (j1 - j0) * TIME.type) });
      if (j1 < end) t += TIME.beat[chars[j1 - 1]] || 0;
    }
    if (pass === order.length - 1) return; // the last pass stays
    holds.push([t, (t += TIME.hold)]);
    const down = up.slice().reverse();
    for (let k = 1; k < down.length; k++) {
      const [j0, j1] = [down[k - 1], down[k]];
      moves.push({ li, j0, j1, t0: t, t1: (t += (j0 - j1) * TIME.erase) });
    }
    t += TIME.pause;
  });
  return { moves, holds, period: +t.toFixed(3) };
}

/**
 * Keyframes for one element. `at(move, j)` gives its offset [x, y] once `move` shows j
 * characters, `first` and `last` its offsets at 0% and 100%. Moves that leave the element
 * where it is add nothing; runs that carry on from one another at the same pace merge into
 * a single stepped interval.
 */
function keyframes(moves, at, first, last, period) {
  const runs = [];
  for (const m of moves) {
    const a = at(m, m.j0);
    const b = at(m, m.j1);
    if (close(a[0], b[0]) && close(a[1], b[1])) continue;
    const r = { t0: m.t0, t1: m.t1, a, b, k: Math.abs(m.j1 - m.j0) };
    const p = runs.at(-1);
    const step = (q, i) => (q.b[i] - q.a[i]) / q.k;
    if (p && close(p.t1, r.t0) && close((p.t1 - p.t0) / p.k, (r.t1 - r.t0) / r.k) && close(step(p, 0), step(r, 0)) && close(step(p, 1), step(r, 1))) {
      Object.assign(p, { t1: r.t1, b: r.b, k: p.k + r.k });
    } else runs.push(r);
  }
  const pts = [{ t: 0, v: first }];
  for (const r of runs) pts.push({ t: r.t0, v: r.a, fn: r.k > 1 ? `steps(${r.k},start)` : "step-start" }, { t: r.t1, v: r.b });
  pts.push({ t: period, v: last });
  const pct = (t) => `${+((t / period) * 100).toFixed(3)}%`;
  const key = (v) => `${n(v[0])},${n(v[1])}`;
  // One keyframe per moment: where a run ends as the next begins, the later point carries the
  // timing on. Positions only ever jump inside a stepped run, never between keyframes.
  const once = [];
  for (const p of pts) {
    const q = once.at(-1);
    if (q && pct(q.t) === pct(p.t)) {
      if (key(q.v) !== key(p.v)) throw new Error(`typing: two positions at ${p.t}s`);
      once[once.length - 1] = p;
    } else once.push(p);
  }
  // No keyframe inside a still stretch.
  const kept = once.filter((p, i) => i === 0 || i === once.length - 1 || key(once[i - 1].v) !== key(p.v) || key(once[i + 1].v) !== key(p.v));
  const flat = kept.every((p) => close(p.v[1], 0));
  const tf = (v) => (flat ? `translateX(${n(v[0])}px)` : `translate(${n(v[0])}px,${n(v[1])}px)`);
  return kept.map((p) => `${pct(p.t)}{transform:${tf(p.v)}${p.fn ? `;animation-timing-function:${p.fn}` : ""}}`).join("");
}

/** The caret's opacity: solid, except while a finished line holds, when it blinks. */
function blinks(holds, period) {
  const pct = (t) => `${+((t / period) * 100).toFixed(3)}%`;
  let kf = "0%{opacity:1}";
  for (const [a, b] of holds) {
    let on = 1;
    for (let s = a + TIME.blink / 2; s <= b + 1e-6; s += TIME.blink / 2) {
      kf += `${pct(s - TIME.fade)}{opacity:${on};animation-timing-function:${EASE}}${pct(s)}{opacity:${(on = 1 - on)}}`;
    }
    if (!on) kf += `${pct(b - TIME.fade)}{opacity:0;animation-timing-function:${EASE}}${pct(b)}{opacity:1}`;
  }
  return `${kf}100%{opacity:1}`;
}

function render(profile, theme) {
  const text = createText();
  const font = FONTS[FONT];
  const strings = profile.typing.map((s) => text.normalize(s, FONT)); // throws on a missing glyph
  if (!strings.length) throw new Error("typing: profile.typing is empty");
  const one = font.glyphs[" "].a;
  for (const ch of new Set(strings.join(""))) if (font.glyphs[ch].a !== one) throw new Error(`typing: "${ch}" is not one cell wide`);
  if (FONTS[PROMPT.font].glyphs[PROMPT.char].a !== one) throw new Error("typing: the prompt is not one cell wide");
  const lines = strings.map((s) => [...s]);
  const em = one / UNITS; // one cell, per unit of font size
  const cap = font.capHeight / UNITS;
  const lead = inkLeft(FONTS[PROMPT.font].glyphs[PROMPT.char]) / UNITS; // the prompt's side bearing
  // How many characters fit on a row after the prompt and its space, caret included.
  const room = (size, caret) => Math.floor((W - MARGIN - X - caret + (lead - CARET.gap) * size) / (em * size)) - 2;

  // Wide: every line on one row, at the size that fits the longest one.
  const longest = Math.max(...lines.map((c) => c.length));
  const ws = Math.min(WIDE.size, Math.floor(((W - MARGIN - X - CARET.wide) / ((2 + longest) * em + CARET.gap - lead)) * 100) / 100);
  if (ws < WIDE.min) throw new Error(`typing: a line has ${longest} characters; keep each line to ${room(WIDE.min, CARET.wide)} or fewer`);

  // Phone: the largest size at which every line keeps to PHONE.rows rows.
  let ps = PHONE.size;
  let rows = lines.map((c) => wrap(c, room(ps, CARET.phone)));
  while (ps > PHONE.min && Math.max(...rows.map((r) => r.length)) > PHONE.rows) {
    ps -= 1;
    rows = lines.map((c) => wrap(c, room(ps, CARET.phone)));
  }
  const most = Math.max(...rows.map((r) => r.length));

  // The canvas is as tall as the phone layout needs. The wide line keeps its place on a
  // WIDE.height canvas, close under the banner like the window's next prompt.
  const pitch = PHONE.pitch * ps;
  const block = (CARET.up + cap + CARET.down) * ps + (most - 1) * pitch;
  const H = Math.max(WIDE.height, Math.ceil(block + 2 * PHONE.pad));
  const wide = { size: ws, cell: em * ws, base: n(WIDE.height / 2 + (cap * ws) / 2), caret: CARET.wide };
  const phone = { size: ps, cell: em * ps, base: n((H - block) / 2 + (CARET.up + cap) * ps), caret: CARET.phone };
  for (const L of [wide, phone]) {
    L.x0 = X - lead * L.size; // the prompt's glyph origin, so that its ink starts at X
    L.xs = L.x0 + 2 * L.cell; // the text, after the prompt and a space
  }

  const cuts = rows.map((rs) => rs.slice(0, -1).flatMap((r) => [r.end, r.end + 1]));
  const { moves, holds, period } = schedule(lines, cuts);
  if (period > MAX_SECONDS)
    throw new Error(`typing: the animation would run ${period} s; it must end within ${MAX_SECONDS} s (WCAG 2.2.2), so use one line of about 70 characters or fewer`);
  const mine = (li) => moves.filter((m) => m.li === li);
  const rowOf = (li, j) => rows[li].findLastIndex((r) => r.start <= j);
  const P = `${period}s`;
  // The phone layout is hidden by an attribute (so renderers without CSS show only the wide
  // one) and shown by the media query, which outranks it.
  let css = `@media (max-width:${BREAKPOINT}px){.d{visibility:hidden}.m{visibility:visible}}`;
  const animate = (name, kf) => (css += `.${name}{animation:${name} ${P} linear both}@keyframes ${name}{${kf}}`);
  animate("cb", blinks(holds, period));

  // Ink up to a line's first ": ", muted from there on.
  const runs = (chars) => {
    const c = colon(chars);
    return c < 0 ? [[0, chars.length, theme.text]] : [[0, c, theme.text], [c, chars.length, theme.muted]];
  };
  const draw = (chars, a, b, x, y, size, fill) => (a < b ? text.draw(chars.slice(a, b).join(""), { x, y, font: FONT, size, fill }) : "");
  const caret = (L, x, y, cls) => {
    const top = n(L.base - (cap + CARET.up) * L.size);
    const h = n((cap + CARET.up + CARET.down) * L.size);
    return `<g class="${cls}" transform="translate(${n(x)} ${n(y)})"><rect class="cb" x="${n(CARET.gap * L.size)}" y="${top}" width="${L.caret}" height="${h}" rx="${n(L.caret / 2)}" fill="${theme.accent}"/></g>`;
  };
  const prompt = (L) => text.draw(PROMPT.char, { x: L.x0, y: L.base, font: PROMPT.font, size: L.size, fill: theme.accent });
  let clips = "";

  // Wide: one clip per line. Its rect ends at the text's left edge and moves right one cell
  // per typed character (and back when erasing). Without motion only line 1 is uncovered.
  let d = prompt(wide);
  lines.forEach((chars, li) => {
    const full = chars.length * wide.cell;
    const shift = (j) => [j * wide.cell, 0];
    animate(`w${li}`, keyframes(mine(li), (m, j) => shift(j), [0, 0], shift(li ? 0 : chars.length), period));
    clips += `<clipPath id="w${li}"><rect class="w${li}" x="${n(wide.xs - full)}" y="0" width="${n(full)}" height="${H}"${li ? "" : ` transform="translate(${n(full)} 0)"`}/></clipPath>`;
    d += `<g clip-path="url(#w${li})">${runs(chars).map(([a, b, fill]) => draw(chars, a, b, wide.xs + a * wide.cell, wide.base, wide.size, fill)).join("")}</g>`;
  });
  const wideAt = (j) => [wide.xs + j * wide.cell, 0];
  animate("wc", keyframes(moves, (m, j) => wideAt(j), wideAt(0), wideAt(lines[0].length), period));
  d += caret(wide, wideAt(lines[0].length)[0], 0, "wc");

  // Phone: one clip per line with a rect per row, each uncovering its own row only.
  let p = prompt(phone);
  lines.forEach((chars, li) => {
    let rects = "";
    let g = "";
    rows[li].forEach((r, ri) => {
      const cells = r.end - r.start;
      const full = cells * phone.cell;
      const y = phone.base + ri * pitch;
      const shift = (j) => [Math.min(Math.max(j - r.start, 0), cells) * phone.cell, 0];
      const name = `p${li}r${ri}`;
      animate(name, keyframes(mine(li), (m, j) => shift(j), [0, 0], shift(li ? 0 : chars.length), period));
      const top = n(y - (cap + CARET.up) * ps - 2);
      rects += `<rect class="${name}" x="${n(phone.xs - full)}" y="${top}" width="${n(full)}" height="${n((cap + CARET.up + CARET.down) * ps + 4)}"${li ? "" : ` transform="translate(${n(full)} 0)"`}/>`;
      for (const [a, b, fill] of runs(chars)) {
        const s = Math.max(a, r.start);
        g += draw(chars, s, Math.min(b, r.end), phone.xs + (s - r.start) * phone.cell, n(y), ps, fill);
      }
    });
    clips += `<clipPath id="p${li}">${rects}</clipPath>`;
    p += `<g clip-path="url(#p${li})">${g}</g>`;
  });
  const phoneAt = (li, j) => {
    const r = rowOf(li, j);
    return [phone.xs + (j - rows[li][r].start) * phone.cell, r * pitch];
  };
  const end = phoneAt(0, lines[0].length);
  animate("pc", keyframes(moves, (m, j) => phoneAt(m.li, j), phoneAt(0, 0), end, period));
  p += caret(phone, end[0], end[1], "pc");

  return svgDoc({
    width: W,
    height: H,
    // WebKit sizes this short image to whole pixels; the default (meet) would then shrink
    // the drawing a little and move the prompt off the banner's column. Slice keeps the scale.
    par: "xMidYMid slice",
    title: `A prompt that types ${lines.length === 1 ? "one line" : `${lines.length} lines`} about ${profile.shortName}`,
    desc: strings.join(" / "),
    defs: text.defs() + clips,
    style: css,
    body: `<g class="d">${d}</g><g class="m" visibility="hidden">${p}</g>`,
  });
}

export function outputs({ profile }) {
  return [{ file: "typing", render: (theme) => render(profile, theme) }];
}
