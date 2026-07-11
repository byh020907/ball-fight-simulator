# 캐릭터 연계 시스템

> 상태: 설계 확정 전 초안, 구현 전
> 기준 코드: 2026-06-24 `main`
> 관련 문서: [`experience-system.md`](experience-system.md), [`meta-progression-system.md`](meta-progression-system.md), [`collection-achievements-system.md`](collection-achievements-system.md), [`player-data-storage-security.md`](player-data-storage-security.md), [`development-rules.md`](development-rules.md)

## 1. 시스템 정의

여러 캐릭터로 토너먼트 우승을 시도하도록 유도하는 계정 공용 수집 시스템입니다.

- 특정 캐릭터로 처음 우승하면 그 캐릭터의 **연계 효과(Character Link)** 를 해금합니다.
- 해금한 연계 효과는 이후 다른 캐릭터를 플레이할 때 자동으로 모두 적용됩니다.
- 연계 효과를 선택하거나 장착하는 과정은 없습니다.
- 효과를 제공한 원본 캐릭터 자신에게는 해당 효과가 적용되지 않습니다.
- 연계 효과는 스탯 증가 하나로 통일하지 않고 작은 스탯 보정, 배분 보너스, 전투 패시브, 액션 보정 등으로 다양화합니다.
- AI 캐릭터는 플레이어가 수집한 연계 효과를 사용하지 않습니다.

이 시스템은 한 캐릭터를 반복 강화하는 장치가 아닙니다. 여러 캐릭터로 우승한 경험이 다른 캐릭터를 시작할 때 작지만 누적되는 이점으로 돌아오는 수집형 성장 장치입니다.

한 캐릭터를 반복 플레이할 때의 즉각적인 레벨업 보상은 [`experience-system.md`](experience-system.md)의 경험치 시스템이 담당합니다.

효과를 선택하고 조합하는 빌드 시스템은 추후 장비 시스템의 책임으로 남겨둡니다.

## 2. 명칭

UI와 코드에서 다음 용어를 사용합니다.

| 용도 | 명칭 |
| --- | --- |
| 전체 기능 | 캐릭터 연계 |
| 캐릭터별 해금 보상 | 연계 효과 |
| 누적 상태 | 연계 수집도 |
| 해금 안내 | `{캐릭터명} 연계 효과 해금` |

코드에서는 `characterLinks`, `linkEffect`, `unlockedLinkIds`를 사용합니다. `slot`, `equip`, `loadout`은 장비 시스템과 혼동되므로 연계 도메인에서 사용하지 않습니다.

## 3. 사용자 흐름

1. 사용자의 대표 캐릭터가 현재 로스터에서 무작위로 정해집니다.
2. 현재까지 해금한 연계 효과 중 원본 캐릭터가 다른 효과를 모두 계산합니다.
3. 스탯 배분 팝업에서 적용 중인 연계 효과의 수와 요약을 보여줍니다.
4. 사용자가 토너먼트에서 우승하면 해당 캐릭터의 연계 효과를 처음 한 번 해금합니다.
5. 새 효과는 종료된 토너먼트에 소급 적용하지 않습니다.
6. 다음 토너먼트부터 다른 모든 캐릭터에 자동 적용합니다.

같은 캐릭터로 다시 우승해도 연계 효과를 중첩 지급하지 않습니다. 반복 우승은 도감 숙련도와 업적 진행에만 반영합니다.

### 3.1 다음 토너먼트의 대표 캐릭터

현재 `BattleApp`은 토너먼트 종료 뒤에도 결과를 확인한 다음 초기 설정 화면으로 복귀합니다. 다음 흐름을 유지합니다.

1. 토너먼트 종료 화면에서는 현재 결과를 그대로 유지합니다.
2. 사용자가 `확인`을 누르면 결과 UI와 완료된 대진표를 정리하고 초기 설정 화면으로 돌아갑니다.
3. 초기 화면에서 프리뷰 캐릭터를 직접 다시 선택합니다.
4. 사용자가 새 포인트를 모두 배분한 뒤에만 토너먼트를 시작합니다.

결과 화면의 `확인`과 실제 `토너먼트 시작`은 같은 동작이 아닙니다. 확인은 초기 설정으로만 복귀하며, 새 대진은 사용자가 캐릭터와 스탯을 준비한 뒤 시작합니다.

