#!/usr/bin/env node

import { runSmartAutoFix } from "./lib/smart_auto_fix.js";

async function main() {
  const applyMode = process.argv.includes("--apply");

  await runSmartAutoFix({
    apply: applyMode,
    log: (message) => console.log(message),
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`エラー: ${message}`);
  process.exit(1);
});
