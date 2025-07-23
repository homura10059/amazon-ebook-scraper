/**
 * Functional HTML parser for Amazon product pages
 * Following Domain Modeling Made Functional principles
 */

import * as cheerio from "cheerio";
import { type Result, err, ok, tryCatch } from "./result";
import {
  type ProductPrice,
  type ProductTitle,
  createProductPrice,
  createProductTitle,
} from "./value-objects";

/**
 * HTML parsing errors in domain terms
 */
export type ParsingError =
  | { type: "HtmlParseError"; message: string; cause?: unknown }
  | { type: "ElementNotFound"; message: string; selectors: readonly string[] }
  | { type: "InvalidContent"; message: string; content: string; field: string }
  | { type: "ValidationError"; message: string; cause: unknown };

/**
 * Parsed product data from HTML
 */
export interface ParsedProductData {
  readonly title: ProductTitle;
  readonly price: ProductPrice;
}

/**
 * CSS selectors for Amazon product elements
 */
const TITLE_SELECTORS = [
  "#productTitle",
  "span#productTitle",
  "h1.a-size-large",
  "h1 span",
  ".product-title",
  "[data-automation-id='title']",
  ".a-size-large.a-spacing-none.a-color-base",
] as const;

const PRICE_SELECTORS = [
  ".a-price-current .a-offscreen",
  ".a-price .a-offscreen",
  ".a-price-whole",
  ".a-offscreen",
  "span.a-price",
  ".kindle-price",
  ".a-color-price",
  ".a-price-symbol",
  ".a-price.a-text-price.a-size-medium.a-color-base .a-offscreen",
  "[data-automation-id='price']",
  ".a-price-range .a-offscreen",
] as const;

/**
 * Load HTML into Cheerio with error handling
 */
const loadHtml = (html: string): Result<cheerio.CheerioAPI, ParsingError> =>
  tryCatch(
    () => cheerio.load(html),
    (error) => ({
      type: "HtmlParseError" as const,
      message: `Failed to parse HTML: ${String(error)}`,
      cause: error,
    })
  );

/**
 * Extract text content using CSS selectors (functional approach)
 */
const extractTextBySelectors = (
  $: cheerio.CheerioAPI,
  selectors: readonly string[]
): string | null => {
  return (
    selectors
      .map((selector) => $(selector).first().text().trim())
      .find((text) => text.length > 0) || null
  );
};

/**
 * Validate price text content
 */
const isValidPriceText = (text: string): boolean => {
  if (!text || text.length === 0) return false;

  // Must contain yen symbol or digits
  const hasYenSymbol = text.includes("￥") || text.includes("¥");
  const hasDigits = /\d/.test(text);

  return hasYenSymbol || hasDigits;
};

/**
 * Extract price text using specialized price validation
 */
const extractPriceBySelectors = (
  $: cheerio.CheerioAPI,
  selectors: readonly string[]
): string | null => {
  return (
    selectors
      .map((selector) => $(selector).first().text().trim())
      .find(isValidPriceText) || null
  );
};

/**
 * Parse product title from HTML
 */
export const parseProductTitle = (
  html: string
): Result<ProductTitle, ParsingError> => {
  const loadResult = loadHtml(html);
  if (!loadResult.success) return loadResult;

  const $ = loadResult.data;
  const titleText = extractTextBySelectors($, TITLE_SELECTORS);

  if (!titleText) {
    return err({
      type: "ElementNotFound",
      message: "Could not find product title in HTML",
      selectors: TITLE_SELECTORS,
    });
  }

  // Validate using domain value object
  const titleResult = createProductTitle(titleText);
  if (!titleResult.success) {
    return err({
      type: "ValidationError",
      message: `Product title validation failed: ${titleResult.error.message}`,
      cause: titleResult.error,
    });
  }

  return ok(titleResult.data);
};

/**
 * Parse product price from HTML
 */
