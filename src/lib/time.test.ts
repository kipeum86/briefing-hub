import { describe, expect, it } from "vitest";
import { toRelativeLong, toRelativeShort } from "./time";

const NOW = new Date("2026-04-22T12:00:00Z");

describe("toRelativeShort", () => {
  it("formats minutes for sub-hour ages", () => {
    expect(toRelativeShort(new Date("2026-04-22T11:50:00Z"), NOW)).toBe("10m");
  });

  it("formats hours for sub-24h ages", () => {
    expect(toRelativeShort(new Date("2026-04-22T07:00:00Z"), NOW)).toBe("5h");
    expect(toRelativeShort(new Date("2026-04-22T11:00:00Z"), NOW)).toBe("1h");
  });

  it("flips from minutes to hours at exactly 60 minutes", () => {
    expect(toRelativeShort(new Date("2026-04-22T11:01:00Z"), NOW)).toBe("59m");
    expect(toRelativeShort(new Date("2026-04-22T11:00:00Z"), NOW)).toBe("1h");
  });

  it("flips from hours to days at exactly 24 hours", () => {
    expect(toRelativeShort(new Date("2026-04-21T13:00:00Z"), NOW)).toBe("23h");
    expect(toRelativeShort(new Date("2026-04-21T12:00:00Z"), NOW)).toBe("1d");
  });

  it("formats days for >=24h ages", () => {
    expect(toRelativeShort(new Date("2026-04-21T12:00:00Z"), NOW)).toBe("1d");
    expect(toRelativeShort(new Date("2026-04-16T12:00:00Z"), NOW)).toBe("6d");
  });

  it("clamps future dates to 'now'", () => {
    expect(toRelativeShort(new Date("2026-04-22T13:00:00Z"), NOW)).toBe("now");
  });

  it("accepts ISO strings", () => {
    expect(toRelativeShort("2026-04-22T07:00:00Z", NOW)).toBe("5h");
  });
});

describe("toRelativeLong", () => {
  it("appends ' ago' to short form", () => {
    expect(toRelativeLong(new Date("2026-04-22T07:00:00Z"), NOW)).toBe("5h ago");
    expect(toRelativeLong(new Date("2026-04-21T12:00:00Z"), NOW)).toBe("1d ago");
  });

  it("returns 'just now' for future/clamped dates", () => {
    expect(toRelativeLong(new Date("2026-04-22T13:00:00Z"), NOW)).toBe("just now");
  });
});

