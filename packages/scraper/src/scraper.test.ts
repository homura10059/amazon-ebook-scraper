import got from "got";
import {
  type MockedFunction,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { scrapeAmazonProduct } from "./scraper";
import type { ScrapedProduct, ScraperError, ScraperOptions } from "./types";

// Type for mocked Got response
interface MockGotResponse {
  body: string;
}

// Type for mocked Got error with response
interface MockGotError extends Error {
  response: {
    statusCode: number;
  };
}

// Mock the got library
vi.mock("got");
const mockedGot = got as MockedFunction<typeof got>;

describe("scrapeAmazonProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("URL validation", () => {
    it("should throw error for non-Amazon.co.jp URLs", async () => {
      const invalidUrls = [
        "https://amazon.com/product",
        "https://amazon.co.uk/product",
        "https://example.com",
        "https://amazon.fr/product",
      ];

      for (const url of invalidUrls) {
        await expect(scrapeAmazonProduct(url)).rejects.toThrow(
          "URL must be from amazon.co.jp domain"
        );
      }
    });

    it("should accept valid Amazon.co.jp URLs", async () => {
      const validUrls = [
        "https://amazon.co.jp/product",
        "https://www.amazon.co.jp/ebook/dp/123456",
        "http://amazon.co.jp/kindle-store",
      ];

      // Mock successful response for validation test
      mockedGot.mockResolvedValue({
        body: '<span id="productTitle">Test Book</span><span class="a-price-current"><span class="a-offscreen">￥1,000</span></span>',
      } as MockGotResponse);

      for (const url of validUrls) {
        const result = await scrapeAmazonProduct(url);
        expect(result).toBeDefined();
        expect(result.title).toBe("Test Book");
      }
    });
  });

  describe("successful scraping", () => {
    it("should extract title and price correctly", async () => {
      const mockHtml = `
        <html>
          <head><title>Amazon Product</title></head>
          <body>
            <span id="productTitle">プログラミング入門 - Kindle版</span>
            <span class="a-price-current">
              <span class="a-offscreen">￥1,200</span>
            </span>
          </body>
        </html>
      `;

      mockedGot.mockResolvedValue({ body: mockHtml } as MockGotResponse);

      const result = await scrapeAmazonProduct(
        "https://amazon.co.jp/product/123"
      );

      expect(result).toEqual({
        title: "プログラミング入門 - Kindle版",
        price: "￥1,200",
        timestamp: expect.any(Number),
      });
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it("should try multiple title selectors", async () => {
      const mockHtml = `
        <html>
          <body>
            <h1 class="a-size-large">Alternative Title Selector</h1>
            <span class="a-price-current">
              <span class="a-offscreen">￥800</span>
            </span>
          </body>
        </html>
      `;

      mockedGot.mockResolvedValue({ body: mockHtml } as MockGotResponse);

      const result = await scrapeAmazonProduct(
        "https://amazon.co.jp/product/123"
      );

      expect(result.title).toBe("Alternative Title Selector");
    });

    it("should try multiple price selectors", async () => {
      const mockHtml = `
        <html>
          <body>
            <span id="productTitle">Test Book</span>
            <span class="kindle-price">¥950</span>
          </body>
        </html>
      `;

      mockedGot.mockResolvedValue({ body: mockHtml } as MockGotResponse);

      const result = await scrapeAmazonProduct(
        "https://amazon.co.jp/product/123"
      );

      expect(result.price).toBe("¥950");
    });

    it("should clean up title whitespace", async () => {
      const mockHtml = `
        <html>
          <body>
            <span id="productTitle">   Title    with    extra   spaces   </span>
            <span class="a-price-current">
              <span class="a-offscreen">￥1,000</span>
            </span>
          </body>
        </html>
      `;

      mockedGot.mockResolvedValue({ body: mockHtml } as MockGotResponse);

      const result = await scrapeAmazonProduct(
        "https://amazon.co.jp/product/123"
      );

      expect(result.title).toBe("Title with extra spaces");
    });
  });

  describe("error scenarios", () => {
    it("should throw error when title is not found", async () => {
      const mockHtml = `
        <html>
          <body>
            <span class="a-price-current">
              <span class="a-offscreen">￥1,000</span>
            </span>
          </body>
        </html>
      `;

      mockedGot.mockResolvedValue({ body: mockHtml } as MockGotResponse);

      await expect(
        scrapeAmazonProduct("https://amazon.co.jp/product/123")
      ).rejects.toThrow("Could not find product title");
    });

    it("should throw error when price is not found", async () => {
      const mockHtml = `
        <html>
          <body>
            <span id="productTitle">Test Book</span>
          </body>
        </html>
      `;

      mockedGot.mockResolvedValue({ body: mockHtml } as MockGotResponse);

      await expect(
        scrapeAmazonProduct("https://amazon.co.jp/product/123")
      ).rejects.toThrow("Could not find product price");
    });
  });

  describe("retry mechanism", () => {
    it("should retry on failure and succeed on second attempt", async () => {
      const successHtml = `
        <html>
          <body>
            <span id="productTitle">Success Book</span>
            <span class="a-price-current">
              <span class="a-offscreen">￥1,500</span>
            </span>
          </body>
        </html>
      `;

      mockedGot
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ body: successHtml } as MockGotResponse);

      const result = await scrapeAmazonProduct(
        "https://amazon.co.jp/product/123"
      );

      expect(result.title).toBe("Success Book");
      expect(mockedGot).toHaveBeenCalledTimes(2);
    });

    it("should respect custom retry count", async () => {
      mockedGot.mockRejectedValue(new Error("Network error"));

      const options: ScraperOptions = { retries: 1 };

      await expect(
        scrapeAmazonProduct("https://amazon.co.jp/product/123", options)
      ).rejects.toThrow("Failed to scrape product after 1 attempts");

      expect(mockedGot).toHaveBeenCalledTimes(1);
    });
  });

  describe("custom options", () => {
    it("should use custom timeout", async () => {
      const mockHtml = `
        <html>
          <body>
            <span id="productTitle">Test Book</span>
            <span class="a-price-current">
              <span class="a-offscreen">￥1,000</span>
            </span>
          </body>
        </html>
      `;

      mockedGot.mockResolvedValue({ body: mockHtml } as MockGotResponse);

      const options: ScraperOptions = { timeout: 5000 };
      await scrapeAmazonProduct("https://amazon.co.jp/product/123", options);

      expect(mockedGot).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeout: { response: 5000 },
        })
      );
    });

    it("should use custom user agent", async () => {
      const mockHtml = `
        <html>
          <body>
            <span id="productTitle">Test Book</span>
            <span class="a-price-current">
              <span class="a-offscreen">￥1,000</span>
            </span>
          </body>
        </html>
      `;

      mockedGot.mockResolvedValue({ body: mockHtml } as MockGotResponse);

      const options: ScraperOptions = { userAgent: "Custom Bot 1.0" };
      await scrapeAmazonProduct("https://amazon.co.jp/product/123", options);

      expect(mockedGot).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "Custom Bot 1.0",
          }),
        })
      );
    });
  });

  describe("error details", () => {
    it("should include URL in error when scraping fails", async () => {
      mockedGot.mockRejectedValue(new Error("Network error"));

      const url = "https://amazon.co.jp/product/123";
      const options: ScraperOptions = { retries: 1 };

      try {
        await scrapeAmazonProduct(url, options);
        expect.fail("Should have thrown an error");
      } catch (error: unknown) {
        expect((error as ScraperError).url).toBe(url);
        expect((error as ScraperError).message).toContain(
          "Failed to scrape product after 1 attempts"
        );
        expect((error as ScraperError).message).toContain("Network error");
      }
    });

    it("should include status code in error when available", async () => {
      const httpError: MockGotError = Object.assign(new Error("HTTP Error"), {
        response: { statusCode: 404 },
      });
      mockedGot.mockRejectedValue(httpError);

      const options: ScraperOptions = { retries: 1 };

      try {
        await scrapeAmazonProduct("https://amazon.co.jp/product/123", options);
        expect.fail("Should have thrown an error");
      } catch (error: unknown) {
        expect((error as ScraperError).status).toBe(404);
      }
    });
  });

  describe("real-world HTML scenarios", () => {
    it("should handle complex Amazon product page structure", async () => {
      const complexHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Amazon.co.jp</title></head>
          <body>
            <div class="centerCol">
              <div id="title_feature_div">
                <h1 id="title" class="a-size-large">
                  <span id="productTitle" class="a-size-large">
                    JavaScript完全ガイド 第7版 - モダンWebアプリケーション開発入門
                  </span>
                </h1>
              </div>
              <div class="a-section">
                <div class="a-box-group">
                  <span class="a-price a-text-price a-size-medium a-color-base">
                    <span class="a-currency-symbol">￥</span>
                    <span class="a-price-whole">3,960</span>
                  </span>
                  <span class="a-price-current">
                    <span class="a-offscreen">￥3,960</span>
                  </span>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      mockedGot.mockResolvedValue({ body: complexHtml } as MockGotResponse);

      const result = await scrapeAmazonProduct(
        "https://amazon.co.jp/product/123"
      );

      expect(result).toEqual({
        title: "JavaScript完全ガイド 第7版 - モダンWebアプリケーション開発入門",
        price: "￥3,960",
        timestamp: expect.any(Number),
      });
    });
  });
});
