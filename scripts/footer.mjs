// The footer: a calm cluster of bubbles that closes the README, centred under the skills.
// Soft discs in the Clear Air glow colours and two thin crimson rings rise from the bottom
// edge and dissolve into the page; small glass bubbles drift above them, and the KS mark
// from the portfolio sits on top as a glass orb. It is static and decorative (the README
// gives it alt=""), and every shape is placed by hand, so each build is byte-identical.
//
// Phone state: under BREAKPOINT css px the image shows at about a third of its desktop
// size, so the cluster grows by PHONE_SCALE about its bottom centre, the rings and rims get
// thicker, the smallest bubble drops out and the mark grows until its monogram is about
// 10 px on screen. Renderers without CSS keep the desktop layout.
import { svgDoc, n } from "./lib/svg.mjs";

const W = 1000;
const H = 150;
const BREAKPOINT = 700; // css px: the banner's, so the full-width images change layout together
const FADE_FROM = 0.6; // share of the height where the bottom fade begins
const PHONE_SCALE = 1.15; // the cluster grows about its bottom centre on phones

// Soft discs, back to front: [cx, cy, r, theme colour, opacity light, opacity dark].
// Their widest points sit above the fade, so they read as bubbles, not hills.
const DISCS = [
  [446, 112, 64, "glowB", 0.85, 1],
  [364, 128, 40, "glowC", 1, 0.8],
  [550, 108, 56, "glowA", 0.75, 0.95],
  [632, 126, 38, "accentWash", 1, 1],
];
// Thin crimson rings: [cx, cy, r, stroke width, phone stroke width].
const RINGS = [
  [602, 88, 44, 2.5, 6],
  [350, 80, 19, 2, 5],
];
// Glass bubbles: [cx, cy, r, shown on phones].
const GLASS = [
  [408, 36, 9, false],
  [678, 48, 11, true],
];
// The KS mark: centre and radius, wide and phone. The monogram's font size is 21/29 of r
// (Unbounded, cap height .75 em): 17 units on desktop (15 px at 846 px) and, at r 42,
// 30 units on phones (9.2 px at 308 px).
const MARK = { cx: 500, cy: 58, r: 24, phoneR: 42 };

// The monogram from the portfolio's brand mark (Unbounded ExtraBold outlines), in the
// mark's own 64-unit box, where the orb is centred at (32, 32) with radius 29.
const KS =
  "M19.50 40.27L15.07 40.27L15.07 24.52L19.92 24.52L19.92 36.43L18.66 35.40L27.04 24.52L32.16 24.52L19.50 40.27ZM26.85 40.27L22.61 32.90L26.20 30.01L32.39 40.27L26.85 40.27ZM31.58 35.11L31.58 35.11L36.54 35.11Q36.62 35.66 37.07 36.06Q37.53 36.47 38.30 36.69Q39.08 36.91 40.13 36.91L40.13 36.91Q41.58 36.91 42.39 36.58Q43.20 36.24 43.20 35.55L43.20 35.55Q43.20 35.07 42.73 34.76Q42.27 34.46 40.91 34.35L40.91 34.35L38.13 34.12Q34.73 33.87 33.21 32.64Q31.69 31.41 31.69 29.33L31.69 29.33Q31.69 27.63 32.67 26.49Q33.66 25.34 35.43 24.76Q37.19 24.17 39.58 24.17L39.58 24.17Q41.89 24.17 43.69 24.82Q45.48 25.47 46.55 26.66Q47.61 27.84 47.71 29.42L47.71 29.42L42.75 29.42Q42.67 28.96 42.28 28.61Q41.89 28.26 41.18 28.07Q40.47 27.88 39.48 27.88L39.48 27.88Q38.18 27.88 37.41 28.20Q36.64 28.51 36.64 29.14L36.64 29.14Q36.64 29.61 37.09 29.90Q37.55 30.20 38.76 30.30L38.76 30.30L41.81 30.55Q44.08 30.72 45.47 31.26Q46.87 31.79 47.50 32.70Q48.13 33.62 48.13 35.00L48.13 35.00Q48.13 36.68 47.12 37.95Q46.11 39.23 44.30 39.93Q42.48 40.63 40.05 40.63L40.05 40.63Q37.55 40.63 35.66 39.94Q33.77 39.25 32.70 38.00Q31.62 36.75 31.58 35.11Z";

// Portfolio colours for the glass (src/components/ui/BrandMark.tsx and tokens.css).
const IRIS = [[0, "#ffb3c4"], [0.35, "#c6d6ff"], [0.7, "#c4efdd"], [1, "#ffcfa8"]]; // the mark's rim
const PEARL = ["#ffffff", "#fbeef2", "#dbe6f8"]; // the mark's fill
const NIGHT = ["#2c2b32", "#212026", "#1b1a20"]; // --bubble-a/b/c in the dark theme

export function outputs() {
  return [{ file: "footer", render }];
}

