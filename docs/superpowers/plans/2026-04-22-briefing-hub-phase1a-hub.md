# Briefing Hub — Phase 1A (Hub Repo) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the standalone `briefing-hub` Astro site that aggregates briefing children via build-time manifest fetch, with a runtime theme/size options panel, deployed to GitHub Pages.

**Architecture:** Astro 5 static site. At build time, a typed manifest loader reads each child's `/manifest.json` (URLs declared in a typed `BRIEFINGS` config) and passes the data to page components. Phase 1A uses local mock manifests under `mocks/` so the hub builds end-to-end without depending on child sites; Phase 1B will swap to real child URLs. Theme A/B/C and text size are runtime preferences toggled via a CSS-variable layer and persisted to `localStorage`. Daily cron + `repository_dispatch` trigger rebuilds.

**Tech Stack:** Astro 5.1+, TypeScript 5.6+, Vitest (unit), Playwright (e2e smoke), Node 20, GitHub Actions, GitHub Pages.

**Repo:** `https://github.com/kipeum86/briefing-hub` → `https://kipeum86.github.io/briefing-hub/`

**Reference:**
- Spec: [DESIGN.md](../../../DESIGN.md)
- Visual mockup: [mockups/index.html](../../../mockups/index.html)
- Sibling stack reference: [youtube-briefing](../../../../youtube-briefing/) (Astro 5 + TS + Playwright)

**Out of scope (covered by Phase 1B):**
- Modifying `podcast-briefing` or `youtube-briefing` repos (manifest endpoint, HubChip, dispatch step)
- Real cross-repo `repository_dispatch` integration
- PAT (`HUB_DISPATCH_TOKEN`) setup on child repos

**Out of scope (deferred to Phase 2/3):**
- `daily-brief`, `game-legal-briefing`, `economist-briefing` integration
- Mobile carousel or alternative layouts
- Custom domain migration (`briefing.kpsfamily.com`)

---

## File Structure

Plan locks in these files. Each file has one responsibility; tests sit beside the unit they cover.

**New (hub repo root):**
```
briefing-hub/
├── .github/workflows/
│   └── rebuild.yml              # daily cron + dispatch + push trigger
├── .gitignore
├── astro.config.mjs             # GH Pages base path, site URL
├── package.json
├── package-lock.json            # generated
├── playwright.config.ts
├── README.md
├── tsconfig.json
├── vitest.config.ts
├── mocks/                       # Phase 1A mock manifests; removed in 1B
│   ├── podcast-briefing.json
│   ├── youtube-briefing.json
│   ├── daily-brief.json
│   ├── game-legal-briefing.json
│   └── economist-briefing.json
├── public/
│   └── favicon.svg
├── src/
│   ├── config/
│   │   └── briefings.ts         # typed BRIEFINGS list (slug, name, accent, manifest URL)
│   ├── lib/
│   │   ├── manifest.ts          # types + fetchManifest + parseManifest
│   │   ├── manifest.test.ts
│   │   ├── time.ts              # toRelative(date) → "5h ago"
│   │   ├── time.test.ts
│   │   ├── highlights.ts        # mergeAndSortItems()
│   │   └── highlights.test.ts
│   ├── components/
│   │   ├── Masthead.astro
│   │   ├── HeroLatest.astro
│   │   ├── BriefingCard.astro
│   │   ├── HighlightsList.astro
│   │   ├── OptionsPanel.astro   # gear + panel + script
│   │   └── PlaceholderCard.astro # "점검 중" fallback
│   ├── styles/
│   │   ├── tokens.css           # color + scale CSS vars
│   │   ├── themes.css           # theme-a/b/c font var blocks
│   │   └── base.css             # layout + components
│   ├── layouts/
│   │   └── BaseLayout.astro
│   └── pages/
│       └── index.astro          # the only page; orchestrates fetch + render
└── tests/e2e/
    └── hub.spec.ts              # smoke: page renders, gear toggles panel, theme persists
```

---

## Chunk 1: Scaffolding & Configuration

Goal: an Astro 5 + TS project that builds and serves an empty page with the correct GH Pages base path. Tests run (Vitest + Playwright) against placeholder code.

### Task 1.1: Initialize repo & npm project

**Files:**
- Create: `briefing-hub/.gitignore`
- Create: `briefing-hub/package.json`

- [ ] **Step 1: Initialize git in the existing briefing-hub directory**

The `briefing-hub/` directory already exists with `DESIGN.md`, `mockups/`, and `docs/` populated. Initialize git in place — don't recreate the directory.

```bash
cd "/Users/kpsfamily/코딩 프로젝트/briefing-hub"
git init -b main
```

Expected: `Initialized empty Git repository in .../briefing-hub/.git/`

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
dist/
.astro/
.DS_Store
.env
.env.local
playwright-report/
test-results/
```

- [ ] **Step 3: Write `package.json`**

```json
{
  "name": "briefing-hub",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "start": "astro dev",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "astro": "astro",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "astro": "^5.1.0",
    "@astrojs/check": "^0.9.0",
    "typescript": "^5.6.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

Expected: creates `node_modules/` and `package-lock.json`. No errors.

- [ ] **Step 5: Initial commit**

`node_modules/` is already gitignored, so `git add -A` safely picks up everything else (existing `DESIGN.md`, `mockups/`, `docs/`, plus the new `package.json` / `package-lock.json` / `.gitignore`).

```bash
git add -A
git status   # sanity check before committing
git commit -m "chore: initial commit (existing design docs + npm scaffold)"
```

---

### Task 1.2: TypeScript & Astro configuration

**Files:**
- Create: `briefing-hub/tsconfig.json`
- Create: `briefing-hub/astro.config.mjs`
- Create: `briefing-hub/src/env.d.ts`

- [ ] **Step 1: Write `tsconfig.json`**

Match youtube-briefing's minimal shape (it relies on Astro's strict preset for everything). Add a `~/*` path alias for cleaner imports — that's the only deviation from the sibling.

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "~/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "astro.config.mjs"],
  "exclude": ["dist/", "node_modules/"]
}
```

- [ ] **Step 2: Write `astro.config.mjs`**

The `site` and `base` together give us `https://kipeum86.github.io/briefing-hub/`. Match youtube-briefing's `trailingSlash: "ignore"` and `format: "directory"` so URLs read consistently across siblings.

```js
// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://kipeum86.github.io",
  base: "/briefing-hub",
  trailingSlash: "ignore",
  build: {
    format: "directory",
  },
});
```

- [ ] **Step 3: Write `src/env.d.ts`**

```ts
/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_HUB_DEFAULT_THEME?: "a" | "b" | "c";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 4: Verify Astro recognizes the config**

```bash
npx astro check --help
```

Expected: command runs without "config not found" errors. (We have no pages yet, so a real `astro check` would fail.)

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json astro.config.mjs src/env.d.ts
git commit -m "chore: astro + typescript config (gh pages base path)"
```

---

### Task 1.3: Vitest configuration

**Files:**
- Create: `briefing-hub/vitest.config.ts`
- Create: `briefing-hub/src/lib/_smoke.test.ts` (temporary, deleted at end of task)

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "~": new URL("./src", import.meta.url).pathname,
    },
  },
});
```

- [ ] **Step 2: Write a smoke test to prove vitest runs**

`src/lib/_smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run vitest**

```bash
npm test
```

Expected: `1 passed` on a single test, exit 0.

- [ ] **Step 4: Delete the smoke test**

```bash
rm src/lib/_smoke.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: vitest config"
```

---

### Task 1.4: Playwright configuration

**Files:**
- Create: `briefing-hub/playwright.config.ts`

- [ ] **Step 1: Write `playwright.config.ts`**

Key choices:
- `webServer` runs `npm run preview` (built static site) so e2e tests reflect real production output, not dev-server quirks.
- `baseURL` includes the base path `/briefing-hub` so tests can use relative paths.
- Single Chromium project for MVP (multi-browser can wait).

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4321/briefing-hub",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4321",
    url: "http://127.0.0.1:4321/briefing-hub",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Install Playwright browser binaries**

```bash
npx playwright install chromium
```

Expected: chromium downloads (or "is already installed"). No errors.

- [ ] **Step 3: Verify Playwright config parses**

```bash
npx playwright test --list 2>&1 | head -10
```

Expected: lists `0 tests` (no spec files yet) without config errors.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts
git commit -m "chore: playwright e2e config"
```

---

### Task 1.5: Briefings config (typed)

**Files:**
- Create: `briefing-hub/src/config/briefings.ts`
- Create: `briefing-hub/src/config/briefings.test.ts`

The `BRIEFINGS` list is the single source of truth for which child sites the hub knows about, their accent colors, and where to fetch their manifest. Typed at compile time so adding a new child is one tuple.

For Phase 1A every `manifestUrl` points at a local mock under `mocks/`. The mock loader (Task 2.x) treats local file URLs as filesystem reads. Phase 1B will swap the URLs to real child sites.

- [ ] **Step 1: Write the failing test**

`src/config/briefings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BRIEFINGS, type BriefingConfig } from "./briefings";

