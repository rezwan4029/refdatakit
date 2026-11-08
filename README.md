# RefDataKit

RefDataKit standardizes public and community-maintained inputs into validated, versioned reference datasets. Its value is clean schemas, clear provenance, predictable access, and developer velocity—not ownership of underlying public facts. JavaScript/TypeScript and Python are the first runtimes; later language adapters will consume the same JSON Schema contracts and datasets.

## Bangladesh Pilot

The initial data release is limited to Bangladesh (`BD`): country metadata, Dhaka Division, Dhaka, and two universities. Entity records use English and local-language names, coordinates, stable city links, and external identifiers. Volatile street addresses are excluded.

## Repository Layout

```text
schemas/                         Shared JSON Schema contracts
datasets/                        Canonical JSON records and source manifest
  manifest.json                  Per-file source, license, attribution, and checksum
  countries/data.json            Country records and official_languages
  subdivisions/by-country/       Country-partitioned administrative divisions
  cities/by-country/             Country-partitioned cities and localities
  institutions/by-country/       Universal entities, partitioned by country
  contributions/                 Quarantined, untrusted submissions
packages/js/                     TypeScript SDK and CLI
packages/python/                 Python SDK and CLI
.github/workflows/               Automated checks
```

`institutions` uses the universal entity schema for schools, colleges, universities, corporations, civic organizations, religious buildings, and other directory entries. `datasets/contributions/` stays outside the canonical manifest and runtime packages until submissions are reviewed and cleared for redistribution.

## Provenance and Canonical Data

Every canonical dataset file is registered in `datasets/manifest.json` with its upstream source URL, license, attribution, and SHA-256 checksum. The Bangladesh seed uses Wikidata structured data, distributed under CC0-1.0; each manifest entry identifies the source item or items.

Dataset files and the manifest use RFC 8785 canonical JSON, UTF-8, NFC-normalized strings, and one trailing newline. Records in each dataset array are ordered by English name (case-insensitive), with stable IDs as tie-breakers. The validator warns about unsorted records but does not block otherwise valid data. `sort` reorders dataset records, canonicalizes their files, and refreshes the manifest checksums; it does not reorder language lists.

Community submissions remain untrusted. Review submissions for provenance, redistribution rights, schema compliance, and quality before promoting records into canonical datasets. Do not include personal or sensitive information.

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

## Contributor Portal

The static React portal in `portal/` validates entries in the browser and submits them through a Cloudflare Worker. The Worker keeps the GitHub App client secret and plaintext access token off the static site; the browser receives only a short-lived encrypted session handle. The Worker creates a branch, writes the submission under `datasets/contributions/BD/`, and opens a pull request. Contributions remain quarantined until maintainers review them.

### GitHub App

Create a GitHub App for this repository and enable user authorization. Set its callback URL to `https://<worker-host>/oauth/callback` after deploying the Worker. Grant repository permissions for **Contents: read and write** and **Pull requests: read and write**; metadata access is required by GitHub. Install the app only on the RefDataKit repository. The broker supplies the repository ID during token exchange and verifies that the authorized repository matches its configuration.

### Deploy the Worker

From `portal/`, set `GITHUB_CLIENT_ID`, `GITHUB_REPOSITORY_ID`, and `PORTAL_URL` in `wrangler.jsonc`. For the GitHub Pages project site, `PORTAL_URL` is `https://<owner>.github.io/refdatakit/`. Generate a 32-byte encryption key and add both Worker secrets:

```sh
openssl rand -hex 32
npx wrangler secret put GITHUB_CLIENT_SECRET --config wrangler.jsonc
npx wrangler secret put SESSION_ENCRYPTION_KEY --config wrangler.jsonc
npm run worker:deploy
```

Paste the GitHub App client secret and generated hexadecimal encryption key when Wrangler prompts. Keep these values out of the repository and browser build. After deployment, set the GitHub App callback URL to the Worker’s `/oauth/callback` endpoint.

### Deploy GitHub Pages

Set the repository Actions variable `VITE_AUTH_BROKER_URL` to the deployed Worker origin, such as `https://refdatakit-contributions.<account>.workers.dev`, and set GitHub Pages to use **GitHub Actions**. The `Deploy Contributor Portal` workflow builds the static site with the repository’s Pages path and publishes it on pushes to `main` that change portal or schema files.

### Local development

Install dependencies once with `npm ci` from `portal/`. Create `portal/.dev.vars` with the development app's `GITHUB_CLIENT_SECRET` and a 32-byte hexadecimal `SESSION_ENCRYPTION_KEY`. Run the portal and Worker in separate terminals:

```sh
cd portal
VITE_AUTH_BROKER_URL=http://localhost:8787 npm run dev
```

```sh
cd portal
npm run worker:dev -- \
  --var PORTAL_URL:http://localhost:5173 \
  --var GITHUB_CLIENT_ID:your-development-app-client-id \
  --var GITHUB_OWNER:your-test-repository-owner \
  --var GITHUB_REPOSITORY:your-test-repository-name \
  --var GITHUB_REPOSITORY_ID:your-test-repository-id
```

For local OAuth, use a separate development GitHub App and test repository, and set its callback to `http://localhost:8787/oauth/callback`. Local submissions still call GitHub and can create branches and pull requests; use a test repository when exercising that flow.