function render(t) {
  const dark = t.mode === "dark";
  const discs = DISCS.map(([cx, cy, r, c, ol, od]) => circle(cx, cy, r, `fill="${t[c]}"${op(dark ? od : ol)}`)).join("");
  const rings = RINGS.map(([cx, cy, r, sw], i) =>
    circle(cx, cy, r, `fill="none" stroke="${t.accent}" stroke-width="${sw}" class="r${i}"`),
  ).join("");
  const glass = GLASS.map(([cx, cy, r, phone]) => bubble(cx, cy, r, dark, phone ? "" : "w")).join("");
  const style =
    `.c{display:none}` +
    `@media (max-width:${BREAKPOINT}px){.w{display:none}.c{display:inline}` +
    RINGS.map(([, , , , p], i) => `.r${i}{stroke-width:${p}}`).join("") +
    `.rim{stroke-width:3.4}` +
    `.cl{transform:matrix(${PHONE_SCALE},0,0,${PHONE_SCALE},${n((1 - PHONE_SCALE) * (W / 2))},${n((1 - PHONE_SCALE) * H)})}}`;
  return svgDoc({
    width: W,
    height: H,
    title: "Decorative footer",
    defs: fade() + glassDefs(dark) + markDef(t),
    style,
    body: `<g mask="url(#fm)"><g class="cl">${discs}${rings}${glass}</g></g>${mark(MARK.r, "w")}${mark(MARK.phoneR, "c", ' display="none"')}`,
  });
}

const op = (o) => (o === 1 ? "" : ` opacity="${o}"`);
const circle = (cx, cy, r, attrs) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${attrs}/>`;
const stops = (list) => list.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a === 1 ? "" : ` stop-opacity="${a}"`}/>`).join("");

/** A vertical mask: opaque down to FADE_FROM, then an eased fade to nothing at the bottom edge. */
function fade() {
  const list = [];
  for (let i = 0, steps = 6; i <= steps; i++) {
    const u = i / steps;
    list.push([n(FADE_FROM + (1 - FADE_FROM) * u), "#fff", n(1 - u * u * (3 - 2 * u))]); // smoothstep
  }
  return (
    `<linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">${stops(list)}</linearGradient>` +
    `<mask id="fm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#fg)"/></mask>`
  );
}

/** Soap-bubble glass (clear in the middle, tinted at the edge) and the iridescent rim. */
function glassDefs(dark) {
  const edge = dark
    ? [[0, IRIS[1][1], 0.03], [0.7, IRIS[1][1], 0.08], [1, IRIS[1][1], 0.28]]
    : [[0, PEARL[0], 0.25], [0.7, PEARL[1], 0.5], [1, PEARL[2], 0.9]];
  return (
    `<radialGradient id="bf" cx=".42" cy=".36" r=".7">${stops(edge)}</radialGradient>` +
    `<linearGradient id="br" x1="0" y1="0" x2="1" y2="1">${stops(IRIS)}</linearGradient>`
  );
}

/** A small glass bubble: tinted fill, iridescent rim and a highlight. */
function bubble(cx, cy, r, dark, cls) {
  const hx = cx - 0.36 * r, hy = cy - 0.4 * r;
  return (
    `<g${cls ? ` class="${cls}"` : ""}>` +
    circle(cx, cy, r, `fill="url(#bf)"`) +
    circle(cx, cy, r - 0.75, `fill="none" stroke="url(#br)" stroke-width="1.5" class="rim"${op(dark ? 0.7 : 1)}`) +
    `<ellipse cx="${n(hx)}" cy="${n(hy)}" rx="${n(0.28 * r)}" ry="${n(0.13 * r)}" fill="#fff"${op(dark ? 0.45 : 0.9)} transform="rotate(-32 ${n(hx)} ${n(hy)})"/>` +
    `</g>`
  );
}

/**
 * The brand mark in its own 64-unit box, reused at two sizes. Light: the portfolio's pearl
 * orb as it is. Dark: the same orb in the dark theme's bubble colours, with a light monogram
 * and the dark accent, so it sits quietly on the dark page instead of glaring.
 */
function markDef(t) {
  const night = t.mode === "dark";
  const fill = night ? NIGHT : PEARL;
  return (
    `<radialGradient id="kf" cx=".38" cy=".3" r=".8">${stops([[0, fill[0]], [0.55, fill[1]], [1, fill[2]]])}</radialGradient>` +
    `<g id="ks">` +
    `<circle cx="32" cy="33.5" r="29" fill="${night ? "#000" : "#0f1013"}" opacity="${night ? 0.4 : 0.08}"/>` +
    `<circle cx="32" cy="32" r="29" fill="url(#kf)"/>` +
    `<circle cx="32" cy="32" r="28" fill="none" stroke="url(#br)" stroke-width="3.2"${op(night ? 0.85 : 1)}/>` +
    (night
      ? `<ellipse cx="20.5" cy="15" rx="5.5" ry="2.4" fill="#fff" opacity=".5" transform="rotate(-32 20.5 15)"/>`
      : `<ellipse cx="21" cy="15.5" rx="9" ry="4.4" fill="#fff" opacity=".92" transform="rotate(-32 21 15.5)"/>`) +
    `<path d="M13.5 40.5a19 19 0 0 0 8.5 8.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="${night ? 0.18 : 0.8}"/>` +
    `<path d="${KS}" fill="${night ? t.text : "#0f1013"}"/>` +
    `<circle cx="47.5" cy="46.5" r="3.3" fill="${night ? t.accent : "#df212f"}"/>` +
    `</g>`
  );
}

/** Places the mark at MARK's centre with radius r. */
function mark(r, cls, attrs = "") {
  const s = +(r / 29).toFixed(4);
  return `<use href="#ks" class="${cls}"${attrs} transform="translate(${n(MARK.cx - 32 * s)} ${n(MARK.cy - 32 * s)}) scale(${s})"/>`;
}
