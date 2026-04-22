# Briefing Hub — 설계안

**날짜**: 2026-04-22
**상태**: 브레인스토밍 완료, 스펙 확정 단계
**리포지토리 예정명**: `briefing-hub`
**배포 예정 URL**: `https://kipeum86.github.io/briefing-hub/`

---

## 1. 배경 & 목적

### 문제

KP가 Astro로 구축한 브리핑 사이트들이 각자 따로 배포되어 있음:

- **podcast-briefing** — 10개 영어 팟캐스트, 주간 (`kipeum86.github.io/podcast-briefing/`)
- **youtube-briefing** — 6개 한국 채널, 주간 (`kipeum86.github.io/youtube-briefing/`)
- **daily-brief** — 글로벌 매크로 + 국내 뉴스, 매일
- **game-legal-briefing** — 게임 업계 법규/판례, 주간
- **economist-briefing** — (개발 예정) Economist 유료구독 기사 큐레이션

각자 다른 URL에 분산되어 있어 방문 동선이 번거롭고, 각자 다른 디자인(에디토리얼 세리프 vs Paperlogy sans vs 미정)이라 "한 공간에 합치면 컨플릭트"가 발생함.

### 목표

**기존 사이트 디자인을 그대로 두면서**, 전체를 한 번에 조망할 수 있는 **허브 페이지**를 새 리포로 만든다. 허브는 각 자식 사이트를 "포장"할 뿐 대체하지 않는다.

### 비목표

- 기존 사이트들의 디자인/기능 리팩토링 (youtube-briefing은 이미 /plan-design-review로 락인됨)
- 모든 콘텐츠를 한 피드로 통합 (= Option C "Unified Feed" 거부)
- 탭 전환 방식 (= Option B "Tabs" 거부 — 셸과 탭 내부의 디자인 이질감)

---

## 2. 검토된 접근법 & 결정

| 질문 | 옵션 | 선택 | 이유 |
|---|---|---|---|
| 통합 방식 | A. Portal 허브 / B. Tabs / C. Unified Feed | **A** | 기존 레포 무손상, 확장성 최고 |
| 허브의 "살아있음" 정도 | A. 정적 링크 / B. 메타데이터 / C. 풀 피드 | **B** | 살아있는 느낌 유지 + 각 사이트 독립성 유지 |
| 돌아가기 버튼 | A. 상단 마스트헤드 / B. Inline 헤더 / C. 플로팅 칩 | **C** | 기존 디자인 절대 안 건드림 (youtube-briefing 락인 상태 존중) |
| 배포 아키텍처 | A. GH Pages 서브패스 / B. 커스텀 도메인 서브패스 / C. 서브도메인 | **A** | 오늘부터 작동, 나중에 `briefing.kpsfamily.com` 이사 가능 |
| 이름 | A. `Briefing Hub` / B. `Briefing` / C. 한국어 / D. 개인 브랜드 | **A** | 기능을 직관적으로 전달 |
| 업데이트 주기 | daily cron / + `repository_dispatch` 트리거 | **둘 다** | cron은 안전망, dispatch로 즉시 반영 |

---

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────┐
│  kipeum86.github.io/briefing-hub/   (허브, 이 리포)   │
│  ─ 정적 Astro 사이트                                  │
│  ─ 빌드타임에 각 자식의 manifest.json을 fetch          │
│  ─ 매일 06:00 KST cron rebuild                        │
│  ─ 자식이 publish 시 repository_dispatch로 즉시 rebuild│
└───────────────────┬─────────────────────────────────┘
                    │ fetch /manifest.json  (same-origin, CORS 문제 없음)
                    ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ podcast-     │ │ youtube-     │ │ daily-brief  │ │ game-legal-  │ │ economist-   │
│ briefing     │ │ briefing     │ │              │ │ briefing     │ │ briefing     │
│              │ │              │ │              │ │              │ │  (예정)       │
│ /manifest.json│ │ /manifest.json│ │ /manifest.json│ │ /manifest.json│ │ /manifest.json│
│ + HubChip    │ │ + HubChip    │ │ + HubChip    │ │ + HubChip    │ │ + HubChip    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### 구성 요소

