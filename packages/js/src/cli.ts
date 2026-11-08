#!/usr/bin/env node

import { resolve } from "node:path";
import { sortRepository, validateRepository } from "./validator.js";

async function main(args: string[]): Promise<void> {
  const [command, rootDirectory = process.cwd()] = args;
  const root = resolve(rootDirectory);

  if (command === "sort") {
    await sortRepository(root);
    process.stdout.write("Dataset records sorted by English name; manifest checksums updated.\n");
    return;
  }

  if (command === "validate") {
    const warnings = await validateRepository(root);
    for (const warning of warnings) {
      process.stderr.write(`Warning: ${warning}\n`);
    }
    process.stdout.write("Dataset validation passed.\n");
    return;
  }

  throw new Error("Usage: refdatakit <validate|sort> [repository-root]");
}

void main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
