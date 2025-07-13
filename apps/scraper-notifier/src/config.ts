import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  DiscordNotifierConfig,
  NotificationError,
  Result,
  WebhookURL,
} from "@amazon-ebook-scraper/discord-notifier";
import { validateWebhookUrl } from "@amazon-ebook-scraper/discord-notifier";

// Configuration file schema
export interface ConfigFile {
  readonly discord: {
    readonly webhookUrl: string;
    readonly username?: string;
    readonly avatarUrl?: string;
    readonly timeout?: number;
  };
  readonly scraper?: {
    readonly timeout?: number;
    readonly retries?: number;
    readonly userAgent?: string;
  };
}

// CLI configuration that combines file and environment variables
export interface CLIConfig {
  readonly discord: DiscordNotifierConfig;
  readonly scraper: {
    readonly timeout: number;
    readonly retries: number;
    readonly userAgent: string;
  };
}

// Configuration error types
type ConfigError =
  | { type: "file_not_found"; path: string }
  | { type: "invalid_json"; message: string }
  | { type: "validation_error"; field: string; message: string }
  | { type: "missing_webhook_url" };

// Default scraper configuration
const DEFAULT_SCRAPER_CONFIG = {
  timeout: 10000,
  retries: 3,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
} as const;

// Functional helper: Create configuration error
const createConfigError = (error: ConfigError): NotificationError => {
  switch (error.type) {
    case "file_not_found":
      return {
        type: "validation_error",
        message: `Configuration file not found: ${error.path}`,
        field: "config_file",
      };
    case "invalid_json":
      return {
        type: "validation_error",
        message: `Invalid JSON in configuration file: ${error.message}`,
        field: "config_file",
      };
    case "validation_error":
      return {
        type: "validation_error",
        message: error.message,
        field: error.field,
      };
    case "missing_webhook_url":
      return {
        type: "validation_error",
        message:
          "Discord webhook URL is required. Set DISCORD_WEBHOOK_URL environment variable or add to config file.",
        field: "discord.webhookUrl",
      };
  }
};

// Functional helper: Load and parse JSON configuration file
const loadConfigFile = (configPath: string): Result<ConfigFile, ConfigError> => {
  try {
    const content = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    
    // Basic validation of config structure
    if (typeof parsed !== "object" || parsed === null) {
      return {
        success: false,
        error: { type: "validation_error", field: "root", message: "Configuration must be an object" },
      };
    }
    
    return { success: true, data: parsed as ConfigFile };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { success: false, error: { type: "file_not_found", path: configPath } };
    }
    
    return {
      success: false,
      error: { type: "invalid_json", message: (error as Error).message },
    };
  }
};

// Functional helper: Get webhook URL from environment or config
const getWebhookUrl = (configFile?: ConfigFile): Result<WebhookURL, ConfigError> => {
  // Try environment variable first
  const envWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (envWebhookUrl) {
    const validateResult = validateWebhookUrl(envWebhookUrl);
    if (validateResult.success) {
      return { success: true, data: validateResult.data };
    }
    return {
      success: false,
      error: {
        type: "validation_error",
        field: "DISCORD_WEBHOOK_URL",
        message: "Invalid webhook URL format in environment variable",
      },
    };
  }

  // Try config file
  if (configFile?.discord?.webhookUrl) {
    const validateResult = validateWebhookUrl(configFile.discord.webhookUrl);
    if (validateResult.success) {
      return { success: true, data: validateResult.data };
    }
    return {
      success: false,
      error: {
        type: "validation_error",
        field: "discord.webhookUrl",
        message: "Invalid webhook URL format in configuration file",
      },
    };
  }

  return { success: false, error: { type: "missing_webhook_url" } };
};

// Functional helper: Create Discord configuration
const createDiscordConfig = (
  webhookUrl: WebhookURL,
  configFile?: ConfigFile
): DiscordNotifierConfig => ({
  webhookUrl,
  options: {
    username: configFile?.discord?.username,
    avatarUrl: configFile?.discord?.avatarUrl,
    timeout: configFile?.discord?.timeout || 10000,
    allowMentions: false,
  },
});

// Functional helper: Create scraper configuration
const createScraperConfig = (configFile?: ConfigFile) => ({
  timeout: configFile?.scraper?.timeout || DEFAULT_SCRAPER_CONFIG.timeout,
  retries: configFile?.scraper?.retries || DEFAULT_SCRAPER_CONFIG.retries,
  userAgent: configFile?.scraper?.userAgent || DEFAULT_SCRAPER_CONFIG.userAgent,
});

// Main configuration loading function
export const loadConfig = (configPath?: string): Result<CLIConfig, NotificationError> => {
  // Load configuration file if path provided
  let configFile: ConfigFile | undefined;
  if (configPath) {
    const configResult = loadConfigFile(configPath);
    if (!configResult.success) {
      return { success: false, error: createConfigError(configResult.error) };
    }
    configFile = configResult.data;
  }

  // Get and validate webhook URL
  const webhookResult = getWebhookUrl(configFile);
  if (!webhookResult.success) {
    return { success: false, error: createConfigError(webhookResult.error) };
  }

  // Create final configuration
  const config: CLIConfig = {
    discord: createDiscordConfig(webhookResult.data, configFile),
    scraper: createScraperConfig(configFile),
  };

  return { success: true, data: config };
};

// Functional helper: Find default config file
export const findDefaultConfigFile = (): string | null => {
  const possiblePaths = [
    "./scraper-notifier.json",
    "./config.json",
    join(process.cwd(), "scraper-notifier.json"),
    join(process.cwd(), "config.json"),
  ];

  for (const path of possiblePaths) {
    try {
      readFileSync(path);
      return path;
    } catch {
      // Continue to next path
    }
  }

  return null;
};

// Create example configuration file content
export const createExampleConfig = (): string => JSON.stringify(
  {
    discord: {
      webhookUrl: "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN",
      username: "Amazon Ebook Notifier",
      timeout: 10000,
    },
    scraper: {
      timeout: 10000,
      retries: 3,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  },
  null,
  2
);