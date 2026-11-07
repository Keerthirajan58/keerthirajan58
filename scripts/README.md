# How the profile images are made

The profile README's own images (all but the badges, the GIFs and the skill icons) are SVGs
drawn by these scripts from [`data/profile.json`](../data/profile.json), in a light and a dark
version (the README's `<picture>` picks one to match the viewer's GitHub theme).

| Image | Script | Where it lives |
| --- | --- | --- |
| Banner (portrait and details) | `banner.mjs` | `assets/banner-*.svg` |
| Typing line | `typing.mjs` | `assets/typing-*.svg` |
| Featured work cards | `cards.mjs` | `assets/card-*.svg` |
| Footer | `footer.mjs` | `assets/footer-*.svg` |
| Signals (work by area and languages) | `signals.mjs` | `output` branch |
| Open source (numbers and pull requests) | `pulse.mjs` | `output` branch |

- **Static images:** edit `data/profile.json`, then run `npm run build` and commit `assets/`.
  - A banner row may have a third item: its wording on phones, where the keys are hidden.
    A `["---"]` row starts a new group of rows.
  - Keep `typing` to one line. A README image has no pause button, so its motion must end within
    5 s (WCAG 2.2.2); the build stops if the typing would run longer.
- **Pull requests:** `openSource` in `data/profile.json` lists them, and the live image fetches each
  one's status. When you add one, add its link to the README's "Pull requests:" line too, since an
  image cannot hold links.
- **Alt text:** the README describes each image in its alt text, by hand. When you change a card, a
  banner row, the typing line or `focus`, update the matching alt in README.md in the same commit.
- **Live images:** [`.github/workflows/live.yml`](../.github/workflows/live.yml) fetches fresh GitHub
  and PyPI data every Monday (and after any change here), redraws them and force-pushes them to the
  `output` branch, so `main` gets no automated commits. To draw them locally:
  `GH_TOKEN=$(gh auth token) node scripts/live.mjs --out dist`, or from saved data:
  `node scripts/live.mjs --out dist --fixture data/fixtures/live.json`. It also writes `live.md`, the
  same numbers as text, which the README links under each image. Languages are averaged per
  repository, so one large repository cannot outweigh the rest.
  GitHub pauses the Monday schedule after 60 days without activity in this repo, and the images then
  keep their last "Updated" date. To restart it: Actions > Live images > Enable workflow (or
  `gh workflow enable live.yml`), then Run workflow.
- **Text** is drawn from glyph outlines in `lib/glyphs.json` (JetBrains Mono, Inter and Unbounded, all under
  the SIL Open Font License; see `fonts/`), so it looks the same everywhere: GitHub serves README images
  with a policy that blocks web fonts. To rebuild the outlines, put the TTFs in `fonts/` and run `npm run fonts`.
- **Portrait:** `mask.swift` (macOS 14 or later, Vision) finds the subject in a photo (the portfolio's
  contact photo, not committed) and writes a soft mask; `portrait.mjs` turns the two into the brightness
  grid in `data/portrait.json` that the banner draws as dots:
  `mkdir -p .cache && swift scripts/mask.swift <photo> .cache/mask.png && npm run portrait -- <photo> .cache/mask.png`.

The building scripts need Node 22 and nothing else; `npm install` is only needed for `fonts` and `portrait`.
