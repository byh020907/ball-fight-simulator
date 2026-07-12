# 게임 규칙

> **클릭 액션 시스템**: [`docs/click-actions.md`](click-actions.md) (v0.9.0, 실패 피드백 추가)

이 문서는 Ball Fight Simulator의 게임성 규칙을 기록하는 기준 문서입니다. 전투 규칙, 스탯, 토너먼트 진행 방식이 바뀌면 구현과 함께 이 문서를 업데이트합니다.

## 현재 게임 흐름

1. 페이지가 열리면 전체 로스터 중 하나가 무작위로 사용자를 대표하는 캐릭터로 지정됩니다.
2. 사용자는 토너먼트 시작 전에 내 캐릭터의 스탯 포인트를 배분합니다.
3. 사용자가 모든 포인트를 배분하면 토너먼트를 시작할 수 있습니다.
4. 토너먼트 시작 시 나머지 캐릭터들도 같은 총량의 포인트를 무작위로 배분받습니다.
5. 대진표가 확정되고, 기존처럼 전투는 자동으로 결승까지 진행됩니다.
6. 사용자의 캐릭터가 우승하면 축하 메시지를 표시합니다.
7. 사용자의 캐릭터가 중간에 탈락하면 아쉬운 메시지와 최종 등수를 표시합니다.

## 전투 팀 규칙

전투 참가자는 `teamId`를 가집니다. 명시적 팀이 없는 기존 토너먼트 참가자는 각자 다른 기본 팀을 받아 개인전처럼 동작합니다.

- 서로 다른 `teamId`끼리는 적입니다.
- 같은 `teamId`끼리는 아군입니다.
- 아군끼리는 겹쳤을 때 밀어내기와 충돌 물리는 유지되지만 충돌 피해, 투사체 피해, Dash 충돌 피해 같은 적대 효과를 주지 않습니다.
- 승패는 생존한 적대 팀 수로 판단합니다. 생존 fighter가 여러 명이어도 모두 같은 팀이면 그 팀의 승리로 처리합니다.
- 단일 대상 능력은 `simulation.getOpponent()`를 통해 가장 가까운 적을 고릅니다. 다수 대상 능력은 `simulation.getEnemiesOf()`를 사용해 아군을 제외해야 합니다.

이 규칙은 사냥터, 웨이브, 1대n, n대n 전투를 위한 기반입니다. 자세한 사냥터 설계는 [`docs/hunting-grounds-system.md`](hunting-grounds-system.md)를 참고합니다.

## 스탯 배분 규칙

현재 배분 포인트는 총 100점입니다. 각 스탯은 캐릭터의 종족값을 기준으로 개선됩니다.

| 스탯   | 코드 값   | 1포인트 효과                     | 설명                                                   |
| ------ | --------- | -------------------------------- | ------------------------------------------------------ |
| 체력   | `hp`      | 종족값 x `1 + 포인트/100`        | 오래 버티는 능력입니다.                                |
| 공격   | `damage`  | 종족값 x `1 + 포인트/100`        | 충돌 최대 피해량이 증가합니다.                         |
| 속도   | `speed`   | 종족값 x `1 + 포인트/100`        | 기본 이동 속도를 올립니다.                             |
| 쿨타임 | `skill`   | 스킬 쿨타임 × `100/(100+포인트)` | 스킬 쿨타임이 체감 감소합니다. (100포인트 시 50% 단축) |
| 방어력 | `defense` | 종족값 x `1 + 포인트/100`        | 받는 피해에서 방어력만큼 차감됩니다.                   |

스탯 하나에 최대 100점까지 투자할 수 있습니다.

게임 UI에서는 캐릭터의 원본 값을 직접 보여주지 않고, `체력 +30% · 공격 +40% · 속도 +30% · 쿨타임 +30%`처럼 배분 결과만 표시합니다.

### 스탯 배분 계산 방식

`applyStatAllocation()`에서 모든 스탯은 **pre-compute**됩니다 (전투 중 재계산 없음).

