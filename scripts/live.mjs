// Draws the live profile images (Open source and Signals) into an output folder, from
// fresh GitHub and PyPI data, with live.md: the same numbers as text, which the README
// links under each image. The weekly workflow publishes that folder to the `output`
// branch, where the README reads them.
// Usage: node scripts/live.mjs --out dist [--fixture data/fixtures/live.json] [--only signals]
import fs from "node:fs";
import path from "node:path";
import { themes } from "./lib/theme.mjs";
import { fetchLive } from "./lib/live-data.mjs";

const MODULES = ["pulse", "signals"]; // the README's order, which live.md follows

const arg = (name) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (a) return a.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const out = arg("out") || "dist";
const only = (arg("only") || "").split(",").filter(Boolean);

const profile = JSON.parse(fs.readFileSync("data/profile.json", "utf8"));
const live = arg("fixture")
  ? JSON.parse(fs.readFileSync(arg("fixture"), "utf8"))
  : await fetchLive(profile);
const ctx = { profile, live };

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "live.json"), JSON.stringify(live, null, 2) + "\n");
const texts = [];
for (const name of MODULES) {
  if (only.length && !only.includes(name)) continue;
  const mod = await import(`./${name}.mjs`);
  for (const o of mod.outputs(ctx)) {
    if (o.text) texts.push(o.text);
    for (const [mode, theme] of Object.entries(themes)) {
      const file = path.join(out, `${o.file}-${mode}.svg`);
      fs.writeFileSync(file, o.render(theme) + "\n");
      console.log(`${file}  ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
    }
  }
}

// The same numbers as text, for readers who cannot see the images; the README links here.
if (!only.length) {
  const file = path.join(out, "live.md");
  const intro = `The numbers in the Open source and Signals images on [my GitHub profile](https://github.com/${profile.login}), as text. They are redrawn every week.`;
  fs.writeFileSync(file, ["# Open source and Signals, as text", "", intro, "", ...texts].join("\n"));
  console.log(file);
}
