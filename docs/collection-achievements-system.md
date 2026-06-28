# 도감 및 업적 시스템

> 상태: 구현 완료 (`v0.12.0`)
> 기준 코드: 2026-06-24 `main`
> 관련 문서: [`character-link-system.md`](character-link-system.md), [`meta-progression-system.md`](meta-progression-system.md), [`player-data-storage-security.md`](player-data-storage-security.md), [`development-rules.md`](development-rules.md)

## 1. 시스템 정의

플레이어가 토너먼트를 반복하며 쌓은 캐릭터별 기록을 **도감(Collection)** 으로 보여주고, 여러 플레이 목표의 달성 여부를 **업적(Achievement)** 로 보존합니다.

- 기록은 사용자가 직접 플레이한 캐릭터와 매치만 대상으로 합니다.
- AI끼리 진행한 매치는 플레이어의 캐릭터 기록에 포함하지 않습니다.
- 캐릭터 수, 액션 수, 업적 수를 숫자로 하드코딩하지 않습니다.
- 도감과 업적은 캐릭터 연계 및 메타 성장과 같은 플레이어 프로필을 공유합니다.
- 수집 시스템은 전투 규칙을 변경하지 않고 확정된 전투 결과만 기록합니다.

## 2. 용어

| UI 용어 | 코드 용어 | 의미 |
| --- | --- | --- |
| 도감 | `collection` | 캐릭터별 플레이 기록과 숙련도 |
| 숙련도 | `masteryLevel` | 캐릭터 토너먼트 우승 횟수로 계산하는 단계 |
| 업적 | `achievement` | 정의된 조건을 한 번 충족하면 영구 해금되는 목표 |
| 커리어 기록 | `careerStats` | 모든 캐릭터에 걸친 누적 매치, 연승, 액션 사용 기록 |

`masteryLevel`은 우승 횟수로 계산할 수 있는 파생값이므로 프로필에 저장하지 않습니다.

## 3. 캐릭터 기록

캐릭터 ID별로 다음 값만 저장합니다.

```js
{
    tournamentsCompleted: 0,
    tournamentWins: 0,
    matchWins: 0,
    bestPlacement: null,
    totalDamageDealt: 0,
    comebackMatchWins: 0,
    firstTournamentAt: null,
    lastTournamentAt: null
}
```

### 3.1 기록 기준

- `tournamentsCompleted`: 플레이어 토너먼트의 최종 결과가 확정될 때 1 증가합니다. 중간 새로고침이나 이탈은 포함하지 않습니다.
- `tournamentWins`: 플레이어 캐릭터가 토너먼트 최종 우승자일 때 증가합니다.
- `matchWins`: 플레이어 캐릭터가 참가한 개별 매치에서 승리할 때 증가합니다.
- `bestPlacement`: `1`, `2`, `3`, `5` 중 가장 좋은 값입니다. 기록이 없으면 `null`입니다.
- `totalDamageDealt`: 방어력과 액션 경감까지 적용된 실제 HP 감소량을 누적합니다.
- `comebackMatchWins`: 매치 중 한 번이라도 HP가 최대 HP의 15% 이하였던 플레이어가 해당 매치에서 승리하면 증가합니다.
- `firstTournamentAt`, `lastTournamentAt`: 처음과 최근에 완료한 토너먼트의 종료 시각을 기록합니다.

Hero Orb의 체력 증가처럼 전투 중 `maxHp`가 바뀔 수 있으므로 역전 조건은 매 틱의 단순 현재 비율을 저장하지 않습니다. 피해가 확정된 시점마다 `hpAfterDamage / maxHpAfterDamage`의 최저값을 기록합니다.

### 3.2 숙련도

```js
export const MASTERY_THRESHOLDS = Object.freeze([1, 5, 15]);
```

