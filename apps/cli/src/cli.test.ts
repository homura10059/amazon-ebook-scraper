import { describe, expect, it } from "vitest";
import { parseArguments } from "./argument-parser";

describe("parseArguments", () => {
  it("should parse single URL argument", () => {
    const args = ["https://amazon.co.jp/dp/123456789"];
    const result = parseArguments(args);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.urls).toEqual(["https://amazon.co.jp/dp/123456789"]);
      expect(result.data.help).toBe(false);
    }
  });

  it("should parse multiple URL arguments", () => {
    const args = ["https://amazon.co.jp/dp/123", "https://amazon.co.jp/dp/456"];
    const result = parseArguments(args);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.urls).toEqual([
        "https://amazon.co.jp/dp/123",
        "https://amazon.co.jp/dp/456",
      ]);
    }
  });

  it("should handle help flag", () => {
    const args = ["--help"];
    const result = parseArguments(args);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.help).toBe(true);
      expect(result.data.urls).toEqual([]);
    }
  });

  it("should handle short help flag", () => {
    const args = ["-h"];
    const result = parseArguments(args);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.help).toBe(true);
    }
  });

  it("should return error for empty arguments", () => {
    const args: string[] = [];
    const result = parseArguments(args);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("URL");
    }
  });

  it("should return error for invalid URL format", () => {
    const args = ["not-a-url"];
    const result = parseArguments(args);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid URL");
    }
  });
});
