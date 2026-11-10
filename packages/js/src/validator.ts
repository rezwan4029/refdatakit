import {
  Ajv2020,
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import type { FormatsPlugin } from "ajv-formats";
import { createHash } from "node:crypto";
import { readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { canonicalJson, prettyJson } from "./canonical-json.js";

type DatasetDomain = "country" | "subdivision" | "city" | "entity";

interface DatasetEntry {
  path: string;
  source_url: string;
  license: string;
  attribution: string;
  data_as_of?: string;
  additional_sources?: Array<{
    source_url: string;
    license: string;
    attribution: string;
    data_as_of?: string;
    fields: string[];
  }>;
  sha256: string;
}

interface DatasetManifest {
  datasets: DatasetEntry[];
  vocabularies: {
    entity_tags: string[];
  };
}

interface DatasetDefinition {
  domain: DatasetDomain;
  schema: string;
  countryCode?: string;
}

interface DatasetRecords {
  definition: DatasetDefinition;
  entry: DatasetEntry;
  records: unknown[];
}

const datasetPathPatterns: Array<{
  pattern: RegExp;
  definition: (match: RegExpMatchArray) => DatasetDefinition;
}> = [
  {
    pattern: /^datasets\/countries\/data\.json$/,
    definition: () => ({ domain: "country", schema: "schemas/country.schema.json" }),
  },
  {
    pattern: /^datasets\/subdivisions\/by-country\/([A-Z]{2})\.json$/,
    definition: (match) => ({
      domain: "subdivision",
      schema: "schemas/subdivision.schema.json",
      countryCode: match[1],
    }),
  },
  {
    pattern: /^datasets\/cities\/by-country\/([A-Z]{2})\.json$/,
    definition: (match) => ({
      domain: "city",
      schema: "schemas/city.schema.json",
      countryCode: match[1],
    }),
  },
  {
    pattern: /^datasets\/institutions\/by-country\/([A-Z]{2})\.json$/,
    definition: (match) => ({
      domain: "entity",
      schema: "schemas/entity.schema.json",
      countryCode: match[1],
    }),
  },
];

const identityFields: Record<DatasetDomain, string> = {
  country: "code",
  subdivision: "code",
  city: "id",
  entity: "id",
};
const require = createRequire(import.meta.url);

function isWithinRoot(rootDirectory: string, filePath: string): boolean {
  const relativePath = relative(rootDirectory, filePath);
  return relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath);
}

async function resolveRepositoryFile(rootDirectory: string, relativePath: string): Promise<string> {
  if (
    isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    relativePath.split("/").includes("..")
  ) {
    throw new Error(`Expected a repository-relative path: ${relativePath}`);
  }

  const filePath = resolve(rootDirectory, relativePath);
  if (!isWithinRoot(rootDirectory, filePath)) {
    throw new Error(`Path escapes the repository: ${relativePath}`);
  }

  const canonicalPath = await realpath(filePath);
  if (!isWithinRoot(rootDirectory, canonicalPath)) {
    throw new Error(`Path resolves outside the repository: ${relativePath}`);
  }

  return canonicalPath;
}

async function readJson(filePath: string): Promise<unknown> {
  const contents = await readFile(filePath, "utf8");
  return JSON.parse(contents) as unknown;
}

function assertValid<T>(
  validator: ValidateFunction<T>,
  value: unknown,
  description: string,
): asserts value is T {
  if (validator(value)) {
    return;
  }

  const issues = (validator.errors ?? [])
    .map((issue: ErrorObject) => `${issue.instancePath || "/"} ${issue.message ?? "is invalid"}`)
    .join("; ");
  throw new Error(`${description} is invalid: ${issues}`);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  record: unknown,
  field: string,
  description: string,
): string {
  if (!isObjectRecord(record) || typeof record[field] !== "string") {
    throw new Error(`${description} must have a string ${field}`);
  }
  return record[field];
}

function optionalString(
  record: unknown,
  field: string,
  description: string,
): string | undefined {
  if (!isObjectRecord(record)) {
    throw new Error(`${description} must be an object`);
  }

  const value = record[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${description} ${field} must be a string`);
  }
  return value;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === "string");
}

function requiredStringArray(record: unknown, field: string, description: string): string[] {
  const value = isObjectRecord(record) ? record[field] : undefined;
  if (!isStringArray(value)) {
    throw new Error(`${description} must have a string array ${field}`);
  }
  return value;
}

function officialNonEnglishLanguages(record: unknown, description: string): Set<string> {
  const languages = new Set<string>();
  for (const language of requiredStringArray(record, "official_languages", description)) {
    const code = language.split("-")[0].toLowerCase();
    if (!/^[a-z]{2,3}$/.test(code)) {
      throw new Error(`${description} official language ${language} has an invalid code`);
    }
    if (code !== "en") {
      languages.add(code);
    }
  }
  return languages;
}

function validateEntityLanguageNames(
  record: unknown,
  officialLanguages: Set<string>,
  description: string,
): void {
  const names = isObjectRecord(record) && isObjectRecord(record.names)
    ? record.names.languages
    : undefined;
  if (!isObjectRecord(names)) {
    throw new Error(`${description} names.languages must be an object`);
  }

  const nameLanguages = new Set([...officialLanguages].filter((language) => language.length === 2));
  const actualLanguages = new Set(Object.keys(names));
  const unexpected = [...actualLanguages].filter((language) => !nameLanguages.has(language));
  if (unexpected.length > 0) {
    throw new Error(
      `${description} names.languages contains non-official languages: ${unexpected.join(", ")}`,
    );
  }

  const aliases = isObjectRecord(record) ? record.localized_aliases ?? [] : [];
  if (!Array.isArray(aliases)) {
    throw new Error(`${description} localized_aliases must be an array`);
  }
  for (const [index, alias] of aliases.entries()) {
    const language = requiredString(alias, "language", `${description} localized_aliases[${index}]`)
      .split("-")[0]
      .toLowerCase();
    if (language !== "en" && !officialLanguages.has(language)) {
      throw new Error(
        `${description} localized_aliases[${index}] language ${language} is not official`,
      );
    }
  }
}

function addToIndex(index: Map<string, Set<string>>, key: string, value: string): void {
  const values = index.get(key) ?? new Set<string>();
  values.add(value);
  index.set(key, values);
}

function definitionForPath(path: string): DatasetDefinition {
  for (const { pattern, definition } of datasetPathPatterns) {
    const match = path.match(pattern);
    if (match) {
      return definition(match);
    }
  }
  throw new Error(`Unsupported dataset path: ${path}`);
}

function schemaWithEntityTags(schemaValue: unknown, entityTags: string[]): unknown {
  if (
    !isObjectRecord(schemaValue) ||
    !isObjectRecord(schemaValue.$defs) ||
    !isObjectRecord(schemaValue.$defs.tag)
  ) {
    throw new Error("schemas/entity.schema.json must define $defs.tag");
  }

  return {
    ...schemaValue,
    $defs: {
      ...schemaValue.$defs,
      tag: {
        ...schemaValue.$defs.tag,
        enum: entityTags,
      },
    },
  };
}

async function listDatasetFiles(rootDirectory: string): Promise<string[]> {
  const datasetsDirectory = await resolveRepositoryFile(rootDirectory, "datasets");
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        const path = relative(rootDirectory, absolutePath).split(sep).join("/");
        if (path !== "datasets/manifest.json") {
          files.push(path);
        }
      } else if (entry.isSymbolicLink()) {
        throw new Error(`Dataset directory contains a symbolic link: ${absolutePath}`);
      }
    }
  }

  await visit(datasetsDirectory);
  return files.sort();
}

function validateRecordPartition(
  record: unknown,
  definition: DatasetDefinition,
  description: string,
): void {
  if (
    definition.countryCode !== undefined &&
    requiredString(record, "country_code", description) !== definition.countryCode
  ) {
    throw new Error(`${description} country_code does not match ${definition.countryCode}`);
  }
}

function englishSortKey(
  record: unknown,
  definition: DatasetDefinition,
  description: string,
): [string, string] {
  const englishName = definition.domain === "entity"
    ? requiredString(isObjectRecord(record) ? record.names : undefined, "en", `${description} names`)
    : requiredString(record, "name", description);
  const identity = requiredString(record, identityFields[definition.domain], description);
  return [englishName.normalize("NFC").toLowerCase(), identity];
}

function englishSortWarning(dataset: DatasetRecords): string | undefined {
  let previous: [string, string] | undefined;
  for (const [index, record] of dataset.records.entries()) {
    const description = `${dataset.entry.path}[${index}]`;
    const current = englishSortKey(record, dataset.definition, description);
    if (
      previous !== undefined &&
      (previous[0] > current[0] || (previous[0] === current[0] && previous[1] > current[1]))
    ) {
      return `${dataset.entry.path} is not sorted by English name at record ${index}`;
    }
    previous = current;
  }
  return undefined;
}

function validateCrossDatasetReferences(datasets: DatasetRecords[]): void {
  const countries = new Set<string>();
  const countryLanguages = new Map<string, Set<string>>();
  const subdivisions = new Map<string, Set<string>>();
  const cities = new Map<string, Set<string>>();
  const recordIdentities = new Set<string>();

  for (const { definition, entry, records } of datasets) {
    for (const [index, record] of records.entries()) {
      const description = `${entry.path}[${index}]`;
      const identity = requiredString(record, identityFields[definition.domain], description);
      const countryCode = definition.domain === "country"
        ? ""
        : requiredString(record, "country_code", description);
      const scopedIdentity = `${definition.domain}:${countryCode}:${identity}`;
      if (recordIdentities.has(scopedIdentity)) {
        throw new Error(`${description} duplicates ${identityFields[definition.domain]} ${identity}`);
      }
      recordIdentities.add(scopedIdentity);

      if (definition.domain === "country") {
        countries.add(identity);
        countryLanguages.set(identity, officialNonEnglishLanguages(record, description));
      } else if (definition.domain === "subdivision") {
        addToIndex(subdivisions, countryCode, identity);
      } else if (definition.domain === "city") {
        addToIndex(cities, countryCode, identity);
      }
    }
  }

  for (const { definition, entry, records } of datasets) {
    for (const [index, record] of records.entries()) {
      const description = `${entry.path}[${index}]`;
      if (definition.domain === "country") {
        continue;
      }

      const countryCode = requiredString(record, "country_code", description);
      if (!countries.has(countryCode)) {
        throw new Error(`${description} references unknown country ${countryCode}`);
      }

      const subdivisionCode = optionalString(record, "subdivision_code", description);
      if (
        subdivisionCode !== undefined &&
        !subdivisions.get(countryCode)?.has(subdivisionCode)
      ) {
        throw new Error(`${description} references unknown subdivision ${subdivisionCode}`);
      }

      if (definition.domain === "subdivision") {
        const code = requiredString(record, "code", description);
        const parentCode = optionalString(record, "parent_code", description);
        if (parentCode === code) {
          throw new Error(`${description} cannot be its own parent`);
        }
        if (parentCode !== undefined && !subdivisions.get(countryCode)?.has(parentCode)) {
          throw new Error(`${description} references unknown parent subdivision ${parentCode}`);
        }
      }

      if (definition.domain === "entity") {
        const cityId = optionalString(record, "city_id", description);
        if (cityId !== undefined && !cities.get(countryCode)?.has(cityId)) {
          throw new Error(`${description} references unknown city ${cityId}`);
        }
        validateEntityLanguageNames(
          record,
          countryLanguages.get(countryCode) ?? new Set<string>(),
          description,
        );
      }
    }
  }
}

export async function sortRepository(rootDirectory: string): Promise<void> {
  const canonicalRoot = await realpath(rootDirectory);
  const manifestPath = await resolveRepositoryFile(canonicalRoot, "datasets/manifest.json");
  const manifestSchemaPath = await resolveRepositoryFile(
    canonicalRoot,
    "schemas/manifest.schema.json",
  );
  const manifestValue: unknown = await readJson(manifestPath);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const formatsModule = require("ajv-formats") as { default: FormatsPlugin };
  formatsModule.default(ajv);

  const validateManifest = ajv.compile<DatasetManifest>(await readJson(manifestSchemaPath) as AnySchema);
  assertValid(validateManifest, manifestValue, "datasets/manifest.json");

  const datasetPaths = new Set<string>();
  const datasets: DatasetRecords[] = [];
  for (const entry of manifestValue.datasets) {
    if (datasetPaths.has(entry.path)) {
      throw new Error(`Duplicate dataset path: ${entry.path}`);
    }
    datasetPaths.add(entry.path);

    const definition = definitionForPath(entry.path);
    const dataPath = await resolveRepositoryFile(canonicalRoot, entry.path);
    const schemaPath = await resolveRepositoryFile(canonicalRoot, definition.schema);
    const recordsValue: unknown = await readJson(dataPath);
    if (!Array.isArray(recordsValue)) {
      throw new Error(`${entry.path} must contain a JSON array`);
    }
    const schemaValue = await readJson(schemaPath);
    const schema: unknown = definition.domain === "entity"
      ? schemaWithEntityTags(schemaValue, manifestValue.vocabularies.entity_tags)
      : schemaValue;
    const validateRecord: ValidateFunction<unknown> = ajv.compile<unknown>(schema as AnySchema);
    for (const [index, record] of recordsValue.entries()) {
      const description = `${entry.path}[${index}]`;
      assertValid(validateRecord, record, description);
      validateRecordPartition(record, definition, description);
    }
    datasets.push({ definition, entry, records: recordsValue });
  }

  const unregisteredFiles = await listDatasetFiles(canonicalRoot);
  const missingFiles = unregisteredFiles.filter((path) => !datasetPaths.has(path));
  const missingPaths = [...datasetPaths].filter((path) => !unregisteredFiles.includes(path));
  if (missingFiles.length > 0) {
    throw new Error(`Dataset files missing from manifest: ${missingFiles.join(", ")}`);
  }
  if (missingPaths.length > 0) {
    throw new Error(`Manifest paths do not exist as dataset files: ${missingPaths.join(", ")}`);
  }

  validateCrossDatasetReferences(datasets);
  for (const dataset of datasets) {
    dataset.records.sort((left, right) => {
      const leftKey = englishSortKey(left, dataset.definition, dataset.entry.path);
      const rightKey = englishSortKey(right, dataset.definition, dataset.entry.path);
      if (leftKey[0] !== rightKey[0]) {
        return leftKey[0] < rightKey[0] ? -1 : 1;
      }
      if (leftKey[1] !== rightKey[1]) {
        return leftKey[1] < rightKey[1] ? -1 : 1;
      }
      return 0;
    });

    const contents = prettyJson(dataset.records);
    const dataPath = await resolveRepositoryFile(canonicalRoot, dataset.entry.path);
    await writeFile(dataPath, contents, "utf8");
    dataset.entry.sha256 = createHash("sha256").update(canonicalJson(dataset.records), "utf8").digest("hex");
  }

  await writeFile(manifestPath, canonicalJson(manifestValue), "utf8");
  await validateRepository(canonicalRoot);
}

export async function validateRepository(rootDirectory: string): Promise<string[]> {
  const canonicalRoot = await realpath(rootDirectory);
  const manifestPath = await resolveRepositoryFile(canonicalRoot, "datasets/manifest.json");
  const manifestSchemaPath = await resolveRepositoryFile(canonicalRoot, "schemas/manifest.schema.json");
  const manifestContents = await readFile(manifestPath, "utf8");
  const manifestValue: unknown = JSON.parse(manifestContents) as unknown;
  if (canonicalJson(manifestValue) !== manifestContents) {
    throw new Error("datasets/manifest.json is not canonically serialized");
  }

  const manifestSchema = await readJson(manifestSchemaPath);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const formatsModule = require("ajv-formats") as { default: FormatsPlugin };
  formatsModule.default(ajv);

  const validateManifest = ajv.compile<DatasetManifest>(manifestSchema as AnySchema);
  assertValid(validateManifest, manifestValue, "datasets/manifest.json");

  const datasetPaths = new Set<string>();
  const validatedDatasets: DatasetRecords[] = [];
  for (const entry of manifestValue.datasets) {
    if (datasetPaths.has(entry.path)) {
      throw new Error(`Duplicate dataset path: ${entry.path}`);
    }
    datasetPaths.add(entry.path);

    const definition = definitionForPath(entry.path);
    const dataPath = await resolveRepositoryFile(canonicalRoot, entry.path);
    const schemaPath = await resolveRepositoryFile(canonicalRoot, definition.schema);
    const dataBytes = await readFile(dataPath);
    const recordsValue: unknown = JSON.parse(dataBytes.toString("utf8")) as unknown;
    const canonicalRecords = canonicalJson(recordsValue);

    const actualChecksum = createHash("sha256").update(canonicalRecords, "utf8").digest("hex");
    if (actualChecksum !== entry.sha256) {
      throw new Error(`Checksum mismatch for ${entry.path}`);
    }
    if (!Array.isArray(recordsValue)) {
      throw new Error(`${entry.path} must contain a JSON array`);
    }

    const schemaValue = await readJson(schemaPath);
    const schema: unknown = definition.domain === "entity"
      ? schemaWithEntityTags(schemaValue, manifestValue.vocabularies.entity_tags)
      : schemaValue;
    const validateRecord: ValidateFunction<unknown> = ajv.compile<unknown>(schema as AnySchema);
    for (const [index, record] of recordsValue.entries()) {
      const description = `${entry.path}[${index}]`;
      assertValid(validateRecord, record, description);
      validateRecordPartition(record, definition, description);
    }
    validatedDatasets.push({ definition, entry, records: recordsValue });
  }

  const unregisteredFiles = await listDatasetFiles(canonicalRoot);
  const missingFiles = unregisteredFiles.filter((path) => !datasetPaths.has(path));
  const missingPaths = [...datasetPaths].filter((path) => !unregisteredFiles.includes(path));
  if (missingFiles.length > 0) {
    throw new Error(`Dataset files missing from manifest: ${missingFiles.join(", ")}`);
  }
  if (missingPaths.length > 0) {
    throw new Error(`Manifest paths do not exist as dataset files: ${missingPaths.join(", ")}`);
  }

  const warnings: string[] = [];
  for (const dataset of validatedDatasets) {
    const warning = englishSortWarning(dataset);
    if (warning !== undefined) {
      warnings.push(warning);
    }
  }
  validateCrossDatasetReferences(validatedDatasets);
  return warnings;
}