| 단계 | 조건 | 표시 |
| --- | --- | --- |
| 0 | 우승 기록 없음 | 기본 카드 |
| 1 | 1회 우승 | 캐릭터 색상 테두리 |
| 2 | 5회 우승 | 숙련 칭호 |
| 3 | 15회 우승 | 마스터 아이콘 |

미플레이 캐릭터를 실루엣으로 숨기지는 않습니다. 이 게임은 시작 캐릭터가 무작위이므로, 아직 배정받지 못한 캐릭터의 정보까지 가리면 사용자가 목표를 세우기 어렵습니다. 미플레이 상태는 `미기록` 배지로 구분합니다.

## 4. 업적

업적 정의는 표시 정보, 판정 규칙, 선택적 보상을 함께 소유합니다.

```js
{
    id: "first_tournament_win",
    name: "첫 우승",
    description: "토너먼트에서 처음 우승하세요.",
    tier: "bronze",
    evaluate(context) {},
    reward: {
        type: "PROGRESSION_BONUS",
        payload: { bonusKey: "extraStatPoints", amount: 2 }
    }
}
```

`reward`는 `src/progression/progression-state.js`의 `applyProgressionBonus()`가 처리하며, 상한 도달 시 자동으로 클램프됩니다. `rewardClaimed` 플래그로 중복 지급을 방지합니다.

`ACHIEVEMENT_POOL`처럼 단순 데이터만 두고 다른 거대한 함수가 모든 ID를 분기하지 않습니다. 각 정의의 `evaluate()` 또는 전용 규칙 객체가 자신의 달성 조건을 판단합니다.

### 4.1 초기 업적 목록

| ID | 이름 | 조건 | 등급 |
| --- | --- | --- | --- |
| `first_tournament_win` | 첫 우승 | 플레이어 토너먼트 우승 1회 | bronze |
| `flawless_tournament` | 무결점 우승 | 한 토너먼트의 플레이어 매치 전체에서 전투 피해 0으로 우승 | gold |
| `comeback_match_win` | 대역전 | 매치 중 HP 15% 이하를 기록한 뒤 해당 매치 승리 | silver |
| `counter_expert` | 반격 전문가 | 카운터 액션 성공 10회 | silver |
| `all_actions_used` | 만능 플레이어 | 현재 `ACTION_POOL`의 모든 액션을 1회 이상 실제 발동 | bronze |
| `roster_champion` | 전캐릭터 우승 | 현재 로스터의 모든 캐릭터로 토너먼트 1회 이상 우승 | gold |
| `mastery_complete` | 도감 완성 | 현재 로스터의 모든 캐릭터 숙련도 3 달성 | gold |
| `marathon_50` | 끈기 | 플레이어가 참가한 매치 50회 완료 | bronze |
| `tournament_streak_3` | 연승 | 토너먼트 3회 연속 우승 | silver |

업적 조건은 현재 로스터와 액션 레지스트리를 조회합니다. `9개 캐릭터`, `5개 액션` 같은 숫자를 저장하거나 판정 코드에 넣지 않습니다.

### 4.2 조건 세부 규칙

#### 무결점 우승

- 플레이어가 참가한 모든 매치에서 `combatDamageTaken === 0`이어야 합니다.
- 클릭 액션 사용 비용으로 직접 소모한 HP는 전투 피해로 계산하지 않습니다.
- 회복으로 HP를 다시 100%로 만든 경우에도 이미 받은 피해가 있으므로 달성할 수 없습니다.
- 방어 또는 경감 결과 실제 피해가 0이라면 피해를 받지 않은 것으로 처리합니다.

현재 `BattleBall.takeDamage()`는 최소 1 피해를 보장하므로 일반 공격을 맞고 0 피해가 되는 경우는 없지만, 향후 완전 방어 효과가 추가될 가능성을 고려해 실제 적용 피해를 기준으로 정의합니다.

#### 대역전