describe("BRIEFINGS", () => {
  it("has 5 entries (podcast, youtube, daily, legal, economist)", () => {
    const slugs = BRIEFINGS.map((b) => b.slug).sort();
    expect(slugs).toEqual([
      "daily-brief",
      "economist-briefing",
      "game-legal-briefing",
      "podcast-briefing",
      "youtube-briefing",
    ]);
  });

  it("every entry has required fields", () => {
    for (const b of BRIEFINGS) {
      expect(b.slug).toBeTruthy();
      expect(b.name).toBeTruthy();
      expect(b.category).toBeTruthy();
      expect(b.accent).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      expect(b.description).toBeTruthy();
      expect(b.manifestUrl).toBeTruthy();
    }
  });

  it("accent colors match DESIGN.md spec", () => {
    const byslug = (s: string): BriefingConfig =>
      BRIEFINGS.find((b) => b.slug === s)!;
    expect(byslug("podcast-briefing").accent).toBe("#bb4444");
    expect(byslug("youtube-briefing").accent).toBe("#2d4a3e");
    expect(byslug("daily-brief").accent).toBe("#1a3a6b");
    expect(byslug("game-legal-briefing").accent).toBe("#6b2d5c");
    expect(byslug("economist-briefing").accent).toBe("#e3120b");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/config
```

Expected: FAIL — module `./briefings` not found.

- [ ] **Step 3: Write the minimal implementation**

`src/config/briefings.ts`:

```ts
export type BriefingConfig = {
  slug: string;
  name: string;
  category: string;
  accent: string;
  description: string;
  /** Where to fetch the manifest. file: URL = local mock; https: URL = real child. */
  manifestUrl: string;
  /** Where the card links to. Empty for "coming soon". */
  siteUrl: string;
  /** True for placeholders that don't have a live site yet. */
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
    name: "Youtube Briefing",
    category: "Youtube",
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/config
```

Expected: 3 tests pass, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/config/
git commit -m "feat: typed BRIEFINGS config (5 children, accent colors per DESIGN.md)"
```

---

### Task 1.6: Mock manifests (Phase 1A test data)

**Files:**
- Create: `briefing-hub/mocks/podcast-briefing.json`
- Create: `briefing-hub/mocks/youtube-briefing.json`
- Create: `briefing-hub/mocks/daily-brief.json`
- Create: `briefing-hub/mocks/game-legal-briefing.json`
- Create: `briefing-hub/mocks/economist-briefing.json`

Each mock matches the schema in DESIGN.md §4. Timestamps relative to `2026-04-22` so the mockup data stays plausible during dev. Phase 1B will delete `mocks/` and switch `manifestUrl` to real `https://...` URLs.

- [ ] **Step 1: Write `mocks/podcast-briefing.json`**

```json
{
  "name": "Podcast Briefing",
  "category": "Podcast",
  "accent": "#bb4444",
  "description": "10개 영어 팟캐스트 · 주간",
  "url": "https://kipeum86.github.io/podcast-briefing/",
  "updated_at": "2026-04-22T00:00:00Z",
  "latest": {
    "title": "Why the Bond Market Can't Agree on Recession",
    "source": "Odd Lots · Bloomberg",
    "url": "https://kipeum86.github.io/podcast-briefing/odd-lots-bond-market/",
    "published_at": "2026-04-22T00:00:00Z"
  },
  "items": [
    {
      "title": "Why the Bond Market Can't Agree on Recession",
      "source": "Odd Lots · Bloomberg",
      "url": "https://kipeum86.github.io/podcast-briefing/odd-lots-bond-market/",
      "published_at": "2026-04-22T00:00:00Z"
    },
    {
      "title": "The Daily — Inside the AI Talent Bidding War",
      "source": "The Daily · NYT",
      "url": "https://kipeum86.github.io/podcast-briefing/daily-ai-talent/",
      "published_at": "2026-04-21T00:00:00Z"
    },
    {
      "title": "Plain English — Why Housing Inventory Just Snapped",
      "source": "Plain English · The Ringer",
      "url": "https://kipeum86.github.io/podcast-briefing/plain-english-housing/",
      "published_at": "2026-04-18T00:00:00Z"
    }
  ]
}
```

- [ ] **Step 2: Write `mocks/youtube-briefing.json`**

```json
{
  "name": "Youtube Briefing",
  "category": "Youtube",
  "accent": "#2d4a3e",
  "description": "6개 한국 채널 · 주간",
  "url": "https://kipeum86.github.io/youtube-briefing/",
  "updated_at": "2026-04-21T00:00:00Z",
  "latest": {
    "title": "슈카월드 — 미국 관세 정책 다시 들썩이는 이유",
    "source": "슈카월드",
    "url": "https://kipeum86.github.io/youtube-briefing/syuka-tariff/",
    "published_at": "2026-04-21T00:00:00Z"
  },
  "items": [
    {
      "title": "슈카월드 — 미국 관세 정책 다시 들썩이는 이유",
      "source": "슈카월드",
      "url": "https://kipeum86.github.io/youtube-briefing/syuka-tariff/",
      "published_at": "2026-04-21T00:00:00Z"
    },
    {
      "title": "삼프로TV — 반도체 사이클 정점 논쟁, 누구 말이 맞나",
      "source": "삼프로TV",
      "url": "https://kipeum86.github.io/youtube-briefing/3pro-semi-cycle/",
      "published_at": "2026-04-17T00:00:00Z"
    }
  ]
}
```

- [ ] **Step 3: Write `mocks/daily-brief.json`**

```json
{
  "name": "Daily Brief",
  "category": "Daily · Macro",
  "accent": "#1a3a6b",
  "description": "글로벌 매크로 + 국내 뉴스 · 매일",
  "url": "https://kipeum86.github.io/daily-brief/",
  "updated_at": "2026-04-22T03:00:00Z",
  "latest": {
    "title": "한은 금통위 동결 — 내수 부진 신호 주목",
    "source": "Daily Brief",
    "url": "https://kipeum86.github.io/daily-brief/2026-04-22/",
    "published_at": "2026-04-22T03:00:00Z"
  },
  "items": [
    {
      "title": "한은 금통위 동결 — 내수 부진 신호 주목",
      "source": "Daily Brief",
      "url": "https://kipeum86.github.io/daily-brief/2026-04-22/",
      "published_at": "2026-04-22T03:00:00Z"
    },
    {
      "title": "엔비디아 데이터센터 매출 컨센 상회 — 가이던스가 다시 핵심",
      "source": "Daily Brief",
      "url": "https://kipeum86.github.io/daily-brief/2026-04-19/",
      "published_at": "2026-04-19T03:00:00Z"
    },
    {
      "title": "유로존 PMI 50선 회복 — ECB 금리 인하 속도조절 시그널",
      "source": "Daily Brief",
      "url": "https://kipeum86.github.io/daily-brief/2026-04-16/",
      "published_at": "2026-04-16T03:00:00Z"
    }
  ]
}
```

- [ ] **Step 4: Write `mocks/game-legal-briefing.json`**

```json
{
  "name": "Game Legal Briefing",
  "category": "Game · Legal",
  "accent": "#6b2d5c",
  "description": "게임 업계 법규 · 판례 · 주간",
  "url": "https://kipeum86.github.io/game-legal-briefing/",
  "updated_at": "2026-04-19T00:00:00Z",
  "latest": {
    "title": "확률형 아이템 표시 의무 — 공정위 첫 행정처분 사례",
    "source": "Game Legal Briefing",
    "url": "https://kipeum86.github.io/game-legal-briefing/probability-item-ftc/",
    "published_at": "2026-04-19T00:00:00Z"
  },
  "items": [
    {
      "title": "확률형 아이템 표시 의무 — 공정위 첫 행정처분 사례",
      "source": "Game Legal Briefing",
      "url": "https://kipeum86.github.io/game-legal-briefing/probability-item-ftc/",
      "published_at": "2026-04-19T00:00:00Z"
    },
    {
      "title": "메타버스 플랫폼 미성년자 보호 가이드라인 개정안 입법예고",
      "source": "Game Legal Briefing",
      "url": "https://kipeum86.github.io/game-legal-briefing/metaverse-minors/",
      "published_at": "2026-04-16T00:00:00Z"
    }
  ]
}
```

- [ ] **Step 5: Write `mocks/economist-briefing.json` (coming-soon stub)**

The economist briefing isn't built yet. The mock includes only the required fields with no `latest` or `items` so the loader's graceful degradation path (DESIGN.md §4) is exercised.

```json
{
  "name": "Economist Briefing",
  "category": "Economist",
  "accent": "#e3120b",
  "description": "유료 구독 기사 큐레이션 · 주간",
  "url": "https://kipeum86.github.io/economist-briefing/",
  "updated_at": "2026-04-22T00:00:00Z"
}
```

- [ ] **Step 6: Commit**

```bash
git add mocks/
git commit -m "feat: phase 1a mock manifests for all 5 children"
```

---

### Task 1.7: Hello-world page + first build

Goal: prove the toolchain end-to-end (TS + Astro + GH Pages base path) before adding domain logic.

**Files:**
- Create: `briefing-hub/src/layouts/BaseLayout.astro`
- Create: `briefing-hub/src/pages/index.astro`
- Create: `briefing-hub/public/favicon.svg`

- [ ] **Step 1: Write a minimal `BaseLayout.astro`**

```astro
---
interface Props {
  title: string;
}
const { title } = Astro.props;
---
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href={`${import.meta.env.BASE_URL}favicon.svg`} />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 2: Write a placeholder `index.astro`**

```astro
---
import BaseLayout from "~/layouts/BaseLayout.astro";
---
<BaseLayout title="Briefing Hub">
  <main>
    <h1>Briefing Hub</h1>
    <p data-testid="placeholder">scaffolding in progress</p>
  </main>
</BaseLayout>
```

- [ ] **Step 3: Write a placeholder `favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="#1a1a1a"/><text x="8" y="12" font-family="monospace" font-size="10" fill="#f9f7f2" text-anchor="middle">B</text></svg>
```

- [ ] **Step 4: Build the site**

```bash
npm run build
```

Expected: `astro check` reports 0 errors, `astro build` writes `dist/briefing-hub/index.html`.

Verify the base path took effect:

```bash
ls dist/
```

Expected output includes `briefing-hub/`.

- [ ] **Step 5: Smoke test the build with curl**

Capture the preview-server PID explicitly (job-control `%1` is unreliable in non-interactive shells) and poll the URL until it responds instead of guessing a sleep interval.

```bash
npm run preview -- --host 127.0.0.1 --port 4321 &
PREVIEW_PID=$!
trap 'kill $PREVIEW_PID 2>/dev/null' EXIT

# Wait up to 30s for preview to start serving
for i in {1..30}; do
  if curl -sf http://127.0.0.1:4321/briefing-hub/ > /dev/null; then break; fi
  sleep 1
done

curl -s http://127.0.0.1:4321/briefing-hub/ | grep "scaffolding in progress"
RESULT=$?

kill $PREVIEW_PID 2>/dev/null
trap - EXIT
exit $RESULT
```

Expected: matches the placeholder line. Exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/layouts/ src/pages/ public/
git commit -m "feat: minimal page + base layout (toolchain smoke)"
```

---

## Chunk 1 Exit Criteria

Before moving to Chunk 2 the repo must satisfy:

- `npm test` passes (BRIEFINGS config tests)
- `npm run build` produces `dist/briefing-hub/index.html` with the placeholder content
- `git log --oneline` shows ~7 small commits, one per task
- `BRIEFINGS` config + 5 mock JSON files are in place but no real loading happens yet
- No domain logic (manifest loader, components, options panel) has been written — that's Chunk 2 onward

---

## Chunk 2: Manifest Loader, Domain Helpers & Page Composition

Goal: the hub renders the real Phase 1A page from mock manifest data — masthead, hero, card grid, highlights — with all domain logic (fetch, parse, validate, time format, merge) covered by Vitest. Theming and the options panel come in Chunk 3, so Chunk 2 ships with **Theme C** styles inlined directly into `base.css` (the theme layer is added on top in Chunk 3 without rewriting these styles).

### Task 2.1: Manifest types & parser (validation + graceful degradation)

**Files:**
- Create: `briefing-hub/src/lib/manifest.ts`
- Create: `briefing-hub/src/lib/manifest.test.ts`

DESIGN.md §4 says: required fields (`name`, `category`, `accent`, `description`, `url`, `updated_at`) missing → render a "점검 중" placeholder. Optional fields (`latest`, `items`) absent → degrade gracefully.

The parser is **pure** (string in, result out). The fetcher (Task 2.2) wraps it. This split lets us test parsing without filesystem or network.

- [ ] **Step 1: Write the failing test**

`src/lib/manifest.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseManifest, type Manifest } from "./manifest";

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
    const r = parseManifest(VALID);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest.name).toBe("Podcast Briefing");
      expect(r.manifest.latest?.title).toBe("T");
      expect(r.manifest.items?.length).toBe(1);
    }
  });

  it("accepts a manifest without optional latest/items", () => {
    const r = parseManifest(JSON.stringify({
      name: "X", category: "X", accent: "#abc",
      description: "x", url: "https://x", updated_at: "2026-04-22T00:00:00Z",
    }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest.latest).toBeUndefined();
      expect(r.manifest.items).toBeUndefined();
    }
  });

  it("fails on missing required field", () => {
    const r = parseManifest(JSON.stringify({
      name: "X", category: "X", accent: "#abc",
      description: "x", url: "https://x",
      // updated_at missing
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/updated_at/);
  });

  it("fails on invalid JSON", () => {
    const r = parseManifest("not json {");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/json/i);
  });

  it("fails on invalid updated_at timestamp", () => {
    const r = parseManifest(JSON.stringify({
      name: "X", category: "X", accent: "#abc",
      description: "x", url: "https://x", updated_at: "yesterday",
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/updated_at/);
  });

  it("fails on invalid item shape (missing title)", () => {
    const r = parseManifest(JSON.stringify({
      name: "X", category: "X", accent: "#abc",
      description: "x", url: "https://x", updated_at: "2026-04-22T00:00:00Z",
      items: [{ source: "S", url: "https://x", published_at: "2026-04-22T00:00:00Z" }],
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/items\[0\].*title/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/manifest
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

`src/lib/manifest.ts`:

```ts
export type ManifestItem = {
  title: string;
  source: string;
  url: string;
  published_at: string;  // ISO 8601
};

export type Manifest = {
  name: string;
  category: string;
  accent: string;
  description: string;
  url: string;
  updated_at: string;     // ISO 8601
  latest?: ManifestItem;
  items?: ManifestItem[];
};

export type ParseResult =
  | { ok: true; manifest: Manifest }
  | { ok: false; reason: string };

const REQUIRED_KEYS = [
  "name", "category", "accent", "description", "url", "updated_at",
] as const;

function isIsoTimestamp(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime()) && /\d{4}-\d{2}-\d{2}T/.test(v);
}

function validateItem(item: unknown, path: string): string | null {
  if (typeof item !== "object" || item === null) return `${path} not an object`;
  const o = item as Record<string, unknown>;
  for (const k of ["title", "source", "url"] as const) {
    if (typeof o[k] !== "string" || !o[k]) return `${path}.${k} missing or not a string`;
  }
  if (!isIsoTimestamp(o.published_at)) return `${path}.published_at invalid`;
  return null;
}

export function parseManifest(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { ok: false, reason: `invalid json: ${(e as Error).message}` };
  }
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "manifest is not an object" };
  }
  const o = raw as Record<string, unknown>;

  for (const k of REQUIRED_KEYS) {
    if (typeof o[k] !== "string" || !o[k]) {
      return { ok: false, reason: `required field ${k} missing or not a string` };
    }
  }
  if (!isIsoTimestamp(o.updated_at)) {
    return { ok: false, reason: "updated_at is not a valid ISO 8601 timestamp" };
  }

  if (o.latest !== undefined) {
    const err = validateItem(o.latest, "latest");
    if (err) return { ok: false, reason: err };
  }
  if (o.items !== undefined) {
    if (!Array.isArray(o.items)) return { ok: false, reason: "items is not an array" };
    for (let i = 0; i < o.items.length; i++) {
      const err = validateItem(o.items[i], `items[${i}]`);
      if (err) return { ok: false, reason: err };
    }
  }

  return { ok: true, manifest: o as Manifest };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/manifest
```

Expected: 6 tests pass, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/manifest.ts src/lib/manifest.test.ts
git commit -m "feat: typed manifest parser with field-level validation"
```

---

### Task 2.2: Manifest fetcher (file:// + https://)

**Files:**
- Modify: `briefing-hub/src/lib/manifest.ts` (add `fetchManifest`)
- Modify: `briefing-hub/src/lib/manifest.test.ts` (add fetcher tests)

`fetchManifest` is the I/O-shell wrapper around `parseManifest`. It supports:
- `file:./path/to.json` → `node:fs/promises.readFile` (Phase 1A mocks)
- `https://...` → `fetch()` (Phase 1B real children)

Errors (network failure, 404, file not found) return `{ ok: false, reason }` so the page can render a placeholder card without crashing the build.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/manifest.test.ts`:

```ts
import { fetchManifest } from "./manifest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("fetchManifest (file://)", () => {
  let dir: string;

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
    const r = await fetchManifest(`file:${join(dir, "good.json")}`);
    expect(r.ok).toBe(true);
  });

  it("returns error on missing file", async () => {
    const r = await fetchManifest(`file:${join(dir, "missing.json")}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/ENOENT|not found/i);
  });

  it("returns error on invalid file content", async () => {
    const r = await fetchManifest(`file:${join(dir, "bad.json")}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/json/i);
  });

  it("rejects unsupported URL schemes", async () => {
    const r = await fetchManifest("ftp://nope/x.json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unsupported/i);
  });
});
```

Add the `beforeAll, afterAll` import at the top:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/manifest
```

