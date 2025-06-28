import type {
  DiscordEmbed,
  DiscordWebhookPayload,
  FormattedPrice,
  NotificationData,
  NotificationError,
  Result,
} from "./types";

// Color constants for Discord embeds
const DISCORD_COLORS = {
  SUCCESS: 0x00ff00, // Green
  INFO: 0x0099ff, // Blue
  WARNING: 0xffaa00, // Orange
  ERROR: 0xff0000, // Red
} as const;

// Format timestamp to ISO string
const formatTimestamp = (timestamp: number): string => {
  try {
    return new Date(timestamp * 1000).toISOString();
  } catch {
    return new Date().toISOString();
  }
};

// Format price with currency symbol and proper formatting
const formatPrice = (
  price: string
): Result<FormattedPrice, NotificationError> => {
  if (!price || typeof price !== "string") {
    return {
      success: false,
      error: {
        type: "formatting_error",
        message: "Price must be a non-empty string",
      },
    };
  }

  // Clean and format the price
  const cleanPrice = price.trim();

  if (cleanPrice.length === 0) {
    return {
      success: false,
      error: {
        type: "formatting_error",
        message: "Price cannot be empty",
      },
    };
  }

  return {
    success: true,
    data: cleanPrice as FormattedPrice,
  };
};

// Truncate text to Discord field value limit (1024 characters)
const truncateText = (text: string, maxLength = 1024): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
};

// Format product title with proper truncation
const formatTitle = (title: string): string => {
  const cleanTitle = title.trim();
  return truncateText(cleanTitle, 256); // Discord embed title limit
};

// Create Discord embed for product notification
const createProductEmbed = (
  data: NotificationData
): Result<DiscordEmbed, NotificationError> => {
  const { product, metadata } = data;

  const priceResult = formatPrice(product.price);
  if (!priceResult.success) {
    return priceResult;
  }

  const formattedTitle = formatTitle(product.title);
  const timestamp = formatTimestamp(product.timestamp);

  // Build fields array functionally
  const baseFields = [
    {
      name: "📚 商品名",
      value: formattedTitle,
      inline: false,
    },
    {
      name: "💰 価格",
      value: priceResult.data,
      inline: true,
    },
    {
      name: "🕒 取得時刻",
      value: `<t:${product.timestamp}:F>`,
      inline: true,
    },
  ];

  // Add optional metadata fields
  const additionalFields = [];

  if (metadata?.source) {
    additionalFields.push({
      name: "🔗 ソース",
      value: truncateText(metadata.source),
      inline: false,
    });
  }

  if (metadata?.url) {
    additionalFields.push({
      name: "🌐 URL",
      value: truncateText(metadata.url),
      inline: false,
    });
  }

  if (metadata?.description) {
    additionalFields.push({
      name: "📝 説明",
      value: truncateText(metadata.description),
      inline: false,
    });
  }

  const embed: DiscordEmbed = {
    title: "🛒 新しい商品が見つかりました",
    color: DISCORD_COLORS.INFO,
    timestamp,
    fields: [...baseFields, ...additionalFields],
    footer: {
      text: "Amazon Ebook Scraper",
      iconUrl:
        "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/amazon.svg",
    },
  };

  return {
    success: true,
    data: embed,
  };
};

// Main formatting function - transforms NotificationData to Discord payload
export const formatMessage = (
  data: NotificationData
): Result<DiscordWebhookPayload, NotificationError> => {
  if (data.type !== "product_found") {
    return {
      success: false,
      error: {
        type: "formatting_error",
        message: `Unsupported notification type: ${data.type}`,
      },
    };
  }

  const embedResult = createProductEmbed(data);
  if (!embedResult.success) {
    return embedResult;
  }

  const payload: DiscordWebhookPayload = {
    embeds: [embedResult.data],
  };

  return {
    success: true,
    data: payload,
  };
};

// Create simple text message (alternative format)
export const formatSimpleMessage = (
  data: NotificationData
): Result<DiscordWebhookPayload, NotificationError> => {
  if (data.type !== "product_found") {
    return {
      success: false,
      error: {
        type: "formatting_error",
        message: `Unsupported notification type: ${data.type}`,
      },
    };
  }

  const { product } = data;
  const priceResult = formatPrice(product.price);

  if (!priceResult.success) {
    return priceResult;
  }

  const formattedTitle = formatTitle(product.title);
  const timestamp = formatTimestamp(product.timestamp);

  const content = `🛒 **新しい商品**: ${formattedTitle}\n💰 **価格**: ${priceResult.data}\n🕒 **時刻**: ${timestamp}`;

  const payload: DiscordWebhookPayload = {
    content: truncateText(content, 2000), // Discord message content limit
  };

  return {
    success: true,
    data: payload,
  };
};
