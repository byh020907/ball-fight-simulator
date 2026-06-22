# 책임 분리 리팩토링 진행 문서

이 문서는 게임 오브젝트와 액션의 로직 책임을 단계별로 정리하기 위한 작업 문서입니다.

## 진행 원칙

- 한 스텝은 하나의 책임 분리만 다룹니다.
- `BattleBall`, `Simulation`은 상태 보관, 이벤트 전달, 공통 물리만 담당합니다.
- Ability, Action, Projectile, runtime effect가 자기 행동의 판단과 계산을 소유합니다.
- 스텝별 구현 후 전체 회귀 테스트는 별도 검증 담당이 수행할 수 있도록 체크리스트를 문서에 남깁니다.
- 구현 중 즉시 필요한 최소 문법 확인만 수행하고, 긴 회귀 검증은 이 문서의 항목을 기준으로 분리합니다.

## 구현 패턴 예시

아래 예시는 실제 구현 시 따라야 하는 코드 모양입니다. 핵심은 `BattleBall`이나 `Simulation`이 effect 내부 필드를 해석하지 않는 것입니다.

### Bad: Ball/Simulation이 특수 로직을 해석

```js
// bad: BattleBall이 dash 규칙을 직접 구성함
startDash(direction, config) {
    this.dashState = {
        collisionDamage: config.collisionDamage,
        untilImpact: config.untilImpact,
        untilWall: config.untilWall
    };
    this.speedBoost = { multiplier: config.multiplier };
}

// bad: Simulation이 dash 내부 필드를 직접 해석함
if (attacker.dashState.collisionDamage) {
    defender.takeDamage(attacker.dashState.collisionDamage, attacker, attacker.dashState.collisionLabel);
}
if (attacker.dashState.untilImpact) {
    attacker.clearDash();
}
```

### Good: Runtime effect가 자기 이벤트를 소유

```js
class DashEffect {
    constructor({ source, multiplier, collisionDamage = 0, untilImpact = false }) {
        this.source = source;
        this.multiplier = multiplier;
        this.collisionDamage = collisionDamage;
        this.untilImpact = untilImpact;
        this.expired = false;
    }

    getSpeed(ball) {
        return ball.baseSpeed * this.multiplier;
    }

    onCollision(attacker, defender, simulation) {
        if (this.collisionDamage > 0) {
            defender.takeDamage(this.collisionDamage, attacker, "Dash");
        }
        attacker.ability?.onDashHit?.(defender, this);
        if (this.untilImpact) {
            this.expired = true;
        }
    }

    onWallBounce(ball, normal, simulation) {
        ball.ability?.onDashWall?.(this);
        this.expired = true;
    }
}

// BattleBall은 저장과 위임만 담당
setMovementEffect(effect) {
    this.movementEffect = effect;
}

// Simulation은 충돌 이벤트만 전달
attacker.movementEffect?.onCollision?.(attacker, defender, this);
if (attacker.movementEffect?.expired) {
    attacker.clearMovementEffect();
}
```

### Ability에서 effect 생성

```js
class DashAbility extends Ability {
    startDash(target) {
        const direction = Vector2.subtract(target.position, this.owner.position).normalize();
        this.owner.setMovementEffect(
            new DashEffect({
                source: this.owner,
                multiplier: 2.15,
                collisionDamage: 0,
                untilImpact: true
            })
        );
        this.owner.forceHeading(direction, 1.4);
    }
}
```

### 구현 시 금지 규칙

- `Simulation`에서 `effect.collisionDamage`, `effect.untilImpact`, `effect.cooldown` 같은 내부 필드를 직접 읽지 않습니다.
- `BattleBall`에 `startDash(config)`, `applySwallow(owner)`, `applyWallSlam(data)`처럼 특정 능력 규칙을 아는 메서드를 늘리지 않습니다.
- 새 effect를 만들 때는 `onCollision`, `onWallBounce`, `tick`, `getSpeed`, `onDamageTaken`처럼 이벤트/질문 단위 메서드를 제공합니다.
- 기존 테스트가 직접 상태명을 확인하는 경우는 한 스텝 안에서만 유지하고, 새 테스트는 effect 메서드 존재나 결과 행동을 확인합니다.

## 완료된 스텝

### Step 1. 클릭 액션 effect 책임 정리

커밋: `089baa5`

- `RushAction`이 지속시간 연장과 속도 배율 등록 로직을 직접 소유합니다.
- `EndureAction`이 피해 경감 계산 로직을 직접 소유합니다.
- `ActionContext`는 액션별 특수 로직을 알지 않고 effect 저장, tick, 이벤트 전달만 담당합니다.
- `BattleSimulation.getSpeedMultiplier(ball)`은 대상 Ball의 action effect만 조회합니다.

