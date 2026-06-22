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

## 1단계: `src/click-actions.js` — 액션 정의

### 대상 파일

- **신규**: `src/click-actions.js`

### 작업 내용

5개 액션을 객체 배열로 정의. 각 액션의 인터페이스:

```js
{
    id: "time_warp",
    name: "시간 왜곡",
    description: "0.25초간 상대만 슬로우",
    hpCostPercent: 0.2,          // maxHP 대비 %
    isAvailable(sim, playerBall) { return boolean; },
    apply(sim, playerBall) { /* 효과 적용 */ }
}
```

### 함수

| 함수                           | 역할                              |
| ------------------------------ | --------------------------------- |
| `getActionPool()`              | 전체 액션 5개 배열 반환           |
| `pickRandomActions(count = 3)` | 풀에서 무작위 count개 (중복 없음) |
| `findActionById(id)`           | id로 액션 객체 lookup             |

### 구현 순서

1. 액션 5개 객체를 `ACTION_DEFS` 배열에 정의
2. `pickRandomActions()` — Fisher-Yates 셔플 후 slice
3. 각 액션의 `isAvailable()`은 1단계에서는 **항상 true** 반환 (조건 로직은 5단계)
4. 각 액션의 `apply()`는 1단계에서는 **아무것도 안 함** (효과 로직은 2단계)

### 검증

```bash
node -e "
  import('./src/click-actions.js').then(m => {
    console.log(m.pickRandomActions(3).length === 3 ? 'pick OK' : 'FAIL');
    console.log(m.getActionPool().length === 5 ? 'pool OK' : 'FAIL');
  });
"
```

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

    // 시간 왜곡 상태
    this.timeSlowRemaining = 0;
    this.timeSlowFactor = 0.45;

    // 돌진 상태
    this.rushRemaining = 0;

    // 카운터 상태
    this.counterCharged = false;
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

#### 2-C. `getSpeedMultiplier()`에 돌진 효과 반영

```js
getSpeedMultiplier() {
    const overtimeMult = this.isOvertime() ? Math.min(1.58, 1.12 + ...) : 1;
    const rushMult = this.rushRemaining > 0 ? 1.25 : 1;
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

#### 4-B. 캔버스에 클릭 핸들러 바인딩

`app.js` — `startMatch()` 내에서 simulation 생성 후:

```js
this._clickHandler = (e) => {
    if (this.simulation?.finished) return;
    if (!this.currentMatchAction) return;

    // 디바운스 (80ms)
    const now = performance.now();
    if (now - this._lastClickTime < 80) return;
    this._lastClickTime = now;

    const playerBall = this._getPlayerBall(match);
    if (!playerBall || playerBall.isDefeated) return;

    // HP 5% 미만이면 무효
    if (playerBall.hp / playerBall.maxHp < 0.05) return;

    const action = this.currentMatchAction;
    if (!action.isAvailable(this.simulation, playerBall)) return;

    // HP 소모
    const cost = Math.ceil((playerBall.maxHp * action.hpCostPercent) / 100);
    const actualCost = playerBall.spendHpForAction(cost);
    if (actualCost <= 0) return;

    // 효과 적용
    action.apply(this.simulation, playerBall);
    this.simulation.addLog(`[액션] ${action.name} 발동! HP ${actualCost} 소모.`);
};
this.elements.canvas.addEventListener("pointerdown", this._clickHandler);
```

#### 4-C. 매치 종료 시 클릭 핸들러 제거

`app.js` — `finishMatch()` 또는 match 종료 시점:

```js
if (this._clickHandler) {
    this.elements.canvas.removeEventListener("pointerdown", this._clickHandler);
    this._clickHandler = null;
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

- `src/click-actions.js` (isAvailable/apply 채우기)
- `src/simulation/BattleSimulation.js`
- `src/entities.js` (ownerId)

### 작업 내용

#### 5-A. 투사체에 `ownerId` 참조 추가

`entities.js` — 각 투사체 클래스에 `this.ownerId = owner.id` 추가:

- `ArrowProjectile`
- `Grenade`
- `OrbitProjectile`
- `SeedOrb`

#### 5-B. 받아치기 — 투사체 감지

`isAvailable`에서 simulation의 entities를 순회하며:

- 투사체 엔티티인지 확인 (instanceof 또는 타입 플래그)
- `entity.ownerId !== playerBall.id` (상대 것이면서)
- playerBall 방향으로 접근 중인지 (velocity 방향 vs position 차이)

`apply`에서는 해당 투사체에 `damageReduction` 플래그 설정.

투사체 `update()`에서 `takeDamage` 전에 플래그 확인 → 50% 경감.

#### 5-C. 카운터 — 충돌 직전 감지

`isAvailable`에서:

- 두 공의 거리 `distance - (a.radius + b.radius)`가 임계값(예: 20px) 이하
- 상대방의 속도가 플레이어 방향인지 (다가오는 중)

`apply`에서는 `this.counterCharged = true` 설정.

`handleCollision()`에서 `counterCharged` 확인 → 데미지 +10~15%.

#### 5-D. 나머지 액션 isAvailable 조건 구현

| 액션      | isAvailable 조건                          |
| --------- | ----------------------------------------- |
| 시간 왜곡 | `playerBall.hp / playerBall.maxHp <= 0.5` |
| 돌진      | 항상 true                                 |
| 카운터    | 충돌 임박 윈도우 (위 5-C)                 |
| 받아치기  | 투사체 접근 중 (위 5-B)                   |
| 버티기    | `playerBall.hp / playerBall.maxHp <= 0.5` |

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

## 리스크

| 리스크                                                              | 영향                          | 대비                                                      |
| ------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------- |
| `entity.update(scaledDelta, this)`에서 `this`(simulation) 참조 깨짐 | 시간 왜곡 버그                | entity.update 내부에서 simulation 참조하는 부분 확인 필요 |
| 카운터 윈도우가 너무 좁음                                           | 사실상 발동 불가              | 임계값 20px부터 시작, 테스트 후 조정                      |
| 받아치기가 투사체 없는 매치에서 무용지물                            | 해당 매치의 카드 선택 UX 나쁨 | 풀에서 제외하거나 근접공격에도 일부 적용 검토             |
| HP 자해로 인한 연속 클릭 폭주                                       | HP 광탈                       | spendHpForAction + 디바운스 이중 안전장치                 |