## 4. 자동 적용 규칙

```text
activeLinkEffects =
    unlockedLinkEffects
        .filter(effect => effect.sourceFighterId !== currentPlayerFighterId)
```

- 해금한 효과는 별도 선택 없이 모두 활성화합니다.
- 원본 캐릭터는 자신의 효과만 제외하고 다른 캐릭터에게서 얻은 효과는 모두 받습니다.
- 같은 ID는 한 번만 적용합니다.
- 토너먼트 시작 시 활성 효과 목록과 최종 modifier를 fighter spec에 고정합니다.
- 토너먼트 도중 새 효과가 해금되어도 현재 대진에는 소급 적용하지 않습니다.
- 현재 캐릭터에서 작동하지 않는 무효 효과를 설계하지 않습니다.
- 특정 능력 계열에만 적용되는 효과가 필요하면 모든 캐릭터에서 작동하는 기본 효과를 함께 제공해야 합니다.

## 5. 누적 밸런스 원칙

자동 누적 시스템에서는 개별 효과가 작아야 합니다.

### 5.1 전체 예산

현재 로스터 9명의 효과를 모두 수집했을 때의 권장 총량:

- 단순 전투 수치 환산 시 약 10% 이내
- 한 종류의 스탯에 몰리는 증가량은 3% 이내
- 추가 발사체, 추가 생명, 완전 방어처럼 결과를 크게 바꾸는 효과는 기본적으로 금지
- 전투 패시브는 매치당 횟수 제한 또는 긴 내부 쿨타임 사용
- 화면을 계속 채우는 파티클과 소환 개체는 최소화

각 효과의 목표 체감은 “없을 때보다 조금 유리함”이지 “캐릭터 능력 하나가 추가됨”이 아닙니다.

### 5.2 증가 방식

- 여러 효과가 같은 수치를 변경할 때는 가능한 한 **가산 modifier를 합산한 뒤 한 번 적용**합니다.
- 효과가 서로 곱해져 예상보다 커지는 복리 누적을 피합니다.
- 확률 효과는 확률을 합쳐 지나치게 자주 발동하지 않게 합니다.
- 피해에는 최소 피해 규칙이 있으므로 방어력 또는 피해 경감의 실제 체감을 별도로 검증합니다.
- 속도와 넉백은 충돌 물리에 영향을 주므로 작은 수치만 허용합니다.
- 쿨타임 감소는 파티클과 엔티티 생성량까지 늘리므로 총합 상한을 둡니다.

종류별 공통 상한 (v0.16.0 기준 상향):

```text
hpBonus                  <= 0.12  (12%)
damageBonus              <= 0.12  (12%)
outgoingImpactBonus      <= 0.10  (10%)
incomingKnockbackReduce  <= 0.15  (15%)
velocityRecoveryBonus    <= 0.10  (10%)
balanceToleranceBonus    <= 3
extraStatPoints          <= 10
actionCostReduction      <= 1.0%p
periodicCollisionBonus   <= 0.12  (12%)
```

상한은 연계 효과 정의가 아니라 공통 modifier 계산기가 소유합니다.

### 5.3 적용 순서

토너먼트 시작 시 한 번 계산합니다.

1. 프로필에서 등록된 연계 ID만 추출하고 중복을 제거합니다.
2. 현재 캐릭터가 원본인 효과를 제외합니다.
3. 메타 성장 보너스로 기본 스탯 배분 규칙을 계산합니다.
4. 연계의 `extraStatPoints`, `balanceToleranceBonus`를 더하고 공통 상한을 적용합니다.
5. 확정된 규칙으로 플레이어 스탯 배분을 fighter spec에 적용합니다.
6. 연계의 `hpBonus`, `damageBonus`를 배분 완료된 `stats.hp`, `stats.damage`에 가산 배율로 한 번 적용합니다.
7. 물리, 액션, runtime modifier를 fighter spec에 별도 필드로 복사합니다.

```text
finalHp = allocatedHp × (1 + clampedHpBonus)
finalDamage = allocatedDamage × (1 + clampedDamageBonus)
```

