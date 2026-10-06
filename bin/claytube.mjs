#!/usr/bin/env node

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const compiledEntry = new URL("../dist-cli/cli/index.js", import.meta.url);

if (existsSync(fileURLToPath(compiledEntry))) {
  const { main } = await import(compiledEntry.href);
  await main(process.argv.slice(2));
} else {
  throw new Error("ClayTube CLI is not built. Run npm run build:cli first.");
}
