import type {
  DiscordNotifierConfig,
  NotificationData,
  NotificationError,
  Result,
} from "@amazon-ebook-scraper/discord-notifier";
import { createDiscordNotifier } from "@amazon-ebook-scraper/discord-notifier";
import type {
  ScrapedProduct,
  ScraperOptions,
} from "@amazon-ebook-scraper/scraper";
import { scrapeAmazonProduct } from "@amazon-ebook-scraper/scraper";
import type { CLIConfig } from "./config";

// Pipeline result types
export type PipelineResult = Result<ScrapedProduct, PipelineError>;

export type PipelineError =
  | { type: "scraper_error"; message: string; url?: string; status?: number }
  | { type: "notification_error"; error: NotificationError }
  | { type: "validation_error"; message: string; field?: string };

// Pipeline options
export interface PipelineOptions {
  readonly notifyOnSuccess?: boolean;
  readonly notifyOnError?: boolean;
  readonly metadata?: {
    readonly source?: string;
    readonly description?: string;
  };
}

// Default pipeline options
const DEFAULT_PIPELINE_OPTIONS: Required<PipelineOptions> = {
  notifyOnSuccess: true,
  notifyOnError: false,
  metadata: {},
} as const;

// Functional helper: Convert scraper error to pipeline error
const convertScraperError = (error: unknown, url: string): PipelineError => {
  const scraperError = error as any;
  return {
    type: "scraper_error",
    message: scraperError.message || "Unknown scraper error",
    url: scraperError.url || url,
    status: scraperError.status,
  };
};

// Functional helper: Convert notification error to pipeline error
const convertNotificationError = (error: NotificationError): PipelineError => ({
  type: "notification_error",
  error,
});

// Functional helper: Validate Amazon URL
const validateAmazonUrl = (url: string): Result<string, PipelineError> => {
  if (!url || typeof url !== "string") {
    return {
      success: false,
      error: {
        type: "validation_error",
        message: "URL must be a non-empty string",
        field: "url",
      },
    };
  }

  if (!url.includes("amazon.co.jp")) {
    return {
      success: false,
      error: {
        type: "validation_error",
        message: "URL must be from amazon.co.jp domain",
        field: "url",
      },
    };
  }

  return { success: true, data: url };
};

// Functional helper: Create notification data from scraped product
const createNotificationData = (
  product: ScrapedProduct,
  url: string,
  metadata?: PipelineOptions["metadata"]
): NotificationData => ({
  type: "product_found",
  product: [product],
  metadata: {
    source: "CLI",
    url,
    description: metadata?.description || `Product scraped from ${url}`,
    ...metadata,
  },
});

// Functional helper: Scrape product with error conversion
const scrapeProduct = async (
  url: string,
  scraperOptions: ScraperOptions
): Promise<Result<ScrapedProduct, PipelineError>> => {
  try {
    const product = await scrapeAmazonProduct(url, scraperOptions);
    return { success: true, data: product };
  } catch (error) {
    return { success: false, error: convertScraperError(error, url) };
  }
};

// Functional helper: Send notification with error conversion
const sendNotification = async (
  data: NotificationData,
  config: DiscordNotifierConfig
): Promise<Result<void, PipelineError>> => {
  const notifierResult = createDiscordNotifier(config);
  if (!notifierResult.success) {
    return {
      success: false,
      error: convertNotificationError(notifierResult.error),
    };
  }

  const sendResult = await notifierResult.data.sendProductNotification(data);
  if (!sendResult.success) {
    return {
      success: false,
      error: convertNotificationError(sendResult.error),
    };
  }

  return { success: true, data: undefined };
};

// Main pipeline function: scrape → validate → notify
export const runScrapingPipeline = async (
  url: string,
  config: CLIConfig,
  options: PipelineOptions = {}
): Promise<PipelineResult> => {
  const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };

  // Step 1: Validate URL
  const urlResult = validateAmazonUrl(url);
  if (!urlResult.success) {
    return urlResult;
  }

  // Step 2: Scrape product
  const scrapeResult = await scrapeProduct(urlResult.data, config.scraper);
  if (!scrapeResult.success) {
    // Optionally send error notification
    if (opts.notifyOnError) {
      // Create error notification data (simplified)
      const errorData: NotificationData = {
        type: "product_found",
        product: [],
        metadata: {
          source: "CLI",
          url: urlResult.data,
          description: `Scraping failed: ${scrapeResult.error.message}`,
          ...opts.metadata,
        },
      };

      // Send error notification (fire and forget)
      sendNotification(errorData, config.discord).catch(() => {
        // Ignore notification errors for error notifications
      });
    }

    return scrapeResult;
  }

  // Step 3: Send success notification (if enabled)
  if (opts.notifyOnSuccess) {
    const notificationData = createNotificationData(
      scrapeResult.data,
      urlResult.data,
      opts.metadata
    );

    const notifyResult = await sendNotification(
      notificationData,
      config.discord
    );
    if (!notifyResult.success) {
      // Return the scraped product but log that notification failed
      console.warn(
        "Product scraped successfully but notification failed:",
        notifyResult.error
      );
    }
  }

  return scrapeResult;
};

// Batch processing: scrape multiple URLs
export const runBatchScrapingPipeline = async (
  urls: readonly string[],
  config: CLIConfig,
  options: PipelineOptions = {}
): Promise<{
  readonly results: readonly PipelineResult[];
  readonly summary: {
    readonly total: number;
    readonly successful: number;
    readonly failed: number;
  };
}> => {
  const results: PipelineResult[] = [];

  // Process URLs sequentially to avoid overwhelming the server
  for (const url of urls) {
    try {
      const result = await runScrapingPipeline(url, config, options);
      results.push(result);

      // Add delay between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      results.push({
        success: false,
        error: {
          type: "scraper_error",
          message: `Unexpected error processing ${url}: ${(error as Error).message}`,
          url,
        },
      });
    }
  }

  // Calculate summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;

  return {
    results,
    summary: {
      total: results.length,
      successful,
      failed,
    },
  };
};

// Test Discord webhook connection
export const testDiscordConnection = async (
  config: CLIConfig
): Promise<Result<void, PipelineError>> => {
  const notifierResult = createDiscordNotifier(config.discord);
  if (!notifierResult.success) {
    return {
      success: false,
      error: convertNotificationError(notifierResult.error),
    };
  }

  const testResult = await notifierResult.data.testConnection();
  if (!testResult.success) {
    return {
      success: false,
      error: convertNotificationError(testResult.error),
    };
  }

  return { success: true, data: undefined };
};

// Format pipeline error for display
export const formatPipelineError = (error: PipelineError): string => {
  switch (error.type) {
    case "scraper_error":
      return `Scraping failed: ${error.message}${error.url ? ` (URL: ${error.url})` : ""}${error.status ? ` (Status: ${error.status})` : ""}`;
    case "notification_error":
      return `Notification failed: ${error.error.message}`;
    case "validation_error":
      return `Validation failed: ${error.message}${error.field ? ` (Field: ${error.field})` : ""}`;
  }
};