```
hp      = baseHP      × (1 + pts/100) × 밸런스배율
damage  = baseDamage  × (1 + pts/100) × 밸런스배율
speed   = baseSpeed   × (1 + pts/100) × 밸런스배율
defense = baseDefense × (1 + pts/100) × 밸런스배율
skill   = pts         (별도 저장, Ability.cooldown에서 100/(100+pts)로 계산)
```

`skill`만 포인트를 그대로 저장하고, `Ability` 베이스 클래스의 `cooldown` getter에서 `100/(100+스탯)` 공식으로 동적 계산합니다.

### 충돌 피해 계산 (3단계)

```
1단계 — calculateCollisionDamage()
  ㄴ round(baseDamage × efficiency × getDamageMultiplier())
     - efficiency = speedEff × dirEff × glancingPenalty (모두 상한 없음)
     - speedEff = 현재 속도 / baseSpeed (스탯 보정 완료된 기준, 1=기본)
     - getDamageMultiplier(): 오버타임 전용, 평소 1

2단계 — aModifiers.damage (곱)
  ㄴ Ability.getStatModifiers().damage (능력별 피해 보정)

3단계 — takeDamage() 방어력 차감
  ㄴ actual = max(1, round(amount - totalDefense))
     - totalDefense = round(baseDefense × abilityDefMult)
     - abilityDefMult: Ability.getStatModifiers().defense (기본 ×1, Eater 피스트 ×1.5)
```

예: `damage=10, efficiency=0.7` → 1단계: 7 → 2단계: `×1.0` → 3단계: 방어력 4면 `7-4=3` 실제 피해.

### 충격 기반 충돌 물리

볼끼리 충돌하면 `BattleSimulation`이 두 볼의 상대 속도, 질량(`mass`), 반발 계수(`COLLISION_RESTITUTION`)를 기준으로 impulse를 계산해 양쪽 `velocity`에 더합니다. 이 충격 속도는 다음 틱에 즉시 사라지지 않고 유지되며, `BattleBall`은 매 틱 현재 속도를 기본 주행 속도 쪽으로 일정 비율만 보정합니다.

즉, 충돌 직후에는 튕겨 나가는 속도가 실제 전투에 남고, 시간이 지나면서 각 캐릭터의 기본 속도/스탯/이동 효과 기준으로 자연스럽게 복귀합니다. 이 구조의 목적은 공이 겹친 상태에서 매 프레임 최소 피해(`1`)가 반복으로 들어가는 현상을 줄이고, Dash/Rage/넉백처럼 빠른 이동 상태가 충돌 물리와 같은 방식으로 섞이게 하는 것입니다.

### 넉백 시스템

모든 공격은 명중 시 `applyKnockback(velocity, duration)`으로 넉백 impulse를 즉시 더하고, duration 동안 `forceHeading`으로 방향만 고정합니다. `forceHeading`은 더 이상 고정 속도(`overrideVelocity`)를 소유하지 않습니다. 실제 `velocity`는 충돌/넉백 impulse를 보존한 채 기본 주행 속도 쪽으로 보정됩니다. 벽에 닿으면 넉백 방향 고정은 종료됩니다.

| 공격                | 지속시간 | 속도                          |
| ------------------- | -------- | ----------------------------- |
| Arrow               | 0.2초    | 화살속도 × 0.6                |
| Orbit 근접 위성     | 0.3초    | targetSpeed × 2.5             |
| Orbit 원거리 발사체 | 0.15초   | 발사체속도 × 0.4              |
| Grenade 폭발        | 0.35초   | 400px/s (폭발 중심→대상 방향) |

### 방어력(defense) 상세

받는 피해 계산은 **뺄셈** 기반이며, 각 캐릭터의 기본 방어력에 능력 보정(곱)이 적용됩니다.

```
받는 피해 = max(1, 들어온 피해 - totalDefense)

totalDefense = round(baseDefense × abilityDefMult)
  - baseDefense: roster.js에 정의된 캐릭터별 기본 방어력 (스탯 배분으로 증가)
  - abilityDefMult: 각 Ability의 getStatModifiers().defense
    - 기본 ×1 (변화 없음)
    - Eater 피스트 중: ×1.5 (방어력 1.5배)
```

