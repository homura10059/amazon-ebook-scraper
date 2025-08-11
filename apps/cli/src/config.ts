import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  DiscordNotifierConfig,
  WebhookURL,
} from "@amazon-ebook-scraper/discord-notifier";
import { validateWebhookUrl } from "@amazon-ebook-scraper/discord-notifier";
import type { PipelineConfig, PipelineError } from "./pipeline";

// Re-export for testing
export type { PipelineConfig } from "./pipeline";

// Configuration file structure
export interface ConfigFile {
  readonly discord: {
    readonly webhookUrl: string;
    readonly options?: {
      readonly username?: string;
      readonly avatarUrl?: string;
      readonly allowMentions?: boolean;
      readonly timeout?: number;
    };
  };
  readonly scraper?: {
    readonly timeout?: number;
    readonly retries?: number;
    readonly delayBetweenRequests?: number;
  };
}

// Environment variable keys
export const ENV_KEYS = {
  DISCORD_WEBHOOK_URL: "DISCORD_WEBHOOK_URL",
  SCRAPER_TIMEOUT: "SCRAPER_TIMEOUT",
  SCRAPER_RETRIES: "SCRAPER_RETRIES",
  SCRAPER_DELAY: "SCRAPER_DELAY",
} as const;

// Default configuration values
export const DEFAULT_CONFIG: Partial<PipelineConfig> = {
  scraper: {
    timeout: 10000,
    retries: 3,
    delayBetweenRequests: 1000 as any, // DelayMs branded type
  },
};

// Result type for configuration operations
export type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

// Helper functions
const createSuccess = <T>(data: T): Result<T, PipelineError> => ({
  success: true,
  data,
});

const createConfigError = (message: string): Result<never, PipelineError> => ({
  success: false,
  error: { type: "config_error", message },
});

// Environment variable parsing
const parseEnvNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

// Load configuration from environment variables
const loadEnvironmentConfig = (): Partial<ConfigFile> => {
  const config: Partial<ConfigFile> = {};
  
  // Discord configuration
  const webhookUrl = process.env[ENV_KEYS.DISCORD_WEBHOOK_URL];
  if (webhookUrl) {
    config.discord = {
      webhookUrl,
    };
  }
  
  // Scraper configuration
  const timeout = parseEnvNumber(process.env[ENV_KEYS.SCRAPER_TIMEOUT], DEFAULT_CONFIG.scraper!.timeout!);
  const retries = parseEnvNumber(process.env[ENV_KEYS.SCRAPER_RETRIES], DEFAULT_CONFIG.scraper!.retries!);
  const delayBetweenRequests = parseEnvNumber(
    process.env[ENV_KEYS.SCRAPER_DELAY],
    DEFAULT_CONFIG.scraper!.delayBetweenRequests as number
  );
  
  config.scraper = {
    timeout,
    retries,
    delayBetweenRequests,
  };
  
  return config;
};

// Load configuration from JSON file
const loadJsonConfig = async (filePath: string): Promise<Result<Partial<ConfigFile>, PipelineError>> => {
  try {
    const absolutePath = resolve(filePath);
    const fileContent = await readFile(absolutePath, "utf-8");
    const jsonData = JSON.parse(fileContent);
    return createSuccess(jsonData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown file error";
    return createConfigError(`Failed to load config file '${filePath}': ${message}`);
  }
};

// Validate and normalize configuration
const validateConfigFile = (config: Partial<ConfigFile>): Result<ConfigFile, PipelineError> => {
  // Validate Discord configuration
  if (!config.discord?.webhookUrl) {
    return createConfigError(
      "Discord webhook URL is required. Set DISCORD_WEBHOOK_URL environment variable or provide it in config file."
    );
  }
  
  const webhookValidation = validateWebhookUrl(config.discord.webhookUrl);
  if (!webhookValidation.success) {
    return createConfigError(`Invalid Discord webhook URL: ${webhookValidation.error.message}`);
  }
  
  // Create validated configuration
  const validatedConfig: ConfigFile = {
    discord: {
      webhookUrl: config.discord.webhookUrl,
      options: config.discord.options,
    },
    scraper: {
      timeout: config.scraper?.timeout ?? DEFAULT_CONFIG.scraper!.timeout,
      retries: config.scraper?.retries ?? DEFAULT_CONFIG.scraper!.retries,
      delayBetweenRequests: config.scraper?.delayBetweenRequests ?? (DEFAULT_CONFIG.scraper!.delayBetweenRequests as number),
    },
  };
  
  return createSuccess(validatedConfig);
};

// Convert ConfigFile to PipelineConfig
const toPipelineConfig = (config: ConfigFile): Result<PipelineConfig, PipelineError> => {
  const webhookValidation = validateWebhookUrl(config.discord.webhookUrl);
  if (!webhookValidation.success) {
    return createConfigError(`Invalid webhook URL: ${webhookValidation.error.message}`);
  }
  
  const discordConfig: DiscordNotifierConfig = {
    webhookUrl: webhookValidation.data,
    options: config.discord.options,
  };
  
  const pipelineConfig: PipelineConfig = {
    discord: discordConfig,
    scraper: {
      timeout: config.scraper?.timeout,
      retries: config.scraper?.retries,
      delayBetweenRequests: config.scraper?.delayBetweenRequests as any, // DelayMs branded type
    },
  };
  
  return createSuccess(pipelineConfig);
};

// Main configuration loading function
export const loadConfig = async (configFilePath?: string): Promise<Result<PipelineConfig, PipelineError>> => {
  // Start with default configuration
  let mergedConfig: Partial<ConfigFile> = {
    scraper: DEFAULT_CONFIG.scraper,
  };
  
  // Load environment configuration
  const envConfig = loadEnvironmentConfig();
  mergedConfig = { ...mergedConfig, ...envConfig };
  
  // Load JSON configuration if provided
  if (configFilePath) {
    const jsonConfigResult = await loadJsonConfig(configFilePath);
    if (!jsonConfigResult.success) {
      return jsonConfigResult;
    }
    
    // Merge JSON config (JSON takes precedence)
    mergedConfig = {
      ...mergedConfig,
      ...jsonConfigResult.data,
      discord: {
        ...mergedConfig.discord,
        ...jsonConfigResult.data.discord,
      },
      scraper: {
        ...mergedConfig.scraper,
        ...jsonConfigResult.data.scraper,
      },
    };
  }
  
  // Validate merged configuration
  const validationResult = validateConfigFile(mergedConfig);
  if (!validationResult.success) {
    return validationResult;
  }
  
  // Convert to pipeline configuration
  return toPipelineConfig(validationResult.data);
};

// Configuration validation helper
export const validateConfig = async (configFilePath?: string): Promise<Result<void, PipelineError>> => {
  const configResult = await loadConfig(configFilePath);
  if (!configResult.success) {
    return configResult;
  }
  
  return createSuccess(undefined);
};

// Get configuration summary for display
export const getConfigSummary = (config: PipelineConfig): Record<string, unknown> => {
  return {
    discord: {
      webhookUrl: config.discord.webhookUrl.replace(/\/[^/]+$/, "/***"), // Hide token
      username: config.discord.options?.username || "default",
      timeout: config.discord.options?.timeout || "default",
    },
    scraper: {
      timeout: config.scraper?.timeout || DEFAULT_CONFIG.scraper!.timeout,
      retries: config.scraper?.retries || DEFAULT_CONFIG.scraper!.retries,
      delayBetweenRequests: config.scraper?.delayBetweenRequests || (DEFAULT_CONFIG.scraper!.delayBetweenRequests as number),
    },
  };
};