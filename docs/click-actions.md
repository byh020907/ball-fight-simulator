# 클릭 액션 시스템

> **구현 상태**: 구현 완료 (v0.9.0)
> **구현 계획**: [`docs/implementation-plan.md`](implementation-plan.md)
> **관련 문서**: [`docs/design.md`](design.md) (시각 방향), [`docs/game-rules.md`](game-rules.md) (게임 규칙)

## 한 줄 요약

매치 시작 시 **여러 클릭 액션 중 하나가 무작위로 배정**된다. 전투 영역을 클릭하면 그 액션이 발동하며, 실제 전투 결과에 영향을 주는 효과를 낸다. 별도 자원 게이지를 만들지 않고 **클릭 1회당 내 캐릭터의 HP를 소모**시켜 자원 관리 + 남발 방지를 동시에 해결한다.

---

## 1. 동기 / 철학

- 이 프로젝트는 "최소 상호작용으로 바로 시뮬레이션을 돌려보는" 관전형 게임이다.
- 전투 중 사용자가 개입할 수 있는 **단일 상호작용(클릭)** 을 추가한다.
- 매치마다 다른 액션이 배정되어 매번 다른 플레이 경험을 만든다.
- **코스메틱(순수 비주얼) 액션은 모두 제외한다.** 모든 클릭 액션은 실제 결과에 영향을 줘야 한다.
- **자원은 별도로 만들지 않고, 클릭 시 내 캐릭터 자신의 HP를 소모**한다.
- **별도 버튼 UI를 만들지 않고, 전투 영역(캔버스) 자체를 터치/클릭 영역으로 사용**한다.

---

## 2. 액션 배정 (카드 선택형)

### 흐름

1. 매치 시작 시점(대진 확정 후, 전투 시작 전), 액션 풀에서 **무작위로 3개를 뽑아 카드 형태로 제시**
2. 유저가 그중 1개를 선택 (League of Legends 무작위 증강 선택 UI와 동일 패턴)
3. 선택된 액션이 해당 매치의 `currentMatchAction`으로 고정
4. **매치마다 새로 뽑고 새로 선택** (토너먼트 전체가 아니라 경기 단위)
5. 카드 3장은 중복 없이 뽑는다. 풀 크기가 3 미만이면 풀 전체를 보여주고 선택만 받는다.

### 카드 UI 규칙

- 카드에는 액션명 + 짧은 효과 설명 + (선택) HP 소모율 표시
- 기존 모달/오버레이 패턴(`showOverlay`)을 재사용
- 카드 3개를 탭하면 즉시 확정, 별도 "확인" 버튼 불필요
- "최소 상호작용" 철학에 맞춰 가볍게 구현

### 예외

- 내 캐릭터가 매치에 없을 때(이미 탈락 후 다른 매치)는 카드 선택 단계 자체를 생략

---

## 3. 액션 풀

모든 액션은 **클릭 1회당 maxHP의 일정 비율을 자해 소모**한다.

| 액션          | 발동 조건      | 효과                                                                                 | 예상 클릭 빈도              | HP 소모(maxHP 비율) |
| ------------- | -------------- | ------------------------------------------------------------------------------------ | --------------------------- | ------------------- |
| **시간 왜곡** | 상시           | 클릭 시 0.5초간 상대(플레이어 제외 모든 엔티티)만 35% 속도로 슬로우. 연타 시 갱신      | 매우 높음 (~0.2초마다 연타) | 0.5%                |
| **돌진**      | 상시           | 클릭 시 1초간 내 캐릭터 속도 +50%                                                    | 중간 (1~2초마다)            | 1.0%               |
| **카운터**    | 상시           | 클릭 시 0.20초간 충돌 window. 맞으면 공격 데미지 +100%, 빗나가면 HP만 소모.            | 낮음 (매치당 손에 꼽음)     | 1.5%               |
| **받아치기**  | 상시           | 클릭 시 0.3초간 투사체 피해 75% 경감 window. 성공하면 HP 비용 회수.                    | 중간 (예측 샷)             | 1.0%               |
| **버티기**    | 상시           | 클릭 시 0.1초간 받는 모든 데미지 80% 경감                                             | 위기 구간에서 몰아서 사용   | 1.0%               |

### 액션 정의 형식 (클래스 기반)