- 연계 스탯 배율에는 밸런스 배율을 다시 적용하지 않습니다.
- 연계 효과끼리 곱하지 않습니다.
- `radius`, `mass`, `speed`, `skill`의 최종 값을 직접 변경하지 않습니다.
- 현재 HP는 전투 시작 시 연계 적용 후 `maxHp`와 동일하게 시작합니다.

## 6. 효과 유형

```js
export const LINK_EFFECT_KINDS = Object.freeze({
    STAT_MODIFIER: "stat_modifier",
    ALLOCATION_MODIFIER: "allocation_modifier",
    PHYSICS_MODIFIER: "physics_modifier",
    COMBAT_PASSIVE: "combat_passive",
    ACTION_MODIFIER: "action_modifier"
});
```

### 6.1 스탯 보정

모든 캐릭터에서 확실히 작동하는 작은 수치 보정입니다.

예시 (v0.16.0 기준 GOLD 등급):

- 최대 체력 +12%
- 공격력 +12%
- 방어력 +0.2

연계 효과의 스탯 보정은 스탯 배분 후 별도 modifier로 합산합니다.

### 6.2 배분 규칙 보정

토너먼트 시작 전 스탯 배분 규칙에 작은 보너스를 줍니다.

예시 (v0.16.0 기준 GOLD 등급):

- 총 배분 포인트 +10
- 빌드 유연성 +3

메타 성장 보너스와 같은 규칙 계산기를 사용하되 출처를 분리해 UI에서 각각 표시합니다.

### 6.3 물리 보정

충돌과 기본 속도 복귀에 영향을 주는 작은 modifier입니다.

예시 (v0.16.0 기준 GOLD 등급):

- 받은 명시적 넉백 크기 15% 감소
- 볼 충돌 시 상대에게 가하는 충격량 10% 증가
- 충돌 후 기본 속도 복귀율 10% 증가

정확한 적용 지점:

- `incomingKnockbackReduce`: `BattleBall.applyKnockback()`이 전달받은 impulse에만 적용합니다. 대시, 회피, Rush처럼 자신이 만든 이동 impulse에는 적용하지 않습니다.
- `outgoingImpactBonus`: `BattleSimulation._applyCollisionPhysics()`에서 공격자 측 `impact`에 가산합니다. 투사체 피해와 충돌 피해량은 바꾸지 않습니다.
- `velocityRecoveryBonus`: `BattleBall.update()`의 `BASE_VELOCITY_CORRECTION_RATE`에 가산 비율로 적용합니다. `velocity`를 직접 대입하지 않습니다.

### 6.4 독립 전투 패시브

모든 캐릭터에서 작동하는 횟수 제한 효과입니다.

예시 (v0.16.0 기준 GOLD 등급):

- 매치당 1회, HP가 20% 이하가 되면 0.2초간 피해 10% 경감
- 첫 벽 충돌 후 0.5초 동안 기본 속도 3% 증가
- 12초마다 다음 충돌 피해 12% 증가

runtime effect가 자신의 타이머, 발동 횟수, 만료 조건을 직접 소유합니다.

### 6.5 클릭 액션 보정

어떤 액션을 선택해도 의미가 있는 작은 공통 보정입니다.

예시 (v0.16.0 기준 GOLD 등급):

- 액션 HP 비용 1.0%p 감소 (최저 0.1%)

```text
effectiveHpCostPercent =
    max(0.1, action.hpCostPercent - clampedActionCostReduction)
```

액션별 수치를 중앙에서 직접 변경하지 않고 `_tryFireAction()`이 공통 action modifier 결과를 사용합니다.

## 7. 초기 캐릭터별 효과 정의

모든 효과는 원본 캐릭터를 제외한 모든 캐릭터에서 작동해야 합니다. 아래 값은 1차 구현의 기본값으로 사용하고 이후 밸런스 패치에서 조정합니다.