**허브 (이 리포)**
- Astro 정적 사이트 (podcast/youtube와 동일 스택)
- 빌드타임에 `BRIEFINGS` 리스트의 각 URL에서 `/manifest.json` fetch → 카드 데이터 생성
- GitHub Pages 배포
- `.github/workflows/rebuild.yml`: daily cron + `repository_dispatch` 핸들러

**자식 사이트들 (5개)**
- 각자 `public/manifest.json` 생성 스텝을 빌드 파이프라인에 추가 (5분 작업/사이트)
- 각자 BaseLayout에 `<HubChip />` 삽입 (4~6줄 컴포넌트 copy-paste, shared npm 패키지 없음 → coupling 회피)
- 배포 성공 시 `repository_dispatch` 로 허브 레포에 rebuild 신호 발송

---

## 4. 매니페스트 계약

각 자식은 `/manifest.json`을 루트에 노출한다.

```json
{
  "name": "Podcast Briefing",
  "category": "PODCAST",
  "accent": "#b44",
  "description": "10개 영어 팟캐스트 · 주간",
  "url": "https://kipeum86.github.io/podcast-briefing/",
  "updated_at": "2026-04-22T05:00:00Z",
  "latest": {
    "title": "Why the Bond Market Can't Agree on Recession",
    "source": "Odd Lots · Bloomberg",
    "url": "https://kipeum86.github.io/podcast-briefing/odd-lots-bond-market/",
    "published_at": "2026-04-22T05:00:00Z"
  },
  "items": [
    {
      "title": "...",
      "source": "...",
      "url": "...",
      "published_at": "..."
    }
  ]
}
```

### 필드

- `name` (required) — 카드 제목
- `category` (required) — 카드 상단 라벨 (예: `"PODCAST"`, `"YOUTUBE"`, `"DAILY · MACRO"`)
- `accent` (required) — 카드 라벨 색상. 각 사이트의 브랜드 accent
- `description` (required) — 카드 설명 한 줄
- `url` (required) — 카드 클릭 시 이동할 사이트 루트
- `updated_at` (required) — ISO 8601 UTC. 카드에 "최근: N시간 전" 표시
- `latest` (optional) — 허브 최상단 "Latest Hero"와 "이번 주 하이라이트" 피드에서 사용
- `items[]` (optional) — 최근 7일 또는 최근 5개 아이템. "이번 주 하이라이트" 구성

### 누락 필드 처리

허브는 graceful degradation. `latest`가 없으면 카드만 표시, `items`가 없으면 하이라이트 피드에서 제외. 필수 필드(`name`, `category`, `accent`, `description`, `url`, `updated_at`)가 빠지면 해당 카드는 "점검 중" 플레이스홀더로 대체.

---

## 5. HubChip (돌아가기 칩)

### 시각 스펙

- **위치**: 화면 우상단 fixed, top: 16px / right: 16px
- **크기**: 패딩 6px 12px, 폰트 11px
- **색상**: 각 사이트의 accent 컬러를 배경으로 사용 (per-site native 느낌)
  - podcast-briefing → 배경 `#1a1a1a` 또는 `#b44`
  - youtube-briefing → 배경 `#2d4a3e`
  - daily-brief → 배경 `#1a3a6b` (예정)
  - game-legal-briefing → 배경 `#6b2d5c` (예정)
  - economist-briefing → 배경 `#e3120b` (예정)
- **타이포그래피**: 각 사이트의 폰트 상속 (Georgia / Paperlogy / 등)
- **텍스트**: `← BRIEFING HUB` (또는 `← Briefing Hub` — 사이트 타이포 케이스 룰 따름)
- **동작**: 클릭 시 `HUB_URL` 환경변수로 이동. 스크롤해도 따라옴 (position fixed)

### 구현

각 자식 레포의 `src/components/HubChip.astro` (4~6줄 컴포넌트):

