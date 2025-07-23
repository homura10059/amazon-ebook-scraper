/**
 * Tests for Result types and functional utilities
 * Following TDD principles from docs/tdd.md
 */

import { describe, expect, it, vi } from "vitest";
import {
  Result,
  err,
  flatMap,
  isErr,
  isOk,
  map,
  mapError,
  ok,
  pipe,
  tryCatch,
  tryCatchAsync,
  unwrap,
  unwrapOr,
} from "./result";

describe("Result type construction", () => {
  it("should create successful Result with ok()", () => {
    const result = ok("success");

    expect(result.success).toBe(true);
    expect(result.data).toBe("success");
  });

  it("should create failed Result with err()", () => {
    const result = err("error");

    expect(result.success).toBe(false);
    expect(result.error).toBe("error");
  });
});

describe("Result type guards", () => {
  it("should identify successful Result with isOk()", () => {
    const success = ok("data");
    const failure = err("error");

    expect(isOk(success)).toBe(true);
    expect(isOk(failure)).toBe(false);
  });

  it("should identify failed Result with isErr()", () => {
    const success = ok("data");
    const failure = err("error");

    expect(isErr(success)).toBe(false);
    expect(isErr(failure)).toBe(true);
  });
});

describe("Result mapping operations", () => {
  it("should map successful Result data", () => {
    const result = ok(5);
    const mapped = map(result, (x) => x * 2);

    expect(mapped.success).toBe(true);
    if (mapped.success) {
      expect(mapped.data).toBe(10);
    }
  });

  it("should not map failed Result data", () => {
    const result = err("error");
    const mapped = map(result, (x) => x * 2);

    expect(mapped.success).toBe(false);
    if (!mapped.success) {
      expect(mapped.error).toBe("error");
    }
  });

  it("should flatMap successful Result", () => {
    const result = ok(5);
    const flatMapped = flatMap(result, (x) => ok(x * 2));

    expect(flatMapped.success).toBe(true);
    if (flatMapped.success) {
      expect(flatMapped.data).toBe(10);
    }
  });

  it("should not flatMap failed Result", () => {
    const result = err("error");
    const flatMapped = flatMap(result, (x) => ok(x * 2));

    expect(flatMapped.success).toBe(false);
    if (!flatMapped.success) {
      expect(flatMapped.error).toBe("error");
    }
  });

  it("should map error in failed Result", () => {
    const result = err("original error");
    const mapped = mapError(result, (err) => `mapped: ${err}`);

    expect(mapped.success).toBe(false);
    if (!mapped.success) {
      expect(mapped.error).toBe("mapped: original error");
    }
  });

  it("should not map error in successful Result", () => {
    const result = ok("data");
    const mapped = mapError(result, (err) => `mapped: ${err}`);

    expect(mapped.success).toBe(true);
    if (mapped.success) {
      expect(mapped.data).toBe("data");
    }
  });
});

describe("Result unwrapping", () => {
  it("should unwrap successful Result", () => {
    const result = ok("success");
    const value = unwrap(result);

    expect(value).toBe("success");
  });

  it("should throw when unwrapping failed Result", () => {
    const result = err("error");

    expect(() => unwrap(result)).toThrow("Result unwrap failed: error");
  });

  it("should unwrap successful Result with unwrapOr", () => {
    const result = ok("success");
    const value = unwrapOr(result, "default");

    expect(value).toBe("success");
  });

  it("should return default when unwrapping failed Result with unwrapOr", () => {
    const result = err("error");
    const value = unwrapOr(result, "default");

    expect(value).toBe("default");
  });
});

describe("Exception handling", () => {
  it("should catch successful function execution", () => {
    const result = tryCatch(() => "success");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("success");
    }
  });

  it("should catch thrown exceptions", () => {
    const result = tryCatch(() => {
      throw new Error("test error");
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toBe("test error");
    }
  });

  it("should use custom error handler", () => {
    const result = tryCatch(
      () => {
        throw new Error("original");
      },
      (error) => `custom: ${(error as Error).message}`
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("custom: original");
    }
  });
});

describe("Async exception handling", () => {
  it("should catch successful async function execution", async () => {
    const result = await tryCatchAsync(async () => "success");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("success");
    }
  });

  it("should catch async thrown exceptions", async () => {
    const result = await tryCatchAsync(async () => {
      throw new Error("async error");
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toBe("async error");
    }
  });

  it("should use custom error handler for async", async () => {
    const result = await tryCatchAsync(
      async () => {
        throw new Error("original");
      },
      (error) => `async custom: ${(error as Error).message}`
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("async custom: original");
    }
  });
});

describe("Functional pipe utility", () => {
  it("should pipe value through transformations", () => {
    const result = pipe(5)
      .map((x) => x * 2)
      .map((x) => x + 1)
      .unwrap();

    expect(result).toBe(11);
  });

  it("should pipe through flatMap", () => {
    const result = pipe(5).flatMap((x) => ok(x * 2));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(10);
    }
  });

  it("should handle flatMap failures in pipe", () => {
    const result = pipe(5).flatMap((x) => err("error"));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("error");
    }
  });
});