예: 방어력 2의 Eater가 10 피해를 받으면 `10 - 2 = 8`만 실제로 입습니다. 피스트 중에는 `10 - 3`으로 7 피해를 입습니다.

## 스탯으로 열지 않은 값

아래 값은 시스템 스탯이지만 현재 사용자 배분 대상에서는 제외합니다.

- `radius`: 캐릭터 크기와 피격 판정, 시각 정체성을 동시에 바꿉니다.
- `mass`: 충돌 물리의 개성을 크게 바꿉니다.
- `force`: 이전 초안의 충격 스탯이었지만 실제 전투 계산에 연결되지 않아 제거했습니다.

`radius`와 `mass`는 캐릭터별 고유성에 가깝기 때문에 당장은 고정합니다. 추후 장비, 난이도, 특수 모드가 생기면 별도 규칙으로 다시 검토합니다.

## Hero Ball / Hero Orb

### 능력: Hero Orb

Hero Ball은 쿨타임마다 랜덤 방향으로 **Hero Orb** 1개를 던집니다. Hero Orb는 5가지 스탯 타입 중 하나를 랜덤으로 가집니다.

| 타입 | 색상 | 효과 (1개 수집 시) |
|------|------|--------------------|
Hero Ball의 기본 쿨타임은 **1.0초**이며, 쿨타임 스탯(`skill`)으로 단축할 수 있습니다.

| 타입 | 색상 | 효과 (1개 수집 시) |
|------|------|--------------------|
| `hp` | 초록 (`#44dd44`) | `maxHp +5×amount`, 현재 HP도 `+5×amount` |
| `damage` | 빨강 (`#ff4444`) | `baseDamage × 1.02^amount` |
| `speed` | 파랑 (`#4488ff`) | `baseSpeed +4×amount` |
| `defense` | 노랑 (`#dddd44`) | `baseDefense +0.33×amount` |
| `skill` | 보라 (`#bb66ff`) | `heroOrbBonuses.skill +amount` (Ability.cooldown에 반영) |

> **amount**는 1, 2, 3, 4, 5 중 균등 랜덤입니다. (`rollHeroOrbStatGain()`)
> `HERO_ORB_STAT_CAP`이 0 이상일 때는 bonus + amount가 cap을 넘지 않도록 clamp되며, clamp된 실제 amount만 적용됩니다.

### Hero Orb 동작 규칙

- **Hero Ball 본인이 오브와 충돌** → 해당 effect를 적용하고 오브는 사라집니다.
- **상대가 오브와 충돌** → 아무 보너스 없이 오브만 사라집니다. 피해/넉백 없음.
- Hero Orb는 `CombatEntity` 기반 엔티티로, `Projectile`의 공통 데미지 처리 흐름을 타지 않습니다.
- `HERO_ORB_STAT_CAP = -1` (기본값). -1이면 무한 성장. 0 이상으로 설정 시 Hero Orb로 얻은 해당 스탯 보너스가 cap에 도달하면 더 이상 증가하지 않음. cap에 걸려도 오브는 먹은 것으로 처리되어 제거됩니다.
- `HERO_ORB_MAX_ACTIVE_PER_OWNER = 10` — Hero Ball 1개체당 자신이 만든 Hero Orb는 최대 10개까지 필드에 존재할 수 있습니다. 전체 필드 20개 제한은 없습니다. 새 오브 생성 시 owner의 오브가 10개를 넘으면 가장 오래된 오브부터 제거됩니다.
- Hero Orb의 기본 수명은 무제한입니다. 쿨타임 기반 자연 만료는 없으며, owner 수집/상대 제거/owner별 10개 제한으로만 사라집니다.
- Hero Ball이 여러 명일 때 owner별 10개 제한은 서로 독립적으로 적용됩니다.
- 상대가 먹은 Hero Orb는 owner의 active 목록에서 제거됩니다.

### 특수 Hero Orb

