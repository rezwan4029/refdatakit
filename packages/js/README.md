# refdatakit

Source-aware regional reference data and validation tools for JavaScript and TypeScript.

Install from npm with `npm install refdatakit`. The package includes its versioned JSON datasets and makes no network requests to retrieve them.

```ts
import { getCities, getCountry, getInstitutions } from "refdatakit";

const bangladesh = await getCountry("BD");
const cities = await getCities("BD");
const institutions = await getInstitutions("BD");
```

Available accessors are `getCountries()`, `getCountry(code)`, `getCities(code)`, `getSubdivisions(code)`, and `getInstitutions(code)`. Missing country datasets return an empty array. Records use the shared JSON schemas. Per-file data licensing and attribution are in the bundled `dist/data/datasets/manifest.json`; MIT applies to SDK code.

The `refdatakit` command provides repository maintenance operations. `validateRepository(root)` and `sortRepository(root)` are also exported for contributor tooling.
