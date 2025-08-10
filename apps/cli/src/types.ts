// Domain types for CLI application
export type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

export type URL = string & { readonly _brand: "URL" };

export interface CliArguments {
  readonly urls: readonly URL[];
  readonly help: boolean;
}

export interface CliOptions {
  readonly urls: readonly URL[];
  readonly help: boolean;
}

export type CliError = string;
