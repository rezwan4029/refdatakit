# RefDataKit

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

## Using as a Library

The JavaScript and Python packages expose typed/local accessors and include the static dataset snapshot in release artifacts. After publication, install with `npm install refdatakit` or `python -m pip install refdatakit`. No network calls are made to retrieve data.

```ts
import { getCities, getCountry, getInstitutions } from "refdatakit";

const bangladesh = await getCountry("BD");
const cities = await getCities("BD");
const institutions = await getInstitutions("BD");
```

```python
from refdatakit import get_cities, get_country, get_institutions

bangladesh = get_country("BD")
cities = get_cities("BD")
institutions = get_institutions("BD")
```

Both SDKs also expose `get_countries`, `get_subdivisions(country_code)`, and `get_institutions(country_code)`; JavaScript uses camelCase names. `get_country(code)` returns `undefined`/`None` when the country is not in the regional core. Dataset licensing and attribution remain as listed per file in the bundled `datasets/manifest.json`; the MIT license applies to project code.

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

## Validation and Sorting

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