```js
// src/click-actions.js — Strategy Pattern

// ── Trigger Strategy ─────────────────────────────────────────────
// Action의 "어떻게 발동되는지"를 캡슐화한다.
// 입력 핸들러는 trigger의 메서드만 호출하면 됨.

class TriggerStrategy {
    get type() {
        return "tap";
    }
    onPointerDown(ctx) {}
    onPointerUp(ctx) {}
    onTick(ctx) {}
}

class TapTrigger extends TriggerStrategy {
    get type() {
        return "tap";
    }
    onPointerDown(ctx) {
        ctx.fireAction();
    }
}

class ReleaseTrigger extends TriggerStrategy {
    get type() {
        return "release";
    }
    onPointerDown(ctx) {
        ctx._holdStarted = true;
    }
    onPointerUp(ctx) {
        if (ctx._holdStarted) ctx.fireAction();
        ctx._holdStarted = false;
    }
}

class HoldTrigger extends TriggerStrategy {
    get type() {
        return "hold";
    }
    onPointerDown(ctx) {
        ctx._holding = true;
    }
    onPointerUp(ctx) {
        if (ctx._holding && ctx._consumed) {
            ctx.action.onRelease?.(ctx.sim, ctx.player);
        }
        ctx._holding = false;
        ctx._consumed = false;
    }
    onTick(ctx) {
        if (!ctx._holding) return;
        if (!ctx.action.canHoldContinue?.(ctx.sim, ctx.player)) return;
        ctx.fireAction();
        ctx._consumed = true;
    }
}

// ── Action Base ──────────────────────────────────────────────────

class ClickAction {
    /**
     * @param {TriggerStrategy} trigger — 발동 방식. 기본 TapTrigger.
     */
    constructor(trigger = new TapTrigger()) {
        this.trigger = trigger;
    }

    get id() {
        throw new Error("override");
    }
    get name() {
        throw new Error("override");
    }
    get description() {
        throw new Error("override");
    }

    /** maxHP 대비 소모율 (0.5 = 0.5%) */
    get hpCostPercent() {
        return 0.2;
    }

    /** 발동 조건은 실패 이유로 표현한다. null이면 조건 만족. */
    getFailureReason(sim, playerBall) {
        return null;
    }

    /**
     * 액션 효과 적용. Action이 로직의 주체.
     * domain 객체의 데이터 접근 함수(getXxx/setXxx)를 통해 값을 읽고,
     * Action 내에서 알고리즘(계산/연장/조건)을 직접 수행한다.
     */
    apply(sim, playerBall) {
        throw new Error("override");
    }

    /** trigger === HoldTrigger 전용 */
    onRelease(sim, playerBall) {}
    canHoldContinue(sim, playerBall) {
        return true;
    }
}

// ── 액션별 로직 소유권 ──────────────────────────────────────────
//
// 액션          Action이 소유한 로직                        Domain 인터페이스
// ────────────  ─────────────────────────────────────────  ──────────────────────────────
// 시간 왜곡     max(현재값, duration) 후 저장               sim.get/ setTimeSlowRemaining()
// 돌진          지속시간 연장 or 신규 + 배율 적용            ball.actionContext.getEffect(), setEffect()
// 카운터        timed effect 등록 (0.20s, onFighterCollision) ball.actionContext.setEffect()
// 받아치기      timed effect 등록 (0.3s, onProjectileDamage)  ball.actionContext.setEffect()
// 버티기        경감 effect 등록                            ball.actionContext.setEffect()

// 핸들러 ctx 객체는 app.js에서 이렇게 구성:
// const ctx = {
//     action: this.currentMatchAction,
//     sim: this.simulation,
//     player: this.simulation?.playerBall,
//     _holding: false, _consumed: false, _holdStarted: false,
//     fireAction() { /* 공통: HP 소모 + 지연 적용 */ }
// };

// pointerdown → action.trigger.onPointerDown(ctx);
// pointerup   → action.trigger.onPointerUp(ctx);
// 매 프레임   → action.trigger.onTick(ctx);

// ── 미래 확장 예: HoldTrigger 사용 ──────────────────────────────

class ChargeAction extends ClickAction {
    constructor() {
        super(new HoldTrigger());
    }

    get id() {
        return "charge";
    }
    get name() {
        return "차지";
    }
    get description() {
        return "누르는 동안 충전, 떼면 방출";
    }
    get hpCostPercent() {
        return 0.15;
    }

    apply(sim, playerBall) {
        sim.chargeLevel = Math.min(1, (sim.chargeLevel ?? 0) + 0.03);
    }

    onRelease(sim, playerBall) {
        const dmg = Math.round((sim.chargeLevel ?? 0) * 30);
        sim.getOpponent(playerBall).takeDamage(dmg, playerBall, "Charge");
        sim.chargeLevel = 0;
    }
}

// ── 기존 액션들 (모두 TapTrigger 기본값) ─────────────────────────

const TIME_WARP_DURATION = 0.5;
const TIME_WARP_COST = 0.5;

const RUSH_DURATION = 1;
const RUSH_SPEED_BONUS = 0.5;
const RUSH_COST = 1.0;

const COUNTER_WINDOW_SECONDS = 0.2;
const COUNTER_BONUS_RATE = 1.0;
const COUNTER_COST = 1.5;

const PARRY_WINDOW_SECONDS = 0.3;
const PARRY_DAMAGE_MULTIPLIER = 0.25;
const PARRY_COST = 1.0;

const ENDURE_DURATION = 0.1;
const ENDURE_DAMAGE_MULTIPLIER = 0.2;
const ENDURE_COST = 1.0;

class TimeWarpAction extends ClickAction {
    get id() {
        return "time_warp";
    }
    get name() {
        return "시간 왜곡";
    }
    get description() {
        return `${TIME_WARP_DURATION}초간 상대만 슬로우`;
    }
    get hpCostPercent() {
        return TIME_WARP_COST;
    }
    apply(sim, playerBall) {
        const current = sim.getTimeSlowRemaining();
        sim.setTimeSlowRemaining(Math.max(current, TIME_WARP_DURATION));
    }
}

class RushAction extends ClickAction {
    get id() {
        return "rush";
    }
    get name() {
        return "돌진";
    }
    get description() {
        return `${RUSH_DURATION}초간 속도 +${RUSH_SPEED_BONUS * 100}%`;
    }
    get hpCostPercent() {
        return RUSH_COST;
    }
    apply(sim, playerBall) {
        const current = playerBall.actionContext.getEffect(this.id)?.remaining ?? 0;
        playerBall.actionContext.setEffect(this.id, {
            remaining: current > 0 ? current + RUSH_DURATION : RUSH_DURATION,
            getSpeedMultiplier: () => 1 + RUSH_SPEED_BONUS
        });
    }
}

class CounterAction extends ClickAction {
    get id() {
        return "counter";
    }
    get name() {
        return "카운터";
    }
    get description() {
        return `${COUNTER_WINDOW_SECONDS.toFixed(2)}초 안에 충돌 시 데미지 +${COUNTER_BONUS_RATE * 100}%`;
    }
    get hpCostPercent() {
        return COUNTER_COST;
    }
    apply(sim, playerBall) {
        playerBall.actionContext.setEffect(this.id, {
            remaining: COUNTER_WINDOW_SECONDS,
            onFighterCollision: (owner, opponent, outgoingDamage, incomingDamage, simulation) => {
                opponent.takeDamage(Math.round(outgoingDamage * COUNTER_BONUS_RATE), owner, "Counter");
                simulation.spawnActionText(opponent.position.clone(), "카운터!", "#ff8844");
            }
        });
    }
}

class ParryAction extends ClickAction {
    get id() {
        return "parry";
    }
    get name() {
        return "받아치기";
    }
    get description() {
        return `${PARRY_WINDOW_SECONDS}초 안에 맞는 투사체 데미지 ${(1 - PARRY_DAMAGE_MULTIPLIER) * 100}% 경감`;
    }
    get hpCostPercent() {
        return PARRY_COST;
    }
    apply(sim, playerBall, paidCost = 0) {
        playerBall.actionContext.setEffect(this.id, {
            remaining: PARRY_WINDOW_SECONDS,
            onProjectileDamage: (amount, projectile, source, label, simulation, target) => {
                target.actionContext.refundHpForAction(target, paidCost);
                simulation.spawnActionText(target.position.clone(), "받아치기!", "#44ddff");
                return Math.round(amount * PARRY_DAMAGE_MULTIPLIER);
            }
        });
    }
}

class EndureAction extends ClickAction {
    get id() {
        return "endure";
    }
    get name() {
        return "버티기";
    }
    get description() {
        return `${ENDURE_DURATION}초간 받는 모든 데미지 ${(1 - ENDURE_DAMAGE_MULTIPLIER) * 100}% 경감`;
    }
    get hpCostPercent() {
        return ENDURE_COST;
    }
    apply(sim, playerBall) {
        playerBall.actionContext.setEffect(this.id, {
            remaining: ENDURE_DURATION,
            onDamageTaken: (amount) => Math.round(amount * ENDURE_DAMAGE_MULTIPLIER)
        });
    }
}

// 레지스트리
const ACTION_DEFS = Object.freeze([
    new TimeWarpAction(),
    new RushAction(),
    new CounterAction(),
    new ParryAction(),
    new EndureAction()
]);
```

