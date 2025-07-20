import got, { type OptionsOfJSONResponseBody } from "got";
import {
  createDiscordError,
  createError,
  createSuccess,
} from "./result-helpers";
import type {
  DiscordNotifierConfig,
  DiscordWebhookPayload,
  NotificationError,
  Result,
} from "./types";
import { validateTimeout } from "./validation";

// Default configuration values
const DEFAULT_TIMEOUT = 5000; // 5 seconds
const DEFAULT_USER_AGENT = "Amazon-Ebook-Scraper-Discord-Notifier/1.0.0";

// Create HTTP client options
const createHttpOptions = (
  config: DiscordNotifierConfig,
  payload: DiscordWebhookPayload
): Result<OptionsOfJSONResponseBody, NotificationError> => {
  const timeoutResult = validateTimeout(config.options?.timeout);
  if (!timeoutResult.success) {
    return timeoutResult;
  }

  const options: OptionsOfJSONResponseBody = {
    method: "POST",
    url: config.webhookUrl,
    json: payload,
    timeout: {
      request: timeoutResult.data,
    },
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
      "Content-Type": "application/json",
    },
    retry: {
      limit: 2,
      methods: ["POST"],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      errorCodes: [
        "TIMEOUT",
        "ECONNRESET",
        "EADDRINUSE",
        "ECONNREFUSED",
        "EPIPE",
        "ENOTFOUND",
        "ENETUNREACH",
        "EAI_AGAIN",
      ],
    },
    hooks: {
      beforeRetry: [
        (error: Error, retryCount: number) => {
          console.warn(
            `Discord webhook request failed, retrying (${retryCount}/2):`,
            error.message
          );
        },
      ],
    },
  };

  // Add optional username override
  if (config.options?.username) {
    const payloadWithUsername = {
      ...payload,
      username: config.options.username,
    };
    options.json = payloadWithUsername;
  }

  // Add optional avatar URL override
  if (config.options?.avatarUrl) {
    const payloadWithAvatar = {
      ...(options.json as DiscordWebhookPayload),
      avatar_url: config.options.avatarUrl,
    };
    options.json = payloadWithAvatar;
  }

  return createSuccess(options);
};

// Parse HTTP error response
const parseErrorResponse = (error: unknown): NotificationError => {
  const errorObj = error as Record<string, unknown>;
  // Handle network/connection errors
  if (errorObj.code) {
    return {
      type: "network_error",
      message: `Network error: ${errorObj.message || "Unknown error"}`,
      status: (errorObj.response as Record<string, unknown>)
        ?.statusCode as number,
    };
  }

  // Handle HTTP response errors
  if (errorObj.response) {
    const response = errorObj.response as Record<string, unknown>;
    const status = response.statusCode as number;
    let message = `HTTP ${status}`;

    try {
      const body = response.body;
      if (typeof body === "string") {
        const parsed = JSON.parse(body);
        if (parsed.message) {
          message += `: ${parsed.message}`;
        }
        if (parsed.code) {
          return {
            type: "discord_error",
            message,
            code: parsed.code,
          };
        }
      }
    } catch {
      // Unable to parse error response body
    }

    return {
      type: "network_error",
      message,
      status,
    };
  }

  // Generic error
  return {
    type: "network_error",
    message: (errorObj.message as string) || "Unknown network error",
  };
};

// Send Discord webhook notification
export const sendDiscordNotification = async (
  payload: DiscordWebhookPayload,
  config: DiscordNotifierConfig
): Promise<Result<void, NotificationError>> => {
  try {
    const optionsResult = createHttpOptions(config, payload);
    if (!optionsResult.success) {
      return optionsResult;
    }

    const response = await got(optionsResult.data);

    // Discord webhooks return 204 No Content on success
    if (response.statusCode === 204) {
      return createSuccess(undefined);
    }

    // Unexpected status code
    return createDiscordError(
      `Unexpected response status: ${response.statusCode}`
    );
  } catch (error) {
    return createError(parseErrorResponse(error));
  }
};

// Helper function to check webhook availability
export const testWebhook = async (
  config: DiscordNotifierConfig
): Promise<Result<void, NotificationError>> => {
  const testPayload: DiscordWebhookPayload = {
    content: "🧪 Amazon Ebook Scraper - Webhook test successful",
  };

  return sendDiscordNotification(testPayload, config);
};

// Batch send multiple notifications (useful for multiple products)
export const sendBatchNotifications = async (
  payloads: readonly DiscordWebhookPayload[],
  config: DiscordNotifierConfig,
  delayMs = 1000
): Promise<Result<undefined[], NotificationError[]>> => {
  const results: Result<void, NotificationError>[] = [];

  for (const payload of payloads) {
    const result = await sendDiscordNotification(payload, config);
    results.push(result);

    // Add delay between requests to avoid rate limiting
    if (delayMs > 0 && payloads.indexOf(payload) < payloads.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const successes = results
    .filter((r) => r.success)
    .map((r) => r.data as undefined);
  const errors = results.filter((r) => !r.success).map((r) => r.error);

  if (errors.length === 0) {
    return {
      success: true,
      data: successes,
    };
  }

  return {
    success: false,
    error: errors,
  };
};
