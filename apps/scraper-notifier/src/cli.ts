#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { program } from "commander";
import type { CLIConfig } from "./config";
import {
  createExampleConfig,
  findDefaultConfigFile,
  loadConfig,
} from "./config";
import {
  formatPipelineError,
  runBatchScrapingPipeline,
  runScrapingPipeline,
  testDiscordConnection,
} from "./pipeline";

// Package information
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

// Functional helper: Print success message
const printSuccess = (message: string): void => {
  console.log(`✅ ${message}`);
};

// Functional helper: Print error message
const printError = (message: string): void => {
  console.error(`❌ ${message}`);
};

// Functional helper: Print warning message
const printWarning = (message: string): void => {
  console.warn(`⚠️  ${message}`);
};

// Functional helper: Print info message
const printInfo = (message: string): void => {
  console.log(`ℹ️  ${message}`);
};

// Functional helper: Print JSON output
const printJson = (data: unknown): void => {
  console.log(JSON.stringify(data, null, 2));
};

// Functional helper: Load configuration with error handling
const loadConfigWithErrorHandling = (configPath?: string): CLIConfig | null => {
  // Try to find default config if none specified
  const finalConfigPath = configPath || findDefaultConfigFile();

  if (finalConfigPath) {
    printInfo(`Loading configuration from: ${finalConfigPath}`);
  } else if (!process.env.DISCORD_WEBHOOK_URL) {
    printError("No configuration file found and DISCORD_WEBHOOK_URL not set");
    printInfo(
      "Use --config to specify a config file or set DISCORD_WEBHOOK_URL environment variable"
    );
    printInfo(
      "Run 'scraper-notifier init' to create an example configuration file"
    );
    return null;
  }

  const configResult = loadConfig(finalConfigPath || undefined);
  if (!configResult.success) {
    printError(`Configuration error: ${configResult.error.message}`);
    if (configResult.error.field) {
      printInfo(`Field: ${configResult.error.field}`);
    }
    return null;
  }

  return configResult.data;
};

// Command: Initialize configuration file
const initCommand = (filePath = "./scraper-notifier.json"): void => {
  try {
    const exampleConfig = createExampleConfig();
    writeFileSync(filePath, exampleConfig);
    printSuccess(`Configuration file created: ${filePath}`);
    printInfo(
      "Edit the file to set your Discord webhook URL and customize settings"
    );
  } catch (error) {
    printError(
      `Failed to create configuration file: ${(error as Error).message}`
    );
    process.exit(1);
  }
};

// Command: Test Discord webhook connection
const testCommand = async (options: { config?: string }): Promise<void> => {
  const config = loadConfigWithErrorHandling(options.config);
  if (!config) {
    process.exit(1);
  }

  printInfo("Testing Discord webhook connection...");

  const result = await testDiscordConnection(config);
  if (result.success) {
    printSuccess("Discord webhook connection successful!");
  } else {
    printError(`Connection test failed: ${formatPipelineError(result.error)}`);
    process.exit(1);
  }
};

// Command: Scrape single URL
const scrapeCommand = async (
  url: string,
  options: {
    config?: string;
    "no-notify"?: boolean;
    "notify-errors"?: boolean;
    description?: string;
    json?: boolean;
  }
): Promise<void> => {
  const config = loadConfigWithErrorHandling(options.config);
  if (!config) {
    process.exit(1);
  }

  if (options.json) {
    // Suppress info messages for JSON output
  } else {
    printInfo(`Scraping: ${url}`);
  }

  const result = await runScrapingPipeline(url, config, {
    notifyOnSuccess: !options["no-notify"],
    notifyOnError: options["notify-errors"] || false,
    metadata: {
      description: options.description,
    },
  });

  if (result.success) {
    if (options.json) {
      printJson(result.data);
    } else {
      printSuccess("Product scraped successfully!");
      console.log(`Title: ${result.data.title}`);
      console.log(`Price: ${result.data.price}`);
      console.log(
        `Timestamp: ${new Date(result.data.timestamp * 1000).toISOString()}`
      );

      if (!options["no-notify"]) {
        printInfo("Discord notification sent");
      }
    }
  } else {
    if (options.json) {
      printJson({ error: formatPipelineError(result.error) });
    } else {
      printError(formatPipelineError(result.error));
    }
    process.exit(1);
  }
};

