# 드래그 전투

토너먼트와 사냥터는 동일한 드래그 전투 규칙을 사용한다. 캔버스에서 공을 반대 방향으로 당겼다가 놓으면 한 번의 충격으로 발사한다.

## 조준과 발사

- 드래그는 24px 유효 범위를 넘은 뒤부터 방향만 정한다. 당긴 거리는 출력에 영향을 주지 않고, 유효 조준을 유지한 실제 시간이 차징량을 정한다. 방향은 손을 놓기 직전까지 최신 각도로 바꿀 수 있다.
- 조준 중 시간 왜곡은 최대 차징 1.2초의 앞 50%인 0.6초에만 자신 이외의 흐름을 35% 속도로 늦춘다. 같은 조준에서 0.6초를 넘긴 뒤에는 방향을 다시 움직여도 시간 왜곡이 재시작되지 않는다.
- 조준은 1.2초 뒤 현재 벡터로 자동 발사된다. 발사 뒤 별도 재사용 대기시간은 없으며, 현재 드래그 돌진이 활성인 동안에만 새 조준을 막는다. 충돌·감속·최대 비행으로 돌진이 끝나면 즉시 다시 드래그할 수 있다. 돌진 또는 적 정면 방패의 0.27초 반격 경직 중 전장을 누른 채 유지하면 주 포인터의 시작점과 최신 위치를 예약하고, 모든 차단 상태가 끝난 첫 프레임에 자동으로 조준을 연다. 대기 중 미리 당긴 방향은 이어받지만 차징 시간은 조준이 실제로 열린 뒤부터만 증가한다. 활성화 전에 손을 떼거나 포인터가 취소되면 예약도 취소된다.
- 릴리즈 충격량은 0~1.2초의 차징량에 선형 대응해 캐릭터 기본 속도의 1.65~4.80배가 된다. 세션 전용 디버그 배율은 이 계산의 마지막에 곱한다. 조준 궤적은 현재 속도와 이 충격량을 합친 실제 발사 속도를 사용한다.
- 실제 속도가 캐릭터의 현재 기준 속도 이하일 때만 주행 방향과 속도를 회복한다. 드래그·충돌·벽 반사로 기준을 넘은 속도는 방향을 자동 보정하지 않고, 초당 65%가 남는 마찰로 기준 속도까지 감속한다.
- 각 적은 발사 순간의 플레이어 위치를 향한 180도 방패를 0.8초 동안 고정한다. 방패가 남아 있을 때 정면으로 바로 부딪히면 플레이어만 크게 손해 보고, 시간이 지나 방패가 사라져도 플레이어 발사와 반사 보상은 계속된다.
- 방패는 적 돌진 예고의 빨강과 구분되는 청록 에너지 아크·분절선·전방 화살촉으로 표시한다. 남은 0.8초에 따라 아크 길이와 밝기가 함께 줄어들어 정면 위험이 끝나는 시점을 보여 준다.
- 발사는 최초 캐릭터 충돌, 기준 속도의 1.25배 이하를 0.18초 유지한 시점, 또는 최대 비행 시간으로 끝난다. 기준 속도까지 완전히 느려질 때까지 기다리지 않고 유의미한 돌진력이 사라진 시점부터 다시 조준할 수 있으며, 기본 이동은 그대로 이어진다. 돌진 중에는 캐릭터를 따라가는 청록 수렴 원이 실제 종료 진행률에 맞춰 몸체로 다가와 원이 닿아 사라지는 프레임과 다시 드래그할 수 있는 프레임을 맞춘다. 캐릭터 충돌처럼 즉시 끝나는 경우에는 충돌과 함께 원도 즉시 사라진다.

하단 드래그 HUD는 `드래그 준비`, `차징`, `드래그 돌진 중`, `반격 경직`을 같은 아이콘·주 라벨·보조 문구·진행선 구조로 표시한다. 조준 중에는 `차징 00%`와 `예상 속도 ×0.00`을 표시하고 진행선 중앙의 흰색·청록 눈금으로 시간 왜곡이 끝나는 50% 지점을 알린다. 돌진 또는 경직 중 다음 입력을 누르고 있으면 `입력 예약 · 종료 즉시 조준` 또는 `입력 예약 · 경직 종료 즉시 조준`으로 예약 접수를 확인한다.

