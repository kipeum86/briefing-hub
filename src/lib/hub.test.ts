import { describe, expect, it } from "vitest";
import type { BriefingConfig } from "~/config/briefings";
import { loadAll, pickLatest, type FailedBriefing } from "./hub";
import type { ParseResult } from "./manifest";

const cfg = (slug: string, manifestUrl: string): BriefingConfig => ({
  slug,
  name: slug,
  category: slug,
  accent: "#000",
  description: "",
  manifestUrl,
  siteUrl: "",
});

describe("loadAll", () => {
  const briefings = [cfg("a", "fixture://a"), cfg("b", "fixture://b"), cfg("c", "fixture://c")];

  it("classifies into loaded vs failed", async () => {
    const fakeFetch = async (url: string): Promise<ParseResult> => {
      if (url === "fixture://a") {
        return {
          ok: true,
          manifest: {
            name: "a",
            category: "a",
            accent: "#000",
            description: "",
            url: "x",
            updated_at: "2026-04-22T00:00:00Z",
          },
        };
      }

      if (url === "fixture://b") {
        return { ok: false, reason: "boom" };
      }

      return {
        ok: true,
        manifest: {
          name: "c",
          category: "c",
          accent: "#000",
          description: "",
          url: "x",
          updated_at: "2026-04-21T00:00:00Z",
        },
      };
    };

    const { loaded, failed } = await loadAll(briefings, fakeFetch);
    expect(loaded.map((entry) => entry.config.slug).sort()).toEqual(["a", "c"]);
    expect(failed.map((entry: FailedBriefing) => entry.config.slug)).toEqual(["b"]);
    expect(failed[0].reason).toBe("boom");
  });
});

describe("pickLatest", () => {
  it("returns the loaded briefing whose latest.published_at is newest", () => {
    const result = pickLatest([
      {
        config: cfg("a", ""),
        manifest: {
          name: "a",
          category: "a",
          accent: "#000",
          description: "",
          url: "x",
          updated_at: "2026-04-22T00:00:00Z",
          latest: { title: "old", source: "s", url: "u", published_at: "2026-04-20T00:00:00Z" },
        },
      },
      {
        config: cfg("b", ""),
        manifest: {
          name: "b",
          category: "b",
          accent: "#000",
          description: "",
          url: "x",
          updated_at: "2026-04-22T00:00:00Z",
          latest: { title: "new", source: "s", url: "u", published_at: "2026-04-22T00:00:00Z" },
        },
      },
    ]);

    expect(result?.briefing.slug).toBe("b");
    expect(result?.item.title).toBe("new");
  });

  it("returns null when no loaded briefing has a latest", () => {
    const result = pickLatest([
      {
        config: cfg("a", ""),
        manifest: {
          name: "a",
          category: "a",
          accent: "#000",
          description: "",
          url: "x",
          updated_at: "2026-04-22T00:00:00Z",
        },
      },
    ]);

    expect(result).toBeNull();
  });
});

