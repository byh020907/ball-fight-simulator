# 메타 성장 및 도전 단계 시스템

> 상태: 설계 확정 전 초안 — 업적 시스템(v0.12.0) 구현 완료, 보상 지급 구현 완료
> 기준 코드: 2026-06-24 `main`
> 관련 문서: [`character-link-system.md`](character-link-system.md), [`collection-achievements-system.md`](collection-achievements-system.md), [`player-data-storage-security.md`](player-data-storage-security.md), [`development-rules.md`](development-rules.md), [`game-rules.md`](game-rules.md)

## 1. 시스템 정의

토너먼트를 반복할수록 플레이어에게는 제한된 영구 성장 보상을 제공하고, 더 높은 난이도의 **도전 단계(Challenge Level)** 를 차례로 해금합니다.

- 영구 성장 보너스에는 명확한 최대치가 있습니다.
- 도전 단계는 계속 확장할 수 있습니다.
- 플레이어는 해금한 단계 중 하나를 선택해 토너먼트를 시작합니다.
- 현재 최고 단계에서 우승하면 다음 단계를 해금하고 자동으로 선택합니다.
- 낮은 단계를 다시 우승해도 이미 해금한 단계를 중복 해금하지 않습니다.
- 패배해도 해금한 최고 단계는 내려가지 않습니다.

`Rank`는 경쟁 순위나 등급 평가로 오해할 수 있으므로 UI와 코드에서 사용하지 않습니다. 이 시스템은 플레이어가 선택하는 PvE 난이도이므로 `Challenge Level`, 한국어로 `도전 단계`를 사용합니다.

## 2. 설계 원칙

### 2.1 성장은 유한하게

영구 보상은 스탯 배분의 선택 폭을 넓히지만 계속 누적되어 전투를 무력화하지 않게 합니다.

### 2.2 난이도는 계속 확장 가능하게

AI의 스탯 포인트만 무한히 늘리는 방식은 사용할 수 없습니다. 현재 배분 가능 스탯은 5개이고 기본 스탯별 한도는 50이므로 총 250점을 넘으면 `createRandomStatAllocation()`이 더 이상 배분 가능한 스탯을 찾지 못합니다.

따라서 도전 난이도는 두 구간으로 구성합니다.

1. 초반에는 AI 포인트와 빌드 품질이 증가합니다.
2. 포인트 증가가 상한에 도달한 뒤에도 AI 전력 배율이 계속 증가합니다.

### 2.3 물리 안정성을 유지하게

도전 단계 전력 배율은 체력, 공격력, 방어력에만 적용합니다.

- `speed`를 무한히 올리면 충돌 횟수와 물리 안정성이 함께 변합니다.
- `skill`을 무한히 올리면 쿨타임이 지나치게 짧아져 파티클과 엔티티 생성량까지 증가합니다.
- 속도와 쿨타임 난이도는 AI 포인트 배분 구간에서만 증가시킵니다.

## 3. 기존 스탯 시스템 유지

현재의 분산 기반 밸런스 배율은 유지합니다.

```text
multiplier = BASE_MULTIPLIER
           + MAX_BONUS * sensitivity / (sensitivity + standardDeviation)
```

- 고르게 배분할수록 표준편차가 낮아져 높은 배율을 받습니다.
- `SENSITIVITY`가 높아질수록 편중 배분의 손실이 줄어듭니다.
- `skill`만 `100 / (100 + skill)` 쿨타임 공식을 사용합니다.
- `hp`, `damage`, `speed`, `defense`는 포인트당 1% 선형 증가 후 밸런스 배율을 적용합니다.
- `defense`의 실제 피해 처리는 비율 감소가 아니라 방어력만큼 빼는 감산 방식입니다.

현재 [`src/stat-allocation.js`](../src/stat-allocation.js)의 방어력 설명은 실제 구현과 다릅니다.

