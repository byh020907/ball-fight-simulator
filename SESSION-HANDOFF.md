# 세션 핸드오프

전체 697개 결정 이력은 [`docs/decision-history.md`](docs/decision-history.md)에 보존되어 있습니다. 이 파일은 새 대화에서 바로 필요한 현재 계약, 열린 리스크, 아직 문서에 완전히 흡수되지 않은 활성 결정만 유지합니다.

## 현재 기준

- 개발·검증·문서 수명주기: [`docs/development-rules.md`](docs/development-rules.md)
- 게임 규칙: [`docs/game-rules.md`](docs/game-rules.md)
- 시각·UX 설계: [`docs/design.md`](docs/design.md)
- 사냥터: [`docs/hunting-grounds-system.md`](docs/hunting-grounds-system.md)
- 장비: [`docs/equipment-system.md`](docs/equipment-system.md)
- 보상 수치: [`docs/reward-balance.md`](docs/reward-balance.md)
- 진행 중 책임 분리: [`docs/refactor-steps.md`](docs/refactor-steps.md)

## 최근 현재 계약 요약

- 합성은 같은 등급 장비 3개만 사용하고, 강화는 단계별 파편 200/300/500/800/1200을 사용합니다.
- 강화 기본 스탯은 단계마다 2배가 되며 등급별 상한은 common +1부터 legendary +5까지입니다. 특수 옵션은 배율 대상이 아닙니다.
- 방어는 `피해 × 50 / (50 + 방어)`의 점감형 비율 감소를 사용하고 최소 1 피해를 유지합니다.
- 장비 속도는 장비 적용 전 기본 속도의 약 2배로 수렴하며 능력 고유 속도 배율과 사냥터 탭 가속은 이후 단계에서 적용됩니다.
- `문서 현행화` 요청은 현재 코드·테스트·최근 L1/L2 결정을 기준으로 처리합니다. 부분 수정 가능한 문서는 `docs/`에 남기고 전면 재작성 대상만 `.legacy/docs/`로 이동합니다.

## 열린 검증과 다음 작업

- 강화 배율·방어 점감·속도 수렴을 적용한 실제 브라우저 장기 플레이 감각은 아직 수동 검증하지 않았습니다.
- 장기 원정에서 단계별 파편 소진 속도와 강화석 획득 체감은 추가 플레이 데이터가 필요합니다.
- 책임 분리 후속 후보는 `refactor-steps.md`의 Step 4 삼키기 상태 소유권과 Step 5 투사체 적중 책임입니다.
- `.codex-remote-attachments/`는 사용자 자료이므로 추적·삭제하지 않습니다.

## 활성 결정

## [L1] 2026-07-24 — 활성 인계와 전체 결정 이력을 분리한다
- 맥락: 697개 결정, 3,922줄이 한 파일에 누적되어 새 대화에서 최신 인계보다 과거 기록 탐색 비용이 커졌다. 이미 현행 문서에 흡수된 결정도 계속 활성 문맥을 차지했다.
- 결정: `SESSION-HANDOFF.md`는 현재 계약 요약, 열린 리스크, 아직 흡수되지 않은 새 결정만 유지한다. 기존 전체 결정은 `docs/decision-history.md`에 내용 손실 없이 보존한다. 활성 결정이 현행 문서에 완전히 반영되면 전체 기록으로 이동하되 일부만 반영됐거나 열린 리스크가 남은 결정은 활성 상태로 유지한다.
- 영향: 새 대화 시작 루틴, 결정 기록 수명주기, `SESSION-HANDOFF.md`, `docs/decision-history.md`, `AGENTS.md`, `docs/development-rules.md`.

## 갱신 규칙

- 새 L1/L2 결정은 발생 즉시 이 파일의 `활성 결정`에 기록합니다.
- 세션 종료 시 열린 이슈와 다음 작업을 갱신합니다.
- `문서 현행화` 때 결정의 내용과 이유가 현행 문서에 완전히 반영됐는지 확인합니다.
- 완전히 흡수된 결정은 `docs/decision-history.md`로 이동하고 활성 파일에는 중복해서 남기지 않습니다.
- 폐기·대체된 결정도 삭제하지 않고 전체 이력에 보존하며 대체 결정을 명시합니다.
