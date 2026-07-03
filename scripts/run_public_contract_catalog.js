#!/usr/bin/env node

import {
  buildPublicContractCatalogPipeline,
  printPublicContractCatalogSummary,
} from "../src/lib/public_contract_catalog.js";

function main() {
  const { catalog, paths } = buildPublicContractCatalogPipeline(null, {
    rootDir: process.cwd(),
  });

  console.log(printPublicContractCatalogSummary(catalog));
  console.log(`[Public Contract Catalog] json: ${paths.json}`);
  console.log(`[Public Contract Catalog] markdown: ${paths.markdown}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Public Contract Catalog] failed: ${message}`);
  process.exitCode = 1;
}