Hero Ball은 일정 확률로 일반 스탯 orb 대신 **특수 orb**를 던집니다. 특수 orb는 `heroOrbBonuses` 스탯 누적치에 포함되지 않으며, 시각적으로 내부에 기호(`≫`/`↑`/`⚡`)가 표시됩니다.

| 타입 | 색상 | 확률 | 효과 |
|------|------|------|------|
| `dash` | 주황 (`#ff8833`) | 10% | owner 현재 전투 속도 × 1.5로 상대를 향해 돌진 |
| `arrow` | 빨강 (`#ff6666`) | 10% | owner 현재 전투 속도 × 2.0의 화살을 상대에게 발사 (owner damage 비례) |
| `cooldown_burst` | 청록 (`#66ddff`) | 5% | 1초간 HeroAbility 쿨타임이 10%로 단축 |

- 특수 orb는 기존 `DashEffect` / `spawnArrow` / `ArrowProjectile` 로직을 재사용합니다.
- 확률은 각각 독립 설정 가능하며, 기본 총 특수 확률은 25%입니다.
- 상대가 특수 orb를 먹으면 기존과 동일하게 보너스 없이 제거됩니다.
- 특수 orb도 `HERO_ORB_MAX_ACTIVE_PER_OWNER = 10` 제한에 포함됩니다.

### Hero Orb 발사 속도

Hero Orb는 Hero Ball의 현재 전투 속도를 기준으로 발사됩니다.

```
Hero Orb 속도 = owner 전투 속도 × 랜덤 배율 (1.2 ~ 1.5)

owner 전투 속도 = movementSpeed ?? baseSpeed × speedModifier × slowMult × boostMult
  - movementSpeed: DashEffect 등에 의한 현재 이동 속도 오버라이드 (우선)
  - baseSpeed: 캐릭터 기본 속도 (스탯 배분 + Hero Orb 보너스 반영)
  - speedModifier: Ability.getStatModifiers().speed
  - slowMult: slowEffect 적용 시 1 미만
  - boostMult: speedBoost 적용 시 1 이상
```

### Hero Orb 획득 피드백

- owner가 Hero Orb를 먹으면 해당 effect 색상에 맞는 `스탯명 +N` 텍스트가 오브 위치에 표시됩니다.
- `N`은 실제 적용된 amount로, 1~3 랜덤이며 cap clamp 시 줄어들 수 있습니다.
- 예: `체력 +3` (초록), `힘 +2` (빨강), `속도 +1` (파랑), `방어 +3` (노랑), `쿨타임 +2` (보라)
- `HERO_ORB_STAT_CAP`에 걸려 스탯이 증가하지 않은 경우에는 텍스트가 표시되지 않습니다.
- 상대가 Hero Orb를 먹어 제거하는 경우에도 텍스트가 표시되지 않습니다.

### Hero Orb UI 표시

- Hero Ball의 fighter card 스탯 줄은 시작 전 배분과 Hero Orb 보너스를 같은 항목에 합쳐 표시합니다.
- 예: `체력 +30%(+3) · 힘 +20%(+1) · 속도 +10%`
- Hero Orb 보너스 표기는 기본 배분 뒤에 공백 없이 붙입니다. 예: `+10%(+3)`
- 앞의 `%` 값은 토너먼트 시작 전 배분한 기본 스탯이고, 뒤의 `+n`은 전투 중 Hero Orb로 먹은 누적 보너스입니다.
- Hero Orb 보너스가 0인 스탯은 기본 배분만 표시합니다.
- Hero Ball은 표시 문자열이 길어질 수 있으므로 fighter card 스탯 줄의 폰트 크기를 다른 캐릭터보다 작게 사용합니다.

### Hero Ball 승리 시 스탯 계승 (Carryover)

Hero Ball(플레이어 여부와 관계없이 모든 Hero Ball)이 경기에서 승리하면, 이번 경기에서 Hero Orb로 얻은 일반 스탯 5종의 절반을 **다음 스테이지에 계승**합니다.

