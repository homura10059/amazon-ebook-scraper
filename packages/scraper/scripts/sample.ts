#!/usr/bin/env tsx

import { scrapeAmazonProduct } from "../src";

const main = async (): Promise<void> => {
  try {
    // Sample Amazon.co.jp ebook URL
    const url = "https://www.amazon.co.jp/dp/B00I8AT1D6"; // Sample Kindle book
    
    console.log("Scraping Amazon product...");
    console.log(`URL: ${url}`);
    console.log("---");

    const result = await scrapeAmazonProduct(url, {
      timeout: 15000,
      retries: 2
    });

    console.log("Scraping successful!");
    console.log(`Title: ${result.title}`);
    console.log(`Price: ${result.price}`);
    console.log(`Timestamp: ${result.timestamp}`);
    console.log(`Date: ${new Date(result.timestamp * 1000).toISOString()}`);
  } catch (error) {
    console.error("Scraping failed:");
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
};

main();