```js
// 현재 잘못된 설명
"받는 피해가 100/(100+스탯) 비율로 감소합니다."

// 구현과 맞는 설명
"종족값 방어력을 포인트당 1% 올립니다."
```

이 문구 수정은 메타 성장 구현 전 별도 버그 수정으로 처리합니다.

## 4. 영구 성장 보너스

코드와 UI에서 `보상 종류`보다 **성장 보너스(Progression Bonus)** 라는 이름을 사용합니다.

| UI 이름 | 코드 키 | 기본값 변화 | 누적 상한 |
| --- | --- | --- | --- |
| 추가 배분 포인트 | `extraStatPoints` | 총 포인트 100 → 최대 120 | +20 |
| 빌드 유연성 | `balanceTolerance` | `SENSITIVITY` 20 → 최대 30 | +10 |
| 집중 투자 한도 | `perStatCapBonus` | 스탯별 한도 50 → 최대 100 | +50 |

`sensitivityBonus`는 구현 세부사항이 노출된 이름이므로 사용하지 않습니다. 플레이어가 얻는 효과를 나타내는 `balanceTolerance`를 사용합니다.

### 4.1 적용 규칙

- 성장 보너스는 플레이어 스탯 배분에만 적용합니다.
- AI 스탯 규칙과 성장 보너스를 공유하지 않습니다.
- 각 값은 저장 데이터가 잘못되어 있어도 정의된 상한으로 보정합니다.
- 총 포인트가 늘어나면 남은 포인트 계산, 자동 배분, 초기화, 시작 버튼 상태가 모두 같은 규칙 객체를 사용해야 합니다.
- 집중 투자 한도는 총 포인트보다 클 수 있지만 실제 배분은 남은 총 포인트를 넘을 수 없습니다.

### 4.2 획득 경로

업적을 해금하면 `src/progression/progression-state.js`의 `applyProgressionBonus()`를 통해 성장 보너스가 자동 적용됩니다.
`src/collection/achievement-definitions.js`의 각 업적 정의에 `reward` 필드로 보상이 명시되어 있습니다.

| 업적 | 등급 | 보상 |
| --- | --- | --- |
| 첫 우승 | bronze | 추가 배분 포인트 +5 |
| 만능 플레이어 | bronze | 추가 배분 포인트 +10 |
| 끈기 | bronze | 추가 배분 포인트 +15 |
| 대역전 | silver | 빌드 유연성 +5 |
| 반격 전문가 | silver | 빌드 유연성 +5 |
| 연승 | silver | 추가 배분 포인트 +10 |
| 무결점 우승 | gold | 집중 투자 한도 +15 |
| 전캐릭터 우승 | gold | 집중 투자 한도 +15 |
| 도감 완성 | gold | 집중 투자 한도 +20 |

**총 누적**: 추가 배분 포인트 +40 (상한 40), 빌드 유연성 +10 (상한 10), 집중 투자 한도 +50 (상한 50)

보상 출처와 관계없이 실제 누적, 상한 보정, 중복 지급 방지는 `src/progression/progression-state.js`의 `applyProgressionBonus()`가 소유합니다.

## 5. 도전 단계

### 5.1 프로필 상태

```js
challenge: {
    highestUnlockedLevel: 0,
    selectedLevel: 0
}
```

- 0단계는 현재 기본 난이도입니다.
- `selectedLevel`은 `0..highestUnlockedLevel` 범위로 보정합니다.
- 최고 해금 단계에서 플레이어가 우승하면 `highestUnlockedLevel + 1`을 해금합니다.
- 새 단계 해금 시 `selectedLevel`도 새 단계로 올립니다.
- 낮은 단계 우승은 해금 상태를 변경하지 않습니다.
- AI 캐릭터가 우승한 경우에도 도전 단계는 변경되지 않습니다.

### 5.2 난이도 구성

초기 수치는 밸런스 테스트 전 기본안입니다.

