# 경험치 보상 효과 구조

## 목적

레벨 보상은 선택한 캐릭터의 기본 수치와 대표 행동을 함께 강화합니다. 수치 적용 순서는 반드시 `캐릭터 기본 수치 + 레벨 기본 스탯 → 사용자 스탯 배율 → 장비 고정 수치 → 숙련도 최종 보정`을 따릅니다.

## 데이터와 적용 경로

1. `src/rewardBalanceConfig.js`의 `experience.characterLevelProgressions`가 캐릭터별 Lv.2~10 보상 행의 단일 원본입니다. Lv.3·Lv.6·Lv.9 행은 `gameText`로 게임에 표시할 행동 강화 문구도 함께 소유합니다.
2. `characterLevelProgression.js`는 캐릭터 ID와 현재 레벨로부터 불변 `CharacterLevelProgression` 스냅샷을 만듭니다. 스냅샷은 보상 행, 누적 기본 스탯, 능력 tier, 보상 ID를 함께 가집니다.
3. 기본 스탯 효과는 `reward-effects/effectRegistry.js`의 `stat` 핸들러가 fighter spec에 적용합니다. 이 단계는 스탯 배분보다 앞입니다.
4. `BattleSimulation`은 Ball 생성과 Ability 바인딩 뒤에 같은 스냅샷을 적용합니다. `ability_tier` 핸들러는 `BattleBall.progression.abilityTier`만 갱신합니다.
5. Ability는 공통 `getLevelUpgrade()`로 자신의 tier를 읽고, 실제 행동 수치만 소비합니다. 전투 엔진은 캐릭터 ID나 Ability ID 조건문으로 분기하지 않습니다.

토너먼트와 사냥터는 같은 진행 스냅샷을 기본 spec 단계와 BattleBall 단계에 각각 전달합니다. 레벨업 순간에 보상 수치를 프로필에 직접 저장하지 않으므로 XP 곡선이나 보상표를 바꿔도 누적 XP에서 항상 재계산됩니다.

## 효과 타입

| 타입 | 데이터 | 적용 대상 |
| --- | --- | --- |
| `stat` | `stat`, `value` | 캐릭터 기본 HP, 공격, 속도, 방어, 스킬. 사용자 스탯 배율보다 먼저 적용 |
| `ability_tier` | `tier`, `gameText` | `BattleBall.progression.abilityTier`. 해당 Ability의 Lv.3/Lv.6/Lv.9 강화 설정 선택. `gameText`는 XP 결과·다음 보상·도감에 표시 |

`stat`과 `ability_tier`는 같은 레벨 보상 행의 `effects` 배열에 함께 존재할 수 있습니다. 따라서 Lv.3·Lv.6·Lv.9는 기본 스탯 보상과 대표 행동 강화를 한 번에 지급합니다.

## UI와 보고

XP 결과 패널과 도감은 캐릭터별 누적 XP에서 파생한 동일한 스냅샷을 사용합니다. 획득 보상은 해당 레벨의 모든 효과를 한 줄로 합쳐 보여 주고, 다음 보상은 선택한 캐릭터의 다음 레벨 행을 표시합니다. 행동 강화는 공통 tier 이름 대신 보상 행의 `gameText`를 표시합니다.

`BattleBall.progression`에는 현재 레벨, 누적 기본 스탯, 능력 tier, 적용 보상 ID가 남습니다. 전투 로그, 회귀 테스트, 향후 디버그 패널은 이 객체를 기준으로 보상 적용 여부를 확인합니다.
