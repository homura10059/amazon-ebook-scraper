import { createSuccess, createValidationError } from "./result-helpers";
import type {
  DiscordNotifierConfig,
  DiscordOptions,
  NotificationData,
  NotificationError,
  Result,
  WebhookURL,
} from "./types";

// Discord webhook URL pattern
const DISCORD_WEBHOOK_PATTERN =
  /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;

// Validate Discord webhook URL
export const validateWebhookUrl = (
  url: string
): Result<WebhookURL, NotificationError> => {
  if (!url || typeof url !== "string") {
    return createValidationError(
      "Webhook URL is required and must be a string",
      "webhookUrl"
    );
  }

  if (!DISCORD_WEBHOOK_PATTERN.test(url)) {
    return createValidationError(
      "Invalid Discord webhook URL format",
      "webhookUrl"
    );
  }

  return createSuccess(url as WebhookURL);
};

// Validate notification data
export const validateNotificationData = (
  data: unknown
): Result<NotificationData, NotificationError> => {
  if (!data || typeof data !== "object") {
    return createValidationError("Notification data must be an object", "data");
  }

  const notificationData = data as Record<string, unknown>;

  if (notificationData.type !== "product_found") {
    return createValidationError(
      'Notification type must be "product_found"',
      "type"
    );
  }

  if (!notificationData.product) {
    return createValidationError("Product data is required", "product");
  }

  const product = notificationData.product as Record<string, unknown>;

  if (!product.title || typeof product.title !== "string") {
    return createValidationError(
      "Product title is required and must be a string",
      "product.title"
    );
  }

  if (!product.price || typeof product.price !== "string") {
    return createValidationError(
      "Product price is required and must be a string",
      "product.price"
    );
  }

  if (typeof product.timestamp !== "number") {
    return createValidationError(
      "Product timestamp is required and must be a number",
      "product.timestamp"
    );
  }

  return createSuccess({
    type: "product_found",
    product: {
      title: product.title as string,
      price: product.price as string,
      timestamp: product.timestamp as number,
    },
    metadata: notificationData.metadata as NotificationData["metadata"],
  });
};

// Validate Discord notifier configuration
export const validateConfig = (
  config: unknown
): Result<DiscordNotifierConfig, NotificationError> => {
  if (!config || typeof config !== "object") {
    return createValidationError("Configuration must be an object", "config");
  }

  const configData = config as Record<string, unknown>;

  const webhookResult = validateWebhookUrl(configData.webhookUrl as string);
  if (!webhookResult.success) {
    return webhookResult;
  }

  return createSuccess({
    webhookUrl: webhookResult.data,
    options: configData.options as DiscordOptions | undefined,
  });
};

// Validate timeout value
export const validateTimeout = (
  timeout: unknown
): Result<number, NotificationError> => {
  if (timeout === undefined || timeout === null) {
    return createSuccess(5000); // Default 5 seconds
  }

  if (typeof timeout !== "number") {
    return createValidationError("Timeout must be a number", "timeout");
  }

  if (timeout <= 0) {
    return createValidationError("Timeout must be greater than 0", "timeout");
  }

  if (timeout > 30000) {
    return createValidationError(
      "Timeout must be less than or equal to 30000ms",
      "timeout"
    );
  }

  return createSuccess(timeout);
};
