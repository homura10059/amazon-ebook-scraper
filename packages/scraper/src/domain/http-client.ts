/**
 * Type-safe HTTP client with functional error handling
 * Following Domain Modeling Made Functional principles
 */

import got, { type Got, type Options as GotOptions } from "got";
import { type Result, err, ok, tryCatchAsync } from "./result";
import { type AmazonURL, getAmazonURLValue } from "./value-objects";

/**
 * HTTP errors in domain terms
 */
export type HttpError =
  | { type: "NetworkError"; message: string; cause?: unknown }
  | { type: "TimeoutError"; message: string; timeout: number }
  | { type: "StatusError"; message: string; statusCode: number; url: string }
  | { type: "ParseError"; message: string; cause?: unknown }
  | { type: "UnknownError"; message: string; cause?: unknown };

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  readonly timeout: number;
  readonly userAgent: string;
  readonly maxRetries: number;
  readonly retryDelay: number;
}

/**
 * HTTP response wrapper
 */
export interface HttpResponse {
  readonly body: string;
  readonly statusCode: number;
  readonly url: string;
}

/**
 * Default HTTP client configuration
 */
const DEFAULT_CONFIG: HttpClientConfig = {
  timeout: 10000,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Create HTTP request options for Amazon scraping
 */
const createRequestOptions = (config: HttpClientConfig): GotOptions => ({
  timeout: { response: config.timeout },
  headers: {
    "User-Agent": config.userAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
  followRedirect: true,
  maxRedirects: 5,
  retry: {
    limit: 0, // We handle retries manually
  },
});

/**
 * Convert Got errors to domain HttpError
 */
const mapGotError = (error: unknown, url: string): HttpError => {
  if (typeof error !== "object" || error === null) {
    return {
      type: "UnknownError",
      message: `Unknown error occurred: ${String(error)}`,
      cause: error,
    };
  }

  const gotError = error as Record<string, unknown>;

  // Timeout error
  if (gotError.code === "ETIMEDOUT" || gotError.name === "TimeoutError") {
    return {
      type: "TimeoutError",
      message: `Request timeout for ${url}`,
      timeout: gotError.timeout || 0,
    };
  }

  // Network errors
  if (gotError.code === "ENOTFOUND" || gotError.code === "ECONNREFUSED") {
    return {
      type: "NetworkError",
      message: `Network error: ${gotError.message}`,
      cause: error,
    };
  }

  // HTTP status errors
  if (gotError.response && gotError.response.statusCode) {
    return {
      type: "StatusError",
      message: `HTTP ${gotError.response.statusCode}: ${gotError.message}`,
      statusCode: gotError.response.statusCode,
      url,
    };
  }

  // Parse errors
  if (gotError.name === "ParseError") {
    return {
      type: "ParseError",
      message: `Parse error: ${gotError.message}`,
      cause: error,
    };
  }

  // Fallback to unknown error
  return {
    type: "UnknownError",
    message: `HTTP request failed: ${gotError.message || String(error)}`,
    cause: error,
  };
};

/**
 * Create exponential backoff delay
 */
const createExponentialDelay = (
  attempt: number,
  baseDelay: number
): Promise<void> =>
  new Promise((resolve) =>
    setTimeout(resolve, Math.min(baseDelay * Math.pow(2, attempt), 30000))
  );

/**
 * Single HTTP request attempt
 */
const attemptRequest = async (
  url: string,
  options: GotOptions
): Promise<Result<HttpResponse, HttpError>> => {
  return tryCatchAsync(
    async () => {
      const response = await got(url, options);
      return {
        body: response.body,
        statusCode: response.statusCode,
        url: response.url,
      };
    },
    (error) => mapGotError(error, url)
  );
};

/**
 * Retry with exponential backoff
 */
const retryWithBackoff = async <T>(
  operation: () => Promise<Result<T, HttpError>>,
  maxRetries: number,
  baseDelay: number,
  currentAttempt = 0
): Promise<Result<T, HttpError>> => {
  const result = await operation();

  if (result.success || currentAttempt >= maxRetries) {
    return result;
  }

  // Don't retry certain error types
  if (
    result.error.type === "StatusError" &&
    result.error.statusCode >= 400 &&
    result.error.statusCode < 500
  ) {
    return result; // Client errors shouldn't be retried
  }

  // Apply exponential backoff
  await createExponentialDelay(currentAttempt, baseDelay);

  return retryWithBackoff(operation, maxRetries, baseDelay, currentAttempt + 1);
};

/**
 * HTTP Client implementation
 */
export class HttpClient {
  private readonly config: HttpClientConfig;
  private readonly gotInstance: Got;

  constructor(config: Partial<HttpClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.gotInstance = got.extend(createRequestOptions(this.config));
  }

  /**
   * Perform HTTP GET request with retry logic
   */
  async get(url: AmazonURL): Promise<Result<HttpResponse, HttpError>> {
    const urlString = getAmazonURLValue(url);

    return retryWithBackoff(
      () => attemptRequest(urlString, createRequestOptions(this.config)),
      this.config.maxRetries,
      this.config.retryDelay
    );
  }

  /**
   * Get current configuration
   */
  getConfig(): HttpClientConfig {
    return { ...this.config };
  }

  /**
   * Create new client with updated configuration
   */
  withConfig(newConfig: Partial<HttpClientConfig>): HttpClient {
    return new HttpClient({ ...this.config, ...newConfig });
  }
}

/**
 * Create default HTTP client instance
 */
export const createHttpClient = (
  config?: Partial<HttpClientConfig>
): HttpClient => new HttpClient(config);

/**
 * Functional helper: Check if error is retryable
 */
export const isRetryableError = (error: HttpError): boolean => {
  switch (error.type) {
    case "NetworkError":
    case "TimeoutError":
      return true;
    case "StatusError":
      // Retry server errors (5xx) but not client errors (4xx)
      return error.statusCode >= 500;
    case "ParseError":
    case "UnknownError":
      return false;
    default:
      return false;
  }
};

/**
 * Functional helper: Format error for logging
 */
export const formatHttpError = (error: HttpError): string => {
  switch (error.type) {
    case "NetworkError":
      return `Network error: ${error.message}`;
    case "TimeoutError":
      return `Timeout error: ${error.message} (${error.timeout}ms)`;
    case "StatusError":
      return `HTTP ${error.statusCode} error: ${error.message}`;
    case "ParseError":
      return `Parse error: ${error.message}`;
    case "UnknownError":
      return `Unknown error: ${error.message}`;
    default:
      return `Unhandled error: ${JSON.stringify(error)}`;
  }
};