```js
export const CHALLENGE_CONFIG = Object.freeze({
    RIVAL_POINT_STEP: 4,
    RIVAL_POINT_BONUS_CAP: 100,
    BALANCED_BUILD_START_LEVEL: 5,
    MAX_BALANCED_BUILD_WEIGHT: 0.8,
    COMBAT_POWER_PER_LEVEL: 0.025
});
```

#### AI 포인트

```text
AI 총 포인트 =
    100 + min(도전 단계 × 4, 100)
```

- 최대 200점까지만 증가합니다.
- AI 스탯별 한도는 AI 총 포인트를 정상 배분할 수 있도록 별도 규칙으로 계산합니다.
- 포인트 생성 함수는 배분 가능 총용량보다 큰 값을 받으면 명시적인 오류를 내거나 총용량으로 보정해야 합니다.
- 빈 `available` 배열을 인덱싱하는 현재 방식은 그대로 두지 않습니다.

#### AI 빌드 품질

5단계부터 완전 무작위 배분과 균등 중심 배분을 섞습니다.

```text
balancedWeight =
    clamp((도전 단계 - 4) × 0.1, 0, 0.8)
```

- 가중치 0이면 현재와 같은 무작위 배분입니다.
- 가중치가 높을수록 각 스탯의 목표값이 평균에 가까워집니다.
- 완전 균등으로 고정하지 않고 작은 무작위 편차를 남겨 AI 빌드가 매번 같아지지 않게 합니다.
- 분배 알고리즘은 도전 단계 모듈이 소유하고 `stat-allocation.js`의 범용 배분 함수를 사용합니다.

#### AI 전력 배율

```text
challengePowerMultiplier = 1 + 도전 단계 × 0.025
```

- AI의 최종 `hp`, `damage`, `defense`에 적용합니다.
- `speed`, `skill`, `radius`, `mass`에는 적용하지 않습니다.
- 별도 상한은 두지 않습니다.
- 화면에는 세부 배율 대신 선택한 도전 단계만 표시합니다.

## 6. 프로젝트 구조

캐릭터 연계 시스템과 같은 영구 프로필을 공유합니다.

```text
src/
  player-profile.js
  progression/
    progression-config.js
    progression-state.js
    challenge-rules.js
```

| 파일 | 책임 |
| --- | --- |
| `src/player-profile.js` | localStorage 입출력, 버전 관리, 손상 데이터 복구 |
| `src/progression/progression-config.js` | 성장 보너스 상한과 도전 단계 기본 설정 (미구현) |
| `src/progression/progression-state.js` | 성장 보너스 지급, 상한 보정, 단계 해금 상태 변경 (보상 적용만 구현) |
| `src/progression/challenge-rules.js` | 선택 단계로 AI 스탯 규칙, 배분 전략, 전력 배율 계산 |
| `src/stat-allocation.js` | 전달받은 규칙으로 배분, 검증, 배율 계산, fighter spec 생성 |
| `src/app.js` | 프로필, UI, 토너먼트 흐름 연결 |
| `src/ui.js` | Alpine 상태에 성장 요약과 도전 단계 선택 상태 반영 |
| `src/tournament.js` | 대진 진행만 담당하며 메타 성장 상태를 알지 않음 |

`BattleApp`, `TournamentManager`, `BattleBall`이 도전 단계 공식이나 성장 보너스 상한을 직접 계산하지 않습니다.

## 7. 플레이어 프로필

캐릭터 연계 문서의 프로필과 하나로 합칩니다.

```js
// localStorage key: bfs:player-profile:v1
{
    version: 1,
    characterLinks: {
        unlockedIds: []
    },
    progression: {
        bonuses: {
            extraStatPoints: 0,
            balanceTolerance: 0,
            perStatCapBonus: 0
        },
        challenge: {
            highestUnlockedLevel: 0,
            selectedLevel: 0
        }
    },
    collection: {
        characters: {},
        achievements: {},
        careerStats: {
            playerMatchesCompleted: 0,
            playerTournamentsCompleted: 0,
            currentTournamentWinStreak: 0,
            bestTournamentWinStreak: 0,
            usedActionIds: [],
            actionSuccessCounts: {},
            processedTournamentReportIds: []
        }
    }
}
```

