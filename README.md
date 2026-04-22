# briefing-hub

KP의 브리핑 사이트들을 한 곳에서 훑어보는 Astro 허브입니다. 각 자식 사이트의 `manifest.json`을 빌드 타임에 읽어서 Latest Hero, 카드 그리드, 통합 하이라이트 피드를 렌더링합니다.

Live: <https://kipeum86.github.io/briefing-hub/>
Spec: [DESIGN.md](./DESIGN.md)
Mockup: [mockups/index.html](./mockups/index.html)

## Architecture

- Astro 정적 사이트입니다.
- `src/config/briefings.ts`가 허브가 아는 브리핑 목록의 단일 진실 공급원입니다.
- Phase 1A에서는 `mocks/*.json`을 읽고, Phase 1B에서 실제 child URL로 바꿉니다.
- 톱니 패널에서 Theme A/B/C와 텍스트 크기를 바꿀 수 있고, 선택은 `localStorage`에 저장됩니다.
- manifest가 깨지거나 누락돼도 빌드는 계속 진행되고, 해당 카드만 "점검 중" 플레이스홀더로 내려갑니다.

## Developer Workflow

### Prerequisites

- Node.js 20
- npm

### Setup

```sh
git clone https://github.com/kipeum86/briefing-hub.git
cd briefing-hub
npm install
npx playwright install chromium
```

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Astro dev server |
| `npm run build` | 타입 체크 + 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 로컬 확인 |
| `npm test` | Vitest 단위 테스트 |
| `npm run test:watch` | Vitest watch |
| `npm run test:e2e` | Playwright 스모크 테스트 |

### Add a briefing

1. `src/config/briefings.ts`에 항목을 추가합니다.
2. Phase 1A라면 `mocks/<slug>.json`도 추가합니다.
3. 실제 child site 단계라면 `/manifest.json`이 배포되도록 맞춥니다.

### Change the default theme

```sh
PUBLIC_HUB_DEFAULT_THEME=a npm run build
```

기존 방문자는 저장된 `localStorage` 값을 유지하고, 신규 방문자만 새 기본값을 받습니다.

## Deploy

### One-time GitHub setup

1. GitHub repo를 `kipeum86/briefing-hub`로 생성합니다.
2. Pages source를 `GitHub Actions`로 설정합니다.
3. `main` 브랜치 보호 규칙에 `unit`, `playwright` 체크를 연결합니다.

### Automatic triggers

- `main` push
- 매일 06:00 KST cron
- `repository_dispatch` (`briefing-updated`)
- 수동 `workflow_dispatch`

## Project Structure

```text
.github/workflows/  test + deploy workflows
mocks/              Phase 1A mock manifests
public/             favicon, fonts.css
src/
  components/       Masthead, HeroLatest, BriefingCard, OptionsPanel...
  config/           BRIEFINGS list
  lib/              manifest, time, highlights, hub, prefs
  layouts/          BaseLayout
  pages/            index.astro
  styles/           tokens, themes, base
tests/e2e/          Playwright smoke
docs/superpowers/   planning docs
mockups/            visual reference
DESIGN.md           full spec
```

## Related

- [podcast-briefing](https://github.com/kipeum86/podcast-briefing)
- [youtube-briefing](https://github.com/kipeum86/youtube-briefing)

