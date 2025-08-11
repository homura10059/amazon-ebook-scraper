import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_CONFIG,
  ENV_KEYS,
  getConfigSummary,
  loadConfig,
  validateConfig,
  type ConfigFile,
  type PipelineConfig,
} from "./config";

// Mock Node.js modules
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

// Mock external dependencies
vi.mock("@amazon-ebook-scraper/discord-notifier", () => ({
  validateWebhookUrl: vi.fn(),
}));

describe("config", () => {
  const mockWebhookUrl = "https://discord.com/api/webhooks/123/abc";
  const mockValidatedWebhookUrl = mockWebhookUrl as any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variables
    for (const key of Object.values(ENV_KEYS)) {
      delete process.env[key];
    }
  });

  describe("loadConfig", () => {
    it("should load configuration from environment variables", async () => {
      // Arrange
      process.env[ENV_KEYS.DISCORD_WEBHOOK_URL] = mockWebhookUrl;
      process.env[ENV_KEYS.SCRAPER_TIMEOUT] = "8000";
      process.env[ENV_KEYS.SCRAPER_RETRIES] = "5";
      process.env[ENV_KEYS.SCRAPER_DELAY] = "2000";

      const mockValidateWebhookUrl = await import("@amazon-ebook-scraper/discord-notifier");
      vi.mocked(mockValidateWebhookUrl.validateWebhookUrl).mockReturnValue({
        success: true,
        data: mockValidatedWebhookUrl,
      });

      // Act
      const result = await loadConfig();

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.discord.webhookUrl).toBe(mockValidatedWebhookUrl);
        expect(result.data.scraper?.timeout).toBe(8000);
        expect(result.data.scraper?.retries).toBe(5);
        expect(result.data.scraper?.delayBetweenRequests).toBe(2000);
      }
    });

    it("should use default values when environment variables are not set", async () => {
      // Arrange
      process.env[ENV_KEYS.DISCORD_WEBHOOK_URL] = mockWebhookUrl;

      const mockValidateWebhookUrl = await import("@amazon-ebook-scraper/discord-notifier");
      vi.mocked(mockValidateWebhookUrl.validateWebhookUrl).mockReturnValue({
        success: true,
        data: mockValidatedWebhookUrl,
      });

      // Act
      const result = await loadConfig();

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scraper?.timeout).toBe(DEFAULT_CONFIG.scraper!.timeout);
        expect(result.data.scraper?.retries).toBe(DEFAULT_CONFIG.scraper!.retries);
        expect(result.data.scraper?.delayBetweenRequests).toBe(DEFAULT_CONFIG.scraper!.delayBetweenRequests);
      }
    });

    it("should load configuration from JSON file", async () => {
      // Arrange
      const configFile: ConfigFile = {
        discord: {
          webhookUrl: mockWebhookUrl,
          options: {
            username: "Test Bot",
            timeout: 15000,
          },
        },
        scraper: {
          timeout: 12000,
          retries: 4,
          delayBetweenRequests: 1500,
        },
      };

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(configFile));

      const mockValidateWebhookUrl = await import("@amazon-ebook-scraper/discord-notifier");
      vi.mocked(mockValidateWebhookUrl.validateWebhookUrl).mockReturnValue({
        success: true,
        data: mockValidatedWebhookUrl,
      });

      // Act
      const result = await loadConfig("config.json");

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.discord.webhookUrl).toBe(mockValidatedWebhookUrl);
        expect(result.data.discord.options?.username).toBe("Test Bot");
        expect(result.data.scraper?.timeout).toBe(12000);
      }
    });

    it("should merge environment and JSON configurations with JSON taking precedence", async () => {
      // Arrange
      process.env[ENV_KEYS.DISCORD_WEBHOOK_URL] = "https://discord.com/api/webhooks/env/token";
      process.env[ENV_KEYS.SCRAPER_TIMEOUT] = "5000";

      const configFile: Partial<ConfigFile> = {
        discord: {
          webhookUrl: mockWebhookUrl, // Should override environment
        },
        scraper: {
          retries: 6, // Should merge with environment timeout
        },
      };

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(configFile));

      const mockValidateWebhookUrl = await import("@amazon-ebook-scraper/discord-notifier");
      vi.mocked(mockValidateWebhookUrl.validateWebhookUrl).mockReturnValue({
        success: true,
        data: mockValidatedWebhookUrl,
      });

      // Act
      const result = await loadConfig("config.json");

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.discord.webhookUrl).toBe(mockValidatedWebhookUrl); // From JSON
        expect(result.data.scraper?.timeout).toBe(5000); // From environment
        expect(result.data.scraper?.retries).toBe(6); // From JSON
      }
    });

    it("should return error when Discord webhook URL is missing", async () => {
      // Act
      const result = await loadConfig();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error.type).toBe("config_error");
      expect(result.error.message).toContain("Discord webhook URL is required");
    });

    it("should return error when webhook URL validation fails", async () => {
      // Arrange
      process.env[ENV_KEYS.DISCORD_WEBHOOK_URL] = "invalid-url";

      const mockValidateWebhookUrl = await import("@amazon-ebook-scraper/discord-notifier");
      vi.mocked(mockValidateWebhookUrl.validateWebhookUrl).mockReturnValue({
        success: false,
        error: { message: "Invalid URL format" },
      });

      // Act
      const result = await loadConfig();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error.type).toBe("config_error");
      expect(result.error.message).toContain("Invalid Discord webhook URL");
    });

    it("should return error when JSON file cannot be read", async () => {
      // Arrange
      process.env[ENV_KEYS.DISCORD_WEBHOOK_URL] = mockWebhookUrl;
      vi.mocked(readFile).mockRejectedValue(new Error("File not found"));

      // Act
      const result = await loadConfig("nonexistent.json");

      // Assert
      expect(result.success).toBe(false);
      expect(result.error.type).toBe("config_error");
      expect(result.error.message).toContain("Failed to load config file");
    });

    it("should return error when JSON file contains invalid JSON", async () => {
      // Arrange
      process.env[ENV_KEYS.DISCORD_WEBHOOK_URL] = mockWebhookUrl;
      vi.mocked(readFile).mockResolvedValue("invalid json");

      // Act
      const result = await loadConfig("invalid.json");

      // Assert
      expect(result.success).toBe(false);
      expect(result.error.type).toBe("config_error");
      expect(result.error.message).toContain("Failed to load config file");
    });

    it("should handle invalid environment variable numbers", async () => {
      // Arrange
      process.env[ENV_KEYS.DISCORD_WEBHOOK_URL] = mockWebhookUrl;
      process.env[ENV_KEYS.SCRAPER_TIMEOUT] = "not-a-number";
      process.env[ENV_KEYS.SCRAPER_RETRIES] = "invalid";

      const mockValidateWebhookUrl = await import("@amazon-ebook-scraper/discord-notifier");
      vi.mocked(mockValidateWebhookUrl.validateWebhookUrl).mockReturnValue({
        success: true,
        data: mockValidatedWebhookUrl,
      });

      // Act
      const result = await loadConfig();

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        // Should fallback to defaults
        expect(result.data.scraper?.timeout).toBe(DEFAULT_CONFIG.scraper!.timeout);
        expect(result.data.scraper?.retries).toBe(DEFAULT_CONFIG.scraper!.retries);
      }
    });
  });

  describe("validateConfig", () => {
    it("should return success for valid configuration", async () => {
      // Arrange
      process.env[ENV_KEYS.DISCORD_WEBHOOK_URL] = mockWebhookUrl;

      const mockValidateWebhookUrl = await import("@amazon-ebook-scraper/discord-notifier");
      vi.mocked(mockValidateWebhookUrl.validateWebhookUrl).mockReturnValue({
        success: true,
        data: mockValidatedWebhookUrl,
      });

      // Act
      const result = await validateConfig();

      // Assert
      expect(result.success).toBe(true);
    });

    it("should return error for invalid configuration", async () => {
      // Act
      const result = await validateConfig();

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("getConfigSummary", () => {
    it("should return configuration summary with masked webhook URL", () => {
      // Arrange
      const config: PipelineConfig = {
        discord: {
          webhookUrl: "https://discord.com/api/webhooks/123/secret-token" as any,
          options: {
            username: "Test Bot",
            timeout: 15000,
          },
        },
        scraper: {
          timeout: 12000,
          retries: 4,
          delayBetweenRequests: 1500 as any,
        },
      };

      // Act
      const summary = getConfigSummary(config);

      // Assert
      expect(summary).toEqual({
        discord: {
          webhookUrl: "https://discord.com/api/webhooks/123/***",
          username: "Test Bot",
          timeout: 15000,
        },
        scraper: {
          timeout: 12000,
          retries: 4,
          delayBetweenRequests: 1500,
        },
      });
    });

    it("should handle missing optional configuration values", () => {
      // Arrange
      const config: PipelineConfig = {
        discord: {
          webhookUrl: "https://discord.com/api/webhooks/123/secret-token" as any,
        },
      };

      // Act
      const summary = getConfigSummary(config);

      // Assert
      expect(summary).toEqual({
        discord: {
          webhookUrl: "https://discord.com/api/webhooks/123/***",
          username: "default",
          timeout: "default",
        },
        scraper: {
          timeout: DEFAULT_CONFIG.scraper!.timeout,
          retries: DEFAULT_CONFIG.scraper!.retries,
          delayBetweenRequests: DEFAULT_CONFIG.scraper!.delayBetweenRequests,
        },
      });
    });
  });
});