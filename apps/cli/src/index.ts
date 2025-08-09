#!/usr/bin/env node

import { parseArguments } from './argument-parser';
import type { CliArguments } from './types';

const HELP_TEXT = `
Amazon Ebook Scraper CLI

USAGE:
  amazon-ebook-scraper <URL> [URL...]

ARGUMENTS:
  <URL>           Amazon product URLs to scrape

OPTIONS:
  -h, --help      Show this help message

EXAMPLES:
  amazon-ebook-scraper https://amazon.co.jp/dp/123456789
  amazon-ebook-scraper https://amazon.co.jp/dp/123 https://amazon.co.jp/dp/456

DESCRIPTION:
  Scrapes Amazon product information and sends notifications.
  This is Step 1 implementation - basic CLI setup with argument parsing.
`;

const showHelp = (): void => {
  console.log(HELP_TEXT);
};

const processUrls = (urls: readonly string[]): void => {
  console.log('Processing URLs:');
  for (const url of urls) {
    console.log(`  - ${url}`);
  }
  console.log('\\n⚠️  Note: This is Step 1 implementation.');
  console.log('   Actual scraping and notification will be implemented in later steps.');
};

const handleArguments = (args: CliArguments): void => {
  if (args.help) {
    showHelp();
    return;
  }

  if (args.urls.length === 0) {
    console.error('No URLs provided.');
    showHelp();
    process.exit(1);
  }

  processUrls(args.urls);
};

const main = (): void => {
  const args = process.argv.slice(2);
  const parseResult = parseArguments(args);

  if (!parseResult.success) {
    console.error(`Error: ${parseResult.error}`);
    showHelp();
    process.exit(1);
  }

  handleArguments(parseResult.data);
};

// Run the CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, parseArguments };