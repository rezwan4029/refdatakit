# Coverage Explorer

Browser front-end for RefDataKit, deployed to GitHub Pages at
**[rezwan4029.github.io/refdatakit](https://rezwan4029.github.io/refdatakit/)**.

Vite + React + TypeScript. It loads data through
[`@rezwan4029/refdatakit`](https://www.npmjs.com/package/@rezwan4029/refdatakit),
so the site always shows what the published package actually contains. If the
package is not installed, it falls back to reading `../datasets/` directly so
local dataset edits can be previewed before a release.

## Development

```sh
npm install
npm run dev      # http://localhost:5173/refdatakit/
```

The dev server runs `build-data` first. Note the `/refdatakit/` base path — the
site is built for a project GitHub Pages URL, so `http://localhost:5173/` will
not serve it.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Regenerate data, then start Vite with HMR |
| `npm run build` | Regenerate data, type-check, and build to `dist/` |
| `npm run build-data` | Only regenerate `public/data/` from the package or repo |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |

## Data pipeline

`scripts/build-data.mjs` pre-builds small static JSON files into
`public/data/` — one per country plus an `index.json` summary — so the browser
never parses the full datasets. Each country file carries reconciled totals:
`institutions.total`, `byTag` (an institution appears once per tag it has),
`byPrimaryTag` (every institution counted exactly once), `mapped`/`unmapped`
counts, and pins carrying `cityName` and `localNames` with language tags.

Because `public/data/` is generated, it is committed but must be regenerated
whenever `datasets/` changes. The Pages workflow does this automatically.

## Structure

```text
scripts/build-data.mjs   Pre-builds public/data/*.json from the package
src/pages/IndexPage.tsx  Country index with per-country totals
src/pages/CountryPage.tsx Institution browser: city groups + details panel
src/constants.ts         Per-country themes (flag-derived), tag palettes, labels
src/hooks/useCountryData.ts  Fetches the pre-built JSON
public/data/             Generated country summaries and pins (committed)
```

`docs/` is served from `/refdatakit/` on GitHub Pages; `vite.config.ts` sets the
matching `base`.
