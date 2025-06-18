import axios from "axios";
import * as cheerio from "cheerio";
import type { ScrapedProduct, ScraperOptions, ScraperError } from "./types.js";

const DEFAULT_OPTIONS: Required<ScraperOptions> = {
  timeout: 10000,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  retries: 3,
};

export async function scrapeAmazonProduct(
  url: string,
  options: ScraperOptions = {}
): Promise<ScrapedProduct> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!url.includes("amazon.co.jp")) {
    throw new Error("URL must be from amazon.co.jp domain");
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.retries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: opts.timeout,
        headers: {
          "User-Agent": opts.userAgent,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
      });

      const $ = cheerio.load(response.data);

      // Extract title - try multiple selectors as Amazon's HTML structure can vary
      const titleSelectors = [
        "#productTitle",
        "span#productTitle",
        "h1.a-size-large",
        "h1 span",
        ".product-title",
      ];

      let title = "";
      for (const selector of titleSelectors) {
        title = $(selector).text().trim();
        if (title) break;
      }

      if (!title) {
        throw new Error("Could not find product title");
      }

      // Extract price - Amazon has various price selectors
      const priceSelectors = [
        ".a-price-current .a-offscreen",
        ".a-price .a-offscreen",
        ".a-price-whole",
        ".a-offscreen",
        "span.a-price",
        ".kindle-price",
        ".a-color-price",
      ];

      let price = "";
      for (const selector of priceSelectors) {
        const priceText = $(selector).first().text().trim();
        if (
          priceText &&
          (priceText.includes("￥") ||
            priceText.includes("¥") ||
            /\d/.test(priceText))
        ) {
          price = priceText;
          break;
        }
      }

      if (!price) {
        throw new Error("Could not find product price");
      }

      return {
        title: title.replace(/\s+/g, " ").trim(),
        price: price.trim(),
        timestamp: Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.retries) {
        break;
      }

      // Wait before retry (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }

  const scraperError: ScraperError = new Error(
    `Failed to scrape product after ${opts.retries} attempts: ${lastError?.message || "Unknown error"}`
  );
  scraperError.url = url;
  if (axios.isAxiosError(lastError)) {
    scraperError.status = lastError.response?.status;
  }

  throw scraperError;
}
