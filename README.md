# RefDataKit

Published packages: [JavaScript/TypeScript on npm](https://www.npmjs.com/package/@rezwan4029/refdatakit) · [Python on PyPI](https://pypi.org/project/refdatakit/).

Public documentation: [JavaScript/TypeScript package guide](https://github.com/rezwan4029/refdatakit/blob/main/packages/js/README.md) · [Python package guide](https://github.com/rezwan4029/refdatakit/blob/main/packages/python/README.md).

RefDataKit standardizes public inputs into validated, versioned reference datasets. Its value is clean schemas, clear provenance, predictable access, and developer velocity—not ownership of underlying public facts. JavaScript/TypeScript and Python are the first runtimes; later language adapters will consume the same JSON Schema contracts and datasets.

## Regional Core

RefDataKit ships with an optimized regional core containing exactly these six countries:

- Bangladesh (`BD`)
- Bhutan (`BT`)
- Nepal (`NP`)
- Sri Lanka (`LK`)
- Singapore (`SG`)
- Maldives (`MV`)

The country file contains only these six records. Current city records cover Bangladesh and Singapore; subdivision and institution records cover Bangladesh. Contributions for the other countries can be added through community pull requests when source-backed data is ready.

Global expansion happens through community pull requests that contribute bounded, useful records using the established schemas and manifest provenance requirements. The project does not aim to pre-populate millions of global records. This keeps the repository manageable and makes source review, maintenance, and licensing practical.

Country and city records may carry macro-level coordinates. Institution records require `names.en` and a `names.languages` object keyed by ISO 639-1 codes. That object may be empty or contain any subset of verified official non-English names; missing translations can be added later. Localized aliases are limited to English and verified official local languages. Institution coordinates, precise locations, addresses, and logos are prohibited; institutions link hierarchically through `country_code` and `city_id` and may carry stable public external IDs such as Wikidata identifiers.

All runtime data is stored as version-controlled JSON in `datasets/`. SDKs and validators read only these local files; manifest source URLs document provenance and are never fetched during builds or runtime.

## Use the Library

The JavaScript and Python packages include the static JSON data. Accessors read local package files and make no network requests. Install from npm or PyPI after the packages are published.

Country arguments use the generated `CountryCode` enum in both SDKs. Its members are generated from the supported country records in `datasets/countries/data.json`.

### JavaScript and TypeScript

```sh
npm install @rezwan4029/refdatakit
```

```ts
import {
  getCities,
  getCountries,
  getCountry,
  getInstitutions,
  getSubdivisions,
  CountryCode,
} from "@rezwan4029/refdatakit";

const country = await getCountry(CountryCode.BD);
const cities = await getCities(CountryCode.BD);
const subdivisions = await getSubdivisions(CountryCode.BD);
const institutions = await getInstitutions(CountryCode.BD);
const countries = await getCountries();
```

Country-specific accessors accept a `CountryCode` enum member. A country with no file for a dataset returns an empty array for that accessor.

### Python

```sh
python -m pip install refdatakit
```

```python
from refdatakit import (
    CountryCode,
    get_cities,
    get_countries,
    get_country,
    get_institutions,
    get_subdivisions,
)

country = get_country(CountryCode.BD)
cities = get_cities(CountryCode.BD)
subdivisions = get_subdivisions(CountryCode.BD)
institutions = get_institutions(CountryCode.BD)
countries = get_countries()
```

Country-specific accessors accept a `CountryCode` enum member. Passing a raw string raises `TypeError`. A country with no file for a dataset returns an empty list for that accessor.

Dataset licensing and attribution are recorded per file in `datasets/manifest.json`. The MIT license applies to project code; data may have different terms.

## Repository Layout

```text
schemas/                         Shared JSON Schema contracts
datasets/                        Canonical JSON records and source manifest
  manifest.json                  Per-file sources, licenses, attribution, and checksum
  countries/data.json            Country identifiers and contributed language data
  subdivisions/by-country/       Country-partitioned administrative divisions
  cities/by-country/             Country-partitioned cities and localities
  institutions/by-country/       Universal entities, partitioned by country
packages/js/                     TypeScript SDK and CLI
packages/python/                 Python SDK and CLI
.github/workflows/               Automated checks
```

`institutions` uses the universal entity schema for schools, colleges, universities, corporations, civic organizations, religious buildings, and other directory entries. Localized names may be contributed incrementally. Records may also include `ownership: "public"` or `ownership: "private"` when the source states it. Country-relevant classifications such as `polytechnic` are controlled through `vocabularies.entity_tags` in `datasets/manifest.json`; the build generates the entity schema enum and TypeScript tag union from that list. Both runtime validators also apply the manifest vocabulary directly, so adding a tag requires no hand-edited SDK code.

## Provenance and Canonical Data

Every canonical dataset file is registered in `datasets/manifest.json` with its upstream source URL, license, attribution, and SHA-256 checksum. A dataset can list additional sources when its fields come from different sources. The six-country dataset combines GeoNames country identifiers and spoken-language lists (CC BY 4.0) with official-language values from Unicode CLDR (Unicode-3.0); the full Unicode license notice is in [`licenses/UNICODE-3.0.txt`](licenses/UNICODE-3.0.txt). Wikidata structured data is CC0-1.0; localized names sourced from Wikipedia retain CC BY-SA 4.0 attribution, and contributor translations are identified separately in the manifest. The manifest is the source of truth for active files and provenance.

The project source code is licensed under MIT; dataset records retain the source-specific licenses listed in the manifest. Empty country language arrays mean no value has been contributed or verified yet, not that the country has no such languages. Contributors can add values with source evidence. These licensing and provenance records do not guarantee zero legal risk or replace review of applicable source terms.

Dataset files and the manifest use RFC 8785 canonical JSON, UTF-8, NFC-normalized strings, and one trailing newline. Records in each dataset array are ordered by English name (case-insensitive), with stable IDs as tie-breakers. The validator warns about unsorted records but does not block otherwise valid data. `sort` reorders dataset records, canonicalizes their files, and refreshes the manifest checksums; it does not reorder language lists or manifest entries.

## Contributing Data

Contributions are welcome through pull requests. For routine updates, edit the existing country JSON file for the data type you are changing:

- Countries: `datasets/countries/data.json`
- Subdivisions: `datasets/subdivisions/by-country/{CC}.json`
- Cities and localities: `datasets/cities/by-country/{CC}.json`
- Institutions: `datasets/institutions/by-country/{CC}.json`

Follow the matching schema in `schemas/`. If an institution is in an existing city, its institution record can be added in one file. If the city is new, add its city record too and link the institution with that `city_id`. Institution records must not include coordinates, street addresses, or logos. `names.languages` may be empty or contain only the verified official-language names available; absent translations can be contributed later.

Each file's manifest entry records its source and license. When adding data from a different source, add an `additional_sources` entry with the source URL, license, attribution, and fields it supports. The sorter refreshes checksums, so contributors do not calculate them by hand. New dataset files also need a manifest entry.

From the repository root, normalize and validate the JSON with:

```sh
npm ci --prefix packages/js
npm --prefix packages/js run sort

python -m pip install -e "packages/python[dev]"
refdatakit validate .
```

The sort command canonicalizes the records and updates manifest checksums. CI checks both runtime validators, linters, and test suites on the pull request. In the PR description, summarize the records added or changed and identify their data source.

## Repository Checks

From the repository root:

```sh
npm ci --prefix packages/js
npm --prefix packages/js run lint
npm --prefix packages/js test
npm --prefix packages/js run validate
npm --prefix packages/js run sort

python -m pip install -e "packages/python[dev]"
ruff check packages/python/src packages/python/tests
pytest packages/python/tests
refdatakit validate .
refdatakit sort .
```

Both CLIs provide `validate` and `sort` commands. Validation errors fail the command; English-name ordering differences are reported as warnings so contributors can run `sort` to normalize records and checksums.
