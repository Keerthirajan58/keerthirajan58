// Draws the "Open source" pulse: live GitHub numbers in a row of stat tiles, then the
// status of my upstream pull requests. scripts/live.mjs redraws it every week from fresh
// data, so every number is computed from `live` and data/profile.json, and every line of
// text is measured and fitted so that new data cannot overflow the sheet.
//
// Two layouts share one sheet. The wide one (tiles and the pull-request list) is the
// default. When the image is shown narrower than BREAKPOINT css px (a phone), a media
// query swaps in a compact grid of the same tiles at sizes that stay readable there; the
// README's links under the image list the pull requests. Renderers without CSS keep
// the wide layout.
import { createText } from "./lib/text.mjs";
import { svgDoc, rect, n } from "./lib/svg.mjs";
import { monthYear, dayDate } from "./lib/dates.mjs";

const W = 1000;
const BREAKPOINT = 700; // css px: the banner's, so the full-width images change layout together
const MAX_ROWS = 7; // pull requests shown; the rest fold into "+N more"

const WIDE = {
  pad: 32, hero: 58, value: 32, valueMin: 22, label: 14, gap: 40,
  pill: 13.5, ref: 14, refMax: 290, summary: 16, date: 14, footer: 13.5, row: 40, pillH: 24,
};
const COMPACT = { pad: 40, hero: 84, value: 60, valueMin: 40, label: 34, colGap: 40 };


const STATUS = {
  merged: { label: "Merged", fg: "good", bg: "goodWash", icon: "check" },
  open: { label: "In review", fg: "navy", bg: "navyWash", icon: "clock" },
  draft: { label: "Draft", fg: "textSoft", bg: "raised", icon: "dots" },
  closed: { label: "Closed", fg: "muted", bg: "raised", icon: "cross" },
};

const probe = createText(); // measuring and cleaning only; each document draws with its own
const ref = (p) => `${p.owner ? `${p.owner}/` : ""}${p.name}#${p.number}`;

