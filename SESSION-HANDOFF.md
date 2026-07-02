# 결정 기록

## [L2] 2026-07-02 — 보상 3축 설계 + 액션별 가중치 + 게임 통합 완료
- 배경: 구버전 모델(승패만 보상)이 스팸 문제. HP weight만으로는 방어형 액션 불이익.
- 결정: (1) 보상 = 승패 ±1 + 액션HP피해×0.3 - 내HP손실×0.15 - 사용횟수×0.02 (2) 액션 타입별 가중치 맵: 공격형(shockwave 0.5/0.1), 방어형(evade 0.1/0.5), 유틸형(rush 0.15/0.15) (3) 훈련 0.5초 간격, 게임 매 틱 평가 (4) 이펙트 _executeAction으로 통합 (5) pendingActions 큐화 (6) TimeWarp 시전자별 독립 타이머
- 영향: `scripts/rl/train.mjs`, `src/simulation/aiActionController.js`, `src/simulation/battleSimulation.js`, `src/app.js`, `src/clickActions.js`, `scripts/benchmark.mjs`, `src/ai/rlPolicy.js`

## [L1] 2026-06-29 — RL PPO 학습 파이프라인 완성
- 맥락: AI 액션 canAIUse 수동 튜닝 한계 → PPO로 캐릭터×액션 조합별 최적 사용 확률 자동 학습
- 결정: (1) PPO Actor-Critic (16→16→1 Bernoulli 정책), GAE, mini-batch SGD로 `scripts/rl/train.mjs` 구현 (2) 피처 16차원 순수 벡터 (HP비율, 위치벡터, 속도벡터, 투사체벡터, 경과시간, 캐릭터 인덱스) — 파생값/불리언 플래그 없음 (3) `--help` 도움말, 학습 완료 시 `scripts/rl/report_*.json` 자동 저장 (4) `node scripts/rl/train.mjs` 한 줄로 전체 실행
- 영향: `scripts/rl/train.mjs`, `scripts/rl/features.js`, `scripts/rl/policyNetwork.js`, `scripts/rl/normalizer.js`, `docs/rl-optimization-guide.md`

## [L2] 2026-06-28 — AI 액션 시스템 간소화 + Shockwave 버프
- 배경: canAIUse가 대부분 거리 제한으로 차단되어 AI가 아무 액션도 못 쓰는 문제 → RL 학습 위해 모든 액션 허용 필요
- 결정: (1) 모든 `canAIUse`가 `true` 반환, 기존 로직은 주석 보존 (2) `_pickAction()` 제거, `selectAction()`에서 캐릭터 타입 기반 가중치 랜덤 선택 (3) Rush/TimeWarp/Counter/ProjectileGuard/Endure/LifeSteal/Evade에 `getFailureReason` 가드 추가 (효과 활성 중 재사용 방지) (4) Shockwave 반경 150→250, HP 40% 미만 + 거리 250 이하에서만 사용 (방어적)
- 영향: `src/clickActions.js`, `src/simulation/aiActionController.js`

## [L1] 2026-06-28 — RL 최적화 가이드 문서 작성
- 맥락: AI 액션 `canAIUse` 파라미터 수동 튜닝이 번거로워 RL/자동최적화 도입 검토
- 결정: `docs/rl-optimization-guide.md` 작성 — 게임 구조·관측공간(24차원)·행동공간·보상함수·DQN 학습코드·기존 게임 임베딩 전략을 포괄하는 설계 문서
- 영향: `docs/rl-optimization-guide.md`

## [L1] 2026-06-28 — HP 게이트 30% + 쿨다운 제거 + Shockwave 회피용 전환
- 맥락: `aiEnabled: true`여도 `_pickAction()`이 `canAIUse` 통과 액션이 없으면 `null` 반환 → `_chosenAction` 미설정 → `clickActionName` 미설정 → UI에 AI 캐릭터 액션명 미표시
- 결정: (1) `_pickAction()`에서 viable이 0이면 전체 풀에서 랜덤 fallback 선택 — `_chosenAction`이 null이 되는 경우 제거 (2) `docs/click-actions.md`에 AI 액션 규칙(할당·고정·canAIUse) 문서화, 액션 선택 주기를 토너먼트 단위로 정정 (3) `aiEnabled` 중복 키 제거, `false` 기본값 + 주석 힌트 패턴 통일
- 영향: `src/simulation/aiActionController.js`, `src/app.js`, `docs/click-actions.md`

