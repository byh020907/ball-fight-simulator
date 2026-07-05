# 사냥터 및 상자 해금 시스템

> 상태: 100층 스테이지 원정 구조 구현 완료 (2026-07-05)
> 기준 코드: 2026-07-05 `main`
> 관련 문서: [`experience-system.md`](experience-system.md), [`collection-hub-ui.md`](collection-hub-ui.md), [`meta-progression-system.md`](meta-progression-system.md), [`player-data-storage-security.md`](player-data-storage-security.md), [`game-rules.md`](game-rules.md), [`equipment-system.md`](equipment-system.md)
> 참고 패턴: Hades의 런/메타 재화 분리, Dead Cells의 설계도 발견 후 Cells 해금, Slay the Spire의 상자/이벤트 방, Vampire Survivors의 보스 상자 보상

## 1. 시스템 정의

사냥터는 토너먼트와 분리된 로그라이크식 파밍 모드입니다. 토너먼트가 우승, 도전 단계, 디펜딩 챔피언, 숙련도 같은 경쟁/증명 루프를 담당한다면, 사냥터는 연전, 위험 감수, 랜덤 이벤트, 장비 파밍, 상자와 재화 파밍을 담당합니다.

플레이어가 토너먼트를 이기기 어렵다고 느낄 때 사냥터에서 경험치와 장비를 파밍해 캐릭터를 성장시킨 후 다시 토너먼트에 도전하는 선순환 구조입니다. 경험치 시스템(레벨 보상)과 통합되어 있으며, 장비 시스템은 별도 문서([`docs/equipment-system.md`](equipment-system.md))에서 정의합니다.

핵심 질문은 포탈을 발견했을 때 반복됩니다.

```text
지금 포탈로 귀환해서 보상을 확정할까?
다음 10층으로 가서 더 좋은 보상을 노릴까?
(단, 다음 포탈을 찾을 때까지 귀환 불가)
```

## 2. 설계 원칙

### 2.1 토너먼트와 역할 분리

사냥터에서는 토너먼트 우승, 도전 단계 해금, 디펜딩 챔피언 streak를 처리하지 않습니다. 사냥터 보상은 상자, 열쇠 조각, 사냥터 전용 해금, 소량 XP 중심으로 둡니다.

### 2.2 스테이지 선택

사냥터 입장 전에 원정지를 선택할 수 있습니다. 동굴(1120×1120), 숲(1280×1280), 사막(1440×1280) 세 스테이지가 있으며, 100층 보스를 처치하면 다음 스테이지가 해금됩니다. 각 스테이지는 고유한 전장 크기와 시각적 테마(암석/숲/모래)를 가집니다. 전투 가독성을 위해 모든 stage 배경은 이름표·HP 바·이펙트가 묻히지 않도록 밝은 팔레트를 사용합니다. 선택한 스테이지는 프로필에 저장되어 다음 입장 시에도 유지됩니다.

### 2.3 실제 지형 (Terrain)

stage는 단순 배경 외에 실제 충돌 지형을 가질 수 있습니다. 1차 구현에서는 동굴(cave) stage에만 원형 암벽 장애물 3~5개가 생성되며, fighter와 충돌 시 arena 벽 반사와 동일한 방식으로 밀려납니다. 투사체 충돌과 몹 AI의 장애물 우회는 후속 과제입니다. 지형은 `stageId`와 `floor`에 기반해 결정론적으로 생성되므로 같은 조건에서는 항상 같은 배치가 나옵니다.

### 2.2 포탈 귀환이 핵심

귀환은 포탈 이벤트에서만 가능합니다. 일반 전투 승리 후에는 귀환할 수 없고, 반드시 10층 전진을 눌러 다음 층으로 이동해야 합니다. 포탈을 지나치면 귀환 권한이 사라집니다.

사냥터의 재미는 포탈을 발견했을 때 "지금 귀환할까, 더 깊이 갈까" 판단하는 데 있습니다. 귀환하지 않고 전진하면 더 높은 층에서 더 좋은 보상을 노릴 수 있지만, 다음 포탈을 찾을 때까지 귀환할 수 없습니다.

### 2.3 보상은 확률보다 축적

