// The hero banner: a calm terminal window. Left, PORTRAIT: a halftone portrait drawn
// from data/portrait.json as dots on a hexagonal grid. Right, WHOAMI: profile.banner.rows
// as key ··· value lines, in groups split by ["---"] rows. A footer strip carries the
// status and time zone.
//
// Two layouts share one viewBox. The wide one is the default. When the image is shown
// narrower than BREAKPOINT css px, a media query swaps in a compact one: the same
// portrait beside a few values as plain lines, every text at 31 units (9.5 px when the
// banner is 308 px wide, as on a 390 px phone). Renderers without CSS keep the wide layout.
//
// The banner is static on purpose. A scan line sweeping the portrait, even a faint one,
// read as a face being scanned.
import { createText } from "./lib/text.mjs";
import { svgDoc, rect, n } from "./lib/svg.mjs";

const W = 1000;
const BREAKPOINT = 700; // css px: narrower than this, the wide layout's 13-unit text would be under 9 px
const L = {
  pad: 24, // window padding
  bar: 44, // title bar height
  gap: 16, // between the panels
  head: 40, // panel header height
  radius: 20, // window
  pr: 12, // panels
  inset: 24, // panel content inset (text columns)
  leftW: 432, // portrait panel width
  row: 26, // key/value row pitch
  groupGap: 12, // extra space between row groups
  rowsPad: 15, // above the first row and below the last
  footGap: 24, // panels to status bar
  foot: 40, // status bar height
};
const TYPE = { row: 14, label: 13, small: 13 };

// The compact (phone) layout keeps the window and the portrait, in a narrower panel so
// the values keep their room. Its bars are taller to hold 31-unit text, and its lines are
// 3 units wide (1 px on a phone).
const C = {
  head: 52, // panel header height
  foot: 52, // status bar height
  size: 31, // every text
  leftW: 380, // portrait panel (the wide one is L.leftW)
  stroke: 3,
  pitch: 56, // value lines
  minPitch: 52,
  margin: 32, // least space above the first value line and below the last
  label: { font: "monoBold", fill: "muted" }, // panel labels: quieter than the name
  pillH: 36,
  pillPad: 18,
  dot: 8, // title-bar and status dot radius
  corner: 24, // viewfinder arm length
  // After the name (the first row), these rows in this order. Trailing ones are dropped
  // when the lines do not fit at minPitch.
  keys: ["Role", "Previously", "Base", "Focus", "Shipping"],
};

// Halftone settings, in banner units.
const DOTS = {
  pitch: 4, // centre-to-centre distance along a row
  levels: 8, // dot sizes (one <path> each)
  rMaxK: 0.5, // largest radius as a share of the pitch (dots just touch)
};
// How the photo grid (data/portrait.json, in grid cells) sits in the panel: head and
// shoulders, the head a little left of centre as in the photo. Tuned for this photo.
const CROP = {
  scale: 2.9, // banner units per grid cell
  u0: 0, // grid column at the panel's left edge
  v0: 6, // grid row at the panel's top edge
  focus: [66, 66], // face centre (column, row): the vignette is centred here
};

export function outputs(ctx) {
  return [{ file: "banner", render: (theme) => render(ctx, theme) }];
}

function render({ profile, portrait }, t) {
  const tx = createText();
  const b = profile.banner;
  const rows = b.rows.filter((r) => r[0] !== "---");
  const groups = groupRows(b.rows);

  const rowsH = rows.length * L.row + (groups.length - 1) * L.groupGap;
  const panelY = L.bar + L.pad;
  const panelH = L.head + L.rowsPad * 2 + rowsH;
  const footY = panelY + panelH + L.footGap;
  const H = footY + L.foot;
  const leftX = L.pad;
  const rightX = leftX + L.leftW + L.gap;
  const rightW = W - L.pad - rightX;
  const g = { H, panelY, panelH, footY, leftX, rightX, rightW };

  const defs = [];
  // The portrait is drawn once, for the wide layout's area; the compact layout scales it.
  const area = { x: leftX + 1, y: panelY + L.head + 1, w: L.leftW - 2, h: panelH - L.head - 2 };
  const pm = halftone(portrait, area, t.mode);
  defs.push(`<g id="pm" fill="none" stroke-linecap="round">${pm.paths}</g>`, glowGradients(t));

  const ctx = { tx, t, b, rows, groups, g, area, defs, profile };
  const w = wide(ctx, pm.count);
  const c = compact(ctx);

  return svgDoc({
    width: W,
    height: H,
    title: `${profile.name}, ${profile.role}`,
    desc: `A terminal window: a dot portrait of ${profile.shortName} beside a WHOAMI list of roles, focus, stack and links.`,
    defs: tx.defs() + defs.join(""),
    style: `.c{display:none}@media (max-width:${BREAKPOINT}px){.w{display:none}.c{display:inline}}`,
    body: `<g class="w">${w}</g><g class="c" display="none">${c}</g>`,
  });
}

