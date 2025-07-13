import type { NotificationError, Result } from "./types";

// Helper functions to reduce Result type boilerplate

/**
 * Create a successful Result
 */
export const createSuccess = <T>(data: T): Result<T, NotificationError> => ({
  success: true,
  data,
});

/**
 * Create a validation error Result
 */
export const createValidationError = (
  message: string,
  field?: string
): Result<never, NotificationError> => ({
  success: false,
  error: {
    type: "validation_error",
    message,
    field,
  },
});

/**
 * Create a formatting error Result
 */
export const createFormattingError = (
  message: string
): Result<never, NotificationError> => ({
  success: false,
  error: {
    type: "formatting_error",
    message,
  },
});

/**
 * Create a network error Result
 */
export const createNetworkError = (
  message: string,
  status?: number
): Result<never, NotificationError> => ({
  success: false,
  error: {
    type: "network_error",
    message,
    status,
  },
});

/**
 * Create a Discord error Result
 */
export const createDiscordError = (
  message: string,
  code?: string
): Result<never, NotificationError> => ({
  success: false,
  error: {
    type: "discord_error",
    message,
    code,
  },
});

/**
 * Create a generic error Result
 */
export const createError = <E>(error: E): Result<never, E> => ({
  success: false,
  error,
});
