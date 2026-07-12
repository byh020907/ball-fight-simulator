# 캐릭터 숙련도 시스템

> 상태: 구현 완료. 수치 원본은 `src/rewardBalanceConfig.js`의 `progression.masteryTiers`가 단독 소유한다. 상한은 삭제하여 동일 키에 대해 단순 가산 방식으로 동작한다.
> 관련 문서: [progression-responsibilities.md](progression-responsibilities.md), [reward-balance.md](reward-balance.md), [experience-system.md](experience-system.md), [development-rules.md](development-rules.md)

## 1. 역할

숙련도는 캐릭터 수집을 유도하는 계정 공용 교차 지원 효과다.

- 캐릭터 A를 육성하고 관문 토너먼트에서 우승하면 A의 숙련도가 오른다.
- A의 숙련도 효과는 A 자신을 제외한 다른 캐릭터에 자동 적용된다.
- 장착, 해제, 선택 UI는 없다.
- AI에는 플레이어 프로필의 숙련도가 적용되지 않는다.
- 캐릭터 자신의 기본 수치와 대표 행동 강화는 경험치 레벨의 책임이다.

## 2. 상태와 승급

프로필은 숙련도를 직접 저장한다.

```js
{
    characterMastery: {
        levels: {
            archer: 2
        }
    }
}
```

`levels[id]`는 `0~3` 정수다. 우승 횟수에서 다시 계산하는 파생값이 아니다.

| 현재 단계 | 승급에 필요한 관문 우승 | 승급 결과 |
| --- | --- | --- |
| 미해금 | 난도 0 | BRONZE (1) |
| BRONZE | 난도 1 | SILVER (2) |
| SILVER | 난도 2 | GOLD (3) |
| GOLD | 없음 | 최대 단계 |

`advanceCharacterMastery()`가 이 규칙과 상태 변경을 소유한다. 도감 UI, 숙련도 합계, `도감 완성` 업적은 모두 이 저장된 단계를 조회한다.

## 3. 적용 순서

숙련도의 스탯형 보정은 다른 모든 스탯 계산이 끝난 뒤 한 번만 퍼센트로 적용한다.

```text
캐릭터 기본 수치 + 레벨 보상
  -> 스탯 배분 퍼센트 배율
  -> 장비 고정 추가 수치
  -> 숙련도 교차 지원 퍼센트
```

`applyMasteryEffectsToFighterSpec()`가 마지막 단계를 소유한다. 같은 종류의 숙련도는 먼저 가산한 뒤 한 번만 곱한다. 상한이 없으므로 여러 캐릭터가 같은 효과를 중첩하면 제한 없이 누적된다. 장비의 고정 수치를 스탯 배분과 숙련도로 다시 혼합하지 않는다.

충돌 관련 보정도 최종 단계에 적용한다.

1. 장비의 충돌 피해 보정
2. 공격자 숙련도의 충돌 피해 증가 (outgoingCollisionDamageBonus)
3. 액션의 방어 또는 반사 처리
4. 대상 숙련도의 충돌 피해 감소
5. 방어력과 실제 HP 감소

속도 복귀율, 스킬 쿨다운, 주기형 충돌 패시브는 해당 런타임 계산기의 최종 보정으로 전달한다.

## 4. 등급별 수치

모든 수치는 퍼센트다. 액션 HP 비용의 `%p`는 원래 비용 비율에서 빼는 퍼센트포인트다.

| 원본 캐릭터 | 효과 | BRONZE | SILVER | GOLD |
| --- | --- | ---: | ---: | ---: |
| Archer Ball | 다른 캐릭터 공격력 | 2% | 4% | 6% |
| Orbit Ball | 벽 충돌 반사 속도 | 5% | 10% | 15% |
| Trickster Ball | 기본 속도 복귀율 | 3% | 6% | 10% |
| Grenade Ball | 가하는 충돌 피해 | 2% | 4% | 6% |
| Dash Ball | 이동 속도 | 2% | 4% | 6% |
| Rage Ball | 12초마다 다음 충돌 피해 | 3% | 6% | 9% |
| Eater Ball | 최대 체력 | 2% | 4% | 6% |
| Bat Ball | 클릭 액션 HP 비용 감소 | 0.03%p | 0.06%p | 0.10%p |
| Hero Ball | 스킬 쿨다운 감소 | 2% | 4% | 6% |
| Vampire Ball | 4초마다 다음 충돌 피해 회복 (결손 HP 비례 1~2배) | 3% | 6% | 9% |
| Gunner Ball | 질량 증가 | 2% | 4% | 6% |
| Phantom Ball | 받는 충돌 피해 감소 | 2% | 4% | 6% |

