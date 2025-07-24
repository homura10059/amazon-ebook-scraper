/**
 * Domain layer exports
 * Following Domain Modeling Made Functional principles
 */

// Result types and functional utilities
export * from "./result";

// Value objects and domain types
export * from "./value-objects";
export * from "./product";

// Infrastructure services
export * from "./http-client";
export * from "./html-parser";
export * from "./scraper-service";

// Re-export key types for convenience
export type {
  Result,
  Success,
  Failure,
} from "./result";

export type {
  AmazonURL,
  ProductTitle,
  ProductPrice,
  ValidationError,
} from "./value-objects";

export type {
  Product,
  RawProductData,
  ProductCreationError,
} from "./product";

export type {
  HttpError,
  HttpClientConfig,
  HttpResponse,
} from "./http-client";

export type {
  ParsingError,
  ParsedProductData,
} from "./html-parser";

export type {
  ScraperError,
  ScraperServiceConfig,
} from "./scraper-service";