상자는 등급별 기대감을 주되, 핵심 해금은 적 처치 재화로 확정 진행되게 합니다. 상자에서 무작위 보상을 얻더라도, 장기적으로는 `열쇠 조각`을 모아 상자를 열거나 설계도를 해금하는 구조를 우선합니다.

### 2.4 다수 전투 확장 전제

사냥터는 장기적으로 `1 대 n`, `n 대 n`, 웨이브 전투를 필요로 합니다.

MVP는 기존 1v1 전투를 연속으로 이어붙여 시작할 수 있습니다. 전투 시스템은 팀 기반으로 리팩터링되어 있으며, 같은 팀끼리는 충돌 물리는 유지할 수 있어도 피해와 적대 효과를 주면 안 됩니다.

## 3. 용어

| UI 용어 | 코드 용어 | 의미 |
| --- | --- | --- |
| 사냥터 | `huntingGrounds` | 토너먼트와 분리된 연전 파밍 모드 |
| 층 | `floor` | 0~100층. 깊을수록 난이도 상승 |
| 스테이지 | `stage` | 동굴(1~100), 숲(1~100), 사막(1~100). 100층 보스 처치 시 해금 |
| 조우 | `encounter` | 각 층의 판정 결과 — 빈층 / 전투 / 이벤트 / 최종보스 |
| 귀환 | `retreat` | 포탈 이벤트에서만 가능. 보상을 확정하고 사냥터 종료 |
| 전진 | `advance` | 최대 10층을 1층씩 이동. 전투·이벤트·보스에서 정지 |
| 열쇠 조각 | `keyShards` | 상자 개봉과 일부 해금에 쓰는 사냥터 재화 |
| 상자 | `chest` | 등급을 가진 보상 컨테이너 |
| 미확정 보상 | `pendingLoot` | 귀환 전까지 손실 가능성이 있는 보상 |
| 확정 보상 | `securedLoot` | 귀환 또는 클리어로 프로필에 저장되는 보상 |

## 4. 기본 루프

### 4.1 입장 조건

플레이어가 토너먼트에서 **한 번이라도 우승한 캐릭터**만 사냥터에 입장할 수 있습니다. 우승 기록이 없는 캐릭터는 사냥터 선택 UI에 표시되지 않습니다.

### 4.2 HP 규칙

사냥터 내 캐릭터 HP는 **층간 완전 누적**됩니다. 전투가 끝나도 HP는 회복되지 않으며, 휴식지 이벤트나 특별 효과를 통해서만 회복할 수 있습니다. HP가 0이 되면 사냥터 패배로 처리됩니다.

### 4.3 진행 루프

```text
사냥터 입장 (캐릭터 선택, stage 선택)
  -> 0층에서 시작
  -> "10층 전진" 클릭
  -> 최대 10층을 1층씩 이동하며 층별 판정 수행:
      - 빈층: 메시지 출력 후 계속 진행
      - 전투: 이동 정지 → 전투 → 승리 시 "10층 전진" 버튼 표시
      - 이벤트: 유형에 따라 처리 (아래 §7 참고)
      - 최종보스(100층): 전투 → 승리 시 스테이지 클리어 → 다음 스테이지 해금
  -> 포탈 이벤트에서만 "포탈 귀환" 가능
  -> 패배 시 일부 보상 손실 후 종료
```

100층 전진 루프:

```text
HUNTING_MAX_FLOOR = 100
HUNTING_ADVANCE_STEPS = 10

advance() 루프:
  for step 0..9:
    1층 전진 → rollHuntingFloorOutcome(floor)
    empty     → 로그 + 애니메이션 → continue
    combat    → _startFloorBattle() → return (정지)
    event     → _handleAdvanceEvent() → portal/상인/챔피언 → 정지
                                      → boon/mishap/rest/chest/altar → continue
    final_boss → _startFloorBattle() → return (정지)

모든 10단계 소진 시 → "X층 전진 완료" + 전진 버튼 다시 표시
```

### 4.4 경험치 지급