- 계승량: 각 스탯별 `floor(이번 경기 획득량 × HERO_ORB_CARRYOVER_RATE)` (기본 `0.5`)
- 예: hp +5 → carry +2, damage +1 → carry +0, speed +4 → carry +2
- 패배 시 계승 없음
- 기존 carryover는 다시 절반 계산하지 않음 (이번 경기 신규 획득량만 기준)
- carryover 효과는 기존 Hero Orb 1점당 효과와 동일합니다.
  - hp carry 1 = `maxHp +5`, 현재 HP도 +5
  - damage carry 1 = `baseDamage × 1.02`
  - speed carry 1 = `baseSpeed +4`
  - defense carry 1 = `baseDefense +0.33`
  - skill carry 1 = `statAllocation.skill +1` (Ability.cooldown 반영)
- UI 괄호 `(+n)`에는 carryover + 이번 경기 신규 획득량이 합산 표시됩니다.
- 특수 Hero Orb(dash/arrow/cooldown_burst)는 carryover 대상이 아닙니다.

### effect registry 확장

Hero Orb의 effect type은 `HERO_ORB_EFFECTS` 레지스트리로 관리됩니다. 각 entry는 `{ color, label, apply(owner, context) }` 형태입니다. `apply()`는 `{ applied: boolean, amount: number }`를 반환합니다. `applied: false`이면 cap이나 다른 이유로 실제 스탯이 증가하지 않은 상태입니다. 새 타입(`heal`, `shield`, `temporary_buff` 등)은 레지스트리에 entry를 추가하기만 하면 됩니다. `context`는 `{ orb, simulation, effectType }`을 포함합니다.

## 등수 규칙

현재 8명 로스터는 8강 슬롯에 배치되며 일부 캐릭터는 부전승을 받을 수 있습니다.

## 토너먼트 참가자 선발 규칙 (v0.10.0+)

- **전체 roster가 8명 이상** → 유저 캐릭터 1명 + 유저 제외 랜덤 7명 = 총 **8명**이 토너먼트에 참가합니다.
- **전체 roster가 정확히 8명** → 기존과 동일하게 유저 캐릭터 + 나머지 7명이 모두 참가합니다.
- **전체 roster가 8명 미만** → 가능한 모든 캐릭터가 참가하며, 기존 부전승(bye) 로직을 유지합니다. 강제로 8명을 채우기 위한 중복 캐릭터를 추가하지 않습니다.
- 유저 캐릭터가 상대 풀에 중복으로 들어가지 않습니다.

- 우승: 1위
- 결승 탈락: 2위
- 준결승 탈락: 공동 3위
- 1라운드 탈락: 공동 5위

동률 표기는 현재 토너먼트 구조를 단순하게 설명하기 위한 규칙입니다.

## 밸런스 메모