---

## 4. 안전장치

- **자해 소모로 인해 본인이 죽지 않아야 한다.** 최소 HP 1을 보장. 현재 HP가 5% 이하면 액션 자동 무효.
- 과도한 연타는 별도 디바운스가 아니라 HP 소모와 최소 HP 1 보장으로 억제한다.

---

## 5. 입력 방식 (Strategy Pattern)

- **별도 버튼 없음.** 전투 캔버스 전체가 입력 대상 (`pointerdown` + `pointerup` + `pointerleave`)
- 입력 핸들러는 `action.trigger.onPointerDown(ctx)` / `onPointerUp(ctx)` / `onTick(ctx)` 만 호출
- 각 TriggerStrategy 구현체(TapTrigger / ReleaseTrigger / HoldTrigger)가 내부에서 `ctx.fireAction()` 호출 시점 결정
- `ctx` 객체는 `{ action, sim, player, _holding, _consumed, fireAction() }` 형태

| Trigger          | pointerdown   | pointerup    | tick                       |
| ---------------- | ------------- | ------------ | -------------------------- |
| `TapTrigger`     | fireAction()  | —            | —                          |
| `ReleaseTrigger` | \_holdStarted | fireAction() | —                          |
| `HoldTrigger`    | \_holding     | onRelease()  | canHoldContinue→fireAction |