## 반사 보상과 적 공격

- 현재 물리 경로는 최대 3회 반사를 미리 보여 준다. 1회 반사는 정상 후면 피해, 2회는 강화 피해, 3회 이상은 최대 피해와 경직을 준다. 4회 이상은 연출만 누적한다.
- 적은 한 명씩 예고하고, 차징 중에는 현재 목표 위치를 계속 추적해 조준한다. 실제 발사가 시작된 뒤에만 마지막 벡터를 고정한다. AI 요구 차징은 `clamp(거리/600 + 횡이동비 × 0.15, 0.35, 1)`이며, 횡이동비는 조준 방향에 수직인 상대 속도를 목표 기준 속도로 나눈 값이다. 발사 속도는 플레이어와 같은 1.65~4.80배 선형 곡선을 사용하고 자연 충돌보다 피해가 1.35배지만, 적에게는 방패·반사 보상이 없다.
- 최초 계획 뒤 목표가 가까워져 현재 차징으로 새 요구량을 만족하면 종료 시각을 늦추지 않고 0.22초 동안 예고 진행만 빠르게 마무리한다. 남은 시간이 0.22초 이하면 기존 계획을 유지하며, 가속 연출이 실제 차징량을 완충으로 바꾸지는 않는다.
- 플레이어와 AI 차징은 캐릭터 바깥에서 시작한 옅은 원이 실제 예고 진행률에 따라 진해지며 몸체 외곽까지 수축하는 공통 연출을 사용한다. 적은 여기에 어두운 외곽 레일, 이동하는 점선 코어·방향 셰브론과 끝점 조준점을 더하며 평상시는 빨강, 조기 종료 가속은 호박색 `돌진 가속`으로 구분한다. 실제 발사 뒤에는 차징 레일·꼬리·전방 끝표식·`돌진` 라벨을 만들지 않고, 캐릭터를 따라 몸체까지 수축하는 종료 원만 남긴다. 플레이어 종료 원은 청록, AI 종료 원은 빨강이다.
- 적 돌진이 충돌·감속·최대 비행으로 끝나면 다음 적이 바로 자신의 차징을 시작한다. 플레이어도 현재 드래그 돌진이 끝나는 즉시 다시 조준할 수 있으므로 별도 재사용 대기를 기준으로 한 공격 지연은 없다.
- 플레이어가 관전하는 토너먼트 AI 대 AI 대진에서는 양쪽 캐릭터를 같은 순차 공격 큐에 넣는다. 현재 공격자는 가장 가까운 살아 있는 적을 차징 중 계속 조준한 뒤 같은 상황별 차징 곡선으로 발사하고, 공격이 끝나면 반대편을 포함한 다음 캐릭터가 즉시 차징한다. 이 자동 대진에는 플레이어용 방패·반사 보상·직선 충돌 페널티를 적용하지 않으며, 수동 조작 HUD 없이 차징 예고만 표시한다.

## 자동 전투와 밸런스

자동 진행은 드래그 전용 반사 보너스를 사용하지 않는다. 사냥터는 적의 낮은 체력과 높은 돌진 피해를 통해 수동 회피와 반사 각도를 보상한다. 사냥터 드래그 매치의 1대1 적 최대 체력은 시작 시 한 번만 88%로 조정하고, 다수전은 `아군 수 / 적군 수` 비율의 3제곱을 추가 적용해 적 수가 늘어날 때 적 진영의 총 체력 부담이 선형으로 폭증하지 않게 한다. 각 전투원의 현재 체력 비율은 보존한다.

토너먼트는 이 사냥터용 체력 감산을 적용하지 않는다. AI 경험치 레벨은 기존 도전 단계 하한인 첫 도전 Lv.1, BRONZE Lv.3, SILVER Lv.6, GOLD Lv.9를 유지하면서 플레이어의 현재 경험치 레벨보다 낮아지지 않는다.

## 소유권과 검증