사냥터 전투에서도 매치 XP 공식이 동일하게 적용됩니다. 단, 사냥터 전투는 토너먼트 단계가 없으므로 `stageMultiplier = 1.0` 고정입니다. 레벨 보상(hp+2, 공격력+1 등)은 사냥터 전투에도 적용되어, 토너먼트보다 느리지만 꾸준히 캐릭터가 성장합니다.

확장 흐름:

```text
한 층에 적 여러 명 연속 등장
일부 층은 1 대 n 전투
정예/챔피언 난입
상자방/상인/제단/휴식지 노드
```

## 5. 전투 구조 요구사항

사냥터 구현 전투 시스템은 팀 기반이어야 하며, 현재 기본 `BattleSimulation`은 명시적 `teamId`가 없을 때 fighter별 고유 팀을 부여해 기존 개인전 동작을 유지합니다.

### 5.1 팀 모델

각 fighter는 `teamId`를 가집니다.

```js
{
    id: "archer",
    teamId: "player"
}
```

기본 토너먼트 1v1:

```text
player fighter -> teamId: "player"
AI fighter     -> teamId: "rival"
```

사냥터 예시:

```text
player team:
  - player fighter

enemy team:
  - enemy fighter 1
  - enemy fighter 2
  - elite fighter
```

미래 n 대 n 예시:

```text
player team:
  - player fighter
  - ally fighter

enemy team:
  - enemy fighter 1
  - enemy fighter 2
```

### 5.2 아군 피해 방지

같은 팀끼리는 다음 효과가 발생하지 않아야 합니다.

- 충돌 피해
- 투사체 피해
- 폭발 피해
- 흡혈/삼키기/그림자 공격 같은 적대 능력
- 클릭 액션의 적대 효과

같은 팀끼리도 물리 충돌과 밀어내기는 유지할 수 있습니다. 다만 플레이 감각이 나쁘면 사냥터 전용으로 아군끼리 통과하거나 약한 분리만 적용하는 옵션을 검토합니다.

### 5.3 타겟 선택

`simulation.getOpponent(ball)`은 기존 1v1 호환을 위해 유지하되, 내부적으로는 같은 팀이 아닌 생존 fighter 중 가장 적절한 대상을 반환해야 합니다.

권장 API:

```js
simulation.isHostile(a, b);
simulation.getEnemiesOf(fighter);
simulation.getNearestEnemy(fighter);
simulation.getOpponent(fighter); // getNearestEnemy 별칭으로 유지
```

투사체와 광역 효과는 `getOpponent()` 하나만 쓰지 말고 필요에 따라 `getEnemiesOf()`를 순회해야 합니다.

## 6. 난이도 상승

층이 깊어질수록 적은 강해지고 보상도 커집니다.

```text
enemyPowerMultiplier = 1 + (floor - 1) * 0.08
elitePowerMultiplier = enemyPowerMultiplier + 0.12
rewardMultiplier = 1 + (floor - 1) * 0.15
```

적 보정 대상은 `hp`, `damage`, `defense`입니다. `speed`, `skill`, `radius`, `mass`는 전투 안정성을 위해 제외합니다.

## 7. 층 판정과 이벤트

각 층은 `rollHuntingFloorOutcome()`으로 판정됩니다.

```text
층 판정 유형:
  empty      — 빈 통로, 자동으로 다음 층 진행
  combat     — 일반/정예 적 조우, 이동 정지 → 전투
  event      — 이벤트 발생, 유형에 따라 정지 또는 자동 진행
  final_boss — 100층 고정, 챔피언급 보스 전투 → 승리 시 스테이지 클리어

층별 확률 (floor 1 기준):
  combat: ~35%  (깊을수록 ↑)
  event:  ~35%  (깊을수록 ↓)
  empty:  ~30%  (깊을수록 ↓)
```

### 6.1 전투 직후 완충 (Combat Relief)

전투 승리 직후에는 다음 3층 동안 전투 확률이 감소하고 이벤트 확률이 증가합니다.
이는 연속 전투로 인한 피로감을 줄이기 위한 장치입니다.

