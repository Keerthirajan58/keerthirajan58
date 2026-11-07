// Small helpers for writing standalone SVG documents that GitHub can show in a README.
// GitHub serves README images with a strict content policy: no scripts, no external
// fonts or images. Inline <style> (including CSS animation) is allowed.
export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const n = (v) => +(+v).toFixed(2);

/**
 * A complete SVG document. `title` names the image for assistive tech; README alt
 * text carries the full description. Motion always stops for reduced-motion users.
 * `par` sets preserveAspectRatio where the default (xMidYMid meet) does not suit.
 */
export function svgDoc({ width, height, title, desc, defs = "", style = "", body, par }) {
  const css = `${style}@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"${par ? ` preserveAspectRatio="${par}"` : ""} role="img" aria-labelledby="t"${desc ? ' aria-describedby="d"' : ""}>`,
    `<title id="t">${esc(title)}</title>`,
    desc ? `<desc id="d">${esc(desc)}</desc>` : "",
    `<style>${css}</style>`,
    defs ? `<defs>${defs}</defs>` : "",
    body,
    `</svg>`,
  ].join("");
}

/** Rounded rectangle; r may be a number or [tl, tr, br, bl]. */
export function rect({ x, y, w, h, r = 0, fill = "none", stroke, sw = 1, attrs = "" }) {
  const s = stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : "";
  if (!Array.isArray(r))
    return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r ? ` rx="${n(r)}"` : ""} fill="${fill}"${s} ${attrs}/>`;
  const [tl, tr, br, bl] = r;
  const d = `M${n(x + tl)} ${n(y)}H${n(x + w - tr)}${tr ? `A${tr} ${tr} 0 0 1 ${n(x + w)} ${n(y + tr)}` : ""}V${n(y + h - br)}${br ? `A${br} ${br} 0 0 1 ${n(x + w - br)} ${n(y + h)}` : ""}H${n(x + bl)}${bl ? `A${bl} ${bl} 0 0 1 ${n(x)} ${n(y + h - bl)}` : ""}V${n(y + tl)}${tl ? `A${tl} ${tl} 0 0 1 ${n(x + tl)} ${n(y)}` : ""}Z`;
  return `<path d="${d}" fill="${fill}"${s} ${attrs}/>`;
}

