# 결정 기록

## [L1] 2026-06-27 — 시간 왜곡 타이머, 배속 영향 제거
- 맥락: `timeSlowRemaining`이 `speedDelta`(배속 적용된 값)로 카운트다운되어 4배속에서 0.5초가 0.125초만에 만료됨
- 결정: `BattleSimulation.update(delta, realDelta=delta)`로 실제 시간 파라미터 추가, `timeSlowRemaining`은 `realDelta`로 감소, 엔티티 업데이트는 `delta`(speedDelta) 기준 유지
- 영향: `src/app.js`, `src/simulation/battleSimulation.js`

## [L1] 2026-06-27 — 시간 왜곡 면제 시스템
- 맥락: `entity === this.playerBall` 하드코딩 → 관전 모드나 AI 사용 시 아무도 면제 안 됨
- 결정: `timeSlowExempt` Set 도입, `TimeWarpAction.apply()`에서 시전자 추가
- 영향: `src/simulation/battleSimulation.js`, `src/clickActions.js`

## [L1] 2026-06-27 — 인게임 버그 2건 수정
- 맥락: `assignActions: true` 하드코딩 → 챌린지 레벨 무관하게 AI 액션 항상 활성. `applyKnockback` speedBoost에 `multiplier` 누락 → NaN 가능성
- 결정: `assignActions` 줄 제거, `multiplier: 1` 추가
- 영향: `src/app.js`, `src/entities/battleBall.js`

## [L1] 2026-06-27 — AI 액션 컨트롤러 개선
- 맥락: 액션 사용 시 승률이 오히려 하락하는 캐릭터 6종 발견 (Phantom -7.8%, Trickster -7.5% 등)
- 결정: (1) HP 50% 미만이면 액션 사용 금지 (2) 쿨다운 6→15초 (3) 저HP 시 `_pickAction`에서 흡혈/회피 우선 가중치 (4) 액션 고정(locking)은 유지 — 사람도 첫 카드 선택 후 고정
- 영향: `src/simulation/aiActionController.js`

## [L2] 2026-06-27 — balanceSim으로 승률 검증
- 배경: AI가 새 스크립트(`scripts/aiVerify.mjs`)를 만들었으나 기존 `tests/balanceSim.mjs`가 더 완성도 높음
- 결정: 중복 스크립트 삭제, 원본 balanceSim으로 30 토너먼트 검증
- 영향: `scripts/aiVerify.mjs` 삭제

## [L1] 2026-06-27 — 세션 핸드오프 시스템
- 맥락: 매 새 대화마다 이전 컨텍스트를 이어받을 방법 필요
- 결정: (1) `AGENTS.md`에 시작 루틴(handoff 파일 읽기) 규칙 추가 (2) 결정 발생 시점마다 실시간 기록 (3) L1/L2/L3 우선순위 레벨링 (4) 단일 파일로 결정 히스토리 관리
- 영향: `AGENTS.md`, `SESSION-HANDOFF.md`

## [L1] 2026-06-27 — AGENTS.md 리팩터링
- 맥락: 200줄 중 다수가 효과 없음 (출력 형식 강제, DeepSeek 보완 장치 장황, development-rules.md 중복)
- 결정: 200줄→55줄로 축소, 핵심 규칙·코드스타일·아키텍처 원칙만 유지
- 영향: `AGENTS.md`

## [L1] 2026-06-27 — ABILITY_MAP 3군데 누락 수정
- 맥락: Vampire/Gunner/Phantom 얼굴이 UI에서 안 보임. `ui.js`, `app.js`의 ABILITY_MAP과 import에 3종 누락
- 결정: import 추가, ABILITY_MAP에 3종 추가
- 영향: `src/ui.js`, `src/app.js`

## [L1] 2026-06-27 — SESSION-HANDOFF.md 워크스페이스 루트로 이동
- 맥락: `/memories/repo/` 경로는 사용자에게 안 보임
- 결정: 워크스페이스 루트 `SESSION-HANDOFF.md`를 primary로, AGENTS.md의 읽기/쓰기 모두 이 파일 대상으로 변경
- 영향: `AGENTS.md`, `SESSION-HANDOFF.md`

## [L3] FIGHTER_IDS/ABILITY_TYPES 누락 추가 (Vampire/Gunner/Phantom)
## [L3] regression.mjs 테스트 복구 (구현과 불일치하던 테스트 값, 미구현 기능 테스트)
## [L3] balanceSim 30T 검증 통과, npm test 통과, format:check 통과

## [L1] 2026-06-27 — 시간왜곡 canAIUse 재설계 (원거리/근접 구분)
- 맥락: 기존 `상대속도 > 내속도 × 1.5`는 조건이 너무 엄격해 AI가 거의 사용 안 함
- 결정: 원거리(archer/grenade/gunner)는 상대 접근속도>80 & 거리<350, 근접은 상대 도망속도>40 & 거리<300
- 영향: `src/clickActions.js`

