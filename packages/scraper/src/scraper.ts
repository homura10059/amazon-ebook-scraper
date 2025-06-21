import * as cheerio from "cheerio";
import got from "got";
import type { ScrapedProduct, ScraperError, ScraperOptions } from "./types.js";

// Type for Got response
interface GotResponse {
  body: string;
}

// Type for Got error with response
interface GotErrorWithResponse extends Error {
  response?: {
    statusCode: number;
  };
}

const DEFAULT_OPTIONS: Required<ScraperOptions> = {
  timeout: 10000,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  retries: 3,
};

// Functional helper: Validate Amazon URL
const validateAmazonUrl = (url: string): string => {
  if (!url.includes("amazon.co.jp")) {
    throw new Error("URL must be from amazon.co.jp domain");
  }
  return url;
};

// Functional helper: Create HTTP request options
const createRequestOptions = (opts: Required<ScraperOptions>) => ({
  timeout: { response: opts.timeout },
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

// Functional helper: Extract text using selectors
const findTextBySelectors = (
  $: cheerio.CheerioAPI,
  selectors: readonly string[]
): string | null => {
  return (
    selectors
      .map((selector) => $(selector).text().trim())
      .find((text) => text.length > 0) || null
  );
};

// Functional helper: Check if price text is valid
const isValidPriceText = (text: string): boolean =>
  text.length > 0 &&
  (text.includes("￥") || text.includes("¥") || /\d/.test(text));

// Functional helper: Extract price using selectors
const findPriceBySelectors = (
  $: cheerio.CheerioAPI,
  selectors: readonly string[]
): string | null => {
  return (
    selectors
      .map((selector) => $(selector).first().text().trim())
      .find(isValidPriceText) || null
  );
};

// Functional helper: Create scraped product
const createScrapedProduct = (
  title: string,
  price: string
): ScrapedProduct => ({
  title: title.replace(/\s+/g, " ").trim(),
  price: price.trim(),
  timestamp: Math.floor(Date.now() / 1000),
});

// Functional helper: Extract product data from HTML
const extractProductData = (html: string): ScrapedProduct => {
  const $ = cheerio.load(html);

  const titleSelectors = [
    "#productTitle",
    "span#productTitle",
    "h1.a-size-large",
    "h1 span",
    ".product-title",
  ] as const;

  const priceSelectors = [
    ".a-price-current .a-offscreen",
    ".a-price .a-offscreen",
    ".a-price-whole",
    ".a-offscreen",
    "span.a-price",
    ".kindle-price",
    ".a-color-price",
  ] as const;

  const title = findTextBySelectors($, titleSelectors);
  if (!title) {
    throw new Error("Could not find product title");
  }

  const price = findPriceBySelectors($, priceSelectors);
  if (!price) {
    throw new Error("Could not find product price");
  }

  return createScrapedProduct(title, price);
};

// Functional helper: Create exponential backoff delay
const createExponentialDelay = (attempt: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));

// Functional helper: Create enhanced error with context
const createScraperError = (
  url: string,
  retries: number,
  lastError: Error | null
): ScraperError => {
  const scraperError: ScraperError = new Error(
    `Failed to scrape product after ${retries} attempts: ${lastError?.message || "Unknown error"}`
  );
  scraperError.url = url;

  if (lastError && "response" in lastError && lastError.response) {
    scraperError.status = (
      lastError as GotErrorWithResponse
    ).response?.statusCode;
  }

  return scraperError;
};

// Functional helper: Single scrape attempt
const attemptScrape = async (
  url: string,
  requestOptions: ReturnType<typeof createRequestOptions>
): Promise<ScrapedProduct> => {
  const response: GotResponse = await got(url, requestOptions);
  return extractProductData(response.body);
};

// Functional helper: Retry with exponential backoff
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number,
  currentAttempt = 1,
  lastError: Error | null = null
): Promise<T> => {
  if (currentAttempt > maxRetries) {
    throw lastError || new Error("Max retries exceeded");
  }

  try {
    return await operation();
  } catch (error) {
    if (currentAttempt === maxRetries) {
      throw error;
    }

    await createExponentialDelay(currentAttempt);
    return retryWithBackoff(
      operation,
      maxRetries,
      currentAttempt + 1,
      error as Error
    );
  }
};

export async function scrapeAmazonProduct(
  url: string,
  options: ScraperOptions = {}
): Promise<ScrapedProduct> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    const validUrl = validateAmazonUrl(url);
    const requestOptions = createRequestOptions(opts);

    return await retryWithBackoff(
      () => attemptScrape(validUrl, requestOptions),
      opts.retries
    );
  } catch (error) {
    throw createScraperError(url, opts.retries, error as Error);
  }
}
