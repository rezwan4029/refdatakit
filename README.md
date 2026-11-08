# RefDataKit

Source-aware reference data and tooling designed to support multiple languages and ecosystems.

## Direction

RefDataKit standardizes public and community-maintained inputs into validated, versioned datasets. The value is clean schemas, clear provenance, predictable access, and developer velocity—not ownership of underlying public facts. JavaScript/TypeScript and Python are the first runtimes; later language adapters will consume the same JSON Schema contracts and datasets.

## Repository Layout

```text
schemas/                         Shared JSON Schema contracts
datasets/                        Canonical JSON records and source manifest
  manifest.json                  Provenance, license, attribution, and checksums
  countries/data.json            Country records and official_languages
  subdivisions/by-country/      Country-partitioned administrative divisions
  cities/by-country/             Country-partitioned cities and localities
  institutions/by-country/       Universal entities, partitioned by country
  contributions/                 Quarantined, untrusted submissions
packages/js/                     TypeScript SDK and CLI
packages/python/                 Python SDK and CLI
.github/workflows/               Automated checks
```

The `institutions` data domain uses the universal entity schema for schools, colleges, universities, corporations, civic organizations, religious buildings, and other directory entries. Records can carry localized names, language tags, public coordinates, city links, and stable external identifiers. Volatile street addresses are intentionally excluded.

## Data Organization

Partition each domain by ISO 3166-1 alpha-2 country code. Subdivisions use ISO 3166-2 identifiers where available, while their `level` and parent relationship remain country-specific; not every country has the same administrative hierarchy. Keep city records separate and link entities with stable city IDs.

## Provenance and Contributions

`schemas/` is the cross-runtime source of truth. Every canonical file is registered in `datasets/manifest.json` with its schema, status, record count, SHA-256 checksum, distribution license, and source metadata. A `placeholder` has no records, sources, or license; a dataset becomes `ready` only after provenance and redistribution terms are recorded.

Community submissions stay quarantined under `datasets/contributions/` and are excluded from packages until they have been reviewed, normalized, and cleared for redistribution. Do not include personal or sensitive information.

No third-party source data is included yet. Country and country-partitioned files are empty placeholders until source selection and license review are complete. No repository-wide open-source license has been selected.

## Validation

From the repository root, install the package dependencies once, then run each implementation:

```sh
npm ci --prefix packages/js
npm --prefix packages/js run lint
npm --prefix packages/js test
npm --prefix packages/js run validate

python -m pip install -e "packages/python[dev]"
ruff check packages/python/src packages/python/tests
pytest packages/python/tests
refdatakit validate .
```
