#!/usr/bin/env node

import type { ArgumentsCamelCase } from "yargs";
import { createYargsParser } from "./argument-parser";
import type { CliArguments } from "./types";

const processUrls = (urls: readonly string[]): void => {
  console.log("Processing URLs:");
  for (const url of urls) {
    console.log(`  - ${url}`);
  }
  console.log("\n⚠️  Note: This is Step 1 implementation.");
  console.log(
    "   Actual scraping and notification will be implemented in later steps."
  );
};

interface YargsArgs {
  urls: string[];
}

const handleArguments = (argv: ArgumentsCamelCase<YargsArgs>): void => {
  // Extract URLs from yargs output
  const urls: string[] = argv.urls || [];

  if (urls.length === 0) {
    console.error("No URLs provided.");
    process.exit(1);
  }

  processUrls(urls);
};

const main = (): void => {
  const parser = createYargsParser();

  // Set up command handler
  parser
    .command(
      "$0 <urls..>",
      "Scrapes Amazon product information and sends notifications",
      (yargs) => {
        return yargs.positional("urls", {
          describe: "Amazon product URLs to scrape",
          type: "string",
          array: true,
          demandOption: true,
        });
      },
      handleArguments
    )
    .fail((msg, err) => {
      if (err) {
        console.error(`Error: ${err.message}`);
      } else {
        console.error(`Error: ${msg}`);
      }
      process.exit(1);
    })
    .parse();
};

// Run the CLI if this file is executed directly
if (
  typeof import.meta !== "undefined" &&
  import.meta.url === `file://${process.argv[1]}`
) {
  main();
}

// Export for compatibility with existing tests
export { main, createYargsParser };
export { parseArguments } from "./argument-parser";
