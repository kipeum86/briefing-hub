import { describe, expect, it } from "vitest";
import { BRIEFINGS, type BriefingConfig } from "./briefings";

describe("BRIEFINGS", () => {
  it("has 5 entries (podcast, youtube, daily, legal, economist)", () => {
    const slugs = BRIEFINGS.map((briefing) => briefing.slug).sort();
    expect(slugs).toEqual([
      "daily-brief",
      "economist-briefing",
      "game-legal-briefing",
      "podcast-briefing",
      "youtube-briefing",
    ]);
  });

  it("every entry has required fields", () => {
    for (const briefing of BRIEFINGS) {
      expect(briefing.slug).toBeTruthy();
      expect(briefing.name).toBeTruthy();
      expect(briefing.category).toBeTruthy();
      expect(briefing.accent).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      expect(briefing.description).toBeTruthy();
      expect(briefing.manifestUrl).toBeTruthy();
      expect(briefing.siteUrl).toBeTruthy();
    }
  });

  it("accent colors match DESIGN.md spec", () => {
    const bySlug = (slug: string): BriefingConfig =>
      BRIEFINGS.find((briefing) => briefing.slug === slug)!;

    expect(bySlug("podcast-briefing").accent).toBe("#bb4444");
    expect(bySlug("youtube-briefing").accent).toBe("#2d4a3e");
    expect(bySlug("daily-brief").accent).toBe("#1a3a6b");
    expect(bySlug("game-legal-briefing").accent).toBe("#6b2d5c");
    expect(bySlug("economist-briefing").accent).toBe("#e3120b");
  });
});