```text
HUNTING_COMBAT_RELIEF.INITIAL_FLOORS = 3

전투 승리 시 combatReliefFloors = 3
  relief=3: combat × 0.35  event + (감소분 × 0.7)
  relief=2: combat × 0.55  event + (감소분 × 0.65)
  relief=1: combat × 0.75  event + (감소분 × 0.55)
  relief=0: 기본 확률

층 이동마다 relief는 1씩 감소.
100층 final_boss는 완충 영향을 받지 않음.
```

### 7. 층 판정과 이벤트

| 이벤트 | 코드 | 동작 | 정지 여부 |
| --- | --- | --- | --- |
| 포탈 | `portal` | 귀환 가능, 계속 전진 가능 | 정지 |
| 떠돌이 상인 | `wandering_merchant` | MVP: 상인 발견 메시지, 구매 UI는 후속 | 정지 |
| 축복 | `boon` | 즉시 파편 획득 (8 + floor/10×3) | 자동 진행 |
| 함정 | `mishap` | 현재 HP 일부 손실 (10~14%) | 자동 진행 |
| 상자방 | `chest_room` | 전투 없이 상자 1개 획득 | 자동 진행 |
| 휴식지 | `rest_site` | HP 25% 회복 | 자동 진행 |
| 저주받은 제단 | `cursed_altar` | 스탯 교환 (1층 지속) | 자동 진행 |
| 챔피언 난입 | `champion_intrusion` | 강화 적 등장, 보상 배율 1.5배 | 정지 → 전투 |

포탈은 유일하게 귀환을 허용하는 이벤트입니다. 포탈을 지나치고 다음 층으로 전진하면 귀환 권한이 사라집니다.

### 7.2 저HP 포탈 보정과 거부 억제

캐릭터 HP가 낮을수록 포탈 이벤트가 더 자주 등장합니다. 이벤트 선택 시 포탈에 가중치를 부여하는 방식입니다.

```text
HUNTING_PORTAL_DECLINE.HP_MULT:
  HP ≥ 50%: portal weight × 1.0 (기본)
  30% ≤ HP < 50%: portal weight × 1.8
  HP < 30%: portal weight × 3.0
```

포탈에서 귀환하지 않고 `10층 전진`을 선택하면 `portalDeclineFloors = 5`가 설정되고, 이후 5층 동안 HP 기반 포탈 보정이 억제됩니다(×1.0 고정). 층 이동마다 1씩 감소하며, 0이 되면 다시 HP 기반 보정이 활성화됩니다. 이는 포탈을 거부했을 때 바로 다음 층마다 포탈이 반복되는 것을 방지하기 위함입니다.

## 8. 상자와 개봉 비용

상자는 사냥터 중 획득하지만, 개봉은 보관함에서 열쇠 조각을 써서 진행합니다.

| 등급 | 코드 | 개봉 비용 | 주요 보상 |
| --- | --- | ---: | --- |
| 낡은 상자 | `common` | 20 | 열쇠 조각 환급, 소량 XP, 일반 색상 |
| 튼튼한 상자 | `uncommon` | 50 | 색상, 낮은 등급 모자, 사냥터 임시 아이템 |
| 빛나는 상자 | `rare` | 120 | 스킨, 설계도, 칭호 |
| 챔피언 상자 | `epic` | 250 | 챔피언 모자 변형, 고급 설계도 |
| 전설 상자 | `legendary` | 500 | 희귀 스킨, 전용 연출, 고급 칭호 |

MVP는 `common`, `uncommon`, `rare` 3등급만 구현합니다.

## 9. 열쇠 조각 획득

```text
일반 적 처치: 5~8
정예 적 처치: 15~25
챔피언 적 처치: 40
층 클리어 보너스: 10
깊은 층 보너스: floor마다 +10%
```

보상은 귀환 전까지 `pendingLoot`에 들어갑니다.

## 10. 패배와 귀환

귀환하면 모든 pendingLoot를 securedLoot로 옮기고 프로필에 저장합니다.

### 10.1 상자 파손 (연쇄 확률)

패배 시 pendingLoot의 상자가 연쇄적으로 파손됩니다. 각 상자는 등급에 따라 가중치가 부여되며, 가중치가 높을수록 파손될 확률이 높습니다.