- 포인트 총량 `100`과 포인트당 `1%` 개선은 직관성을 위한 초안입니다.
- 공격과 속도는 전투 시간과 KO 빈도에 크게 영향을 주므로 테스트를 보며 먼저 조정합니다.
- AI 캐릭터는 사용자와 같은 총 포인트를 받되 분배만 무작위로 하여 시작 조건의 총량을 맞춥니다.
- Orbit Ball은 잃은 위성을 한 개씩 재충전하며, 위성 1개당 충전 시간은 1초(쿨타임 스탯으로 단축)입니다. 위성 5개가 모두 모이면 200~500px 거리의 적에게 5연속 발사합니다. 발사체는 벽에 튕기며 0→baseSpeed×5로 가속합니다. 근접 위성 충돌 시 넉백(0.3초/2.5배), 원거리 발사체 넉백(0.15초/1.5배).
- Vampire Ball의 박쥐 떼는 Boids(Flocking) 알고리즘으로 이동합니다. 7마리가 떼를 지어 응집/정렬/분리하며 접근하고, 표적 추적 가속도(10 px/s²)로 적을 추적합니다. 개별 박쥐 데미지는 baseDamage × 0.2이며, 흡혈률은 70%입니다. 쿨타임 4초. 초기 속도는 baseSpeed × 0.5로 느리게 출발해 최대 ×1.5까지 가속합니다.
- Trickster Ball의 시드 속도는 owner 전투 속도 × 1.2~1.5 랜덤 배율입니다. 시드 수명은 스킬 쿨타임(쿨타임 스탯 적용 후)의 2배입니다. 시드 대시 충돌 데미지는 baseDamage × 0.9입니다.
- Dash Ball은 기본 쿨다운 3초의 빠른 대시를 사용하며, 대시 충돌 시 baseDamage × 0.4의 보너스 데미지가 추가됩니다 (속도 기반 기본 충돌뎀과 별도). 유도 보정은 쿨다운 스택이 없는 100% 쿨 상태의 대시에서만 적용됩니다. 대시 중 상대를 맞히면 쿨다운이 50%씩 누적 감소하며, 최대 2단계(75% 감소)까지 줄어듭니다. 벽에 먼저 닿으면 쿨다운 스택이 완전히 초기화됩니다.
- Eater Ball은 피스트(Feast) 모드 진입 시 3.3초간 지속되며, 삼키기 전까지 `steerBallToward` 기반 제한 유도로 상대를 추적합니다. 충돌 시 상대를 삼키고(0.72초), 이후 뱉어내면 상대는 벽 충돌 대시 상태가 됩니다. 쿨타임은 피스트 중 및 삼키는 중에는 감소하지 않으며, 뱉은 후 풀로 초기화됩니다. 삼키는 동안 Eater의 크기는 1.5배로 커지고, 뱉으면 원래 크기로 돌아옵니다. 기본 방어력은 2이며, 피스트 중 방어력은 1.5배(실질 3)입니다.
- Archer Ball의 쿨타임은 기본값 3초 기준 ±30% 범위에서 랜덤하게 결정됩니다. (0.7~1.3배)
- Grenade Ball은 360도 무작위 방향으로 3~5개의 수류탄을 순차 발사합니다(기본 쿨다운 3.5초, 발사 간격 0.12초). 수류탄 탄속은 현재 기본 속도의 `800 / 290`배이며 기본 속도 290에서는 800px/s입니다. 첫발 퓨즈는 현재 유효 쿨다운의 20%이고 마지막발은 현재 유효 쿨다운과 같으며, 그 사이를 선형 지연 폭발합니다. 벽에 최대 4회 튕깁니다. 폭발 이펙트 외곽과 같은 174px까지 피해가 들어가며, 데미지는 중심에서 `기본 공격력 × 2.5`, 가장자리에서 `기본 공격력 × 1.5`까지 거리 비례 감소합니다. 넉백은 900px/s로 1.3초 동안 적용됩니다. 수류탄의 이동 경로가 상대 폭발권을 지나면 남은 퓨즈가 기본 3배 빠르게 줄며, 진입 순간 탄속이 기본 발사 탄속의 두 배 이상이면 최대 6배까지 증가합니다.
- Archer Ball은 조준 완료 시 상대의 현재 위치·속도와 화살 속도로 요격 지점을 계산해 발사합니다. 발사 뒤 유도는 없으며, 2회 연속 빗나가면 동시 산탄 대신 매 발의 요격 지점을 다시 계산하는 3연발을 발사한 뒤 기본 흐름으로 돌아갑니다.
- Archer Ball의 패시브 회피는 상대가 가까워질 때 옆 방향 impulse를 즉시 적용하고, 짧은 시간 동안 회피 방향을 유지합니다.
- 모든 투사체 데미지(Arrow, Grenade Fragment, Orbit Shard, Seed Dash)는 캐릭터의 baseDamage(스탯 보정 포함)에 비례합니다.
- Rage Ball은 충돌하지 않는 시간이 길수록 점점 강해집니다. 최고 속도는 기본의 5배까지 올라가며, 쿨타임 스탯이 충전 시간을 단축합니다. (100포인트 시 7초 → 3.5초)
- 모든 캐릭터의 쿨타임 스탯 공식은 `100/(100+skill)`입니다. 100포인트 투자 시 원래 쿨타임의 50%까지 줄어듭니다.