입력·입력 예약·릴리즈 속도·방패·반사·순차 돌진과 적 체력 설정은 `src/combat-drag/`가 소유하고, Canvas 포인터 계층은 런타임이 일반 시작 또는 예약 시작을 수락한 경우에만 해당 주 포인터를 캡처한다. 차징량·AI 요구량·조기 종료·실제 돌진 종료 진행률 계산은 순수 `chargeMath`가 맡는다. 기준 이하 회복·기준 이상 마찰은 `src/game-kit/physics/linearVelocityPolicy.js`, 궤적은 `trajectoryScene`, 화면 표현은 `DragCombatRenderer`가 맡는다. 런타임 스냅샷은 플레이어 실제 차징량·예약 여부와 적의 실제 차징량·예고 진행률·가속 여부·종료 진행률을 분리해 제공한다. `BattleSimulation.setPlayerBall()`은 플레이어 지정과 사냥터의 팀 인원수 기반 적 체력 조정을 한 곳에서 처리하며, 토너먼트는 이 조정을 명시적으로 끈다. 회귀 테스트는 차징 단조성, 예약 입력의 시작·이동·해제·경직 대기·플레이어 교체 폐기, 적 계획 종료 시각 비증가, 0.22초 가속 경계, 시간 왜곡 재진입 차단, 릴리즈 속도와 궤적의 동일 설정 사용, 최대 시간·저속 종료 원의 수렴, 교체·부활·새 매치를 확인한다.

## 기준선 계측

`npm run metrics:drag-ability`는 동일 시드 사냥터 전투에서 드래그 정책별 능력·드래그 사용을 계측한다.

### 환경 변수

| 변수                                 | 기본값               | 설명                                                     |
| ------------------------------------ | -------------------- | -------------------------------------------------------- |
| `METRICS_SEEDS`                      | 1                    | 정책당 시드 수                                           |
| `METRICS_MAX_SECONDS`                | 75                   | 경기당 최대 시간(초)                                     |
| `METRICS_SEED`                       | 20260730             | 기준 시드                                                |
| `METRICS_CHARACTERS`                 | 전 캐릭터            | 쉼표 구분 ID 목록                                        |
| `METRICS_STAGES`                     | `cave,forest,desert` | 스테이지 목록                                            |
| `METRICS_FLOORS`                     | `6,20,36`            | 층 목록                                                  |
| `METRICS_COMMAND_RESOURCE_PROTOTYPE` | unset                | `1` 또는 `true`일 때만 커맨드 자원 프로토타입 적용       |
| `METRICS_ABILITY_COMMAND_PROTOTYPE`  | unset                | `1` 또는 `true`일 때만 능력 커맨드 공통 인프라를 함께 켬 |

### opt-in 커맨드 자원 프로토타입

`METRICS_COMMAND_RESOURCE_PROTOTYPE=1 npm run metrics:drag-ability`는 개발자용 Node 시뮬레이션에서만 제한 자원을 켠다. 실제 앱·토너먼트·사냥터 기본 드래그, HUD와 현행 무제한 규칙은 바꾸지 않는다. 초기값은 최대 2, 시작 1, 8초마다 1의 연속 회복, focal 실제 능력 사용당 0.35, 유효 발사당 1 소비다. opt-in 모드의 player 직접 드래그 충돌 피해는 plain-hit과 rear-hit 모두 기존 계산에 0.65배를 적용한다.

비교 목표는 일반 전투의 의미 있는 player launch 3~5회, focal 직접 드래그 피해 비중 15~30%, focal 능력 관측률 95% 이상이다. 이 값은 HUD·입력 가독성·캐릭터별 능력 연계가 확정되기 전의 측정용 후보이며, 목표 통과만으로 실게임 계약이 되지 않는다.

### 숨김 능력 커맨드 인프라

`BattleSimulation`의 `abilityCommandEnabled: true`와 `METRICS_ABILITY_COMMAND_PROTOTYPE=1`은 다음 능력 연계 실험 전용 플래그다. 기본값은 꺼짐이며, 현재 앱·HUD·토너먼트·사냥터의 드래그 발사 규칙을 바꾸지 않는다. 플래그가 켜져도 아직 능력별 구현이 없는 경우 `default-shot`으로 기존 `applyImpulse()`와 `PlayerShotState.begin()`을 정확히 한 번 실행한다.