// Command: Scrape multiple URLs from file
const batchCommand = async (
  filePath: string,
  options: {
    config?: string;
    "no-notify"?: boolean;
    "notify-errors"?: boolean;
    description?: string;
    json?: boolean;
  }
): Promise<void> => {
  const config = loadConfigWithErrorHandling(options.config);
  if (!config) {
    process.exit(1);
  }

  // Read URLs from file
  let urls: string[];
  try {
    const content = readFileSync(filePath, "utf8");
    urls = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  } catch (error) {
    printError(`Failed to read URLs file: ${(error as Error).message}`);
    process.exit(1);
  }

  if (urls.length === 0) {
    printWarning("No URLs found in file");
    return;
  }

  if (!options.json) {
    printInfo(`Processing ${urls.length} URLs from: ${filePath}`);
  }

  const result = await runBatchScrapingPipeline(urls, config, {
    notifyOnSuccess: !options["no-notify"],
    notifyOnError: options["notify-errors"] || false,
    metadata: {
      description: options.description,
    },
  });

  if (options.json) {
    printJson({
      summary: result.summary,
      results: result.results.map((r, i) => ({
        url: urls[i],
        success: r.success,
        data: r.success ? r.data : undefined,
        error: r.success ? undefined : formatPipelineError(r.error),
      })),
    });
  } else {
    printInfo("Batch processing complete:");
    console.log(`  Total: ${result.summary.total}`);
    console.log(`  Successful: ${result.summary.successful}`);
    console.log(`  Failed: ${result.summary.failed}`);

    if (result.summary.failed > 0) {
      printWarning("Some URLs failed to process:");
      result.results.forEach((r, i) => {
        if (!r.success) {
          console.log(`  ${urls[i]}: ${formatPipelineError(r.error)}`);
        }
      });
    }
  }
};

// Configure CLI program
export const configureCLI = (): typeof program => {
  program
    .name("scraper-notifier")
    .description(
      "CLI tool for scraping Amazon ebooks and sending Discord notifications"
    )
    .version(packageJson.version);

  // Global options
  program.option(
    "-c, --config <path>",
    "Path to configuration file (default: ./scraper-notifier.json or ./config.json)"
  );

  // Init command
  program
    .command("init")
    .description("Create an example configuration file")
    .argument("[file]", "Configuration file path", "./scraper-notifier.json")
    .action(initCommand);

  // Test command
  program
    .command("test")
    .description("Test Discord webhook connection")
    .action(testCommand);

  // Scrape command
  program
    .command("scrape")
    .description("Scrape a single Amazon ebook URL")
    .argument("<url>", "Amazon ebook URL to scrape")
    .option("--no-notify", "Don't send Discord notification")
    .option("--notify-errors", "Send Discord notification on errors")
    .option(
      "-d, --description <text>",
      "Custom description for the notification"
    )
    .option("--json", "Output result as JSON")
    .action(scrapeCommand);

  // Batch command
  program
    .command("batch")
    .description("Scrape multiple URLs from a file")
    .argument("<file>", "File containing URLs (one per line)")
    .option("--no-notify", "Don't send Discord notifications")
    .option("--notify-errors", "Send Discord notification on errors")
    .option("-d, --description <text>", "Custom description for notifications")
    .option("--json", "Output results as JSON")
    .action(batchCommand);

  return program;
};

// Main CLI entry point
export const runCLI = (): void => {
  const cli = configureCLI();
  cli.parse();
};