수집 기록과 업적 필드의 상세 규칙은 [`collection-achievements-system.md`](collection-achievements-system.md)를 따릅니다. 사용하지 않는 통계는 미리 추가하지 않고 실제 업적 조건에 필요한 값만 저장합니다.

## 8. 스탯 규칙 객체

현재 `stat-allocation.js`는 총 포인트와 스탯별 한도를 모듈 상수에서 직접 읽습니다. 플레이어와 AI가 서로 다른 규칙을 사용하려면 모든 관련 함수가 같은 규칙 객체를 받도록 변경합니다.

```js
export const DEFAULT_STAT_RULES = Object.freeze({
    totalPoints: 100,
    maxPointsPerStat: 100,
    sensitivity: 20
});
```

```js
calculateStatMultiplier(points, rules = DEFAULT_STAT_RULES);
getRemainingStatPoints(allocation, rules = DEFAULT_STAT_RULES);
adjustStatAllocation(allocation, statKey, delta, rules = DEFAULT_STAT_RULES);
createRandomStatAllocation(rng, rules = DEFAULT_STAT_RULES);
applyStatAllocation(fighter, allocation, options = {});
```

`options` 예시:

```js
{
    isPlayer: false,
    statRules: rivalStatRules,
    combatPowerMultiplier: 1.15
}
```

### 필수 검증

```js
validateStatRules(rules);
validateStatAllocation(allocation, rules);
```

- 총 포인트와 스탯별 한도는 0 이상의 유한한 숫자여야 합니다.
- 배분 합계는 `totalPoints`를 넘을 수 없습니다.
- 개별 스탯은 `maxPointsPerStat`을 넘을 수 없습니다.
- `totalPoints`는 `maxPointsPerStat × 스탯 개수`보다 클 수 없습니다.
- 잘못된 프로필 값은 UI에 전달하기 전에 보정합니다.

## 9. 토너먼트 생성 흐름

```text
player-profile.js
  -> progression-state.js가 프로필 보정
  -> BattleApp가 playerStatRules 계산
  -> challenge-rules.js가 rivalStatRules와 전력 배율 계산
  -> createTournamentRoster()에 두 규칙 전달
  -> 플레이어와 AI fighter spec을 각각 생성
  -> TournamentManager는 완성된 roster로 대진만 생성
```

권장 시그니처:

```js
createTournamentRoster(roster, {
    playerId,
    playerAllocation,
    playerStatRules,
    challengeLevel,
    rng,
    size: 8
});
```

인자가 계속 늘어나는 위치이므로 기존 위치 기반 인자보다 옵션 객체가 적합합니다.

도전 단계와 성장 설정은 토너먼트 시작 시 한 번 계산해 fighter spec에 고정합니다. 토너먼트 진행 중 프로필이 바뀌어도 현재 대진에는 소급 적용하지 않습니다.

## 10. 우승 처리

도전 단계 해금은 개별 경기 종료인 `BattleApp.finishMatch()`가 아니라 플레이어 우승이 확정되는 `BattleApp.showTournamentChampion()` 흐름에서 처리합니다.

```js
const result = completeChallengeTournament(profile, {
    selectedLevel,
    playerWon
});
```

반환 예시:

```js
{
    unlocked: true,
    previousLevel: 4,
    unlockedLevel: 5
}
```

`completeChallengeTournament()`가 해금 조건과 상태 변경을 소유합니다. `BattleApp`은 프로필 저장과 UI 표시만 연결합니다.

캐릭터 연계 효과 해금과 도전 단계 해금은 같은 우승 이벤트에서 각각의 도메인 함수로 처리하되, 한 함수가 다른 시스템의 내부 데이터를 직접 변경하지 않습니다.

