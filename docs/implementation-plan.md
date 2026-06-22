# 클릭 액션 시스템 — 구현 계획

> **상태**: 계획 단계 (미구현)
> **설계 문서**: [`docs/click-actions.md`](click-actions.md)

---

## 개요

5단계로 나누어 점진적으로 구현. 각 단계는 독립적으로 테스트 가능하며, 이전 단계에 의존하지 않음.

```
1단계: click-actions.js (액션 정의)
2단계: BattleSimulation 연동 (시뮬레이션 수정)
3단계: app.js + 카드 선택 UI (비동기 선택 흐름)
4단계: 클릭 핸들러 + spendHpForAction (입력 처리)
5단계: 카운터 + 받아치기 판정 (고급 액션)
```

---

## 1단계: `src/click-actions.js` — Strategy Pattern + 액션 클래스 계층

### 대상 파일

- **신규**: `src/click-actions.js`

### 클래스 구조

```js
// ── Trigger Strategy ──
class TriggerStrategy {
    get type() { return "tap"; }
    onPointerDown(ctx) {}
    onPointerUp(ctx) {}
    onTick(ctx) {}
}
class TapTrigger extends TriggerStrategy { ... }
class ReleaseTrigger extends TriggerStrategy { ... }
class HoldTrigger extends TriggerStrategy { ... }

// ── Action ──
class ClickAction {
    constructor(trigger = new TapTrigger()) { this.trigger = trigger; }
    get id()           { throw new Error("override"); }
    get name()         { throw new Error("override"); }
    get description()  { throw new Error("override"); }
    get hpCostPercent(){ return 0.2; }
    isAvailable(sim, playerBall) { return true; }
    apply(sim, playerBall)       { throw new Error("override"); }
    onRelease(sim, playerBall)   {}  // HoldTrigger 전용
    canHoldContinue(sim, playerBall) { return true; }
}

// 5개 서브클래스: 모두 new TapTrigger() 기본 사용
// class TimeWarpAction extends ClickAction { ... }
```

### 내보내는 심볼

| 심볼                           | 설명                                         |
| ------------------------------ | -------------------------------------------- |
| `ClickAction`                  | 베이스 클래스                                |
| `ActionPool`                   | `Object.freeze([new TimeWarpAction(), ...])` |
| `pickRandomActions(count = 3)` | 풀에서 shuffle 후 count개 반환               |
| `findActionById(id)`           | id로 Action 인스턴스 lookup                  |

### 구현 순서

1. `ClickAction` 베이스 클래스 정의 (getter + `isAvailable` + `apply`)
2. 5개 서브클래스 정의 (id, name, description, hpCostPercent)
3. 1단계에서는 `isAvailable()` → 항상 `true` 반환 (조건 로직은 5단계)
4. 1단계에서는 `apply()` → 빈 구현 (효과 로직은 2단계)
5. `ActionPool` 인스턴스 배열
6. `pickRandomActions()` — Fisher-Yates 셔플 후 slice
7. `findActionById(id)` — `ActionPool.find(a => a.id === id)`

---

## 2단계: `BattleSimulation` — 시뮬레이션 연동

### 대상 파일

- `src/simulation/BattleSimulation.js`

### 작업 내용

#### 2-A. 생성자에 `playerBall` 인자 추가

