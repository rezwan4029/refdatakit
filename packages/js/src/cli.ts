#!/usr/bin/env node

import { resolve } from "node:path";
import { validateRepository } from "./validator.js";

async function main(args: string[]): Promise<void> {
  const [command, rootDirectory = process.cwd()] = args;
  if (command !== "validate") {
    throw new Error("Usage: refdatakit validate [repository-root]");
  }

  await validateRepository(resolve(rootDirectory));
  process.stdout.write("Dataset validation passed.\n");
}

void main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
