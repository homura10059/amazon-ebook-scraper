/**
 * Domain value objects with branded types
 * Following Domain Modeling Made Functional principles
 */

import { type Result, err, ok } from "./result";

/**
 * Branded type for Amazon URLs to prevent mixing with regular strings
 */
export type AmazonURL = string & { readonly _brand: "AmazonURL" };

/**
 * Branded type for Product Titles to ensure domain-specific constraints
 */
export type ProductTitle = string & { readonly _brand: "ProductTitle" };

/**
 * Branded type for Product Prices to enforce price validation
 */
export type ProductPrice = string & { readonly _brand: "ProductPrice" };

/**
 * Domain errors for value object validation
 */
export type ValidationError =
  | { type: "InvalidAmazonURL"; message: string; url: string }
  | { type: "InvalidProductTitle"; message: string; title: string }
  | { type: "InvalidProductPrice"; message: string; price: string };

/**
 * Create validated AmazonURL value object
 */
export const createAmazonURL = (
  input: string
): Result<AmazonURL, ValidationError> => {
  // Trim whitespace
  const trimmed = input.trim();

  // Check if empty
  if (!trimmed) {
    return err({
      type: "InvalidAmazonURL" as const,
      message: "URL cannot be empty",
      url: input,
    });
  }

  // Check if it's a valid URL format
  try {
    const url = new URL(trimmed);

    // Must be HTTPS
    if (url.protocol !== "https:") {
      return err({
        type: "InvalidAmazonURL" as const,
        message: "URL must use HTTPS protocol",
        url: input,
      });
    }

    // Must be Amazon Japan domain
    if (!url.hostname.includes("amazon.co.jp")) {
      return err({
        type: "InvalidAmazonURL" as const,
        message: "URL must be from amazon.co.jp domain",
        url: input,
      });
    }

    // Must contain product identifier (dp/ or gp/product/)
    if (
      !url.pathname.includes("/dp/") &&
      !url.pathname.includes("/gp/product/")
    ) {
      return err({
        type: "InvalidAmazonURL" as const,
        message: "URL must be a valid Amazon product URL",
        url: input,
      });
    }

    return ok(trimmed as AmazonURL);
  } catch {
    return err({
      type: "InvalidAmazonURL" as const,
      message: "Invalid URL format",
      url: input,
    });
  }
};

/**
 * Create validated ProductTitle value object
 */
export const createProductTitle = (
  input: string
): Result<ProductTitle, ValidationError> => {
  // Normalize whitespace
  const normalized = input.replace(/\s+/g, " ").trim();

  // Check if empty
  if (!normalized) {
    return err({
      type: "InvalidProductTitle" as const,
      message: "Product title cannot be empty",
      title: input,
    });
  }

  // Check minimum length (reasonable for product titles)
  if (normalized.length < 3) {
    return err({
      type: "InvalidProductTitle" as const,
      message: "Product title must be at least 3 characters long",
      title: input,
    });
  }

  // Check maximum length (prevent extremely long titles)
  if (normalized.length > 500) {
    return err({
      type: "InvalidProductTitle" as const,
      message: "Product title cannot exceed 500 characters",
      title: input,
    });
  }

  // Check for potentially malicious content (basic XSS prevention)
  if (/<script|javascript:|data:|vbscript:/i.test(normalized)) {
    return err({
      type: "InvalidProductTitle" as const,
      message: "Product title contains potentially malicious content",
      title: input,
    });
  }

  return ok(normalized as ProductTitle);
};

/**
 * Create validated ProductPrice value object
 */
export const createProductPrice = (
  input: string
): Result<ProductPrice, ValidationError> => {
  // Trim whitespace
  const trimmed = input.trim();

  // Check if empty
  if (!trimmed) {
    return err({
      type: "InvalidProductPrice" as const,
      message: "Product price cannot be empty",
      price: input,
    });
  }

  // Check if contains valid price indicators (Japanese yen symbols or digits)
  const hasYenSymbol = trimmed.includes("￥") || trimmed.includes("¥");
  const hasDigits = /\d/.test(trimmed);

  if (!hasYenSymbol && !hasDigits) {
    return err({
      type: "InvalidProductPrice" as const,
      message: "Product price must contain yen symbol or digits",
      price: input,
    });
  }

  // Check for reasonable price format
  // Allow various formats: ￥1,000, ¥500, 1000円, etc.
  const pricePattern = /[￥¥]?\d{1,3}(,\d{3})*([￥¥]|円)?/;
  if (!pricePattern.test(trimmed)) {
    return err({
      type: "InvalidProductPrice" as const,
      message: "Product price format is invalid",
      price: input,
    });
  }

  // Check maximum length to prevent abuse
  if (trimmed.length > 50) {
    return err({
      type: "InvalidProductPrice" as const,
      message: "Product price cannot exceed 50 characters",
      price: input,
    });
  }

  return ok(trimmed as ProductPrice);
};

/**
 * Extract raw string value from branded types (for serialization/display)
 */
export const getAmazonURLValue = (url: AmazonURL): string => url;
export const getProductTitleValue = (title: ProductTitle): string => title;
export const getProductPriceValue = (price: ProductPrice): string => price;

/**
 * Type guards for branded types
 */
export const isAmazonURL = (value: unknown): value is AmazonURL =>
  typeof value === "string" && createAmazonURL(value).success;

export const isProductTitle = (value: unknown): value is ProductTitle =>
  typeof value === "string" && createProductTitle(value).success;

export const isProductPrice = (value: unknown): value is ProductPrice =>
  typeof value === "string" && createProductPrice(value).success;
