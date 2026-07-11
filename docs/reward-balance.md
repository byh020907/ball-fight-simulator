# 보상 밸런스 설정

플레이어가 획득하거나 소비하는 수치는 `src/rewardBalanceConfig.js`가 단일 원본입니다.
경험치, 사냥터 전리품, 상자, 상인, 장비 성장과 환원, 업적, 숙련도 수치를 조정할 때는 이 파일만 수정합니다.

## 범위

- `experience`: 대전/사냥터 경험치, 레벨 비용, 레벨업 보상
- `hunting.chest`: 상자 비용, 파손 우선순위, 상자 보상 확률과 수량. 일반 상자만 파편 보상이 가능하고 고급 이상 상자는 장비를 확정 지급한다.
- `hunting.shards`: 전투 파편, 깊이 보정, 패배 보존, 전투 보상 배율
- `hunting.events`: 축복, 상인, 휴식, 상자 방, 저주 제단 등 이벤트 보상
- `equipment`: 장비 요구 레벨, 인벤토리, 강화, 판매, 분해, 융합, 장비 옵션 수치
- `progression`: 숙련도 조건과 효과, 업적 보상, 성장 보너스 상한

## 수정 원칙

기존 도메인 모듈은 보상 지급과 표시만 담당하고 수치의 원본을 소유하지 않습니다. 수치 변경 후에는 `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs`를 실행해 보상 결과와 순환을 함께 확인합니다.

## 장비 스탯 환산

`scripts/equipmentStatBalance.mjs`는 능력이 없는 표준 볼(HP 100, 공격력 10, 방어력 1, 속도 300)로 장비형 고정 스탯의 상대 가치를 측정합니다. 같은 시드를 좌우 시작 위치에 교차 적용하고, 장비 없음 전투와의 승률 상승폭만 계산해 시작 위치 편향을 제거합니다. 제한 시간 안에 끝나지 않은 전투는 최대 HP 대비 남은 HP 비율로 판정해 표본에서 빠지지 않게 합니다.

기본 실행은 `node scripts/equipmentStatBalance.mjs`입니다. 정밀 측정은 PowerShell에서 `$env:BALANCE_SAMPLES=120; node scripts/equipmentStatBalance.mjs`처럼 표본 수를 늘려 실행합니다.
