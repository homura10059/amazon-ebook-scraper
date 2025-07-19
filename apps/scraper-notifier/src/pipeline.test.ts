import type { WebhookURL } from "@amazon-ebook-scraper/discord-notifier";
import type { ScrapedProduct } from "@amazon-ebook-scraper/scraper";
import { describe, expect, it, vi } from "vitest";
import type { CLIConfig } from "./config";
import { formatPipelineError, runScrapingPipeline } from "./pipeline";

// Mock the external packages
vi.mock("@amazon-ebook-scraper/scraper", () => ({
  scrapeAmazonProduct: vi.fn(),
}));

vi.mock("@amazon-ebook-scraper/discord-notifier", () => ({
  createDiscordNotifier: vi.fn(),
}));

describe("Pipeline", () => {
  const mockConfig: CLIConfig = {
    discord: {
      webhookUrl:
        "https://discord.com/api/webhooks/123456789/abcdefgh" as WebhookURL,
      options: {
        timeout: 10000,
        allowMentions: false,
      },
    },
    scraper: {
      timeout: 10000,
      retries: 3,
      userAgent: "Mozilla/5.0",
    },
  };

  describe("URL validation", () => {
    it("should reject non-Amazon URLs", async () => {
      const result = await runScrapingPipeline(
        "https://example.com/book",
        mockConfig
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
        expect(result.error.message).toContain("amazon.co.jp");
      }
    });

    it("should reject empty URLs", async () => {
      const result = await runScrapingPipeline("", mockConfig);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
        expect(result.error.message).toContain("non-empty string");
      }
    });
  });

  describe("formatPipelineError", () => {
    it("should format scraper errors", () => {
      const error = {
        type: "scraper_error" as const,
        message: "Network timeout",
        url: "https://amazon.co.jp/dp/123",
        status: 404,
      };

      const formatted = formatPipelineError(error);
      expect(formatted).toContain("Scraping failed");
      expect(formatted).toContain("Network timeout");
      expect(formatted).toContain("URL: https://amazon.co.jp/dp/123");
      expect(formatted).toContain("Status: 404");
    });

    it("should format validation errors", () => {
      const error = {
        type: "validation_error" as const,
        message: "Invalid URL format",
        field: "url",
      };

      const formatted = formatPipelineError(error);
      expect(formatted).toContain("Validation failed");
      expect(formatted).toContain("Invalid URL format");
      expect(formatted).toContain("Field: url");
    });

    it("should format notification errors", () => {
      const error = {
        type: "notification_error" as const,
        error: {
          type: "network_error" as const,
          message: "Discord API unavailable",
        },
      };

      const formatted = formatPipelineError(error);
      expect(formatted).toContain("Notification failed");
      expect(formatted).toContain("Discord API unavailable");
    });
  });
});
