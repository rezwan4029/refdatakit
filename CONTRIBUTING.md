# Contributing to RefDataKit

Thanks for helping improve the data. This project stores its reference data as plain
JSON in [`datasets/`](datasets/), so contributing is mostly editing a file and running two
commands. No special tooling and no hand-computed checksums are required.

## The data files

| Data type | File |
|-----------|------|
| Countries | `datasets/countries/data.json` |
| Subdivisions | `datasets/subdivisions/by-country/{CC}.json` |
| Cities and localities | `datasets/cities/by-country/{CC}.json` |
| Institutions | `datasets/institutions/by-country/{CC}.json` |

`{CC}` is the ISO 3166-1 alpha-2 country code (for example `BD`). Every record must
conform to the matching schema in [`schemas/`](schemas/).

The files are indented, UTF-8 JSON with sorted keys so they read cleanly on GitHub and
produce small, reviewable diffs. Edit them in any editor.

## Workflow

1. **Find and edit the record.** Add or change one record in the relevant file. Keep the
   diff focused: edit the record you mean to change and leave the rest of the file alone.
2. **Sort and refresh checksums.**
   ```sh
   npm ci --prefix packages/js
   npm --prefix packages/js run sort
   ```
   `sort` reorders records by English name, rewrites the files in the readable layout,
   and updates the SHA-256 checksums in `datasets/manifest.json`. You never compute a
   checksum by hand.
3. **Validate.**
   ```sh
   python -m pip install -e "packages/python[dev]"
   refdatakit validate .
   ```
   CI runs both the JavaScript and Python validators, the linters, and the test suites.

You can edit the JSON directly and run `sort`/`validate` afterwards; the checksum is
computed over the canonical form of the data, so formatting whitespace on its own never
breaks validation.

## Data rules

- **Markets and locale facts belong to the data, not the schema.** Records carry stable
  IDs, English names, and optional verified local-language names. Do not invent
  translations; `names.languages` may be empty and filled in later.
- **Provenance is required.** Each manifest entry records the source URL, license,
  attribution, and the fields it supports. If you add data from another source, add an
  `additional_sources` entry.
- **Institutions must not include** coordinates, street addresses, or logos. Link them
  hierarchically with `country_code` and `city_id`. If the city does not exist yet, add
  its record and link it.
- **New dataset files** (for example a new country) also need a manifest entry.

## Pull requests

In the PR description, summarize the records added or changed and identify their data
source. One focused change per pull request keeps review practical.

## Local checks

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
