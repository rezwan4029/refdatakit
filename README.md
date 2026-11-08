# RefDataKit

RefDataKit standardizes public inputs into validated, versioned reference datasets. Its value is clean schemas, clear provenance, predictable access, and developer velocity—not ownership of underlying public facts. JavaScript/TypeScript and Python are the first runtimes; later language adapters will consume the same JSON Schema contracts and datasets.

## Global Country Data and Bangladesh Pilot

The country dataset covers all 249 assigned ISO 3166-1 alpha-2 entries, including dependent territories. Country names and identifiers are populated globally; official and commonly spoken language arrays contain only source-verified contributions and may be empty when data has not yet been contributed. An empty array does not assert that a country has no such languages. Global city and locality data is deferred; the current subdivisions, city markers, and institutions cover Bangladesh (`BD`) only.

Country and city records may carry macro-level coordinates. Institution records use `names.en` plus `names.languages` keyed by ISO 639-1 code for each official non-English language with an ISO 639-1 code, stable city links, external identifiers, and controlled classification tags; coordinates, addresses, and logos are prohibited.

All runtime data is stored as version-controlled JSON in `datasets/`. SDKs and validators read only these local files; manifest source URLs document provenance and are never fetched during builds or runtime.

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

`institutions` uses the universal entity schema for schools, colleges, universities, corporations, civic organizations, religious buildings, and other directory entries. Add controlled classifications to `vocabularies.entity_tags` in `datasets/manifest.json`; the build generates the entity schema enum and TypeScript tag union from that list. Both runtime validators also apply the manifest vocabulary directly, so adding a tag requires no hand-edited SDK code.

## Provenance and Canonical Data

Every canonical dataset file is registered in `datasets/manifest.json` with its upstream source URL, license, attribution, and SHA-256 checksum. A dataset can list additional sources when its fields come from different sources. The global country file combines GeoNames country identifiers and spoken-language lists (CC BY 4.0) with official-language values from Unicode CLDR (Unicode-3.0); the full Unicode license notice is in [`licenses/UNICODE-3.0.txt`](licenses/UNICODE-3.0.txt). Bangladesh subdivisions, cities, and institutions use Wikidata structured data under CC0-1.0.

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
