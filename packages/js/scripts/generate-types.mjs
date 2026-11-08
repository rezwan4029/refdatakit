import { compileFromFile } from "json-schema-to-typescript";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, "..");
const repositoryDirectory = resolve(packageDirectory, "../..");
const outputDirectory = resolve(packageDirectory, "src/generated");
const schemaNames = ["country", "subdivision", "city", "entity"];

await mkdir(outputDirectory, { recursive: true });

for (const schemaName of schemaNames) {
  const schemaPath = resolve(repositoryDirectory, "schemas", `${schemaName}.schema.json`);
  const generatedTypes = await compileFromFile(schemaPath, {
    bannerComment: `/* Generated from schemas/${schemaName}.schema.json. Do not edit. */`,
  });
  await writeFile(resolve(outputDirectory, `${schemaName}.ts`), generatedTypes);
}
