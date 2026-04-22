import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type ManifestItem = {
  title: string;
  source: string;
  url: string;
  published_at: string;
};

export type Manifest = {
  name: string;
  category: string;
  accent: string;
  description: string;
  url: string;
  updated_at: string;
  latest?: ManifestItem;
  items?: ManifestItem[];
};

export type ParseResult =
  | { ok: true; manifest: Manifest }
  | { ok: false; reason: string };

const REQUIRED_KEYS = [
  "name",
  "category",
  "accent",
  "description",
  "url",
  "updated_at",
] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && /\d{4}-\d{2}-\d{2}T/.test(value);
}

function validateItem(item: unknown, path: string): string | null {
  if (typeof item !== "object" || item === null) {
    return `${path} not an object`;
  }

  const record = item as Record<string, unknown>;
  for (const key of ["title", "source", "url"] as const) {
    if (!isNonEmptyString(record[key])) {
      return `${path}.${key} missing or not a string`;
    }
  }

  if (!isIsoTimestamp(record.published_at)) {
    return `${path}.published_at invalid`;
  }

  return null;
}

export function parseManifest(json: string): ParseResult {
  let raw: unknown;

  try {
    raw = JSON.parse(json);
  } catch (error) {
    return { ok: false, reason: `invalid json: ${(error as Error).message}` };
  }

  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "manifest is not an object" };
  }

  const record = raw as Record<string, unknown>;

  for (const key of REQUIRED_KEYS) {
    if (!isNonEmptyString(record[key])) {
      return { ok: false, reason: `required field ${key} missing or not a string` };
    }
  }

  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(record.accent as string)) {
    return { ok: false, reason: "accent is not a valid hex color" };
  }

  if (!isIsoTimestamp(record.updated_at)) {
    return { ok: false, reason: "updated_at is not a valid ISO 8601 timestamp" };
  }

  if (record.latest !== undefined) {
    const error = validateItem(record.latest, "latest");
    if (error) return { ok: false, reason: error };
  }

  if (record.items !== undefined) {
    if (!Array.isArray(record.items)) {
      return { ok: false, reason: "items is not an array" };
    }

    for (let index = 0; index < record.items.length; index += 1) {
      const error = validateItem(record.items[index], `items[${index}]`);
      if (error) return { ok: false, reason: error };
    }
  }

  return { ok: true, manifest: record as Manifest };
}

function resolveFilePath(url: string): string {
  if (url.startsWith("file://")) {
    return fileURLToPath(url);
  }

  return resolve(url.slice("file:".length));
}

export async function fetchManifest(url: string): Promise<ParseResult> {
  let body: string;

  try {
    if (url.startsWith("file:")) {
      body = await readFile(resolveFilePath(url), "utf-8");
    } else if (url.startsWith("https:") || url.startsWith("http:")) {
      const response = await fetch(url);
      if (!response.ok) {
        return { ok: false, reason: `HTTP ${response.status} fetching ${url}` };
      }
      body = await response.text();
    } else {
      return { ok: false, reason: `unsupported URL scheme: ${url}` };
    }
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }

  return parseManifest(body);
}

