/**
 * Tests for HTTP client with error handling and retry logic
 * Following TDD principles from docs/tdd.md
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type HttpClient,
  type HttpClientConfig,
  type HttpError,
  createHttpClient,
  formatHttpError,
  isRetryableError,
} from "./http-client";
import { createAmazonURL } from "./value-objects";

// Mock got module
vi.mock("got", () => {
  const mockGot = vi.fn();
  mockGot.extend = vi.fn(() => mockGot);
  return { default: mockGot };
});

describe("HttpClient configuration", () => {
  it("should create client with default configuration", () => {
    const client = createHttpClient();
    const config = client.getConfig();

    expect(config.timeout).toBe(10000);
    expect(config.maxRetries).toBe(3);
    expect(config.retryDelay).toBe(1000);
    expect(config.userAgent).toContain("Mozilla");
  });

  it("should create client with custom configuration", () => {
    const customConfig: Partial<HttpClientConfig> = {
      timeout: 5000,
      maxRetries: 5,
      retryDelay: 2000,
      userAgent: "Custom Agent",
    };

    const client = createHttpClient(customConfig);
    const config = client.getConfig();

    expect(config.timeout).toBe(5000);
    expect(config.maxRetries).toBe(5);
    expect(config.retryDelay).toBe(2000);
    expect(config.userAgent).toBe("Custom Agent");
  });

  it("should create new client with updated configuration", () => {
    const client = createHttpClient({ timeout: 5000 });
    const newClient = client.withConfig({ timeout: 8000, maxRetries: 5 });

    expect(client.getConfig().timeout).toBe(5000);
    expect(newClient.getConfig().timeout).toBe(8000);
    expect(newClient.getConfig().maxRetries).toBe(5);
  });
});

describe("HttpClient error handling", () => {
  let client: HttpClient;
  let mockGot: any;

  beforeEach(async () => {
    client = createHttpClient();
    mockGot = vi.mocked(await import("got")).default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("successful requests", () => {
    it("should return successful response", async () => {
      const mockResponse = {
        body: "<html>test content</html>",
        statusCode: 200,
        url: "https://www.amazon.co.jp/dp/B07ABCDEFG",
      };

      mockGot.mockResolvedValueOnce(mockResponse);

      const urlResult = createAmazonURL(
        "https://www.amazon.co.jp/dp/B07ABCDEFG"
      );
      expect(urlResult.success).toBe(true);

      if (urlResult.success) {
        const result = await client.get(urlResult.data);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.body).toBe("<html>test content</html>");
          expect(result.data.statusCode).toBe(200);
          expect(result.data.url).toBe(
            "https://www.amazon.co.jp/dp/B07ABCDEFG"
          );
        }
      }
    });
  });

  describe("network errors", () => {
    it("should handle network connection errors", async () => {
      const networkError = new Error("Network error");
      (networkError as any).code = "ECONNREFUSED";

      mockGot.mockRejectedValue(networkError);

      const urlResult = createAmazonURL(
        "https://www.amazon.co.jp/dp/B07ABCDEFG"
      );
      expect(urlResult.success).toBe(true);

      if (urlResult.success) {
        const result = await client.get(urlResult.data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("NetworkError");
          expect(result.error.message).toContain("Network error");
        }
      }
    });

    it("should handle DNS resolution errors", async () => {
      const dnsError = new Error("DNS resolution failed");
      (dnsError as any).code = "ENOTFOUND";

      mockGot.mockRejectedValue(dnsError);

      const urlResult = createAmazonURL(
        "https://www.amazon.co.jp/dp/B07ABCDEFG"
      );
      expect(urlResult.success).toBe(true);

      if (urlResult.success) {
        const result = await client.get(urlResult.data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("NetworkError");
        }
      }
    });
  });

  describe("timeout errors", () => {
    it("should handle timeout errors", async () => {
      const timeoutError = new Error("Request timeout");
      (timeoutError as any).code = "ETIMEDOUT";
      (timeoutError as any).timeout = 10000;

      mockGot.mockRejectedValue(timeoutError);

      const urlResult = createAmazonURL(
        "https://www.amazon.co.jp/dp/B07ABCDEFG"
      );
      expect(urlResult.success).toBe(true);

      if (urlResult.success) {
        const result = await client.get(urlResult.data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("TimeoutError");
          expect(result.error.message).toContain("timeout");
          if (result.error.type === "TimeoutError") {
            expect(result.error.timeout).toBe(10000);
          }
        }
      }
    });
  });

  describe("HTTP status errors", () => {
    it("should handle 404 errors", async () => {
      const statusError = new Error("Not Found");
      (statusError as any).response = { statusCode: 404 };

      mockGot.mockRejectedValue(statusError);

      const urlResult = createAmazonURL(
        "https://www.amazon.co.jp/dp/B07ABCDEFG"
      );
      expect(urlResult.success).toBe(true);

      if (urlResult.success) {
        const result = await client.get(urlResult.data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("StatusError");
          if (result.error.type === "StatusError") {
            expect(result.error.statusCode).toBe(404);
          }
        }
      }
    });

    it("should handle 500 errors", async () => {
      const statusError = new Error("Internal Server Error");
      (statusError as any).response = { statusCode: 500 };

      mockGot.mockRejectedValue(statusError);

      const urlResult = createAmazonURL(
        "https://www.amazon.co.jp/dp/B07ABCDEFG"
      );
      expect(urlResult.success).toBe(true);

      if (urlResult.success) {
        const result = await client.get(urlResult.data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("StatusError");
          if (result.error.type === "StatusError") {
            expect(result.error.statusCode).toBe(500);
          }
        }
      }
    });
  });

  describe("unknown errors", () => {
    it("should handle unknown error types", async () => {
      const unknownError = new Error("Unknown error");

      mockGot.mockRejectedValue(unknownError);

      const urlResult = createAmazonURL(
        "https://www.amazon.co.jp/dp/B07ABCDEFG"
      );
      expect(urlResult.success).toBe(true);

      if (urlResult.success) {
        const result = await client.get(urlResult.data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("UnknownError");
          expect(result.error.message).toContain("Unknown error");
        }
      }
    });
  });
});

describe("Error utility functions", () => {
  describe("isRetryableError", () => {
    it("should identify retryable network errors", () => {
      const networkError: HttpError = {
        type: "NetworkError",
        message: "Connection failed",
      };

      expect(isRetryableError(networkError)).toBe(true);
    });

    it("should identify retryable timeout errors", () => {
      const timeoutError: HttpError = {
        type: "TimeoutError",
        message: "Request timeout",
        timeout: 10000,
      };

      expect(isRetryableError(timeoutError)).toBe(true);
    });

    it("should identify retryable server errors (5xx)", () => {
      const serverError: HttpError = {
        type: "StatusError",
        message: "Internal Server Error",
        statusCode: 500,
        url: "https://example.com",
      };

      expect(isRetryableError(serverError)).toBe(true);
    });

    it("should not retry client errors (4xx)", () => {
      const clientError: HttpError = {
        type: "StatusError",
        message: "Not Found",
        statusCode: 404,
        url: "https://example.com",
      };

      expect(isRetryableError(clientError)).toBe(false);
    });

    it("should not retry parse errors", () => {
      const parseError: HttpError = {
        type: "ParseError",
        message: "Parse failed",
      };

      expect(isRetryableError(parseError)).toBe(false);
    });

    it("should not retry unknown errors", () => {
      const unknownError: HttpError = {
        type: "UnknownError",
        message: "Unknown error",
      };

      expect(isRetryableError(unknownError)).toBe(false);
    });
  });

  describe("formatHttpError", () => {
    it("should format network error", () => {
      const error: HttpError = {
        type: "NetworkError",
        message: "Connection failed",
      };

      const formatted = formatHttpError(error);
      expect(formatted).toBe("Network error: Connection failed");
    });

    it("should format timeout error", () => {
      const error: HttpError = {
        type: "TimeoutError",
        message: "Request timeout",
        timeout: 10000,
      };

      const formatted = formatHttpError(error);
      expect(formatted).toBe("Timeout error: Request timeout (10000ms)");
    });

    it("should format status error", () => {
      const error: HttpError = {
        type: "StatusError",
        message: "Not Found",
        statusCode: 404,
        url: "https://example.com",
      };

      const formatted = formatHttpError(error);
      expect(formatted).toBe("HTTP 404 error: Not Found");
    });

    it("should format parse error", () => {
      const error: HttpError = {
        type: "ParseError",
        message: "Parse failed",
      };

      const formatted = formatHttpError(error);
      expect(formatted).toBe("Parse error: Parse failed");
    });

    it("should format unknown error", () => {
      const error: HttpError = {
        type: "UnknownError",
        message: "Unknown error occurred",
      };

      const formatted = formatHttpError(error);
      expect(formatted).toBe("Unknown error: Unknown error occurred");
    });
  });
});
