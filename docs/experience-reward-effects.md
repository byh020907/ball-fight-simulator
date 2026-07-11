# 경험치 보상 효과 구조

## 목적

레벨 보상은 캐릭터의 기본 수치를 강화한다. 전투 수치는 반드시 `캐릭터 기본 수치 + 레벨 보상 → 사용자 스탯 배율 → 장비 고정 추가 수치` 순서로 만든다. 따라서 토너먼트와 사냥터는 같은 보상 적용 경로를 사용한다.

## 데이터와 적용 경로

1. `src/rewardBalanceConfig.js`의 `experience.levelRewards`가 보상 수치와 효과 타입의 단일 원본이다.
2. `experienceService`는 현재 레벨 구간의 보상 효과 목록만 파생한다.
3. `reward-effects/effectRegistry.js`의 `stat` 핸들러가 기본 스펙을 강화한 뒤, 사용자 스탯 배율과 장비 보너스를 순서대로 적용한다.
4. `BattleSimulation`은 Ball 생성과 Ability 바인딩을 마친 직후 `onBattleBallReady(ball, spec, simulation)` 훅을 호출한다.
5. `ability_modifier` 같은 런타임 효과 핸들러만 실제 Ball에 적용한다.

중앙 흐름에서 캐릭터 ID, 보상 ID, 스탯 이름을 조건문으로 분기하지 않는다. 새 보상은 효과 타입 핸들러와 밸런스 데이터만 추가한다.

## 현재 타입

| 타입 | 데이터 | 적용 대상 |
| --- | --- | --- |
| `stat` | `stat`, `value` | 캐릭터 기본 HP, 공격, 속도, 방어력, 스킬. 사용자 스탯의 퍼센트 배율 대상 |
| `ability_modifier` | `abilityId`, `modifierId`, `operation`, `value` | `BattleBall.levelRewardModifiers` |

`ability_modifier`는 대표 행동 강화의 확장 지점이다. Ability는 공통 `getLevelRewardModifier()`로 자신의 보정값을 읽으며, 새 행동 강화는 해당 Ability가 그 값을 소비하는 방식으로 구현한다.

## UI와 저장

저장 데이터는 캐릭터별 누적 XP뿐이다. 현재 레벨과 적용 보상은 매번 밸런스 테이블에서 파생한다. XP 결과 패널은 이번에 얻은 보상과 다음 보상을 구분해 보여 준다.
