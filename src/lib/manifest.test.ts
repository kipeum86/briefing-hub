import { rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchManifest, parseManifest } from "./manifest";

const VALID = JSON.stringify({
  name: "Podcast Briefing",
  category: "Podcast",
  accent: "#bb4444",
  description: "10개 영어 팟캐스트 · 주간",
  url: "https://kipeum86.github.io/podcast-briefing/",
  updated_at: "2026-04-22T00:00:00Z",
  latest: {
    title: "T",
    source: "S",
    url: "https://example.com/x",
    published_at: "2026-04-22T00:00:00Z",
  },
  items: [
    {
      title: "T",
      source: "S",
      url: "https://example.com/x",
      published_at: "2026-04-22T00:00:00Z",
    },
  ],
});

describe("parseManifest", () => {
  it("parses a fully populated manifest", () => {
    const result = parseManifest(VALID);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.manifest.name).toBe("Podcast Briefing");
      expect(result.manifest.latest?.title).toBe("T");
      expect(result.manifest.items?.length).toBe(1);
    }
  });

  it("accepts a manifest without optional latest/items", () => {
    const result = parseManifest(
      JSON.stringify({
        name: "X",
        category: "X",
        accent: "#abc",
        description: "x",
        url: "https://x",
        updated_at: "2026-04-22T00:00:00Z",
      }),
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.manifest.latest).toBeUndefined();
      expect(result.manifest.items).toBeUndefined();
    }
  });

  it("fails on missing required field", () => {
    const result = parseManifest(
      JSON.stringify({
        name: "X",
        category: "X",
        accent: "#abc",
        description: "x",
        url: "https://x",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/updated_at/);
  });

  it("fails on invalid JSON", () => {
    const result = parseManifest("not json {");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/json/i);
  });

  it("fails on invalid updated_at timestamp", () => {
    const result = parseManifest(
      JSON.stringify({
        name: "X",
        category: "X",
        accent: "#abc",
        description: "x",
        url: "https://x",
        updated_at: "yesterday",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/updated_at/);
  });

  it("fails on invalid item shape (missing title)", () => {
    const result = parseManifest(
      JSON.stringify({
        name: "X",
        category: "X",
        accent: "#abc",
        description: "x",
        url: "https://x",
        updated_at: "2026-04-22T00:00:00Z",
        items: [{ source: "S", url: "https://x", published_at: "2026-04-22T00:00:00Z" }],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/items\[0\].*title/);
  });
});

describe("fetchManifest (file://)", () => {
  let dir = "";

  beforeAll(async () => {
    dir = join(tmpdir(), `bh-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "good.json"), VALID, "utf-8");
    await writeFile(join(dir, "bad.json"), "not json {", "utf-8");
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("loads a file: URL", async () => {
    const result = await fetchManifest(`file:${join(dir, "good.json")}`);
    expect(result.ok).toBe(true);
  });

  it("returns error on missing file", async () => {
    const result = await fetchManifest(`file:${join(dir, "missing.json")}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/ENOENT|no such file|not found/i);
  });

  it("returns error on invalid file content", async () => {
    const result = await fetchManifest(`file:${join(dir, "bad.json")}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/json/i);
  });

  it("rejects unsupported URL schemes", async () => {
    const result = await fetchManifest("ftp://nope/x.json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/unsupported/i);
  });
});

