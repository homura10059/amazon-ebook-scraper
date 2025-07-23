/**
 * Tests for HTML parser functionality
 * Following TDD principles from docs/tdd.md
 */

import { describe, expect, it } from "vitest";
import {
  type ParsingError,
  extractDebugInfo,
  formatParsingError,
  getUsedPriceSelectors,
  getUsedTitleSelectors,
  isAmazonProductPage,
  parseProductData,
  parseProductDataWithErrors,
  parseProductPrice,
  parseProductTitle,
} from "./html-parser";

describe("HTML parsing - product title", () => {
  describe("successful title parsing", () => {
    it("should parse title from #productTitle", () => {
      const html = `
        <html>
          <body>
            <span id="productTitle">Test Product Title</span>
          </body>
        </html>
      `;

      const result = parseProductTitle(html);

      expect(result.success).toBe(true);
      if (result.success) {
        // Access the internal string value for testing
        expect(String(result.data)).toBe("Test Product Title");
      }
    });

    it("should parse title from h1.a-size-large", () => {
      const html = `
        <html>
          <body>
            <h1 class="a-size-large">Amazon Book Title</h1>
          </body>
        </html>
      `;

      const result = parseProductTitle(html);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(String(result.data)).toBe("Amazon Book Title");
      }
    });

    it("should normalize whitespace in titles", () => {
      const html = `
        <html>
          <body>
            <span id="productTitle">  Test   Product   Title  </span>
          </body>
        </html>
      `;

      const result = parseProductTitle(html);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(String(result.data)).toBe("Test Product Title");
      }
    });

    it("should parse Japanese product titles", () => {
      const html = `
        <html>
          <body>
            <span id="productTitle">テスト商品タイトル</span>
          </body>
        </html>
      `;

      const result = parseProductTitle(html);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(String(result.data)).toBe("テスト商品タイトル");
      }
    });
  });

  describe("failed title parsing", () => {
    it("should fail when no title element found", () => {
      const html = `
        <html>
          <body>
            <div>No title here</div>
          </body>
        </html>
      `;

      const result = parseProductTitle(html);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ElementNotFound");
        expect(result.error.message).toContain("Could not find product title");
      }
    });

    it("should fail when title element is empty", () => {
      const html = `
        <html>
          <body>
            <span id="productTitle">   </span>
          </body>
        </html>
      `;

      const result = parseProductTitle(html);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ElementNotFound");
      }
    });

    it("should fail with malformed HTML", () => {
      const html = "<invalid-html>";

      const result = parseProductTitle(html);

      // Should still work with cheerio's tolerance for malformed HTML
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ElementNotFound");
      }
    });
  });
});

describe("HTML parsing - product price", () => {
  describe("successful price parsing", () => {
    it("should parse price from .a-price-current .a-offscreen", () => {
      const html = `
        <html>
          <body>
            <span class="a-price-current">
              <span class="a-offscreen">￥1,000</span>
            </span>
          </body>
        </html>
      `;

      const result = parseProductPrice(html);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(String(result.data)).toBe("￥1,000");
      }
    });

    it("should parse price with half-width yen symbol", () => {
      const html = `
        <html>
          <body>
            <span class="a-price">
              <span class="a-offscreen">¥500</span>
            </span>
          </body>
        </html>
      `;

      const result = parseProductPrice(html);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(String(result.data)).toBe("¥500");
      }
    });

    it("should parse price with digits only", () => {
      const html = `
        <html>
          <body>
            <span class="kindle-price">1,000</span>
          </body>
        </html>
      `;

      const result = parseProductPrice(html);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(String(result.data)).toBe("1,000");
      }
    });

    it("should parse price with 円 suffix", () => {
      const html = `
        <html>
          <body>
            <span class="a-color-price">1,000円</span>
          </body>
        </html>
      `;

      const result = parseProductPrice(html);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(String(result.data)).toBe("1,000円");
      }
    });
  });

  describe("failed price parsing", () => {
    it("should fail when no price element found", () => {
      const html = `
        <html>
          <body>
            <div>No price here</div>
          </body>
        </html>
      `;

      const result = parseProductPrice(html);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ElementNotFound");
        expect(result.error.message).toContain("Could not find product price");
      }
    });

    it("should fail when price element has invalid content", () => {
      const html = `
        <html>
          <body>
            <span class="a-price">
              <span class="a-offscreen">free</span>
            </span>
          </body>
        </html>
      `;

      const result = parseProductPrice(html);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ElementNotFound");
      }
    });
  });
});