Expected: 4 new tests fail with "fetchManifest is not exported".

- [ ] **Step 3: Add `fetchManifest` to `src/lib/manifest.ts`**

Append:

```ts
import { readFile } from "node:fs/promises";

export async function fetchManifest(url: string): Promise<ParseResult> {
  let body: string;
  try {
    if (url.startsWith("file:")) {
      const path = url.slice("file:".length);
      body = await readFile(path, "utf-8");
    } else if (url.startsWith("https:") || url.startsWith("http:")) {
      const res = await fetch(url);
      if (!res.ok) {
        return { ok: false, reason: `HTTP ${res.status} fetching ${url}` };
      }
      body = await res.text();
    } else {
      return { ok: false, reason: `unsupported URL scheme: ${url}` };
    }
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
  return parseManifest(body);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/manifest
```

Expected: 10 tests pass total.

- [ ] **Step 5: Commit**

```bash
git add src/lib/manifest.ts src/lib/manifest.test.ts
git commit -m "feat: fetchManifest supports file:// (mocks) and https:// (real children)"
```

---

### Task 2.3: Relative time formatter

**Files:**
- Create: `briefing-hub/src/lib/time.ts`
- Create: `briefing-hub/src/lib/time.test.ts`

Two functions, both pure. The hero uses long form ("5h ago"); the highlights list uses short form ("5h"). Splitting into two functions is cheaper than threading a format option everywhere.

- [ ] **Step 1: Write the failing test**

`src/lib/time.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toRelativeShort, toRelativeLong } from "./time";

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
  it("formats days for ≥24h ages", () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/time
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/time.ts`:

```ts
function diffMinutes(date: Date | string, now: Date): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.floor((now.getTime() - d.getTime()) / 60_000);
}

export function toRelativeShort(date: Date | string, now: Date = new Date()): string {
  const min = diffMinutes(date, now);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function toRelativeLong(date: Date | string, now: Date = new Date()): string {
  const short = toRelativeShort(date, now);
  if (short === "now") return "just now";
  return `${short} ago`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/time
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/time.ts src/lib/time.test.ts
git commit -m "feat: relative time formatter (short '5h' + long '5h ago')"
```

---

### Task 2.4: Highlights merger

**Files:**
- Create: `briefing-hub/src/lib/highlights.ts`
- Create: `briefing-hub/src/lib/highlights.test.ts`

Takes the loaded manifests, flattens each `items[]` while remembering which briefing each item came from, sorts by `published_at` desc, takes top N (default 10).

- [ ] **Step 1: Write the failing test**

`src/lib/highlights.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mergeAndSortItems, type LoadedBriefing } from "./highlights";
import type { BriefingConfig } from "~/config/briefings";

const cfg = (slug: string): BriefingConfig => ({
  slug, name: slug, category: slug, accent: "#000",
  description: "", manifestUrl: "", siteUrl: "",
});

const loaded: LoadedBriefing[] = [
  {
    config: cfg("a"),
    manifest: {
      name: "a", category: "a", accent: "#000", description: "",
      url: "x", updated_at: "2026-04-22T00:00:00Z",
      items: [
        { title: "A1", source: "S", url: "u", published_at: "2026-04-22T10:00:00Z" },
        { title: "A2", source: "S", url: "u", published_at: "2026-04-20T10:00:00Z" },
      ],
    },
  },
  {
    config: cfg("b"),
    manifest: {
      name: "b", category: "b", accent: "#000", description: "",
      url: "x", updated_at: "2026-04-21T00:00:00Z",
      items: [
        { title: "B1", source: "S", url: "u", published_at: "2026-04-21T12:00:00Z" },
      ],
    },
  },
  {
    config: cfg("c"),
    manifest: {  // no items
      name: "c", category: "c", accent: "#000", description: "",
      url: "x", updated_at: "2026-04-22T00:00:00Z",
    },
  },
];

describe("mergeAndSortItems", () => {
  it("merges items from all loaded briefings, newest first", () => {
    const r = mergeAndSortItems(loaded);
    expect(r.map((x) => x.item.title)).toEqual(["A1", "B1", "A2"]);
  });

  it("attaches the source briefing config to each item", () => {
    const r = mergeAndSortItems(loaded);
    expect(r[0].briefing.slug).toBe("a");
    expect(r[1].briefing.slug).toBe("b");
  });

  it("respects the limit parameter", () => {
    const r = mergeAndSortItems(loaded, { limit: 2 });
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.item.title)).toEqual(["A1", "B1"]);
  });

  it("ignores briefings with no items", () => {
    const r = mergeAndSortItems(loaded);
    expect(r.find((x) => x.briefing.slug === "c")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/highlights
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/highlights.ts`:

