import type { BriefingConfig } from "~/config/briefings";
import type { Highlight, LoadedBriefing } from "./highlights";
import { fetchManifest, type ParseResult } from "./manifest";

export type FailedBriefing = {
  config: BriefingConfig;
  reason: string;
};

export type LoadResult = {
  loaded: LoadedBriefing[];
  failed: FailedBriefing[];
};

export type Fetcher = (url: string) => Promise<ParseResult>;

export async function loadAll(
  briefings: readonly BriefingConfig[],
  fetcher: Fetcher = fetchManifest,
): Promise<LoadResult> {
  const results = await Promise.all(
    briefings.map(async (config) => ({
      config,
      result: await fetcher(config.manifestUrl),
    })),
  );

  const loaded: LoadedBriefing[] = [];
  const failed: FailedBriefing[] = [];

  for (const { config, result } of results) {
    if (result.ok) {
      loaded.push({ config, manifest: result.manifest });
    } else {
      failed.push({ config, reason: result.reason });
    }
  }

  return { loaded, failed };
}

export function pickLatest(loaded: readonly LoadedBriefing[]): Highlight | null {
  let best: Highlight | null = null;
  let bestTime = -Infinity;

  for (const briefing of loaded) {
    const latest = briefing.manifest.latest;
    if (!latest) continue;

    const publishedAt = new Date(latest.published_at).getTime();
    if (publishedAt > bestTime) {
      bestTime = publishedAt;
      best = { briefing: briefing.config, item: latest };
    }
  }

  return best;
}