유효한 플레이어 발사에는 런타임 전용의 단조 증가 `commandSequence`가 배정된다. 이는 드래그 메트릭의 `eventSequence`와 별개다. primary ability는 `getCommandState`, `prepareCommand`, `resolveCommandLaunch`, `onCommandBounce`, `resolveCommandCollision`, `onCommandEnd` 훅으로만 커맨드에 관여한다. 발사 해석 모드는 `default-shot`, `replace-shot`, `payload-only`이며 뒤의 두 모드는 generic 이동 발사를 실행하지 않는다. 능력은 캐릭터 ID 분기 대신 훅으로 자기 payload를 소유한다.

`CommandIntent`는 sequence, direction, chargeRatio, pathSegments, bouncePoints, predictedTerminal을 보관한다. 새 커맨드·다음 primary ability cycle·3초 경과·전투 종료 가운데 가장 이른 조건에서 한 번 정리되고 `onCommandEnd`가 호출된다. 커맨드 충돌은 `resolveCommandCollision`의 `{ handled, runDefaultOnCollision }`으로 기존 `onCollision()`의 실행 여부를 결정한다. no-op 또는 비커맨드 충돌은 기존 `onCollision()`을 한 번 실행한다.

능력은 `recordAbilityResult()`로 `fighterId`, `abilityId`, `resultType`, `commandSequence`, success, 직렬화 가능한 value, simulationTimeMs를 기록한다. `BattleMetricsRecorder`는 기존 ability-use와 분리해 이를 보관하고 `focalAbilityResultTypes`에 선언한 결과 타입이 0회여도 집계에 남긴다. 능력 결과의 성공 판정과 value 의미는 각 Ability가 소유하며, 공통 메트릭은 이를 바꾸지 않는다.

### Rage·Archer 실험 슬라이스

`abilityCommandEnabled` opt-in에서만 유효 릴리스 시점의 궤적 장면을 `CommandIntent`에 plain snapshot으로 저장한다. `pathSegments`는 각 예측 구간의 끝점, `bouncePoints`는 예측 반사점, `predictedTerminal`은 예측 종점이다. 이후 물리 상태가 변해도 저장값은 변하지 않는다.

- Rage는 릴리스 순간의 충전 비율을 고정한다. 해당 커맨드가 첫 적대 전투원에 닿으면 고정된 35/70/100% 규칙으로 기존 효과를 정확히 한 번만 발동하고 기본 충돌 효과는 억제한다. 35% 미만은 충전을 초기화하지 않으며 `rage-command-cashout` 실패 결과만 남긴다.
- Archer는 다음 첫 자동 화살 한 발만 저장된 발사 방향으로 보낸다. windup·cooldown·치명타·두 번째 화살은 기존 규칙을 유지한다. 첫 화살의 실제 정적 반사 수와 hit/expire 결과는 `archer-command-shot`에 기록한다.

`METRICS_ABILITY_COMMAND_PROTOTYPE=1`에서는 focal Rage/Archer의 result attempt/match와 성공률을 함께 출력한다. 무입력은 해당 result attempt가 0이어야 하며, 기본 UI·HUD·AI 경로는 이 실험의 영향을 받지 않는다.

### Hero 실험 슬라이스

Hero는 코어 5스택을 채운 focal 플레이어가 커맨드 자원을 보유했을 때만 0.8초 동안 자동 추격을 멈추고 드래그 입력을 기다린다. full stack 전에는 `getCommandState().reserveResource`가 자동 정책의 generic 발사를 보류해 자원을 남긴다. 창 안에서는 `available: true`이고, release가 자원을 소비한 뒤에도 열린 window token으로 intent를 준비한다. AI·자원 없음·플래그 off에서는 같은 프레임에 기존 자동 추격을 그대로 시작한다. 창 안에 aim이 시작되면 release 또는 cancel까지 기다리고, cancel·timeout은 기존 추격 대상으로 즉시 되돌아간다.