```ts
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
  limit?: number;  // default 10
};

export function mergeAndSortItems(
  loaded: readonly LoadedBriefing[],
  opts: MergeOptions = {},
): Highlight[] {
  const limit = opts.limit ?? 10;
  const all: Highlight[] = [];
  for (const lb of loaded) {
    if (!lb.manifest.items) continue;
    for (const item of lb.manifest.items) {
      all.push({ briefing: lb.config, item });
    }
  }
  all.sort((a, b) => {
    const ta = new Date(a.item.published_at).getTime();
    const tb = new Date(b.item.published_at).getTime();
    return tb - ta;
  });
  return all.slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/highlights
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/highlights.ts src/lib/highlights.test.ts
git commit -m "feat: mergeAndSortItems (cross-briefing highlights feed)"
```

---

### Task 2.5: Hub orchestrator (load all briefings + pick latest)

**Files:**
- Create: `briefing-hub/src/lib/hub.ts`
- Create: `briefing-hub/src/lib/hub.test.ts`

`loadAll(briefings)` does the parallel fetch + classify into `loaded[]` and `failed[]`. `pickLatest(loaded[])` chooses the single most-recent `latest` for the Hero. Both pure modulo the fetcher injected as a parameter (default = real `fetchManifest`) — that lets tests inject deterministic fixtures without filesystem I/O.

- [ ] **Step 1: Write the failing test**

`src/lib/hub.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loadAll, pickLatest, type FailedBriefing } from "./hub";
import type { BriefingConfig } from "~/config/briefings";
import type { ParseResult } from "./manifest";

const cfg = (slug: string, manifestUrl: string): BriefingConfig => ({
  slug, name: slug, category: slug, accent: "#000",
  description: "", manifestUrl, siteUrl: "",
});

describe("loadAll", () => {
  const briefings = [
    cfg("a", "fixture://a"),
    cfg("b", "fixture://b"),
    cfg("c", "fixture://c"),
  ];

  it("classifies into loaded vs failed", async () => {
    const fakeFetch = async (url: string): Promise<ParseResult> => {
      if (url === "fixture://a") return {
        ok: true, manifest: {
          name: "a", category: "a", accent: "#000", description: "",
          url: "x", updated_at: "2026-04-22T00:00:00Z",
        },
      };
      if (url === "fixture://b") return { ok: false, reason: "boom" };
      return {
        ok: true, manifest: {
          name: "c", category: "c", accent: "#000", description: "",
          url: "x", updated_at: "2026-04-21T00:00:00Z",
        },
      };
    };
    const { loaded, failed } = await loadAll(briefings, fakeFetch);
    expect(loaded.map((l) => l.config.slug).sort()).toEqual(["a", "c"]);
    expect(failed.map((f: FailedBriefing) => f.config.slug)).toEqual(["b"]);
    expect(failed[0].reason).toBe("boom");
  });
});

describe("pickLatest", () => {
  it("returns the loaded briefing whose latest.published_at is newest", () => {
    const r = pickLatest([
      { config: cfg("a", ""), manifest: {
        name: "a", category: "a", accent: "#000", description: "",
        url: "x", updated_at: "x",
        latest: { title: "old", source: "s", url: "u", published_at: "2026-04-20T00:00:00Z" },
      }},
      { config: cfg("b", ""), manifest: {
        name: "b", category: "b", accent: "#000", description: "",
        url: "x", updated_at: "x",
        latest: { title: "new", source: "s", url: "u", published_at: "2026-04-22T00:00:00Z" },
      }},
    ]);
    expect(r?.briefing.slug).toBe("b");
    expect(r?.item.title).toBe("new");
  });

  it("returns null when no loaded briefing has a latest", () => {
    const r = pickLatest([
      { config: cfg("a", ""), manifest: {
        name: "a", category: "a", accent: "#000", description: "",
        url: "x", updated_at: "x",
      }},
    ]);
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/hub
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/hub.ts`:

```ts
import type { BriefingConfig } from "~/config/briefings";
import { fetchManifest, type ParseResult } from "./manifest";
import type { LoadedBriefing, Highlight } from "./highlights";

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
    briefings.map(async (config) => ({ config, result: await fetcher(config.manifestUrl) })),
  );
  const loaded: LoadedBriefing[] = [];
  const failed: FailedBriefing[] = [];
  for (const { config, result } of results) {
    if (result.ok) loaded.push({ config, manifest: result.manifest });
    else failed.push({ config, reason: result.reason });
  }
  return { loaded, failed };
}

export function pickLatest(loaded: readonly LoadedBriefing[]): Highlight | null {
  let best: Highlight | null = null;
  let bestTime = -Infinity;
  for (const lb of loaded) {
    if (!lb.manifest.latest) continue;
    const t = new Date(lb.manifest.latest.published_at).getTime();
    if (t > bestTime) {
      bestTime = t;
      best = { briefing: lb.config, item: lb.manifest.latest };
    }
  }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/hub
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub.ts src/lib/hub.test.ts
git commit -m "feat: loadAll + pickLatest (orchestration with injectable fetcher)"
```

---

### Task 2.6: Global tokens & base styles (no theme layer yet)

**Files:**
- Create: `briefing-hub/src/styles/tokens.css`
- Create: `briefing-hub/src/styles/base.css`

`tokens.css` defines color + scale CSS variables and the **Theme C defaults** for fonts. Chunk 3 will add `themes.css` that overrides the font variables for theme-a / theme-b. Splitting now means Chunk 3 doesn't have to rewrite anything in `base.css`.

- [ ] **Step 1: Write `src/styles/tokens.css`**

Mirror the variables already proven in [mockups/index.html](../../../mockups/index.html). Only the `:root` block (Theme C default) is here; theme A/B variants come in Chunk 3.

```css
:root {
  --bg: #f9f7f2;
  --ink: #1a1a1a;
  --ink-soft: #555;
  --rule: #d8d4ca;
  --card: #ffffff;

  --podcast: #b44;
  --youtube: #2d4a3e;
  --daily: #1a3a6b;
  --legal: #6b2d5c;
  --economist: #e3120b;

  --scale: 1;
  --base: calc(16px * var(--scale));

  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
  --font-body:    'Inter', -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
  --font-mono:    'IBM Plex Mono', ui-monospace, "SF Mono", monospace;

  --display-weight: 700;
  --display-style: normal;
  --h2-weight: 600;
  --label-case: uppercase;
  --label-letter: 1px;
  --label-weight: 500;
  --display-letter: -2px;
}
```

- [ ] **Step 2: Write `src/styles/base.css`**

Port the body / masthead / hero / grid / card / highlights styles from `mockups/index.html`. Drop the options-panel and theme-a/b/c rules — those land in Chunk 3.

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: var(--base); }
body {
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--ink);
  line-height: 1.55;
  padding: 48px 32px 96px;
  -webkit-font-smoothing: antialiased;
  font-feature-settings: "ss01", "cv11";
}
.container { max-width: 1080px; margin: 0 auto; }

.mast {
  border-bottom: 1px solid var(--ink);
  padding-bottom: 24px;
  margin-bottom: 40px;
}
.mast-meta {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: var(--label-letter);
  color: var(--ink-soft);
  margin-bottom: 14px;
  text-transform: var(--label-case);
  font-weight: var(--label-weight);
}
.mast h1 {
  font-family: var(--font-display);
  font-size: 3rem;
  font-weight: var(--display-weight);
  font-style: var(--display-style);
  letter-spacing: var(--display-letter);
  line-height: 1;
}
.mast-sub {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-soft);
  margin-top: 14px;
  letter-spacing: 0.3px;
}

.hero {
  background: var(--card);
  padding: 32px;
  margin-bottom: 48px;
  border-left: 3px solid var(--ink);
}
.hero-label {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: var(--label-letter);
  margin-bottom: 14px;
  font-weight: var(--label-weight);
  text-transform: var(--label-case);
}
.hero h2 {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: var(--h2-weight);
  line-height: 1.25;
  margin-bottom: 16px;
  letter-spacing: -0.5px;
}
.hero-source {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-soft);
}

.section-h {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: var(--label-letter);
  color: var(--ink-soft);
  margin-bottom: 20px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--rule);
  text-transform: var(--label-case);
  font-weight: var(--label-weight);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 48px;
}
.card {
  background: var(--card);
  padding: 24px;
  border: 1px solid var(--rule);
  transition: transform 0.15s;
  text-decoration: none;
  color: inherit;
  display: block;
}
.card:hover { transform: translateY(-2px); }
.card-cat {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  letter-spacing: var(--label-letter);
  margin-bottom: 16px;
  font-weight: var(--label-weight);
  text-transform: var(--label-case);
}
.card h3 {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: var(--h2-weight);
  margin-bottom: 8px;
  line-height: 1.2;
  letter-spacing: -0.3px;
}
.card-desc {
  font-size: 0.8125rem;
  color: var(--ink-soft);
  margin-bottom: 20px;
}
.card-meta {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--ink-soft);
  border-top: 1px solid var(--rule);
  padding-top: 12px;
}
.card.coming { opacity: 0.5; }
.card.placeholder {
  opacity: 0.6;
  cursor: not-allowed;
}

.highlights ol { list-style: none; }
.hl-item {
  display: grid;
  grid-template-columns: 90px 1fr 80px;
  gap: 20px;
  padding: 14px 0;
  border-bottom: 1px solid var(--rule);
  align-items: baseline;
}
.hl-cat {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  letter-spacing: var(--label-letter);
  font-weight: var(--label-weight);
  text-transform: var(--label-case);
}
.hl-title {
  font-family: var(--font-body);
  font-size: 0.9375rem;
  line-height: 1.4;
  font-weight: 500;
  color: inherit;
  text-decoration: none;
}
.hl-title:hover { text-decoration: underline; }
.hl-time {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--ink-soft);
  text-align: right;
}

@media (max-width: 720px) {
  .grid { grid-template-columns: 1fr; }
  .mast h1 { font-size: 2.25rem; }
  body { padding: 32px 20px 64px; }
}
```

- [ ] **Step 3: Wire styles into `BaseLayout.astro`**

Replace the layout written in Chunk 1 with one that pulls in the fonts (Inter + IBM Plex Mono) + tokens + base CSS.

```astro
---
import "~/styles/tokens.css";
import "~/styles/base.css";

interface Props {
  title: string;
}
const { title } = Astro.props;
---
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href={`${import.meta.env.BASE_URL}favicon.svg`} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 4: Verify the build still succeeds**

```bash
npm run build
```

Expected: 0 errors, `dist/briefing-hub/index.html` regenerates with the new stylesheets linked.

- [ ] **Step 5: Commit**

```bash
git add src/styles/ src/layouts/BaseLayout.astro
git commit -m "feat: tokens + base styles ported from mockup (Theme C defaults inline)"
```

---

### Task 2.7: Render components (Masthead, HeroLatest, BriefingCard, PlaceholderCard, HighlightsList)

