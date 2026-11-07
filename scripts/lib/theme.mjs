// Colours for the light and dark versions of every image. The palette follows the
// portfolio's "Clear Air" look (ink, crimson, blush and haze) and sits on GitHub's own
// page colours (#ffffff light, #0d1117 dark). Text tokens meet WCAG AA (4.5:1) on
// `canvas` and `surface` in both modes; `accent` is also safe for small text.
export const themes = {
  light: {
    mode: "light",
    page: "#ffffff", // GitHub's light page, for previews only
    canvas: "#ffffff", // window and card background
    surface: "#f6f8fa", // inset panels
    raised: "#eef1f5", // pills, title bars
    line: "#e3e7ec",
    lineStrong: "#d0d7de",
    text: "#0f1013",
    textSoft: "#3d434c",
    muted: "#5f6773",
    accent: "#d01f2c", // crimson
    accentWash: "#fdecec",
    navy: "#1f3a6b",
    navyWash: "#e8eef8",
    good: "#166d2f",
    goodWash: "#e6f4ea",
    warn: "#865800",
    warnWash: "#fff5d6",
    dot: "#1a1d23", // portrait dots
    dotAccent: "#d01f2c",
    glowA: "#f6cfcb", // blush
    glowB: "#d6e2f3", // haze
    glowC: "#ffe4d6", // peach
    shadow: "rgba(15,16,19,0.10)",
  },
  dark: {
    mode: "dark",
    page: "#0d1117", // GitHub's dark page, for previews only
    canvas: "#10141b",
    surface: "#151b23",
    raised: "#1c232d",
    line: "#252d38",
    lineStrong: "#30363d",
    text: "#e6edf3",
    textSoft: "#c2cad4",
    muted: "#9198a1",
    accent: "#ff6b74", // crimson, lifted for the dark page
    accentWash: "#3a1a1e",
    navy: "#a9c3ee",
    navyWash: "#172235",
    good: "#4ac26b",
    goodWash: "#12261a",
    warn: "#e3b341",
    warnWash: "#2b2210",
    dot: "#f3d9d6", // portrait dots (warm blush white)
    dotAccent: "#ff6b74",
    glowA: "#4a1c24", // wine
    glowB: "#18263f", // midnight
    glowC: "#3a2516", // amber
    shadow: "rgba(0,0,0,0.45)",
  },
};