/** The wide layout: title bar, PORTRAIT and WHOAMI panels, status bar. */
function wide({ tx, t, b, rows, groups, g, area, defs, profile }, dotCount) {
  const { H, panelY, panelH, footY, leftX, rightX, rightW } = g;
  const body = [];

  // Window and title bar.
  body.push(rect({ x: 0.5, y: 0.5, w: W - 1, h: H - 1, r: L.radius, fill: t.canvas, stroke: t.line }));
  body.push(rect({ x: 1, y: 1, w: W - 2, h: L.bar - 0.5, r: [L.radius - 0.5, L.radius - 0.5, 0, 0], fill: t.raised }));
  body.push(`<path d="M1 ${L.bar + 0.5}H${W - 1}" stroke="${t.line}"/>`);
  body.push(`<g fill="${t.lineStrong}">${[0, 1, 2].map((i) => `<circle cx="${L.pad + 6 + i * 20}" cy="${L.bar / 2 + 0.5}" r="6"/>`).join("")}</g>`);
  body.push(tx.draw(b.title, { x: W / 2, y: L.bar / 2 + 5.5, font: "mono", size: TYPE.label, fill: t.muted, anchor: "middle" }));

  // Panels.
  for (const x of [leftX, rightX]) {
    const w = x === leftX ? L.leftW : rightW;
    body.push(rect({ x: x + 0.5, y: panelY + 0.5, w: w - 1, h: panelH - 1, r: L.pr, fill: t.surface, stroke: t.line }));
    body.push(`<path d="M${x + 1} ${panelY + L.head + 0.5}H${x + w - 1}" stroke="${t.line}"/>`);
  }
  const headBase = panelY + L.head / 2 + 4.7;

  // PORTRAIT: the dot portrait.
  body.push(glow(area, defs, "pc", L.pr - 1));
  body.push(`<use href="#pm" stroke="${t.dot}"/>`);
  const i = L.inset - 1; // the area starts 1 unit inside the panel
  body.push(viewfinder({ x0: area.x + i, y0: area.y + i, x1: area.x + area.w - i, y1: area.y + area.h - i }, 14, 1.5, t));
  body.push(tx.draw("PORTRAIT", { x: leftX + L.inset, y: headBase, font: "monoBold", size: TYPE.label, fill: t.text, tracking: 0.06 }));
  body.push(tx.draw(`${dotCount.toLocaleString("en-US")} DOTS · HEX HALFTONE`, { x: leftX + L.leftW - L.inset, y: headBase, font: "mono", size: TYPE.small, fill: t.muted, anchor: "end" }));

  // WHOAMI: header with the handle pill.
  body.push(tx.draw("WHOAMI", { x: rightX + L.inset, y: headBase, font: "monoBold", size: TYPE.label, fill: t.text, tracking: 0.06 }));
  const handle = `@${profile.login}`;
  const pillW = Math.ceil(tx.measure(handle, { font: "mono", size: TYPE.small }) + 24);
  const pillX = rightX + rightW - L.inset - pillW;
  const pillY = panelY + (L.head - 24) / 2;
  body.push(rect({ x: pillX, y: pillY, w: pillW, h: 24, r: 12, fill: t.accentWash }));
  body.push(tx.draw(handle, { x: pillX + pillW / 2, y: headBase, font: "mono", size: TYPE.small, fill: t.accent, anchor: "middle" }));

  // WHOAMI: rows, key ··· value, with dot leaders on a shared lattice.
  const kx = rightX + L.inset;
  const vx = rightX + rightW - L.inset;
  const leaderStep = 6;
  let y = panelY + L.head + L.rowsPad;
  let leaders = "";
  groups.forEach((grp, gi) => {
    if (gi) y += L.groupGap;
    for (const [key, value] of grp) {
      const base = y + L.row / 2 + 5;
      const kw = tx.measure(key, { font: "mono", size: TYPE.row });
      const avail = vx - kx - kw - 40;
      const vfont = key === rows[0][0] ? "monoBold" : "mono"; // the first row (the name) in bold
      const val = tx.fit(value, avail, { font: vfont, size: TYPE.row });
      const vw = tx.measure(val, { font: vfont, size: TYPE.row });
      body.push(tx.draw(key, { x: kx, y: base, font: "mono", size: TYPE.row, fill: t.muted }));
      body.push(tx.draw(val, { x: vx, y: base, font: vfont, size: TYPE.row, fill: t.text, anchor: "end" }));
      const a = kx + Math.ceil((kw + 12) / leaderStep) * leaderStep;
      const z = vx - vw - 12;
      if (z > a) {
        leaders += `M${n(a)} ${n(base - 3.5)}h0`;
        for (let x = a + leaderStep; x <= z; x += leaderStep) leaders += `m${leaderStep} 0h0`;
      }
      y += L.row;
    }
  });
  body.push(`<path d="${leaders}" fill="none" stroke="${t.lineStrong}" stroke-width="2" stroke-linecap="round"/>`);

  // Footer strip: a status bar that mirrors the title bar.
  body.push(rect({ x: 1, y: footY, w: W - 2, h: L.foot - 1, r: [0, 0, L.radius - 0.5, L.radius - 0.5], fill: t.raised }));
  body.push(`<path d="M1 ${footY - 0.5}H${W - 1}" stroke="${t.line}"/>`);
  const fy = footY + L.foot / 2 + 4.2;
  body.push(`<circle cx="${leftX + L.inset + 4.5}" cy="${n(fy - 4.6)}" r="4.5" fill="${t.good}"/>`);
  body.push(tx.draw(b.status, { x: leftX + L.inset + 18, y: fy, font: "mono", size: TYPE.small, fill: t.text }));
  body.push(tx.draw(b.zone, { x: W - L.pad - L.inset, y: fy, font: "mono", size: TYPE.small, fill: t.muted, anchor: "end" }));
  return body.join("");
}

