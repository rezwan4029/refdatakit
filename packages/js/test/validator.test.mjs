import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateRepository } from "../dist/validator.js";

const repositoryDirectory = fileURLToPath(new URL("../../..", import.meta.url));
const source = {
  id: "fixture-source",
  name: "Fixture Source",
  url: "https://example.test/data",
  license: "CC0-1.0",
  retrievedAt: "2025-01-01T00:00:00Z",
  sha256: "a".repeat(64),
};

async function createFixture(cityId) {
  const root = await mkdtemp(resolve(tmpdir(), "refdatakit-validation-"));
  await cp(resolve(repositoryDirectory, "schemas"), resolve(root, "schemas"), { recursive: true });

  const definitions = [
    {
      id: "countries",
      domain: "country",
      path: "datasets/countries/data.json",
      schema: "schemas/country.schema.json",
      records: [{ code: "US", name: "United States", official_languages: ["en"] }],
    },
    {
      id: "subdivisions-us",
      domain: "subdivision",
      countryCode: "US",
      path: "datasets/subdivisions/by-country/US.json",
      schema: "schemas/subdivision.schema.json",
      records: [{ code: "US-CA", countryCode: "US", name: "California", level: "state" }],
    },
    {
      id: "cities-us",
      domain: "city",
      countryCode: "US",
      path: "datasets/cities/by-country/US.json",
      schema: "schemas/city.schema.json",
      records: [{
        id: "city:1",
        name: "San Francisco",
        countryCode: "US",
        subdivisionCode: "US-CA",
        coordinates: { latitude: 37.7749, longitude: -122.4194 },
      }],
    },
    {
      id: "institutions-us",
      domain: "entity",
      countryCode: "US",
      path: "datasets/institutions/by-country/US.json",
      schema: "schemas/entity.schema.json",
      records: [{
        id: "entity:1",
        name: "Example School",
        entityType: "school",
        countryCode: "US",
        subdivisionCode: "US-CA",
        cityId,
        coordinates: { latitude: 37.7749, longitude: -122.4194 },
        externalIds: [{ system: "wikidata", value: "Q42" }],
      }],
    },
  ];

  const datasets = [];
  for (const definition of definitions) {
    const dataPath = resolve(root, definition.path);
    const contents = `${JSON.stringify(definition.records, null, 2)}\n`;
    await mkdir(dirname(dataPath), { recursive: true });
    await writeFile(dataPath, contents);
    datasets.push({
      id: definition.id,
      domain: definition.domain,
      ...(definition.countryCode ? { countryCode: definition.countryCode } : {}),
      path: definition.path,
      schema: definition.schema,
      status: "ready",
      recordCount: definition.records.length,
      sha256: createHash("sha256").update(contents).digest("hex"),
      license: "CC0-1.0",
      sources: [source],
    });
  }

  await writeFile(
    resolve(root, "datasets/manifest.json"),
    `${JSON.stringify({ schemaVersion: "1.0.0", datasets }, null, 2)}\n`,
  );
  return root;
}

test("validates country, subdivision, city, and entity references", async () => {
  const root = await createFixture("city:1");
  try {
    await validateRepository(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects an entity that references an unknown city", async () => {
  const root = await createFixture("city:missing");
  try {
    await assert.rejects(
      validateRepository(root),
      /references unknown city city:missing/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
