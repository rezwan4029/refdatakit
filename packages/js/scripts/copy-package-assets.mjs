import { cp, copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const outputRoot = resolve(packageRoot, "dist");
await mkdir(outputRoot, { recursive: true });
await cp(resolve(repositoryRoot, "datasets"), resolve(outputRoot, "data/datasets"), { recursive: true });
await cp(resolve(repositoryRoot, "schemas"), resolve(outputRoot, "data/schemas"), { recursive: true });
await copyFile(resolve(repositoryRoot, "LICENSE"), resolve(outputRoot, "LICENSE"));
