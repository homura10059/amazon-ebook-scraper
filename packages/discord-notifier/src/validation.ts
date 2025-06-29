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
    return {
      success: false,
      error: {
        type: "validation_error",
        message: "Webhook URL is required and must be a string",
        field: "webhookUrl",
      },
    };
  }

  if (!DISCORD_WEBHOOK_PATTERN.test(url)) {
    return {
      success: false,
      error: {
        type: "validation_error",
        message: "Invalid Discord webhook URL format",
        field: "webhookUrl",
      },
    };
  }

  return {
    success: true,
    data: url as WebhookURL,
  };
};

// Validate notification data
export const validateNotificationData = (
  data: unknown
): Result<NotificationData, NotificationError> => {
  if (!data || typeof data !== "object") {
    return {
      success: false,
      error: {
        type: "validation_error",
        message: "Notification data must be an object",
        field: "data",
      },
    };
  }

  const notificationData = data as Record<string, unknown>;

  if (notificationData.type !== "product_found") {
    return {
      success: false,
      error: {
        type: "validation_error",
        message: 'Notification type must be "product_found"',
        field: "type",
      },
    };
  }

  if (!notificationData.product) {
    return {
      success: false,
      error: {
        type: "validation_error",
        message: "Product data is required",
        field: "product",
      },
    };
  }

  if (!Array.isArray(notificationData.product)) {
    return {
      success: false,
      error: {
        type: "validation_error",
        message: "Product data must be an array",
        field: "product",
      },
    };
  }

  if (notificationData.product.length === 0) {
    return {
      success: false,
      error: {
        type: "validation_error",
        message: "Product array cannot be empty",
        field: "product",
      },
    };
  }

  const products = notificationData.product as Record<string, unknown>[];

  // Validate each product in the array
  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    if (!product || typeof product !== "object") {
      return {
        success: false,
        error: {
          type: "validation_error",
          message: `Product at index ${i} must be an object`,
          field: `product[${i}]`,
        },
      };
    }

    if (!product.title || typeof product.title !== "string") {
      return {
        success: false,
        error: {
          type: "validation_error",
          message: `Product title at index ${i} is required and must be a string`,
          field: `product[${i}].title`,
        },
      };
    }

    if (!product.price || typeof product.price !== "string") {
      return {
        success: false,
        error: {
          type: "validation_error",
          message: `Product price at index ${i} is required and must be a string`,
          field: `product[${i}].price`,
        },
      };
    }

    if (typeof product.timestamp !== "number") {
      return {
        success: false,
        error: {
          type: "validation_error",
          message: `Product timestamp at index ${i} is required and must be a number`,
          field: `product[${i}].timestamp`,
        },
      };
    }
  }

  return {
    success: true,
    data: {
      type: "product_found",
      product: products.map((product) => ({
        title: product.title as string,
        price: product.price as string,
        timestamp: product.timestamp as number,
      })),
      metadata: notificationData.metadata as NotificationData["metadata"],
    },
  };
};

// Validate Discord notifier configuration
export const validateConfig = (
  config: unknown
): Result<DiscordNotifierConfig, NotificationError> => {
  if (!config || typeof config !== "object") {
    return {
      success: false,
      error: {
        type: "validation_error",
        message: "Configuration must be an object",
        field: "config",
      },
    };
  }

  const configData = config as Record<string, unknown>;

  const webhookResult = validateWebhookUrl(configData.webhookUrl as string);
  if (!webhookResult.success) {
    return webhookResult;
  }

  return {
    success: true,
    data: {
      webhookUrl: webhookResult.data,
      options: configData.options as DiscordOptions | undefined,
    },
  };
};

// Validate timeout value
export const validateTimeout = (
  timeout: unknown
): Result<number, NotificationError> => {
  if (timeout === undefined || timeout === null) {
    return { success: true, data: 5000 }; // Default 5 seconds
  }

  if (typeof timeout !== "number") {
    return {
      success: false,
      error: {
        type: "validation_error",
        message: "Timeout must be a number",
        field: "timeout",
      },
    };
  }

  if (timeout <= 0) {
    return {
      success: false,
      error: {
        type: "validation_error",
        message: "Timeout must be greater than 0",
        field: "timeout",
      },
    };
  }

  if (timeout > 30000) {
    return {
      success: false,
      error: {
        type: "validation_error",
        message: "Timeout must be less than or equal to 30000ms",
        field: "timeout",
      },
    };
  }

  return { success: true, data: timeout };
};
