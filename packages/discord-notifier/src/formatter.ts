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

// Create Discord embed for a single product
const createSingleProductEmbed = (
  product: import("./types").ScrapedProduct,
  metadata?: import("./types").NotificationMetadata,
  index?: number
): Result<DiscordEmbed, NotificationError> => {
  const priceResult = formatPrice(product.price);
  if (!priceResult.success) {
    return priceResult;
  }

  const formattedTitle = formatTitle(product.title);
  const timestamp = formatTimestamp(product.timestamp);

  const embed: DiscordEmbed = {
    title:
      index !== undefined
        ? `🛒 新しい商品が見つかりました #${index + 1}`
        : "🛒 新しい商品が見つかりました",
    color: DISCORD_COLORS.INFO,
    timestamp,
    fields: [
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
    ],
    footer: {
      text: "Amazon Ebook Scraper",
      iconUrl:
        "https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@v9/icons/amazon.svg",
    },
  };

  // Add optional metadata fields functionally
  let fields = embed.fields ?? [];

  if (metadata?.source) {
    fields = [
      ...fields,
      {
        name: "🔗 ソース",
        value: truncateText(metadata.source),
        inline: false,
      },
    ];
  }

  if (metadata?.url) {
    fields = [
      ...fields,
      {
        name: "🌐 URL",
        value: truncateText(metadata.url),
        inline: false,
      },
    ];
  }

  if (metadata?.description) {
    fields = [
      ...fields,
      {
        name: "📝 説明",
        value: truncateText(metadata.description),
        inline: false,
      },
    ];
  }

  // Create final embed with updated fields
  const finalEmbed: DiscordEmbed = {
    ...embed,
    fields,
  };

  return {
    success: true,
    data: finalEmbed,
  };
};

// Create Discord embeds for multiple products
const createProductEmbeds = (
  data: NotificationData
): Result<DiscordEmbed[], NotificationError> => {
  const { product: products, metadata } = data;

  const embeds: DiscordEmbed[] = [];

  for (let i = 0; i < products.length; i++) {
    const embedResult = createSingleProductEmbed(
      products[i],
      metadata,
      products.length > 1 ? i : undefined
    );
    if (!embedResult.success) {
      return embedResult;
    }
    embeds.push(embedResult.data);
  }

  return {
    success: true,
    data: embeds,
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

  const embedsResult = createProductEmbeds(data);
  if (!embedsResult.success) {
    return embedsResult;
  }

  const payload: DiscordWebhookPayload = {
    embeds: embedsResult.data,
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

  const { product: products } = data;

  const productMessages: string[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const priceResult = formatPrice(product.price);

    if (!priceResult.success) {
      return priceResult;
    }

    const formattedTitle = formatTitle(product.title);
    const timestamp = formatTimestamp(product.timestamp);

    const productMessage =
      products.length > 1
        ? `🛒 **新しい商品 #${i + 1}**: ${formattedTitle}\n💰 **価格**: ${priceResult.data}\n🕒 **時刻**: ${timestamp}`
        : `🛒 **新しい商品**: ${formattedTitle}\n💰 **価格**: ${priceResult.data}\n🕒 **時刻**: ${timestamp}`;

    productMessages.push(productMessage);
  }

  const content = productMessages.join("\n\n");

  const payload: DiscordWebhookPayload = {
    content: truncateText(content, 2000), // Discord message content limit
  };

  return {
    success: true,
    data: payload,
  };
};