/**
 * The compact layout, for phones: the same window and portrait, panel labels and the
 * handle at 31 units, the name and a few values as plain left-aligned lines in sans, and
 * the status. No title text, dot count, keys, dot leaders, stack, links or time zone.
 */
function compact({ tx, t, b, rows, g, area, defs, profile }) {
  const { H, panelY, leftX } = g;
  const rightX = leftX + C.leftW + L.gap;
  const rightW = W - L.pad - rightX;
  const s = C.stroke, h = s / 2;
  const footY = H - C.foot;
  const panelB = footY - L.footGap; // panels' bottom edge
  const bodyY = panelY + C.head; // the header divider starts here
  const out = [];

  // Window: canvas, title bar and status bar. The outline is drawn last, over their edges.
  out.push(rect({ x: 0, y: 0, w: W, h: H, r: L.radius, fill: t.canvas }));
  out.push(rect({ x: 0, y: 0, w: W, h: L.bar + 0.5, r: [L.radius, L.radius, 0, 0], fill: t.raised }));
  out.push(`<path d="M0 ${L.bar + 0.5}H${W}" stroke="${t.line}" stroke-width="${s}"/>`);
  out.push(`<g fill="${t.lineStrong}">${[0, 1, 2].map((i) => `<circle cx="${L.pad + C.dot + i * (2 * C.dot + 10)}" cy="${L.bar / 2 + 0.5}" r="${C.dot}"/>`).join("")}</g>`);
  out.push(rect({ x: 0, y: footY, w: W, h: C.foot, r: [0, 0, L.radius, L.radius], fill: t.raised }));
  out.push(`<path d="M0 ${footY - 0.5}H${W}" stroke="${t.line}" stroke-width="${s}"/>`);

  // Panels.
  for (const [x, w] of [[leftX, C.leftW], [rightX, rightW]]) {
    out.push(rect({ x: x + h, y: panelY + h, w: w - s, h: panelB - panelY - s, r: L.pr - h, fill: t.surface, stroke: t.line, sw: s }));
    out.push(`<path d="M${x + s} ${bodyY + h}H${x + w - s}" stroke="${t.line}" stroke-width="${s}"/>`);
  }
  const headMid = (panelY + h + bodyY + h) / 2; // between the panel's top edge and the divider
  const label = { font: C.label.font, size: C.size, tracking: 0.06, fill: t[C.label.fill] };
  const headBase = headMid + tx.metrics(label.font, C.size).capHeight / 2;

  // PORTRAIT: the wide layout's portrait, scaled to fit this panel body.
  const pa = { x: leftX + s, y: bodyY + s, w: C.leftW - 2 * s, h: panelB - s - (bodyY + s) };
  out.push(glow(pa, defs, "pk", L.pr - s));
  const k = Math.min(pa.w / area.w, pa.h / area.h);
  const ox = pa.x + (pa.w - area.w * k) / 2 - area.x * k;
  const oy = pa.y + (pa.h - area.h * k) / 2 - area.y * k;
  const f4 = (v) => +v.toFixed(4);
  out.push(`<use href="#pm" stroke="${t.dot}" transform="matrix(${f4(k)} 0 0 ${f4(k)} ${f4(ox)} ${f4(oy)})"/>`);
  out.push(viewfinder({ x0: leftX + L.inset, y0: bodyY + L.inset, x1: leftX + C.leftW - L.inset, y1: panelB - L.inset }, C.corner, s, t));
  out.push(tx.draw("PORTRAIT", { x: leftX + L.inset, y: headBase, ...label }));

  // WHOAMI: header, with the handle pill when it fits beside the label.
  out.push(tx.draw("WHOAMI", { x: rightX + L.inset, y: headBase, ...label }));
  const handle = `@${profile.login}`;
  const pillW = Math.ceil(tx.measure(handle, { font: "mono", size: C.size }) + 2 * C.pillPad);
  const pillX = rightX + rightW - L.inset - pillW;
  if (pillX >= rightX + L.inset + tx.measure("WHOAMI", label) + L.inset) {
    out.push(rect({ x: pillX, y: headMid - C.pillH / 2, w: pillW, h: C.pillH, r: C.pillH / 2, fill: t.accentWash }));
    out.push(tx.draw(handle, { x: pillX + pillW / 2, y: headBase, font: "mono", size: C.size, fill: t.accent, anchor: "middle" }));
  }

  // WHOAMI: the name, then the chosen values, centred in the panel body on an even pitch.
  const col = rightW - 2 * L.inset;
  // A row may carry a third item: its wording here, where the keys are not shown.
  const byKey = new Map(rows.map(([key, value, phone]) => [key, phone ?? value]));
  const lines = [{ text: rows[0][1], font: "sansSemi", fill: t.text }];
  for (const key of C.keys) if (byKey.has(key)) lines.push({ text: byKey.get(key), font: "sans", fill: t.textSoft });
  for (const l of lines) l.text = fitValue(tx, l.text, col, { font: l.font, size: C.size });
  const top = bodyY + s, bodyH = panelB - s - top;
  const cap = tx.metrics("sans", C.size).capHeight;
  while (lines.length > 1 && cap + (lines.length - 1) * C.minPitch > bodyH - 2 * C.margin) lines.pop();
  const pitch = lines.length > 1 ? Math.min(C.pitch, (bodyH - 2 * C.margin - cap) / (lines.length - 1)) : 0;
  let y = top + (bodyH - cap - (lines.length - 1) * pitch) / 2 + cap;
  for (const l of lines) {
    out.push(tx.draw(l.text, { x: rightX + L.inset, y, font: l.font, size: C.size, fill: l.fill }));
    y += pitch;
  }

  // Status bar: the status, without the time zone.
  const footMid = (footY - 0.5 + H - h) / 2; // between the divider and the window's edge
  const sx = leftX + L.inset;
  out.push(`<circle cx="${sx + C.dot}" cy="${n(footMid)}" r="${C.dot}" fill="${t.good}"/>`);
  const status = { font: "sans", size: C.size };
  const statusX = sx + 2 * C.dot + 14;
  out.push(tx.draw(tx.fit(b.status, W - L.pad - L.inset - statusX, status), { x: statusX, y: footMid + cap / 2, ...status, fill: t.text }));

  out.push(rect({ x: h, y: h, w: W - s, h: H - s, r: L.radius - h, stroke: t.line, sw: s }));
  return out.join("");
}