- 매치 종료 시점 HP가 아니라 전투 피해가 실제 적용된 직후의 최저 HP 비율을 사용합니다.
- 클릭 액션 HP 비용만으로 15% 이하가 된 경우에는 대역전 조건을 충족하지 않습니다.
- 플레이어가 해당 매치에서 승리해야 합니다.
- 토너먼트 우승 여부와 무관하게 개별 매치에서 달성할 수 있습니다.

#### 액션 사용과 성공

- 카드에서 선택한 것만으로는 사용으로 기록하지 않습니다.
- HP 비용 지불과 예약에 성공하고, 게임 루프에서 `ClickAction.apply()`가 실제 호출된 경우 사용으로 기록합니다.
- 카운터, 투사체 방어처럼 성공 조건이 있는 액션은 별도의 성공 이벤트를 기록합니다.
- 실패 입력과 조건 불충족 입력은 사용 횟수에 포함하지 않습니다.

## 5. 플레이어 프로필

모든 영구 시스템은 하나의 localStorage 키를 사용합니다.

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
        characters: {
            archer: {
                tournamentsCompleted: 0,
                tournamentWins: 0,
                matchWins: 0,
                bestPlacement: null,
                totalDamageDealt: 0,
                comebackMatchWins: 0,
                firstTournamentAt: null,
                lastTournamentAt: null
            }
        },
        achievements: {
            first_tournament_win: {
                unlockedAt: null,
                rewardClaimed: false
            }
        },
        careerStats: {
            playerMatchesCompleted: 0,
            playerTournamentsCompleted: 0,
            currentTournamentWinStreak: 0,
            bestTournamentWinStreak: 0,
            usedActionIds: [],
            actionSuccessCounts: {
                counter: 0
            },
            processedTournamentReportIds: []
        }
    }
}
```

### 5.1 저장 규칙

- 캐릭터 기록은 현재 로스터와 화면을 합성할 때 누락된 ID에 기본값을 제공합니다.
- 로스터에서 제거된 캐릭터 기록은 즉시 삭제하지 않습니다. 해당 캐릭터가 다시 돌아오거나 데이터 마이그레이션이 필요할 수 있습니다.
- 알 수 없는 업적 ID는 저장 데이터에 남겨도 판정과 UI에서 무시합니다.
- `usedActionIds`는 중복을 제거합니다.
- 음수, `NaN`, 무한대, 잘못된 날짜는 기본값으로 보정합니다.
- 저장 실패나 손상된 JSON은 기본 프로필로 복구하고 게임 시작을 막지 않습니다.
- MatchReport는 토너먼트 진행 중 메모리에만 보관하고, 영구 프로필은 토너먼트 최종 결과 확정 시 한 번 저장합니다.
- 토너먼트 도중 페이지를 새로고침하거나 이탈하면 해당 미완료 토너먼트의 수집 진행은 저장하지 않습니다.
- `processedTournamentReportIds`는 최근 64개만 유지하며 같은 보고서가 두 번 반영되는 것을 막습니다.

## 6. 프로젝트 구조

```text
src/
  player-profile.js
  collection/
    index.js
    MatchReport.js
    TournamentReport.js
    collection-view-model.js
    achievement-definitions.js
    achievement-rules.js
```

| 파일 | 책임 |
| --- | --- |
| `src/player-profile.js` | localStorage 입출력, 버전 관리, 전체 프로필 마이그레이션 |
| `src/collection/MatchReport.js` | 한 매치의 피해, HP 최저치, 액션 사용 및 성공 기록 |
| `src/collection/TournamentReport.js` | 플레이어가 참가한 매치 보고서를 모아 최종 등수와 토너먼트 보고서 생성, 프로필 반영 |
| `src/collection/collection-view-model.js` | 프로필+로스터+링크/업적 정의 → UI 전용 ViewModel 생성 |
| `src/collection/achievement-definitions.js` | 업적 ID, 이름, 설명, 등급, evaluate 함수, 보상 정의 |
| `src/collection/achievement-rules.js` | 업적 판정 루프, 중복 해금 방지 |

`collection.js` 하나에 저장, 런타임 기록, 업적 판정, UI 데이터를 모두 넣지 않습니다.

## 7. 런타임 기록 구조

영구 프로필을 전투 중에 직접 변경하지 않습니다.

```text
BattleSimulation
  -> onDamageTaken/onDamageDealt/onHpChanged 콜백으로 MatchReport 기록
  -> 매치 종료 시 MatchReport 완성