```js
constructor(fighterSpecs, hooks, playerBall = null) {
    // ...기존 코드...
    this.playerBall = playerBall;
    this.matchAction = null;
    this.actionCooldown = 0;

    // 시간 왜곡 상태 (BattleSimulation 소유)
    this.timeSlowRemaining = 0;
    this.timeSlowFactor = 0.45;

    // 카운터 상태 (BattleSimulation 소유)
    this.counterCharged = false;
    this.counterChargeTimer = 0;

    // 수신자 메서드 — 액션의 apply()가 이 메서드를 호출한다
}

/** 시간 왜곡 — Action → sim.applyTimeWarp(duration) */
applyTimeWarp(duration) {
    this.timeSlowRemaining = Math.max(this.timeSlowRemaining, duration);
}

/** 카운터 — Action → sim.applyCounter() */
applyCounter() {
    this.counterCharged = true;
    this.counterChargeTimer = 0.3;
}

/** 충돌 임박 감지 — Action → sim.isCollisionImminent(player) */
isCollisionImminent(playerBall) {
    const opponent = this.fighters.find(f => f !== playerBall);
    if (!opponent) return false;
    const gap = Vector2.subtract(opponent.position, playerBall.position).length()
                - playerBall.radius - opponent.radius;
    return gap <= 20;
}

/** 접근 중인 투사체 찾기 — Action → sim.getIncomingProjectile(player) */
getIncomingProjectile(playerBall) {
    for (const e of this.entities) {
        if (!e.ownerId || e.ownerId === playerBall.id) continue;
        const toPlayer = Vector2.subtract(playerBall.position, e.position);
        if (toPlayer.length() < 300 && e.velocity.dot(toPlayer) > 0) return e;
    }
    return null;
}
```

#### 2-B. 엔티티 update에 시간 왜곡 적용

`update(delta)` 내 엔티티 루프 수정:

```js
// 기존: for (const entity of this.entities) entity.update(delta, this);
for (const entity of this.entities) {
    const isPlayer = entity === this.playerBall;
    const scaledDelta = this.timeSlowRemaining > 0 && !isPlayer ? delta * this.timeSlowFactor : delta;
    entity.update(scaledDelta, this);
}
if (this.timeSlowRemaining > 0) this.timeSlowRemaining -= delta;
```

#### 2-C. `getSpeedMultiplier()`에 돌진 효과 반영 (BattleBall 소유)

```js
// BattleBall
applyRush(duration, multiplier) {
    this.rushEffect = { remaining: duration, multiplier };
}

// BattleSimulation.getSpeedMultiplier()에 반영 (playerBall만 적용)
getSpeedMultiplier() {
    const overtimeMult = this.isOvertime() ? Math.min(1.58, 1.12 + ...) : 1;
    const rushMult = this.playerBall?.rushEffect?.remaining > 0
        ? this.playerBall.rushEffect.multiplier : 1;
    return overtimeMult * rushMult;
}
```

#### 2-D. `applyAction(actionId)` 메서드 추가

```js
applyAction(actionId) {
    const action = findActionById(actionId);
    if (!action) return;
    action.apply(this, this.playerBall);
}
```

#### 2-E. 카운터/받아치기용 헬퍼 (5단계에서 구현)

```js
isCollisionImminent(playerBall) {
    const opponent = this.fighters.find(f => f !== playerBall);
    if (!opponent) return false;
    const dist = Vector2.subtract(opponent.position, playerBall.position).length();
    const gap = dist - playerBall.radius - opponent.radius;
    return gap <= 20;
}

getIncomingProjectile(playerBall) {
    for (const e of this.entities) {
        if (!e.ownerId || e.ownerId === playerBall.id) continue;
        const toPlayer = Vector2.subtract(playerBall.position, e.position);
        if (toPlayer.length() < 300 && e.velocity.dot(toPlayer) > 0) return e;
    }
    return null;
}
```

### 검증

```js
// npm test 통과 확인 (기존 회귀 테스트 깨지지 않아야 함)
```

---

## 3단계: `app.js` + 카드 선택 UI — 비동기 선택 흐름

### 대상 파일

- `src/app.js`
- `src/ui.js`
- `index.html`

### 작업 내용

#### 3-A. `click-actions.js` import 및 startMatch에 카드 선택 단계 추가

`src/app.js`:

```js
import { pickRandomActions, findActionById } from "./click-actions.js";

// startMatch() 내, simulation 생성 전에 추가:
if (this._isPlayerInMatch(match)) {
    const cards = pickRandomActions(3);
    const picked = await this.ui.waitForActionPick(cards);
    this.currentMatchAction = findActionById(picked);
} else {
    this.currentMatchAction = null;
}

// simulation 생성 시 전달:
this.simulation = new BattleSimulation(match, { ... }, this._getPlayerBall(match));
this.simulation.matchAction = this.currentMatchAction;

// 헬퍼 메서드
_isPlayerInMatch(match) {
    return match.some(f => f.id === this.playerFighterId);
}
_getPlayerBall(match) {
    // match 배열에서 playerFighterId와 일치하는 fighter spec의 index 반환
    const idx = match.findIndex(f => f.id === this.playerFighterId);
    return idx >= 0 ? this.simulation?.fighters[idx] ?? null : null;
}
```

#### 3-B. `UIController.waitForActionPick(cards)` — Promise 기반 카드 선택

`src/ui.js`:

```js
async waitForActionPick(cards) {
    return new Promise((resolve) => {
        // PopupService.show() 재사용
        const bodyHtml = `
            <div class="action-pick">
                <p>매치 액션을 선택하세요</p>
                <div class="action-cards">
                    ${cards.map((c, i) => `
                        <button class="action-card" data-index="${i}">
                            <strong>${c.name}</strong>
                            <span>${c.description}</span>
                            <small>HP ${c.hpCostPercent}% 소모</small>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // 각 카드에 클릭 리스너
        // 선택되면 PopupService.resolve(cards[i].id)
        // PopupService.show()에 buttons: [] (버튼 없음, 카드 클릭만)
    });
}
```

### 의사결정

| 옵션              | 선택                             | 이유                                                              |
| ----------------- | -------------------------------- | ----------------------------------------------------------------- |
| 카드 UI 구현 방식 | **PopupService 재사용**          | 새 모달 시스템 불필요, `x-show` 기반이라 Alpine과 자연스럽게 연동 |
| 선택 데이터 전달  | **PopupService.resolve(cardId)** | Promise 패턴 일관성 유지                                          |

### 검증

- 카드 3장이 오버레이로 표시되는지
- 카드 탭 즉시 resolve되는지
- 내 캐릭터가 없는 매치는 이 단계를 skip하는지

---

## 4단계: 클릭 핸들러 + HP 자해

### 대상 파일

- `src/ui.js` (ArenaRenderer)
- `src/app.js`
- `src/entities.js`

### 작업 내용

#### 4-A. `BattleBall.spendHpForAction(amount)` 추가

`src/entities.js`:

```js
spendHpForAction(amount) {
    const cost = Math.min(amount, this.hp - 1);  // 최소 1 남김
    this.hp -= cost;
    return cost;
}
```

#### 4-B. 캔버스 핸들러 — TriggerStrategy 기반 위임

`app.js` — `startMatch()` 내에서. action.trigger가 모든 포인터 해석을 담당:

```js
// ctx 객체 — TriggerStrategy의 onPointerDown/Up/Tick에 전달됨
this._actionCtx = {
    action: null,       // startMatch에서 설정
    sim: null,
    player: null,
    _holding: false,
    _consumed: false,
    _holdStarted: false,
    fireAction: () => this._tryFireAction()
};

// pointerdown: action.trigger.onPointerDown(ctx) 위임
this._pointerHandler = (e) => {
    if (this.simulation?.finished) return;
    if (!this.currentMatchAction) return;
    this._actionCtx.action = this.currentMatchAction;
    this._actionCtx.sim = this.simulation;
    this._actionCtx.player = this.simulation.playerBall;
    this.currentMatchAction.trigger.onPointerDown(this._actionCtx);
};

// pointerup / pointerleave: 위임
this._pointerUpHandler = (e) => {
    this._actionCtx.action?.trigger.onPointerUp(this._actionCtx);
};

// 매 프레임 (game loop tick 내): 위임
_handleActionTick() {
    this._actionCtx.action?.trigger.onTick(this._actionCtx);
}

// 공통 fireAction 로직
_tryFireAction() {
    const { player, sim, action } = this._actionCtx;
    if (!player || player.isDefeated) return false;
    if (player.hp / player.maxHp < 0.05) return false;
    if (!action.isAvailable(sim, player)) return false;

    const cost = Math.ceil((player.maxHp * action.hpCostPercent) / 100);
    if (player.spendHpForAction(cost) <= 0) return false;

    // 지연 적용 (리스크 ①)
    sim._pendingAction = { actionInstance: action, playerBall: player };
    return true;
}

// 바인딩
this.elements.canvas.addEventListener("pointerdown", this._pointerHandler);
this.elements.canvas.addEventListener("pointerup", this._pointerUpHandler);
this.elements.canvas.addEventListener("pointerleave", this._pointerUpHandler);
```

핸들러는 `trigger.onPointerDown(ctx)` / `onPointerUp(ctx)` / `onTick(ctx)`만 호출.
TapTrigger / ReleaseTrigger / HoldTrigger 각각의 내부 로직이 `ctx.fireAction()` 호출 시점을 결정.

#### 4-C. 매치 종료 시 핸들러 제거

```js
if (this._pointerHandler) {
    this.elements.canvas.removeEventListener("pointerdown", this._pointerHandler);
    this.elements.canvas.removeEventListener("pointerup", this._pointerUpHandler);
    this.elements.canvas.removeEventListener("pointerleave", this._pointerUpHandler);
    this._pointerHandler = null;
    this._pointerUpHandler = null;
    this._actionCtx = null;
}
```

### 검증

- 클릭 시 HP가 정상적으로 차감되는지
- HP 1 이하로 안 떨어지는지
- finished 상태에서 클릭 무시되는지
- 디바운스 동작 확인

---

## 5단계: 고급 액션 판정 (카운터 + 받아치기)

### 대상 파일

- `src/click-actions.js` (서브클래스 `isAvailable`/`apply` 채우기)
- `src/simulation/BattleSimulation.js` (헬퍼 2-E 구현)
- `src/entities.js` (ownerId)

### 작업 내용

#### 5-A. 투사체에 `ownerId` 참조 추가

`entities.js` — 각 투사체 생성자에 추가 (기존 `this.owner` 유지):

- `ArrowProjectile`: `this.ownerId = owner.id`
- `Grenade`: `this.ownerId = owner.id`
- `OrbitProjectile`: `this.ownerId = owner.id`
- `SeedOrb`: `this.ownerId = owner.id`

#### 5-B. 받아치기(ParryAction) — 로직 소유: 투사체 엔티티

```js
class ParryAction extends ClickAction {
    isAvailable(sim, playerBall) {
        return sim.getIncomingProjectile(playerBall) !== null;
    }

    apply(sim, playerBall) {
        const proj = sim.getIncomingProjectile(playerBall);
        if (proj) proj._parryReduction = 0.5;
    }
}
```

투사체 `update()`의 `takeDamage` 전에 `_parryReduction` 확인 → 50% 경감.

#### 5-C. 카운터(CounterAction) — 로직 소유: BattleSimulation

```js
class CounterAction extends ClickAction {
    isAvailable(sim, playerBall) {
        return sim.isCollisionImminent(playerBall);
    }

    apply(sim, playerBall) {
        sim.applyCounter(); // 내부: counterCharged = true + 타이머
    }
}
```

`handleCollision()`에서 `counterCharged` 확인 → 데미지 +12%, 사용 후 즉시 `false`.

#### 5-D. 버티기(EndureAction) + spendHpForAction — 로직 소유: BattleBall

`src/entities.js`:

```js
// BattleBall
spendHpForAction(amount) {
    if (this.hp <= 1) return 0;                // 최소 HP 1 보장
    const cost = Math.min(amount, this.hp - 1);
    this.hp -= cost;
    return cost;
}

applyEndure(duration, reduction = 0.5) {
    this.endureEffect = { remaining: duration, reduction };
}

applyRush(duration, multiplier) {
    this.rushEffect = { remaining: duration, multiplier };
}
```

`takeDamage()`에서 `endureEffect` 확인 → 데미지 경감.
rush/endure 타이머 감소는 `BattleBall.update()`에서 처리.
}
}