/**
 * A value as one line within `max`: whole, else its first " · " segment, else as many
 * whole words of that segment as fit, with an ellipsis. Never cuts inside a word.
 */
function fitValue(tx, value, max, opts) {
  if (tx.measure(value, opts) <= max) return value;
  const first = value.split(" · ")[0];
  if (tx.measure(first, opts) <= max) return first;
  const cut = (ws) => ws.join(" ").replace(/[\s,;:·]+$/, "") + "…"; // no "Area,…"
  const words = first.split(" ");
  while (words.length > 1 && tx.measure(cut(words), opts) > max) words.pop();
  return words.length > 1 || tx.measure(cut(words), opts) <= max ? cut(words) : tx.fit(first, max, opts);
}

/** Splits rows into groups at each ["---"] row (the separators themselves are dropped). */
function groupRows(rows) {
  const out = [[]];
  for (const r of rows) {
    if (r[0] === "---") out.push([]);
    else out[out.length - 1].push(r);
  }
  return out.filter((g) => g.length);
}

/** The Clear Air glows behind the portrait: blush high on the left, haze low on the right. */
function glowGradients(t) {
  const g = (id, c, cx, cy, op) =>
    `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r=".75"><stop offset="0" stop-color="${c}" stop-opacity="${op}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
  return g("ga", t.glowA, 0.3, 0.3, t.mode === "light" ? 0.75 : 0.55) + g("gb", t.glowB, 0.85, 0.9, t.mode === "light" ? 0.8 : 0.7);
}

/** Both glows over the area `a`, clipped (as `id`) to its shape: square top, round bottom. */
function glow(a, defs, id, r) {
  defs.push(`<clipPath id="${id}">${rect({ x: a.x, y: a.y, w: a.w, h: a.h, r: [0, 0, r, r] })}</clipPath>`);
  const box = `x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}"`;
  return `<g clip-path="url(#${id})"><rect ${box} fill="url(#ga)"/><rect ${box} fill="url(#gb)"/></g>`;
}

