import { scrapeAmazonProduct } from "../src/scraper.js";

async function example() {
  try {
    // Example Amazon.co.jp URL (replace with actual product URL)
    const url = "https://www.amazon.co.jp/dp/B0CDTM3795";

    console.log("Scraping product:", url);

    const result = await scrapeAmazonProduct(url, {
      timeout: 15000,
      retries: 2,
    });

    console.log("Scraped product data:");
    console.log("Title:", result.title);
    console.log("Price:", result.price);
    console.log("Timestamp:", result.timestamp);
    console.log("Date:", new Date(result.timestamp * 1000).toISOString());
  } catch (error) {
    console.error("Error scraping product:", error);
  }
}

const main = async () => {
  await example();
}

main();