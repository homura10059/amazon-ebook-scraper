/**
 * Domain scraper service - orchestrates HTTP client, HTML parser, and product creation
 * Following Domain Modeling Made Functional principles
 */

import { type ParsingError, parseProductData } from "./html-parser";
import {
  type HttpClient,
  type HttpClientConfig,
  type HttpError,
  createHttpClient,
} from "./http-client";
import { type Product, createProduct, getProductURL } from "./product";
import { type Result, err, flatMap, map, ok } from "./result";
import { AmazonURL, createAmazonURL, getAmazonURLValue } from "./value-objects";

/**
 * Scraper service errors (union of all possible domain errors)
 */
export type ScraperError =
  | { type: "UrlValidationError"; message: string; url: string }
  | { type: "HttpError"; message: string; httpError: HttpError }
  | { type: "ParsingError"; message: string; parsingError: ParsingError }
  | { type: "ProductCreationError"; message: string; cause: unknown }
  | { type: "ServiceError"; message: string; cause?: unknown };

/**
 * Scraper service configuration
 */
export interface ScraperServiceConfig {
  readonly httpConfig?: Partial<HttpClientConfig>;
}

/**
 * Scraper service implementation
 */
export class ScraperService {
  private readonly httpClient: HttpClient;

  constructor(config: ScraperServiceConfig = {}) {
    this.httpClient = createHttpClient(config.httpConfig);
  }

  /**
   * Scrape product from Amazon URL (main service method)
   */
  async scrapeProduct(url: string): Promise<Result<Product, ScraperError>> {
    // 1. Validate URL
    const urlResult = createAmazonURL(url);
    if (!urlResult.success) {
      return err({
        type: "UrlValidationError",
        message: `Invalid Amazon URL: ${urlResult.error.message}`,
        url,
      });
    }

    // 2. Fetch HTML content
    const httpResult = await this.httpClient.get(urlResult.data);
    if (!httpResult.success) {
      return err({
        type: "HttpError",
        message: `Failed to fetch page: ${httpResult.error.type}`,
        httpError: httpResult.error,
      });
    }

    // 3. Parse product data from HTML
    const parseResult = parseProductData(httpResult.data.body);
    if (!parseResult.success) {
      return err({
        type: "ParsingError",
        message: `Failed to parse product data: ${parseResult.error.type}`,
        parsingError: parseResult.error,
      });
    }

    // 4. Create domain product object
    const productResult = createProduct(
      url,
      parseResult.data.title,
      parseResult.data.price
    );

    if (!productResult.success) {
      return err({
        type: "ProductCreationError",
        message: `Failed to create product: ${productResult.error.message}`,
        cause: productResult.error,
      });
    }

    return ok(productResult.data);
  }

  /**
   * Scrape product with functional pipeline approach
   */
  async scrapeProductFunctional(
    url: string
  ): Promise<Result<Product, ScraperError>> {
    // Railway-oriented programming approach
    return flatMap(createAmazonURL(url), async (validUrl) =>
      flatMap(await this.httpClient.get(validUrl), (httpResponse) =>
        flatMap(parseProductData(httpResponse.body), (parsedData) =>
          map(
            createProduct(
              getAmazonURLValue(validUrl),
              parsedData.title,
              parsedData.price
            ),
            (product) => product
          )
        )
      )
    );
  }

  /**
   * Batch scrape multiple URLs
   */
  async scrapeMultipleProducts(
    urls: string[]
  ): Promise<Result<Product, ScraperError>[]> {
    return Promise.all(urls.map((url) => this.scrapeProduct(url)));
  }

  /**
   * Test URL accessibility (without full scraping)
   */
  async testUrl(url: string): Promise<Result<boolean, ScraperError>> {
    const urlResult = createAmazonURL(url);
    if (!urlResult.success) {
      return err({
        type: "UrlValidationError",
        message: `Invalid Amazon URL: ${urlResult.error.message}`,
        url,
      });
    }

    const httpResult = await this.httpClient.get(urlResult.data);
    if (!httpResult.success) {
      return err({
        type: "HttpError",
        message: `Failed to fetch page: ${httpResult.error.type}`,
        httpError: httpResult.error,
      });
    }

    return ok(httpResult.data.statusCode === 200);
  }

  /**
   * Get service configuration
   */
  getConfig(): HttpClientConfig {
    return this.httpClient.getConfig();
  }

  /**
   * Create new service with updated configuration
   */
  withConfig(config: ScraperServiceConfig): ScraperService {
    return new ScraperService(config);
  }
}

/**
 * Factory function for creating scraper service
 */
export const createScraperService = (
  config?: ScraperServiceConfig
): ScraperService => new ScraperService(config);

/**
 * Functional helper: Format scraper error for display
 */
export const formatScraperError = (error: ScraperError): string => {
  switch (error.type) {
    case "UrlValidationError":
      return `URL validation failed: ${error.message}`;
    case "HttpError":
      return `HTTP request failed: ${error.message}`;
    case "ParsingError":
      return `HTML parsing failed: ${error.message}`;
    case "ProductCreationError":
      return `Product creation failed: ${error.message}`;
    case "ServiceError":
      return `Service error: ${error.message}`;
    default:
      return `Unknown scraper error: ${JSON.stringify(error)}`;
  }
};

/**
 * Functional helper: Check if error is retryable
 */
export const isScraperErrorRetryable = (error: ScraperError): boolean => {
  switch (error.type) {
    case "HttpError":
      // Delegate to HTTP client's retry logic
      return (
        error.httpError.type === "NetworkError" ||
        error.httpError.type === "TimeoutError"
      );
    case "ServiceError":
      return true;
    case "UrlValidationError":
    case "ParsingError":
    case "ProductCreationError":
      return false;
    default:
      return false;
  }
};

/**
 * Pipeline function for scraping with error handling
 */
export const scrapeWithPipeline = async (
  url: string,
  config?: ScraperServiceConfig
): Promise<Result<Product, ScraperError>> => {
  const service = createScraperService(config);
  return service.scrapeProduct(url);
};
