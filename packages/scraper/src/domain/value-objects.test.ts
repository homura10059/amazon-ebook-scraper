/**
 * Tests for domain value objects
 * Following TDD principles from docs/tdd.md
 */

import { describe, expect, it } from "vitest";
import {
  AmazonURL,
  ProductPrice,
  ProductTitle,
  createAmazonURL,
  createProductPrice,
  createProductTitle,
  getAmazonURLValue,
  getProductPriceValue,
  getProductTitleValue,
  isAmazonURL,
  isProductPrice,
  isProductTitle,
} from "./value-objects";

describe("AmazonURL value object", () => {
  describe("valid URLs", () => {
    it("should accept valid Amazon Japan product URL with dp", () => {
      const result = createAmazonURL("https://www.amazon.co.jp/dp/B07ABCDEFG");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(getAmazonURLValue(result.data)).toBe(
          "https://www.amazon.co.jp/dp/B07ABCDEFG"
        );
      }
    });

    it("should accept valid Amazon Japan product URL with gp/product", () => {
      const result = createAmazonURL(
        "https://www.amazon.co.jp/gp/product/B07ABCDEFG"
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(getAmazonURLValue(result.data)).toBe(
          "https://www.amazon.co.jp/gp/product/B07ABCDEFG"
        );
      }
    });

    it("should trim whitespace from valid URLs", () => {
      const result = createAmazonURL(
        "  https://www.amazon.co.jp/dp/B07ABCDEFG  "
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(getAmazonURLValue(result.data)).toBe(
          "https://www.amazon.co.jp/dp/B07ABCDEFG"
        );
      }
    });
  });

  describe("invalid URLs", () => {
    it("should reject empty URL", () => {
      const result = createAmazonURL("");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidAmazonURL");
        expect(result.error.message).toBe("URL cannot be empty");
      }
    });

    it("should reject whitespace-only URL", () => {
      const result = createAmazonURL("   ");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidAmazonURL");
        expect(result.error.message).toBe("URL cannot be empty");
      }
    });

    it("should reject non-HTTPS URLs", () => {
      const result = createAmazonURL("http://www.amazon.co.jp/dp/B07ABCDEFG");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidAmazonURL");
        expect(result.error.message).toBe("URL must use HTTPS protocol");
      }
    });

    it("should reject non-Amazon domains", () => {
      const result = createAmazonURL("https://www.google.com/search?q=test");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidAmazonURL");
        expect(result.error.message).toBe(
          "URL must be from amazon.co.jp domain"
        );
      }
    });

    it("should reject Amazon URLs without product identifier", () => {
      const result = createAmazonURL("https://www.amazon.co.jp/");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidAmazonURL");
        expect(result.error.message).toBe(
          "URL must be a valid Amazon product URL"
        );
      }
    });

    it("should reject malformed URLs", () => {
      const result = createAmazonURL("not-a-url");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidAmazonURL");
        expect(result.error.message).toBe("Invalid URL format");
      }
    });
  });

  describe("type guards", () => {
    it("should identify valid AmazonURL", () => {
      expect(isAmazonURL("https://www.amazon.co.jp/dp/B07ABCDEFG")).toBe(true);
    });

    it("should reject invalid AmazonURL", () => {
      expect(isAmazonURL("invalid-url")).toBe(false);
    });
  });
});