export const parseProductPrice = (
  html: string
): Result<ProductPrice, ParsingError> => {
  const loadResult = loadHtml(html);
  if (!loadResult.success) return loadResult;

  const $ = loadResult.data;
  const priceText = extractPriceBySelectors($, PRICE_SELECTORS);

  if (!priceText) {
    return err({
      type: "ElementNotFound",
      message: "Could not find product price in HTML",
      selectors: PRICE_SELECTORS,
    });
  }

  // Validate using domain value object
  const priceResult = createProductPrice(priceText);
  if (!priceResult.success) {
    return err({
      type: "ValidationError",
      message: `Product price validation failed: ${priceResult.error.message}`,
      cause: priceResult.error,
    });
  }

  return ok(priceResult.data);
};

/**
 * Parse complete product data from HTML (railway-oriented)
 */
export const parseProductData = (
  html: string
): Result<ParsedProductData, ParsingError> => {
  const titleResult = parseProductTitle(html);
  if (!titleResult.success) return titleResult;

  const priceResult = parseProductPrice(html);
  if (!priceResult.success) return priceResult;

  return ok({
    title: titleResult.data,
    price: priceResult.data,
  });
};

/**
 * Parse product data with detailed error aggregation
 */
export const parseProductDataWithErrors = (
  html: string
): Result<ParsedProductData, ParsingError[]> => {
  const titleResult = parseProductTitle(html);
  const priceResult = parseProductPrice(html);

  const errors: ParsingError[] = [];
  if (!titleResult.success) errors.push(titleResult.error);
  if (!priceResult.success) errors.push(priceResult.error);

  if (errors.length > 0) {
    return err(errors);
  }

  return ok({
    title: titleResult.data,
    price: priceResult.data,
  });
};

/**
 * Check if HTML contains Amazon product page indicators
 */
export const isAmazonProductPage = (html: string): boolean => {
  const loadResult = loadHtml(html);
  if (!loadResult.success) return false;

  const $ = loadResult.data;

  // Check for Amazon-specific elements
  const amazonIndicators = [
    "#productTitle",
    ".a-price",
    "#nav-logo",
    "[data-asin]",
    ".s-result-item",
  ];

  return amazonIndicators.some((selector) => $(selector).length > 0);
};

/**
 * Extract debug information for troubleshooting
 */
export const extractDebugInfo = (
  html: string
): Result<Record<string, string>, ParsingError> => {
  const loadResult = loadHtml(html);
  if (!loadResult.success) return loadResult;

  const $ = loadResult.data;

  const debugInfo: Record<string, string> = {
    pageTitle: $("title").text().trim(),
    hasProductTitle: ($(TITLE_SELECTORS[0]).length > 0).toString(),
    hasPriceElements: ($(PRICE_SELECTORS[0]).length > 0).toString(),
    titleElementsFound: TITLE_SELECTORS.map(
      (sel) => `${sel}: ${$(sel).length}`
    ).join(", "),
    priceElementsFound: PRICE_SELECTORS.map(
      (sel) => `${sel}: ${$(sel).length}`
    ).join(", "),
    bodyLength: html.length.toString(),
  };

  return ok(debugInfo);
};

/**
 * Functional helpers for testing and debugging
 */
export const getUsedTitleSelectors = (): readonly string[] => TITLE_SELECTORS;
export const getUsedPriceSelectors = (): readonly string[] => PRICE_SELECTORS;

/**
 * Format parsing error for display
 */
export const formatParsingError = (error: ParsingError): string => {
  switch (error.type) {
    case "HtmlParseError":
      return `HTML parsing failed: ${error.message}`;
    case "ElementNotFound":
      return `Element not found: ${error.message}. Tried selectors: ${error.selectors.join(", ")}`;
    case "InvalidContent":
      return `Invalid content in ${error.field}: ${error.message}`;
    case "ValidationError":
      return `Validation error: ${error.message}`;
    default:
      return `Unknown parsing error: ${JSON.stringify(error)}`;
  }
};
