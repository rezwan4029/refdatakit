import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../dist/canonical-json.js";
import { sortRepository, validateRepository } from "../dist/validator.js";

const repositoryDirectory = fileURLToPath(new URL("../../..", import.meta.url));
const defaultEntityTags = [
  "hospital",
  "k12_school",
  "medical_college",
  "nursing_home",
  "university",
];

async function createFixture(cityId, entities = [{
  id: "entity:1",
  names: { en: "Example School", languages: {} },
  entity_type: "school",
  country_code: "US",
  city_id: cityId,
  tags: ["k12_school"],
  external_ids: [{ system: "wikidata", value: "Q42" }],
}], officialLanguages = ["en"], entityTags = defaultEntityTags, commonLanguages = []) {
  const root = await mkdtemp(resolve(tmpdir(), "refdatakit-validation-"));
  await cp(resolve(repositoryDirectory, "schemas"), resolve(root, "schemas"), { recursive: true });

  const definitions = [
    {
      path: "datasets/countries/data.json",
      source_url: "https://example.test/countries",
      records: [{
        code: "US",
        name: "United States",
        official_languages: officialLanguages,
        commonly_spoken_languages: commonLanguages,
      }],
    },
    {
      path: "datasets/subdivisions/by-country/US.json",
      source_url: "https://example.test/subdivisions/US",
      records: [{
        code: "US-CA",
        country_code: "US",
        name: "California",
        level: "state",
      }],
    },
    {
      path: "datasets/cities/by-country/US.json",
      source_url: "https://example.test/cities/US",
      records: [{
        id: "city:1",
        name: "San Francisco",
        country_code: "US",
        subdivision_code: "US-CA",
        coordinates: { latitude: 37.7749, longitude: -122.4194 },
      }],
    },
    {
      path: "datasets/institutions/by-country/US.json",
      source_url: "https://example.test/institutions/US",
      records: entities,
    },
  ];

  const datasets = [];
  for (const definition of definitions) {
    const dataPath = resolve(root, definition.path);
    const contents = canonicalJson(definition.records);
    await mkdir(dirname(dataPath), { recursive: true });
    await writeFile(dataPath, contents);
    datasets.push({
      path: definition.path,
      source_url: definition.source_url,
      license: "CC0-1.0",
      attribution: "Fixture source",
      sha256: createHash("sha256").update(contents).digest("hex"),
    });
  }
  await writeFile(
    resolve(root, "datasets/manifest.json"),
    canonicalJson({ datasets, vocabularies: { entity_tags: entityTags } }),
  );
  return root;
}

