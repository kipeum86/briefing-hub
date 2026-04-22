<div align="center">

# Briefing Hub

**Five briefings, one room. Pick your read.**

A static Astro portal that aggregates the latest item from each of KP's
briefing sites and renders them as a single, opinionated weekly view.

[**▸ Live site**](https://kipeum86.github.io/briefing-hub/) &nbsp;·&nbsp;
[Spec](./DESIGN.md) &nbsp;·&nbsp;
[Implementation plan](./docs/superpowers/plans/2026-04-22-briefing-hub-phase1a-hub.md) &nbsp;·&nbsp;
[Korean / 한국어](./README.ko.md)

[![test](https://github.com/kipeum86/briefing-hub/actions/workflows/test.yml/badge.svg)](https://github.com/kipeum86/briefing-hub/actions/workflows/test.yml)
[![deploy](https://github.com/kipeum86/briefing-hub/actions/workflows/rebuild.yml/badge.svg)](https://github.com/kipeum86/briefing-hub/actions/workflows/rebuild.yml)
[![license](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](./LICENSE)
[![astro](https://img.shields.io/badge/astro-5.x-FF5D01.svg)](https://astro.build/)

<br>

<img src="./docs/screenshots/hub-theme-c.png" alt="Briefing Hub — Theme C (Neutral, default)" width="780">

</div>

---

## What it does

KP runs five separate briefing sites — English podcasts, Korean YouTube,
daily macro, game-industry legal, and (soon) The Economist curation. Each lives
on its own Astro deploy with its own aesthetic. Reading them all meant
visiting five URLs.

Briefing Hub is the front door. It fetches each child site's
`/manifest.json` at build time, surfaces the most recent items in a
single card grid + cross-source highlights feed, and links straight to
the original source. The hub itself never tries to be the briefing — it's
the index above the briefings.

Updates run nightly on a `06:00 KST` cron, plus immediately on push or
when a child fires `repository_dispatch`.

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  kipeum86.github.io/briefing-hub/   (this repo)                    │
│                                                                    │
│  • Static Astro 5 site, deployed via GitHub Actions to GH Pages    │
│  • At build: parallel fetch of each child's /manifest.json         │
│  • One <BriefingCard> per slug + a merged "this week" feed         │
│  • Theme A/B/C + size scale — runtime, persisted to localStorage   │
│  • Graceful degradation — failed manifest -> "점검 중" placeholder │
└──────┬─────────────────────────────────────────────────────────────┘
       │ build-time fetch (https or file:// in dev)
       ▼
┌──────────────┬───────────────┬──────────────┬─────────────────┬────────────────────┐
│  podcast-    │  youtube-     │  daily-      │  game-legal-    │  economist-        │
│  briefing    │  briefing     │  brief       │  briefing       │  briefing (soon)   │
│  (Astro)     │  (Astro)      │  (Python)    │  (Python)       │                    │
│              │               │              │                 │                    │
│  /manifest   │  /manifest    │  /manifest   │  /manifest      │  ...               │
│  + HubChip   │  + HubChip    │  + HubChip   │  + HubChip      │                    │
└──────────────┴───────────────┴──────────────┴─────────────────┴────────────────────┘
```

Two contracts hold the system together:

1. **The manifest** — every child publishes `/manifest.json` matching
   [DESIGN.md §4](./DESIGN.md#4-매니페스트-계약). Required fields fail loudly;
   optional fields degrade gracefully.
2. **The HubChip** — every child renders a fixed-position chip linking
   back here, so the hub is reachable from anywhere in the constellation.

[`src/config/briefings.ts`](./src/config/briefings.ts) is the single
source of truth for which children the hub knows about.

## Themes

Three runtime themes, switchable via the gear in the top-right and
persisted per-browser. Each is the same data, the same layout, just a
different reading mode.

<div align="center">

| **C · Neutral** &nbsp; *(default)* | **A · Editorial** | **B · Korean Sans** |
|:--:|:--:|:--:|
| Inter + IBM Plex Mono | Georgia italic display | Paperlogy 800/600 |
| <img src="./docs/screenshots/hub-theme-c.png" width="260"> | <img src="./docs/screenshots/hub-theme-a.png" width="260"> | <img src="./docs/screenshots/hub-theme-b.png" width="260"> |

</div>

The options panel also adjusts text size (compact / default / large), and
both choices live under the localStorage key `briefing-hub:prefs`. A FOUC-
prevention inline script in `<head>` applies the saved theme synchronously
before paint, so reloading never flashes the default.

<div align="center">
<img src="./docs/screenshots/hub-options-open.png" alt="Options panel open" width="780">
</div>

## Quickstart

```sh
git clone https://github.com/kipeum86/briefing-hub.git
cd briefing-hub
npm install
npx playwright install chromium    # first-time only

npm run dev                         # http://localhost:4321
```

| Command              | What it does                                            |
|----------------------|---------------------------------------------------------|
| `npm run dev`        | Astro dev server with HMR                               |
| `npm run build`      | `astro check` + production build to `dist/`             |
| `npm run preview`    | Serve the production build for sanity checks            |
| `npm test`           | Vitest unit suite (manifest, time, highlights, prefs)   |
| `npm run test:e2e`   | Playwright smoke (panel, theme persist, size scale)     |

## Adding a briefing

1. Add an entry to `BRIEFINGS` in
   [`src/config/briefings.ts`](./src/config/briefings.ts) — `slug`, `name`,
   `category`, `accent`, `description`, `manifestUrl`, `siteUrl`. Pick an
   accent that doesn't collide with the existing ones.
2. **Pre-deploy**: drop a `mocks/<slug>.json` matching the
   [manifest schema](./DESIGN.md#4-매니페스트-계약) and use
   `manifestUrl: "file:./mocks/<slug>.json"`. Lets you build and preview
   without depending on the child site.
3. **When the child site is ready**: switch `manifestUrl` to the live
   `https://kipeum86.github.io/<slug>/manifest.json` and delete the mock.
4. On the child side, drop in a `/manifest.json` endpoint plus a
   `HubChip` component. Working examples:
   [youtube-briefing](https://github.com/kipeum86/youtube-briefing/blob/main/src/pages/manifest.json.ts)
   (Astro/TS),
   [daily-brief](https://github.com/kipeum86/daily-brief/blob/main/pipeline/render/manifest.py)
   (Python/Jinja).

## Deploy

The `rebuild-and-deploy` workflow fires on:

- Push to `main` (paths: `src/**`, `public/**`, `mocks/**`, configs)
- Daily cron at **06:00 KST** (`0 21 * * *` UTC) — safety net
- `repository_dispatch` event of type `briefing-updated` — fired by
  child sites when they finish publishing
- Manual: Actions → `rebuild-and-deploy` → Run workflow

Default theme for new visitors can be set via the
`PUBLIC_HUB_DEFAULT_THEME` repo variable (`a` / `b` / `c`). Existing
visitors keep their saved choice — only first-time loads see the change.

## Project structure

```text
.github/workflows/   test + deploy workflows
docs/
  screenshots/       README assets
  superpowers/       implementation plan
mocks/               local manifests for children that don't publish yet
mockups/             pre-build HTML mockups (interactive comparison page)
public/              favicon, fonts.css
src/
  components/        Masthead, BriefingCard, HighlightsList, OptionsPanel...
  config/            BRIEFINGS — single source of truth
  lib/               manifest, time, highlights, hub, prefs (TDD'd)
  layouts/           BaseLayout (FOUC script + meta + slot)
  pages/             index.astro — the only page
  styles/            tokens.css (Theme C defaults), themes.css (A/B), base.css
tests/e2e/           Playwright smoke
DESIGN.md            full spec
```

## The constellation

| Repo | Role | Stack |
|------|------|-------|
| **briefing-hub** *(this repo)* | Portal aggregator | Astro 5 + TS |
| [podcast-briefing](https://github.com/kipeum86/podcast-briefing) | 10 English podcasts, weekly | Python + Astro |
| [youtube-briefing](https://github.com/kipeum86/youtube-briefing) | 5 Korean YouTube channels + Mer's blog | Python + Astro |
| [daily-brief](https://github.com/kipeum86/daily-brief) | Global macro + Korean news, daily 06:30 KST | Python + Jinja |
| [game-legal-briefing](https://github.com/kipeum86/game-legal-briefing) | Game industry regulation, M/W/F | Python + Jinja |
| economist-briefing | The Economist curation | *Coming soon* |

## License

[Apache 2.0](./LICENSE) — built by [Kipeum Lee](https://github.com/kipeum86).
