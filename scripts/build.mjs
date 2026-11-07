// Draws the static profile images into assets/: the banner, the typing line, the
// featured-work cards and the footer, each in a light and a dark version.
// Usage: npm run build [-- --only=banner,cards]
import fs from "node:fs";
import { themes } from "./lib/theme.mjs";

const MODULES = ["banner", "typing", "cards", "footer"];

const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const profile = JSON.parse(fs.readFileSync("data/profile.json", "utf8"));
const ctx = { profile, portrait: JSON.parse(fs.readFileSync("data/portrait.json", "utf8")) };

fs.mkdirSync("assets", { recursive: true });
for (const name of MODULES) {
  if (only.length && !only.includes(name)) continue;
  const mod = await import(`./${name}.mjs`);
  for (const out of mod.outputs(ctx)) {
    for (const [mode, theme] of Object.entries(themes)) {
      const file = `assets/${out.file}-${mode}.svg`;
      fs.writeFileSync(file, out.render(theme) + "\n");
      console.log(`${file}  ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
    }
  }
}