### fireAction 검사 순서 (모든 trigger 공통)

1. 매치 finished? → 무시
2. playerBall exists + not defeated?
3. HP 5% 미만? → 무시
4. `action.getFailureReason(sim, player)`가 이유를 반환하면 화면 텍스트로 실패 피드백 표시 후 무시
5. HP 소모 (`player.actionContext.spendHpForAction(player, cost)`, 최소 1 보장) 후 실제 소모량 `paidCost` 저장
6. `sim.scheduleAction(action, player, paidCost)`로 예약 (지연 적용 패턴)

실패 피드백은 브라우저 콘솔 로그가 아니라 전투 화면 텍스트(`spawnActionText`)를 기준으로 표시한다.

### HP 자해 소모

- 기존 `takeDamage()` 대신 `player.actionContext.spendHpForAction(player, amount)` 경로 사용
- 어그로/킬로그(`"Crash"` 등)에 영향 주지 않음
- 결과 판정(`checkResult()`)에서 자해로 인한 패배까지 가지 않도록 최소 1 보장

---

## 6. 구현 힌트

### 신규 파일

| 파일                   | 역할                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `src/click-actions.js` | 액션 정의 모음 (각 액션은 `{ id, name, description, hpCostPercent, getFailureReason, apply }` 형태) |

### 기존 파일 변경

| 파일                                 | 변경                                                                |
| ------------------------------------ | ------------------------------------------------------------------- |
| `src/ui.js`                          | `waitForActionPick(cards)` — 카드 선택 UI 비동기 메서드 추가        |
| `src/app.js`                         | `startMatch()`에서 카드 선택 단계 추가, `currentMatchAction` 관리   |
| `src/simulation/BattleSimulation.js` | 생성자에 `playerFighterId`, `matchAction` 인자 추가, 시간 왜곡 구현 |
| `src/entities.js`                    | `BattleBall.actionContext` 보유, 투사체에 `ownerId` 참조 확인       |
| `src/click-actions.js`               | 액션 정의, 실패 피드백, `ActionContext` effect 저장소 보유          |
| `ArenaRenderer`                      | 캔버스 `pointerdown` 이벤트 바인딩                                  |

### 카운터 판정