## [L1] 2026-06-27 — 7개 액션 canAIUse 전면 개선
- 맥락: 30T balanceSim에서 Orbit(-16%), Hero(-16%), Phantom(-11%) 등 액션 사용 시 승률 하락
- 결정: Rush(근접전용, 거리>300), Counter/Endure/Evade(충돌 임박 시), Guard(투사체 접근 시), LifeSteal(HP≤50%), Shockwave(그대로)
- 영향: `src/clickActions.js`

## [L1] 2026-06-27 — 캐릭터-액션 조합별 베이스라인 대비 분석
- 결정: balanceSim 25T로 캐릭터×액션 매트릭스 출력, 베이스라인 대비 델타로 AI 조건 진단
- 발견: 충격파(Trickster/Dash/Rage에 독), 돌진(Phantom/Gunner에 독), 회피(Eater/Grenade/Hero에 독)

## [L1] 2026-06-27 — 회피(Evade) 리워크: 좌우 90도 꺾기
- 맥락: 타이밍형은 버티기와 유사, 대시형은 Dash와 유사 → 차별화 필요
- 결정: 현재 진행방향에서 좌/우 랜덤 90도로 꺾어 회피. 800px/s, +30%속도 0.4초, HP 0.8%, 거리<220 & 접근>40 & 50%확률
- 영향: `src/clickActions.js`

## [L1] 2026-06-27 — 버티기(Endure) 원복
- 맥락: 0.5초/50%DR로 버프했으나 리턴이 너무 적어짐
- 결정: 원래값 0.2초/80%DR/1.0%HP로 복구, canAIUse 인간분산 50% 유지
- 영향: `src/clickActions.js`, `tests/regression.mjs`

## [L1] 2026-06-27 — 밸런싱 방침 확정
- 맥락: 특정 조합 사기(OP) 방지가 목적. 안 어울리는 조합은 유저가 안 고르므로 제한 불필요
- 결정: 캐릭터 타입별 액션 제한 없음. OP 조합 식별 시 해당 액션 파라미터 조정으로 대응
- 영향: 추후 밸런싱 방향

## [L1] 2026-06-27 — 카운터/버티기 인간 수준 분산 추가
- 맥락: AI가 충돌 타이밍을 완벽하게 계산, Counter/Endure를 100% 성공률로 사용 → 사기. 시뮬: AI 100% vs 인간(반응150ms+예측오차) 54%
- 결정: Counter 55%, Endure 50% 확률로만 활성화 → 인간 수준으로
- 영향: `src/clickActions.js`

## [L1] 2026-06-27 — debug 네임스페이스 + 계층 구조 규칙
- 맥락: 디버그 변수들이 평면적으로 흩어짐 (startCharacter, debugAIEnabled 등)
- 결정: `this.debug = { startCharacter, aiEnabled }` 네임스페이스로 그룹화, `docs/development-rules.md`에 계층 구조 규칙 추가
- 영향: `src/app.js`, `docs/development-rules.md`

## 진행 중 이슈
- 밸런스 30T: 전반적 안정화. ±20%↑ 극단치 사라짐. Dash +27% 강세, Eater -9% 약하락
- 충격파(Phantom -22%), 투사체방어(Grenade -36%) 등 일부 독 조합 잔존

## 다음 할 일
1. `src/patch-notes.js` 패치노트 작성
2. OP 조합 파라미터 튜닝 (카운터, 충격파 등)

---

## [L1] 2026-06-27 — debug 네임스페이스 + 계층 구조 규칙
- 맥락: 디버그 변수들이 평면적으로 흩어짐 (startCharacter, debugAIEnabled 등)
- 결정: `this.debug = { startCharacter, aiEnabled }` 네임스페이스로 그룹화, `docs/development-rules.md`에 계층 구조 규칙 추가
- 영향: `src/app.js`, `docs/development-rules.md`

## [L1] 2026-06-28 — BattleApp._speed/_action + BattleBall.hero/mastery 네임스페이스
- 맥락: 계층 구조 규칙을 전체 코드베이스에 적용
- 결정: `_battleSpeed/_speedIndicator*` → `this._speed`, `selectedActionId/currentMatchAction` → `this._action`, `heroOrbBonuses/Carryover` → `this.hero`, `masteryPhysicsModifiers/ActionModifiers/CombatPassives` → `this.mastery`
- 영향: `src/app.js`, `src/entities/battleBall.js`, `src/entities/heroOrb.js`, `src/simulation/battleSimulation.js`, `src/ui.js`, `tests/regression.mjs`

