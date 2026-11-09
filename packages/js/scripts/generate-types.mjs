import { compileFromFile } from "json-schema-to-typescript";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, "..");
const repositoryDirectory = resolve(packageDirectory, "../..");
const outputDirectory = resolve(packageDirectory, "src/generated");
const schemaNames = ["country", "subdivision", "city", "entity"];
const manifestPath = resolve(repositoryDirectory, "datasets/manifest.json");
const countryDataPath = resolve(repositoryDirectory, "datasets/countries/data.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const countries = JSON.parse(await readFile(countryDataPath, "utf8"));
const countryCodes = countries.map(({ code }) => code).sort();

if (
  countryCodes.length === 0 ||
  !countryCodes.every((code) => typeof code === "string" && /^[A-Z]{2}$/.test(code)) ||
  new Set(countryCodes).size !== countryCodes.length
) {
  throw new Error("datasets/countries/data.json must contain unique ISO alpha-2 codes");
}
const entityTags = manifest?.vocabularies?.entity_tags;

if (
  !Array.isArray(entityTags) ||
  entityTags.length === 0 ||
  !entityTags.every((tag) => typeof tag === "string" && /^[a-z][a-z0-9_]*$/.test(tag)) ||
  new Set(entityTags).size !== entityTags.length
) {
  throw new Error("datasets/manifest.json vocabularies.entity_tags must be unique tag slugs");
}

const entitySchemaPath = resolve(repositoryDirectory, "schemas/entity.schema.json");
const entitySchemaContents = await readFile(entitySchemaPath, "utf8");
const entitySchema = JSON.parse(entitySchemaContents);
if (
  typeof entitySchema !== "object" ||
  entitySchema === null ||
  Array.isArray(entitySchema) ||
  typeof entitySchema.$defs !== "object" ||
  entitySchema.$defs === null ||
  typeof entitySchema.$defs.tag !== "object" ||
  entitySchema.$defs.tag === null ||
  Array.isArray(entitySchema.$defs.tag)
) {
  throw new Error("schemas/entity.schema.json must define $defs.tag");
}
entitySchema.$defs.tag.enum = entityTags;
const generatedEntitySchema = `${JSON.stringify(entitySchema, null, 2)}\n`;
if (entitySchemaContents !== generatedEntitySchema) {
  await writeFile(entitySchemaPath, generatedEntitySchema);
}

await mkdir(outputDirectory, { recursive: true });

const countryCodeEnum = [
  "/* Generated from datasets/countries/data.json. Do not edit. */",
  "",
  "export enum CountryCode {",
  ...countryCodes.map((code) => `  ${code} = "${code}",`),
  "}",
  "",
].join("\n");
await writeFile(resolve(outputDirectory, "country-code.ts"), countryCodeEnum);

const pythonCountryCodeEnum = [
  "# Generated from datasets/countries/data.json. Do not edit.",
  "from enum import StrEnum",
  "",
  "",
  "class CountryCode(StrEnum):",
  ...countryCodes.map((code) => `    ${code} = "${code}"`),
  "",
].join("\n");
await writeFile(
  resolve(repositoryDirectory, "packages/python/src/refdatakit/country_codes.py"),
  pythonCountryCodeEnum,
);

for (const schemaName of schemaNames) {
  const schemaPath = resolve(repositoryDirectory, "schemas", `${schemaName}.schema.json`);
  let generatedTypes = await compileFromFile(schemaPath, {
    bannerComment: `/* Generated from schemas/${schemaName}.schema.json. Do not edit. */`,
  });
  if (schemaName === "country") {
    generatedTypes = generatedTypes.replace("code: string;", "code: CountryCode;");
  } else {
    generatedTypes = generatedTypes.replaceAll("country_code: string;", "country_code: CountryCode;");
  }
  generatedTypes = generatedTypes.replace(
    "*/\n",
    "*/\n\nimport type { CountryCode } from \"./country-code.js\";\n",
  );
  await writeFile(resolve(outputDirectory, `${schemaName}.ts`), generatedTypes);
}