**Files:**
- Create: `briefing-hub/src/components/Masthead.astro`
- Create: `briefing-hub/src/components/HeroLatest.astro`
- Create: `briefing-hub/src/components/BriefingCard.astro`
- Create: `briefing-hub/src/components/PlaceholderCard.astro`
- Create: `briefing-hub/src/components/HighlightsList.astro`

Each component is a typed Astro component reading props and rendering. No interactivity. Logic-free — domain logic stays in `lib/`. Components are validated by `astro check` (TS) in Step 6 and by Chunk 3's e2e test.

- [ ] **Step 1: Write `src/components/Masthead.astro`**

```astro
---
interface Props {
  date: Date;
  weekNumber: number;
}
const { date, weekNumber } = Astro.props;

const yyyy = date.getUTCFullYear();
const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
const dd = String(date.getUTCDate()).padStart(2, "0");
---
<header class="mast">
  <div class="mast-meta">{yyyy}-{mm}-{dd} · Week {weekNumber}</div>
  <h1>Briefing Hub</h1>
  <div class="mast-sub">// 5 briefings · one room · pick your read</div>
</header>
```

- [ ] **Step 2: Write `src/components/HeroLatest.astro`**

```astro
---
import type { Highlight } from "~/lib/highlights";
import { toRelativeLong } from "~/lib/time";

interface Props {
  highlight: Highlight;
}
const { highlight } = Astro.props;
const { briefing, item } = highlight;
---
<section class="hero" style={`border-left-color: ${briefing.accent};`}>
  <div class="hero-label" style={`color: ${briefing.accent};`}>
    {briefing.category} · Latest
  </div>
  <h2><a href={item.url} style="color: inherit; text-decoration: none;">{item.title}</a></h2>
  <div class="hero-source">{item.source} · {toRelativeLong(item.published_at)}</div>
</section>
```

- [ ] **Step 3: Write `src/components/BriefingCard.astro`**

For the `comingSoon` branch, render a `<div>` (not an anchor) — an `<a>` without `href` is not a real link and breaks keyboard / hover semantics. Mockup uses `<div class="card coming">` for the same reason.

```astro
---
import type { LoadedBriefing } from "~/lib/highlights";
import { toRelativeLong } from "~/lib/time";

interface Props {
  loaded: LoadedBriefing;
}
const { loaded } = Astro.props;
const { config, manifest } = loaded;
const updated = toRelativeLong(manifest.updated_at);
const cardStyle = `border-left: 3px solid ${config.accent};`;
const catStyle = `color: ${config.accent};`;
---
{config.comingSoon ? (
  <div class="card coming" style={cardStyle}>
    <div class="card-cat" style={catStyle}>{config.category}</div>
    <h3>{config.name}</h3>
    <div class="card-desc">{config.description}</div>
    <div class="card-meta">// coming soon</div>
  </div>
) : (
  <a class="card" href={config.siteUrl} style={cardStyle}>
    <div class="card-cat" style={catStyle}>{config.category}</div>
    <h3>{config.name}</h3>
    <div class="card-desc">{config.description}</div>
    <div class="card-meta">updated {updated}</div>
  </a>
)}
```

- [ ] **Step 4: Write `src/components/PlaceholderCard.astro`**

Used for briefings whose manifest fetch / parse failed. Per DESIGN.md §9 resolution we show "점검 중" (check status). Last-known timestamp is a Phase 2 enhancement; for now it just says "데이터 불러오기 실패".

```astro
---
import type { FailedBriefing } from "~/lib/hub";

interface Props {
  failed: FailedBriefing;
}
const { failed } = Astro.props;
const { config } = failed;
---
<div
  class="card placeholder"
  style={`border-left: 3px solid ${config.accent};`}
>
  <div class="card-cat" style={`color: ${config.accent};`}>{config.category}</div>
  <h3>{config.name}</h3>
  <div class="card-desc">점검 중 — 데이터 불러오기 실패</div>
  <div class="card-meta">// {failed.reason}</div>
</div>
```

- [ ] **Step 5: Write `src/components/HighlightsList.astro`**

```astro
---
import type { Highlight } from "~/lib/highlights";
import { toRelativeShort } from "~/lib/time";

interface Props {
  items: readonly Highlight[];
}
const { items } = Astro.props;
---
<section class="highlights">
  <h2 class="section-h">This week</h2>
  <ol>
    {items.map(({ briefing, item }) => (
      <li class="hl-item">
        <span class="hl-cat" style={`color: ${briefing.accent};`}>{briefing.category}</span>
        <a class="hl-title" href={item.url}>{item.title}</a>
        <span class="hl-time">{toRelativeShort(item.published_at)}</span>
      </li>
    ))}
  </ol>
</section>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx astro check
```

Expected: 0 errors, 0 warnings (components have no consumers yet, but their types must be valid in isolation).

- [ ] **Step 7: Commit**

```bash
git add src/components/
git commit -m "feat: page components (masthead, hero, card, placeholder, highlights)"
```

---

### Task 2.8: Wire `index.astro` (build-time fetch + render)

**Files:**
- Modify: `briefing-hub/src/pages/index.astro`

The page component runs at build time on Node, calls `loadAll` once, and threads results into the section components. Computing the ISO week number is a 6-line helper kept inline since it's used in exactly one place.

- [ ] **Step 1: Replace `src/pages/index.astro`**

```astro
---
import BaseLayout from "~/layouts/BaseLayout.astro";
import Masthead from "~/components/Masthead.astro";
import HeroLatest from "~/components/HeroLatest.astro";
import BriefingCard from "~/components/BriefingCard.astro";
import PlaceholderCard from "~/components/PlaceholderCard.astro";
import HighlightsList from "~/components/HighlightsList.astro";
import { BRIEFINGS } from "~/config/briefings";
import { loadAll, pickLatest } from "~/lib/hub";
import { mergeAndSortItems } from "~/lib/highlights";

const { loaded, failed } = await loadAll(BRIEFINGS);
const hero = pickLatest(loaded);
const highlights = mergeAndSortItems(loaded);

// ISO week number (Mon-start) per ISO-8601
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

const now = new Date();

// Render order: loaded children in BRIEFINGS order, then failed (placeholder) cards.
// This way the grid keeps a stable layout even when a child goes down.
const cardSlots = BRIEFINGS.map((cfg) => {
  const lb = loaded.find((l) => l.config.slug === cfg.slug);
  if (lb) return { kind: "loaded" as const, lb };
  const fb = failed.find((f) => f.config.slug === cfg.slug);
  if (fb) return { kind: "failed" as const, fb };
  return null;
}).filter((s): s is NonNullable<typeof s> => s !== null);
---
<BaseLayout title="Briefing Hub">
  <div class="container">
    <Masthead date={now} weekNumber={isoWeek(now)} />

    {hero && <HeroLatest highlight={hero} />}

    <h2 class="section-h">Briefings</h2>
    <div class="grid">
      {cardSlots.map((slot) =>
        slot.kind === "loaded"
          ? <BriefingCard loaded={slot.lb} />
          : <PlaceholderCard failed={slot.fb} />
      )}
    </div>

    {highlights.length > 0 && <HighlightsList items={highlights} />}
  </div>
</BaseLayout>
```

- [ ] **Step 2: Build and inspect output**

```bash
npm run build
```

Expected: 0 errors. Look at the build log — it should print no warnings about missing manifests since all five `mocks/*.json` are present.

```bash
grep -c "Why the Bond Market" dist/briefing-hub/index.html
```

Expected: ≥1 (hero rendered the latest podcast item).

```bash
grep -c "card" dist/briefing-hub/index.html
```

Expected: ≥6 (5 cards + class refs).

- [ ] **Step 3: Curl-smoke the preview server**

```bash
npm run preview -- --host 127.0.0.1 --port 4321 &
PREVIEW_PID=$!
trap 'kill $PREVIEW_PID 2>/dev/null' EXIT

for i in {1..30}; do
  if curl -sf http://127.0.0.1:4321/briefing-hub/ > /dev/null; then break; fi
  sleep 1
done

# Assert the three sections are present
HTML=$(curl -s http://127.0.0.1:4321/briefing-hub/)
echo "$HTML" | grep -q "Briefing Hub" || { echo "FAIL: masthead missing"; exit 1; }
echo "$HTML" | grep -q "Latest" || { echo "FAIL: hero missing"; exit 1; }
echo "$HTML" | grep -q "This week" || { echo "FAIL: highlights missing"; exit 1; }
echo "OK"

kill $PREVIEW_PID 2>/dev/null
trap - EXIT
```

Expected: prints `OK`.

- [ ] **Step 4: Test the failure path manually**

Temporarily break one mock to verify the placeholder card renders. The script asserts the grep count rather than just printing it, so the step fails loudly if the placeholder isn't rendered.

```bash
mv mocks/podcast-briefing.json mocks/podcast-briefing.json.bak
npm run build
PLACEHOLDER_COUNT=$(grep -c "점검 중" dist/briefing-hub/index.html || true)
mv mocks/podcast-briefing.json.bak mocks/podcast-briefing.json
[ "$PLACEHOLDER_COUNT" -ge 1 ] || { echo "FAIL: expected ≥1 placeholder, got $PLACEHOLDER_COUNT"; exit 1; }
echo "OK: placeholder rendered when mock missing"
```

Expected: `OK: placeholder rendered when mock missing`.

Now confirm restoration didn't leave behind a stale build:

```bash
npm run build
RESTORED_COUNT=$(grep -c "점검 중" dist/briefing-hub/index.html || true)
[ "$RESTORED_COUNT" -eq 0 ] || { echo "FAIL: expected 0 placeholders after restore, got $RESTORED_COUNT"; exit 1; }
echo "OK: clean rebuild after mock restore"
```

