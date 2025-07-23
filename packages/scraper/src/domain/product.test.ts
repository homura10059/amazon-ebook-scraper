/**
 * Tests for Product domain model
 * Following TDD principles from docs/tdd.md
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  type Product,
  type RawProductData,
  createProduct,
  createProductFromRaw,
  formatProductForDisplay,
  getProductURL,
  isProductEqual,
  isProductFresh,
  isValidProduct,
  productToLegacyFormat,
  productToSerializable,
  updateProductTimestamp,
} from "./product";

describe("Product creation", () => {
  const validUrl = "https://www.amazon.co.jp/dp/B07ABCDEFG";
  const validTitle = "Test Product Title";
  const validPrice = "￥1,000";
  const testTimestamp = 1700000000;

  describe("successful creation", () => {
    it("should create Product with valid data", () => {
      const result = createProduct(
        validUrl,
        validTitle,
        validPrice,
        testTimestamp
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const product = result.data;
        expect(getProductURL(product)).toBe(validUrl);
        expect(product.timestamp).toBe(testTimestamp);
      }
    });

    it("should create Product with current timestamp when not provided", () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      const result = createProduct(validUrl, validTitle, validPrice);
      const afterTime = Math.floor(Date.now() / 1000);

      expect(result.success).toBe(true);
      if (result.success) {
        const product = result.data;
        expect(product.timestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(product.timestamp).toBeLessThanOrEqual(afterTime);
      }
    });

    it("should create Product from raw data", () => {
      const rawData: RawProductData = {
        url: validUrl,
        title: validTitle,
        price: validPrice,
      };

      const result = createProductFromRaw(rawData, testTimestamp);

      expect(result.success).toBe(true);
      if (result.success) {
        const product = result.data;
        expect(getProductURL(product)).toBe(validUrl);
        expect(product.timestamp).toBe(testTimestamp);
      }
    });
  });

  describe("failed creation", () => {
    it("should fail with invalid URL", () => {
      const result = createProduct("invalid-url", validTitle, validPrice);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ProductCreationFailed");
        expect(result.error.details).toHaveLength(1);
        expect(result.error.details[0].type).toBe("InvalidAmazonURL");
      }
    });

    it("should fail with invalid title", () => {
      const result = createProduct(validUrl, "", validPrice);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ProductCreationFailed");
        expect(result.error.details).toHaveLength(1);
        expect(result.error.details[0].type).toBe("InvalidProductTitle");
      }
    });

    it("should fail with invalid price", () => {
      const result = createProduct(validUrl, validTitle, "invalid-price");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ProductCreationFailed");
        expect(result.error.details).toHaveLength(1);
        expect(result.error.details[0].type).toBe("InvalidProductPrice");
      }
    });

    it("should aggregate multiple validation errors", () => {
      const result = createProduct("invalid-url", "", "invalid-price");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ProductCreationFailed");
        expect(result.error.details).toHaveLength(3);
        expect(result.error.message).toContain("3 validation error(s)");
      }
    });
  });
});

describe("Product operations", () => {
  let testProduct: Product;

  beforeEach(() => {
    const result = createProduct(
      "https://www.amazon.co.jp/dp/B07ABCDEFG",
      "Test Product Title",
      "￥1,000",
      1700000000
    );

    if (result.success) {
      testProduct = result.data;
    } else {
      throw new Error("Failed to create test product");
    }
  });

  describe("timestamp operations", () => {
    it("should update product timestamp", () => {
      const newTimestamp = 1700001000;
      const updatedProduct = updateProductTimestamp(testProduct, newTimestamp);

      expect(updatedProduct.timestamp).toBe(newTimestamp);
      expect(getProductURL(updatedProduct)).toBe(getProductURL(testProduct));
    });

    it("should check if product is fresh", () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const freshProduct = updateProductTimestamp(
        testProduct,
        currentTime - 30
      );
      const staleProduct = updateProductTimestamp(
        testProduct,
        currentTime - 3600
      );

      expect(isProductFresh(freshProduct, 60)).toBe(true);
      expect(isProductFresh(staleProduct, 60)).toBe(false);
    });
  });

  describe("serialization", () => {
    it("should convert to serializable format", () => {
      const serializable = productToSerializable(testProduct);

      expect(serializable).toEqual({
        url: "https://www.amazon.co.jp/dp/B07ABCDEFG",
        title: "Test Product Title",
        price: "￥1,000",
        timestamp: 1700000000,
      });
    });

    it("should convert to legacy format", () => {
      const legacy = productToLegacyFormat(testProduct);

      expect(legacy).toEqual({
        title: "Test Product Title",
        price: "￥1,000",
        timestamp: 1700000000,
      });
    });
  });

  describe("comparison", () => {
    it("should identify equal products", () => {
      const result = createProduct(
        "https://www.amazon.co.jp/dp/B07ABCDEFG",
        "Test Product Title",
        "￥1,000",
        1700001000 // Different timestamp
      );

      if (result.success) {
        expect(isProductEqual(testProduct, result.data)).toBe(true);
      }
    });

    it("should identify different products", () => {
      const result = createProduct(
        "https://www.amazon.co.jp/dp/B07DIFFERENT",
        "Test Product Title",
        "￥1,000",
        1700000000
      );

      if (result.success) {
        expect(isProductEqual(testProduct, result.data)).toBe(false);
      }
    });
  });

  describe("validation", () => {
    it("should validate valid product", () => {
      expect(isValidProduct(testProduct)).toBe(true);
    });

    it("should reject product with invalid timestamp", () => {
      const futureProduct = updateProductTimestamp(
        testProduct,
        Date.now() / 1000 + 3600
      );
      expect(isValidProduct(futureProduct)).toBe(false);
    });

    it("should reject product with zero timestamp", () => {
      const zeroProduct = updateProductTimestamp(testProduct, 0);
      expect(isValidProduct(zeroProduct)).toBe(false);
    });
  });

  describe("formatting", () => {
    it("should format product for display", () => {
      const formatted = formatProductForDisplay(testProduct);

      expect(formatted).toContain("Test Product Title");
      expect(formatted).toContain("￥1,000");
      expect(formatted).toContain("2023-11-14"); // ISO date for timestamp
    });
  });

  describe("URL extraction", () => {
    it("should extract URL from product", () => {
      const url = getProductURL(testProduct);
      expect(url).toBe("https://www.amazon.co.jp/dp/B07ABCDEFG");
    });
  });
});