```

`handleCollision()`에서 `counterCharged` 확인 → 데미지 +12%, 사용 후 `false`.

#### 5-D. 나머지 액션 isAvailable 조건 구현

| 액션           | isAvailable                               |
| -------------- | ----------------------------------------- |
| TimeWarpAction | `playerBall.hp / playerBall.maxHp <= 0.5` |
| RushAction     | 항상 `true`                               |
| EndureAction   | `playerBall.hp / playerBall.maxHp <= 0.5` |

### 검증

- 카운터: 충돌 직전에만 발동되는지 확인
- 받아치기: 투사체 데미지 50% 경감 확인
- 모든 액션 조건이 의도대로 동작하는지

---

## 의존성 그래프

```

1단계 (click-actions.js)
└── 2단계 (BattleSimulation) ── 필요: click-actions.js의 apply()
└── 3단계 (app.js + UI) ── 필요: click-actions.js의 pickRandomActions()
└── 4단계 (클릭 핸들러) ── 필요: simulation.matchAction
└── 5단계 (고급 판정) ── 필요: entities.js ownerId

```

1~2단계는 병렬로 안전하게 작업 가능.
3~5단계는 순차 진행 필요.

---

## 파일 변경 요약

| 파일                                 | 1단계    | 2단계                                  | 3단계                              | 4단계            | 5단계                  |
| ------------------------------------ | -------- | -------------------------------------- | ---------------------------------- | ---------------- | ---------------------- |
| `src/click-actions.js`               | **신규** | -                                      | -                                  | -                | apply/isAvailable 채움 |
| `src/simulation/BattleSimulation.js` | -        | playerBall + 액션 상태 + 시간왜곡/돌진 | -                                  | -                | 카운터                 |
| `src/app.js`                         | -        | -                                      | 카드 선택 + currentMatchAction     | 클릭 핸들러      | -                      |
| `src/ui.js`                          | -        | -                                      | waitForActionPick                  | -                | -                      |
| `index.html`                         | -        | -                                      | action-pick CSS 템플릿             | -                | -                      |
| `src/entities.js`                    | -        | -                                      | -                                  | spendHpForAction | ownerId                |
| `src/styles.css`                     | -        | -                                      | .action-pick / .action-card 스타일 | -                | -                      |

---

## 리스크 분석 및 구체적 대책

### 리스크 ①: 게임 루프와 액션 적용 시점 충돌

```

