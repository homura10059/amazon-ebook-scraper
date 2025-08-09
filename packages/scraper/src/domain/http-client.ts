import got from "got";
import type { ScraperOptions } from "../types";
import type { AmazonURL } from "./value-objects";

type Result<T, E> = { success: true; data: T } | { success: false; error: E };

export interface HttpClientOptions {
  readonly timeout: number;
  readonly userAgent: string;
}

export interface HttpResponse {
  readonly body: string;
}

export interface HttpError extends Error {
  readonly statusCode?: number;
}

const createRequestOptions = (options: HttpClientOptions) => ({
  timeout: { response: options.timeout },
  headers: {
    "User-Agent": options.userAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  },
});

const createHttpError = (error: unknown): HttpError => {
  const httpError = error as Error & {
    response?: { statusCode?: number };
    message?: string;
  };
  const enhancedError = new Error(httpError.message || "HTTP Error");

  const result = httpError.response?.statusCode
    ? Object.assign(enhancedError, {
        statusCode: httpError.response.statusCode,
      })
    : enhancedError;

  return result as HttpError;
};

export const fetchPage = async (
  url: AmazonURL,
  options: HttpClientOptions
): Promise<Result<HttpResponse, HttpError>> => {
  try {
    const requestOptions = createRequestOptions(options);
    const response = await got(url, requestOptions);
    return { success: true, data: { body: response.body } };
  } catch (error) {
    return { success: false, error: createHttpError(error) };
  }
};

export const createHttpClientOptions = (
  scraperOptions: ScraperOptions
): HttpClientOptions => ({
  timeout: scraperOptions.timeout ?? 10000,
  userAgent:
    scraperOptions.userAgent ??
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
});