더 이상 충돌 임박 여부를 미리 체크하지 않는다. 사용자가 카운터를 누르면 무조건 HP를 소모하고 0.20초짜리 충돌 window가 열린다. 이 window 안에 충돌하면 `ActionContext.onFighterCollision()`이 +100% 추가 피해와 텍스트를 처리하고, 충돌하지 못하면 HP만 소모된 채 만료된다.

### 받아치기 판정

더 이상 투사체 접근 여부를 미리 체크하지 않는다. 사용자가 받아치기를 누르면 무조건 HP를 소모하고 0.3초짜리 받아치기 window가 열린다. 이 window 안에 투사체 공통 hit 경로가 `ActionContext.onProjectileDamage()`를 호출하면 피해량을 75% 경감하고 "받아치기!" 텍스트를 표시하며, 실제로 지불한 HP 비용을 회수한다. 일반 충돌/근접 피해는 받아치기로 줄어들지 않는다.

### 시간 왜곡 구현

```js
// BattleSimulation.update(delta):
for (const entity of this.entities) {
    const isPlayerOwned = entity === this.playerBall;
    const scaledDelta = this.timeSlowRemaining > 0 && !isPlayerOwned ? delta * 0.35 : delta;
    entity.update(scaledDelta, this);
}
```

---

## 7. 밸런스 노트 (초기값, 추후 조정)

- HP 소모율과 효과 수치는 초기값이며 실제 플레이 테스트 후 조정
- 받아치기는 모든 매치업에서 항상 사용 가능 (상시 발동 + 0.3초 window)으로 무용지물 문제 해결
- HP 자해 소모가 누적되어 "액션을 쓸수록 오히려 빨리 진다"는 체감이 너무 강하면 소모율을 낮추거나 효과 이득을 키워 균형 조정
- 추후 액션이 6개 이상으로 늘어나면 가중치 랜덤(완전 균등이 아닌 확률 조정) 고려 가능

### 값 정렬 규칙 (v0.9.0)

**효과값은 0.05(5%) 단위, HP 코스트는 0.5%p 단위**로 정렬한다. 이유:
1. **정수비 직관성** — 0.05 단위(5%, 10%, 25%, 50%)는 플레이어가 체감하고 비교하기 쉽다. 12%나 22%는 즉각적인 가치 판단이 어렵다.
2. **확장 일관성** — 새 액션을 추가할 때도 같은 단위를 강제하면 과도하게 미세한 값(1.08% 같은)이 들어가는 것을 방지한다.
3. **코드 정합성** — 상수 하나로 `description`과 `apply()`가 동시에 갱신되므로, 문서와 구현이 자동으로 일치한다. (src/click-actions.js 상단 모듈 상수 참고)

| 액션 | 코스트 | 효과 |
|------|--------|------|
| 시간 왜곡 | 0.5% | 0.5s 슬로우 |
| 돌진 | 1.0% | 1.0s 속도 +50% |
| 카운터 | 1.5% | 0.20s window, 충돌 시 +100% |
| 받아치기 | 1.0% | 0.3s window, 투사체 75% 경감 + 성공 시 비용 회수 |
| 버티기 | 1.0% | 0.1s window, 모든 피해 80% 경감 |

---

## 8. 테스트 체크리스트

- [ ] 매치마다 카드 3장이 무작위로 뽑히고 중복 없이 표시
- [ ] 카드 선택 전까지 매치(전투)가 시작되지 않음
- [ ] 카드 선택 즉시 확정, 추가 확인 절차 없이 다음 단계로 진행
- [ ] 풀이 3개 미만일 때 풀 전체 표시 예외 처리
- [ ] 내 캐릭터가 매치에 없을 때 카드 선택 단계 생략
- [ ] 내 캐릭터가 매치에 없을 때 클릭 무효
- [ ] 각 액션의 발동 조건 정확히 동작
- [ ] HP 자해 소모로 패배 처리되지 않음 (최소 HP 1 보장)
- [ ] 시간 왜곡: 연타 시 슬로우 갱신, 상대만 느려짐
- [ ] 돌진: 1초 지속 자연스럽게 적용/해제
- [ ] 카운터: 판정 윈도우 난이도 적절
- [x] 받아치기: 투사체 없는 매치업에서 무용지물 문제 해결 (상시 발동 + 0.3s window)
- [ ] 오버타임과 동시 사용 시 충돌 없음
- [ ] 매치 종료 후 캔버스 클릭 트리거 안 됨
- [x] HP 소모와 최소 HP 1 보장이 과도한 연타를 억제
