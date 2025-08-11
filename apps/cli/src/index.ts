#!/usr/bin/env node

import type { ArgumentsCamelCase } from "yargs";
import { createYargsParser } from "./argument-parser";
import { loadConfig, getConfigSummary } from "./config";
import { createNotificationScraper } from "./pipeline";
import type { CliArguments } from "./types";

// Enhanced interface for CLI arguments
interface YargsArgs {
  urls: string[];
  config?: string;
  test?: boolean;
}

// Progress display utilities
const displayProgress = (current: number, total: number, url: string): void => {
  const percentage = Math.round((current / total) * 100);
  console.log(`[${current}/${total}] (${percentage}%) Processing: ${url}`);
};

const displaySummary = (results: {
  total: number;
  successful: number;
  failed: number;
}): void => {
  console.log("\n" + "=".repeat(50));
  console.log("📊 PROCESSING SUMMARY");
  console.log("=".repeat(50));
  console.log(`Total URLs processed: ${results.total}`);
  console.log(`✅ Successful: ${results.successful}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.successful > 0) {
    console.log("\n✨ Notifications sent successfully!");
  }
  
  if (results.failed > 0) {
    console.log("\n⚠️  Some URLs failed to process. Check the output above for details.");
  }
};

// Test configuration and webhook connection
const testConfiguration = async (configPath?: string): Promise<void> => {
  console.log("🔍 Testing configuration...");
  
  // Load configuration
  const configResult = await loadConfig(configPath);
  if (!configResult.success) {
    console.error(`❌ Configuration error: ${configResult.error.message}`);
    process.exit(1);
  }
  
  // Display configuration summary
  const summary = getConfigSummary(configResult.data);
  console.log("\n📋 Configuration Summary:");
  console.log(JSON.stringify(summary, null, 2));
  
  // Create pipeline and test
  const pipelineResult = createNotificationScraper(configResult.data);
  if (!pipelineResult.success) {
    console.error(`❌ Pipeline creation failed: ${pipelineResult.error.message}`);
    process.exit(1);
  }
  
  // Test webhook connection
  console.log("\n🔗 Testing Discord webhook connection...");
  const testResult = await pipelineResult.data.testConfig();
  if (!testResult.success) {
    console.error(`❌ Webhook test failed: ${testResult.error.message}`);
    process.exit(1);
  }
  
  console.log("✅ Configuration and webhook connection test successful!");
};

// Process URLs with scraping and notifications
const processUrls = async (urls: readonly string[], configPath?: string): Promise<void> => {
  console.log("🚀 Starting Amazon ebook scraper with notifications...");
  console.log(`📝 Processing ${urls.length} URL(s)\n`);
  
  // Load configuration
  const configResult = await loadConfig(configPath);
  if (!configResult.success) {
    console.error(`❌ Configuration error: ${configResult.error.message}`);
    process.exit(1);
  }
  
  // Create pipeline
  const pipelineResult = createNotificationScraper(configResult.data);
  if (!pipelineResult.success) {
    console.error(`❌ Pipeline creation failed: ${pipelineResult.error.message}`);
    process.exit(1);
  }
  
  const pipeline = pipelineResult.data;
  
  // Process URLs with progress tracking
  console.log("📊 Processing URLs:");
  const results = [];
  
  for (const [index, url] of urls.entries()) {
    displayProgress(index + 1, urls.length, url);
    
    const result = await pipeline.processUrl(url);
    results.push(result);
    
    if (result.success) {
      console.log(`   ✅ Successfully processed and notified`);
      if (result.data) {
        console.log(`   📖 Title: ${result.data.title}`);
        console.log(`   💰 Price: ${result.data.price}`);
      }
    } else {
      console.log(`   ❌ Failed: ${result.error?.message}`);
    }
    
    // Add delay between requests (except for the last one)
    if (index < urls.length - 1) {
      const delayMs = configResult.data.scraper?.delayBetweenRequests || 1000;
      console.log(`   ⏱️  Waiting ${delayMs}ms before next request...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    console.log(""); // Empty line for readability
  }
  
  // Display final summary
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  displaySummary({
    total: results.length,
    successful,
    failed,
  });
};

const handleArguments = async (argv: ArgumentsCamelCase<YargsArgs>): Promise<void> => {
  const urls: string[] = argv.urls || [];
  const configPath = argv.config;
  const testMode = argv.test;
  
  try {
    if (testMode) {
      // Test mode: validate configuration and webhook connection
      await testConfiguration(configPath);
    } else {
      // Normal mode: process URLs
      if (urls.length === 0) {
        console.error("❌ No URLs provided.");
        process.exit(1);
      }
      
      await processUrls(urls, configPath);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`❌ Fatal error: ${errorMessage}`);
    process.exit(1);
  }
};

const main = (): void => {
  const parser = createYargsParser();
  
  // Set up command handler with enhanced options
  parser
    .command(
      "$0 [urls..]",
      "Scrapes Amazon product information and sends Discord notifications",
      (yargs) => {
        return yargs
          .positional("urls", {
            describe: "Amazon product URLs to scrape (required unless using --test)",
            type: "string",
            array: true,
          })
          .option("config", {
            alias: "c",
            describe: "Path to JSON configuration file",
            type: "string",
          })
          .option("test", {
            alias: "t",
            describe: "Test configuration and Discord webhook connection",
            type: "boolean",
            default: false,
          })
          .check((argv) => {
            // Require URLs unless in test mode
            if (!argv.test && (!argv.urls || argv.urls.length === 0)) {
              throw new Error("At least one URL is required (unless using --test mode)");
            }
            return true;
          });
      },
      handleArguments
    )
    .example(
      "$0 https://amazon.co.jp/dp/123456789",
      "Scrape a single Amazon product and send notification"
    )
    .example(
      "$0 -c config.json https://amazon.co.jp/dp/123 https://amazon.co.jp/dp/456",
      "Process multiple URLs with custom configuration"
    )
    .example(
      "$0 --test",
      "Test configuration and webhook connection"
    )
    .example(
      "$0 --test --config config.json",
      "Test specific configuration file"
    )
    .fail((msg, err) => {
      if (err) {
        console.error(`❌ Error: ${err.message}`);
      } else {
        console.error(`❌ Error: ${msg}`);
      }
      console.error("\n💡 Use --help for usage information.");
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
