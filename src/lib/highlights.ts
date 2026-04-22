import type { BriefingConfig } from "~/config/briefings";
import type { Manifest, ManifestItem } from "./manifest";

export type LoadedBriefing = {
  config: BriefingConfig;
  manifest: Manifest;
};

export type Highlight = {
  briefing: BriefingConfig;
  item: ManifestItem;
};

export type MergeOptions = {
  limit?: number;
};

export function mergeAndSortItems(
  loaded: readonly LoadedBriefing[],
  options: MergeOptions = {},
): Highlight[] {
  const limit = options.limit ?? 10;
  const items: Highlight[] = [];

  for (const briefing of loaded) {
    for (const item of briefing.manifest.items ?? []) {
      items.push({ briefing: briefing.config, item });
    }
  }

  items.sort((left, right) => {
    const leftTime = new Date(left.item.published_at).getTime();
    const rightTime = new Date(right.item.published_at).getTime();
    return rightTime - leftTime;
  });

  return items.slice(0, limit);
}