```text
파손 가중치:
  common:   1
  uncommon: 2
  rare:     3
  epic:     4
  legendary: 5

파손 확률 (연쇄):
  첫 번째 파손: 100% (가중치 랜덤 선택, 높은 등급이 더 잘 깨짐)
  두 번째 파손: 50%
  세 번째 파손: 25%
  네 번째 파손: 12.5%
  ...
  (매 단계 50%씩 감소)
```

의사 코드:

```text
candidates = pendingLoot.chests shuffled
sort by weight descending (pick order)
index = 0
probability = 1.0
while probability > random() AND index < candidates.length:
    destroyed = candidates[index]
    remove destroyed from pendingLoot
    index += 1
    probability *= 0.5
```

상자가 3개(common, uncommon, rare)이고, rare가 파손된 후 50% 확률로 uncommon, 다시 25% 확률로 common이 파손될 수 있습니다. 운이 나쁘면 모든 상자를 잃을 수도 있습니다.

### 10.2 열쇠 조각 보존

```text
열쇠 조각: 50% 보존 (반올림)
```

### 10.3 XP 보존

```text
캐릭터 XP: 70% 지급
```

매치 XP의 70%는 패배해도 지급됩니다. 이로 인해 레벨 자체는 패배해도 천천히 오릅니다.

## 11. 보상 풀

권장 보상:

- 캐릭터 색상
- 스킨
- 챔피언 모자 변형
- 전투 시작 이펙트
- 칭호
- 사냥터 전용 임시 아이템
- 설계도
- 소량 XP
- 열쇠 조각 환급

주의 보상:

- 전 캐릭터 공통 영구 HP/공격력 증가
- 액션 쿨다운 대폭 감소
- 토너먼트까지 강하게 만드는 장비

## 12. 설계도 방식

상자에서 완성 보상 대신 설계도를 얻고, 열쇠 조각으로 확정 해금하는 구조를 권장합니다.

```text
빛나는 상자
  -> "흡혈 배지 설계도" 발견
  -> 보관함에서 열쇠 조각 150개로 해금
  -> 이후 사냥터 보상 선택지에 흡혈 배지 등장
```

설계도 발견은 랜덤, 해금은 확정 재화 지불입니다.

## 13. 보관함 UI

컬렉션 허브에 `보관함` 탭을 추가합니다.

표시 항목:

- 보유 열쇠 조각
- 미개봉 상자 목록
- 등급별 필터
- 개봉 비용
- 개봉 버튼
- 발견한 설계도와 해금 비용

PC:

- 좌측: 상자 목록
- 우측: 선택 상자 상세와 예상 보상 범위
- 하단: 설계도 목록

모바일:

- 상자 목록을 세로 카드로 표시
- 개봉 버튼은 카드 하단 고정
- 설계도는 별도 접이식 섹션
- 페이지 전체 스크롤 대신 컬렉션 허브 내부 스크롤 사용

## 14. 프로젝트 구조

```text
src/
  hunting/
    huntingConfig.js
    huntingState.js
    huntingEncounters.js
    huntingRewards.js
    chestRewards.js
    index.js
```

| 파일 | 책임 |
| --- | --- |
| `huntingConfig.js` | 층 난이도, 이벤트 확률, 상자 등급, 비용 |
| `huntingState.js` | 사냥터 런 상태, 귀환/전진/패배 처리 |
| `huntingEncounters.js` | 전투/이벤트/상자방 조우 생성 |
| `huntingRewards.js` | 처치 보상, 층 보너스, pending/secured 계산 |
| `chestRewards.js` | 상자 개봉, 설계도 발견/해금 |
| `playerProfile.js` | 보관함/재화/설계도 저장과 마이그레이션 |
| `collectionViewModel.js` | 보관함 탭 ViewModel |

## 15. 플레이어 프로필

```js
{
    hunting: {
        keyShards: 0,
        chests: [
            {
                id: "uuid",
                rarity: "common",
                acquiredAt: 1719200000000
            }
        ],
        blueprints: {
            vampire_badge: {
                discovered: true,
                unlocked: false
            }
        },
        stats: {
            runsStarted: 0,
            runsRetreated: 0,
            runsDefeated: 0,
            deepestFloor: 0
        }
    }
}
```