| 해금 캐릭터 | 연계 효과 | 유형 | 자동 누적 효과 |
| --- | --- | --- | --- |
| Archer Ball | 정밀 훈련 | 스탯 | 배분 완료 후 공격력 +1% |
| Orbit Ball | 균형 감각 | 물리 | `applyKnockback()`으로 받는 명시적 넉백 2% 감소 |
| Trickster Ball | 유연한 선택 | 배분 | 스탯 밸런서 `SENSITIVITY` +0.5 |
| Grenade Ball | 충격 훈련 | 물리 | 볼 충돌 시 상대에게 가하는 물리 impulse 1% 증가 |
| Dash Ball | 가속 적응 | 물리 | 기본 속도 복귀율 2% 증가 |
| Rage Ball | 전투 고조 | 전투 패시브 | 12초 충전 후 다음 볼 충돌의 가하는 피해 +2% |
| Eater Ball | 생존 훈련 | 스탯 | 배분 완료 후 최대 체력 +1% |
| Bat Ball | 행동 절약 | 액션 | 모든 클릭 액션 HP 비용 0.1%p 감소 |
| Hero Ball | 성장 경험 | 배분 | 총 배분 포인트 +1 |

전체를 모아도 본체 능력 하나보다 영향이 작아야 합니다.

`전투 고조` 세부 규칙:

- 매치 시작 시 충전 시간은 0초입니다.
- 살아 있는 동안 실제 전투 delta로 12초를 충전합니다.
- 충전 완료 후 다음 `BattleSimulation` 볼 충돌에서 소유자가 상대에게 가하는 충돌 피해가 1.02배가 됩니다.
- 실제 outgoing collision damage가 0보다 클 때만 소비합니다.
- 소비 후 충전 시간을 0초로 초기화합니다.
- 투사체, Wall Slam, 클릭 액션 반사 피해에는 적용하지 않습니다.
- 오버타임과 Ability 피해 배율이 계산된 뒤, ActionContext의 카운터 판정 전에 적용합니다.

## 8. 정의 구조

```js
export const CHARACTER_LINK_DEFINITIONS = Object.freeze([
    {
        id: "archer_precision_training",
        sourceFighterId: "archer",
        name: "정밀 훈련",
        description: "다른 캐릭터의 공격력이 1% 증가합니다.",
        kind: LINK_EFFECT_KINDS.STAT_MODIFIER,
        createModifier() {
            return { damageBonus: 0.01 };
        }
    }
]);
```

- 정의는 표시 정보와 자신의 modifier 또는 runtime effect 생성 책임을 가집니다.
- `sourceFighterId`가 현재 캐릭터와 같으면 공통 계산기가 제외합니다.
- 효과 ID별 계산을 중앙 `switch` 문에 쌓지 않습니다.
- 모든 정의는 어떤 캐릭터에서도 적용 가능한 결과를 반환해야 합니다.

## 9. 프로젝트 구조

```text
src/
  player-profile.js
  character-links/
    link-definitions.js
    link-state.js
    link-modifiers.js
    link-runtime-effects.js
```

| 파일 | 책임 |
| --- | --- |
| `src/player-profile.js` | 해금 ID 저장과 스키마 마이그레이션 |
| `src/character-links/link-definitions.js` | 연계 효과 정적 정보와 생성자 등록 |
| `src/character-links/link-state.js` | 해금, 중복 제거, 현재 캐릭터의 자동 활성 효과 계산 |
| `src/character-links/link-modifiers.js` | 스탯, 배분, 물리, 액션 modifier 합산과 상한 적용 |
| `src/character-links/link-runtime-effects.js` | 횟수 제한 전투 패시브의 이벤트 로직 |
| `src/app.js` | 프로필, UI, 토너먼트 흐름 연결 |
| `src/stat-allocation.js` | 전달받은 배분 규칙으로 계산 |
| `src/simulation/BattleSimulation.js` | runtime effect에 전투 이벤트 전달 |

## 10. 플레이어 프로필

```js
{
    characterLinks: {
        unlockedIds: []
    }
}
```

- 장착 목록은 저장하지 않습니다.
- 알 수 없는 ID는 로드 시 무시합니다.
- 중복 ID는 하나만 남깁니다.
- 현재 캐릭터의 원본 효과 제외는 저장 단계가 아니라 활성 효과 계산 단계에서 처리합니다.
- 저장 방식과 보안 경계는 [`player-data-storage-security.md`](player-data-storage-security.md)를 따릅니다.

## 11. 런타임 전달 흐름

```text
player-profile.js
  -> link-state.js가 현재 캐릭터의 자동 활성 효과 계산
  -> link-modifiers.js가 모든 modifier를 합산하고 상한 적용
  -> 배분 modifier를 스탯 설정 UI에 반영
  -> fighter spec에 전투 modifier와 runtime effect ID 복사
  -> BattleSimulation이 runtime effect 생성
```

