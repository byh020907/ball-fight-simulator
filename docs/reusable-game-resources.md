# 재사용 가능한 게임 기반 모듈

Ball Fight Simulator의 코드를 다른 게임에서 재사용할 때는 게임 규칙 전체를 복사하지 않고, 의존성이 안쪽으로만 향하는 기반 모듈부터 가져간다. 현재 보장하는 첫 공개 경계는 `src/physics/`다.

## 현재 재사용 경계

다른 게임은 `src/physics/index.js`를 공개 진입점으로 사용한다.

```js
import {
    Vector2,
    PhysicsBody,
    LifeSpan,
    applyCollisionResponse,
    applyDynamicCollisionResponse,
    resolveLinearVelocityPolicy
} from "./physics/index.js";
```

이 폴더는 벡터, 물리 capability, 수명·쿨다운, 충돌 판정과 응답, 재질, 조향 같은 게임 비종속 기반을 제공한다. 내부 모듈은 같은 `src/physics/` 안의 모듈만 상대 경로로 가져오며 `core.js`, 캐릭터, 능력, 사냥터, UI에 의존하지 않는다.

## 의존 방향

```text
다른 게임의 규칙·엔티티
          ↓
    src/physics/index.js
          ↓
   src/physics 내부 모듈
```

- 게임 규칙은 물리 기반에 의존할 수 있다.
- 물리 기반은 게임 규칙을 역으로 가져오지 않는다.
- `src/core.js`의 `Vector2` export는 기존 코드 호환용 파사드다. 새 공용 코드는 `src/physics/index.js`에서 가져온다.
- `Vector2`를 게임마다 다시 구현하거나 `core.js`와 물리 폴더에 중복 선언하지 않는다.

## 다른 게임으로 옮기는 기준

현 단계에서는 새 패키지나 빌드 의존성을 만들지 않고 `src/physics/` 폴더를 하나의 단위로 이식한다. 일부 파일만 골라 복사하면 barrel 계약과 capability 조합이 갈라질 수 있으므로 금지한다. 실제로 두 개 이상의 저장소가 함께 변경을 받아야 하는 시점에만 별도 패키지나 공유 저장소 전환을 결정한다.

게임마다 달라야 하는 값은 공용 모듈 안에 하드코딩하지 않고 기존 옵션·duck typing 계약으로 주입한다. `PhysicsBody`를 조합하는 객체는 필요한 경우 `stats`, `state`, `getStatModifiers()`를 제공하고, 시뮬레이션은 선택적으로 `getSpeedMultiplier(body)`를 제공한다.

## 아직 게임 전용인 영역

다음 모듈은 Ball Fight Simulator 규칙과 결합돼 있으므로 현재 상태로 다른 게임의 기반 모듈로 취급하지 않는다.

- `src/entities/`: 캐릭터, 투사체, 사냥 보상 규칙
- `src/effects/`: 캐릭터·장비별 Canvas 연출
- `src/combat-drag/`: 방패, 반사 보상, 적 공격 큐를 포함한 전투 규칙
- `src/simulation/battleSimulation.js`: 피해, 숙련도, 장비, 승패 판정

이 영역의 재사용 후보는 공통 계산·상태 계약을 먼저 분리하고, 게임 전용 모듈에서 공용 모듈로 향하는 단방향 의존성이 확인된 뒤 공개 경계에 추가한다.

## 검증 계약

- `tests/physicsVelocity.mjs`는 `src/physics/`가 상위 게임 모듈을 import하지 않는지 검사한다.
- `src/core.js`와 `src/physics/index.js`가 내보내는 `Vector2`는 같은 클래스여야 한다.
- 기반 모듈 이동 전후에는 같은 `BattleSimulation` 시나리오의 위치·속도·HP 시계열이 동일해야 한다.
- 전체 변경은 `npm test`, `npm run check`, `npm run format:check`, `git diff --check`를 통과해야 한다.