상자 ID는 중복 개봉 방지를 위해 필요합니다.

## 16. MVP 구현 범위

1. 사냥터 입장 버튼 (메인 메뉴)
2. 캐릭터 선택 UI (한 번이라도 우승한 캐릭터만 표시)
3. 최대 5층 1v1 연속 전투, HP 층간 누적
4. 승리 후 귀환/전진 선택
5. 층별 적 강화
6. 랜덤 이벤트 3종: 상자방, 휴식지, 저주받은 제단
7. 열쇠 조각 지급과 보관 (패배 시 50% 보존)
8. 상자 3등급: common/uncommon/rare
9. 상자 파손 연쇄 확률 (100%→50%→25%→...)
10. 보관함 탭에서 상자 개봉
11. 사냥터 매치 XP 지급 (stageMultiplier=1.0 고정)

**MVP 제외** (별도 문서, 이후 구현):
- 장비 시스템 ([`docs/equipment-system.md`](equipment-system.md))
- 사냥터 전용 임시 아이템
- 동시 다수 전투 / n 대 n
- 상인 이벤트
- 설계도 시스템
- 챔피언 난입

## 17. 필수 회귀 조건

- 토너먼트 결과와 사냥터 결과가 서로의 진행 상태를 오염하지 않아야 합니다.
- 사냥터 입장 시 우승 기록이 없는 캐릭터는 선택 UI에 표시되지 않아야 합니다.
- 귀환 시 pendingLoot가 프로필에 정확히 저장되어야 합니다.
- 패배 시 상자 파손 확률이 연쇄적으로 정확히 적용되어야 합니다.
- 패배 시 파손 가중치가 등급별로 달라야 합니다(높은 등급일수록 먼저 파손).
- 패배 시 열쇠 조각 50% 보존이 정확히 계산되어야 합니다.
- 패배 시 XP 70% 지급이 한 번만 적용되어야 합니다.
- 사냥터 HP는 층간 리셋되지 않아야 합니다 (이벤트 회복만).
- HP가 0이 되면 사냥터가 즉시 패배 처리되어야 합니다.
- 귀환 후에도 프로필 HP는 사냥터 시작 전 상태로 복원되어야 합니다(사냥터 HP는 전투 중에만 누적).
- 같은 상자 ID를 두 번 개봉할 수 없어야 합니다.
- 열쇠 조각이 부족하면 상자를 열 수 없어야 합니다.
- 상자 개봉 비용은 등급별로 달라야 합니다.
- 사냥터 전투에서 같은 팀끼리는 피해를 주지 않아야 합니다.
- 사냥터 전투에서 적 팀이 모두 패배하면 조우 승리로 처리해야 합니다.
- 플레이어 팀이 모두 패배하면 사냥터 패배로 처리해야 합니다.
- 사냥터 매치 XP는 `stageMultiplier=1.0`으로 계산되어야 합니다.
- 사냥터 XP도 `processedReportIds` 중복 방지 대상에 포함되어야 합니다.
- 모바일 보관함 UI에서 상자 카드와 개봉 버튼이 화면 밖으로 잘리지 않아야 합니다.

## 18. 후속 결정

- 상자 등급별 실제 보상 확률은 balanceSim과 플레이 테스트 후 확정합니다.
- 동시 다수 전투를 언제 MVP에 포함할지 결정해야 합니다.
- 설계도 보상이 토너먼트에도 영향을 줄지, 사냥터 전용으로 제한할지 결정해야 합니다.
- 패배 손실률 50%가 너무 가혹하거나 너무 약한지 플레이 테스트로 조정합니다.

## 19. 구현 현황

2026-07-04 기준으로 전투 UI에 사냥터 런을 붙이기 전 단계의 기반 코드가 구현되었습니다.

구현됨:

