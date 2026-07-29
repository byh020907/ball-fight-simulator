# 재사용 가능한 게임 기반 모듈

Ball Fight Simulator의 코드를 다른 게임에서 재사용할 때는 게임 규칙 전체를 복사하지 않고 `src/game-kit/`만 가져간다. 이 폴더는 네이티브 ES Module로 구성한 소스 라이브러리이며, 공개 진입점은 `src/game-kit/index.js` 하나다.

## 공개 사용법

```js
import {
    Vector2,
    PhysicsBody,
    LifeSpan,
    applyCollisionResponse,
    shuffled,
    StaticCanvasImageCache,
    getVisibleLineWidth,
    ScreenWakeLock
} from "./game-kit/index.js";
```

새 게임과 새 공용 코드는 루트 `index.js`를 사용한다. 현재 게임 내부처럼 로딩 범위를 세밀하게 드러낼 필요가 있는 코드는 `game-kit/physics/index.js` 또는 개별 모듈을 사용할 수 있지만, 폴더 밖 구현 파일을 공개 계약으로 삼지 않는다.

## 구성

| 영역 | 제공 기능 |
| --- | --- |
| `physics/` | 벡터, 물리 capability, 수명·쿨다운, 충돌 판정·응답, 재질, 조향 |
| `canvas/` | 정적 Canvas 이미지 캐시, 화면 최소 가독성 계산, 흔들림·전기 아크·투사체 베기 렌더링 |
| `collections/` | 원본 배열을 바꾸지 않는 셔플 같은 범용 컬렉션 함수 |
| `platform/` | 화면 깨우기 잠금처럼 브라우저 기능 수명주기를 감싼 어댑터 |

Canvas와 플랫폼 모듈은 브라우저 기능을 실제 메서드 호출 시 사용한다. 물리·컬렉션 모듈은 DOM 없이 Node.js에서도 사용할 수 있다.

## 의존 방향

```text
다른 게임의 규칙·엔티티
          ↓
 src/game-kit/index.js
          ↓
 physics · canvas · collections · platform
```

- `src/game-kit/` 내부 상대 import는 반드시 같은 폴더 경계 안에서 끝난다.
- 게임 규칙은 game-kit에 의존할 수 있지만 game-kit은 캐릭터, 능력, 사냥터, UI를 역참조하지 않는다.
- `canvas/`는 공용 `physics/Vector2`를 사용할 수 있다. 반대 방향 의존은 만들지 않는다.
- `src/core.js`의 `Vector2`와 `src/physics/index.js`는 기존 Ball Fight Simulator 소비자용 호환 파사드다. 새 기반 코드의 진입점으로 사용하지 않는다.
- 공용 타입과 계산을 게임마다 복제하지 않는다.

## 다른 게임으로 옮기는 기준

현 단계에서는 새 패키지나 빌드 의존성을 만들지 않고 `src/game-kit/` 폴더 전체를 하나의 단위로 이식한다. 일부 파일만 골라 복사하면 루트 공개 계약과 내부 의존성이 갈라질 수 있으므로 금지한다. 실제로 두 개 이상의 저장소가 함께 변경을 받아야 하는 시점에만 별도 npm 패키지나 공유 저장소 전환을 결정한다.

게임마다 달라야 하는 값은 공용 모듈 안에 하드코딩하지 않고 옵션·콜백·duck typing 계약으로 주입한다. 새 공용 후보는 다음 조건을 모두 만족할 때만 game-kit으로 이동한다.

1. Ball Fight Simulator의 캐릭터·경제·승패·장비 규칙을 알지 않는다.
2. 독립 입력과 출력을 가지며 최소 한 개의 회귀 테스트로 계약을 고정할 수 있다.
3. 폴더 밖 모듈을 import하지 않아 다른 저장소로 그대로 복사할 수 있다.

## 아직 게임 전용인 영역

다음 모듈은 Ball Fight Simulator 규칙과 결합돼 있으므로 현재 상태로 기반 라이브러리에 넣지 않는다.

- `src/entities/`: 캐릭터, 투사체, 사냥 보상 규칙
- `src/effects/`: 캐릭터·장비별 Canvas 연출
- `src/combat-drag/`: 방패, 반사 보상, 적 공격 큐를 포함한 전투 규칙
- `src/simulation/battleSimulation.js`: 피해, 숙련도, 장비, 승패 판정

이 영역의 재사용 후보는 공통 계산·상태 계약을 먼저 분리하고, 게임 전용 모듈에서 game-kit으로 향하는 단방향 의존성이 확인된 뒤 공개 경계에 추가한다.

## 검증 계약

- `tests/gameKit.mjs`는 루트 공개 API, 호환 클래스 정체성, 대표 모듈 동작, 모든 내부 상대 import가 `src/game-kit/` 안에서 끝나는지를 검사한다.
- `tests/physicsVelocity.mjs`는 공용 물리 정책과 기존 `src/core.js`·`src/physics/index.js` 호환성을 검사한다.
- 기반 모듈 이동 전후에는 같은 `BattleSimulation` 시나리오의 위치·속도·HP 시계열 해시가 같아야 한다.
- 전체 변경은 `npm test`, `npm run check`, `npm run format:check`, `git diff --check`를 통과해야 한다.