## [L1] 2026-06-28 — BattleBall.meta: ability가 자신의 메타정보 소유
- 맥락: `isRanged` 판단을 위해 `RANGED_IDS` Set을 여러 곳에서 하드코딩 중 → ability가 자신의 메타정보를 갖고 BattleBall은 getter로 위임
- 결정: `Ability.meta` getter 추가 (기본 `{ isRanged: false }`), ArcherAbility/GrenadeAbility/GunnerAbility에서 `{ isRanged: true }` 오버라이드, `BattleBall.meta` getter는 `this.ability?.meta`로 위임, aiActionController/clickActions에서 `RANGED_IDS` 제거하고 `fighter.meta.isRanged` 사용
- 영향: `src/abilities/ability.js`, `archerAbility.js`, `grenadeAbility.js`, `gunnerAbility.js`, `src/entities/battleBall.js`, `src/simulation/aiActionController.js`, `src/clickActions.js`

## [L1] 2026-06-28 — BattleBall state/flags/display + Ability state 계층화
- 맥락: BattleBall과 Ability 하위클래스에 30~50개 평면 프로퍼티가 흩어져 변수 스코프 구분 불가
- 결정: BattleBall에 `state`(slow/speedBoost/forcedHeading/movement/swallowed/wallSlam/bounced), `flags`(defeated/destroyed), `display`(spinRotation/scale) 네임스페이스 추가. 10개 Ability 하위클래스에 `state` 네임스페이스 추가 (가변 상태변수 이동). config 상수는 직접 프로퍼티 유지.
- 영향: `src/entities/battleBall.js`, `src/simulation/simulation.js` (optional chaining 추가), `src/abilities/*.js` (10개 파일), `src/simulation/battleSimulation.js`, `src/core.js`, `src/clickActions.js`, `src/combatEffects.js`, `src/app.js`, `src/ui.js`, `src/entities/*.js`, `tests/regression.mjs`, `tests/balanceSim.mjs`

## [L1] 2026-06-28 — UI 로그 순서 수정 + appendCapped 공통 헬퍼
- 맥락: `unshift`로 로그가 위에 쌓임 → 아래로 쌓이게 `push`로 변경, `utils.js`에 `appendCapped` 추가로 통일
- 영향: `src/ui.js`, `src/utils.js`

## [L1] 2026-06-28 — 도전단계 Alpine ↔ 프로필 동기화 버그 수정
- 맥락: UI에서 도전단계 조정해도 프로필에 저장 안 됨 → 토너먼트 시작 시 이전 값 사용
- 결정: `startTournament()`에서 Alpine `challengeLevel` 우선, 프로필도 동기화
- 영향: `src/app.js`

## [L1] 2026-06-28 — BattleBall.stats 네임스페이스 (base stat)
- 맥락: `baseDamage`, `baseDefense`, `baseSpeed`, `baseRadius` 등 base stat들이 평면에 흩어짐
- 결정: `this.stats` 네임스페이스 추가 — `baseDamage`, `baseDefense`, `baseSpeed`, `baseRadius`, `mass`, `allocation` 이동. `hp`, `radius`, `mass`는 외부 호환성을 위해 평면 프로퍼티로도 유지
- 영향: `src/entities/battleBall.js`, `src/abilities/*.js` (12개), `src/app.js`, `src/clickActions.js`, `src/combatEffects.js`, `src/core.js`, `src/entities/*.js` (6개), `src/simulation/battleSimulation.js`, `src/ui.js`, `tests/regression.mjs`

## [L1] 2026-06-28 — PhysicsBody 믹스인 패턴 도입
- 맥락: 물리 시뮬레이션 관련 변수(position/velocity/mass/radius)와 연산(applyImpulse/velocity correction/integration)이 BattleBall에 평면적으로 흩어짐 → RTS 레포의 mixin 패턴 참고
- 결정: `src/physics/` 모듈 신설 — `mixins()` 합성 유틸리티, `PhysicsBody` 믹스인 (pos/velocity/mass/radius/bounced + applyImpulse/applyForce/integrate/_applyVelocityCorrection/_computeDesiredVelocity). `BattleBall extends mixins([PhysicsBody])`로 적용. `position` getter/setter로 기존 외부 코드와 호환 유지. `bounced`는 `state`에서 PhysicsBody 직속으로 이동.
- 영향: `src/physics/index.js`, `src/physics/mixins.js`, `src/physics/PhysicsBody.js`, `src/entities/battleBall.js`, `src/simulation/simulation.js`

## 진행 중 이슈
- 밸런스 안정화됨 (±20% 이상 극단치 없음). Dash +27% 강세, 일부 캐릭터 약하락

## 다음 할 일
1. `src/patch-notes.js` 패치노트 작성
2. OP 조합 파라미터 튜닝