describe("HTML parsing - complete product data", () => {
  const validHtml = `
    <html>
      <body>
        <span id="productTitle">Test Product Title</span>
        <span class="a-price-current">
          <span class="a-offscreen">￥1,000</span>
        </span>
      </body>
    </html>
  `;

  describe("successful complete parsing", () => {
    it("should parse complete product data", () => {
      const result = parseProductData(validHtml);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(String(result.data.title)).toBe("Test Product Title");
        expect(String(result.data.price)).toBe("￥1,000");
      }
    });
  });

  describe("failed complete parsing", () => {
    it("should fail when title is missing", () => {
      const html = `
        <html>
          <body>
            <span class="a-price-current">
              <span class="a-offscreen">￥1,000</span>
            </span>
          </body>
        </html>
      `;

      const result = parseProductData(html);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ElementNotFound");
      }
    });

    it("should fail when price is missing", () => {
      const html = `
        <html>
          <body>
            <span id="productTitle">Test Product Title</span>
          </body>
        </html>
      `;

      const result = parseProductData(html);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ElementNotFound");
      }
    });
  });

  describe("parsing with error aggregation", () => {
    it("should aggregate multiple parsing errors", () => {
      const html = `
        <html>
          <body>
            <div>No product data here</div>
          </body>
        </html>
      `;

      const result = parseProductDataWithErrors(html);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toHaveLength(2); // Title and price errors
        expect(result.error[0].type).toBe("ElementNotFound");
        expect(result.error[1].type).toBe("ElementNotFound");
      }
    });

    it("should succeed when both elements are found", () => {
      const result = parseProductDataWithErrors(validHtml);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(String(result.data.title)).toBe("Test Product Title");
        expect(String(result.data.price)).toBe("￥1,000");
      }
    });
  });
});

describe("HTML validation and utilities", () => {
  describe("Amazon page detection", () => {
    it("should detect Amazon product page", () => {
      const html = `
        <html>
          <body>
            <span id="productTitle">Product</span>
            <div class="a-price">Price</div>
            <div id="nav-logo">Amazon</div>
          </body>
        </html>
      `;

      expect(isAmazonProductPage(html)).toBe(true);
    });

    it("should not detect non-Amazon page", () => {
      const html = `
        <html>
          <body>
            <h1>Some other website</h1>
            <p>No Amazon elements here</p>
          </body>
        </html>
      `;

      expect(isAmazonProductPage(html)).toBe(false);
    });

    it("should handle malformed HTML", () => {
      const html = "<invalid>";

      expect(isAmazonProductPage(html)).toBe(false);
    });
  });

  describe("debug information extraction", () => {
    it("should extract debug information", () => {
      const html = `
        <html>
          <head><title>Amazon Product Page</title></head>
          <body>
            <span id="productTitle">Product</span>
            <div class="a-price">Price</div>
          </body>
        </html>
      `;

      const result = extractDebugInfo(html);

      expect(result.success).toBe(true);
      if (result.success) {
        const debug = result.data;
        expect(debug.pageTitle).toBe("Amazon Product Page");
        expect(debug.hasProductTitle).toBe("true");
        expect(debug.bodyLength).toBe(String(html.length));
      }
    });
  });

  describe("selector information", () => {
    it("should return title selectors", () => {
      const selectors = getUsedTitleSelectors();

      expect(selectors).toContain("#productTitle");
      expect(selectors).toContain("span#productTitle");
      expect(selectors.length).toBeGreaterThan(0);
    });

    it("should return price selectors", () => {
      const selectors = getUsedPriceSelectors();

      expect(selectors).toContain(".a-price-current .a-offscreen");
      expect(selectors).toContain(".a-price .a-offscreen");
      expect(selectors.length).toBeGreaterThan(0);
    });
  });
});

describe("Error formatting", () => {
  it("should format HTML parse error", () => {
    const error: ParsingError = {
      type: "HtmlParseError",
      message: "Invalid HTML structure",
    };

    const formatted = formatParsingError(error);
    expect(formatted).toBe("HTML parsing failed: Invalid HTML structure");
  });

  it("should format element not found error", () => {
    const error: ParsingError = {
      type: "ElementNotFound",
      message: "Could not find title",
      selectors: ["#productTitle", "h1"],
    };

    const formatted = formatParsingError(error);
    expect(formatted).toContain("Element not found: Could not find title");
    expect(formatted).toContain("#productTitle, h1");
  });

  it("should format invalid content error", () => {
    const error: ParsingError = {
      type: "InvalidContent",
      message: "Invalid price format",
      content: "free",
      field: "price",
    };

    const formatted = formatParsingError(error);
    expect(formatted).toBe("Invalid content in price: Invalid price format");
  });

  it("should format validation error", () => {
    const error: ParsingError = {
      type: "ValidationError",
      message: "Title validation failed",
    };

    const formatted = formatParsingError(error);
    expect(formatted).toBe("Validation error: Title validation failed");
  });
});
