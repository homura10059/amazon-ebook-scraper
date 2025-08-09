import type { Result, CliArguments, URL, CliError } from './types';

const isValidURL = (url: string): boolean => {
  try {
    new globalThis.URL(url);
    return url.includes('amazon');
  } catch {
    return false;
  }
};

const createURL = (input: string): Result<URL, string> =>
  isValidURL(input)
    ? { success: true, data: input as URL }
    : { success: false, error: `Invalid URL format: ${input}` };

export const parseArguments = (args: readonly string[]): Result<CliArguments, CliError> => {
  // Handle help flags
  if (args.includes('--help') || args.includes('-h')) {
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
      error: 'No URL arguments provided. Use --help for usage information.',
    };
  }

  // Parse URLs
  const urlResults: Result<URL, string>[] = args.map(createURL);
  
  // Check for any URL parsing errors
  const firstError = urlResults.find(result => !result.success);
  if (firstError && !firstError.success) {
    return {
      success: false,
      error: firstError.error,
    };
  }

  // Extract valid URLs
  const urls = urlResults
    .filter((result): result is { success: true; data: URL } => result.success)
    .map(result => result.data);

  return {
    success: true,
    data: {
      urls,
      help: false,
    },
  };
};