Expected: `OK: clean rebuild after mock restore`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: wire index.astro (build-time loadAll + hero + cards + highlights)"
```

---

## Chunk 2 Exit Criteria

- `npm test` passes all unit tests (parseManifest, fetchManifest, time, highlights, hub) — 24 tests across 5 files
- `npm run build` writes a populated `dist/briefing-hub/index.html` with masthead, hero (latest podcast item), 5 cards, and highlights list
- Failure path verified: removing a mock surfaces a "점검 중" placeholder card, restoring the mock removes it
- No theme switcher yet — page renders in Theme C (default) only
- ~10 commits total in Chunk 2, all green
- File responsibility check:
  - `manifest.ts` ≤ ~120 lines (types + parser + fetcher only)
  - `hub.ts` ≤ ~60 lines
  - `index.astro` ≤ ~70 lines (orchestration + ISO-week helper inline)
  - No component file exceeds ~40 lines

---

## Chunk 3: Theme Layer & Options Panel & E2E Smoke

Goal: per-user runtime preferences (theme A/B/C + text size) toggled via a gear button, persisted in `localStorage`, with FOUC prevention. Playwright smoke test asserts the persistence end-to-end.

Architecture:
- **`src/styles/themes.css`** adds `:root.theme-a` / `:root.theme-b` blocks that override the font variables `tokens.css` defines for Theme C. No JS yet — pure CSS layer.
- **`src/lib/prefs.ts`** is the pure prefs module: types, defaults, parse, serialize. Tested with Vitest.
- **An inline FOUC-prevention script in `BaseLayout.astro` `<head>`** reads `localStorage` and `<html>`'s `data-default-theme` and applies the class on the document element synchronously, before stylesheets render the body. This avoids a flash of Theme C when a user has Theme A saved.
- **`src/components/OptionsPanel.astro`** contains the gear button, the slide-out panel, the panel-specific CSS, and the script that wires click handlers and persists changes. The panel-specific CSS is scoped to `.opts-*` classes and stays in this file (not `base.css`) so the whole panel is one cohesive unit.

### Task 3.1: `prefs.ts` (pure module: types, defaults, load/save)

**Files:**
- Create: `briefing-hub/src/lib/prefs.ts`
- Create: `briefing-hub/src/lib/prefs.test.ts`

The pure piece is testable with Vitest. The DOM-touching piece (read/write localStorage, mutate `<html>` class) goes inline in BaseLayout / OptionsPanel — too small for a separate browser-only module, and Vitest in node env can't exercise `document` cleanly without jsdom.

- [ ] **Step 1: Write the failing test**

`src/lib/prefs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  DEFAULT_PREFS,
  SIZE_SCALES,
  parsePrefs,
  serializePrefs,
  type Prefs,
} from "./prefs";

describe("DEFAULT_PREFS", () => {
  it("matches DESIGN.md (Theme C, default size)", () => {
    expect(DEFAULT_PREFS).toEqual({ theme: "c", size: "default" });
  });
});

describe("SIZE_SCALES", () => {
  it("maps each size to the documented multiplier", () => {
    expect(SIZE_SCALES.compact).toBe(0.9);
    expect(SIZE_SCALES.default).toBe(1);
    expect(SIZE_SCALES.large).toBe(1.15);
  });
});

describe("parsePrefs", () => {
  it("returns defaults for null/undefined input", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("")).toEqual(DEFAULT_PREFS);
  });

  it("returns defaults for invalid JSON", () => {
    expect(parsePrefs("not json")).toEqual(DEFAULT_PREFS);
  });

  it("merges partial prefs over defaults", () => {
    expect(parsePrefs(JSON.stringify({ theme: "a" }))).toEqual({
      theme: "a", size: "default",
    });
    expect(parsePrefs(JSON.stringify({ size: "large" }))).toEqual({
      theme: "c", size: "large",
    });
  });

  it("rejects unknown theme values", () => {
    expect(parsePrefs(JSON.stringify({ theme: "z" }))).toEqual(DEFAULT_PREFS);
  });

  it("rejects unknown size values", () => {
    expect(parsePrefs(JSON.stringify({ size: "huge" }))).toEqual(DEFAULT_PREFS);
  });
});

describe("serializePrefs", () => {
  it("round-trips through parsePrefs", () => {
    const p: Prefs = { theme: "b", size: "large" };
    expect(parsePrefs(serializePrefs(p))).toEqual(p);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/prefs
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/prefs.ts`:

```ts
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
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PREFS };
  }
  if (typeof obj !== "object" || obj === null) return { ...DEFAULT_PREFS };
  const o = obj as { theme?: unknown; size?: unknown };
  return {
    theme: VALID_THEMES.has(o.theme as Theme) ? (o.theme as Theme) : DEFAULT_PREFS.theme,
    size: VALID_SIZES.has(o.size as Size) ? (o.size as Size) : DEFAULT_PREFS.size,
  };
}

export function serializePrefs(prefs: Prefs): string {
  return JSON.stringify(prefs);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/prefs
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prefs.ts src/lib/prefs.test.ts
git commit -m "feat: prefs module (types, defaults, parse, serialize)"
```

---

### Task 3.2: Theme overlay CSS (theme-a / theme-b)

**Files:**
- Create: `briefing-hub/src/styles/themes.css`
- Create: `briefing-hub/public/fonts.css` (loads Paperlogy webfont when needed)

Theme C is already the `:root` default in `tokens.css`. The overlay file only contains the A and B variants — so when no class is set, C wins; when `theme-a` or `theme-b` is added to `<html>`, those vars take over.

The Paperlogy `@font-face` declarations live in a separate `public/fonts.css` so we can load them only when Theme B is active (CSS-only conditional load isn't free; for MVP we just always include the file — Paperlogy is small, ~60KB across three weights). Phase-2 polish can switch to JS-driven font loading.

- [ ] **Step 1: Write `src/styles/themes.css`**

```css
/* ── Theme A — Editorial / Georgia ───────────────── */
:root.theme-a {
  --font-display: Georgia, "Times New Roman", serif;
  --font-body:    Georgia, "Times New Roman", serif;
  --font-mono:    Georgia, "Times New Roman", serif;
  --display-weight: 400;
  --display-style: italic;
  --h2-weight: 400;
  --label-letter: 2px;
  --label-weight: 400;
  --display-letter: -1px;
}

/* ── Theme B — Korean Sans / Paperlogy ───────────── */
:root.theme-b {
  --font-display: 'Paperlogy', -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
  --font-body:    'Paperlogy', -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
  --font-mono:    'Paperlogy', -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
  --display-weight: 800;
  --display-style: normal;
  --h2-weight: 600;
  --label-letter: 2px;
  --label-weight: 800;
  --display-letter: -1.5px;
}
```

- [ ] **Step 2: Write `public/fonts.css`**

```css
@font-face {
  font-family: 'Paperlogy';
  font-weight: 400;
  src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-4Regular.woff2') format('woff2');
  font-display: swap;
}
@font-face {
  font-family: 'Paperlogy';
  font-weight: 600;
  src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-6SemiBold.woff2') format('woff2');
  font-display: swap;
}
@font-face {
  font-family: 'Paperlogy';
  font-weight: 800;
  src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-8ExtraBold.woff2') format('woff2');
  font-display: swap;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/themes.css public/fonts.css
git commit -m "feat: theme A/B CSS overlays + Paperlogy webfont"
```

---

### Task 3.3: OptionsPanel component (gear + panel + script)

**Files:**
- Create: `briefing-hub/src/components/OptionsPanel.astro`

The panel is one cohesive unit (markup + scoped CSS + script) so it lives in one file. Astro's `<style>` block is scoped to the component automatically. The `<script>` is a no-op in SSR — it runs in the browser only.

The script is short enough to inline. It does three things:
1. On click of a theme/size label, update `prefs` and `localStorage` and reapply.
2. On gear click, toggle panel.
3. On reset, restore defaults.

Reading prefs from storage is **also** done in the inline FOUC-prevention script (Task 3.4) so the body never paints with the wrong theme. This component just handles user interactions.

- [ ] **Step 1: Write `src/components/OptionsPanel.astro`**

```astro
---
import { DEFAULT_PREFS, SIZE_SCALES, STORAGE_KEY } from "~/lib/prefs";
const themes = [
  { value: "c", name: "C · Neutral",     hint: "Inter + Plex" },
  { value: "a", name: "A · Editorial",   hint: "Georgia" },
  { value: "b", name: "B · Korean Sans", hint: "Paperlogy" },
];
const sizes = [
  { value: "compact", name: "−" },
  { value: "default", name: "Default" },
  { value: "large",   name: "+" },
];
---
<button class="opts-toggle" id="optsToggle" aria-label="Reading preferences" title="Reading preferences">⚙</button>

<aside class="opts-panel" id="optsPanel" aria-hidden="true">
  <div class="opts-section">
    <h4>Theme</h4>
    <div class="opts-row" data-pref="theme">
      {themes.map((t) => (
        <label data-value={t.value}>
          <input type="radio" name="theme" value={t.value} />
          <span class="opt-name">{t.name}</span>
          <span class="opt-hint">{t.hint}</span>
        </label>
      ))}
    </div>
  </div>

  <div class="opts-section">
    <h4>Text size</h4>
    <div class="opts-row size-row" data-pref="size">
      {sizes.map((s) => (
        <label data-value={s.value}>
          <input type="radio" name="size" value={s.value} />
          <span class="opt-name">{s.name}</span>
        </label>
      ))}
    </div>
  </div>

  <div class="opts-foot">
    Saved to your browser. Hub remembers your choice next time.
    <button class="opts-reset" id="optsReset">Reset to defaults</button>
  </div>
</aside>

<style>
  .opts-toggle {
    position: fixed; top: 16px; right: 16px;
    width: 36px; height: 36px; border-radius: 50%;
    background: var(--ink); color: var(--bg); border: 0;
    cursor: pointer; font-size: 18px;
    display: flex; align-items: center; justify-content: center;
    z-index: 200; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    font-family: inherit;
  }
  .opts-toggle:hover { transform: rotate(45deg); transition: transform 0.2s; }

  .opts-panel {
    position: fixed; top: 64px; right: 16px;
    width: 280px;
    background: var(--card); border: 1px solid var(--rule);
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    padding: 20px; z-index: 199;
    font-family: var(--font-mono);
    transform: translateX(calc(100% + 32px));
    transition: transform 0.25s ease;
  }
  .opts-panel.open { transform: translateX(0); }
  .opts-panel h4 {
    font-size: 0.625rem; letter-spacing: 1.5px;
    text-transform: uppercase; color: var(--ink-soft);
    margin-bottom: 10px; font-weight: 500;
  }
  .opts-section { margin-bottom: 22px; }
  .opts-section:last-child { margin-bottom: 0; }
  .opts-row { display: flex; flex-direction: column; gap: 6px; }
  .opts-row label {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border: 1px solid var(--rule);
    cursor: pointer; font-size: 0.8125rem;
    transition: background 0.1s;
  }
  .opts-row label:hover { background: var(--bg); }
  .opts-row label.checked {
    background: var(--ink); color: var(--bg); border-color: var(--ink);
  }
  .opts-row input { display: none; }
  .opts-row .opt-name { font-weight: 500; }
  .opts-row .opt-hint { color: var(--ink-soft); font-size: 0.6875rem; margin-left: auto; }
  .opts-row label.checked .opt-hint { color: rgba(255,255,255,0.6); }
  .opts-row.size-row { flex-direction: row; gap: 6px; }
  .opts-row.size-row label { flex: 1; justify-content: center; text-align: center; }
  .opts-foot {
    margin-top: 16px; padding-top: 14px;
    border-top: 1px solid var(--rule);
    font-size: 0.6875rem; color: var(--ink-soft); line-height: 1.5;
  }
  .opts-reset {
    margin-top: 8px; background: none;
    border: 1px solid var(--rule); padding: 4px 8px;
    font-size: 0.6875rem; cursor: pointer;
    font-family: inherit; color: var(--ink-soft);
  }
  @media (max-width: 720px) {
    .opts-panel { width: calc(100vw - 32px); }
  }
</style>

<script
  define:vars={{
    STORAGE_KEY,
    DEFAULTS: DEFAULT_PREFS,
    SIZES: SIZE_SCALES,
  }}
>
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      const theme = ["a", "b", "c"].includes(parsed?.theme) ? parsed.theme : DEFAULTS.theme;
      const size = ["compact", "default", "large"].includes(parsed?.size) ? parsed.size : DEFAULTS.size;
      return { theme, size };
    } catch { return { ...DEFAULTS }; }
  }
  function save(prefs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); }
  function apply(prefs) {
    const root = document.documentElement;
    root.classList.remove("theme-a", "theme-b", "theme-c");
    root.classList.add("theme-" + prefs.theme);
    root.style.setProperty("--scale", String(SIZES[prefs.size] ?? 1));
    document.querySelectorAll(".opts-row label").forEach((l) => l.classList.remove("checked"));
    document.querySelectorAll(".opts-row").forEach((row) => {
      const value = prefs[row.dataset.pref];
      const label = row.querySelector('label[data-value="' + value + '"]');
      if (label) {
        label.classList.add("checked");
        const input = label.querySelector("input");
        if (input) input.checked = true;
      }
    });
  }

  let prefs = load();
  apply(prefs);

  const toggle = document.getElementById("optsToggle");
  const panel = document.getElementById("optsPanel");
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("open");
    panel.setAttribute("aria-hidden", panel.classList.contains("open") ? "false" : "true");
  });

  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && e.target !== toggle && panel.classList.contains("open")) {
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
    }
  });

  document.querySelectorAll(".opts-row label").forEach((label) => {
    label.addEventListener("click", (e) => {
      e.preventDefault();
      const row = label.closest(".opts-row");
      prefs = { ...prefs, [row.dataset.pref]: label.dataset.value };
      save(prefs);
      apply(prefs);
    });
  });

  document.getElementById("optsReset").addEventListener("click", () => {
    prefs = { ...DEFAULTS };
    save(prefs);
    apply(prefs);
  });
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/OptionsPanel.astro
git commit -m "feat: OptionsPanel (gear + slide-out + theme/size controls)"
```

---

### Task 3.4: Wire theming + FOUC-prevention into BaseLayout

**Files:**
- Modify: `briefing-hub/src/layouts/BaseLayout.astro`

The FOUC-prevention script is small enough to inline in `<head>`. It reads localStorage synchronously before any styles paint, sets the `theme-x` class on `<html>`, and applies the size scale. If localStorage has nothing, it falls back to `<html data-default-theme>` which is set from the env var `PUBLIC_HUB_DEFAULT_THEME`.

- [ ] **Step 1: Replace `src/layouts/BaseLayout.astro`**

```astro
---
import "~/styles/tokens.css";
import "~/styles/themes.css";
import "~/styles/base.css";
import { DEFAULT_PREFS, STORAGE_KEY } from "~/lib/prefs";
import OptionsPanel from "~/components/OptionsPanel.astro";

