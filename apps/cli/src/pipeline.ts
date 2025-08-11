import type { ScrapedProduct } from "@amazon-ebook-scraper/scraper";
import { scrapeAmazonProduct } from "@amazon-ebook-scraper/scraper";
import type {
  DiscordNotifierConfig,
  NotificationData,
  NotificationError,
  Result,
} from "@amazon-ebook-scraper/discord-notifier";
import {
  createDiscordNotifier,
  createNotificationPipeline,
} from "@amazon-ebook-scraper/discord-notifier";

// Domain types for the pipeline
export type URL = string & { readonly _brand: "URL" };
export type DelayMs = number & { readonly _brand: "DelayMs" };

// Pipeline configuration
export interface PipelineConfig {
  readonly discord: DiscordNotifierConfig;
  readonly scraper?: {
    readonly timeout?: number;
    readonly retries?: number;
    readonly delayBetweenRequests?: DelayMs;
  };
}

// Pipeline error types
export type PipelineError =
  | { type: "scraping_error"; message: string; url: string }
  | { type: "notification_error"; message: string; url: string }
  | { type: "config_error"; message: string }
  | { type: "validation_error"; message: string };

// Pipeline result for single URL processing
export interface ProcessResult {
  readonly url: string;
  readonly success: boolean;
  readonly data?: ScrapedProduct;
  readonly error?: PipelineError;
}

// Batch processing result
export interface BatchProcessResult {
  readonly total: number;
  readonly successful: number;
  readonly failed: number;
  readonly results: readonly ProcessResult[];
}

// Helper functions following functional programming principles
const createSuccess = <T>(data: T): Result<T, PipelineError> => ({
  success: true,
  data,
});

const createPipelineError = (
  type: PipelineError["type"],
  message: string,
  url?: string
): Result<never, PipelineError> => ({
  success: false,
  error: { type, message, url: url || "" } as PipelineError,
});

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Validate URL format (basic Amazon URL validation)
const validateUrl = (url: string): Result<URL, PipelineError> => {
  if (!url || typeof url !== "string") {
    return createPipelineError("validation_error", "URL must be a non-empty string");
  }
  
  if (!url.includes("amazon.co.jp")) {
    return createPipelineError("validation_error", "URL must be from amazon.co.jp domain", url);
  }
  
  return createSuccess(url as URL);
};

// Validate pipeline configuration
const validatePipelineConfig = (config: unknown): Result<PipelineConfig, PipelineError> => {
  if (!config || typeof config !== "object" || config === null) {
    return createPipelineError("config_error", "Config must be a non-null object");
  }
  
  const cfg = config as Record<string, unknown>;
  
  if (!cfg.discord || typeof cfg.discord !== "object" || cfg.discord === null) {
    return createPipelineError("config_error", "Discord configuration is required");
  }
  
  return createSuccess(config as PipelineConfig);
};

// Create notification data from scraped product
const createNotificationData = (
  product: ScrapedProduct,
  url: string
): NotificationData => ({
  type: "product_found",
  product: [product],
  metadata: {
    source: "amazon-ebook-scraper",
    url,
    description: `Found product: ${product.title}`,
  },
});

// Single URL processing with error handling
export const processUrl = async (
  url: string,
  config: PipelineConfig
): Promise<ProcessResult> => {
  // Validate URL
  const urlResult = validateUrl(url);
  if (!urlResult.success) {
    return {
      url,
      success: false,
      error: urlResult.error,
    };
  }

  try {
    // Scrape product
    const scrapedProduct = await scrapeAmazonProduct(url, config.scraper);
    
    // Create notification data
    const notificationData = createNotificationData(scrapedProduct, url);
    
    // Send notification
    const notificationPipeline = createNotificationPipeline(config.discord);
    const notificationResult = await notificationPipeline(notificationData);
    
    if (!notificationResult.success) {
      return {
        url,
        success: false,
        data: scrapedProduct,
        error: {
          type: "notification_error",
          message: `Failed to send notification: ${notificationResult.error.message}`,
          url,
        },
      };
    }
    
    return {
      url,
      success: true,
      data: scrapedProduct,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown scraping error";
    return {
      url,
      success: false,
      error: {
        type: "scraping_error",
        message: errorMessage,
        url,
      },
    };
  }
};

// Batch processing with delay between requests
export const processBatch = async (
  urls: readonly string[],
  config: PipelineConfig
): Promise<BatchProcessResult> => {
  const results: ProcessResult[] = [];
  const delayMs = config.scraper?.delayBetweenRequests || (1000 as DelayMs);
  
  for (const [index, url] of urls.entries()) {
    // Add delay between requests (except for the first one)
    if (index > 0) {
      await delay(delayMs);
    }
    
    const result = await processUrl(url, config);
    results.push(result);
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  return {
    total: results.length,
    successful,
    failed,
    results,
  };
};

// Test pipeline configuration
export const testPipelineConfig = async (
  config: PipelineConfig
): Promise<Result<void, PipelineError>> => {
  // Validate configuration
  const configResult = validatePipelineConfig(config);
  if (!configResult.success) {
    return configResult;
  }
  
  // Test Discord notifier
  const notifierResult = createDiscordNotifier(config.discord);
  if (!notifierResult.success) {
    return createPipelineError(
      "config_error",
      `Discord notifier validation failed: ${notifierResult.error.message}`
    );
  }
  
  // Test webhook connection
  const connectionResult = await notifierResult.data.testConnection();
  if (!connectionResult.success) {
    return createPipelineError(
      "config_error", 
      `Discord webhook test failed: ${connectionResult.error.message}`
    );
  }
  
  return createSuccess(undefined);
};

// High-level pipeline API
export interface NotificationPipeline {
  readonly processUrl: (url: string) => Promise<ProcessResult>;
  readonly processBatch: (urls: readonly string[]) => Promise<BatchProcessResult>;
  readonly testConfig: () => Promise<Result<void, PipelineError>>;
  readonly getConfig: () => PipelineConfig;
}

// Factory function to create pipeline instance
export const createNotificationScraper = (
  config: PipelineConfig
): Result<NotificationPipeline, PipelineError> => {
  const configResult = validatePipelineConfig(config);
  if (!configResult.success) {
    return configResult;
  }
  
  const validatedConfig = configResult.data;
  
  const pipeline: NotificationPipeline = {
    processUrl: (url: string) => processUrl(url, validatedConfig),
    processBatch: (urls: readonly string[]) => processBatch(urls, validatedConfig),
    testConfig: () => testPipelineConfig(validatedConfig),
    getConfig: () => validatedConfig,
  };
  
  return createSuccess(pipeline);
};