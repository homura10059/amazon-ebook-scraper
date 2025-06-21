export interface ScrapedProduct {
  title: string;
  price: string;
  timestamp: number; // Unix timestamp
}

export interface ScraperOptions {
  timeout?: number;
  userAgent?: string;
  retries?: number;
}

export interface ScraperError extends Error {
  url?: string;
  status?: number;
}