```astro
---
const hubUrl = import.meta.env.PUBLIC_HUB_URL ?? "https://kipeum86.github.io/briefing-hub/";
---
<a href={hubUrl} class="hub-chip">← Briefing Hub</a>

<style>
  .hub-chip {
    position: fixed; top: 16px; right: 16px;
    padding: 6px 12px; font-size: 11px;
    background: var(--accent); color: var(--bg);
    text-decoration: none; letter-spacing: 1px;
    z-index: 100;
  }
</style>
```

`BaseLayout.astro`에 `<HubChip />` 한 줄 삽입. 빌드타임 환경변수 `PUBLIC_HUB_URL`로 오버라이드 가능 → 나중에 도메인 이사 시 env만 바꾸면 됨.

---

## 6. 배포 & 빌드

### 허브 측

```yaml
# .github/workflows/rebuild.yml
on:
  schedule:
    - cron: "0 21 * * *"  # 06:00 KST (UTC 21:00)
  repository_dispatch:
    types: [briefing-updated]
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci && npm run build
      - uses: actions/deploy-pages@v4
```

Astro 빌드 중 `BRIEFINGS` 리스트의 각 URL에서 `manifest.json`을 fetch → props로 주입. 한 사이트가 offline이어도 나머지는 정상 렌더 (per-site try/catch).

### 자식 측

각 자식 레포의 기존 deploy workflow 마지막에 추가:

```yaml
- name: Notify Briefing Hub
  run: |
    curl -X POST \
      -H "Authorization: token ${{ secrets.HUB_DISPATCH_TOKEN }}" \
      -H "Accept: application/vnd.github.v3+json" \
      https://api.github.com/repos/kipeum86/briefing-hub/dispatches \
      -d '{"event_type":"briefing-updated","client_payload":{"source":"podcast-briefing"}}'
```

`HUB_DISPATCH_TOKEN`은 `repo` scope를 가진 fine-grained PAT, 각 자식 레포 secrets에 동일하게 저장.

---

## 7. 허브 페이지 레이아웃

목업 `portal-expanded.html`에서 확정한 구조:

1. **마스트헤드** — "Briefing Hub" + 날짜 + ISO 주
2. **Latest Hero** — 모든 자식의 `latest` 중 가장 최신인 한 건
3. **카드 그리드** — 3×2 (데스크톱), 1열 스택 (모바일). 각 카드: 카테고리 라벨(accent 컬러) / 이름 / 설명 / 최근 업데이트 시간
4. **이번 주 하이라이트** — 모든 자식의 `items`를 날짜순 머지, 최근 10개, 카테고리 태그 + 제목 한 줄씩
5. **확장 슬롯** — `+ 새 브리핑 추가` 가이드 대시보드 타일 (추후 자식 추가 시 가이드)

### 허브 자체 디자인

- **타이포그래피**: **Theme C — Inter + IBM Plex Mono (Neutral / Framework)** 가 기본값. 허브를 의도적으로 "대시보드/프레임워크"로 포지셔닝하여 자식 사이트들과 시각적 계층을 분리한다.
  - 본문/제목: Inter (400/500/600/700/800)
  - 메타·라벨·시간: IBM Plex Mono (400/500)
  - 한글 폴백: -apple-system, "Apple SD Gothic Neo", "Pretendard"
- **런타임 옵션 패널 (Reading Preferences)**: 마스트헤드 우상단에 톱니 아이콘. 클릭 → 슬라이드아웃 패널.
  - **Theme**: A (Editorial · Georgia) / B (Korean Sans · Paperlogy) / C (Neutral · Inter+Plex) — 라디오 선택, 클릭 즉시 적용
  - **Text size**: Compact / Default / Large — 베이스 폰트 사이즈 0.9× / 1.0× / 1.15× 스케일
  - **저장**: `localStorage.briefing-hub:prefs` (JSON), 페이지 재방문 시 복원. 미설정 시 기본값 (Theme C / Default size).
  - **구현**: 세 테마는 CSS 변수 (`--font-display`, `--font-body`, `--font-mono`, `--scale`) 한 겹으로 추상화. 테마 전환은 `:root` 클래스 토글 (`theme-a` / `theme-b` / `theme-c`) — JS는 클래스만 바꾸고 CSS가 변수를 재정의.
  - **빌드타임 디폴트 오버라이드**: 환경변수 `PUBLIC_HUB_DEFAULT_THEME=a|b|c`로 신규 방문자 기본값 변경 가능 (기존 방문자 localStorage는 보존).
  - **인터랙티브 목업**: [mockups/index.html](mockups/index.html) — 옵션 패널 그대로 동작. 정적 비교용 단독 파일은 [typo-a-georgia.html](mockups/typo-a-georgia.html) / [typo-b-paperlogy.html](mockups/typo-b-paperlogy.html) / [typo-c-neutral.html](mockups/typo-c-neutral.html).