유효 커맨드의 첫 적대 충돌은 기본 충돌 피해를 유지한 뒤, 저장된 드래그 방향 기준 60도 fan으로 기존 HeroOrb 5개를 방출한다. 각 orb는 `commandSequence`를 갖고 수집·수명 만료·active limit 만료·전투 종료 중 하나로 정확히 한 번 결산된다. stat cap으로 효과 적용에 실패해도 owner가 물리적으로 수집한 orb는 collected로 센다. `hero-command-core-cycle` 결과는 실제 방출·물리 수집·방패 증가·HP 회복량을 기록한다. 일반 HeroOrb와 자동 추격의 동작은 바꾸지 않는다.

### Phantom 실험 슬라이스

Phantom은 primed 상태의 focal 수동 플레이어만 `그림자 출구 지정` 커맨드를 예약한다. 예약은 primed를 소비하지만 첫 적대 terminal collision 전까지 별도 pending으로 유지한다. 충돌 시 저장한 드래그 방향을 base 순간이동 출구와 marked target을 향한 pursuit·finish 순간이동의 우선 방향으로 사용하고, 기존 22.5도 fallback 탐색과 arena clamp는 그대로 유지한다. 일반 primed collision은 기존 난수 방향과 연쇄를 바꾸지 않는다.

`phantom-command-chain`은 base 출구의 clearance, base 적중, 실제 pursuit chain 적중 수, finish 적중을 하나의 `commandSequence`에 한 번만 기록한다. base miss, 후속 stack 소진, cooldown 만료, 전투 종료에서 결산하며, command terminal 직후 런타임이 보내는 `onCommandEnd()`는 이미 시작된 연쇄를 취소하지 않는다. `METRICS_ABILITY_COMMAND_PROTOTYPE=1`의 Phantom 보고는 attempts/match·성공률과 안전 출현·base 적중·연쇄 깊이·finish 적중 평균을 함께 출력한다.

### Orbit 실험 슬라이스

Orbit은 전탄·사거리·cooldown 조건을 만족한 focal 수동 플레이어에게만 0.8초 입력창을 열어 고정 집결점을 예약한다. 유효 release는 몸체 발사 없이 기존 shard cadence·slot·피해로 payload-only volley를 시작하며, tier 1 이상은 각 projectile 생성 시 같은 집결점으로 동기화를 시작한다. `orbit-command-volley`는 방출·직접 적중·동기화 적중·tier 3 catch·계획 구간·경과 시간을 sequence별로 단일 결산한다.

### Spin 실험 슬라이스

Spin은 `abilityCommandEnabled` opt-in의 focal 수동 플레이어가 만충이고 절단 중이 아닐 때만 generic 발사 자원을 보류한다. 유효 release는 기존 `default-shot`을 그대로 사용하고, 첫 적대 terminal collision에서만 Spin charge를 실제 벽/terrain 반사당 25%, 최대 50%로 보존한다. 기본 충돌 소비는 억제하지만 tier 1 이상의 기존 deferred 표면 절단과 tier 2 가속 절삭·tier 3 관통 유체장은 바꾸지 않는다.

`spin-command-gyro-bank`는 sequence별로 tier, 발사 충전, 계획 구간, 실제 반사, 보존 충전, 직접 피해, 표면 절단, 후면 적중, 방패 반격, 경과 시간을 단 한 번 기록한다. plain/rear hit만 성공이며 shield counter도 charge cashout과 사용 계측은 한 번 실행하지만 실패 결과로 남는다. ally-stop·miss·교체·만료·reset·전투 종료는 추가 charge 소비 없이 실패로 결산한다.

### 능력 티어 장기 계측

`npm run metrics:drag-ability`는 `METRICS_PROFILE=standard`에서 기존 `1 seed / 75 seconds`, `METRICS_PROFILE=long`에서 `10 seeds / 120 seconds`를 기본으로 사용한다. `METRICS_SEEDS`와 `METRICS_MAX_SECONDS`를 지정하면 profile 기본값보다 우선하며, 알 수 없는 profile은 오류로 종료한다.

`METRICS_ABILITY_TIERS`는 0~3 정수의 쉼표 목록이고 기본값은 `0`이다. 중복은 첫 등장 순서를 유지해 제거한다. 예를 들어 `METRICS_ABILITY_TIERS=0,3`과 두 prototype 플래그를 함께 지정하면 각 stage의 `ability tier=0`과 `ability tier=3` 블록을 모두 출력한다. focal player의 실제 `progression.abilityTier`만 첫 update 전에 설정하므로 상대와 roster 원본은 바꾸지 않는다.

