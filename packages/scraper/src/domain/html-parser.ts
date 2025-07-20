import * as cheerio from "cheerio";
import type { ProductData } from "./value-objects";
import { createProductData } from "./value-objects";

type Result<T, E> = { success: true; data: T } | { success: false; error: E };

export interface ParseError extends Error {
  readonly type: "TITLE_NOT_FOUND" | "PRICE_NOT_FOUND";
}

const TITLE_SELECTORS = [
  "#productTitle",
  "span#productTitle",
  "h1.a-size-large",
  "h1 span",
  ".product-title",
] as const;

const PRICE_SELECTORS = [
  ".a-price-current .a-offscreen",
  ".a-price .a-offscreen",
  ".a-price-whole",
  ".a-offscreen",
  "span.a-price",
  ".kindle-price",
  ".a-color-price",
] as const;

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

const isValidPriceText = (text: string): boolean =>
  text.length > 0 &&
  (text.includes("￥") || text.includes("¥") || /\d/.test(text));

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

const createParseError = (
  type: ParseError["type"],
  message: string
): ParseError => {
  const error = new Error(message);
  return Object.assign(error, { type }) as ParseError;
};

const extractTitle = ($: cheerio.CheerioAPI): Result<string, ParseError> => {
  const title = findTextBySelectors($, TITLE_SELECTORS);
  if (!title) {
    return {
      success: false,
      error: createParseError(
        "TITLE_NOT_FOUND",
        "Could not find product title"
      ),
    };
  }
  return { success: true, data: title };
};

const extractPrice = ($: cheerio.CheerioAPI): Result<string, ParseError> => {
  const price = findPriceBySelectors($, PRICE_SELECTORS);
  if (!price) {
    return {
      success: false,
      error: createParseError(
        "PRICE_NOT_FOUND",
        "Could not find product price"
      ),
    };
  }
  return { success: true, data: price };
};

export const parseProductFromHtml = (
  html: string
): Result<ProductData, ParseError | string> => {
  const $ = cheerio.load(html);

  const titleResult = extractTitle($);
  if (!titleResult.success) return titleResult;

  const priceResult = extractPrice($);
  if (!priceResult.success) return priceResult;

  return createProductData(titleResult.data, priceResult.data);
};