describe("ProductTitle value object", () => {
  describe("valid titles", () => {
    it("should accept normal product title", () => {
      const result = createProductTitle("Test Product Title");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(getProductTitleValue(result.data)).toBe("Test Product Title");
      }
    });

    it("should normalize whitespace in titles", () => {
      const result = createProductTitle("  Test   Product   Title  ");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(getProductTitleValue(result.data)).toBe("Test Product Title");
      }
    });

    it("should accept Japanese product titles", () => {
      const result = createProductTitle("テスト商品タイトル");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(getProductTitleValue(result.data)).toBe("テスト商品タイトル");
      }
    });

    it("should accept long but reasonable titles", () => {
      const longTitle = "A".repeat(100);
      const result = createProductTitle(longTitle);

      expect(result.success).toBe(true);
    });
  });

  describe("invalid titles", () => {
    it("should reject empty title", () => {
      const result = createProductTitle("");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidProductTitle");
        expect(result.error.message).toBe("Product title cannot be empty");
      }
    });

    it("should reject whitespace-only title", () => {
      const result = createProductTitle("   ");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidProductTitle");
        expect(result.error.message).toBe("Product title cannot be empty");
      }
    });

    it("should reject too short titles", () => {
      const result = createProductTitle("AB");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidProductTitle");
        expect(result.error.message).toBe(
          "Product title must be at least 3 characters long"
        );
      }
    });

    it("should reject extremely long titles", () => {
      const longTitle = "A".repeat(501);
      const result = createProductTitle(longTitle);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidProductTitle");
        expect(result.error.message).toBe(
          "Product title cannot exceed 500 characters"
        );
      }
    });

    it("should reject titles with script tags", () => {
      const result = createProductTitle(
        "Test <script>alert('xss')</script> Title"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidProductTitle");
        expect(result.error.message).toBe(
          "Product title contains potentially malicious content"
        );
      }
    });

    it("should reject titles with javascript: URLs", () => {
      const result = createProductTitle("Test javascript:alert('xss') Title");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidProductTitle");
        expect(result.error.message).toBe(
          "Product title contains potentially malicious content"
        );
      }
    });
  });

  describe("type guards", () => {
    it("should identify valid ProductTitle", () => {
      expect(isProductTitle("Valid Product Title")).toBe(true);
    });

    it("should reject invalid ProductTitle", () => {
      expect(isProductTitle("")).toBe(false);
    });
  });
});

describe("ProductPrice value object", () => {
  describe("valid prices", () => {
    it("should accept price with full-width yen symbol", () => {
      const result = createProductPrice("￥1,000");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(getProductPriceValue(result.data)).toBe("￥1,000");
      }
    });

    it("should accept price with half-width yen symbol", () => {
      const result = createProductPrice("¥500");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(getProductPriceValue(result.data)).toBe("¥500");
      }
    });

    it("should accept price with digits only", () => {
      const result = createProductPrice("1000");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(getProductPriceValue(result.data)).toBe("1000");
      }
    });

    it("should accept price with 円 suffix", () => {
      const result = createProductPrice("1,000円");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(getProductPriceValue(result.data)).toBe("1,000円");
      }
    });

    it("should trim whitespace from prices", () => {
      const result = createProductPrice("  ￥1,000  ");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(getProductPriceValue(result.data)).toBe("￥1,000");
      }
    });
  });

  describe("invalid prices", () => {
    it("should reject empty price", () => {
      const result = createProductPrice("");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidProductPrice");
        expect(result.error.message).toBe("Product price cannot be empty");
      }
    });

    it("should reject whitespace-only price", () => {
      const result = createProductPrice("   ");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidProductPrice");
        expect(result.error.message).toBe("Product price cannot be empty");
      }
    });

    it("should reject price without yen symbol or digits", () => {
      const result = createProductPrice("free");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidProductPrice");
        expect(result.error.message).toBe(
          "Product price must contain yen symbol or digits"
        );
      }
    });

    it("should reject price with invalid format", () => {
      const result = createProductPrice("abc￥def");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidProductPrice");
        expect(result.error.message).toBe("Product price format is invalid");
      }
    });

    it("should reject extremely long prices", () => {
      const longPrice = "￥" + "1".repeat(50);
      const result = createProductPrice(longPrice);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("InvalidProductPrice");
        expect(result.error.message).toBe(
          "Product price cannot exceed 50 characters"
        );
      }
    });
  });

  describe("type guards", () => {
    it("should identify valid ProductPrice", () => {
      expect(isProductPrice("￥1,000")).toBe(true);
    });

    it("should reject invalid ProductPrice", () => {
      expect(isProductPrice("invalid")).toBe(false);
    });
  });
});
