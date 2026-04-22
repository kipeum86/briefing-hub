import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFS,
  SIZE_SCALES,
  parsePrefs,
  serializePrefs,
  type Prefs,
} from "./prefs";

describe("DEFAULT_PREFS", () => {
  it("matches DESIGN.md (Theme C, default size)", () => {
    expect(DEFAULT_PREFS).toEqual({ theme: "c", size: "default" });
  });
});

describe("SIZE_SCALES", () => {
  it("maps each size to the documented multiplier", () => {
    expect(SIZE_SCALES.compact).toBe(0.9);
    expect(SIZE_SCALES.default).toBe(1);
    expect(SIZE_SCALES.large).toBe(1.15);
  });
});

describe("parsePrefs", () => {
  it("returns defaults for null/undefined input", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("")).toEqual(DEFAULT_PREFS);
  });

  it("returns defaults for invalid JSON", () => {
    expect(parsePrefs("not json")).toEqual(DEFAULT_PREFS);
  });

  it("merges partial prefs over defaults", () => {
    expect(parsePrefs(JSON.stringify({ theme: "a" }))).toEqual({
      theme: "a",
      size: "default",
    });
    expect(parsePrefs(JSON.stringify({ size: "large" }))).toEqual({
      theme: "c",
      size: "large",
    });
  });

  it("rejects unknown theme values", () => {
    expect(parsePrefs(JSON.stringify({ theme: "z" }))).toEqual(DEFAULT_PREFS);
  });

  it("rejects unknown size values", () => {
    expect(parsePrefs(JSON.stringify({ size: "huge" }))).toEqual(DEFAULT_PREFS);
  });
});

describe("serializePrefs", () => {
  it("round-trips through parsePrefs", () => {
    const prefs: Prefs = { theme: "b", size: "large" };
    expect(parsePrefs(serializePrefs(prefs))).toEqual(prefs);
  });
});