- `BattleBall`은 해금 목록이나 프로필 전체를 보관하지 않습니다.
- `BattleSimulation`은 해금 조건을 판단하지 않습니다.
- 미리보기는 전투 패시브를 실행하지 않되 스탯과 외형에 영향을 주는 최종 modifier는 실제 전투와 동일하게 표시합니다.

## 12. 해금 처리

```js
const result = unlockCharacterLink(profile, tournamentReport.playerFighterId);
```

```js
{
    unlocked: true,
    linkId: "archer_precision_training"
}
```

`unlockCharacterLink()`가 캐릭터별 정의 조회, 중복 확인, 상태 변경을 소유합니다. 새 효과는 다음 토너먼트부터 자동 활성 대상이 됩니다.

## 13. UI

상세 목록은 [`collection-hub-ui.md`](collection-hub-ui.md)의 `연계` 탭에서 표시합니다.

스탯 배분 팝업에는 선택 컨트롤을 추가하지 않습니다.

- `연계 효과 5개 적용 중` 요약
- 스탯과 배분 규칙에 반영된 총 modifier
- 현재 캐릭터 자신의 효과는 제외됐다는 안내
- 상세 보기 버튼

도감의 캐릭터 카드에는 다음을 표시합니다.

- 연계 효과 이름과 구체적인 수치
- 해금 여부
- 해금 조건
- 현재 대표 캐릭터에서 적용 중인지 여부

효과를 끄거나 장착하는 UI는 만들지 않습니다. 향후 장비 시스템과 섞이지 않게 합니다.

## 14. 구현 단계

1. 공용 플레이어 프로필과 저장 모듈 구현
2. 연계 효과 정의와 자동 활성 계산 구현
3. modifier 합산 순서와 종류별 상한 구현
4. 스탯 및 배분 규칙 modifier 구현
5. 물리 modifier 인터페이스 구현
6. runtime effect 컨테이너와 전투 이벤트 전달 구현
7. 클릭 액션 modifier 인터페이스 구현
8. 캐릭터별 연계 효과를 하나씩 구현하고 누적 회귀 테스트
9. 토너먼트 우승 해금 연결
10. 스탯 배분 팝업과 도감에 연계 요약 추가
11. `docs/game-rules.md`, `src/helpContent.js`, `src/patchNotes.js` 갱신

## 15. 필수 회귀 조건

- 해금한 연계 효과는 별도 선택 없이 모두 적용되어야 합니다.
- 원본 캐릭터는 자신의 효과만 제외하고 다른 해금 효과는 모두 받아야 합니다.
- 등록되지 않은 연계 ID는 저장 데이터에 있어도 적용되지 않아야 합니다.
- 서버 없는 localStorage에서는 등록된 ID의 정상 해금과 사용자 수동 추가를 구분할 수 없음을 테스트와 UI에서 보안 기능처럼 표현하지 않아야 합니다.
- 같은 효과가 중복 저장되어도 한 번만 적용되어야 합니다.
- 어떤 캐릭터에서도 무효가 되는 연계 효과가 없어야 합니다.
- 모든 효과를 수집해도 종류별 공통 상한을 넘어서는 안 됩니다.
- 연계 효과가 없는 사용자는 현재 전투와 동일하게 동작해야 합니다.
- AI 캐릭터에는 플레이어 연계 효과가 적용되지 않아야 합니다.
- 한 캐릭터의 재우승으로 해금과 알림이 중복되지 않아야 합니다.
- 토너먼트 중 새로 해금한 효과가 현재 대진에 소급 적용되지 않아야 합니다.
- runtime effect는 자신의 타이머와 발동 횟수를 소유해야 합니다.

## 16. 장비 시스템과의 경계

향후 장비 시스템은 다음 책임을 가집니다.

- 제한된 슬롯
- 장착 및 해제
- 빌드 선택과 상호 배타 효과
- 강한 능력 변화
- 희귀도와 파밍

캐릭터 연계 시스템은 다음 책임만 유지합니다.

- 캐릭터별 최초 우승 수집
- 해금 효과 자동 누적
- 작고 영구적인 계정 공용 보너스
- 다른 캐릭터 플레이 유도
