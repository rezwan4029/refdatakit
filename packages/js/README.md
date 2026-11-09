# refdatakit

Source-aware regional reference data and validation tools for JavaScript and TypeScript.

Published package: [@rezwan4029/refdatakit on npm](https://www.npmjs.com/package/@rezwan4029/refdatakit).

Documentation: [JavaScript/TypeScript package guide](https://github.com/rezwan4029/refdatakit/blob/main/packages/js/README.md) · [Project overview](https://github.com/rezwan4029/refdatakit#readme) · [Python package guide](https://github.com/rezwan4029/refdatakit/blob/main/packages/python/README.md).

Install from npm with `npm install @rezwan4029/refdatakit`. The package includes its versioned JSON datasets and makes no network requests to retrieve them.

```ts
import { CountryCode, getCities, getCountry, getInstitutions } from "@rezwan4029/refdatakit";

const bangladesh = await getCountry(CountryCode.BD);
const cities = await getCities(CountryCode.BD);
const institutions = await getInstitutions(CountryCode.BD);
```

Available accessors are `getCountries()`, `getCountry(code)`, `getCities(code)`, `getSubdivisions(code)`, and `getInstitutions(code)`. Country arguments use the generated `CountryCode` enum. Missing country datasets return an empty array. Records use the shared JSON schemas. Per-file data licensing and attribution are in the bundled `dist/data/datasets/manifest.json`; MIT applies to SDK code.

The `refdatakit` command provides repository maintenance operations. `validateRepository(root)` and `sortRepository(root)` are also exported for contributor tooling.
