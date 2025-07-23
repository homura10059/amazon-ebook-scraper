/**
 * Domain model for Amazon product
 * Following Domain Modeling Made Functional principles
 */

import { type Result, err, flatMap, map, ok } from "./result";
import {
  type AmazonURL,
  type ProductPrice,
  type ProductTitle,
  type ValidationError,
  createAmazonURL,
  createProductPrice,
  createProductTitle,
  getAmazonURLValue,
  getProductPriceValue,
  getProductTitleValue,
} from "./value-objects";

/**
 * Domain model for a scraped Amazon product
 * Uses branded value objects to ensure type safety
 */
export interface Product {
  readonly url: AmazonURL;
  readonly title: ProductTitle;
  readonly price: ProductPrice;
  readonly timestamp: number; // Unix timestamp
}

/**
 * Raw product data from scraping (before validation)
 */
export interface RawProductData {
  readonly url: string;
  readonly title: string;
  readonly price: string;
}

/**
 * Product creation error
 */
export type ProductCreationError =
  | ValidationError
  | {
      type: "ProductCreationFailed";
      message: string;
      details: ValidationError[];
    };

/**
 * Create a validated Product domain object
 */
export const createProduct = (
  url: string,
  title: string,
  price: string,
  timestamp?: number
): Result<Product, ProductCreationError> => {
  // Validate all components
  const urlResult = createAmazonURL(url);
  const titleResult = createProductTitle(title);
  const priceResult = createProductPrice(price);

  // Collect all validation errors
  const errors: ValidationError[] = [];

  if (!urlResult.success) errors.push(urlResult.error);
  if (!titleResult.success) errors.push(titleResult.error);
  if (!priceResult.success) errors.push(priceResult.error);

  // If any validation failed, return aggregated error
  if (errors.length > 0) {
    return err({
      type: "ProductCreationFailed" as const,
      message: `Failed to create product: ${errors.length} validation error(s)`,
      details: errors,
    });
  }

  // All validations passed, create product
  const product: Product = {
    url: urlResult.data,
    title: titleResult.data,
    price: priceResult.data,
    timestamp: timestamp ?? Math.floor(Date.now() / 1000),
  };

  return ok(product);
};

/**
 * Create Product from raw data (railway-oriented style)
 */
export const createProductFromRaw = (
  rawData: RawProductData,
  timestamp?: number
): Result<Product, ProductCreationError> =>
  createProduct(rawData.url, rawData.title, rawData.price, timestamp);

/**
 * Update product timestamp
 */
export const updateProductTimestamp = (
  product: Product,
  newTimestamp: number
): Product => ({
  ...product,
  timestamp: newTimestamp,
});

/**
 * Convert Product to serializable format
 */
export const productToSerializable = (product: Product) => ({
  url: getAmazonURLValue(product.url),
  title: getProductTitleValue(product.title),
  price: getProductPriceValue(product.price),
  timestamp: product.timestamp,
});

/**
 * Convert Product to legacy ScrapedProduct format for backwards compatibility
 */
export const productToLegacyFormat = (product: Product) => ({
  title: getProductTitleValue(product.title),
  price: getProductPriceValue(product.price),
  timestamp: product.timestamp,
});

/**
 * Product comparison for equality
 */
export const isProductEqual = (a: Product, b: Product): boolean =>
  getAmazonURLValue(a.url) === getAmazonURLValue(b.url) &&
  getProductTitleValue(a.title) === getProductTitleValue(b.title) &&
  getProductPriceValue(a.price) === getProductPriceValue(b.price);

/**
 * Check if product data is fresh (within specified seconds)
 */
export const isProductFresh = (
  product: Product,
  maxAgeSeconds: number
): boolean => {
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime - product.timestamp <= maxAgeSeconds;
};

/**
 * Product validation predicates
 */
export const isValidProduct = (product: Product): boolean => {
  // Additional business logic validation beyond value object validation
  return product.timestamp > 0 && product.timestamp <= Date.now() / 1000;
};

/**
 * Extract URL from Product for scraping operations
 */
export const getProductURL = (product: Product): string =>
  getAmazonURLValue(product.url);

/**
 * Format product for display
 */
export const formatProductForDisplay = (product: Product): string => {
  const title = getProductTitleValue(product.title);
  const price = getProductPriceValue(product.price);
  const date = new Date(product.timestamp * 1000).toISOString();

  return `Product: ${title}\nPrice: ${price}\nScraped: ${date}`;
};