## [L1] 2026-06-28 — 스탯 표시 버그 수정 (stats 네임스페이스 누락 참조)
- 맥락: `6538ebb`에서 `statAllocation`을 `BattleBall.stats.allocation`으로 이동했으나 `src/ui.js`, ability 3종, `heroOrb.js`, `tests/regression.mjs`의 참조가 미업데이트되어 스탯 표시가 깨짐
- 결정: `fighter.statAllocation` → `fighter.stats.allocation` (11곳), `fighter.stats?.hp` → `fighter.hp/maxHp` (2곳), `owner.statAllocation` → `owner.stats?.allocation` (4곳) 으로 수정. optional chaining 보강
- 영향: `src/ui.js`, `src/abilities/ability.js`, `src/abilities/orbitAbility.js`, `src/abilities/rageAbility.js`, `src/entities/heroOrb.js`, `tests/regression.mjs`

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
1. `src/patchNotes.js` 패치노트 작성
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

## [L1] 2026-06-28 — 푸시 전 패치노트/문서 경로 정합성
- 맥락: main 푸시 전 `PATCH_NOTES` 작성 규칙이 있는데 미푸시 리팩토링/핫픽스 범위에 패치노트가 없었고, 문서가 실제 파일명 `src/patchNotes.js`가 아닌 옛 경로를 가리킴
- 결정: `v0.22.0` 패치노트 추가, 문서/주석의 패치노트 경로를 `src/patchNotes.js`로 통일
- 영향: `src/patchNotes.js`, `AGENTS.md`, `docs/*`, `src/utils.js`, `SESSION-HANDOFF.md`

## [L1] 2026-06-28 — 경험치 및 캐릭터 레벨 시스템 설계 문서화
- 맥락: 업적 위주 성장만으로는 전투 직후 즉각적인 보상이 부족하게 느껴짐
- 결정: 캐릭터별 XP/레벨을 단기 보상 시스템으로 분리하고, 패배해도 지급되는 XP, 대표 행동 XP, 레벨 보상, 결과 화면 UX, 저장 구조, 회귀 조건을 `docs/experience-system.md`에 기록
- 영향: `docs/experience-system.md`, 성장/도감/숙련도/컬렉션 허브/저장 문서 링크

## [L1] 2026-06-28 — XP 성장에 따른 상대 성장 보정 고려
- 맥락: 플레이어 캐릭터 레벨만 오르면 장기적으로 게임이 너무 쉬워질 수 있음
- 결정: 상대도 저장 XP를 갖는 방식 대신, 토너먼트 시작 시 플레이어 캐릭터 레벨에서 `rivalExperienceScaling`을 파생해 hp/damage/defense에만 제한 적용. 보정은 상한을 두고 도전 단계와 분리해 문서화.
- 영향: `docs/experience-system.md`

## [L1] 2026-06-28 — AI 우승자는 영구 성장 대신 디펜딩 챔피언화
- 맥락: AI 우승 캐릭터가 계속 스탯 성장하면 원래 강한 캐릭터가 더 자주 이기는 양의 피드백으로 밸런스가 깨질 수 있음
- 결정: AI 우승자는 `defendingChampion`으로 저장해 표시/현상금 대상이 되며, 전투력 보정은 없거나 다음 토너먼트 1회성 `championAura`로 제한. 필요 시 최근 우승률이 높은 캐릭터의 보정을 감쇠.
- 영향: `docs/experience-system.md`

## [L1] 2026-06-28 — 디펜딩 챔피언 시각 표식 및 반응형 UI 설계
- 맥락: 챔피언은 텍스트 로그만으로는 전투 중 구분이 약하고, 모바일/PC 화면에서 표시 밀도 요구가 다름
- 결정: 전장 내 챔피언 모자 표식, PC 대진표 배너/현상금 chip/HUD, 모바일 compact strip/짧은 bracket row/결과 팝업 우선순위를 `docs/experience-system.md`에 구체화
- 영향: `docs/experience-system.md`

## [L1] 2026-06-28 — 사냥터 및 상자 해금 시스템 설계 문서화
- 맥락: 토너먼트와 별개로 로그라이크식 사냥터에서 여러 적을 상대하고, 승리 후 귀환/전진을 선택하며, 처치 재화로 등급별 상자를 여는 루프를 구상
- 결정: 사냥터는 토너먼트와 분리된 연전 파밍 모드로 정의. 층, 조우, 귀환/전진, 랜덤 이벤트, 열쇠 조각, 상자 등급/개봉 비용, pending/secured loot, 보관함 UI 요구사항을 `docs/hunting-grounds-system.md`에 기록
- 영향: `docs/hunting-grounds-system.md`, `docs/collection-hub-ui.md`, `docs/player-data-storage-security.md`

