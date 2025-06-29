// Re-export types
export type {
  WebhookURL,
  DiscordMessage,
  FormattedPrice,
  Timestamp,
  Result,
  ScrapedProduct,
  NotificationData,
  NotificationMetadata,
  DiscordNotifierConfig,
  DiscordOptions,
  DiscordEmbed,
  DiscordEmbedField,
  DiscordEmbedFooter,
  DiscordWebhookPayload,
  NotificationError,
  FormatMessage,
  SendNotification,
  ValidateWebhookUrl,
} from "./types";

// Re-export validation functions
export {
  validateWebhookUrl,
  validateNotificationData,
  validateConfig,
  validateTimeout,
} from "./validation";

// Re-export formatting functions
export {
  formatMessage,
  formatSimpleMessage,
} from "./formatter";

// Re-export notification functions
export {
  sendDiscordNotification,
  testWebhook,
  sendBatchNotifications,
} from "./notifier";

// Re-export helper functions
export {
  createSuccess,
  createValidationError,
  createFormattingError,
  createNetworkError,
  createDiscordError,
  createError,
} from "./result-helpers";

import { formatMessage } from "./formatter";
import { sendDiscordNotification } from "./notifier";
import { createSuccess } from "./result-helpers";
// Main high-level API
import type {
  DiscordNotifierConfig,
  NotificationData,
  NotificationError,
  Result,
} from "./types";
import { validateConfig, validateNotificationData } from "./validation";

// Create a Discord notifier instance
export interface DiscordNotifier {
  readonly sendProductNotification: (
    data: NotificationData
  ) => Promise<Result<void, NotificationError>>;
  readonly testConnection: () => Promise<Result<void, NotificationError>>;
  readonly getConfig: () => DiscordNotifierConfig;
}

// Factory function to create a Discord notifier
export const createDiscordNotifier = (
  config: unknown
): Result<DiscordNotifier, NotificationError> => {
  const configResult = validateConfig(config);
  if (!configResult.success) {
    return configResult;
  }

  const validatedConfig = configResult.data;

  const notifier: DiscordNotifier = {
    sendProductNotification: async (data: NotificationData) => {
      // Validate notification data
      const dataResult = validateNotificationData(data);
      if (!dataResult.success) {
        return dataResult;
      }

      // Format message
      const formatResult = formatMessage(dataResult.data);
      if (!formatResult.success) {
        return formatResult;
      }

      // Send notification
      return sendDiscordNotification(formatResult.data, validatedConfig);
    },

    testConnection: async () => {
      const { testWebhook } = await import("./notifier");
      return testWebhook(validatedConfig);
    },

    getConfig: () => validatedConfig,
  };

  return createSuccess(notifier);
};

// Convenience function for one-off notifications
export const sendProductNotification = async (
  data: NotificationData,
  config: DiscordNotifierConfig
): Promise<Result<void, NotificationError>> => {
  const notifierResult = createDiscordNotifier(config);
  if (!notifierResult.success) {
    return notifierResult;
  }

  return notifierResult.data.sendProductNotification(data);
};

// Pipeline function for functional composition
export const createNotificationPipeline = (config: DiscordNotifierConfig) => {
  return async (
    data: NotificationData
  ): Promise<Result<void, NotificationError>> => {
    const dataResult = validateNotificationData(data);
    if (!dataResult.success) return dataResult;

    const formatResult = formatMessage(dataResult.data);
    if (!formatResult.success) return formatResult;

    return sendDiscordNotification(formatResult.data, config);
  };
};
