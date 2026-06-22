# 클릭 액션 시스템

> **구현 상태**: 미구현 (설계 단계)
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

| 액션          | 발동 조건                                              | 효과                                                                                           | 예상 클릭 빈도              | HP 소모(maxHP 비율) |
| ------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------- | ------------------- |
| **시간 왜곡** | HP 50% 이하                                            | 클릭 시 0.25초간 상대(플레이어 제외 모든 엔티티)만 delta ×0.45로 슬로우. 연타 시 지속시간 갱신 | 매우 높음 (~0.2초마다 연타) | 0.15~0.25%          |
| **돌진**      | 상시                                                   | 클릭 시 0.2초간 내 캐릭터 속도 +20~30%                                                         | 중간 (1~2초마다)            | 0.6~0.8%            |
| **카운터**    | 상시, 단 두 공 거리가 임계값 이하(좁은 윈도우 ~0.15초) | 클릭 성공 시 다음 충돌 내 공격 데미지 +10~15%                                                  | 낮음 (매치당 손에 꼽음)     | 1.2~1.5%            |
| **받아치기**  | 상대 투사체가 나를 향해 비행 중                        | 클릭 성공 시 그 투사체 데미지 50% 경감                                                         | 캐릭터 매치업에 따라 가변   | 1.0~1.3%            |
| **버티기**    | HP 50% 이하                                            | 클릭 시 0.1초간 받는 데미지 50% 경감                                                           | 위기 구간에서 몰아서 사용   | 0.8~1.0%            |

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

    /** maxHP 대비 소모율 (0.2 = 0.2%) */
    get hpCostPercent() {
        return 0.2;
    }

    /** 발동 조건 */
    isAvailable(sim, playerBall) {
        return true;
    }

    /**
     * 액션 효과 적용 (Command Pattern).
     * 직접 상태를 변경하지 않고, 수신자(receiver) 객체의 메서드를 호출한다.
     *
     *   TimeWarpAction → sim.applyTimeWarp(0.25)
     *   RushAction     → playerBall.applyRush(0.2, 1.25)
     *   CounterAction  → sim.applyCounter()
     *   ParryAction    → proj._parryReduction = 0.5
     *   EndureAction   → playerBall.applyEndure(0.1)
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

// ── 로직 소유권 ──────────────────────────────────────────────────
//
// 액션          로직 주체              수신자 메서드
// ────────────  ────────────────────  ──────────────────────
// 시간 왜곡     BattleSimulation      applyTimeWarp(dur)
// 돌진          BattleBall            applyRush(dur, mult)
// 카운터        BattleSimulation      applyCounter()
// 받아치기      투사체 엔티티         _parryReduction 플래그
// 버티기        BattleBall            applyEndure(dur)
//
// 각 액션의 apply()는 위 수신자 메서드를 호출만 하고,
// 상태 전이/검증 로직은 수신자 클래스가 소유합니다.

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

class TimeWarpAction extends ClickAction {
    get id() {
        return "time_warp";
    }
    get name() {
        return "시간 왜곡";
    }
    get description() {
        return "0.25초간 상대만 슬로우 (HP 50% 이하)";
    }
    get hpCostPercent() {
        return 0.2;
    }
    isAvailable(sim, playerBall) {
        return playerBall.hp / playerBall.maxHp <= 0.5;
    }
    apply(sim, playerBall) {
        sim.applyTimeWarp(0.25);
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
        return "0.2초간 속도 +25%";
    }
    get hpCostPercent() {
        return 0.7;
    }
    apply(sim, playerBall) {
        playerBall.applyRush(0.2, 1.25);
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
        return "충돌 임박 시 클릭 → 데미지 +12%";
    }
    get hpCostPercent() {
        return 1.35;
    }
    isAvailable(sim, playerBall) {
        return sim.isCollisionImminent(playerBall);
    }
    apply(sim, playerBall) {
        sim.applyCounter();
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
        return "날아오는 투사체 데미지 50% 경감";
    }
    get hpCostPercent() {
        return 1.15;
    }
    isAvailable(sim, playerBall) {
        return sim.getIncomingProjectile(playerBall) !== null;
    }
    apply(sim, playerBall) {
        const proj = sim.getIncomingProjectile(playerBall);
        if (proj) proj._parryReduction = 0.5;
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
        return "0.1초간 받는 데미지 50% 경감 (HP 50% 이하)";
    }
    get hpCostPercent() {
        return 0.9;
    }
    isAvailable(sim, playerBall) {
        return playerBall.hp / playerBall.maxHp <= 0.5;
    }
    apply(sim, playerBall) {
        playerBall.applyEndure(0.1, 0.5);
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
- HP 50% 이하 조건이 있는 액션(시간 왜곡, 버티기)은 자해 소모로 계속 50% 미달 구간에 머무를 수 있다 — 의도된 자원 관리 긴장감.
- 상시형 액션도 결국 체력을 깎으므로 무분별한 남발이 곧 자기 위기로 이어짐 — 별도 가이드 없이도 자동으로 "남발 방지" 역할.
- **클릭 디바운스**: 최소 50~80ms 간격으로 입력 폭주 방지.

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
4. `action.isAvailable()`? → 무시
5. HP 소모 (`spendHpForAction`, 최소 1 보장)
6. `sim._pendingAction`에 예약 (지연 적용 패턴)

### HP 자해 소모

- 기존 `takeDamage()` 대신 `player.spendHpForAction(amount)` 별도 메서드
- 어그로/킬로그(`"Crash"` 등)에 영향 주지 않음
- 결과 판정(`checkResult()`)에서 자해로 인한 패배까지 가지 않도록 최소 1 보장

---

## 6. 구현 힌트

### 신규 파일

| 파일                   | 역할                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `src/click-actions.js` | 액션 정의 모음 (각 액션은 `{ id, name, description, hpCostPercent, isAvailable, apply }` 형태) |

### 기존 파일 변경

| 파일                                 | 변경                                                                |
| ------------------------------------ | ------------------------------------------------------------------- |
| `src/ui.js`                          | `waitForActionPick(cards)` — 카드 선택 UI 비동기 메서드 추가        |
| `src/app.js`                         | `startMatch()`에서 카드 선택 단계 추가, `currentMatchAction` 관리   |
| `src/simulation/BattleSimulation.js` | 생성자에 `playerFighterId`, `matchAction` 인자 추가, 시간 왜곡 구현 |
| `src/entities.js`                    | `BattleBall.spendHpForAction()` 추가, 투사체에 `ownerId` 참조 확인  |
| `ArenaRenderer`                      | 캔버스 `pointerdown` 이벤트 바인딩                                  |

### 카운터 판정

`BattleSimulation.handleCollision()` 참고. 두 공의 거리가 충돌 직전(임계값 이하) 상태일 때만 유효한 좁은 윈도우(~0.15초)로 구현.

### 받아치기 판정

투사체 엔티티(ArrowProjectile, Grenade, OrbitProjectile, SeedOrb)의 `update()`에서 타겟 방향과 거리 계산 로직 참고. 투사체가 플레이어를 향해 비행 중일 때만 유효.

### 시간 왜곡 구현

```js
// BattleSimulation.update(delta):
for (const entity of this.entities) {
    const isPlayerOwned = entity === this.playerBall;
    const scaledDelta = this.timeSlowRemaining > 0 && !isPlayerOwned ? delta * 0.45 : delta;
    entity.update(scaledDelta, this);
}
```

---

## 7. 밸런스 노트 (초기값, 추후 조정)

- HP 소모율과 효과 수치는 초기값이며 실제 플레이 테스트 후 조정
- "받아치기"처럼 캐릭터 조합에 따라 활용도가 크게 갈리는 액션은, 테스트 결과 너무 무용지물이면 발동 조건을 넓히거나 풀에서 제외 검토
- HP 자해 소모가 누적되어 "액션을 쓸수록 오히려 빨리 진다"는 체감이 너무 강하면 소모율을 낮추거나 효과 이득을 키워 균형 조정
- 추후 액션이 6개 이상으로 늘어나면 가중치 랜덤(완전 균등이 아닌 확률 조정) 고려 가능

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
- [ ] 돌진: 0.2초 지속 자연스럽게 적용/해제
- [ ] 카운터: 판정 윈도우 난이도 적절
- [ ] 받아치기: 투사체 없는 매치업에서 무용지물 문제 검토
- [ ] 오버타임과 동시 사용 시 충돌 없음
- [ ] 매치 종료 후 캔버스 클릭 트리거 안 됨
- [ ] 클릭 디바운스가 과도한 연타 방지