현재 루프: handleCollision() → entity.update() → checkResult()
문제: PointerEvent는 루프 밖에서 언제든 호출.
HP 소모 직후 checkResult 실행되면 자해 패배 가능.

````

**대책: 지연 적용 패턴**

```js
// PointerEvent 핸들러: 직접 실행하지 않고 예약만
this.simulation._pendingAction = { actionInstance: action, playerBall };

// update() 맨 앞에서 충돌 전에 먼저 적용
update(delta) {
    if (this._pendingAction) {
        const { actionInstance, playerBall } = this._pendingAction;
        this._pendingAction = null;
        if (actionInstance && playerBall) actionInstance.apply(this, playerBall);
    }
    this.handleCollision();
    // ...
}
````

→ 액션 효과가 항상 handleCollision 이전에 적용되므로, 동일 프레임 내 일관된 순서 보장.

---

### 리스크 ②: `playerBall` 참조 시점

```
문제:  startMatch() 내 _getPlayerBall(match) 호출 시점엔
       simulation이 아직 생성 안 됨.
```

**대책: simulation 생성 직후 id 기반 조회**

```js
this.simulation = new BattleSimulation(match, hooks);
this.simulation.playerBall = this.simulation.fighters.find((f) => f.id === this.playerFighterId) ?? null;
```

---

### 리스크 ③: `counterCharged` 1회성 소비

```
문제:  한 번 충전되면 모든 충돌에 계속 적용.
```

**대책:**

```js
// handleCollision(): 사용 즉시 소비
if (a === this.playerBall && this.counterCharged) {
    damageMultiplier += 0.12;
    this.counterCharged = false;
}

