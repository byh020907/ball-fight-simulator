---
description: "Ball Fight Simulator — Vanilla JS + Alpine.js + Canvas 2D 전투 게임 프로젝트. 한국어 문서/커밋 원칙, ES Module 구조, 테스트 선행, Prettier 포맷팅 적용."
applyTo: "**"
---

# Ball Fight Simulator — Agent Instructions

## 세션 핸드오프 (Session Handoff)

### 시작 루틴
**새 대화 시작 시 가장 먼저** `SESSION-HANDOFF.md`(워크스페이스 루트)를 읽어 이전 결정 기록을 확인합니다.

### 결정 기록 (Decision Log)
`SESSION-HANDOFF.md` 하나로 모든 핵심 결정의 히스토리를 관리합니다.
**결정이 발생할 때마다 이 파일에 실시간으로 기록**하며, 단순 작업 목록이 아닌 결정 이력입니다.

#### 우선순위 레벨
| 레벨 | 의미 | 예시 |
|---|---|---|
| **[L1]** | 사용자가 구체적으로 직접 요청 | "시간 왜곡 버그 고쳐줘" |
| **[L2]** | AI 제안, 사용자가 긍정 응답("응", "그래" 등)으로 승인 | "HP 안전장치 추가할까요?" → "그래" |
| **[L3]** | AI 자체 판단 수정, 사용자 명시적 검토 없었음 | FIGHTER_IDS 누락 추가, 포맷 정리 |

L1, L2 위주로 기록하고 L3는 요약만 남깁니다.

#### 기록 형식
```markdown
# 결정 기록

## [L1] YYYY-MM-DD — {결정 제목}
- 맥락: {무엇이 문제였고 왜 이 결정을 했는지}
- 결정: {무엇을 어떻게 바꾸기로 했는지}
- 영향: {변경된 파일/시스템}

## [L2] YYYY-MM-DD — {결정 제목}
- 배경: {AI가 왜 제안했는지}
- 결정: {승인된 변경 내용}
- 영향: {변경 범위}
```

#### 갱신 타이밍
- L1/L2 결정 발생 즉시 `SESSION-HANDOFF.md`에 해당 항목 추가 또는 기존 관련 항목 수정
- 세션 종료 시에는 열려 있는 이슈와 다음 할 일만 끝에 추가

---

## 핵심 규칙

1. **문서 최우선**: `docs/development-rules.md`가 프로젝트 헌법. 모호하면 원본 확인. 새 기능은 관련 문서도 함께 업데이트.
2. **코드 정합성**: 단일 파일만 보지 말고 import/export/caller 영향 확인. 기존 패턴에 일관되게 작성.
3. **회귀 방지**: 수정 전후로 `npm test && npm run format:check` 실행. 시뮬레이션 스크립트(`scripts/*.mjs`)로 수치 검증 후 코드 수정.
4. **Anti-Placeholder**: `// TODO`, `/* ... */` 금지. 모든 수정은 완전하게.
5. **한국어**: 문서, 커밋 메시지, 사용자 응답은 한국어. 코드 식별자는 기존 JS 스타일 유지.

## 시뮬레이션 기반 검증

변경 전 **반드시 시뮬레이션 스크립트를 먼저 실행**합니다:
```
가설 → scripts/에 시뮬레이션 작성 → 실행 → 수치 확인 → 코드 수정 → 재검증 → scripts/ 제거 후 커밋
```
추측으로 코드를 수정하지 말고, `BattleSimulation`을 직접 생성하는 `.mjs` 파일로 정량적 지표를 확인하세요.

## 일괄 치환 규칙

**절대 PowerShell `Set-Content`로 소스 파일을 수정하지 않습니다.** 인코딩이 깨져 한글이 손상됩니다.
대신 Node.js로 처리합니다:
```bash
node -e "const fs=require('fs');let c=fs.readFileSync('파일','utf8');c=c.replace(/찾기/g,'바꾸기');fs.writeFileSync('파일',c,'utf8')"
```
`git checkout` 복구 시 미커밋 변경사항이 소실되므로, **작업 단위가 끝날 때마다 커밋**하여 보호합니다.

## 코드 스타일 요약

| 항목 | 규칙 |
|---|---|
| 들여쓰기 | 공백 4칸, 탭 금지 |
| 포맷팅 | Prettier (120 printWidth, 세미콜론, singleQuote: false) |
| 모듈 | ES Module, 번들러 없음 |
| 파일명 | `camelCase.js`, 디렉토리 `kebab-case` |
| 클래스/함수 | `PascalCase` / `camelCase` |
| CSS | `kebab-case`, 접두사 `ch-` |
| float | 사용 금지, flex/grid만 사용 |

## 아키텍처 원칙

- **1대1 의존 금지**: `fighters[0]` 대신 `simulation.getOpponent(this)` 사용
- **로직 소유권**: 각 로직은 해당 Action/Ability 클래스가 소유. `velocity` 직접 수정 금지 → `applyImpulse()`
- **기능 분리**: 한 함수 = 한 책임. `draw()` → `_drawBat()`, `_drawSlashEffect()` 등으로 분리
- **컬렉션 순회**: `filter`/`map`/`forEach`/`for...of`, 인덱스 루프 금지

## 참고 문서

`docs/development-rules.md` — 전체 개발 규칙 (최우선)
`docs/design.md` — 설계 / `docs/game-rules.md` — 게임 규칙
`src/help-content.js` — 게임 내 도움말 / `src/patchNotes.js` — 패치노트