## 11. UI

전체 누적 기록과 향후 도전 기록은 [`collection-hub-ui.md`](collection-hub-ui.md)의 확장 탭을 사용합니다. 실제 도전 단계 선택은 스탯 배분 팝업에 유지합니다.

### 스탯 배분 팝업

- 현재 선택 단계: `도전 단계 3`
- 선택 컨트롤: `-`, 현재 단계, `+`
- 해금 범위 밖의 단계는 선택할 수 없습니다.
- 성장 보너스 요약: `배분 +10 · 유연성 +5 · 집중 한도 +10`
- 실제 총 포인트와 스탯별 한도를 함께 반영합니다.
- 좁은 모바일 화면에서는 전투 화면 확보 원칙을 유지하고 설정 팝업 내부에서 스크롤합니다.

### 결과 화면

최고 단계 우승:

```text
도전 단계 4 클리어
새로운 도전 단계 5 해금
```

기존 단계 재클리어:

```text
도전 단계 3 클리어
최고 해금 단계 5
```

패배:

```text
도전 단계 5 도전 실패
해금 단계는 유지됩니다
```

UI는 Alpine 상태로 구성하며 도전 단계 선택을 위한 직접 DOM 조작을 추가하지 않습니다.

## 12. 구현 단계

1. `stat-allocation.js`의 방어력 설명 불일치 수정
2. 현재 기본 스탯 규칙을 회귀 테스트로 고정
3. `DEFAULT_STAT_RULES`와 규칙 검증 함수 추가
4. 스탯 관련 함수가 동일한 규칙 객체를 받도록 변경
5. `player-profile.js`와 프로필 마이그레이션 추가
6. `progression-config.js`, `progression-state.js` 추가
7. `challenge-rules.js`의 AI 포인트, 빌드 품질, 전력 배율 구현
8. `createTournamentRoster()`를 옵션 객체 기반으로 변경
9. 스탯 배분 팝업에 성장 요약과 도전 단계 선택 UI 추가
10. 토너먼트 우승 시 다음 단계 해금 연결
11. 캐릭터 연계 프로필과 통합
12. `docs/game-rules.md`, `src/help-content.js`, `src/patch-notes.js` 갱신

## 13. 필수 회귀 조건

- 프로필이 없는 사용자는 현재와 동일한 100포인트, 한도 100, 민감도 20을 사용해야 합니다.
- 성장 보너스는 플레이어에게만 적용되어야 합니다.
- AI는 플레이어의 성장 보너스를 사용하지 않아야 합니다.
- 0단계 AI는 현재 AI와 같은 포인트 총량과 무작위 배분을 사용해야 합니다.
- AI 배분 함수는 총 배분 용량을 넘는 규칙에서도 무한 루프가 발생하지 않아야 합니다.
- 도전 전력 배율은 `speed`, `skill`, `radius`, `mass`를 변경하지 않아야 합니다.
- 최고 해금 단계 우승 시에만 다음 단계가 한 번 해금되어야 합니다.
- 낮은 단계 재클리어와 패배는 최고 해금 단계를 변경하지 않아야 합니다.
- `selectedLevel`은 해금 범위를 벗어날 수 없어야 합니다.
- 토너먼트 도중 선택 단계나 프로필 변경이 현재 fighter spec에 소급 적용되지 않아야 합니다.
- localStorage가 없거나 손상되어도 기본 프로필로 게임을 시작할 수 있어야 합니다.

## 14. 후속 결정

- 단계별 AI 포인트 증가량과 전력 배율은 실제 전투 시간과 승률을 측정한 뒤 조정합니다.
- 도감 및 업적의 구체적인 목록과 성장 보상 배분은 해당 시스템을 설계할 때 확정합니다.
- 도전 단계별 최초 클리어 표시, 최고 기록, 캐릭터별 클리어 기록은 도감 시스템과 함께 검토합니다.
