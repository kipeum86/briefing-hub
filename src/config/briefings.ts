export type BriefingConfig = {
  slug: string;
  name: string;
  category: string;
  accent: string;
  description: string;
  manifestUrl: string;
  siteUrl: string;
  comingSoon?: boolean;
};

export const BRIEFINGS: readonly BriefingConfig[] = [
  {
    slug: "podcast-briefing",
    name: "Podcast Briefing",
    category: "Podcast",
    accent: "#bb4444",
    description: "10개 영어 팟캐스트 · 주간",
    manifestUrl: "file:./mocks/podcast-briefing.json",
    siteUrl: "https://kipeum86.github.io/podcast-briefing/",
  },
  {
    slug: "youtube-briefing",
    name: "YouTube Briefing",
    category: "YouTube",
    accent: "#2d4a3e",
    description: "6개 한국 채널 · 주간",
    manifestUrl: "file:./mocks/youtube-briefing.json",
    siteUrl: "https://kipeum86.github.io/youtube-briefing/",
  },
  {
    slug: "daily-brief",
    name: "Daily Brief",
    category: "Daily · Macro",
    accent: "#1a3a6b",
    description: "글로벌 매크로 + 국내 뉴스 · 매일",
    manifestUrl: "file:./mocks/daily-brief.json",
    siteUrl: "https://kipeum86.github.io/daily-brief/",
  },
  {
    slug: "game-legal-briefing",
    name: "Game Legal Briefing",
    category: "Game · Legal",
    accent: "#6b2d5c",
    description: "게임 업계 법규 · 판례 · 주간",
    manifestUrl: "file:./mocks/game-legal-briefing.json",
    siteUrl: "https://kipeum86.github.io/game-legal-briefing/",
  },
  {
    slug: "economist-briefing",
    name: "Economist Briefing",
    category: "Economist",
    accent: "#e3120b",
    description: "유료 구독 기사 큐레이션 · 주간",
    manifestUrl: "file:./mocks/economist-briefing.json",
    siteUrl: "https://kipeum86.github.io/economist-briefing/",
    comingSoon: true,
  },
];

