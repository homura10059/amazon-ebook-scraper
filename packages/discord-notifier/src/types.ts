// Branded types for type safety
export type WebhookURL = string & { readonly _brand: "WebhookURL" };
export type DiscordMessage = string & { readonly _brand: "DiscordMessage" };
export type FormattedPrice = string & { readonly _brand: "FormattedPrice" };
export type Timestamp = number & { readonly _brand: "Timestamp" };

// Result type for operations that can fail
export type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

// Scraper interface - matches ScrapedProduct from scraper package
export interface ScrapedProduct {
  readonly title: string;
  readonly price: string;
  readonly timestamp: number;
}

// Notification data structure
export interface NotificationData {
  readonly type: "product_found";
  readonly product: ScrapedProduct;
  readonly metadata?: NotificationMetadata;
}

// Optional metadata for notifications
export interface NotificationMetadata {
  readonly source?: string;
  readonly url?: string;
  readonly description?: string;
}

// Discord-specific configuration
export interface DiscordNotifierConfig {
  readonly webhookUrl: WebhookURL;
  readonly options?: DiscordOptions;
}

// Discord webhook options
export interface DiscordOptions {
  readonly username?: string;
  readonly avatarUrl?: string;
  readonly allowMentions?: boolean;
  readonly timeout?: number;
}

// Discord embed structure
export interface DiscordEmbed {
  readonly title?: string;
  readonly description?: string;
  readonly color?: number;
  readonly timestamp?: string;
  readonly fields?: readonly DiscordEmbedField[];
  readonly footer?: DiscordEmbedFooter;
}

export interface DiscordEmbedField {
  readonly name: string;
  readonly value: string;
  readonly inline?: boolean;
}

export interface DiscordEmbedFooter {
  readonly text: string;
  readonly iconUrl?: string;
}

// Discord webhook payload
export interface DiscordWebhookPayload {
  readonly content?: string;
  readonly username?: string;
  readonly avatarUrl?: string;
  readonly embeds?: readonly DiscordEmbed[];
}

// Error types
export type NotificationError =
  | { type: "validation_error"; message: string; field?: string }
  | { type: "network_error"; message: string; status?: number }
  | { type: "discord_error"; message: string; code?: string }
  | { type: "formatting_error"; message: string };

// Function types
export type FormatMessage = (
  data: NotificationData
) => Result<DiscordWebhookPayload, NotificationError>;
export type SendNotification = (
  payload: DiscordWebhookPayload,
  config: DiscordNotifierConfig
) => Promise<Result<void, NotificationError>>;
export type ValidateWebhookUrl = (
  url: string
) => Result<WebhookURL, NotificationError>;
