# RefDataKit

RefDataKit standardizes public inputs into validated, versioned reference datasets. Its value is clean schemas, clear provenance, predictable access, and developer velocity—not ownership of underlying public facts. JavaScript/TypeScript and Python are the first runtimes; later language adapters will consume the same JSON Schema contracts and datasets.

## Bangladesh Pilot

The initial data release is limited to Bangladesh (`BD`): country metadata, its eight divisions, eight major city markers, and two universities. Country and city records may carry macro-level coordinates. Institution records use English and local-language names, stable city links, and external identifiers; coordinates, addresses, and logos are prohibited.

All runtime data is stored as version-controlled JSON in `datasets/`. SDKs and validators read only these local files; manifest source URLs document provenance and are never fetched during builds or runtime.

## Repository Layout

```text
schemas/                         Shared JSON Schema contracts
datasets/                        Canonical JSON records and source manifest
  manifest.json                  Per-file source, license, attribution, and checksum
  countries/data.json            Country records and official_languages
  subdivisions/by-country/       Country-partitioned administrative divisions
  cities/by-country/             Country-partitioned cities and localities
  institutions/by-country/       Universal entities, partitioned by country
packages/js/                     TypeScript SDK and CLI
packages/python/                 Python SDK and CLI
.github/workflows/               Automated checks
```

`institutions` uses the universal entity schema for schools, colleges, universities, corporations, civic organizations, religious buildings, and other directory entries. Every canonical dataset file is registered in the manifest and validated before it enters the repository.

## Provenance and Canonical Data

Every canonical dataset file is registered in `datasets/manifest.json` with its upstream source URL, license, attribution, and SHA-256 checksum. The Bangladesh seed uses Wikidata structured data, distributed under CC0-1.0; each manifest entry identifies the source item or items.

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

No repository-wide open-source license has been selected for the software.