## [L1] 2026-06-28 — 다수 전투를 위한 팀 기반 리팩터링
- 맥락: 사냥터와 1대n/n대n 전투를 위해 기존 전투가 사실상 1대1 전제에 머물러 있고, 같은 팀끼리 피해를 주지 않는 구조가 필요
- 결정: `BattleBall.teamId`와 `simulation.isHostile()`, `getEnemiesOf()`, `getNearestEnemy()`를 도입. 명시적 팀이 없으면 fighter별 고유 팀을 부여해 기존 개인전 동작을 유지하고, 같은 팀끼리는 충돌 물리만 적용하며 피해/적대 효과를 차단. 승패는 남은 적대 팀 수로 판단
- 영향: `src/entities/battleBall.js`, `src/simulation/simulation.js`, `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `docs/development-rules.md`, `docs/game-rules.md`, `docs/hunting-grounds-system.md`

## [L1] 2026-06-28 — 스탯 배분 UI 초기화 버그 수정
- 맥락: Alpine 스탯 배분 버튼은 UI 내부 `allocation`만 갱신하고 `BattleApp.playerStatAllocation`에는 알리지 않아, `refreshPlayerSetup()` 같은 화면 갱신이 들어오면 앱이 가진 이전 0 배분으로 UI가 다시 덮일 수 있었음
- 결정: `adjustStat()`, `randomAllocation()`, `resetAllocation()` 후 `allocation-changed` 이벤트를 발행해 앱 상태를 즉시 동기화. `renderPlayerSetup()`은 전달받은 배분 객체를 복사해 UI가 호출자 객체를 직접 변형하지 않게 함
- 영향: `src/ui.js`, `tests/regression.mjs`, `src/patchNotes.js`

## [L1] 2026-06-28 — 스탯 배분 핫픽스 캐시 버전 갱신
- 맥락: 스탯 배분 초기화 수정 후에도 `index.html`의 모듈 캐시 버전 `V`가 오래된 `0.18.1`이라 브라우저가 이전 `src/ui.js?v=0.18.1`을 재사용하면 동일 버그가 계속 보일 수 있었음
- 결정: `index.html`의 캐시 버전을 최신 패치노트 버전 `0.23.2`로 갱신하고, 회귀 테스트에서 `index.html`의 `V`가 `PATCH_NOTES[0].version`과 일치하는지 검증
- 영향: `index.html`, `src/patchNotes.js`, `tests/regression.mjs`

## [L1] 2026-06-28 — 스탯 배분 초기화 race E2E 검증 및 차단
- 맥락: 실제 Playwright E2E에서 수동/자동 배분 후 시작은 유지됐지만, Alpine UI가 BattleApp import보다 먼저 활성화되어 앱 이벤트 리스너 부착 전 입력이 발생할 수 있는 구조를 확인
- 결정: BattleApp 생성 시 이미 존재하는 Alpine `allocation`을 즉시 흡수하고, 로딩 오버레이 제거를 Alpine `x-init`이 아니라 앱 모듈 import 완료 후로 이동. 최신 캐시 버전은 `0.23.3`으로 갱신
- 영향: `src/app.js`, `index.html`, `src/patchNotes.js`, `tests/regression.mjs`

## [L1] 2026-06-29 — PPO 학습 아키텍처 문서명 및 표현 정리
- 맥락: AI 코드 개발 관련 문서가 숫자 임시 파일명으로 생성되어 있고, 제목/섹션/코드 주석에 장식 이모티콘이 많아 장기 문서로 쓰기 어려움
- 결정: 문서 파일명을 `docs/ppo-learning-architecture.md`로 변경하고, PPO/Actor-Critic 데이터 흐름 설명에서 장식 이모티콘과 과한 표현을 문서형 톤으로 정리. 다음 개발 단계는 학습 코드 개선으로 이어감
- 영향: `docs/ppo-learning-architecture.md`, `SESSION-HANDOFF.md`

## [L1] 2026-06-29 — PPO Actor-Critic 학습 코드 반영
- 맥락: 기존 학습 초안은 REINFORCE 단일 정책망 구조라 PPO 문서의 Actor/Critic, old log probability, clipped ratio 업데이트와 맞지 않았음
- 결정: `scripts/rl/policyNetwork.js`에 TensorFlow.js 기반 Actor/Critic 생성, Bernoulli sampling, Critic value prediction, PPO clipped update를 구현하고 `scripts/rl/train.mjs`를 에피소드 rollout → discounted return/advantage batch → PPO epoch 학습 흐름으로 변경. Node 실행 시 CPU 백엔드를 명시하고 짧은 학습 실행용 환경변수를 지원. 액션별 `getFailureReason()`은 PPO rollout의 불가능/중복 액션 필터로 사용
- 영향: `scripts/rl/*`, `src/clickActions.js`, `tests/regression.mjs`, `docs/rl-optimization-guide.md`, `package.json`, `package-lock.json`

## [L1] 2026-06-29 — PPO 학습률 확인 및 rollout buffer 보강
- 맥락: 300 에피소드 비교에서 `lr=3e-4`, `lr=1e-3`, `lr=0` 간 승률 개선이 뚜렷하지 않았고, Eater × LifeSteal은 Rage 상대 승률이 계속 0%라 승패 보상만으로 학습 신호가 부족했음
- 결정: 현재는 중간 보상이 없으므로 보상은 게임 종료 후 승/패 terminal reward만 사용. 대신 PPO rollout buffer를 64 에피소드로 늘리고, decision 샘플을 shuffle한 뒤 `miniBatchSize` 단위로 나눠 여러 epoch 학습하도록 변경. 최근 윈도우 기준 승률/평균 보상/액션 사용률/Actor 평균 확률 로그로 학습 추세를 확인
- 영향: `scripts/rl/train.mjs`, `scripts/rl/policyNetwork.js`, `tests/regression.mjs`, `docs/rl-optimization-guide.md`, `SESSION-HANDOFF.md`

## [L1] 2026-06-29 — 전체 캐릭터 × 전체 액션 PPO 학습 지원
- 맥락: 기존 학습 스크립트는 Dash/Rush, Archer/TimeWarp, Eater/LifeSteal 3개 조합만 하드코딩되어 있어 N 캐릭터 × N 액션 학습을 할 수 없었음
- 결정: 기본 학습 대상을 로스터 전체 캐릭터 × 액션 풀 전체 액션으로 확장. `RL_CHARACTERS`, `RL_ACTIONS`, `RL_MAX_COMBOS`, `RL_OPPONENT_MODE`, `RL_FIXED_OPPONENT`, `RL_NORMALIZER_SAMPLES` 환경변수로 부분 학습/랜덤 상대/스모크 테스트를 지원. 공통 normalizer를 한 번 초기화한 뒤 조합별 clone으로 복사해 초기화 비용을 줄임
- 영향: `scripts/rl/train.mjs`, `scripts/rl/normalizer.js`, `tests/regression.mjs`, `docs/rl-optimization-guide.md`, `SESSION-HANDOFF.md`

## [L1] 2026-06-29 — PPO 학습 전/후 deterministic 평가 추가
- 맥락: 훈련 중 승률은 Actor 샘플링과 탐험이 섞여 있어 학습 전후 정책 자체가 개선됐는지 판단하기 어려웠음
- 결정: 각 캐릭터 × 액션 조합마다 학습 전 `eval before`, 학습 후 `eval after`를 deterministic 정책으로 별도 실행. 평가는 `RL_EVAL_THRESHOLD` 이상일 때만 액션을 사용하고 normalizer 통계를 업데이트하지 않으며, `RL_EVAL_EPISODES`로 평가 횟수를 조절. 최종 결과에 `eval before -> after`와 delta를 출력
- 영향: `scripts/rl/train.mjs`, `scripts/rl/policyNetwork.js`, `tests/regression.mjs`, `docs/rl-optimization-guide.md`

## 진행 중 이슈
- 밸런스 안정화됨 (±20% 이상 극단치 없음). Dash +27% 강세, 일부 캐릭터 약하락

## 다음 할 일
1. 전체 N×N PPO 학습 결과 저장 구조 설계: `{charId, actionId}`별 Actor/Critic/normalizer 저장 단위 결정
2. PPO 커리큘럼 조정: Eater처럼 계속 지는 조합은 Rage 고정 상대 대신 더 쉬운 상대/랜덤 상대로 승리 terminal reward 샘플 확보
3. PPO 학습 결과 저장/로드 전략 결정: `@tensorflow/tfjs` 유지 시 커스텀 직렬화, `tfjs-node` 도입 시 `file://` 저장
4. 학습된 Actor를 `AIActionController.evaluate()` 또는 별도 추론 어댑터로 붙이는 브라우저 추론 경로 설계
5. 원격 배포 반영 후 실제 브라우저/모바일에서 스탯 배분 초기화 race 재검증
6. 사냥터 MVP 구현 전, `getEnemiesOf()`가 필요한 광역/다수 대상 능력 목록 점검
7. OP 조합 파라미터 튜닝