- `src/hunting/huntingConfig.js`: 최대 5층, 이벤트 확률, 상자 등급/개봉 비용, 파손 가중치, 해조각 범위, 패배 보존율 정의
- `src/hunting/huntingRewards.js`: 층별 보상 배율, 해조각 보상, 상자 생성, pending/secured loot 병합, 패배 시 상자 연쇄 파손과 50%/70% 보존
- `src/hunting/huntingEncounters.js`: 층별 적 스케일링, 이벤트 발생/선택
- `src/hunting/huntingState.js`: 우승 캐릭터 입장 조건, 사냥터 런 생성, 층 클리어, 전진, 이벤트 회복, 귀환, 패배 처리
- `src/hunting/chestRewards.js`: 보관함 상자 개봉 가능 여부, 개봉 비용, 임시 보상 미리보기, 상자 제거/해조각 차감
- `src/playerProfile.js`: `hunting.keyShards`, `hunting.chests`, `hunting.blueprints`, `hunting.stats` 저장/정리
- `src/collection/collectionViewModel.js`, `src/ui.js`, `index.html`: 컬렉션 허브 보관함 탭 데이터와 최소 UI 노출
- `tests/regression.mjs`: 입장 조건, 스케일링, HP carried state, 귀환, 패배 파손/보존, 상자 개봉, 프로필 sanitize, 보관함 ViewModel 검증

아직 구현 전:

- 메인 화면 사냥터 입장 버튼
- 우승 경험 캐릭터 선택 UI
- 실제 `BattleSimulation`을 이어 붙이는 층별 1v1 런
- 승리 후 자동 흐름을 해치지 않는 귀환/전진 선택 UI
- 상자 개봉의 실제 보상 테이블과 XP/외형/설계도 지급
- 사냥터 매치 XP 지급과 `processedReportIds` 중복 방지 연결

## 20. 2026-07-04 추가 구현 — 상자 보상 테이블과 이벤트 확장

사냥터 상자는 더 이상 등급/id만 가진 더미 객체가 아닙니다. `createHuntingChest()`는 등급별 개봉 비용, 보상 테이블 버전, 미리보기 문자열을 함께 생성합니다.

### 상자 보상 테이블

구현 파일:

- `src/hunting/huntingConfig.js`: 상자 5등급, 비용, 보상 타입 정의
- `src/hunting/huntingRewards.js`: 등급별 보상 테이블, 보상 미리보기, 보상 롤링
- `src/hunting/chestRewards.js`: 보관함 개봉 가능 여부, 실제 개봉, 즉시 적용 가능한 보상 반영

보상 타입:

| 타입 | 적용 |
|---|---|
| `key_shards` | 개봉 즉시 `profile.hunting.keyShards`에 반영 |
| `instant_heal` | 후속 런 적용용 deferred effect로 반환 |
| `temporary_stat` | 후속 런 적용용 deferred effect로 반환 |

현재 MVP에서는 보관함에서 즉시 적용 가능한 해조각 보상만 프로필에 직접 반영합니다. HP 회복과 임시 스탯 증가는 런 시작/진행 UI에 연결할 후속 payload로 반환합니다. 새 저장 스키마를 성급히 늘리지 않기 위한 선택입니다.

### 이벤트 확장

`src/hunting/huntingEncounters.js`의 이벤트 풀은 아래 타입을 포함합니다.

| 이벤트 | 효과 |
|---|---|
| `rest_site` | carried HP를 최대 HP의 25%만큼 회복 |
| `chest_room` | 층수 기반 희귀도 상자를 pending loot에 추가 |
| `cursed_altar` | 다음 전투에 적용되는 능력치 교환 효과 추가 |
| `champion_intrusion` | 다음 적을 champion 타입으로 스케일하고 보상 해조각 1.5배 |

저주받은 제단은 `applyHuntingCursedAltar()`를 통해 `run.statModifiers`에 gain/loss modifier를 추가합니다. 전투 클리어 시 `recordHuntingFloorResult()`가 modifier 지속 층수를 소모합니다. 상자방처럼 전투가 아닌 이벤트 보상은 `consumeStatModifiers: false`를 사용해 지속 층수를 소모하지 않습니다.

챔피언 난입은 `HUNTING_ENEMY_TYPES.CHAMPION`과 `HUNTING_SCALING.CHAMPION_POWER_BONUS`를 사용합니다. `HuntingManager`는 해당 이벤트가 걸린 층의 적을 champion으로 스케일하고, 승리 시 해조각 보상에 `rewardMultiplier`를 적용합니다.
