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