능력 result는 공통 attempts/match·성공률 뒤에 recorder가 기록한 value만 요약한다. Rage는 충전·피해·조기 초기화, Archer는 벽/계획 구간·경과·후속 화살 표본과 적중률, Hero는 방출/회수/방패/회복과 총 회수율, Phantom은 안전 출현/기본 적중/연쇄/종결 적중을 표시한다. 빈 표본은 0으로 표시하며, 이 계측은 게임 판정이나 수치를 다시 계산하지 않는다.

### 관측 필드

- **능력**: focal 플레이어만 대상, 첫 발동 시각(경기당 평균·중앙값), 발동 횟수(경기당), noUseRate(미발동 경기 비율). zero-use 능력은 `focalAbilityIds` 전체를 기준으로 누락 없이 표시한다. 이번 기준선은 공통 쿨다운 재시작, Archer 첫 화살 발사, Rage의 35% 이상 충전 충돌을 계측하며 다른 패시브형 능력의 고유 발동은 범위 밖이다.
- **드래그 사건**: launch, bounce, plain-hit, rear-hit, shield-counter, ally-stop, slow-stop, timeout, enemy-flight-end, enemy-launch
- **피해 출처**(origin): `combat`(자연 충돌), `drag`(플레이어 드래그 정면·후방·평타), `drag-counter`(방패 반격), `equipment`(장비 패시브)
- **출처 집계**: `damageByOrigin`은 전체 전투의 origin별 damage·hits·absorbed·경기당·전체 대비 ratio. `focalDealtByOrigin`/`focalTakenByOrigin`은 focal 플레이어가 가한/받은 origin별 동일 구조
- **focal 드래그 비율**: `focalDealtDragRatio` = focal drag dealt damage / focal total dealt damage. `drag-counter`는 별도로 `focalDealtDragCounterRatio`와 `focalTakenDragCounterRatio`로 분리 계측되며, 직접 drag 피해에 합산되지 않는다
- **드래그 상세**: launchesPerMatch, averageLaunchChargeRatio, bouncesPerMatch, maxBounceTierDistribution, hitTypes(plain-hit/rear-hit/shield-counter 경기당), endReasons(slow-stop/timeout/ally-stop 경기당)

### 자동 반사 탐색 한계

`궤적 예측 기반 반사 탐색` 정책은 `createDragTrajectoryScene()`으로 후보 각도를 평가하지만, 실제 모바일 숙련 플레이와 다음 차이가 있다.

- 평가 시점의 방패 방향은 고정되지만 실제 발사까지 0.3초 이상 차징하며 방패가 움직이거나 사라질 수 있다.
- 현재 속도·상대 이동·돌진 중 상대와의 거리 변화를 고려하지 않는다.
- 시드 재현성이 완벽하지 않아 동일 시드여도 정책 간 물리 상태가 갈리면 궤적 평가가 달라질 수 있다.
- 궤적 탐색이 로컬 최적해(단순 정면 근처)에 머물 가능성이 있다.
- 따라서 자동 반사 정책 수치(승률, duration, drag hits)는 숙련 플레이어의 실제 체감 이득보다 보수적인 하한으로 해석해야 한다.

개발자 모드의 `드래그 전투 튜닝`은 릴리즈 속도를 기본값의 0.60~1.80배로 조절한다. 같은 카드의 인라인 테스트장은 현재 선택 캐릭터의 레벨·환생·장비·숙련도를 합친 실제 기준 속도·반경·색상을 사용하고, 실제 전투와 동일한 시간 차징·자동 발사·`getDragLaunchSpeed`·선형 속도 정책으로 공을 움직인다. 캔버스에는 일반 적 조준과 호박색 가속 레일, 움직이는 테스트 공의 종료 수렴 원도 함께 표시해 상태 색·점선 속도·재입력 시점을 바로 비교한다. 이 값은 저장 프로필에 기록하지 않는 현재 세션 전용이며, 디버그 모드를 종료하면 1.00배로 돌아가고 테스트 애니메이션과 포인터 리스너도 함께 정리된다.
