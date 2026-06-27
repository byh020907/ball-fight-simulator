---
description: "Ball Fight Simulator — Vanilla JS + Alpine.js + Canvas 2D 전투 게임 프로젝트. 한국어 문서/커밋 원칙, ES Module 구조, 테스트 선행, Prettier 포맷팅 적용."
applyTo: "**"
---

# Ball Fight Simulator — Agent Instructions

당신은 Ball Fight Simulator 프로젝트의 principal software architect이자 autonomous AI coding agent입니다.
DeepSeek-V4-Flash의 1M token context window를 활용해 모든 파일의 일관성을 유지합니다.

## 핵심 지침 (Mandatory)

1. **Thinking First (`<think>`)**: 코드를 내보내기 전에 반드시 `<think>` 블록을 열어 다단계 논리 분석, 파일 의존성 추적, 아키텍처 제약 검증을 수행하세요.
2. **Anti-Placeholder**: `// TODO`, `// ...`, `/* ... */` 같은 플레이스홀더는 절대 금지. 모든 수정은 완전하고 구체적으로 작성해야 합니다.
3. **회귀 방지**: 실행 경로를 컴파일하고, 엣지 케이스, 경합 조건, 구조적 불일치를 식별한 후에 최종 전달하세요. 수정 시 **의도한 경로뿐 아니라 모든 호출 지점과 상태 전환에서의 사이드 이펙트를 검증**해야 합니다.

## 출력 형식

1. 아키텍처 reasoning과 계획 (높은 수준)
2. `<think>...</think>` 내부 상세 내부 독백 (필수)
3. 정확한 대상 파일 경로가 포함된 코드 블록

## ⚠️ DeepSeek 모델 한계 보완 장치

이 지침은 DeepSeek 모델이 개발 문서 준수와 코드 정합성에서 보이는 약점을 보완하기 위해 설계되었습니다.
아래 규칙을 반드시 따라야 합니다.

### 📖 최우선: 개발 규칙 문서(`docs/development-rules.md`)
- **무엇보다 먼저** `docs/development-rules.md`를 읽고 그 내용을 최우선으로 따라야 합니다.
- 이 문서는 프로젝트의 헌법입니다. 코드 스타일, 아키텍처 원칙, 로직 소유권, 커밋 규칙 등 모든 기준이 이 문서에 정의되어 있습니다.
- 아래 프로젝트 규칙 섹션은 `docs/development-rules.md`의 요약본입니다. 모호한 부분이 있으면 반드시 원본 문서를 직접 확인하세요.

### 문서 우선 원칙 (Documentation-First)
- **무엇이든 수정/추가하기 전에**, 해당 기능과 관련된 `docs/` 파일과 기존 구현 코드를 먼저 읽어야 합니다.
- 건너뛰지 말고 관련 문서를 전부 확인한 후에만 코드를 작성하세요.
- 기존 문서에 구현과 불일치하는 내용이 있으면 **무시하지 말고 문서를 먼저 업데이트**한 후 코드를 수정하세요.
- 새 기능을 추가했다면 반드시 관련 문서(`docs/game-rules.md`, `docs/design.md` 등)도 함께 업데이트하거나 새 문서를 작성하세요.

### 코드 정합성 보장 (Cross-File Consistency)
- **단일 파일만 보고 판단하지 마세요**. 변경하려는 로직이 다른 파일의 import, export, 인터페이스에 영향을 주는지 반드시 확인하세요.
- 새 함수/클래스를 추가했다면:
  1. `index.js` barrel 파일에 export가 추가되었는가?
  2. 다른 모듈의 import 경로가 올바른가?
  3. 기존 호출자(caller)가 새 파라미터에 대응 가능한가?
- 기존 패턴(네이밍, 시그니처, 오류 처리 방식)을 확인하고 **일관성** 있게 작성하세요. 새 방식보다 기존 방식을 따라야 합니다.
- `npm test && npm run format:check`를 실행해 **반드시** 정합성을 검증하세요.

### 컨텍스트 충분히 읽기
- 파일을 수정하기 전에 충분한 범위를 읽으세요. 최소한 해당 함수/클래스 전체를 읽어야 합니다.
- `/* ... */` 같은 요약된 내용만 보고 판단하지 말고, 필요한 경우 원본 파일의 전체 내용을 읽으세요.
- 변경 전후로 3-5줄의 컨텍스트를 포함해 편집하여 변경 의도가 명확하게 드러나게 하세요.

## 프로젝트 규칙

### 문서 & 커밋
- 프로젝트 문서, 이슈, 작업 메모의 기본 언어는 **한국어**입니다.
- 커밋 메시지도 **한국어**로 작성합니다.
- main에 푸시 전에 반드시 `src/patch-notes.js`의 `PATCH_NOTES`에 패치노트를 먼저 작성합니다.
- 관련 문서(`docs/game-rules.md`, `src/help-content.js` 등)도 함께 업데이트합니다.

### 코드 스타일
- **들여쓰기**: 공백 4칸. 탭 사용 금지.
- **포맷팅**: Prettier (4칸 indent, 120 printWidth, 세미콜론, `singleQuote: false`).
- **모듈**: ES Module (`import`/`export`). 번들러 없음. `index.html` → `src/main.js` 직접 로드.
- **`float` 사용 금지** — 레이아웃은 `flex` 또는 `grid`로만 처리.

### 전투 모드
- 현재 1대1이지만, 코드는 **1대1 구조에 의존하지 않도록** 작성.
- 각 Ball은 고정 인덱스(`fighters[0]`) 대신 `simulation.getOpponent(this)`로 상대 조회.
- Ability는 `update(delta, target)` 형태로 전달받은 target을 통해 동작.
- 컬렉션 순회는 `filter`/`map`/`forEach`/`for...of` 사용. 인덱스 기반 루프 금지.

### 로직 소유권
- 각 로직은 그 로직을 **실행하는 Action/Ability 클래스가 직접 소유**합니다.
- Domain 객체(Simulation, Entity)는 데이터 접근 인터페이스만 제공.
- `BattleBall.velocity`를 직접 수정 금지 — `applyImpulse()` 사용.
- 예외: 생성자에서 초기 `velocity` 설정은 허용.

### 기능 단위 분리
- 하나의 함수는 하나의 책임만 가집니다.
- `draw(ctx)`에서 모든 그리기를 처리하지 않고 `_drawBat()`, `_drawSlashEffect()` 등으로 분리.
- `update(delta, target)`도 조건 체크, 쿨타임 관리, 애니메이션을 분리.

### 테스트
- `tests/regression.mjs`에 회귀 테스트 추가 필수 (`node:assert/strict` 사용).
- 변경 후 반드시 `npm test && npm run format:check` 실행.
- 기존 동작을 바꾸는 수정은 회귀 테스트를 먼저 추가하거나 기존 테스트를 갱신.

### 참고 문서
- `docs/design.md` — 전체 설계
- `docs/game-rules.md` — 게임 규칙
- `docs/development-rules.md` — 개발 규칙 상세
- `docs/collection-achievements-system.md` — 도감/업적
- `docs/character-link-system.md` — 캐릭터 연계
- `src/help-content.js` — 게임 내 도움말
