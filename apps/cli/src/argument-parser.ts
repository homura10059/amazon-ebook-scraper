import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { CliArguments, CliError, Result, URL } from "./types";

const isValidURL = (url: string): boolean => {
  try {
    new globalThis.URL(url);
    return url.includes("amazon");
  } catch {
    return false;
  }
};

const createURL = (input: string): Result<URL, string> =>
  isValidURL(input)
    ? { success: true, data: input as URL }
    : { success: false, error: `Invalid URL format: ${input}` };

const validateUrls = (urls: string[]): Result<URL[], string> => {
  const urlResults: Result<URL, string>[] = urls.map(createURL);

  // Check for any URL parsing errors
  const firstError = urlResults.find((result) => !result.success);
  if (firstError && !firstError.success) {
    return {
      success: false,
      error: firstError.error,
    };
  }

  // Extract valid URLs
  const validUrls = urlResults
    .filter((result): result is { success: true; data: URL } => result.success)
    .map((result) => result.data);

  return {
    success: true,
    data: validUrls,
  };
};

export const createYargsParser = () => {
  return yargs(hideBin(process.argv))
    .scriptName("amazon-ebook-scraper")
    .usage(
      "$0 <urls..>",
      "Scrapes Amazon product information and sends notifications",
      (yargs) => {
        return yargs.positional("urls", {
          describe: "Amazon product URLs to scrape",
          type: "string",
          array: true,
          demandOption: true,
        });
      }
    )
    .example(
      "$0 https://amazon.co.jp/dp/123456789",
      "Scrape a single Amazon product"
    )
    .example(
      "$0 https://amazon.co.jp/dp/123 https://amazon.co.jp/dp/456",
      "Scrape multiple Amazon products"
    )
    .help("h")
    .alias("h", "help")
    .version("1.0.0")
    .strict();
};

// For testing: create a parser that doesn't interfere with process.exit or help
export const createTestYargsParser = (args: readonly string[]) => {
  return yargs(args as string[])
    .scriptName("amazon-ebook-scraper")
    .usage(
      "$0 <urls..>",
      "Scrapes Amazon product information and sends notifications"
    )
    .help(false) // Disable help to prevent output in tests
    .version(false) // Disable version
    .exitProcess(false) // Prevent process.exit
    .strict(false); // Don't be strict in tests to avoid validation errors
};

export const parseArguments = (
  args: readonly string[]
): Result<CliArguments, CliError> => {
  try {
    // Handle help flags early for test compatibility
    if (args.includes("--help") || args.includes("-h")) {
      return {
        success: true,
        data: {
          urls: [],
          help: true,
        },
      };
    }

    // Handle empty arguments
    if (args.length === 0) {
      return {
        success: false,
        error: "No URL arguments provided. Use --help for usage information.",
      };
    }

    // For non-help cases, treat all arguments as URLs (yargs-style)
    const urlStrings = [...args];

    // Validate URLs
    const urlsResult = validateUrls(urlStrings);
    if (!urlsResult.success) {
      return {
        success: false,
        error: urlsResult.error,
      };
    }

    return {
      success: true,
      data: {
        urls: urlsResult.data,
        help: false,
      },
    };
  } catch (error) {
    // Handle parsing errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
};
