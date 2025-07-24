/**
 * Tests for ScraperService orchestration
 * Following TDD principles from docs/tdd.md
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ScraperError,
  ScraperService,
  type ScraperServiceConfig,
  createScraperService,
  formatScraperError,
  isScraperErrorRetryable,
  scrapeWithPipeline,
} from "./scraper-service";

// Mock the HTTP client module
const mockHttpClient = {
  get: vi.fn(),
  getConfig: vi.fn(() => ({
    timeout: 10000,
    userAgent: "Test Agent",
    maxRetries: 3,
    retryDelay: 1000,
  })),
  withConfig: vi.fn(),
};

vi.mock("./http-client", () => ({
  createHttpClient: vi.fn(() => mockHttpClient),
}));

describe("ScraperService creation", () => {
  it("should create service with default configuration", () => {
    const service = createScraperService();
    const config = service.getConfig();

    expect(config.timeout).toBe(10000);
    expect(config.maxRetries).toBe(3);
  });

  it("should create service with custom configuration", () => {
    const customConfig: ScraperServiceConfig = {
      httpConfig: {
        timeout: 5000,
        maxRetries: 5,
      },
    };

    const service = createScraperService(customConfig);

    expect(service).toBeInstanceOf(ScraperService);
  });

  it("should create new service with updated configuration", () => {
    const service = createScraperService();
    const newService = service.withConfig({
      httpConfig: { timeout: 8000 },
    });

    expect(newService).toBeInstanceOf(ScraperService);
    expect(newService).not.toBe(service);
  });
});

describe("ScraperService URL validation", () => {
  let service: ScraperService;

  beforeEach(() => {
    service = createScraperService();
  });

  it("should reject invalid URLs", async () => {
    const result = await service.scrapeProduct("invalid-url");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("UrlValidationError");
      expect(result.error.message).toContain("Invalid Amazon URL");
    }
  });

  it("should accept valid Amazon URLs", async () => {
    // Mock successful HTTP response
    mockHttpClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        body: `
          <html>
            <body>
              <span id="productTitle">Test Product</span>
              <span class="a-price-current">
                <span class="a-offscreen">￥1,000</span>
              </span>
            </body>
          </html>
        `,
        statusCode: 200,
        url: "https://www.amazon.co.jp/dp/B07ABCDEFG",
      },
    });

    const result = await service.scrapeProduct(
      "https://www.amazon.co.jp/dp/B07ABCDEFG"
    );

    // Should not fail on URL validation
    if (!result.success && result.error.type === "UrlValidationError") {
      expect.fail("Valid URL should not fail validation");
    }
  });
});

describe("ScraperService HTTP handling", () => {
  let service: ScraperService;

  beforeEach(() => {
    service = createScraperService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle HTTP errors", async () => {
    mockHttpClient.get.mockResolvedValueOnce({
      success: false,
      error: {
        type: "NetworkError",
        message: "Connection failed",
      },
    });

    const result = await service.scrapeProduct(
      "https://www.amazon.co.jp/dp/B07ABCDEFG"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("HttpError");
      expect(result.error.message).toContain("Failed to fetch page");
    }
  });

  it("should handle successful HTTP responses with parsing", async () => {
    mockHttpClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        body: `
          <html>
            <body>
              <span id="productTitle">Test Product Title</span>
              <span class="a-price-current">
                <span class="a-offscreen">￥1,500</span>
              </span>
            </body>
          </html>
        `,
        statusCode: 200,
        url: "https://www.amazon.co.jp/dp/B07ABCDEFG",
      },
    });

    const result = await service.scrapeProduct(
      "https://www.amazon.co.jp/dp/B07ABCDEFG"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(String(result.data.title)).toBe("Test Product Title");
      expect(String(result.data.price)).toBe("￥1,500");
      expect(result.data.url).toBe("https://www.amazon.co.jp/dp/B07ABCDEFG");
    }
  });
});

describe("ScraperService parsing handling", () => {
  let service: ScraperService;

  beforeEach(() => {
    service = createScraperService();
  });

  it("should handle parsing errors", async () => {
    mockHttpClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        body: `
          <html>
            <body>
              <div>No product data here</div>
            </body>
          </html>
        `,
        statusCode: 200,
        url: "https://www.amazon.co.jp/dp/B07ABCDEFG",
      },
    });

    const result = await service.scrapeProduct(
      "https://www.amazon.co.jp/dp/B07ABCDEFG"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("ParsingError");
      expect(result.error.message).toContain("Failed to parse product data");
    }
  });
});

describe("ScraperService batch operations", () => {
  let service: ScraperService;

  beforeEach(() => {
    service = createScraperService();
  });

  it("should scrape multiple URLs", async () => {
    // Mock responses for multiple URLs
    mockHttpClient.get
      .mockResolvedValueOnce({
        success: true,
        data: {
          body: `<html><body><span id="productTitle">Product 1</span><span class="a-price-current"><span class="a-offscreen">￥1,000</span></span></body></html>`,
          statusCode: 200,
          url: "https://www.amazon.co.jp/dp/B07ABCDEFG",
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          body: `<html><body><span id="productTitle">Product 2</span><span class="a-price-current"><span class="a-offscreen">￥2,000</span></span></body></html>`,
          statusCode: 200,
          url: "https://www.amazon.co.jp/dp/B07HIJKLMN",
        },
      });

    const urls = [
      "https://www.amazon.co.jp/dp/B07ABCDEFG",
      "https://www.amazon.co.jp/dp/B07HIJKLMN",
    ];

    const results = await service.scrapeMultipleProducts(urls);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });

  it("should handle mixed success/failure in batch", async () => {
    mockHttpClient.get
      .mockResolvedValueOnce({
        success: true,
        data: {
          body: `<html><body><span id="productTitle">Product 1</span><span class="a-price-current"><span class="a-offscreen">￥1,000</span></span></body></html>`,
          statusCode: 200,
          url: "https://www.amazon.co.jp/dp/B07ABCDEFG",
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: {
          type: "NetworkError",
          message: "Connection failed",
        },
      });

    const urls = [
      "https://www.amazon.co.jp/dp/B07ABCDEFG",
      "https://www.amazon.co.jp/dp/B07HIJKLMN",
    ];

    const results = await service.scrapeMultipleProducts(urls);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });
});

describe("ScraperService URL testing", () => {
  let service: ScraperService;

  beforeEach(() => {
    service = createScraperService();
  });

  it("should test URL accessibility", async () => {
    mockHttpClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        body: "<html>Any content</html>",
        statusCode: 200,
        url: "https://www.amazon.co.jp/dp/B07ABCDEFG",
      },
    });

    const result = await service.testUrl(
      "https://www.amazon.co.jp/dp/B07ABCDEFG"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(true);
    }
  });

  it("should handle URL test failures", async () => {
    mockHttpClient.get.mockResolvedValueOnce({
      success: false,
      error: {
        type: "NetworkError",
        message: "Connection failed",
      },
    });

    const result = await service.testUrl(
      "https://www.amazon.co.jp/dp/B07ABCDEFG"
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe("HttpError");
    }
  });
});

describe("Pipeline function", () => {
  it("should use pipeline function", async () => {
    mockHttpClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        body: `<html><body><span id="productTitle">Pipeline Product</span><span class="a-price-current"><span class="a-offscreen">￥3,000</span></span></body></html>`,
        statusCode: 200,
        url: "https://www.amazon.co.jp/dp/B07PIPELINE",
      },
    });

    const result = await scrapeWithPipeline(
      "https://www.amazon.co.jp/dp/B07PIPELINE"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(String(result.data.title)).toBe("Pipeline Product");
    }
  });
});

describe("Error utility functions", () => {
  describe("formatScraperError", () => {
    it("should format URL validation error", () => {
      const error: ScraperError = {
        type: "UrlValidationError",
        message: "Invalid URL format",
        url: "invalid-url",
      };

      const formatted = formatScraperError(error);
      expect(formatted).toBe("URL validation failed: Invalid URL format");
    });

    it("should format HTTP error", () => {
      const error: ScraperError = {
        type: "HttpError",
        message: "Network failure",
        httpError: {
          type: "NetworkError",
          message: "Connection failed",
        },
      };

      const formatted = formatScraperError(error);
      expect(formatted).toBe("HTTP request failed: Network failure");
    });

    it("should format parsing error", () => {
      const error: ScraperError = {
        type: "ParsingError",
        message: "Element not found",
        parsingError: {
          type: "ElementNotFound",
          message: "Could not find title",
          selectors: ["#title"],
        },
      };

      const formatted = formatScraperError(error);
      expect(formatted).toBe("HTML parsing failed: Element not found");
    });
  });

  describe("isScraperErrorRetryable", () => {
    it("should identify retryable HTTP errors", () => {
      const error: ScraperError = {
        type: "HttpError",
        message: "Network failure",
        httpError: {
          type: "NetworkError",
          message: "Connection failed",
        },
      };

      expect(isScraperErrorRetryable(error)).toBe(true);
    });

    it("should not retry parsing errors", () => {
      const error: ScraperError = {
        type: "ParsingError",
        message: "Element not found",
        parsingError: {
          type: "ElementNotFound",
          message: "Could not find title",
          selectors: ["#title"],
        },
      };

      expect(isScraperErrorRetryable(error)).toBe(false);
    });

    it("should not retry URL validation errors", () => {
      const error: ScraperError = {
        type: "UrlValidationError",
        message: "Invalid URL format",
        url: "invalid-url",
      };

      expect(isScraperErrorRetryable(error)).toBe(false);
    });
  });
});
