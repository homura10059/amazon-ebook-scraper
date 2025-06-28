import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDiscordNotifier,
  formatMessage,
  formatSimpleMessage,
  sendProductNotification,
  validateNotificationData,
  validateWebhookUrl,
} from "./index";
import type { DiscordNotifierConfig, NotificationData } from "./types";

// Mock got module
vi.mock("got", () => ({
  default: vi.fn(),
}));

describe("Discord Notifier", () => {
  const validWebhookUrl =
    "https://discord.com/api/webhooks/123456789/abcdef123456789";

  const validNotificationData: NotificationData = {
    type: "product_found",
    product: {
      title: "Test Book",
      price: "¥1,000",
      timestamp: 1640995200, // 2022-01-01 00:00:00 UTC
    },
    metadata: {
      source: "Amazon",
      url: "https://amazon.co.jp/test",
    },
  };

  const validConfig: DiscordNotifierConfig = {
    webhookUrl: validWebhookUrl as import("./types").WebhookURL,
    options: {
      username: "Scraper Bot",
      timeout: 5000,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateWebhookUrl", () => {
    it("should accept valid Discord webhook URLs", () => {
      const result = validateWebhookUrl(validWebhookUrl);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(validWebhookUrl);
      }
    });

    it("should reject invalid URL formats", () => {
      const result = validateWebhookUrl("https://example.com/invalid");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
        expect(result.error.message).toContain("Invalid Discord webhook URL");
      }
    });

    it("should reject empty URLs", () => {
      const result = validateWebhookUrl("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
      }
    });

    it("should reject non-string values", () => {
      const result = validateWebhookUrl(123 as unknown as string);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
      }
    });
  });

  describe("validateNotificationData", () => {
    it("should accept valid notification data", () => {
      const result = validateNotificationData(validNotificationData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("product_found");
        expect(result.data.product.title).toBe("Test Book");
      }
    });

    it("should reject invalid notification type", () => {
      const invalidData = { ...validNotificationData, type: "invalid_type" };
      const result = validateNotificationData(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
        expect(result.error.message).toContain("Notification type must be");
      }
    });

    it("should reject missing product data", () => {
      const invalidData = { type: "product_found" };
      const result = validateNotificationData(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
        expect(result.error.field).toBe("product");
      }
    });

    it("should reject invalid product title", () => {
      const invalidData = {
        ...validNotificationData,
        product: { ...validNotificationData.product, title: "" },
      };
      const result = validateNotificationData(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.field).toBe("product.title");
      }
    });

    it("should reject invalid timestamp", () => {
      const invalidData = {
        ...validNotificationData,
        product: {
          ...validNotificationData.product,
          timestamp: "invalid" as unknown as number,
        },
      };
      const result = validateNotificationData(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.field).toBe("product.timestamp");
      }
    });
  });

  describe("formatMessage", () => {
    it("should format notification data into Discord embed", () => {
      const result = formatMessage(validNotificationData);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.embeds).toBeDefined();
        expect(result.data.embeds).toHaveLength(1);

        const embed = result.data.embeds?.[0];
        expect(embed.title).toContain("新しい商品");
        expect(embed.fields).toBeDefined();
        expect(embed.fields?.length).toBeGreaterThan(0);

        // Check if product title is in fields
        const titleField = embed.fields?.find((f) => f.name.includes("商品名"));
        expect(titleField?.value).toBe("Test Book");

        // Check if price is in fields
        const priceField = embed.fields?.find((f) => f.name.includes("価格"));
        expect(priceField?.value).toBe("¥1,000");
      }
    });

    it("should handle metadata fields", () => {
      const result = formatMessage(validNotificationData);
      expect(result.success).toBe(true);

      if (result.success) {
        const embed = result.data.embeds?.[0];
        const sourceField = embed.fields?.find((f) =>
          f.name.includes("ソース")
        );
        expect(sourceField?.value).toBe("Amazon");

        const urlField = embed.fields?.find((f) => f.name.includes("URL"));
        expect(urlField?.value).toBe("https://amazon.co.jp/test");
      }
    });

    it("should reject unsupported notification types", () => {
      const invalidData = {
        ...validNotificationData,
        type: "unsupported" as unknown as "product_found",
      };
      const result = formatMessage(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("formatting_error");
      }
    });
  });

  describe("formatSimpleMessage", () => {
    it("should format notification data into simple text message", () => {
      const result = formatSimpleMessage(validNotificationData);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.content).toBeDefined();
        expect(result.data.content).toContain("Test Book");
        expect(result.data.content).toContain("¥1,000");
        expect(result.data.embeds).toBeUndefined();
      }
    });
  });

  describe("createDiscordNotifier", () => {
    it("should create a notifier with valid configuration", () => {
      const result = createDiscordNotifier(validConfig);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.sendProductNotification).toBeDefined();
        expect(result.data.testConnection).toBeDefined();
        expect(result.data.getConfig).toBeDefined();

        const config = result.data.getConfig();
        expect(config.webhookUrl).toBe(validWebhookUrl);
      }
    });

    it("should reject invalid configuration", () => {
      const invalidConfig = { webhookUrl: "invalid-url" };
      const result = createDiscordNotifier(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
      }
    });

    it("should reject missing configuration", () => {
      const result = createDiscordNotifier(null);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
      }
    });
  });

  describe("sendProductNotification", () => {
    it("should validate data and config before sending", async () => {
      // Mock successful HTTP response
      const { default: got } = await import("got");
      vi.mocked(got).mockResolvedValueOnce({ statusCode: 204 } as Partial<
        import("got").Response<string>
      >);

      const result = await sendProductNotification(
        validNotificationData,
        validConfig
      );
      expect(result.success).toBe(true);
    });

    it("should handle validation errors", async () => {
      const invalidData = { type: "invalid" } as unknown as NotificationData;
      const result = await sendProductNotification(invalidData, validConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation_error");
      }
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete notification flow", async () => {
      // Mock successful HTTP response
      const { default: got } = await import("got");
      vi.mocked(got).mockResolvedValueOnce({ statusCode: 204 } as Partial<
        import("got").Response<string>
      >);

      const notifierResult = createDiscordNotifier(validConfig);
      expect(notifierResult.success).toBe(true);

      if (notifierResult.success) {
        const notifier = notifierResult.data;
        const result = await notifier.sendProductNotification(
          validNotificationData
        );
        expect(result.success).toBe(true);
      }
    });

    it("should handle network errors gracefully", async () => {
      // Mock network error
      const { default: got } = await import("got");
      vi.mocked(got).mockRejectedValueOnce(new Error("Network error"));

      const notifierResult = createDiscordNotifier(validConfig);
      if (notifierResult.success) {
        const result = await notifierResult.data.sendProductNotification(
          validNotificationData
        );
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("network_error");
        }
      }
    });
  });
});
