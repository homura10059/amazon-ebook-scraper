import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScrapedProduct } from "@amazon-ebook-scraper/scraper";
import type { DiscordNotifierConfig, NotificationData } from "@amazon-ebook-scraper/discord-notifier";
import {
  type BatchProcessResult,
  type PipelineConfig,
  type ProcessResult,
  createNotificationScraper,
  processBatch,
  processUrl,
  testPipelineConfig,
} from "./pipeline";

// Mock the external dependencies
vi.mock("@amazon-ebook-scraper/scraper", () => ({
  scrapeAmazonProduct: vi.fn(),
}));

vi.mock("@amazon-ebook-scraper/discord-notifier", () => ({
  createDiscordNotifier: vi.fn(),
  createNotificationPipeline: vi.fn(),
}));

describe("pipeline", () => {
  const mockWebhookUrl = "https://discord.com/api/webhooks/123/abc" as any;
  const mockDiscordConfig: DiscordNotifierConfig = {
    webhookUrl: mockWebhookUrl,
  };
  const mockPipelineConfig: PipelineConfig = {
    discord: mockDiscordConfig,
    scraper: {
      timeout: 5000,
      retries: 2,
      delayBetweenRequests: 500 as any,
    },
  };
  const mockScrapedProduct: ScrapedProduct = {
    title: "Test Book",
    price: "¥1,980",
    timestamp: 1640995200,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processUrl", () => {
    it("should successfully process a valid Amazon URL", async () => {
      // Arrange
      const url = "https://amazon.co.jp/dp/123456789";
      const mockScrapeAmazonProduct = await import("@amazon-ebook-scraper/scraper");
      const mockCreateNotificationPipeline = await import("@amazon-ebook-scraper/discord-notifier");

      vi.mocked(mockScrapeAmazonProduct.scrapeAmazonProduct).mockResolvedValue(mockScrapedProduct);
      vi.mocked(mockCreateNotificationPipeline.createNotificationPipeline).mockReturnValue(
        vi.fn().mockResolvedValue({ success: true })
      );

      // Act
      const result: ProcessResult = await processUrl(url, mockPipelineConfig);

      // Assert
      expect(result).toEqual({
        url,
        success: true,
        data: mockScrapedProduct,
      });
    });

    it("should return validation error for invalid URL", async () => {
      // Arrange
      const invalidUrl = "https://example.com";

      // Act
      const result: ProcessResult = await processUrl(invalidUrl, mockPipelineConfig);

      // Assert
      expect(result).toEqual({
        url: invalidUrl,
        success: false,
        error: {
          type: "validation_error",
          message: "URL must be from amazon.co.jp domain",
          url: invalidUrl,
        },
      });
    });

    it("should handle scraping errors", async () => {
      // Arrange
      const url = "https://amazon.co.jp/dp/123456789";
      const mockScrapeAmazonProduct = await import("@amazon-ebook-scraper/scraper");

      vi.mocked(mockScrapeAmazonProduct.scrapeAmazonProduct).mockRejectedValue(
        new Error("Network timeout")
      );

      // Act
      const result: ProcessResult = await processUrl(url, mockPipelineConfig);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe("scraping_error");
      expect(result.error?.message).toContain("Network timeout");
    });

    it("should handle notification errors", async () => {
      // Arrange
      const url = "https://amazon.co.jp/dp/123456789";
      const mockScrapeAmazonProduct = await import("@amazon-ebook-scraper/scraper");
      const mockCreateNotificationPipeline = await import("@amazon-ebook-scraper/discord-notifier");

      vi.mocked(mockScrapeAmazonProduct.scrapeAmazonProduct).mockResolvedValue(mockScrapedProduct);
      vi.mocked(mockCreateNotificationPipeline.createNotificationPipeline).mockReturnValue(
        vi.fn().mockResolvedValue({
          success: false,
          error: { message: "Webhook failed" },
        })
      );

      // Act
      const result: ProcessResult = await processUrl(url, mockPipelineConfig);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe("notification_error");
      expect(result.error?.message).toContain("Webhook failed");
      expect(result.data).toEqual(mockScrapedProduct); // Data should still be present
    });

    it("should return validation error for empty URL", async () => {
      // Act
      const result: ProcessResult = await processUrl("", mockPipelineConfig);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe("validation_error");
      expect(result.error?.message).toBe("URL must be a non-empty string");
    });
  });

  describe("processBatch", () => {
    it("should process multiple URLs with delays", async () => {
      // Arrange
      const urls = [
        "https://amazon.co.jp/dp/123456789",
        "https://amazon.co.jp/dp/987654321",
      ];
      const mockScrapeAmazonProduct = await import("@amazon-ebook-scraper/scraper");
      const mockCreateNotificationPipeline = await import("@amazon-ebook-scraper/discord-notifier");

      vi.mocked(mockScrapeAmazonProduct.scrapeAmazonProduct).mockResolvedValue(mockScrapedProduct);
      vi.mocked(mockCreateNotificationPipeline.createNotificationPipeline).mockReturnValue(
        vi.fn().mockResolvedValue({ success: true })
      );

      // Act
      const result: BatchProcessResult = await processBatch(urls, mockPipelineConfig);

      // Assert
      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results.every(r => r.success)).toBe(true);
    });

    it("should handle mixed success and failure results", async () => {
      // Arrange
      const urls = [
        "https://amazon.co.jp/dp/123456789", // Valid
        "https://example.com", // Invalid
      ];
      const mockScrapeAmazonProduct = await import("@amazon-ebook-scraper/scraper");
      const mockCreateNotificationPipeline = await import("@amazon-ebook-scraper/discord-notifier");

      vi.mocked(mockScrapeAmazonProduct.scrapeAmazonProduct).mockResolvedValue(mockScrapedProduct);
      vi.mocked(mockCreateNotificationPipeline.createNotificationPipeline).mockReturnValue(
        vi.fn().mockResolvedValue({ success: true })
      );

      // Act
      const result: BatchProcessResult = await processBatch(urls, mockPipelineConfig);

      // Assert
      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });

    it("should handle empty URL list", async () => {
      // Act
      const result: BatchProcessResult = await processBatch([], mockPipelineConfig);

      // Assert
      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);
    });
  });

  describe("testPipelineConfig", () => {
    it("should successfully test valid configuration", async () => {
      // Arrange
      const mockCreateDiscordNotifier = await import("@amazon-ebook-scraper/discord-notifier");
      const mockNotifier = {
        testConnection: vi.fn().mockResolvedValue({ success: true }),
      };

      vi.mocked(mockCreateDiscordNotifier.createDiscordNotifier).mockReturnValue({
        success: true,
        data: mockNotifier,
      });

      // Act
      const result = await testPipelineConfig(mockPipelineConfig);

      // Assert
      expect(result.success).toBe(true);
      expect(mockNotifier.testConnection).toHaveBeenCalled();
    });

    it("should return error for invalid Discord configuration", async () => {
      // Arrange
      const mockCreateDiscordNotifier = await import("@amazon-ebook-scraper/discord-notifier");

      vi.mocked(mockCreateDiscordNotifier.createDiscordNotifier).mockReturnValue({
        success: false,
        error: { message: "Invalid webhook URL" },
      });

      // Act
      const result = await testPipelineConfig(mockPipelineConfig);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error.message).toContain("Discord notifier validation failed");
    });

    it("should return error for failed webhook test", async () => {
      // Arrange
      const mockCreateDiscordNotifier = await import("@amazon-ebook-scraper/discord-notifier");
      const mockNotifier = {
        testConnection: vi.fn().mockResolvedValue({
          success: false,
          error: { message: "Connection timeout" },
        }),
      };

      vi.mocked(mockCreateDiscordNotifier.createDiscordNotifier).mockReturnValue({
        success: true,
        data: mockNotifier,
      });

      // Act
      const result = await testPipelineConfig(mockPipelineConfig);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error.message).toContain("Discord webhook test failed");
    });
  });

  describe("createNotificationScraper", () => {
    it("should create a valid pipeline instance", () => {
      // Act
      const result = createNotificationScraper(mockPipelineConfig);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.processUrl).toBeTypeOf("function");
        expect(result.data.processBatch).toBeTypeOf("function");
        expect(result.data.testConfig).toBeTypeOf("function");
        expect(result.data.getConfig).toBeTypeOf("function");
        expect(result.data.getConfig()).toEqual(mockPipelineConfig);
      }
    });

    it("should return error for invalid configuration", () => {
      // Arrange
      const invalidConfig = null as any;

      // Act
      const result = createNotificationScraper(invalidConfig);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error.type).toBe("config_error");
    });

    it("should return error for missing Discord configuration", () => {
      // Arrange
      const invalidConfig = { scraper: {} } as any;

      // Act
      const result = createNotificationScraper(invalidConfig);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error.type).toBe("config_error");
      expect(result.error.message).toContain("Discord configuration is required");
    });
  });
});