검증 체크리스트:
- Rush는 발동한 Ball에만 속도 배율을 적용해야 합니다.
- Rush 재발동 시 남은 시간이 있으면 지속시간이 연장되어야 합니다.
- Rush effect 만료 후 속도 배율이 1로 돌아와야 합니다.
- Endure는 지속시간 동안 받은 피해만 50% 경감해야 합니다.
- Endure 만료 후 피해량은 원래대로 돌아와야 합니다.

### Step 2. Wall Slam runtime effect 분리

커밋: `3f5efb8`

- `WallSlamEffect`가 벽 충돌 피해, 반복 피해 쿨다운, 회전 연출을 소유합니다.
- `EaterAbility`, `BatBallAbility`는 `WallSlamEffect`를 생성하고 필요한 값만 전달합니다.
- `Simulation`은 벽 충돌 이벤트를 effect에 전달합니다.
- `BattleBall`은 effect tick만 호출합니다.

검증 체크리스트:
- Eater가 뱉은 대상은 벽 충돌 시 wall slam 피해를 받아야 합니다.
- wall slam 피해는 방어력 적용 후 기존 수치와 같아야 합니다.
- wall slam 반복 피해 쿨다운 동안 같은 벽 접촉으로 중복 피해가 들어가면 안 됩니다.
- Eater가 뱉은 대상의 얼굴 회전 연출은 유지되어야 합니다.
- Bat Ball의 타격 후 벽 충돌 추가 피해도 유지되어야 합니다.

### Step 3. Dash runtime effect 분리 ✅

커밋: `724c426` (ActionContext) + 현재 작업

- `DashEffect` 클래스가 dash 지속시간, 충돌 이벤트, 벽 이벤트, 속도 계산, speed ring 표시 여부를 소유합니다.
- `DashAbility`, Trickster seed, Eater spit가 각자의 규칙으로 `DashEffect`를 생성합니다.
- `Simulation`은 충돌/벽 이벤트를 `DashEffect.onCollision()` / `.onWallBounce()`에 전달만 합니다.
- `BattleBall`은 `movementEffect` 저장, tick, expired 시 해제만 담당합니다.

검증 체크리스트:
- Dash Ball은 충돌 자체의 추가 피해 없이 일반 충돌 피해만 줘야 합니다. ✅
- Dash Ball은 쿨다운 100% 상태에서만 대시 보정을 받아야 합니다. ✅
- Dash Ball은 적중 시 쿨다운 스택이 증가하고, 벽 접촉 시 규칙대로 스택이 감소/초기화되어야 합니다. ✅
- Trickster seed dash는 기존 Seed Dash 피해와 벽/충돌 종료 조건을 유지해야 합니다. ✅
- Eater spit dash는 속도 2배, speed ring 숨김을 유지해야 합니다. ✅

## 다음 후보 스텝

### Step 4. Swallow/Hold effect 분리

현재 문제:
- `EaterAbility`가 `target.swallowedState`를 직접 쓰고, `BattleBall.update()`가 삼켜진 대상의 위치 고정과 이동 정지를 처리합니다.

목표:
- `SwallowedEffect`가 대상 위치 고정, 해제 조건, 이동 정지를 소유합니다.
- `EaterAbility`는 swallow effect를 생성하고 release 시점만 관리합니다.
- `BattleBall`은 effect tick/상태 조회만 수행합니다.

검증 체크리스트:
- Eater가 feast 중 충돌한 대상만 삼켜야 합니다.
- 삼켜진 대상은 Eater 위치에 고정되어야 합니다.
- 삼켜진 동안 대상은 별도 이동/대시가 없어야 합니다.
- 해제 후 기존 spit dash/wall slam 흐름이 유지되어야 합니다.

### Step 5. Projectile hit behavior 정리

현재 문제:
- `Projectile` 공통 hit flow와 개별 Projectile의 `_onHitEffects()`가 섞여 있고, 일부 결과 콜백은 owner ability에 직접 호출됩니다.

목표:
- 공통 hit 판정은 `Projectile`이 유지하되, 피해량/넉백/결과 콜백은 각 Projectile 또는 생성한 Ability가 소유합니다.
- Ability가 알아야 하는 결과는 명시적 callback으로만 전달합니다.

검증 체크리스트:
- Archer 화살은 벽 반사 후 방향 표시가 속도 벡터와 일치해야 합니다.
- Archer 화살 명중/빗나감 결과가 보정 로직에 정확히 반영되어야 합니다.
- Grenade 명중/빗나감 결과가 fuse 보정 로직에 정확히 반영되어야 합니다.
- Orbit shard 명중 피해와 충격 이펙트가 유지되어야 합니다.

## 검증 담당 전달 형식

각 스텝 완료 후 검증 담당에게 아래 형식으로 전달합니다.

```text
검증 대상 스텝:
변경 파일:
핵심 불변 조건:
체크리스트:
실행 권장 명령:
- npm test
- npm run check
- npm run format:check
수동 확인:
```