## 5. 향상된 물리 효과

Orbit의 숙련도 효과는 일반 스탯이 아닌 전투 물리 길목에서 직접 적용된다. Dash의 추진력과 Gunner의 중량 장전은 일반 스탯 최종 multiplier로, 다른 statModifiers 계열 숙련도와 함께 처리된다.

- Orbit의 **반사 궤도**는 `applyWallBounceBoost`에서 장비의 반향 배율과 곱으로 결합된다. 즉, 장비 반향 +15%와 Orbit GOLD +15%는 `1.15 * 1.15`로 함께 적용된다.
- Dash의 **추진력**은 이동 속도(speed) stat modifier로, 다른 statModifiers 계열 숙련도와 함께 최종 퍼센트로 적용된다.
- Gunner의 **중량 장전**은 질량(mass) stat modifier로, `applyMasteryEffectsToFighterSpec`에서 spec stats에 퍼센트 보정되고, BattleBall 생성 시 장비 중량의 massMultiplier와 곱으로 결합된다. 즉, Gunner GOLD +6%와 장비 중량 +15%는 최종 질량이 `baseMass * 1.06 * 1.15`가 된다.

분노와 갈증은 각각 하나의 원본만 제공하는 독립 주기 패시브다. 피해가 0이거나 HP가 가득 찬 경우에는 준비 상태를 소비하지 않는다.

## 6. 런타임 패시브

정의는 단순 ID 분기 대신 자신의 충돌 훅을 직접 만든다.

- Rage의 `onBeforeFighterCollisionDamage`는 준비된 다음 충돌 피해를 높이고 성공 시에만 소비한다.
- Vampire의 `onAfterFighterCollisionDamage`는 4초마다 준비된다. `실제 충돌 피해 × 등급 흡혈률 × (1 + 결손 HP 비율)`을 회복하며, 결손 HP 비율 배율은 1배에서 2배 사이로 제한한다. 실제 회복이 발생한 경우에만 소비한다.
- `BattleBall`은 효과의 준비 시간과 활성 상태만 보관한다.
- `BattleSimulation`은 충돌 전후 훅을 순서대로 호출할 뿐 캐릭터 ID나 효과 ID를 분기하지 않는다.

새 주기형 숙련도는 정의에 같은 훅을 추가하면 된다. 중앙 `switch`나 캐릭터별 예외 분기를 만들지 않는다.

## 7. 코드 경계

| 파일 | 책임 |
| --- | --- |
| `src/rewardBalanceConfig.js` | 등급 수치 (상한 없음) |
| `src/character-mastery/masteryDefinitions.js` | 표시 정보와 효과별 적용/런타임 훅 |
| `src/character-mastery/masteryState.js` | 단계 조회와 관문 승급 |
| `src/character-mastery/masteryModifiers.js` | 교차 효과 합산, fighter spec 적용 |
| `src/entities/battleBall.js` | 런타임 패시브 준비 상태, 물리 보정 적용 |
| `src/simulation/battleSimulation.js` | 충돌 전후 훅과 최종 충돌 피해 보정 전달, 각충격 배율 |
| `src/hunting/huntingManager.js` | 사냥터 플레이어 스펙에 숙련도 최종 보정 적용 |
| `src/collection/collectionViewModel.js` | 저장된 숙련도 단계의 도감 표시 |

## 8. 검증 기준

- 원본 캐릭터 자신에게는 자신의 효과가 적용되지 않는다.
- 숙련도 퍼센트는 장비 고정 수치까지 합친 뒤 적용된다.
- 도감, 숙련도 탭, `도감 완성` 업적은 같은 `characterMastery.levels`를 기준으로 한다.
- 주기형 효과는 실제 적대 전투원 충돌에서만 소비된다.
- Orbit의 반사 궤도는 장비 반향과 곱으로 결합된다. Gunner의 중량 장전은 장비 중량과 곱으로 결합하며, Dash의 추진력은 다른 스탯 계열 숙련도와 함께 최종 퍼센트로 적용된다.
- 표준 무능력 볼 기준 GOLD 단일 효과의 승률 변화는 대체로 `+3~5%p` 범위이며, 속도 복귀와 쿨다운은 별도의 조작감·능력 회전율 보정으로 검증한다.