// update(): 타임아웃으로 자동 소멸 (윈도우 0.3초)
this.counterChargeTimer -= delta;
if (this.counterChargeTimer <= 0) this.counterCharged = false;
```

---

### 리스크 ④: `rushRemaining` 타이머 누락

```
문제:  돌진 효과 영구 지속.
```

**대책:** `update()` 내 `handleCollision` 전에 감소:

```js
if (this.rushRemaining > 0) this.rushRemaining -= delta;
```

---

### 리스크 ⑤: 카드 선택 UI Promise 해경

```
문제:  PopupService.resolve()는 closePopup()의 setTimeout에서만 호출.
       카드 클릭 시 외부에서 직접 resolve 불가.
```

**대책:** `UIController._actionPickResolve` 콜백 + Alpine dispatch:

```js
// waitForActionPick(): resolve 콜백 저장
this._actionPickResolve = resolve;
await PopupService.show({ ... buttons: [] });

// document listener: 카드 클릭 시 resolve → closePopup
document.addEventListener("pick-action-card", (e) => {
    const cardId = this._pendingCards[e.detail.index].id;
    this.ui._actionPickResolve?.(cardId);
});
```

---

### 리스크 ⑥: 시간 왜곡 delta — 타이머까지 느려지는 것의 의도 명확화

| 엔티티          | 느려지는 동작                         |
| --------------- | ------------------------------------- |
| BattleBall      | 이동, 쿨다운, 디버프 타이머, wallSlam |
| ArrowProjectile | 수명, 이동                            |
| Grenade         | 퓨즈, 이동                            |
| OrbitProjectile | 수명, 가속, 이동                      |
| SeedOrb         | 수명, 이동                            |

→ **의도된 동작**. "시간 팽창" 환상. 이동만 분리하려면 `velocity.scale(factor)` 필요하지만 복잡도 대비 이득 없음.

---

### 리스크 ⑦: `spendHpForAction` 최소 HP 1 보장 검증

| hp  | amount | `cost = min(amount, hp-1)` | 결과                                        |
| --- | ------ | -------------------------- | ------------------------------------------- |
| 10  | 3      | 3                          | hp=7 ✅                                     |
| 2   | 10     | 1                          | hp=1 ✅                                     |
| 1   | 5      | 0                          | hp=1, 무효 ✅                               |
| 0   | 5      | -1                         | **가드 필요**: `if (this.hp <= 1) return 0` |

---

### 리스크 ⑧: 투사체 `ownerId` — 기존 `owner` 객체와 충돌 없음

```
각 투사체 생성자에 this.ownerId = owner.id 추가 (기존 this.owner 유지)
받아치기 감지: entity.ownerId !== playerBall.id
확인: BattleBall.id = spec.id = roster의 FIGHTER_IDS.xxx
```

| 리스크                                                              | 영향                          | 대비                                                      |
| ------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------- |
| `entity.update(scaledDelta, this)`에서 `this`(simulation) 참조 깨짐 | 시간 왜곡 버그                | entity.update 내부에서 simulation 참조하는 부분 확인 필요 |
| 카운터 윈도우가 너무 좁음                                           | 사실상 발동 불가              | 임계값 20px부터 시작, 테스트 후 조정                      |
| 받아치기가 투사체 없는 매치에서 무용지물                            | 해당 매치의 카드 선택 UX 나쁨 | 풀에서 제외하거나 근접공격에도 일부 적용 검토             |
| HP 자해로 인한 연속 클릭 폭주                                       | HP 광탈                       | spendHpForAction + 디바운스 이중 안전장치                 |