test("validates cross-dataset references and canonical manifest data", async () => {
  const root = await createFixture("city:1");
  try {
    await validateRepository(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("allows missing language contributions without treating them as no languages", async () => {
  const root = await createFixture(
    "city:1",
    [{
      id: "entity:1",
      names: { en: "Example School", languages: {} },
      entity_type: "school",
      country_code: "US",
      city_id: "city:1",
      tags: ["k12_school"],
    }],
    [],
    defaultEntityTags,
    [],
  );
  try {
    assert.deepEqual(await validateRepository(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects entity language names without verified official country languages", async () => {
  const entity = {
    id: "entity:1",
    names: { en: "Example School", languages: { bn: "উদাহরণ স্কুল" } },
    entity_type: "school",
    country_code: "US",
    city_id: "city:1",
    tags: ["k12_school"],
  };
  for (const officialLanguages of [[], ["en"]]) {
    const root = await createFixture("city:1", [entity], officialLanguages);
    try {
      await assert.rejects(
        validateRepository(root),
        /names\.languages contains non-official languages/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("rejects entity aliases in non-official languages", async () => {
  const root = await createFixture(
    "city:1",
    [{
      id: "entity:1",
      names: { en: "Example School", languages: { bn: "উদাহরণ স্কুল" } },
      localized_aliases: [{ language: "fr", value: "École Exemple" }],
      entity_type: "school",
      country_code: "US",
      city_id: "city:1",
      tags: ["k12_school"],
    }],
    ["en", "bn"],
  );
  try {
    await assert.rejects(validateRepository(root), /localized_aliases\[0\].*is not official/);
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

test("requires an entity city link", async () => {
  const entity = {
    id: "entity:1",
    names: { en: "Example School", languages: {} },
    entity_type: "school",
    country_code: "US",
    tags: ["k12_school"],
  };
  const root = await createFixture("city:1", [entity]);
  try {
    await assert.rejects(validateRepository(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("requires non-empty, unique tags from the controlled enum", async () => {
  const entity = {
    id: "entity:1",
    names: { en: "Example School", languages: {} },
    entity_type: "school",
    country_code: "US",
    city_id: "city:1",
    tags: ["k12_school"],
  };
  const invalidEntities = [
    { ...entity, tags: [] },
    { ...entity, tags: ["unlisted_tag"] },
    { ...entity, tags: ["university", "university"] },
    Object.fromEntries(Object.entries(entity).filter(([key]) => key !== "tags")),
  ];

  for (const invalidEntity of invalidEntities) {
    const root = await createFixture("city:1", [invalidEntity]);
    try {
      await assert.rejects(validateRepository(root));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("accepts multiple controlled tags", async () => {
  const root = await createFixture("city:1", [{
    id: "entity:1",
    names: { en: "Example University Hospital", languages: {} },
    entity_type: "university",
    country_code: "US",
    city_id: "city:1",
    tags: ["hospital", "university"],
  }]);
  try {
    assert.deepEqual(await validateRepository(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("accepts and sorts tags added to the manifest vocabulary", async () => {
  const root = await createFixture(
    "city:1",
    [{
      id: "entity:1",
      names: { en: "Example Community Center", languages: {} },
      entity_type: "university",
      country_code: "US",
      city_id: "city:1",
      tags: ["community_center"],
    }],
    ["en"],
    [...defaultEntityTags, "community_center"],
  );
  try {
    await sortRepository(root);
    assert.deepEqual(await validateRepository(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("allows partial official language names and rejects unverified languages", async () => {
  const entity = {
    id: "entity:1",
    names: {
      en: "Example University",
      languages: { bn: "উদাহরণ বিশ্ববিদ্যালয়", fr: "Université Exemple" },
    },
    entity_type: "university",
    country_code: "US",
    city_id: "city:1",
    tags: ["university"],
  };
  const officialLanguages = ["en", "bn", "fr", "sco"];
  const validRoot = await createFixture("city:1", [entity], officialLanguages);
  try {
    assert.deepEqual(await validateRepository(validRoot), []);
  } finally {
    await rm(validRoot, { recursive: true, force: true });
  }

  for (const languages of [{ bn: "উদাহরণ বিশ্ববিদ্যালয়" }, {}]) {
    const root = await createFixture(
      "city:1",
      [{ ...entity, names: { ...entity.names, languages } }],
      officialLanguages,
    );
    try {
      assert.deepEqual(await validateRepository(root), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  const invalidLanguageMaps = [
    { bn: "উদাহরণ বিশ্ববিদ্যালয়", es: "Universidad Ejemplo" },
    { bn: "উদাহরণ বিশ্ববিদ্যালয়", fr: "Université Exemple", eng: "Example" },
  ];
  for (const languages of invalidLanguageMaps) {
    const root = await createFixture(
      "city:1",
      [{ ...entity, names: { ...entity.names, languages } }],
      officialLanguages,
    );
    try {
      await assert.rejects(validateRepository(root));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("rejects institutional coordinates, addresses, logos, and standalone latitude or longitude", async () => {
  const entity = {
    id: "entity:1",
    names: { en: "Example School", languages: {} },
    entity_type: "school",
    country_code: "US",
    city_id: "city:1",
    tags: ["k12_school"],
  };
  const prohibitedProperties = [
    ["coordinates", { latitude: 1, longitude: 1 }],
    ["latitude", 1],
    ["longitude", 1],
    ["address", "1 Example Street"],
    ["logo", "https://example.test/logo.svg"],
  ];

  for (const [property, value] of prohibitedProperties) {
    const root = await createFixture("city:1", [{ ...entity, [property]: value }]);
    try {
      await assert.rejects(validateRepository(root));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("warns when entity records are not sorted by English name", async () => {
  const root = await createFixture("city:1", [
    {
      id: "entity:z",
      names: { en: "Beta School", languages: {} },
      entity_type: "school",
      country_code: "US",
      city_id: "city:1",
      tags: ["k12_school"],
    },
    {
      id: "entity:a",
      names: { en: "alpha School", languages: {} },
      entity_type: "school",
      country_code: "US",
      city_id: "city:1",
      tags: ["k12_school"],
    },
  ]);
  try {
    const warnings = await validateRepository(root);
    assert.deepEqual(warnings, [
      "datasets/institutions/by-country/US.json is not sorted by English name at record 1",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("sorts records and refreshes manifest checksums", async () => {
  const root = await createFixture("city:1", [
    {
      id: "entity:z",
      names: { en: "Beta School", languages: {} },
      entity_type: "school",
      country_code: "US",
      city_id: "city:1",
      tags: ["k12_school"],
    },
    {
      id: "entity:a",
      names: { en: "alpha School", languages: {} },
      entity_type: "school",
      country_code: "US",
      city_id: "city:1",
      tags: ["k12_school"],
    },
  ]);
  try {
    await sortRepository(root);
    assert.deepEqual(await validateRepository(root), []);
    const records = JSON.parse(
      await readFile(resolve(root, "datasets/institutions/by-country/US.json"), "utf8"),
    );
    assert.deepEqual(records.map((record) => record.id), ["entity:a", "entity:z"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects canonical dataset files omitted from the manifest", async () => {
  const root = await createFixture("city:1");
  try {
    const extraPath = resolve(root, "datasets/cities/by-country/CA.json");
    await mkdir(dirname(extraPath), { recursive: true });
    await writeFile(extraPath, canonicalJson([]));
    await assert.rejects(validateRepository(root), /Dataset files missing from manifest/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