- 배경: `#f9f7f2` 중립 톤
- Accent: 허브 자체 accent 없음. 각 카드의 카테고리 라벨에만 자식의 accent 노출

---

## 8. Phase 1 (MVP) 스코프

**Phase 1에 포함 (오늘 시작 가능)**
- 허브 리포 생성, Astro scaffolding
- 허브 페이지: 마스트헤드 + 카드 그리드 + 이번 주 하이라이트
- `podcast-briefing`, `youtube-briefing`에 `manifest.json` 빌드 스텝 추가
- 두 사이트에 `<HubChip />` 삽입
- daily cron rebuild

**Phase 2 (MVP 안정화 후)**
- `daily-brief`, `game-legal-briefing` 편입 (manifest + chip)
- `repository_dispatch` 트리거 연결

**Phase 3 (economist-briefing 완성 후)**
- economist-briefing 편입
- 허브 디자인 고도화 (Open Question 해결)

---

## 9. 열린 질문 → 결정 / 보류

**MVP 진입 전 결정 (2026-04-22)**

1. ~~허브 자체 타이포그래피~~ → **결정: Theme C (Inter + Plex Mono)** 기본값 + CSS 변수 기반 A/B/C 스왑 인프라 (§7)
2. ~~Latest Hero 규칙~~ → **결정: 모든 자식 `latest` 중 `published_at` 최신 1건**. 카테고리 핀/사용자 선택은 Phase 3 이후 검토.
5. ~~에러 UX~~ → **결정: "점검 중" 라벨 + last known `updated_at` 시각 유지**. 자식 매니페스트 fetch 실패 시 직전 빌드의 캐시값 보존.

**Phase 2 이후 재논의**

3. **매니페스트 저장 주기** — 각 자식이 매 빌드마다 새로 생성 vs 변경 시에만 업데이트
4. **모바일 우선순위** — 카드 그리드를 세로 스택 외에 carousel 등 검토?
6. **PAT 관리** — `HUB_DISPATCH_TOKEN` 만료 회전 정책 (GitHub PAT은 최대 1년)

---

## 10. 다음 단계

1. 이 문서 리뷰 + 열린 질문 #1~6 중 MVP에 필요한 것만 결정
2. `docs/superpowers/specs/2026-04-22-briefing-hub-design.md`로 정식 스펙 이관 (또는 이 문서를 그대로 스펙으로 승격)
3. spec-document-reviewer 서브에이전트 리뷰 루프
4. `writing-plans` 스킬로 구현 플랜 전환
5. Phase 1 구현 시작 (허브 리포 scaffold)

---

## 참고

- **관련 프로젝트**
  - [podcast-briefing](../podcast-briefing/) — Astro, editorial (Georgia), #b44 accent
  - [youtube-briefing](../youtube-briefing/) — Astro, Paperlogy, #2d4a3e accent, 디자인 락인됨
  - [daily-brief](../daily-brief/) — 매일
  - [game-legal-briefing](../game-legal-briefing/) — 주간
  - [economist-briefing](../economist-briefing/) — 2026-04-22 브레인스토밍 시작, 별도 트랙
- **브레인스토밍 목업**
  - 3가지 접근법 비교: `.superpowers/brainstorm/288-1776798216/approaches.html`
  - 확장 포털: `.superpowers/brainstorm/288-1776798216/portal-expanded.html`
  - HubChip 3가지 treatment: `.superpowers/brainstorm/288-1776798216/back-button.html`
