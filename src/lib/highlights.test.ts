import { describe, expect, it } from "vitest";
import type { BriefingConfig } from "~/config/briefings";
import { mergeAndSortItems, type LoadedBriefing } from "./highlights";

const cfg = (slug: string): BriefingConfig => ({
  slug,
  name: slug,
  category: slug,
  accent: "#000",
  description: "",
  manifestUrl: "",
  siteUrl: "",
});

const loaded: LoadedBriefing[] = [
  {
    config: cfg("a"),
    manifest: {
      name: "a",
      category: "a",
      accent: "#000",
      description: "",
      url: "x",
      updated_at: "2026-04-22T00:00:00Z",
      items: [
        { title: "A1", source: "S", url: "u", published_at: "2026-04-22T10:00:00Z" },
        { title: "A2", source: "S", url: "u", published_at: "2026-04-20T10:00:00Z" },
      ],
    },
  },
  {
    config: cfg("b"),
    manifest: {
      name: "b",
      category: "b",
      accent: "#000",
      description: "",
      url: "x",
      updated_at: "2026-04-21T00:00:00Z",
      items: [{ title: "B1", source: "S", url: "u", published_at: "2026-04-21T12:00:00Z" }],
    },
  },
  {
    config: cfg("c"),
    manifest: {
      name: "c",
      category: "c",
      accent: "#000",
      description: "",
      url: "x",
      updated_at: "2026-04-22T00:00:00Z",
    },
  },
];

describe("mergeAndSortItems", () => {
  it("merges items from all loaded briefings, newest first", () => {
    const result = mergeAndSortItems(loaded);
    expect(result.map((entry) => entry.item.title)).toEqual(["A1", "B1", "A2"]);
  });

  it("attaches the source briefing config to each item", () => {
    const result = mergeAndSortItems(loaded);
    expect(result[0].briefing.slug).toBe("a");
    expect(result[1].briefing.slug).toBe("b");
  });

  it("respects the limit parameter", () => {
    const result = mergeAndSortItems(loaded, { limit: 2 });
    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.item.title)).toEqual(["A1", "B1"]);
  });

  it("ignores briefings with no items", () => {
    const result = mergeAndSortItems(loaded);
    expect(result.find((entry) => entry.briefing.slug === "c")).toBeUndefined();
  });
});

