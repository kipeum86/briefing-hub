export type Theme = "a" | "b" | "c";
export type Size = "compact" | "default" | "large";

export type Prefs = {
  theme: Theme;
  size: Size;
};

export const DEFAULT_PREFS: Prefs = { theme: "c", size: "default" };

export const SIZE_SCALES: Record<Size, number> = {
  compact: 0.9,
  default: 1,
  large: 1.15,
};

export const STORAGE_KEY = "briefing-hub:prefs";

const VALID_THEMES = new Set<Theme>(["a", "b", "c"]);
const VALID_SIZES = new Set<Size>(["compact", "default", "large"]);

export function parsePrefs(raw: string | null | undefined): Prefs {
  if (!raw) return { ...DEFAULT_PREFS };

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PREFS };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ...DEFAULT_PREFS };
  }

  const record = parsed as { theme?: unknown; size?: unknown };

  return {
    theme: VALID_THEMES.has(record.theme as Theme) ? (record.theme as Theme) : DEFAULT_PREFS.theme,
    size: VALID_SIZES.has(record.size as Size) ? (record.size as Size) : DEFAULT_PREFS.size,
  };
}

export function serializePrefs(prefs: Prefs): string {
  return JSON.stringify(prefs);
}