interface Props {
  title: string;
}
const { title } = Astro.props;
const defaultTheme = import.meta.env.PUBLIC_HUB_DEFAULT_THEME ?? DEFAULT_PREFS.theme;
const baseUrl = import.meta.env.BASE_URL;
---
<!DOCTYPE html>
<html lang="ko" data-default-theme={defaultTheme} class={`theme-${defaultTheme}`}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href={`${baseUrl}favicon.svg`} />
    <link rel="stylesheet" href={`${baseUrl}fonts.css`} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <title>{title}</title>
    <script is:inline define:vars={{ STORAGE_KEY, DEFAULT_THEME: defaultTheme }}>
      // FOUC prevention: apply user's theme/size before body paints.
      // Validation logic is intentionally duplicated from src/lib/prefs.ts —
      // is:inline scripts can't import modules, and we need this to run
      // synchronously in <head> before any paint. OptionsPanel re-applies
      // identically on hydrate (idempotent, no flicker).
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const stored = raw ? JSON.parse(raw) : null;
        const theme = ["a", "b", "c"].includes(stored?.theme) ? stored.theme : DEFAULT_THEME;
        const size = ["compact", "default", "large"].includes(stored?.size) ? stored.size : "default";
        const scale = { compact: 0.9, default: 1, large: 1.15 }[size];
        const root = document.documentElement;
        root.classList.remove("theme-a", "theme-b", "theme-c");
        root.classList.add("theme-" + theme);
        root.style.setProperty("--scale", String(scale));
      } catch {}
    </script>
  </head>
  <body>
    <slot />
    <OptionsPanel />
  </body>
</html>
```

The slot comes before `<OptionsPanel />` so screen readers and keyboard users hit page content first; the panel is announced/tabbed last as supplementary controls. Visually it's still anchored top-right via `position: fixed` (DESIGN.md §7 says "마스트헤드 우상단" — interpreted as visual anchor, not DOM nesting, since the panel must follow scroll).

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

Expected: 0 errors. Output `dist/briefing-hub/index.html` contains the inline FOUC script and the gear button.

```bash
grep -c "optsToggle" dist/briefing-hub/index.html
grep -c "FOUC prevention" dist/briefing-hub/index.html
```

Expected: ≥1 each.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat: wire OptionsPanel + FOUC-prevention script + default theme env"
```

---

### Task 3.5: Playwright e2e smoke

**Files:**
- Create: `briefing-hub/tests/e2e/hub.spec.ts`

E2e covers the runtime concerns Vitest can't: real localStorage persistence, real DOM class toggling, real reload behavior. Five focused tests, no broad UI assertions.

- [ ] **Step 1: Write the smoke spec**

Per-test localStorage isolation is essential — the "theme-a persists" test would otherwise pollute the "default theme is C" test if Playwright reuses contexts.

```ts
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  // Each test starts with empty storage so default-theme assertions are stable.
  await context.addInitScript(() => {
    try { localStorage.clear(); } catch {}
  });
});

test.describe("Briefing Hub — page render", () => {
  test("masthead, hero, cards, highlights all present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1", { hasText: "Briefing Hub" })).toBeVisible();
    await expect(page.locator(".hero h2")).toBeVisible();
    await expect(page.locator(".card").first()).toBeVisible();
    await expect(page.locator(".section-h", { hasText: "This week" })).toBeVisible();
  });

  test("default theme is C (no class set or theme-c set)", async ({ page }) => {
    await page.goto("/");
    const themeClass = await page.locator("html").getAttribute("class");
    expect(themeClass).toContain("theme-c");
  });
});

test.describe("Briefing Hub — options panel", () => {
  test("gear button toggles the panel open/closed", async ({ page }) => {
    await page.goto("/");
    const panel = page.locator("#optsPanel");

    // Closed initially
    await expect(panel).toHaveAttribute("aria-hidden", "true");

    await page.locator("#optsToggle").click();
    await expect(panel).toHaveAttribute("aria-hidden", "false");

    await page.locator("#optsToggle").click();
    await expect(panel).toHaveAttribute("aria-hidden", "true");
  });

  test("clicking theme A applies the class to <html> and persists across reload", async ({ page }) => {
    await page.goto("/");
    await page.locator("#optsToggle").click();
    await page.locator('.opts-row[data-pref="theme"] label[data-value="a"]').click();

    await expect(page.locator("html")).toHaveClass(/theme-a/);
    await expect(page.locator("html")).not.toHaveClass(/theme-c/);

    // Reload — class should still be theme-a (FOUC prevention script restored from localStorage)
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/theme-a/);
  });

  test("text size 'large' scales root --scale to 1.15", async ({ page }) => {
    await page.goto("/");
    await page.locator("#optsToggle").click();
    await page.locator('.opts-row[data-pref="size"] label[data-value="large"]').click();

    const scale = await page.locator("html").evaluate(
      (el) => getComputedStyle(el).getPropertyValue("--scale").trim(),
    );
    expect(scale).toBe("1.15");
  });

  test("reset button restores defaults", async ({ page }) => {
    await page.goto("/");
    await page.locator("#optsToggle").click();
    await page.locator('.opts-row[data-pref="theme"] label[data-value="b"]').click();
    await expect(page.locator("html")).toHaveClass(/theme-b/);

    await page.locator("#optsReset").click();
    await expect(page.locator("html")).toHaveClass(/theme-c/);
  });
});
```

- [ ] **Step 2: Run e2e**

```bash
npm run test:e2e
```

Expected: 5 tests pass in chromium. Note Playwright will spin up `npm run build && npm run preview` per `playwright.config.ts`, so first run takes ~30s.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/hub.spec.ts
git commit -m "test: e2e smoke (page render, panel toggle, theme persist, size scale, reset)"
```

---

## Chunk 3 Exit Criteria

- `npm test` passes 32 unit tests (Chunk 2's 24 + prefs's 8)
- `npm run test:e2e` passes 5 Playwright tests in chromium
- The built page renders in the user's saved theme on reload (no FOUC)
- All three themes are switchable from the gear panel; size scale changes via CSS var
- File responsibility check:
  - `themes.css` ≤ 30 lines (only A/B overlays — C is in `tokens.css`)
  - `prefs.ts` ≤ 50 lines (pure module, no DOM)
  - `OptionsPanel.astro` ≤ ~180 lines (markup + scoped CSS + script — one cohesive unit)
  - `BaseLayout.astro` ≤ 50 lines (now hosts the FOUC-prevention script too)

---

## Chunk 4: GitHub Actions, Deploy, README

Goal: a fully automated build-and-deploy pipeline that runs on push to main, on a daily cron (06:00 KST), and on `repository_dispatch` from child sites. README documents one-time GitHub setup and developer workflow.

This chunk produces no new application code — only CI/CD config and docs. Chunk 1–3's exit criteria gate on local `npm test` and `npm run test:e2e`; Chunk 4 layers in CI execution of the same commands plus deploy.

### Task 4.1: CI test workflow

**Files:**
- Create: `briefing-hub/.github/workflows/test.yml`

A separate `test.yml` runs unit + e2e on every push and PR. Branch protection (set up manually in Step 4 of Task 4.4) gates merges on this passing. Mirrors youtube-briefing's separation of test from deploy.

- [ ] **Step 1: Write `.github/workflows/test.yml`**

Job display names are `unit` and `playwright` — these are the labels GitHub uses for branch-protection status checks, so they must match exactly what Task 4.4 Step 5 (and README) reference.

```yaml
name: test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  unit:
    name: unit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
      - run: npm ci
      - run: npm test

  playwright:
    name: playwright
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
      - run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: vitest + playwright on push/pr"
