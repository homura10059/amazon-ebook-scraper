import { describe, expect, it, vi } from "vitest";
import { createExampleConfig, loadConfig } from "./config";

describe("Configuration Management", () => {
  describe("createExampleConfig", () => {
    it("should create valid JSON configuration", () => {
      const config = createExampleConfig();
      expect(() => JSON.parse(config)).not.toThrow();

      const parsed = JSON.parse(config);
      expect(parsed).toHaveProperty("discord");
      expect(parsed).toHaveProperty("scraper");
      expect(parsed.discord).toHaveProperty("webhookUrl");
    });
  });

  describe("loadConfig", () => {
    it("should load configuration from environment variable", () => {
      const originalEnv = process.env.DISCORD_WEBHOOK_URL;
      process.env.DISCORD_WEBHOOK_URL =
        "https://discord.com/api/webhooks/123456789/abcdefgh";

      const result = loadConfig();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.discord.webhookUrl).toBe(
          "https://discord.com/api/webhooks/123456789/abcdefgh"
        );
      }

      // Restore original environment
      if (originalEnv) {
        process.env.DISCORD_WEBHOOK_URL = originalEnv;
      } else {
        process.env.DISCORD_WEBHOOK_URL = undefined;
      }
    });

    it("should return error for invalid webhook URL", () => {
      const originalEnv = process.env.DISCORD_WEBHOOK_URL;
      process.env.DISCORD_WEBHOOK_URL = "invalid-url";

      const result = loadConfig();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
      }

      // Restore original environment
      if (originalEnv) {
        process.env.DISCORD_WEBHOOK_URL = originalEnv;
      } else {
        process.env.DISCORD_WEBHOOK_URL = undefined;
      }
    });

    it("should return error when no webhook URL is provided", () => {
      const originalEnv = process.env.DISCORD_WEBHOOK_URL;
      process.env.DISCORD_WEBHOOK_URL = "";

      const result = loadConfig();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
        expect(result.error.message).toContain(
          "Discord webhook URL is required"
        );
      }

      // Restore original environment
      if (originalEnv) {
        process.env.DISCORD_WEBHOOK_URL = originalEnv;
      } else {
        process.env.DISCORD_WEBHOOK_URL = undefined;
      }
    });
  });
});