/** Viewfinder corner marks with arms of length `s`, at the corners of box `c`. */
function viewfinder(c, s, sw, t) {
  const { x0, y0, x1, y1 } = c;
  const d = `M${x0} ${y0 + s}V${y0}H${x0 + s}M${x1 - s} ${y0}H${x1}V${y0 + s}M${x1} ${y1 - s}V${y1}H${x1 - s}M${x0 + s} ${y1}H${x0}V${y1 - s}`;
  return `<path d="${n0(d)}" fill="none" stroke="${t.muted}" stroke-width="${sw}" opacity=".7"/>`;
}
const n0 = (d) => d.replace(/\d+\.\d+/g, (m) => String(n(+m)));

// ----------------------------------------------------------------------------------------
// Halftone portrait

const smooth = (e0, e1, x) => {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return k * k * (3 - 2 * k);
};

/**
 * Dots for the portrait area `a` ({x, y, w, h} in banner units). Light theme: dark dots
 * where the photo is dark; dark theme: light dots where it is light. Returns the dot
 * <path>s grouped by radius and the number of dots.
 */
function halftone(portrait, a, mode) {
  const { cols: C, rows: R } = portrait;
  const LUM = Buffer.from(portrait.lum, "base64");
  const ALPHA = Buffer.from(portrait.alpha, "base64");
  const sample = (buf, u, v) => {
    const x = Math.min(C - 1, Math.max(0, u - 0.5)), y = Math.min(R - 1, Math.max(0, v - 0.5));
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(C - 1, x0 + 1), y1 = Math.min(R - 1, y0 + 1);
    const fx = x - x0, fy = y - y0;
    const top = buf[y0 * C + x0] * (1 - fx) + buf[y0 * C + x1] * fx;
    const bot = buf[y1 * C + x0] * (1 - fx) + buf[y1 * C + x1] * fx;
    return top * (1 - fy) + bot * fy;
  };

  const { scale, u0, v0, focus } = CROP;
  const { pitch } = DOTS;
  const dy = (pitch * Math.sqrt(3)) / 2;
  const cell = pitch * dy;
  const rMax = pitch * DOTS.rMaxK;
  const half = pitch / scale / 2;
  // Focus (face centre) for the vignette, in area units.
  const fx0 = (focus[0] - u0) * scale, fy0 = (focus[1] - v0) * scale;
  const m = 10; // keep dots this far inside the panel

  // Pass 1: ink and coverage at every lattice point.
  const pts = [];
  const nx = Math.floor((a.w - 2 * m) / pitch);
  const ny = Math.floor((a.h - m) / dy);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = m + pitch / 2 + i * pitch + (j % 2 ? pitch / 2 : 0) - pitch / 4;
      const y = m / 2 + dy / 2 + j * dy;
      const u = u0 + x / scale, v = v0 + y / scale;
      let l = 0, al = 0;
      for (let q = -1; q <= 1; q++) for (let p = -1; p <= 1; p++) {
        const uu = u + (p * half) / 1.5, vv = v + (q * half) / 1.5;
        if (uu < 0 || vv < 0 || uu > C || vv > R) continue;
        const s = sample(ALPHA, uu, vv) / 255;
        l += sample(LUM, uu, vv) * s;
        al += s;
      }
      const lum = al ? l / al / 255 : 1;
      pts.push({ i, j, x, y, alpha: al / 9, ink: mode === "light" ? 1 - lum : lum });
    }
  }
  // Pass 2: a light unsharp mask over the six hex neighbours, so eyes and brows hold up.
  const get = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny ? pts[j * nx + i] : null);
  const dots = [];
  for (const p of pts) {
    if (p.alpha < 0.3) continue;
    const o = p.j % 2; // odd rows sit half a pitch to the right
    const nb = [[-1, 0], [1, 0], [o - 1, -1], [o, -1], [o - 1, 1], [o, 1]]
      .map(([di, dj]) => get(p.i + di, p.j + dj))
      .filter((q) => q && q.alpha > 0.3);
    const avg = nb.length ? nb.reduce((s, q) => s + q.ink, 0) / nb.length : p.ink;
    let ink = Math.min(1, Math.max(0, p.ink + 0.45 * (p.ink - avg)));
    ink = mode === "light" ? Math.pow(ink, 1.3) : Math.pow(ink, 1.2);
    const dist = Math.hypot((p.x - fx0) / (a.w * 0.62), (p.y - fy0) / (a.h * 0.66));
    const k =
      smooth(0.3, 0.7, p.alpha) *
      (1 - 0.5 * smooth(0.55, 1.15, dist)) *
      (1 - smooth(a.h * 0.7, a.h - 24, p.y)) *
      smooth(0, 40, p.x) * smooth(0, 40, a.w - p.x);
    let r = Math.min(rMax, Math.sqrt((ink * k * cell) / Math.PI));
    if (k > 0.45) r = Math.max(r, (mode === "light" ? 0.55 : 0.48) * k); // keeps the silhouette
    if (r < 0.35) continue;
    dots.push({ x: a.x + p.x, y: a.y + p.y, r });
  }

  const step = rMax / DOTS.levels;
  const byLevel = new Map();
  for (const d of dots) {
    const q = Math.max(1, Math.min(DOTS.levels, Math.round(d.r / step)));
    if (!byLevel.has(q)) byLevel.set(q, []);
    byLevel.get(q).push(d);
  }
  const paths = [...byLevel]
    .sort((p, q) => p[0] - q[0])
    .map(([q, ds]) => `<path d="${dotPath(ds)}" stroke-width="${n(2 * q * step)}"/>`)
    .join("");
  return { paths, count: dots.length };
}

// Compact numbers for path data: one decimal, no leading zero.
const f1 = (v) => {
  const s = String(Math.round(v * 10) / 10);
  return s.replace(/^(-?)0\./, "$1.");
};

/** Zero-length subpaths, one per dot, with relative moves. */
function dotPath(ds) {
  let d = "";
  let px = 0, py = 0;
  ds.forEach((p, i) => {
    const x = Math.round(p.x * 10) / 10, y = Math.round(p.y * 10) / 10;
    if (!i) d += `M${f1(x)} ${f1(y)}h0`;
    else {
      const sx = f1(x - px), sy = f1(y - py);
      d += `m${sx}${sy[0] === "-" ? "" : " "}${sy}h0`;
    }
    px = x;
    py = y;
  });
  return d;
}