```

---

### Task 4.2: Deploy + scheduled rebuild workflow

**Files:**
- Create: `briefing-hub/.github/workflows/rebuild.yml`

One workflow handles all trigger types — push to main, daily cron, manual dispatch, and `repository_dispatch` from child sites (Phase 1B will start sending these). The single workflow keeps the deploy permission scope contained to one file.

- [ ] **Step 1: Write `.github/workflows/rebuild.yml`**

```yaml
name: rebuild-and-deploy

# Triggers:
# - push:                 deploy on main updates (config, content, code)
# - schedule:             nightly safety net at 06:00 KST (UTC 21:00)
# - repository_dispatch:  child site (Phase 1B+) finished publishing
# - workflow_dispatch:    manual rebuild button in Actions UI

on:
  push:
    branches: [main]
    paths:
      - "src/**"
      - "public/**"
      - "mocks/**"
      - "astro.config.mjs"
      - "package.json"
      - "package-lock.json"
      - ".github/workflows/rebuild.yml"
  schedule:
    - cron: "0 21 * * *"   # 06:00 KST
  repository_dispatch:
    types: [briefing-updated]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    name: build astro
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        env:
          # Optional: set this in repo Settings → Variables if you want
          # CI to override the first-time-visitor default theme.
          PUBLIC_HUB_DEFAULT_THEME: ${{ vars.PUBLIC_HUB_DEFAULT_THEME }}
        run: npm run build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist/briefing-hub

  deploy:
    name: deploy to github pages
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

Note the artifact path is `dist/briefing-hub` (not `dist`). With `base: "/briefing-hub"`, Astro writes the site into a subdirectory; uploading just that subdirectory gives GH Pages the correct site root.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/rebuild.yml
git commit -m "ci: deploy + cron + dispatch rebuild workflow"
```

---

### Task 4.3: README

**Files:**
- Create: `briefing-hub/README.md`

The README is the entry point for any future agent or human. Three sections: what it is, how to develop, how to deploy. Architecture detail lives in DESIGN.md — README links to it instead of duplicating.

- [ ] **Step 1: Write `briefing-hub/README.md`**

````markdown
# briefing-hub

Portal hub for KP's briefing sites. Aggregates the latest item from each child briefing into one Latest Hero, a card grid of all briefings, and a 10-item cross-briefing highlights feed.

**Live:** <https://kipeum86.github.io/briefing-hub/>
**Spec:** [DESIGN.md](./DESIGN.md)
**Mockup (interactive):** [mockups/index.html](./mockups/index.html)

## Architecture (1-minute read)

- **Static Astro site** — built on push, on a daily cron, and on `repository_dispatch` from child sites.
- **Build-time fetch** — at build, the hub reads each child's `/manifest.json` (declared in [`src/config/briefings.ts`](./src/config/briefings.ts)) and renders cards/hero/highlights from the data. Phase 1A points at local `mocks/*.json`; Phase 1B will switch to real child URLs.
- **Runtime preferences** — gear button in the top-right opens an options panel for theme (A Editorial / B Korean Sans / C Neutral) and text size (compact/default/large), persisted in `localStorage`.
- **Graceful degradation** — if a child's manifest is missing or invalid, the build still succeeds; that briefing renders as a "점검 중" placeholder card.

Full details in [DESIGN.md](./DESIGN.md).

## Developer workflow

### Prerequisites

- Node.js 20
- npm (bundled with Node)

### One-time setup

```sh
git clone https://github.com/kipeum86/briefing-hub.git
cd briefing-hub
npm install
npx playwright install chromium    # first time only — for e2e tests
```

### Daily commands

| Command                | What it does                                              |
|------------------------|-----------------------------------------------------------|
| `npm run dev`          | Astro dev server with HMR at <http://localhost:4321>      |
| `npm run build`        | Type-check + production build to `dist/briefing-hub/`     |
| `npm run preview`      | Serve the production build locally for sanity checks      |
| `npm test`             | Vitest unit tests (manifest, time, highlights, hub, prefs)|
| `npm run test:watch`   | Vitest in watch mode                                      |
| `npm run test:e2e`     | Playwright smoke tests (panel, theme persist, size)       |

### Adding a new briefing

1. Add an entry to `BRIEFINGS` in [`src/config/briefings.ts`](./src/config/briefings.ts) (slug, name, category, accent, description, manifestUrl, siteUrl).
2. If still in Phase 1A: add a `mocks/<slug>.json` matching the [DESIGN.md §4 schema](./DESIGN.md#4-매니페스트-계약).
3. If the child site is live: ensure it serves `/manifest.json` and is reachable from the build runner.
4. The accent color shows up in `card-cat` labels; pick a color distinct from the existing ones.

### Changing the default theme

Set `PUBLIC_HUB_DEFAULT_THEME` to `a`, `b`, or `c` at build time. Existing visitors keep whatever they have in `localStorage`; only first-time visitors see the new default.

```sh
PUBLIC_HUB_DEFAULT_THEME=a npm run build
```

In CI, set this in the GitHub repo's variables (Settings → Secrets and variables → Actions → Variables).

## Deploy

### One-time GitHub setup

1. Push the repo to <https://github.com/kipeum86/briefing-hub>.
2. **Settings → Pages** → Source: `GitHub Actions`.
3. **Settings → Branches → Branch protection rule for `main`**:
   - Require status check `unit` to pass before merging.
   - Require status check `playwright` to pass before merging.

### Automatic triggers

The `rebuild-and-deploy` workflow runs on:

- Push to `main` (paths: `src/**`, `public/**`, `mocks/**`, configs)
- Daily at 06:00 KST (cron `0 21 * * *` UTC) — safety net
- `repository_dispatch` event of type `briefing-updated` — sent by child sites in Phase 1B
- Manual: Actions → rebuild-and-deploy → Run workflow

### Manual rebuild

```sh
gh workflow run rebuild-and-deploy.yml
```

## Project structure

```
.github/workflows/  CI test + deploy
mocks/              Phase 1A mock manifests (deleted in Phase 1B)
public/             Static assets (favicon, fonts.css)
src/
  config/           BRIEFINGS list (single source of truth)
  lib/              Pure modules: manifest, time, highlights, hub, prefs
  components/       Astro components (Masthead, HeroLatest, BriefingCard, ...)
  styles/           tokens.css (Theme C defaults), themes.css (A/B), base.css
  layouts/          BaseLayout (FOUC script + meta + slot)
  pages/            index.astro (the only page)
tests/e2e/          Playwright smoke
docs/superpowers/   Plans + brainstorm artifacts
mockups/            HTML mockups (reference, not built)
DESIGN.md           Full spec
```

## Related

- [podcast-briefing](https://github.com/kipeum86/podcast-briefing) — child
- [youtube-briefing](https://github.com/kipeum86/youtube-briefing) — child
- daily-brief, game-legal-briefing, economist-briefing — Phase 2/3
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README (architecture summary, dev commands, deploy steps)"
```

---

### Task 4.4: Manual GitHub setup (human action — not scriptable)

This task is for the human operator. It runs once. Document it here so the agent doesn't get stuck trying to automate it.

**Files:** none (manual GitHub UI actions).

- [ ] **Step 1: Create the GitHub repo**

Precondition: Chunk 1 Task 1.1 already ran `git init` and made the initial commit. Verify with `git log --oneline | head -3` before running the next command.

```sh
gh repo create kipeum86/briefing-hub --public --source=. --remote=origin
```

Or via the GitHub UI: <https://github.com/new>, name `briefing-hub`, public, do NOT initialize with README/license/.gitignore (we already have them). Then `git remote add origin https://github.com/kipeum86/briefing-hub.git`.

- [ ] **Step 2: Push main**

```sh
git push -u origin main
```

Expected: both workflows trigger (`test` and `rebuild-and-deploy`).

- [ ] **Step 3: Enable GitHub Pages**

Go to <https://github.com/kipeum86/briefing-hub/settings/pages>:

- **Source:** GitHub Actions
- (no branch selection needed — the workflow uploads the artifact directly)

- [ ] **Step 4: Verify the deploy**

```sh
gh run watch
```

When the run completes, visit <https://kipeum86.github.io/briefing-hub/> — the masthead, hero, 5 cards, and highlights should render with mock data.

- [ ] **Step 5: Set up branch protection**

<https://github.com/kipeum86/briefing-hub/settings/branches> → Add rule for `main`:

- ✓ Require a pull request before merging
- ✓ Require status checks to pass before merging:
  - `unit`
  - `playwright`

This is optional for solo development but matches the youtube-briefing pattern and keeps a regression net once Phase 1B starts adding child-side dispatch tokens.

---

## Chunk 4 Exit Criteria

- `.github/workflows/test.yml` runs unit + e2e on push and PR
- `.github/workflows/rebuild.yml` builds + deploys on push to `main`, daily cron, `repository_dispatch`, and manual dispatch
- `README.md` documents architecture link, dev commands, env vars, deploy steps, project structure
- After Task 4.4 manual setup: <https://kipeum86.github.io/briefing-hub/> renders the hub with mock data
- File responsibility check:
  - `test.yml` ≤ 40 lines
  - `rebuild.yml` ≤ 60 lines
  - `README.md` ≤ 150 lines
- All Chunk 1–3 exit criteria still hold (no regressions)

---

## Plan A — Final Exit Criteria

When all four chunks complete:

- ✓ `npm test` passes 32 unit tests
- ✓ `npm run test:e2e` passes 5 Playwright tests
- ✓ `npm run build` produces `dist/briefing-hub/index.html` populated from `mocks/*.json`
- ✓ Site deployed to <https://kipeum86.github.io/briefing-hub/>
- ✓ Theme A/B/C and text size switch via gear panel, persist across reload
- ✓ "점검 중" placeholder renders when a mock is removed
- ✓ Daily cron + `repository_dispatch` trigger configured (dispatch will be exercised by Phase 1B)

**Next:** Phase 1B — child site integrations (manifest endpoint + HubChip + dispatch step in `podcast-briefing` and `youtube-briefing`). Tracked separately in `2026-04-22-briefing-hub-phase1b-children.md`.