BattleApp.finishMatch()
  -> TournamentReport에 MatchReport 추가
BattleApp.showTournamentChampion()
  -> TournamentReport 완성
  -> applyTournamentReport()로 프로필 기록 반영
  -> evaluateAchievements()로 새 업적 판정
  -> savePlayerProfile()로 한 번 저장
```

### 7.1 MatchReport

```js
{
    reportId: "uuid",
    playerFighterId: "archer",
    playerWon: true,
    isTournamentFinal: false,
    combatDamageTaken: 0,
    combatDamageDealt: 42,
    actionHpCost: 10,
    lowestHpRatio: 0.85,
    usedActionIds: ["rush"],
    actionSuccessCounts: { counter: 1 },
    tournamentRoundIndex: 0,
    timestamp: 1719200000000
}
        damageDealt: 37,
        combatDamageTaken: 22,
        lowestHpRatio: 0.12,
        actionUses: {
            rush: 2
        },
        actionSuccesses: {
            counter: 1
        }
    }
}
```

플레이어가 참가하지 않은 AI 매치도 전투 자체는 정상 진행하지만 `player`는 `null`이며 도감 누적 대상에서 제외합니다.

### 7.2 TournamentReport

```js
{
    reportId: "uuid",
    playerFighterId: "archer",
    placement: 1,
    playerWon: true,
    challengeLevel: 3,
    startedAt: 1719000000000,
    completedAt: 1719000123000,
    matches: [],
    totals: {
        playerMatchesCompleted: 3,
        matchWins: 3,
        damageDealt: 104,
        combatDamageTaken: 28,
        comebackMatchWins: 1
    }
}
```

- `TournamentTracker`는 토너먼트 준비 시 `reportId`를 한 번 생성하고 종료까지 유지합니다.
- ID 생성기는 테스트에서 주입할 수 있어야 합니다. 브라우저 기본 구현은 `crypto.randomUUID()`를 사용하고 미지원 환경에서는 시간과 난수를 조합한 ID로 대체합니다.
- `finalizePlayerProgress()`는 이미 `processedTournamentReportIds`에 있는 보고서를 받으면 아무 카운터와 보상도 변경하지 않고 `alreadyProcessed: true`를 반환합니다.

도감, 업적, 캐릭터 연계, 도전 단계는 같은 `TournamentReport`를 입력으로 사용하되 서로의 내부 상태를 직접 수정하지 않습니다.

## 8. 전투 연동 인터페이스

### 8.1 실제 피해

`BattleBall.takeDamage()`는 방어와 액션 경감 후 실제 적용한 피해량을 반환해야 합니다.

```js
const actualDamage = target.takeDamage(amount, source, label);
```

피해 계산은 `BattleBall`이 계속 소유합니다. 기록기는 반환된 결과를 받거나 Simulation의 데이터 인터페이스를 통해 전달받을 뿐 피해를 다시 계산하지 않습니다.

권장 인터페이스:

```js
simulation.recordDamage({
    source,
    target,
    amount: actualDamage,
    label
});
```

`recordDamage()`는 `MatchTracker`로 전달만 하며 업적 조건을 판정하지 않습니다.

### 8.2 액션

```js
simulation.recordActionUse(playerBall, actionInstance.id);
simulation.recordActionSuccess(playerBall, actionId);
```

- `recordActionUse()`는 예약된 액션이 게임 루프에서 실제 적용된 직후 호출합니다.
- 성공 조건은 해당 Action 또는 Action이 만든 effect가 판단합니다.
- 카운터 성공 시 `CounterAction` effect가 `recordActionSuccess()`를 호출합니다.
- `BattleSimulation`은 어떤 액션이 성공인지 해석하지 않습니다.

### 8.3 매치 결과

`TournamentManager.complete()`은 대진 상태만 변경합니다. 수집 기록 호출을 넣지 않습니다.

매치 종료 보고서 생성과 전달은 현재 승자, 패자, 플레이어 참여 여부를 알고 있는 `BattleApp.finishMatch()` 흐름에서 처리합니다.

`BattleBall.takeDamage()`는 다음 반환 계약을 가집니다.

```js
{
    requestedAmount: number,
    actualDamage: number,
    hpBefore: number,
    hpAfter: number,
    defeated: boolean
}
```

- 이미 패배한 대상에게 호출되면 `actualDamage: 0`인 결과를 반환합니다.
- `requestedAmount`는 ActionContext 경감과 방어력 차감 전 입력값입니다.
- `actualDamage`는 `hpBefore - hpAfter`입니다. 남은 HP보다 큰 공격도 초과 피해를 누적하지 않습니다.
- 기록기는 `actualDamage`를 다시 계산하지 않습니다.

## 9. 결과 처리

토너먼트 종료 시 여러 영구 시스템을 따로 저장하지 않고 한 번에 처리합니다.

```js
const result = finalizePlayerProgress(profile, tournamentReport);
```

반환 예시:

```js
{
    unlockedAchievementIds: ["first_tournament_win"],
    unlockedCharacterLinkIds: ["archer_support_fire"],
    unlockedChallengeLevel: 1,
    grantedRewards: [
        {
            type: "PROGRESSION_BONUS",
            payload: { bonusKey: "extraStatPoints", amount: 5 }
        }
    ]
}
```

`finalizePlayerProgress()`는 애플리케이션 서비스로서 다음 도메인 함수를 정해진 순서로 호출합니다.

1. 도감과 커리어 기록 반영
2. 업적 판정 및 신규 해금
3. 신규 업적 보상 지급
4. 캐릭터 연계 효과 해금
5. 도전 단계 해금

각 세부 계산은 해당 도메인 모듈이 소유합니다. `BattleApp`은 반환 결과로 알림을 표시하고 프로필을 한 번 저장합니다.

## 10. 업적 보상

업적 보상은 선택 사항입니다. 보상이 없는 업적도 허용합니다.

```js
reward: {
    type: "PROGRESSION_BONUS",
    payload: {
        bonusKey: "extraStatPoints",
        amount: 5
    }
}
```

- 보상 적용은 업적 판정 함수가 직접 수행하지 않습니다.
- `rewardClaimed`로 이미 적용된 보상을 다시 지급하지 않습니다.
- 상한에 도달해 실제 증가량이 0이어도 보상은 지급 완료로 기록합니다.
- 캐릭터 연계 해금 보상을 추가할 경우 같은 효과의 중복 해금은 성공적인 무변경으로 처리합니다.

구체적인 업적별 성장 보상 배분은 메타 성장 시스템의 상한 총량을 넘지 않도록 별도 밸런스 단계에서 확정합니다.

## 11. UI

도감, 연계, 업적은 각각 별도 팝업을 만들지 않고 [`collection-hub-ui.md`](collection-hub-ui.md)의 탭형 컬렉션 허브에서 표시합니다.

### 진입점

- 상단 상태 UI에 작은 컬렉션 버튼을 추가합니다.
- 모바일에서는 전투 화면보다 높은 공간 우선순위를 가지지 않습니다.
- 도감은 중앙 팝업으로 열고 내부 콘텐츠만 스크롤합니다.

### 도감 탭

- 현재 로스터의 캐릭터를 반응형 grid로 표시합니다.
- 카드에는 숙련도, 토너먼트 우승 수, 최고 등수를 표시합니다.
- 카드를 선택하면 매치 승리, 누적 피해, 역전승 등 상세 기록을 보여줍니다.
- 현재 플레이어 캐릭터와 전투 fighter card에는 숙련도 아이콘만 작게 표시합니다.

### 업적 탭

- 미달성 업적도 이름, 조건, 보상을 표시합니다.
- 달성 업적은 해금 시각과 등급 색상을 표시합니다.
- 업적 등급은 희귀도와 시각 표현이며 별도의 성능 배율을 의미하지 않습니다.

### 알림

- 새 업적, 캐릭터 연계 효과, 도전 단계 해금을 하나의 Alpine 알림 큐로 순서대로 표시합니다.
- 알림이 동시에 여러 개 생겨도 겹치지 않고 한 개씩 표시합니다.
- 모바일에서 전투 화면을 가리지 않도록 결과 팝업 또는 상태 UI 영역을 사용합니다.
- 패치노트 모달의 HTML 문자열 조립 방식을 복사하지 않습니다.

## 12. 구현 단계

1. 공용 `player-profile.js`와 전체 프로필 기본값 및 마이그레이션 구현
2. 현재 전투 결과를 고정하는 MatchReport 회귀 테스트 작성
3. `BattleBall.takeDamage()`가 실제 피해량을 반환하도록 변경
4. `match-tracker.js`와 Simulation 기록 인터페이스 추가
5. `tournament-tracker.js`와 TournamentReport 생성
6. `collection-state.js`, `mastery-rules.js` 구현
7. 업적 정의와 판정 규칙 구현
8. `finalizePlayerProgress()`로 캐릭터 연계, 성장, 도전 단계 결과 통합
9. Alpine 도감 및 업적 팝업 구현
10. 통합 알림 큐 구현
11. `docs/game-rules.md`, `src/help-content.js`, `src/patchNotes.js` 갱신

## 13. 필수 회귀 조건

- 페이지 진입이나 완료 전 이탈로 `tournamentsCompleted`가 증가하지 않아야 합니다.
- 플레이어가 참가하지 않은 AI 매치는 도감 기록에 포함되지 않아야 합니다.
- 개별 매치와 토너먼트 우승 횟수가 서로 섞이지 않아야 합니다.
- 실제 방어 적용 후 피해량만 `totalDamageDealt`에 누적되어야 합니다.
- 액션 HP 비용은 `combatDamageTaken`에 포함되지 않아야 합니다.
- 회복 후 HP 100%가 되어도 이미 피해를 받았다면 무결점 우승을 달성할 수 없어야 합니다.
- 카운터 입력 실패와 시간 초과는 카운터 성공 횟수에 포함되지 않아야 합니다.
- 액션 선택만 하고 발동하지 않은 경우 `usedActionIds`에 들어가지 않아야 합니다.
- 현재 로스터나 액션 풀이 늘어나도 전체 수집 업적이 하드코딩된 숫자를 사용하지 않아야 합니다.
- 업적 판정과 보상 지급은 같은 결과를 다시 처리해도 중복 적용되지 않아야 합니다.
- 한 토너먼트 결과는 프로필에 정확히 한 번만 반영되어야 합니다.
- `processedTournamentReportIds`는 최신 64개만 남겨 프로필 크기가 계속 증가하지 않아야 합니다.
- 손상된 localStorage 데이터가 게임 시작을 막지 않아야 합니다.

## 14. 후속 결정

- 숙련도 2단계의 캐릭터별 칭호 문구는 별도 콘텐츠 작업에서 정합니다.
- 업적별 성장 보상은 전체 상한과 획득 난이도를 함께 보고 확정합니다.
- 도전 단계별 최초 클리어와 캐릭터별 최고 클리어 단계는 1차 도감 구현 후 확장합니다.
