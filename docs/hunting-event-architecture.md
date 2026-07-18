# 사냥터 이벤트 아키텍처

## 책임 경계

- `HuntingRun`은 저장 가능한 plain object입니다. 현재 층, 전리품, HP, 마지막 조우와 이벤트 payload, `phase`만 보관합니다.
- `HuntingEvent` 클래스는 이벤트 payload 생성과 런 전이를 소유합니다. 클래스 인스턴스 자체는 런이나 프로필에 저장하지 않습니다.
- `HuntingEvent.POOL`은 확률 추첨 후보의 순서를 보존하는 배열이고, `HuntingEvent.REGISTRY`는 타입으로 이벤트 클래스를 찾는 Map입니다. 각 이벤트 인스턴스는 `getBaseWeight(floor)`로 층별 기본 가중치를 소유합니다.
- `HuntingManager`는 이벤트 전이 결과를 전투 시작, 선택 UI, 상인 UI, 상자 UI로 연결하는 조정자입니다. 이벤트 타입별 보상·HP·전리품 로직을 직접 소유하지 않습니다.
- `huntingRunProgression.js`는 한 층 전진과 스테이지 해금처럼 조우를 굴리는 진행 규칙을 소유합니다.

## 런 단계

`status`는 `active`, `retreated`, `defeated` 같은 런의 생명주기를 뜻합니다. `phase`는 활성 런의 현재 상호작용 단계를 뜻합니다.

| phase | 의미 |
| --- | --- |
| `ready` | 원정 시작 또는 다음 이동을 기다리는 상태 |
| `moving` | 층을 하나씩 이동하며 조우를 판정하는 상태 |
| `awaiting_choice` | 포탈 또는 경로 완료 뒤 전진/귀환 선택을 기다리는 상태 |
| `awaiting_merchant` | 상인 선택을 기다리는 상태 |
| `awaiting_chest` | 상자방 보상을 확인하고 전진을 기다리는 상태 |
| `combat` | 사냥터 전투를 실행 중인 상태 |
| `finished` | 귀환 또는 패배로 종료된 상태 |

## 새 이벤트 추가

1. `HuntingEvent`을 상속한 클래스를 추가하고 `createPayload()`과 `resolve()`를 구현합니다.
2. `HuntingEvent.POOL`에 인스턴스를 추가하고, 기본값 `1.0`과 다른 층별 가용성이 있으면 `getBaseWeight(floor)`를 구현합니다.
3. `resolve()`는 새 런, 전이 타입, 표시용 메시지 데이터를 반환합니다. UI를 직접 호출하지 않습니다.
4. 새 전이 타입이 필요할 때만 `HUNTING_EVENT_TRANSITIONS`와 Manager의 presentation handler를 함께 추가합니다.
5. 회귀 테스트에서 이벤트 타입, registry, phase, 실제 진행 결과를 검증합니다.

## 이벤트 가중치와 추첨

`rollHuntingEvent()`와 `rollHuntingFloorOutcome()`은 같은 이벤트 기본 가중치 계약을 사용합니다. 포탈 배율과 저체력 함정 제외는 기본 가중치 위에 합성하며, 가중치가 `0`인 후보는 추첨과 fallback에서 모두 제외합니다. 따라서 해금 여부는 정상 진행 중 payload 예외가 아니라 가중치로 제어합니다.

## 정예 몹 이벤트 흐름

`elite_mob`은 현재 층에 열린 수동 조합이 있을 때만 기본 가중치 `1.0`인 전투 이벤트입니다. 첫 조합이 열리는 10층 전에는 기본 가중치가 정확히 `0`이라 선택되지 않고, 10층부터 기존의 낮은 상대 확률로 후보에 남습니다. `EliteMobEvent.createPayload()`는 열린 조합을 동일 확률로 선택해 안정적인 조합 ID와 몬스터 타입 배열을 함께 저장합니다.

`HuntingManager`는 전투 시작 시 `createEliteMobEncounter()`에 payload를 전달합니다. 팩토리는 조합 ID와 타입 배열이 수동 원본과 정확히 같은지 검증하고, 각 구성원을 현재 층의 `normal` 스탯으로 생성한 뒤 보상 식별자와 정예 편성 플래그만 부여합니다. 따라서 정예 XP 프리미엄은 유지되지만 과거 `elite` HP·공격력·방어력 보정은 적용하지 않습니다.

전투 생성 직후 `placeEliteMobFormation()`이 전열과 후열을 배치합니다. 힐러와 사수·파편·부메랑·레이저는 후열, 나머지는 전열이며, `HuntingMobAbility`는 정예 편성 플래그가 있는 BattleBall에만 순수 군집 위치 보정을 더합니다. 일반 조우·중간 보스·챔피언·최종 보스의 개별 AI와 생성 흐름에는 이 편성 상태를 추가하지 않습니다.

## 이벤트 카드 레이아웃

상자방·이벤트 결과·전투 준비 화면은 같은 카드 구조를 사용한다. 카드 본문은 `minmax(0, 1fr)` 가용 행 안에서만 스크롤하고, 계속·전투 시작 같은 행동은 별도 `auto` 행에 둔다. 오버레이와 카드는 부모의 가용 크기를 grid/flex로 나누므로 기기별 고정 폭·높이 보정으로 행동 버튼을 살리지 않는다.
