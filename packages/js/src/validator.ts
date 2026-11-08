import {
  Ajv2020,
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import type { FormatsPlugin } from "ajv-formats";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, relative, resolve, sep } from "node:path";

type DatasetDomain = "country" | "subdivision" | "city" | "entity";

interface DatasetSource {
  id: string;
}

interface DatasetEntry {
  id: string;
  domain: DatasetDomain;
  countryCode?: string;
  path: string;
  schema: string;
  status: "placeholder" | "ready";
  recordCount: number;
  sha256: string;
  license: string | null;
  sources: DatasetSource[];
}

interface DatasetManifest {
  schemaVersion: string;
  datasets: DatasetEntry[];
}

interface DatasetRecords {
  entry: DatasetEntry;
  records: unknown[];
}

const expectedSchemaPaths: Record<DatasetDomain, string> = {
  country: "schemas/country.schema.json",
  subdivision: "schemas/subdivision.schema.json",
  city: "schemas/city.schema.json",
  entity: "schemas/entity.schema.json",
};
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

function addToIndex(index: Map<string, Set<string>>, key: string, value: string): void {
  const values = index.get(key) ?? new Set<string>();
  values.add(value);
  index.set(key, values);
}

function validateRecordReferences(
  record: unknown,
  entry: DatasetEntry,
  availableSourceIds: Set<string>,
  description: string,
): void {
  if (!isObjectRecord(record)) {
    throw new Error(`${description} must be an object`);
  }

  if (entry.countryCode !== undefined && record.countryCode !== entry.countryCode) {
    throw new Error(`${description} countryCode does not match ${entry.countryCode}`);
  }

  const sourceIds = record.sourceIds;
  if (sourceIds === undefined) {
    return;
  }
  if (!Array.isArray(sourceIds) || !sourceIds.every((sourceId) => typeof sourceId === "string")) {
    throw new Error(`${description} sourceIds must be an array of strings`);
  }
  for (const sourceId of sourceIds) {
    if (!availableSourceIds.has(sourceId)) {
      throw new Error(`${description} references unknown source ${sourceId}`);
    }
  }
}

function validateCrossDatasetReferences(datasets: DatasetRecords[]): void {
  const countries = new Set<string>();
  const subdivisions = new Map<string, Set<string>>();
  const cities = new Map<string, Set<string>>();
  const recordIdentities = new Set<string>();

  for (const { entry, records } of datasets) {
    for (const [index, record] of records.entries()) {
      const description = `${entry.path}[${index}]`;
      const identity = requiredString(record, identityFields[entry.domain], description);
      const countryCode = entry.domain === "country"
        ? ""
        : requiredString(record, "countryCode", description);
      const scopedIdentity = `${entry.domain}:${countryCode}:${identity}`;
      if (recordIdentities.has(scopedIdentity)) {
        throw new Error(`${description} duplicates ${identityFields[entry.domain]} ${identity}`);
      }
      recordIdentities.add(scopedIdentity);

      if (entry.domain === "country") {
        countries.add(identity);
      } else if (entry.domain === "subdivision") {
        addToIndex(subdivisions, countryCode, identity);
      } else if (entry.domain === "city") {
        addToIndex(cities, countryCode, identity);
      }
    }
  }

  for (const { entry, records } of datasets) {
    for (const [index, record] of records.entries()) {
      const description = `${entry.path}[${index}]`;
      if (entry.domain === "country") {
        continue;
      }

      const countryCode = requiredString(record, "countryCode", description);
      if (!countries.has(countryCode)) {
        throw new Error(`${description} references unknown country ${countryCode}`);
      }

      const subdivisionCode = optionalString(record, "subdivisionCode", description);
      if (
        subdivisionCode !== undefined &&
        !subdivisions.get(countryCode)?.has(subdivisionCode)
      ) {
        throw new Error(`${description} references unknown subdivision ${subdivisionCode}`);
      }

      if (entry.domain === "subdivision") {
        const code = requiredString(record, "code", description);
        const parentCode = optionalString(record, "parentCode", description);
        if (parentCode === code) {
          throw new Error(`${description} cannot be its own parent`);
        }
        if (parentCode !== undefined && !subdivisions.get(countryCode)?.has(parentCode)) {
          throw new Error(`${description} references unknown parent subdivision ${parentCode}`);
        }
      }

      if (entry.domain === "entity") {
        const cityId = optionalString(record, "cityId", description);
        if (cityId !== undefined && !cities.get(countryCode)?.has(cityId)) {
          throw new Error(`${description} references unknown city ${cityId}`);
        }
      }
    }
  }
}

export async function validateRepository(rootDirectory: string): Promise<void> {
  const canonicalRoot = await realpath(rootDirectory);
  const manifestPath = await resolveRepositoryFile(canonicalRoot, "datasets/manifest.json");
  const manifestSchemaPath = await resolveRepositoryFile(canonicalRoot, "schemas/manifest.schema.json");
  const manifestSchema = await readJson(manifestSchemaPath);
  const manifestValue = await readJson(manifestPath);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const formatsModule = require("ajv-formats") as { default: FormatsPlugin };
  formatsModule.default(ajv);

  const validateManifest = ajv.compile<DatasetManifest>(manifestSchema as AnySchema);
  assertValid(validateManifest, manifestValue, "datasets/manifest.json");

  const datasetIds = new Set<string>();
  const datasetPaths = new Set<string>();
  const validatedDatasets: DatasetRecords[] = [];

  for (const entry of manifestValue.datasets) {
    if (datasetIds.has(entry.id)) {
      throw new Error(`Duplicate dataset id: ${entry.id}`);
    }
    if (datasetPaths.has(entry.path)) {
      throw new Error(`Duplicate dataset path: ${entry.path}`);
    }
    datasetIds.add(entry.id);
    datasetPaths.add(entry.path);

    if (entry.schema !== expectedSchemaPaths[entry.domain]) {
      throw new Error(`Dataset ${entry.id} must use ${expectedSchemaPaths[entry.domain]}`);
    }

    const dataPath = await resolveRepositoryFile(canonicalRoot, entry.path);
    const schemaPath = await resolveRepositoryFile(canonicalRoot, entry.schema);
    const dataBytes = await readFile(dataPath);
    const actualChecksum = createHash("sha256").update(dataBytes).digest("hex");
    if (actualChecksum !== entry.sha256) {
      throw new Error(`Checksum mismatch for ${entry.path}`);
    }

    const recordsValue: unknown = JSON.parse(dataBytes.toString("utf8")) as unknown;
    if (!Array.isArray(recordsValue)) {
      throw new Error(`${entry.path} must contain a JSON array`);
    }
    if (recordsValue.length !== entry.recordCount) {
      throw new Error(`${entry.path} recordCount does not match the manifest`);
    }

    const schema = await readJson(schemaPath);
    const validateRecord = ajv.compile<unknown>(schema as AnySchema);
    const sourceIds = new Set(entry.sources.map((source) => source.id));
    for (const [index, record] of recordsValue.entries()) {
      const description = `${entry.path}[${index}]`;
      assertValid(validateRecord, record, description);
      validateRecordReferences(record, entry, sourceIds, description);
    }
    validatedDatasets.push({ entry, records: recordsValue });
  }

  validateCrossDatasetReferences(validatedDatasets);
}