const toDate = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const count = (v) =>
  v == null || !Number.isFinite(+v) ? "—" : String(Math.round(+v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Keeps the characters a font can draw (accents fold to their base letter; the rest drop). */
function clean(str, font) {
  const ok = (c) => c === "?" || probe.normalize(c, font, { strict: false }) !== "?";
  let out = "";
  for (const ch of String(str ?? "")) {
    if (/\s/.test(ch)) out += " ";
    else if (ok(ch)) out += ch;
    else {
      const base = ch.normalize("NFKD").replace(/\p{M}/gu, "");
      if (base && base !== ch && [...base].every(ok)) out += base;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

function buildModel(profile, live) {
  const key = (repo, num) => `${String(repo).toLowerCase()}#${num}`;
  const curated = new Map((profile.openSource || []).map((p) => [key(p.repo, p.number), p]));

  const prs = (live.pullRequests || [])
    .filter((p) => p && p.repo && p.number != null && STATUS[p.status])
    .map((p) => {
      const repo = String(p.repo);
      const slash = repo.indexOf("/");
      const shown = toDate(p.status === "merged" ? p.mergedAt : p.openedAt);
      return {
        status: p.status,
        owner: clean(slash > 0 ? repo.slice(0, slash) : "", "mono"),
        name: clean(slash > 0 ? repo.slice(slash + 1) : repo, "mono"),
        number: clean(p.number, "mono"),
        summary: clean(curated.get(key(p.repo, p.number))?.summary || p.title || p.summary || "", "sans"),
        date: monthYear(shown, profile.timeZone),
        time: shown ? shown.getTime() : -Infinity,
        repo: repo.toLowerCase(),
        url: p.url || `https://github.com/${repo}/pull/${p.number}`,
      };
    })
    .sort((a, b) => b.time - a.time || (+b.number || 0) - (+a.number || 0));

  const merged = prs.filter((p) => p.status === "merged").length;
  // Drafts are not in review yet on GitHub, so this counts open, ready-for-review PRs only
  // (it matches the "In review" pills); drafts still appear in the list with a Draft pill.
  const review = prs.filter((p) => p.status === "open").length;
  const repos = new Set(prs.map((p) => p.repo)).size;
  const pkg = live.package || {};
  const pkgName = clean(pkg.name || profile.package?.name || "", "sans");
  const version = clean(pkg.version || "", "sansSemi");

  const num = (s) => [{ s, font: "sansSemi", tone: "text" }];
  // Contributions are optional in the live data (null when the token cannot read the
  // calendar); without them the tile is left out and the row has no hero.
  const contributions = live.contributionsLastYear;
  const tiles = [
    ...(contributions != null && Number.isFinite(+contributions)
      ? [{ label: "Contributions in the last year", parts: num(count(contributions)), hero: true }]
      : []),
    { label: "PRs merged upstream", parts: num(String(merged)) },
    { label: "PRs in review", parts: num(String(review)) },
    { label: "Upstream repos", parts: num(String(repos)) },
    version && pkgName
      ? {
          label: "Latest release",
          // when "name version" is too wide, the name moves into the label
          short: `Latest ${pkgName} release`,
          parts: [{ s: `${pkgName} `, font: "sans", tone: "textSoft" }, { s: version, font: "sansSemi", tone: "text" }],
        }
      : { label: pkgName ? `Latest ${pkgName} release` : "Latest release", parts: num(version || "—") },
  ];

  const fetched = toDate(live.fetchedAt);
  const updated = fetched ? `Updated ${dayDate(fetched, profile.timeZone)}` : "";
  const footer = updated ? `${updated} · refreshed weekly` : "Refreshed weekly";
  const text = (t) => t.parts.map((p) => p.s).join("");
  const desc =
    `${tiles.map((t) => `${t.label}: ${text(t)}.`).join(" ")} ` +
    prs.map((p) => `${STATUS[p.status].label}: ${ref(p)}, ${p.summary}${p.date ? `, ${p.date}` : ""}.`).join(" ") +
    ` ${footer}.`;

  return { tiles, prs, footer, updated: updated || "Refreshed weekly", desc };
}

const partsWidth = (parts, size) => parts.reduce((w, p) => w + probe.measure(p.s, { font: p.font, size }), 0);
const labelWidth = (it, S) => probe.measure(it.label, { font: "sans", size: S.label });
const valueWidth = (it) => partsWidth(it.parts, it.size);
const tileWidth = (it, S) => Math.max(labelWidth(it, S), valueWidth(it));
const copyTile = (t, size) => ({ ...t, parts: t.parts.map((p) => ({ ...p })), size });

/** Fits a tile into `max`: the name moves into the label, then the value shrinks, then an ellipsis. */
function shorten(it, max, S) {
  if (valueWidth(it) > max && it.parts.length > 1) {
    it.parts = it.parts.slice(-1);
    it.label = it.short || it.label;
  }
  while (valueWidth(it) > max && it.size > S.valueMin) it.size -= 1;
  const last = it.parts.at(-1);
  if (valueWidth(it) > max) last.s = probe.fit(last.s, max, { font: last.font, size: it.size });
  if (labelWidth(it, S) > max) it.label = probe.fit(it.label, max, { font: "sans", size: S.label });
  return it;
}

/** Wide layout: tiles left to right between x0 and x1, with equal gaps between their contents. */
function layoutRow(tiles, x0, x1, S) {
  const items = tiles.map((t) => copyTile(t, t.hero ? S.hero : S.value));
  const avail = x1 - x0;
  const total = () => items.reduce((s, it) => s + tileWidth(it, S), 0) + S.gap * (items.length - 1);
  // Too wide (a long version string, say): shorten the widest value just enough; labels
  // are never cut. As a last resort the hero steps down towards the other values.
  for (let guard = 0; total() > avail && guard < 8; guard++) {
    const valueBound = items.filter((it) => !it.hero && valueWidth(it) >= labelWidth(it, S));
    if (!valueBound.length) break;
    const widest = valueBound.sort((a, b) => valueWidth(b) - valueWidth(a))[0];
    shorten(widest, valueWidth(widest) - (total() - avail), S);
  }
  const hero = items.find((it) => it.hero);
  while (hero && total() > avail && hero.size > S.value) hero.size -= 2;
  const widths = items.map((it) => tileWidth(it, S));
  const gap = (avail - widths.reduce((a, b) => a + b, 0)) / (items.length - 1);
  let x = x0;
  return items.map((it, i) => {
    const out = { ...it, x, gap };
    x += widths[i] + gap;
    return out;
  });
}

function icon(kind, cx, cy, color) {
  const s = `fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`;
  if (kind === "check") return `<path d="M${n(cx - 4.4)} ${n(cy + 0.3)}l3 3 5.9-6.4" ${s}/>`;
  if (kind === "clock") return `<circle cx="${n(cx)}" cy="${n(cy)}" r="5.3" ${s}/><path d="M${n(cx)} ${n(cy - 2.7)}V${n(cy)}h2.3" ${s}/>`;
  if (kind === "cross") return `<path d="M${n(cx - 3.4)} ${n(cy - 3.4)}l6.8 6.8m0-6.8l-6.8 6.8" ${s}/>`;
  return [-4, 0, 4].map((d) => `<circle cx="${n(cx + d)}" cy="${n(cy)}" r="1.4" fill="${color}"/>`).join("");
}

/**
 * A live dot on a soft halo. Its ping ripples twice after load and then rests hidden, so
 * without motion (or once it has run) the dot is steady.
 */
const liveDot = (x, y, r, t) =>
  `<g transform="translate(${n(x)} ${n(y)})"><circle r="${2 * r}" fill="${t.accentWash}"/><circle class="ping" r="${r}" fill="${t.accent}" opacity="0"/><circle r="${r}" fill="${t.accent}"/></g>`;

function drawParts(tx, it, x, y, t) {
  const out = [];
  for (const p of it.parts) {
    out.push(tx.draw(p.s, { x, y, font: p.font, size: it.size, fill: t[p.tone], strict: false }));
    x += tx.measure(p.s, { font: p.font, size: it.size });
  }
  return out.join("");
}

/**
 * The wide layout: tile row, pull-request list, footer. Returns its markup and height,
 * which is at least `minHeight` (spare room is split above and below the list).
 */
function wide(m, t, tx, minHeight) {
  const S = WIDE;
  const out = [];
  const x0 = S.pad;
  const x1 = W - S.pad;
  const cap = (font, size) => tx.metrics(font, size).capHeight;

  // Stat tiles: values share one baseline and labels another; hairlines divide the tiles.
  const tiles = layoutRow(m.tiles, x0, x1, S);
  const yValue = 30 + Math.max(...tiles.map((it) => cap("sansSemi", it.size)));
  const yLabel = yValue + 26;
  const bandBottom = yLabel + 26;
  tiles.forEach((it, i) => {
    if (i > 0) {
      const dx = it.x - it.gap / 2;
      out.push(`<path d="M${n(dx)} ${n(yValue - cap("sansSemi", S.value))}V${n(yLabel + 3)}" stroke="${t.line}"/>`);
    }
    out.push(drawParts(tx, it, it.x, yValue, t));
    out.push(tx.draw(it.label, { x: it.x, y: yLabel, font: "sans", size: S.label, fill: t.muted }));
  });
  out.push(`<path d="M1 ${n(bandBottom)}H${W - 1}" stroke="${t.line}"/>`);

  // Pull requests: status pill (icon and word), owner/repo#number, summary, date.
  const rows = m.prs.slice(0, MAX_ROWS);
  const hidden = m.prs.length - rows.length;
  const pillPad = 10;
  const iconW = 12;
  const pillCol = Math.max(...Object.values(STATUS).map((st) => pillPad + iconW + 6 + tx.measure(st.label, { font: "sansSemi", size: S.pill }) + pillPad));
  const refX = x0 + pillCol + 20;
  const mono = (s) => tx.measure(s, { font: "mono", size: S.ref });
  const refW = Math.min(S.refMax, Math.max(0, ...rows.map((p) => mono(ref(p)))));
  const sumX = refX + refW + 24;
  const dateW = Math.max(0, ...rows.map((p) => tx.measure(p.date, { font: "mono", size: S.date })));
  const sumMax = x1 - dateW - 24 - sumX;

  const listH = (rows.length || 1) * S.row + (hidden > 0 ? 34 : 0);
  const spare = Math.max(0, minHeight - (bandBottom + 6 + listH + 6 + 58));
  const listTop = bandBottom + 6 + spare / 2;
  rows.forEach((p, i) => {
    const rowTop = listTop + i * S.row;
    const cy = rowTop + S.row / 2;
    const base = cy + cap("sans", S.summary) / 2;
    if (i > 0) out.push(`<path d="M${x0} ${n(rowTop)}H${x1}" stroke="${t.line}"/>`);
    const st = STATUS[p.status];
    out.push(rect({ x: x0, y: cy - S.pillH / 2, w: pillCol, h: S.pillH, r: S.pillH / 2, fill: t[st.bg] }));
    out.push(icon(st.icon, x0 + pillPad + iconW / 2, cy, t[st.fg]));
    out.push(tx.draw(st.label, { x: x0 + pillPad + iconW + 6, y: cy + cap("sansSemi", S.pill) / 2, font: "sansSemi", size: S.pill, fill: t[st.fg] }));
    // owner/repo#number, fitted: drop the owner first, then shorten the repo
    let owner = p.owner ? `${p.owner}/` : "";
    let name = p.name;
    const num = `#${p.number}`;
    if (mono(owner + name + num) > refW) owner = "";
    if (mono(name + num) > refW) name = tx.fit(name, refW - mono(num), { font: "mono", size: S.ref });
    let x = refX;
    for (const [s, fill] of [[owner, t.muted], [name, t.textSoft], [num, t.muted]]) {
      if (!s) continue;
      out.push(tx.draw(s, { x, y: base, font: "mono", size: S.ref, fill, strict: false }));
      x += mono(s);
    }
    const sum = tx.fit(p.summary, sumMax, { font: "sans", size: S.summary });
    out.push(tx.draw(sum, { x: sumX, y: base, font: "sans", size: S.summary, fill: p.status === "closed" ? t.muted : t.text, strict: false }));
    if (p.date) out.push(tx.draw(p.date, { x: x1, y: base, font: "mono", size: S.date, fill: t.muted, anchor: "end" }));
  });
  let listBottom = listTop + rows.length * S.row;
  if (!rows.length) {
    out.push(tx.draw("No upstream pull requests yet", { x: W / 2, y: listTop + S.row / 2 + cap("sans", S.summary) / 2, font: "sans", size: S.summary, fill: t.muted, anchor: "middle" }));
    listBottom += S.row;
  }
  if (hidden > 0) {
    out.push(`<path d="M${x0} ${n(listBottom)}H${x1}" stroke="${t.line}"/>`);
    out.push(tx.draw(`+${hidden} more`, { x: refX, y: listBottom + 17 + cap("mono", S.ref) / 2, font: "mono", size: S.ref, fill: t.muted }));
    listBottom += 34;
  }
  listBottom += 6 + spare / 2;

  // Footer: when the data was fetched.
  out.push(`<path d="M1 ${n(listBottom)}H${W - 1}" stroke="${t.line}"/>`);
  const yFoot = listBottom + 32;
  out.push(liveDot(x0 + 5, yFoot - cap("mono", S.footer) / 2, 4, t));
  out.push(tx.draw(m.footer, { x: x0 + 18, y: yFoot, font: "mono", size: S.footer, fill: t.muted }));
  out.push(tx.draw("Source: GitHub · PyPI", { x: x1, y: yFoot, font: "mono", size: S.footer, fill: t.muted, anchor: "end" }));
  return { body: out.join(""), height: Math.ceil(yFoot + 26) };
}

/**
 * The compact layout: the same tiles in two columns, sized for a phone. plan() measures
 * it; draw() places it in a sheet of height H. Each value sits close above its label, and
 * the gaps between rows stay clearly wider than that, so every tile reads as its own
 * group. Spare height is shared evenly by the top and bottom margins and those gaps. The
 * sheet is kept tall enough for the least spacing; in a shorter one the grid would scale.
 */
const compact = {
  toLabel: 44, // value baseline to label baseline (clears a "g" descender in the value)
  space: [28, 36], // least margin (top, bottom), least gap (label baseline to next row's cap)
  dot: 9, // live-dot radius: the dot is as tall as the label's x-height
  dotGap: 16, // from the dot's edge to its text (the halo clears the text)

  plan(m) {
    const S = COMPACT;
    const avail = W - 2 * S.pad - S.colGap;
    const colL = Math.round(avail * 0.53);
    const widths = [colL, avail - colL];
    const tiles = m.tiles.map((tile, i) => shorten(copyTile(tile, tile.hero ? S.hero : S.value), widths[i % 2], S));
    // Two tiles a row. The "updated" line has no value: it takes the label line of the
    // last row's free half, or, when the tiles fill every row, a line under the grid.
    const live = { live: true, label: m.updated };
    const rows = [];
    for (let i = 0; i < tiles.length; i += 2) rows.push({ cells: tiles.slice(i, i + 2) });
    if (rows.at(-1)?.cells.length === 1) rows.at(-1).cells.push(live);
    else rows.push({ cells: [live], note: true });
    for (const row of rows) {
      // a row runs from its tallest cap to its label baseline
      row.cap = row.note
        ? probe.metrics("sans", S.label).capHeight
        : Math.max(...row.cells.filter((c) => !c.live).map((c) => probe.metrics("sansSemi", c.size).capHeight));
      row.toLabel = row.note ? 0 : this.toLabel;
    }
    const content = rows.reduce((a, r) => a + r.cap + r.toLabel, 0);
    const [margin, gap] = this.space;
    const minHeight = Math.ceil(content + 2 * margin + (rows.length - 1) * gap);
    return { rows, widths, cols: [S.pad, S.pad + colL + S.colGap], content, minHeight };
  },

  draw(plan, t, tx, H) {
    const S = COMPACT;
    const out = [];
    const { rows, widths, cols, content } = plan;
    const [margin, least] = this.space;
    const share = Math.max(0, H - plan.minHeight) / (rows.length + 1);
    const gap = least + share;
    const fit = Math.min(1, (H - 2 * margin) / (content + (rows.length - 1) * least));
    const valueCap = tx.metrics("sansSemi", S.value).capHeight;
    const xHeight = tx.metrics("sans", S.label).xHeight;
    const label = (str, x, y, w) =>
      tx.draw(probe.fit(str, w, { font: "sans", size: S.label }), { x, y, font: "sans", size: S.label, fill: t.muted, strict: false });
    // "Updated …" with the live dot inline before it, centred on the text's x-height
    const status = (str, x, y, w) => {
      const indent = 2 * this.dot + this.dotGap;
      return liveDot(x + this.dot, y - xHeight / 2, this.dot, t) + label(str, x + indent, y, w - indent);
    };
    let y = 0;
    let gridTop = null;
    let gridBottom = null;
    rows.forEach((row, r) => {
      y += (r ? gap : 0) + row.cap;
      const yv = y; // value baseline
      y += row.toLabel; // label baseline
      row.cells.forEach((c, k) => {
        const x = cols[k];
        if (row.note) out.push(status(c.label, x, yv, W - S.pad - x));
        else if (c.live) out.push(status(c.label, x, y, widths[k]));
        else out.push(drawParts(tx, c, x, yv, t), label(c.label, x, y, widths[k]));
      });
      if (row.cells.length === 2) {
        gridTop ??= yv - valueCap;
        gridBottom = y + 6;
      }
    });
    if (gridTop != null) {
      const divX = cols[1] - S.colGap / 2;
      out.push(`<path d="M${n(divX)} ${n(gridTop)}V${n(gridBottom)}" stroke="${t.line}" stroke-width="2"/>`);
    }
    // the grid, from its first cap to its last baseline, is centred in the sheet
    const oy = (H - y * fit) / 2;
    const tf = fit < 1 ? `translate(${n((W - W * fit) / 2)} ${n(oy)}) scale(${n(fit)})` : `translate(0 ${n(oy)})`;
    return `<g transform="${tf}">${out.join("")}</g>`;
  },
};

function render(m, t) {
  const tx = createText();
  const plan = compact.plan(m);
  const w = wide(m, t, tx, plan.minHeight);
  const H = w.height;
  const c = compact.draw(plan, t, tx, H);
  const sheet = rect({ x: 1, y: 1, w: W - 2, h: H - 2, r: 16, fill: t.canvas, stroke: t.line, attrs: 'class="sheet"' });
  const style =
    `.c{display:none}` +
    `@media (max-width:${BREAKPOINT}px){.w{display:none}.c{display:inline}.sheet{stroke-width:2.5}}` +
    // Two ripples (4.8 s in all), then the motion ends by itself: the ripple rests hidden
    // and the dot steady. Reduced motion skips it (svgDoc), leaving the same steady dot.
    `.ping{transform-box:fill-box;transform-origin:center;animation:ping 2.4s cubic-bezier(.2,.6,.3,1) 2}` +
    `@keyframes ping{0%{opacity:.45;transform:scale(1)}80%,100%{opacity:0;transform:scale(2.8)}}`;
  return svgDoc({
    width: W,
    height: H,
    title: "Open-source pulse",
    desc: m.desc,
    defs: tx.defs(),
    style,
    body: `${sheet}<g class="w">${w.body}</g><g class="c" display="none">${c}</g>`,
  });
}

/** The sheet as Markdown, for the text version the README links under the image. */
function markdown(m) {
  const cell = (s) => String(s).replace(/\|/g, "\\|");
  const out = ["## Open source", ""];
  for (const t of m.tiles) out.push(`- ${t.label}: ${t.parts.map((p) => p.s).join("").trim()}`);
  out.push("");
  if (m.prs.length) {
    out.push("My upstream pull requests, newest first:", "", "| Status | Pull request | Summary | Month |", "| --- | --- | --- | --- |");
    for (const p of m.prs) out.push(`| ${STATUS[p.status].label} | [${cell(ref(p))}](${p.url}) | ${cell(p.summary)} | ${p.date || "—"} |`);
  } else out.push("No upstream pull requests yet.");
  out.push("", `${m.footer}.`);
  return out.join("\n") + "\n";
}

export function outputs({ profile, live }) {
  const model = buildModel(profile, live);
  return [{ file: "pulse", text: markdown(model), render: (theme) => render(model, theme) }];
}
