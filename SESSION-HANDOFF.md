# 결정 기록

## [L1] 2026-07-12 — 장비 기본 옵션은 스탯 가치 비율로 생성
- 맥락: 장비 수치는 HP 10, 공격 1, 방어 1, 속도 5의 전투 가치 기준을 이미 사용하지만, 단순 단위명으로 관리되어 장비 옵션 생성의 공통 기준이라는 의도가 드러나지 않았다.
- 결정: 장비 등급 범위는 공통 가치 포인트로 유지하고, `statValueRatios`를 유일한 스탯 환산 기준으로 둔다. 장비 생성, 대표 옵션 이름 선정, 테스트와 밸런스 문서는 모두 이 비율을 직접 참조한다.
- 영향: 장비 밸런스 설정, 장비 생성/이름 API, 회귀 테스트와 보상 밸런스 문서.

## [L1] 2026-07-12 — 레벨 보상은 기본 수치 단계에서 스탯 배율을 받는다
- 맥락: 직전 레벨 보상 구현은 최종 `BattleBall` 수치에 더해져 사용자 스탯의 퍼센트 배율을 우회했다.
- 결정: 전투 수치 계산 순서는 `캐릭터 기본 수치 + 레벨 보상 → 사용자 스탯 배율 → 장비 고정 추가 수치`로 고정한다. 효과 핸들러는 기본 스펙 단계와 전투 공 단계 중 자신이 필요한 단계만 소유하며, 중앙 흐름은 효과 타입을 조건문으로 분기하지 않는다.
- 영향: 경험치 효과 레지스트리, 스탯 배분, 토너먼트/사냥터 전투 스펙 생성, 스킬 쿨타임 기본 수치, 회귀 테스트와 경험치 문서.

## [L1] 2026-07-12 — 레벨 보상을 Ball 효과 핸들러로 통합
- 맥락: 레벨 보상이 전투 스펙에 조건문으로 직접 섞여 토너먼트에만 적용되고, 대표 행동 강화로 확장할 구조가 없었다.
- 결정: 보상 데이터는 단일 밸런스 테이블에 유지하고, 각 효과 타입 핸들러가 실제 `BattleBall`을 받아 적용한다. `BattleSimulation`의 공 생성 훅에서 사용자 캐릭터 보상을 적용해 토너먼트와 사냥터를 같은 경로로 처리한다. 현재 보상은 스탯형이며 이후 대표 행동 강화는 `ability_modifier` 핸들러로 추가한다.
- 영향: 경험치 보상 데이터/적용, 전투 공 생성 수명주기, XP 결과 UI, 회귀 테스트 및 경험치 구조 문서.

## [L1] 2026-07-12 — 상자방은 전투 승리와 분리해 표시
- 맥락: 상자방 이벤트 패널은 표시되지만 기본 오버레이의 직전 전투 결과 텍스트가 남아 상자방에서도 `승리`가 보였음.
- 결정: 상자방 전이 시 기본 오버레이를 현재 층의 상자방 문맥으로 명시적으로 갱신한다.
- 영향: 사냥터 이벤트 presentation, 상자방 회귀 테스트, 패치노트.

## [L1] 2026-07-12 — 사냥터 이벤트 클래스와 런 단계를 분리
- 맥락: 이벤트 타입별 동작을 `HuntingManager`의 메서드로만 나누면 런 상태와 이벤트 행위의 경계가 여전히 불명확했고, 새로운 상호작용 이벤트를 추가할 때 UI·진행·보상 책임이 다시 섞일 위험이 있었음.
- 결정: `HuntingRun`은 직렬화 가능한 plain object로 유지하고, `HuntingEvent` 클래스는 payload 생성과 런 전이를 담당한다. 이벤트 후보는 `POOL` 배열, 타입 조회는 `REGISTRY` Map으로 관리한다. `status`와 별도로 `phase`를 두어 이동·선택·상인·상자·전투 단계를 명시한다.
- 영향: 사냥터 진행 규칙, 이벤트 생성과 실행, `HuntingManager` 책임, 회귀 테스트, 이벤트 아키텍처 문서와 패치노트.

## [L1] 2026-07-12 — 사냥터 이동과 이벤트 처리를 분리
- 맥락: `HuntingManager.advance()`가 이동 단계, 조우 종류별 처리, 이벤트 종류별 처리, UI 전환을 모두 조건문으로 소유해 새 이벤트 추가와 회귀 검증이 어려웠음.
- 결정: `advance()`는 경로 반복만 조정하고, 층 조우와 이벤트는 각각 처리기 매핑으로 전용 메서드에 위임한다. 모든 이벤트 타입은 매핑 등록과 처리기 존재를 회귀 테스트로 강제하며, 처리기는 `CONTINUE` 또는 `STOP`으로 이동 루프 제어를 명시한다.
- 영향: `HuntingManager`의 이동·이벤트 제어 흐름, 사냥터 회귀 테스트, 패치노트.

## [L1] 2026-07-12 — 상자방 보상을 확인한 뒤 전진
- 맥락: 상자방 보상은 토스트만 표시된 채 자동 진행되어, 획득한 층과 미확보 전리품을 사용자가 인지하기 어려웠음.
- 결정: 상자방은 등급 색상의 상자를 표시하고 `계속 전진`을 누를 때까지 층 이동을 멈춘다. 실제 보상 공개는 기존처럼 보관함 개봉 시점에 유지한다. 상자 도형은 `chest-icon` 공통 컴포넌트로 구성해 사냥터와 보관함이 같은 등급 표현을 사용한다.
- 영향: 사냥터 이벤트 진행 상태, 게임 오버레이, 보관함 상자 카드, 회귀 테스트, 사냥터 시스템 문서와 패치노트.

## [L1] 2026-07-12 — 사냥터는 내부 상태부터 1층 시작, 첫 이동 UI 페인트 뒤 진행
- 맥락: 원정 런 내부가 0층에서 시작한 뒤 즉시 `advance()`를 호출해, 1층 이동 UI가 Alpine에 반영되기 전에 다음 층 이벤트·전투 상태가 덮어쓰는 경쟁 상태가 발생했다.
- 결정: 원정 런 자체를 1층에서 시작한다. 원정 시작은 첫 이동 상태(`1F → 11F`, `1/10`)를 발행하고, UI 소유자인 `BattleApp`의 두 프레임 페인트 게이트가 완료된 뒤에만 층 판정을 진행한다. 이후 자동 10칸 전진은 유지한다.
- 영향: 사냥터 시작 층 상태, 첫 이동 호출 시점, 이동 경로 표시, 100층 진행 회귀 테스트와 사냥터 흐름 문서.

## [L1] 2026-07-12 — 토너먼트 종료 버튼도 확인으로 통일
- 맥락: 토너먼트 종료 동작은 이미 확인 뒤 초기 상태 복귀로 바뀌었지만 버튼 문구만 이전 `새 토너먼트 준비`로 남아 흐름을 잘못 안내했다.
- 결정: 토너먼트 결과 버튼은 사냥터와 동일하게 `확인`으로 표시한다. 확인은 결과를 정리하고 프리뷰 캐릭터를 다시 선택할 수 있는 초기 화면으로 복귀한다.
- 영향: 토너먼트 결과 버튼 문구, 캐릭터 숙련도 흐름 문서, 결과 확인 회귀 계약, 패치노트.

## [L1] 2026-07-12 — 상인 선택지는 축소하지 않고 목록만 스크롤
- 맥락: 상인 목록은 스크롤할 수 있었지만 선택지 버튼이 flex 기본 축소를 받아 한 선택지 안의 문구와 가격이 잘릴 수 있었다.
- 결정: 상인 선택지는 축소하지 않고 최소 높이 76px을 보장한다. 카드 폭과 여백도 모바일에서 확대하며, 넘치는 내용은 선택지 목록만 스크롤한다. 계속 전진 버튼은 기존처럼 고정한다.
- 영향: 게임 오버레이 상인 모바일 레이아웃과 스크롤 회귀 계약, 패치노트.

## [L1] 2026-07-12 — 초탄 수류탄 퓨즈는 현재 쿨다운의 20%
- 맥락: 초탄 퓨즈가 고정 0.6초라 마지막 탄만 쿨다운에 연동되는 비대칭이 있었다.
- 결정: 초탄 퓨즈는 현재 유효 쿨다운의 20%, 마지막 탄은 현재 유효 쿨다운 100%로 설정하고 사이 탄은 선형 분포한다.
- 영향: `GrenadeAbility` 퓨즈 분포, 수류탄 발사 회귀 테스트, 캐릭터 설명·도움말·게임 규칙·패치노트.

## [L1] 2026-07-12 — 마지막 수류탄 퓨즈는 현재 쿨다운과 동일
- 맥락: 수류탄 마지막 탄의 퓨즈가 2.0초로 고정되어, 그레네이드 볼의 현재 쿨다운과 발사 순환이 맞지 않았다.
- 결정: 첫 탄은 0.6초부터 시작하고 마지막 탄은 현재 유효 쿨다운과 같은 시간으로 설정한다. 쿨다운 감소가 적용되면 가장 긴 퓨즈도 같은 비율로 줄어든다.
- 영향: `GrenadeAbility` 퓨즈 분포, 수류탄 발사 회귀 테스트, 캐릭터 설명·도움말·게임 규칙·패치노트.

## [L1] 2026-07-12 — 수류탄 탄속과 근접 퓨즈를 캐릭터 속도에 연동
- 맥락: 수류탄은 캐릭터 기본 속도와 무관하게 800px/s로 고정되어 있었고, 근접 신관도 남은 퓨즈를 한 번에 깎는 방식이라 탄속 체감과 규칙 설명이 어긋났다.
- 결정: 수류탄 탄속은 그레네이드 볼의 현재 기본 속도에 `800 / 290`배를 적용한다. 폭발권 진입 뒤 퓨즈는 기준 발사 탄속에서 3배 빠르게 줄고, 진입 탄속이 두 배 이상이면 최대 6배로 제한한다. 캐릭터 설명은 실제 360도 무작위 3~5발 규칙으로 갱신한다.
- 영향: `GrenadeAbility` 발사 속도, `Grenade` 근접 퓨즈, 수류탄 회귀 테스트, 캐릭터 설명·도움말·게임 규칙·패치노트.

## [L1] 2026-07-12 — 수류탄 피해 반경을 폭발 이펙트 외곽에 일치
- 맥락: 폭발 이펙트는 최대 약 173px까지 보이지만 실제 피해 반경은 150px라, 이펙트 안에 있는 적이 맞지 않는 불쾌한 불일치가 있었다.
- 결정: 수류탄의 피해·근접 신관·사전 범위선이 공유하는 폭발 반경을 이펙트 외곽에 맞춘 174px로 확대한다. 중심 고피해 구간도 같은 비율로 72px까지 확장한다.
- 영향: `Grenade` 폭발·근접 신관·표시 범위, 경계 피해 회귀 테스트, 게임 규칙·도움말·패치노트.

## [L1] 2026-07-12 — 종료 결과 확인은 초기 앱 상태로 복귀
- 맥락: 토너먼트와 사냥터가 끝난 뒤 결과 오버레이와 종료 플래그가 남아 프리뷰 캐릭터를 다시 선택할 수 없었다.
- 결정: 결과 확인은 공통 `returnToInitialState()`로 처리한다. 이 경로는 결과 오버레이·대진표·종료 플래그·진행 잠금을 정리하고, 프리뷰 및 설정 UI를 초기 상태로 복구한다.
- 영향: `BattleApp` 종료 확인 흐름, 결과 복귀 회귀 테스트, 패치노트.

## [L1] 2026-07-12 — 수류탄 근접 퓨즈를 이동 경로와 탄속으로 단축
- 맥락: 수류탄은 업데이트 종료 위치만으로 상대 폭발권을 확인하고 남은 퓨즈를 고정 비율로 줄여, 고속 투사체가 한 프레임에 폭발권을 관통하면 근접 신관을 놓칠 수 있었다.
- 결정: 이전 위치부터 현재 위치까지의 선분이 상대 폭발권을 지나는지 판정한다. 퓨즈 단축량은 탄속 800px/s에서 기존과 같은 40%를 기준으로 하고, 저속 20%·고속 최대 85% 범위로 제한한다.
- 영향: `Grenade` 근접 신관, 수류탄 회귀 테스트, 게임 규칙·도움말·패치노트.

## [L1] 2026-07-12 — 초기 화면 복귀 시 사냥터 UI 상태를 완전 초기화
- 맥락: 사냥터 UI를 숨겨도 이전 층·캐릭터·전리품 요약이 남아 다음 부분 갱신에서 과거 상태가 다시 보일 수 있었다.
- 결정: 게임 오버레이에 모든 사냥터 필드를 초기값으로 되돌리는 `resetHuntingState()`를 두고, 초기 화면 복귀는 `BattleApp.resetHuntingUiState()`를 통해 명시적으로 수행한다.
- 영향: 사냥터 종료 확인과 초기 화면, 토너먼트 재준비, 게임 오버레이 상태 계약, 회귀 테스트.

## [L1] 2026-07-12 — 모바일 상인 선택지를 전장 안에서 스크롤
- 맥락: 모바일 전장 높이보다 세 개의 상인 선택지와 계속 전진 버튼이 커서 카드 상하단이 잘리고 선택할 수 없었다.
- 결정: 상인 활성 상태의 오버레이 카드를 전장 높이 안에서 제한한다. 선택지 목록만 스크롤 가능한 터치 영역으로 두고, 다음 층으로 넘어가는 버튼은 패널 하단에 고정한다. 상인 내부 텍스트의 불필요한 공통 여백도 제거한다.
- 영향: 게임 오버레이 모바일 레이아웃, 상인 선택지 회귀 계약, 패치노트.

## [L1] 2026-07-12 — 비활성 시작 버튼에 남은 스탯을 명시
- 맥락: 사냥터 모드에서 스탯이 남으면 게임 시작 버튼은 비활성화되지만, 버튼 컴포넌트에 남은 스탯이 전달되지 않아 문구가 계속 게임 시작으로 보였다.
- 결정: 시작 버튼의 `remainingPoints`를 `_syncStartButton()`에서 항상 동기화해 비활성 사유를 `스탯 N 남음`으로 표시한다.
- 영향: `BattleApp` 시작 버튼 상태 동기화, 회귀 테스트, 패치노트.

## [L1] 2026-07-12 — 사냥터 캐릭터 선택을 프리뷰 선택으로 통합
- 맥락: 토너먼트/사냥터 토글에서 이미 사냥터 캐릭터를 프리뷰로 선택하지만, 원정 시작 시 동일한 캐릭터를 다시 고르는 UI가 남아 있었다.
- 결정: 사냥터 시작 팝업은 맵 선택만 제공한다. 맵 카드를 누르면 현재 프리뷰 캐릭터로 즉시 원정을 시작하며, 이전 캐릭터 선택 UI와 CSS 및 브리지 이름을 제거한다.
- 영향: `HuntingManager` 원정 준비 흐름, 시작 버튼 액션 게이트웨이, 사냥터 팝업 CSS, 회귀 테스트.

## [L1] 2026-07-12 — 사냥터 진행 중 설정 UI와 상인 구매 상태 정합성
- 맥락: 사냥터 전투 중에도 모바일 모드 선택과 게임 시작 UI가 남았고, 상인 상자 구매는 보상만 반영된 채 버튼이 구매 완료로 갱신되지 않았음.
- 결정: 토너먼트와 사냥터를 공통 게임 진행 상태로 취급해 모드 선택·게임 시작·스탯 패널을 잠근다. 상인 구매 뒤에는 새 offers 배열로 UI 상태를 교체한다.
- 영향: `BattleApp` 설정 UI 상태, `HuntingManager` 상인 상태 갱신, 회귀·Playwright e2e 검증.

## [L1] 2026-07-12 — 물리 특수 옵션을 실제 물리 파라미터로 적용
- 맥락: 장비 특수 옵션 중 중량·반향·소용돌이는 후보 이름과 설계만 있었고, 생성 풀과 전투 physics solver에는 연결되지 않았음.
- 결정: `중량`은 실제 질량, `반향`은 벽 반사 뒤 법선 속도, `소용돌이`는 충돌 solver의 각충격 배율을 각각 보정한다. 세 옵션은 기존 특수 옵션과 같이 `5~15%` 범위로 생성한다.
- 영향: 장비 옵션 풀·효과 집계, BattleBall 질량/벽 반사, fighter collision response, 회귀 테스트와 밸런스 문서.

## [L2] 2026-07-12 — 갈망의 장비 효과 쿨다운은 2.5초
- 배경: 갈망의 회복 비율은 `2~8%`로 존재하지만, 연속 충돌을 제어할 장비 효과 쿨다운의 기준값이 비어 있었음.
- 결정: 갈망은 실제 충돌 피해 거래가 끝난 뒤 발동하며, 장비 효과 쿨다운은 기본 2.5초로 둔다. 현재 생성되는 특수 옵션인 파쇄·순환·갈망을 함께 전투 효과로 연결한다.
- 영향: `rewardBalanceConfig`, 장비 효과 집계, 충돌 거래 처리 및 회귀 테스트.

## [L1] 2026-07-12 — 갈망은 쿨다운 기반 모든 충돌 피해 흡혈
- 맥락: 갈망을 일반 충돌 피해마다 회복하면 연속 충돌에서 과도하게 발동하며, 기본 충돌과 스킬 충돌을 나누면 유저가 효과 범위를 예측하기 어려움.
- 결정: 갈망은 적대 전투원 간 충돌을 하나의 거래로 보고, 기본 충돌·대시 등 해당 충돌에서 발생한 스킬 피해를 포함한 실제 총 피해를 기준으로 회복한다. 발동에는 장비 효과 자체의 쿨다운을 둔다.
- 영향: 이후 충돌 피해 거래 컨텍스트, 갈망 발동 상태와 회귀 테스트 설계.

## [L1] 2026-07-12 — 비물리 특수 접미사도 특수 옵션 풀에 포함
- 맥락: 물리 접미사는 실제 물리값만 보정한다는 원칙을 전체 특수 옵션 금지로 잘못 좁혀 해석함.
- 결정: `파쇄`(충돌 피해), `갈망`(흡혈), `순환`(쿨다운)은 특수 접미사 풀에 포함한다. 다만 물리 접미사와 구분되는 전투·유지·스킬 카테고리로 소유권과 중첩 규칙을 설계한다.
- 영향: 특수 접미사 MVP는 물리(중량·반향·소용돌이), 전투(파쇄), 유지(갈망), 스킬(순환)로 구성.

## [L2] 2026-07-12 — 장비 물리 접미사는 실제 물리값만 보정
- 배경: 중량 접미사 설계에서 원하는 효과는 상대 넉백을 별도 수치로 가공하는 것이 아니라, 질량 변화로 강체 충돌 결과가 자연스럽게 달라지는 것임을 재확인.
- 결정: 물리 계열 특수 접미사는 질량, 반발, 마찰, 각충격, 각감쇠 등 엔진의 실제 물리 파라미터만 보정한다. 직접 피해·직접 넉백·속도 덧셈 같은 ad hoc 효과는 사용하지 않는다.
- 영향: 이후 반향·소용돌이·중량 구현의 설계 제약.

## [L1] 2026-07-12 — 중량 접미사로 실제 충돌 질량 보정
- 맥락: 장비 특수 옵션에 상대를 더 크게 밀어내는 물리 빌드를 추가할 필요가 있음.
- 결정: `중량` 접미사는 별도 넉백 수치가 아니라 장착 볼의 실제 `mass`를 증가시킨다. 공통 rigid-body 충돌 solver가 상대의 반동, 자신의 반동 감소, 회전 관성 증가를 함께 계산하게 한다.
- 영향: 이후 특수 옵션 구현 시 장비 스탯 환산 시뮬레이터에 mass 축 추가, spec 생성 단계의 질량 보정, 충돌·회전 회귀 테스트 추가.

## [L1] 2026-07-12 — 주 옵션 접두사 장비명 구현
- 맥락: 승인된 장비명 규칙을 실제 랜덤 장비 생성에 반영해야 하며, 특수 옵션은 아직 전투 효과가 없어 이름으로 약속하면 안 됨.
- 결정: 랜덤 기본 스탯을 가치 단위로 정규화해 가장 큰 스탯을 고르고, 해당 접두사와 베이스 장비명을 결합. 생성 장비에 `baseName`과 `primaryStatType`도 보존.
- 영향: 장비 생성기, 장비명 순수 helper, 장비 데이터, 회귀 테스트, 패치 노트, 보상 밸런스 문서.

## [L2] 2026-07-12 — 주 옵션 중심의 로그라이크 장비명 구조
- 배경: 장비 이름이 슬롯·등급별 고정 이름 풀에서 무작위로만 선택되어 실제 옵션을 읽어주지 못함.
- 결정: 장비명은 `주 옵션 접두사 1개 + 베이스 장비명`으로 구성한다. 주 옵션은 가장 높은 전투 가치의 기본 스탯으로 정하고, 실제 전투에 연결된 특수 옵션이 생기면 해당 특수 접두사를 우선한다. 여러 접두사 중첩은 사용하지 않는다.
- 영향: 이후 장비 생성 데이터와 장비 UI 이름 표시 리팩터링의 기준.

## [L1] 2026-07-12 — 환산 단위 기반 장비 기본 옵션 생성
- 맥락: 장비 스탯을 캐릭터 약점 보완용 고정값으로 유지하면서도, HP·공격·방어·속도 옵션이 같은 숫자를 써서 실제 전투 가치가 불균등했음.
- 결정: 등급별 기존 옵션 범위는 공통 가치 단위로 유지하고, 표준 볼 환산 비율에 따라 HP ×10, 공격 ×1, 방어 ×1, 속도 ×5를 적용해 랜덤 기본 옵션을 생성.
- 영향: `src/rewardBalanceConfig.js`, 장비 생성기, 회귀 테스트, 보상 밸런스 문서.

## [L1] 2026-07-12 — 표준 무능력 볼 기반 장비 스탯 환산
- 맥락: 장비는 캐릭터의 약한 고정 스탯을 보완해야 하므로, 퍼센트 성장으로 바꾸지 않고 실제 전투 승률 기준으로 각 고정 스탯의 상대 가치를 정할 필요가 있음.
- 결정: 능력 없는 표준 볼(HP 100, 공격력 10, 방어력 1, 속도 300)을 기준으로 같은 시드·양쪽 시작 위치의 무장비/단일 스탯 보정 전투를 비교하는 환산 시뮬레이터를 추가.
- 영향: `scripts/equipmentStatBalance.mjs`, `ability: "none"` 중립 능력 지원, 회귀 테스트, 보상 밸런스 문서.

## [L1] 2026-07-12 — 고급 이상 상자 장비 확정 보상
- 맥락: 상자를 열었을 때 파편이 나오면 상자 비용을 지불하고도 꽝처럼 느껴져 보상 체감이 약함.
- 결정: 일반 상자만 기존처럼 파편 또는 장비를 제공하고, 고급·희귀·에픽·전설 상자는 해당 등급 장비를 100% 제공.
- 영향: `src/rewardBalanceConfig.js`, 상자 보상 회귀 테스트, 보상 밸런스 문서.

## [L1] 2026-07-12 — 보상 수치 단일 밸런스 설정으로 집약
- 맥락: 레벨업, 사냥터, 상자, 장비, 업적, 숙련도 보상 수치가 여러 모듈에 흩어져 있어 전체 경제와 성장 속도를 한눈에 조정하기 어려움.
- 결정: `src/rewardBalanceConfig.js`를 보상 수치의 단일 원본으로 두고, 기존 도메인 모듈은 해당 설정을 소비하도록 변경. 기존 공개 API와 보상 결과는 유지.
- 영향: 경험치 설정, 사냥 전리품/이벤트/상인, 장비 경제, 업적/숙련도/성장 상한, 회귀 테스트, `docs/reward-balance.md`.
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs`.

## [L1] 2026-07-11 — Anti-stall 충격을 벽 반사 유도 세기로 강화
- 맥락: 충돌이 오래 없을 때 중앙에서 바깥으로 가속하는 anti-stall 충격이 기본 속도 200 대비 180~360으로 약했고, 중심부처럼 벽이 먼 위치에서는 속도 보정으로 인해 벽 반사까지 이어지지 않았음.
- 결정: 충격 방향은 기존처럼 경기장 중앙에서 바깥을 유지한다. 각 볼의 바깥 방향 벽까지 거리를 기준으로 약 1초 내 벽 도달에 필요한 속도를 계산하고, 충격을 최소 650~최대 2200으로 제한한다. 상대를 직접 겨냥하는 강제 충돌 방식은 사용하지 않는다.
- 영향: `src/simulation/battleSimulation.js`, `tests/regression.mjs`
- 검증: 기존 anti-stall 충격 방향/세기 회귀, 중심부 출발 후 1.25초 내 양쪽 벽 반사 회귀, 전체 테스트

## [L1] 2026-07-11 — 게임 시작 UI: 모드 선택 카드 도입 (토너먼트/사냥터)

- 맥락: 사용자 요청으로 "토너먼트 시작" 단일 버튼 대신 "게임 시작" 버튼 → 모드 선택 카드(토너먼트/사냥터) 2단계 플로우로 개편. 사냥터 접근성을 높이고 신규 사용자에게 선택지를 명확히 제시.
- 결정:
  (1) `start-button.html` — 버튼 텍스트 "토너먼트 시작" → "게임 시작", 클릭 시 `showGameModeSelect()` 호출.
  (2) `game-overlay.html` — 새 `gameModeSelectVisible` 상태 + 카드형 UI (⚔️토너먼트 / 🏹사냥터). 사냥터는 우승 캐릭터 없으면 비활성 + "토너먼트 우승 후 해금" 안내.
  (3) `componentBridge.js` — `showGameModeSelect()` 액션 추가.
  (4) `app.js` — `_syncStartButton()` 텍스트 "게임 시작"으로 변경, `showGameModeSelect()` 메서드 추가 (사냥터 가능 여부 전달).
- 영향: `src/components/start-button.html`, `src/components/game-overlay.html`, `src/componentBridge.js`, `src/app.js`
- 검증: `npm test`, `npm run format:check`, `npm run check` 통과

## [L3] 2026-07-11 — styles.css 죽은 CSS 전면 제거 (구 레이아웃 잔재 정리)

- 맥락: 이전 레이아웃(hero/status/matchup)에서 Alpine 컴포넌트로 마이그레이션된 후, 구 CSS 206줄이 `display: none !important`로 숨겨만 있고 제거되지 않음. 사용하지 않는 `.hero`, `.title-panel`, `.status-panel`, `.roster-panel`, `.log-panel`, `.eyebrow`, `h1`, `.subtitle`, `.status-badge`, `.matchup`, `.battle-layout`, `.panel-title`, `.legend`, `.top-bar`, `.debug-hidden`, `.balance-badge` 및 구 `.arena-shell`/`.arena` 정의, 죽은 `@media (max-width: 940px)` 블록, `body::before` 더미 등을 전량 제거.
- 결정: styles.css에서 사용되지 않는 모든 CSS 규칙 제거. 588줄 → 382줄 (206줄 감소, 약 35%).
- 영향: `src/styles.css`
- 검증: `npm test`, `npm run format:check`, `npm run check` 통과

## [L3] 2026-07-11 — 사냥터 진입/전투 후 패널 UI 동기화 누락 수정

- 맥락: 사냥터 진입 시 `startRun()`이 `playerFighterId`를 변경하지만 `refreshPlayerSetup()`을 호출하지 않아 패널 UI가 이전 캐릭터/상태로 남음. 또한 `_syncPlayerStatAllocationFromUi()` 동기화가 누락되어 토너먼트 진입(`startTournament`)과 달리 UI→게임 상태 싱크가 보장되지 않음. 일반 전투 승리 후에도 `refreshPlayerSetup()`이 호출되지 않아 XP 등 패널 정보가 갱신되지 않음.
- 결정:
  (1) `huntingManager.startRun()`에서 `playerFighterId` 변경 직후 `_syncPlayerStatAllocationFromUi()` + `refreshPlayerSetup()` 호출하여 UI→게임 상태 동기화 및 패널 갱신.
  (2) `_handleFinish` 일반 승리 경로에서 `showOverlay` 직전 `refreshPlayerSetup()` 호출하여 보스/패배 경로와 일관성 확보.
- 영향: `src/hunting/huntingManager.js` (startRun 2줄 추가, _handleFinish 1줄 추가)
- 검증: `npm test`, `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-11 — UI 컴포넌트 접근을 Alpine store 소유권으로 통일
- 맥락: `window.uiManager` 전역을 통해 UI 컴포넌트를 조회하면 Alpine store가 실제 소유자라는 사실이 가려지고, 템플릿 표현식도 전역 객체에 의존하게 됨.
- 결정: Alpine 템플릿의 UI 컴포넌트 조회는 `$store.uiManager`만 사용한다. 컴포넌트 정의 스크립트와 일반 ES 모듈은 `Alpine.store("uiManager")`를 사용한다. `window.uiManager` 별칭은 제거한다.
- 영향: `index.html`, `src/app.js`, `src/actionPicker.js`, `src/collectionHubService.js`, `src/patchNotesService.js`, `src/popup.js`, `src/components/game-overlay.html`, `tests/regression.mjs`
- 검증: 회귀 테스트, 브라우저 초기화/콘솔 확인, 문법 및 포맷 검사

## [L1] 2026-07-12 — gameBridge/requireGameUIComponent를 uiManager.getComponent/requireComponent로 전면 교체

- 맥락: `window.requireGameUIComponent → window.gameBridge.get → Alpine.store(uiManager)` 체인이 UI 컴포넌트가 `uiManager` store 소유임을 감춤. 게이트웨이 이름이 실제 소유자(`uiManager`)와 불일치.
- 결정:
  (1) `Alpine.store("uiManager")`가 직접 `getComponent(componentId)`와 `requireComponent(componentId)`를 노출. 기존 Proxy 바인딩/제어 흐름 유지.
  (2) `window.uiManager = Alpine.store("uiManager")` 신설 — 다른 모듈/스크립트에서 직접 접근 가능.
  (3) `index.html`에서 `window.gameBridge` 및 `window.requireGameUIComponent` 완전 제거. 대체 API로만 동작.
  (4) `src/app.js`의 9개 `requireGameUIComponent` 호출 → `window.uiManager.requireComponent`로 마이그레이션.
  (5) `src/popup.js` — `window.gameBridge.get("popupDialog")` → `window.uiManager.getComponent("popupDialog")`. PopupService의 `getComponent` 사용으로 명시적 null → Error reject 생애주기 유지.
  (6) `src/collectionHubService.js`, `src/patchNotesService.js` — `requireGameUIComponent` → `window.uiManager.requireComponent`.
  (7) `src/actionPicker.js` — `window.gameBridge?.get("actionPicker")` → `window.uiManager?.getComponent("actionPicker")`.
  (8) `src/components/game-overlay.html`, `src/components/xp-progress-bar.html` — `window.gameBridge?.get` → `window.uiManager?.getComponent`.
  (9) 테스트 하네스 — `gameBridge`/`requireGameUIComponent` 제거, `uiManager.getComponent`/`requireComponent` 계약 사용. 신규 회귀 `testNoGameBridgeInProduction` 추가.
- 영향: `index.html`, `src/app.js`, `src/popup.js`, `src/collectionHubService.js`, `src/patchNotesService.js`, `src/actionPicker.js`, `src/components/game-overlay.html`, `src/components/xp-progress-bar.html`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` 2회 연속, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs`, `git diff --check`, `rg "window\.gameBridge|requireGameUIComponent" src/` 결과 0.
- 보존: `requireGameActionBridge`(actionGateway.js)는 action gateway로서 별도 책임으로 유지. PopupService `_getPopupDialog` 생애주기(optional getComponent → null → 명시적 reject) 유지.

## [L1] 2026-07-12 — 필수 playerPanel.allocation 계약 강화: 무음 무시 대신 명시적 Error throw

- 맥락: 9c6e9ff(requireGameUIComponent) 이후에도 `_syncPlayerStatAllocationFromUi`에서 `if (!this._panel.allocation) return` 실런트 가드가 남아 필수 컴포넌트 상태 위반을 조용히 무시함. 더 심각한 문제는 object spread가 `null`/`undefined`를 무음 허용해 계약 위반이 감지되지 않음.
- 결정:
  (1) `_syncPlayerStatAllocationFromUi`에 `alloc === null || typeof alloc !== "object" || Array.isArray(alloc)` 검증 추가 — 위반 시 `[BattleApp] playerPanel.allocation(...)이(가) 유효하지 않습니다. playerPanel 컴포넌트는 반드시 객체 형태의 allocation을 초기 상태로 제공해야 합니다.` 명시적 Error throw. 무음 `return` 또는 빈 allocation으로의 fallback 금지.
  (2) `startTournament`에서 직접 `{ ...this._panel.allocation }` 대신 `this._syncPlayerStatAllocationFromUi()`로 동기화하여 동일 검증 경로 사용.
  (3) `testPreviewReselectQueuesDuringSwap` 마지막 어서션을 `assert.notEqual(initialId)`→`assert.equal(secondSwapPendingId)`로 변경 — `_previewSim.pendingId` 캡처로 결정론적 검증.
  (4) `testPlayerPanelAllocationContract` — silent guard 부재 + 명시적 assertion 존재 확인(Array.isArray/playerPanel.allocation 문자열 검증) + 정상 경로 동기화 검증.
  (5) `testPlayerPanelAllocationContractBoundary` — `undefined`/`null`/문자열/배열 경로에서 각각 한국어 Error throw 검증, 성공 후 `playerStatAllocation` 불변 확인.
- 영향: `src/app.js`(1줄 assertion+throw 추가, 1줄 위임 변경), `tests/regression.mjs`(기존 테스트 20줄 갱신 + boundary 60줄 재작성), `SESSION-HANDOFF.md`
- 검증: `npm test` 3회 연속 통과 (플레이크 없음), `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs`, `git diff --check` 통과.
- 보존: `this._panel.locked` gameplay state guard는 유지 (요청 범위 외).

## [L1] 2026-07-12 — 필수 UI 컴포넌트 강제 계약 도입 (requireGameUIComponent)

- 맥락: BattleApp이 `gameBridge.get()`으로 조회한 UI 컴포넌트를 `if (this._overlay)` 같은 optional guard로 감싸 누락 시 조용히 무시함. User는 구조적 원인 고침 없이 개별 패턴 추적에 지쳐, 필수 의존성은 생성 시점에 명시적 Error로 실패하도록 요구.
- 결정:
  (1) `window.requireGameUIComponent(id)` 신설 — gameBridge 경계 근처에서 필수 컴포넌트 미등록 시 한국어 Error throw.
  (2) BattleApp 생성자에서 9개 필드(`_bracket`, `_overlay`, `_panel`, `_startBtn`, `_log`, `_strip`, `_root`, `_toast`, `_huntingBtn`)를 `requireGameUIComponent`로 획득, 모든 optional guard 제거.
  (3) `collectionHubService.js`와 `patchNotesService.js`도 `window.gameBridge?.get()` → `requireGameUIComponent()`로 일괄 교체.
  (4) PopupService 패턴은 유지 (다른 라이프사이클, 명시적 Error reject 있음). `actionPicker.js`의 headless fallback은 유지 (명시적 설계).
  (5) 테스트 하네스에 `requireGameUIComponent` 및 누락 컴포넌트 등록 추가.
- 영향: `index.html`(requireGameUIComponent), `src/app.js`(전 필드 제거 + 5개 메서드 간소화), `src/collectionHubService.js`(3개 메서드), `src/patchNotesService.js`(2개 메서드), `tests/regression.mjs`(하네스 + 회귀 5종).
- 검증: `npm test`(5종 회귀 포함), `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs`, `git diff --check`, `rg` 미검증 통과.

## [L1] 2026-07-12 — 사냥 버튼 상태 동기화 복원 (_syncHuntingButton)

- 맥락: UIController/appStore 제거 후 huntingButton의 `available`/`tournamentActive` 상태가 `refreshPlayerSetup()`에 계산되지만 `this._huntingBtn`에 전파되지 않는 회귀. `_syncHuntingButtonStore` 제거로 인한 누락.
- 결정:
  (1) `BattleApp._syncHuntingButton()` 신설 — `available`(getEligibleHuntingCharacters > 0), `tournamentActive`(tournament && !champion)를 `this._huntingBtn`에 동기.
  (2) `refreshPlayerSetup()`에서 호출, 사냥터 active는 `setHuntingActive()`에서 유지.
  (3) `setHuntingActive()`가 `active` 설정 후 `_syncHuntingButton()` 호출하도록 변경.
  (4) `huntingAvailable` 지역변수 제거 (중복, `_syncHuntingButton`으로 대체).
- 영향: `src/app.js`(_syncHuntingButton 신설 + refreshPlayerSetup/setHuntingActive 연동), `tests/regression.mjs`(4종 회귀 테스트: 초기 비가시, 우승 자격 시 가시, 사냥 중 비가시, 토너먼트 중 비가시), `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs`, `git diff --check` 통과

## [L1] 2026-07-11 — Action Gateway 도입 + 전면 컴포넌트 리팩터 + 중복 게이트웨이 단일화

- 맥락: Codex 리뷰 + 설계 요청에 따라 (A) 액션 등록 전/후/미등록 액션을 명시적 Error throw로 보호하는 게이트웨이, (B) 사냥터 전 구간 결정론적 회귀 테스트, (C) 11개 컴포넌트의 금지 패턴(`$store.*`, `Alpine.data`, `window.ballFightApp`, `?.`)을 `window.createGameUI` + 로컬 상태 + `window.requireGameActionBridge`로 전량 교체, (D) `index.html`의 인라인 `requireGameActionBridge` 중복 구현을 모듈 import로 단일화, (E) `src/ui.js`에서 `UIController`/`appStore` 665라인 제거.
- 결정:
  (A) `src/actionGateway.js` 신설 — `registerGameActionBridge(bridge)` + `requireGameActionBridge(actionName?)`. 등록 전 호출 및 미등록 액션 호출 시 Error throw. `main.js`에서 `createComponentBridge` 완료 후 `registerGameActionBridge(gameActionBridge)` 호출. `index.html` 모듈에서 `actionGateway.js` 동적 import로 `window.requireGameActionBridge` 할당.
  (B) `tests/regression.mjs`에 hunting-end-to-end 결정론적 검증 + action gateway 등록 전/후/미등록 액션 회귀 테스트 추가. 테스트 하네스 정리: `appStore()`, `UIController`, 로컬 `createComponentBridge(Alpine)` 스텁 240라인 제거, stale 테스트 3종 제거.
  (C) 11개 컴포넌트 마이그레이션: `player-panel`, `game-overlay`, `start-button`, `hunting-button`, `collection-hub`(기존 5종) + `battle-log`, `fighter-strip`, `patch-notes`, `toast-notification`, `tournament-bracket`, `xp-progress-bar`, `xp-reward-panel`(신규 7종). `$store.*` 읽기를 컴포넌트 로컬 상태 + `window.gameBridge?.get()` 호출로 교체. `Alpine.data` → `window.createGameUI`. `patchNotesService`도 `Alpine.store` 대신 `window.gameBridge?.get("patchNotes")` 사용.
  (D) `src/ui.js` `UIController`/`appStore` 전량 제거 — 캔버스 전용 `ArenaRenderer`만 유지. 모든 UI 상태 책임을 Alpine 컴포넌트 + `componentBridge`로 이전.
  (E) `componentBridge.js`에 `CollectionHubService.open` 위임 메서드(`openCollectionHub`/`openEquipmentHub`) 추가, `index.html`에서 `window.PopupService` 직접 할당 제거.
- 영향: `src/actionGateway.js`(신규), `src/componentBridge.js`, `src/main.js`, `index.html`, `src/ui.js`, `src/componentLoader.js`, `src/patchNotesService.js`, `src/components/player-panel.html`, `src/components/game-overlay.html`, `src/components/start-button.html`, `src/components/hunting-button.html`, `src/components/collection-hub.html`, `src/components/battle-log.html`, `src/components/fighter-strip.html`, `src/components/patch-notes.html`, `src/components/toast-notification.html`, `src/components/tournament-bracket.html`, `src/components/xp-progress-bar.html`, `src/components/xp-reward-panel.html`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs`, `rg` 금지 패턴 검사 통과

## [L1] 2026-07-12 — 상자 개봉 로직을 collectionHubService → componentBridge로 이동

- 맥락: Codex 리뷰 결과 `CollectionHubService.openChest`가 `globalThis.ballFightApp` 직접 접근, `openHuntingChest`/`savePlayerProfile` 동적 import, `window.gameBridge.get("popupDialog")` 직접 호출로 단일 책임을 위반함. CollectionHubService는 UI 뷰 서비스로, 게임 액션은 componentBridge가, 팝업은 PopupService가 소유해야 함.
- 결정:
  (1) `componentBridge.js`에 `openChest(chestId)` 신설 — `openHuntingChest` 정적 import, `PopupService`로 실패/성공 피드백, `savePlayerProfile`/`_refreshCollectionHub` 호출. 일관된 `boolean` 반환.
  (2) `CollectionHubService.openChest` 제거 및 모든 게임플레이/동적 import 의존성 정리.
  (3) `collection-hub.html`의 `openChest(item)`이 `bridge.openChest(item.id)`로 위임 (`window.CollectionHubService` 우회).
  (4) 회귀 테스트 4종 신설: CollectionHubService blacklisted refs 부재, bridge.openChest 존재, 실패 시 PopupService 호출 + false 반환, 성공 시 저장/갱신 + PopupService 호출 + true 반환.
- 영향: `src/componentBridge.js`, `src/collectionHubService.js`, `src/components/collection-hub.html`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run check`, `npm run format:check` 통과

## [L1] 2026-07-10 — UI/gameBridge 리팩터: gameActionBridge 분리 + 사냥터 app.ui 의존 제거

- 맥락: Codex 설계 리뷰 결과, 기존 `window.ballFightApp` 직접 참조(4개 컴포넌트), 삭제된 `componentBridge.js` 의존, `HuntingManager`의 `app.ui.*` 호출 오류, `ActionPickerService`가 ID 대신 인덱스 반환 문제가 확인됨. 단일 책임 원칙에 따라 BattleApp은 게임 데이터 소유자, Alpine 컴포넌트는 시각/로컬 상태만 소유하도록 정리.
- 결정:
  (1) `src/componentBridge.js` 신설 — `createComponentBridge(app)` 팩토리로 명시적 액션 경계 생성. `window.gameActionBridge`로 노출.
  (2) `HuntingManager`의 모든 `app.ui.*` 호출을 `BattleApp` 직접 메서드(`app.*`)로 마이그레이션.
  (3) 4개 컴포넌트(`player-panel`, `start-button`, `hunting-button`, `game-overlay`)의 `window.ballFightApp` 참조를 `window.gameActionBridge`로 일괄 대체.
  (4) `collection-hub.html`에 `bridge` getter 추가 — equipment action 7종(`equipItem`, `unequipItem`, `enhanceItem`, `fuseItem`, `disassembleItem`, `sellItem`, `expandInventory`)을 bridge 경계로 노출, 실제 프로필 변이/저장/갱신 동작.
  (5) `ActionPickerService.show()`가 카드 ID 반환, 컴포넌트에서 선택 후 `visible=false`/`cards=[]` 초기화, 동시 호출 시 이전 Promise를 `-1`로 resolve.
  (6) `popup-dialog.html` `show()` 동시 호출 시 이전 Promise를 `"cancel"`로 resolve.
  (7) 회귀 테스트 4종 신설: huntingManager `app.ui.*` 미참조, bridge 장비 액션 7종 존재+프로필 변이, ActionPickerService ID 반환, 동시성 결정론적 처리.
- 영향: `src/componentBridge.js`(신규), `src/hunting/huntingManager.js`, `src/main.js`, `src/actionPicker.js`, `src/components/collection-hub.html`, `src/components/player-panel.html`, `src/components/start-button.html`, `src/components/hunting-button.html`, `src/components/game-overlay.html`, `src/components/action-picker.html`, `src/components/popup-dialog.html`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run check`(125파일), `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-12 — PopupService 정적 의존 전환 (window.PopupService 제거)

- 맥락: componentBridge/huntingManager/player-panel이 `typeof window.PopupService` 방어적 가드 또는 `window.PopupService?.show?.()`로 PopupService에 접근. 이는 구조적 보장이 없는 전역 의존 패턴으로, 모듈 간 의존이 암시적이고 누락 시 조용히 무시됨.
- 결정:
  (1) PopupService — popupDialog 조회를 `_getPopupDialog()`로 중앙화, `_testDialog` 테스트 주입 경로 추가. `show()`가 popupDialog 미등록 시 `Promise.reject(Error)`로 명확히 실패, 조용한 cancel 반환 제거.
  (2) componentBridge — PopupService 정적 import, 14개 `typeof window.PopupService` 가드 전부 제거. `openHelp` 액션 신설 (HELP_TITLE/HELP_CONTENT 사용).
  (3) huntingManager — PopupService 정적 import, `if (window.PopupService)` 3개 가드 전부 PopupService 직접 호출로 교체.
  (4) player-panel.html — `window.PopupService?.show?.()` help 호출을 `window.gameActionBridge.openHelp()`로 교체. 컴포넌트는 intent만 emit.
  (5) 테스트 — `globalThis.window = { PopupService: ... }` 전역 뮤테이션 제거, `PopupService.setTestDialog()` 의존 주입 경로로 변경. 신규 회귀 테스트 5종 추가 (window.PopupService 미존재, bridge openHelp 위임, hunting 정적 import, show 실패 clear error, equipment/chest popup seam 경로).
- 영향: `src/popup.js`, `src/componentBridge.js`, `src/hunting/huntingManager.js`, `src/components/player-panel.html`, `tests/regression.mjs`

## [L1] 2026-07-12 — popup-dialog 동시성 타이밍 버그 수정: closePopup _resolve 캡처 시점 변경

- 맥락: `popup-dialog.html`의 `closePopup()`이 `setTimeout` 콜백 내부에서 `_resolve`를 읽어 `show()`가 그 사이에 `_resolve`를 덮어쓰면 이전 close의 지연 resolve가 새 popup의 Promise를 잘못 해결함. 동시 show/close 패턴에서 popup A가 영원히 pending 상태에 빠지거나 "close"가 아닌 "cancel"로 resolve되는 경합 조건 발생.
- 결정:
  (1) `closePopup()`에서 `_resolve`를 `captured`로 즉시 캡처하고 `_resolve = null`로 동기 클리어. `setTimeout` 콜백은 `captured`만 참조하여, 이후 `show()`가 `_resolve`를 바꿔도 이전 popup의 close가 올바른 Promise를 resolve함.
- 영향: `src/components/popup-dialog.html` (closePopup 내 3줄 변경), `tests/regression.mjs` (회귀 테스트 `testPopupResolverCapture` 신설)
- 검증:
  - `npm test` — `[popup-resolver-capture] ok` 포함 전 테스트 통과
  - `npm run check` — syntax ok (125 files)
  - `npm run format:check` — 모든 파일 Prettier 준수

## [L1] 2026-07-08 — 전투원 물리 계층을 배틀 규칙 아래로 분리한다
- 맥락: 사용자가 BattleSimulation은 실제 실행 앱/게임 규칙 계층이어야 하고, Simulation과 BattleSimulation 사이에 전투에 필요한 공통 구현을 담는 중간 클래스가 있어야 한다고 명확히 정리했다. 직전 구현은 PreviewReselectSimulation이 독립 미니 물리 구현처럼 남아 구조 의도와 완전히 맞지 않았다.
- 결정: (1) `src/simulation/fighterPhysicsSimulation.js`를 공통 전투원 물리 계층으로 추가/정리. (2) `BattleSimulation extends FighterPhysicsSimulation`으로 변경하고, 충돌 탐지/분리/rigid-body 충돌은 중간 계층이 소유. (3) BattleSimulation에는 데미지, 숙련도, dash/ability collision, anti-stall, 결과 판정 같은 게임 규칙 훅만 남김. (4) `PreviewReselectSimulation`도 FighterPhysicsSimulation을 상속해 같은 충돌/피드백 흐름을 재사용. (5) 계층 구조 회귀 테스트 추가.
- 영향: `src/simulation/fighterPhysicsSimulation.js`, `src/simulation/battleSimulation.js`, `src/preview/previewReselectSimulation.js`, `tests/regression.mjs`, `docs/development-rules.md`, `src/patchNotes.js`, `index.html`


## [L1] 2026-07-08 — 프리뷰 재선택 충돌을 전투 물리 피드백으로 맞춘다

- 맥락: 프리뷰 재선택 시 기존 충돌이 단순 속도 교환(impulseMag = -velAlongNormal * 0.5)에 불과해 outgoing 볼이 약하게 밀릴 뿐이고, spark/pulse/화면 흔들림 같은 전투 피드백이 없었음. 텍스트 레이블이 incoming 볼을 따라 날아다니는 문제도 있었음.
- 결정: (1) `src/preview/previewReselectSimulation.js` 신설 — preview 전용 시뮬레이션 모듈. `BattleApp`의 ad hoc 물리를 완전히 대체. (2) `applyDynamicCollisionResponse` 공유 물리 helper 사용, incoming 볼에 impactA=10(10배 impact)으로 heavy striker 효과 구현. (3) collision cooldown(0.15s)으로 반복 spark 방지. (4) 충돌 시 `VisualBurst`(spark) + `GravityParticle`(particle burst) + `_triggerScreenShake` 피드백. (5) `renderPlayerPreviewSwap`에서 텍스트 레이블 제거, `previewSim.draw(ctx)`로 sim 내부 entities(효과)도 함께 그리도록 변경. (6) 테스트 4종 신설: heavyKnockAway(충돌 후 outgoing velocity ≥ 50 검증), collisionFeedback(effect entity count 증가 확인), labelsHidden(스왑 중 `_previewSim` 존재, 완료 후 null 검증), 기존 테스트 `_previewSwap` → `_previewSim` 마이그레이션.
- 영향: `src/preview/previewReselectSimulation.js`(신규), `src/app.js`(reselectPreviewCharacterFromPreview/_updatePreviewSwap/선언 일체를 sim 위임으로 변경), `src/ui.js`(renderPlayerPreviewSwap 레이블 제거 + sim draw 위임), `tests/regression.mjs`(기존 6종 갱신 + 신규 4종), `index.html`(V 0.24.14), `src/patchNotes.js`(v0.24.14), `SESSION-HANDOFF.md`, `docs/development-rules.md`

## [L1] 2026-07-08 — 프리뷰 재선택 확정을 물리 전환 완료 시점으로 늦춘다

- 맥락: 기존 구현이 프리뷰 캐릭터 재선택 시 즉시 `playerFighterId`/스탯/UI를 변경하고 물리 전환은 0.8초 후 완료되어, 첫 탭에서 "캐릭터만 바뀌고 멈춘 것처럼" 보이는 문제(빠른 두 번째 탭은 `canReselectPreviewCharacter()`가 차단해 dead tap으로 느껴짐).
- 결정: (1) 재선택 시 `pendingId`만 `_previewSwap`에 저장하고 `playerFighterId`/스탯/UI 변경은 `_updatePreviewSwap` 최종화 시점으로 지연. (2) 스왑 중 탭/리셀렉트는 `_queuedPreviewReselect` 플래그로 큐잉하고, 최종화 후 조건 재확인 후 바로 다음 스왑 실행. (3) `_previewBall`과 `playerFighterId` 불일치 제거. (4) 기존 차단 조건(tournament/시뮬레이션/헌팅/잠금)은 큐 처리 시에도 재확인.
- 영향: `src/app.js`(reselectPreviewCharacterFromPreview 지연, _updatePreviewSwap 최종화+큐 처리, _bindPreviewReselectInput 큐), `tests/regression.mjs`(기존 2종 갱신 + testPreviewReselectQueuesDuringSwap 신규), `src/patchNotes.js`(v0.24.13), `index.html`(V 0.24.13), `SESSION-HANDOFF.md`

## [L1] 2026-07-08 — WallSlam 회전을 물리 기반 angular impulse로 전환

- 맥락: WallSlam 효과가 시각 전용 `display.spinRotation`을 사용해 물리 각속도와 무관한 회전을 보여줌. 회전 물리(applyAngularImpulse, _inverseMomentOfInertia, integrateRotation)가 이미 완비되어 WallSlam도 물리 impulse로 전달해야 일관성 확보.
- 결정: (1) WallSlamEffect.updateSpin() 제거 → _applyPhysicalAngularImpulse() 신설 (one-shot, angularImpulseApplied 가드). (2) impulse = desiredOmega / invI 또는 fallback mass*radius*speed*0.35, desriedOmega = sign*clamp(speed/radius*1.2, 5, 14). (3) BattleBall.display.spinRotation 필드 및 wallSlamSpin face 회전 합성 제거, faceRotation = polygon ? angle : rotationEnabled ? angle : 0. (4) 테스트: testWallSlamSpinPreserved → testWallSlamUsesPhysicalAngularImpulse, testEaterFeast에서 spinRotation 대신 angularVelocity 검증. (5) rotationEnabled===false 볼은 WallSlam angular impulse 영향을 받지 않음.
- 영향: `src/combatEffects.js`, `src/entities/battleBall.js`, `tests/regression.mjs`, `src/patchNotes.js`, `index.html`(V 0.24.11), `docs/development-rules.md`, `docs/hunting-grounds-system.md`, `SESSION-HANDOFF.md`
- 검증: `npm run format:check`, `npm run check`, `npm test`, `node scripts/huntingUserScenario.mjs`

## [L1] 2026-07-08 — 모바일 세팅 화면 스크롤을 패널 내부로 수정 (문서 스크롤 철회)

- 맥락: 09d5d9e에서 도입한 문서 스크롤 방식(body overflow-y:auto, .app/.game-frame height:auto)이 아레나/프리뷰/시작 버튼 영역까지 함께 스크롤되게 하여 사용자가 원하는 동작과 반대였음. 상단 영역은 뷰포트에 고정되고 하단 장비/스탯 패널만 스크롤되어야 함.
- 결정: (1) body 모바일 overflow-y:auto → overflow:hidden 복원 (문서 스크롤 제거). (2) `setup-mode` 클래스 CSS 규칙과 Alpine 바인딩 제거 — 더 이상 문서 스크롤을 활성화하지 않음. (3) `.tournament-panel.setup-hidden`에 overflow-y:auto, touch-action:pan-y 유지/보강 — 하단 패널이 유일한 세로 스크롤 소유자. (4) `player-panel` 모바일 portrait :scope에서 max-height:none + overflow:visible로 변경 — 중첩 스크롤 방지, 부모 `.tournament-panel`이 스크롤 책임.
- 영향: `src/styles.css`, `src/components/player-panel.html`, `index.html`, `src/patchNotes.js`, `SESSION-HANDOFF.md`
- 검증: `npm run format:check`, `npm run check`, `npm test`, `node scripts/huntingUserScenario.mjs`, 390x844 모바일 브라우저에서 `window.scrollY=0` 유지 + `.tournament-panel.scrollTop=285` 증가 + 하단 액션/스탯 버튼 가시성 확인

## [L1] 2026-07-08 — 모바일 세팅 화면 스크롤을 문서 스크롤로 전환

- 맥락: 사용자 실기기 스크린샷에서 장비/스탯 패널은 화면 아래로 이어지지만 터치 스크롤이 실제로 먹지 않는 문제가 재현됨. 이전 수정은 `.tournament-panel.setup-hidden` 내부 nested scroll에 의존했는데, 모바일 브라우저에서는 상위 `body/.app/.game-frame`의 `overflow:hidden` 조합 때문에 터치 이벤트가 스크롤 대상으로 안정적으로 전달되지 않을 수 있음.
- 결정: (1) `.app`에 `setup-mode` 클래스를 Alpine으로 부여. (2) 모바일에서는 `body`의 세로 스크롤을 허용. (3) 모바일 portrait setup-mode에서 `.app`과 `.game-frame`을 `height:auto`, `overflow:visible`로 전환해 아레나+플레이어 패널 전체가 문서 스크롤로 내려가게 함. (4) setup-mode의 `.tournament-panel.setup-hidden`은 내부 스크롤 대신 자연 높이로 펼치도록 `flex:0 0 auto`, `overflow:visible`로 보정. (5) 패치노트 v0.24.9와 캐시 버스터 갱신.
- 영향: `index.html`, `src/styles.css`, `src/patchNotes.js`, `SESSION-HANDOFF.md`

## [L1] 2026-07-08 — Hero Ball Hero Orb carryover를 사냥터 층간 유지

- 맥락: 일반 전투에서 Hero Ball로 Hero Orb stat(HP/대미지/속도/방어/스킬)을 획득한 carryover가 사냥터 층간 유지되지 않음. 기존 `app.js.startMatch`에서 Hero Orb carryover 루프가 모든 match에 적용되지만 사냥터 경로는 `huntingManager._startFloorBattle()`을 통해 별도로 spec을 구성해 전달하므로 carryover가 누락됨.
- 결정: (1) `BattleBall`에 `applyHeroOrbCarryover(carryover)` 인스턴스 메서드 추가 — `applyHeroOrbCarryoverToBattleBall` 함수에 위임, bonuses에 반영되지 않음. (2) `BattleBall.mergeHeroOrbCarryoverInto(targetSpec)` 인스턴스 메서드 추가 — `mergeHeroOrbCarryover` 함수에 위임, 상태 병합 및 carryover 반환. (3) `app.js`에서 startMatch carryover 루프 제거 (생성자 위임). (4) `app.js.finishMatch`에서 `mergeHeroOrbCarryover(winnerSpec, ...)` → `this.simulation.winner.mergeHeroOrbCarryoverInto(winnerSpec)`으로 교체. (5) `huntingState.createHuntingRun` 반환값에 `hero: { bonuses, carryover }` 구조 추가. (6) `huntingManager._startFloorBattle`에서 `run.hero.carryover` 주입 — Hero Ball(`ability === "hero"`)만 적용. (7) `huntingManager._handleFinish`에서 `playerBall.mergeHeroOrbCarryoverInto(this._run)`으로 위임, `recordHuntingFloorResult`보다 먼저 계산. (8) 회귀 테스트 4종: BattleBall carryover 적용/merge, 사냥터 carryover 주입 조건/병합 위임.
- 영향: `src/entities/battleBall.js`(메서드 2종 + 위임), `src/app.js`(루프 제거 + import 변경 + merge 위임), `src/hunting/huntingState.js`(createHuntingRun hero 구조), `src/hunting/huntingManager.js`(carryover 주입 조건 + 위임 + 순서 변경), `tests/regression.mjs`(테스트 4종)
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-08 — 사냥터 몹 표시명 일반화와 미확보 전리품 HUD 추가
- 맥락: 전투 진입 문구는 `전투 발생 · 적 N명`으로 바뀌었지만 실제 전투 UI에는 일반 몹 이름이 `근접 몹 1`/`원거리 몹 2`처럼 노출되어 사용자가 적 구성 문구가 여전히 타입 중심이라고 느꼈음. 또한 층 이동/선택 시 미확보 상자와 파편을 중앙 문구 외에 지속적으로 확인하기 어려웠음.
- 결정: (1) 내부 `HUNTING_MONSTER_TYPES.MELEE/RANGED`, ability, stats, `hunting.monsterType`은 유지하되 UI-visible 일반 몹 name/title/description에서 근접/원거리 라벨을 제거하고 `하수인` 계열 표시명으로 통일. (2) `gameOverlay`에 우상단 `미확보 전리품` HUD를 추가해 이동/선택/상인 화면에서 pendingLoot 파편/상자 수를 별도로 보여줌. (3) 전리품이 없으면 HUD를 숨기고, 패배/귀환/스테이지 클리어/overlay hide 시 초기화.
- 영향: `src/hunting/huntingMonsters.js`, `src/hunting/huntingManager.js`, `src/components/game-overlay.html`, `src/ui.js`, `index.html`, `tests/regression.mjs`
- 검증: `npm run format:check`, `npm run check`, `npm test`, `node scripts/huntingUserScenario.mjs`

## [L1] 2026-07-07 — 사냥터 상인 선택지와 전리품 손실 표시 개선
- 맥락: 방랑 상인 이벤트가 실제 선택지를 제공하지 않고, 전투 문구가 몬스터 타입을 오해하게 만들며, 패배 시 미확보 상자가 사라지는 이유가 UI에 드러나지 않았음.
- 결정: (1) 방랑 상인은 상시 보유 사냥 파편(`profile.hunting.shards`)으로 결제하는 3개 선택지(회복/상자 구매/안전 운송)와 계속 전진 선택을 제공. (2) 전투 진입 문구는 몬스터 타입 나열 대신 `전투 발생 · 적 N명`으로 단순화. (3) 선택 UI 요약에 미확보 상자 개수를 표시하고, 패배 손실 문구에 상자 등급별 파괴 개수를 표시. (4) 빈 전리품 요약은 출력하지 않아 포탈/이벤트 안내를 가리지 않음.
- 영향: `src/hunting/huntingMerchant.js`, `src/hunting/huntingFormat.js`, `src/hunting/huntingManager.js`, `src/components/game-overlay.html`, `src/componentBridge.js`, `src/ui.js`, `index.html`, `tests/regression.mjs`
- 검증: `npm run format:check`, `npm run check`, `npm test`, `node scripts/huntingUserScenario.mjs`

## [L1] 2026-07-07 — Anti-stall 장치 도입 (8초 무충돌 감지 → 중앙 충격파)
- 맥락: 전투 중 양측이 충돌하지 않고 멀리서 배회하는 상황(stall)이 발생할 수 있어, 강제로 교전을 유도하는 장치가 필요. AI/길찾기 개입 없는 순수 물리 impulse 방식.
- 결정: (1) `ANTI_STALL_INTERVAL=8` 상수, `_antiStallTimer`/`_antiStallBurstCount` 상태 추가. (2) `handleFighterCollision()`에서 적대 충돌 시 타이머 리셋 (아군 충돌 무시). (3) `update()`→`handleCollision()` 직후 `_checkAntiStall(delta)` 호출. (4) `_fireAntiStallBurst()` — 활성 전투원 ≥ 2명이면 중앙→외부 방향 impulse 적용, 결정론적 각도(위치 기반, 중앙 근접 시 인덱스 기반), `clamp(baseSpeed*0.85, 180, 360)` magnitude. (5) 시각 피드백: 중앙 `spawnExplosion`/`spawnPulse`/`playSound("dash")`/한국어 로그. (6) 회귀 테스트 4종: 타임아웃 전 미발동, 8초 발동, 충돌 리셋, 패배 스킵. (7) docs 갱신.
- 영향: `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `docs/development-rules.md`, `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run format:check`
- 후속 수정: `_fireAntiStallBurst()`에 적대 쌍(hostile pair) 가드 추가 — 활성 전투원 중 `isHostile(a,b) === true`인 쌍이 없으면 burst 미발동, 로그 문자열 완전 한글화. friendly-only 테스트 `[anti-stall-friendly]` 추가, burst 테스트에서 양쪽 전투원 outward 방향 검증 강화.

## [L1] 2026-07-07 — BattleBall 초기 각도 기본값을 0도로 변경 (대기화면 upright)
- 맥락: 대기화면/캐릭터 선택 UI에서 캐릭터가 무작위 각도로 기울어져 있어 모든 캐릭터가 비뚤어져 보이는 문제. `rotationEnabled=false`는 각도 0으로 올바르게 동작했지만, 기본 활성화된 회전에서 `Math.random() * PI * 2`로 각도가 설정되어 캐릭터가 이상하게 보임.
- 결정: (1) polygon 기본 `angle`을 `Math.random() * PI * 2` → `0`으로 변경 (단, `appearance.angle` 명시 시 우선). (2) circle 기본 `angle`을 `Math.random() * PI * 2` → `0`으로 변경. (3) `angularVelocity`는 `randomSpin()` 유지 (runtime 회전은 이 각속도와 충돌 impulse로 동작). (4) 회귀 테스트 `testDefaultPolygonAngleIsZero` 신설, `testCircleMinAngularVelocity`에 `angle === 0` 검증 추가. (5) `docs/development-rules.md`에 기본 각도 0 정책 문서화.
- 영향: `src/entities/battleBall.js`, `tests/regression.mjs`, `docs/development-rules.md`, `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs`

## [L1] 2026-07-07 — 접촉점 속도 기반 회전 손상 기여 시스템 도입
- 맥락: 충돌 대미지가 선형 속도만 고려하고 각속도(회전)는 무시함. 회전하는 볼이 접촉점에서 더 큰 상대 속도를 가지므로 +60% capped 회전 손상 보너스를 Crash/Dash Contact/Vampire Contact 경로에 추가.
- 결정: (1) `src/physics/contactDamage.js` 신설 — `getContactPointVelocity(body, contactPoint)`, `calculateRotationalContactDamageBonus(body, contactPoint, options)` (0~0.6 계수), `applyRotationalContactDamage(baseDamage, body, contactPoint, options)` (최종 대미지). (2) `BattleSimulation.calculateCollisionDamageWithContact(attacker, defender, normal, contactPoint)` 신설 — 기존 충돌 대미지 + 회전 보너스. (3) `handleFighterCollision`에서 `result.contactPoint` 전달. (4) `DashEffect.onCollision(attacker, defender, simulation, contactPoint)`에 contactPoint 파라미터 추가. (5) `VampireAbility.onCollision(target, context)`에 context 파라미터 추가. (6) 기존 `onCollision` 단일 파라미터 인터페이스와 하위 호환성 유지. (7) docs/회귀 테스트 갱신.
- 영향: `src/physics/contactDamage.js`(신규), `src/physics/index.js`, `src/simulation/battleSimulation.js`, `src/combatEffects.js`, `src/abilities/vampireAbility.js`, `tests/regression.mjs`, `docs/development-rules.md`, `SESSION-HANDOFF.md`
- 검증: `npm test` (38개 스위트), `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-07 — 물리 재질 소유권을 PhysicsMaterialBody 믹스인으로 리팩터
- 맥락: 125d8f5에서 `battleBall.js`에 `this.physicsMaterial = "rubberBall"`이 직접 할당되어 있었고, 이는 재사용 가능한 물리 바디 능력(capability)으로서 믹스인에 적합.
- 결정: (1) `src/physics/PhysicsMaterialBody.js` 신설 — `(Base) => class extends Base` 형태 믹스인, constructor에서 `this.physicsMaterial = "wood"` 기본값, `setPhysicsMaterial(material)`, `getResolvedPhysicsMaterial()` 제공. (2) `BattleBall`이 `PhysicsMaterialBody` 믹스인을 사용, 클래스 선언에 추가, `setPhysicsMaterial(spec.physicsMaterial ?? "rubberBall")`로 재질 설정. (3) 기존 `this.physicsMaterial = "rubberBall"` 직접 할당 제거. (4) `collisionResponse.js`에서 `body.physicsMaterial` 참조는 믹스인 제공 필드를 그대로 사용하므로 변경 불필요. (5) docs/회귀 테스트 갱신.
- 영향: `src/physics/PhysicsMaterialBody.js`(신규), `src/physics/index.js`, `src/entities/battleBall.js`, `tests/regression.mjs`, `docs/development-rules.md`, `SESSION-HANDOFF.md`

## [L1] 2026-07-07 — 물리 재질 시스템 도입 (material-owned friction/restitution)
- 맥락: restitution/friction이 collisionResponse.js의 기본값과 각 호출 사이트에 하드코딩된 magic number로 흩어져 있음. 변경 시 모든 호출 사이트를 수동 추적해야 함. 정상적인 물리 엔진은 body/surface가 재질을 소유함.
- 결정: (1) `src/physics/PhysicsMaterial.js` 신설 — `PHYSICS_MATERIALS` 카탈로그(rubberBall/wall/wood/stone/ice/metal), `resolvePhysicsMaterial()`, `combinePhysicsMaterials()` (restitution=max, friction=sqrt(a*b)). (2) `collisionResponse.js`의 `applyCollisionResponse`/`applyDynamicCollisionResponse`가 `body.physicsMaterial` + `options.surfaceMaterial`에서 restitution/friction을 추론, 명시적 옵션이 재질 조합을 덮어씀. (3) `battleBall.js`에 `physicsMaterial = "rubberBall"` 기본값 추가. (4) 모든 런타임 호출 사이트가 explicit restitution/tangentialFriction 대신 material 옵션 사용. (5) docs 갱신. (6) 회귀 테스트 추가.
- 영향: `src/physics/PhysicsMaterial.js`(신규), `src/physics/collisionResponse.js`, `src/physics/index.js`, `src/entities/battleBall.js`, `src/simulation/simulation.js`, `src/terrain/terrainCollision.js`, `src/physics/CollisionShape.js`, `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `docs/development-rules.md`, `SESSION-HANDOFF.md`

## [L1] 2026-07-07 — 튀는 리듬은 유지하고 마찰을 나무 수준으로 상향
- 맥락: 사용자가 `restitution`과 마찰은 별개임을 확인했고, 게임 특성상 튀는 느낌은 유지하되 미끄러짐만 줄이길 원함. 이전 0.08 접선 마찰은 여전히 매끈하게 느껴질 수 있음.
- 결정: (1) 벽/지형/볼-볼 충돌의 `tangentialFriction`을 0.20으로 상향. (2) `applyCollisionResponse`/`applyDynamicCollisionResponse` wrapper 기본값도 0.20으로 통일해 명시값 없는 호출도 같은 기준을 사용. (3) `restitution`은 유지.
- 영향: `src/physics/collisionResponse.js`, `src/simulation/simulation.js`, `src/simulation/battleSimulation.js`, `src/physics/CollisionShape.js`, `src/terrain/terrainCollision.js`, `docs/development-rules.md`, `SESSION-HANDOFF.md`

## [L1] 2026-07-07 — 충돌 접선 마찰을 올려 미끄러짐 체감 완화
- 맥락: 캐릭터 회전은 정상적으로 보이지만, 벽/지형/볼 충돌 후 움직임이 지나치게 미끄러지듯 보임. 확인 결과 접선 마찰이 벽/지형 0.03, 볼-볼 0.05로 낮고, angular impulse를 물리적으로 1배 적용한 뒤 표면 마찰이 약하게 체감됨.
- 결정: (1) `collisionResponse.js` 기본 `tangentialFriction`을 0.03→0.08로 상향. (2) 벽/지형/볼-볼 런타임 호출의 명시적 `tangentialFriction`도 0.08로 통일. (3) 반발 계수와 angularDamping은 전투 리듬을 과하게 둔하게 만들 수 있어 이번 변경에서 제외.
- 영향: `src/physics/collisionResponse.js`, `src/simulation/simulation.js`, `src/simulation/battleSimulation.js`, `src/physics/CollisionShape.js`, `src/terrain/terrainCollision.js`, `docs/development-rules.md`, `SESSION-HANDOFF.md`

## [L1] 2026-07-06 — 충돌 impulse가 실제 angularVelocity에 같은 프레임/동적 원형 충돌에서 반영되도록 수정
- 맥락: (1) 유저 ball이 충돌해도 angularVelocity가 변하지 않음. 원인: circle-circle 충돌의 contactPoint가 normal과 동일선상이어서 r×normal=0 → angular impulse=0. (2) `BattleBall.update()`에서 `integrateRotation`이 `keepInsideArena`보다 먼저 실행되어 벽 충돌 angular impulse가 다음 프레임에나 반영됨.
- 결정: (1) `BattleBall.update()` 순서 변경 — 위치 적분 후 `keepInsideArena(this)` → `bounced → forcedHeading 해제` → `integrateRotation(delta)` 순으로 재배열. (2) `applyDynamicCollisionResponse`에 접선 마찰/스핀 교환 추가 — 각 body의 접촉점 속도(선형 + 각속도 ω×r 기여) 계산, 접선 상대 속도 기반 friction torque 적용. (3) `_applyAngularCollisionResponse`에 `tangentialFriction: 0.05` 전달. (4) 테스트 2종: `testPlayerCircleCollisionChangesAngularVelocity` (circle-circle 충돌 후 angularVelocity 변화 검증), `testWallCollisionAngularImpulseAppliesSameUpdate` (벽 충돌 impulse가 같은 `update()` 프레임에 angularVelocity에 반영되는지 검증).
- 영향: `src/entities/battleBall.js`, `src/physics/collisionResponse.js`, `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `docs/development-rules.md`, `SESSION-HANDOFF.md`
- 검증: `npm test` (신규 [circle-circle-angular], [wall-same-update] 포함), `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-06 — 기본 볼 회전이 프레임 독립적으로 계속 보이게 수정
- 맥락: 원형 캐릭터가 초기 각도만 있고 실제로 "도는" 회전이 보이지 않음. (1) 기본 각속도 -0.4~0.4 rad/s로 너무 느리고 0에 가까울 수 있음. (2) angularDamping이 매 프레임 단순 곱셈이라 60fps 1초 뒤 각속도가 0.98^60≈0.30으로 급감.
- 결정: (1) angularDamping을 프레임레이트 독립적으로 변경 — `angularVelocity *= Math.pow(angularDamping, delta)`. 기본 0.98은 초당 98% 유지율. (2) `randomSpin(min, max)` 헬퍼 신설 — sign * (0.9 + Math.random() * 0.7) rad/s로 최소 0.9 rad/s 보장. (3) 원형 캐릭터 기본 각속도를 `randomSpin()`으로 교체. (4) 다각형 몹 `generateMobAppearance`도 동일 헬퍼 사용. (5) `appearance.angularVelocity` 명시 시 기존값 우선 유지. (6) `rotationEnabled: false` 동작 변경 없음.
- 영향: `src/core.js`, `src/physics/RotationalBody.js`, `src/entities/battleBall.js`, `src/entities/mobAppearance.js`, `tests/regression.mjs`, `docs/development-rules.md`, `docs/hunting-grounds-system.md`, `SESSION-HANDOFF.md`
- 검증: `npm test` (신규: testFrameRateIndependentDamping, testRandomSpinHelper, testCircleMinAngularVelocity, testCircleRotatesVisibly), `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-06 — 충돌 회전 물리를 관성 기반 impulse 흐름에 맞춤
- 맥락: (1) `applyAngularImpulse(value)`가 angular impulse L을 angularVelocity에 직접 더해 관성(inertia)을 무시. (2) 비적대(friendly) 충돌에서 angular collision response가 빠져 아군끼리 충돌해도 회전이 전혀 발생하지 않음. (3) polygon-polygon contactPoint가 단순 중심 중점(center midpoint) 근사여서 충돌 회전 방향이 부정확.
- 결정: (1) `integrateRotation`에서 `Δω = L * I⁻¹`로 반영 — solid disk I = 0.5mr². (2) `handleFighterCollision`에서 pre-collision velocity를 미리 계산하고, 선형/회전 물리 반응을 hostile 여부와 무관하게 항상 적용 (damaqe/ability hooks는 hostile 전용 유지). (3) `_computePolygonContactPoint` 신설 — A vertex in B, B vertex in A, edge-edge 교차점 수집 후 평균, fallback=midpoint. (4) circle-polygon fallback을 center midpoint → circle surface point로 개선. (5) MOI weighting, non-hostile angular, polygon contactPoint 테스트 추가/갱신.
- 영향: `src/physics/RotationalBody.js`, `src/physics/CollisionShape.js`, `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `docs/development-rules.md`, `docs/hunting-grounds-system.md`, `SESSION-HANDOFF.md`
- 검증: `npm test` (13개 스위트), `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과
- 미검증: 브라우저에서 동일 팀 polygon 충돌 회전 육안 확인

## [L1] 2026-07-06 — 충돌 회전 impulse가 각속도에 반영되도록 수정
- 맥락: Codex 사전 확인 결과 `handleFighterCollision()`에서 `_applyCollisionPhysics()`가 먼저 velocity를 반사시킨 후, `_applyAngularCollisionResponse()`가 재계산한 `velAlongNormal >= 0`이 되어 angular response가 항상 early return. 즉 충돌 angular impulse이 단 한 번도 angularVelocity에 반영되지 않던 버그.
- 결정: (1) `_applyCollisionPhysics()` 호출 전에 충돌 전 relative velocity와 velAlongNormal을 미리 계산. (2) 이 pre-collision 값을 `_applyAngularCollisionResponse()`에 전달해 선형 impulse 적용 후에도 올바른 접근 속도 기준으로 회전 impulse 계산. (3) 기존 테스트 `testCollisionProducesAngularImpulse`를 강화 — 비중심 충돌에서 `_accumulatedAngularImpulse` 변화 검증. (4) 신규 `testCollisionAngularImpulseChangesVelocity` — polygon-polygon 비중심 충돌 후 `update()` → `integrateRotation()`까지 거쳐 `angularVelocity`가 실제로 변하는지 검증.
- 영향: `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과
- 미검증: 브라우저에서 polygon 몹 충돌 회전 육안 확인

## [L1] 2026-07-06 — 다각형 몹 회전이 화면에서 보이도록 수정
- 맥락: 다각형 몹의 angle/angularVelocity/body rotate는 구현되어 있었으나, (1) 얼굴이 회전하지 않고 항상 정면을 바라 회전 체감이 거의 없었고, (2) generateMobAppearance(rng)가 angle/angularVelocity를 반환하지 않아 회전값이 rng 재현 불가, (3) createHuntingMobEncounter가 createHuntingMobSpec에 rng를 전달하지 않아 몹 생성 rng 체인이 끊김.
- 결정: (1) drawFace에 this.angle을 전달해 polygon body의 얼굴이 다각형과 함께 회전, circle 캐릭터는 기존 동작 유지. (2) generateMobAppearance(rng)에 angle/angularVelocity 필드 추가, BattleBall 생성자에서 appearance 값 우선 사용. (3) createHuntingMobEncounter가 rng를 createHuntingMobSpec에 전달하도록 수정. 이름표·HP바는 회전시키지 않음. Set-Content 미사용, Node.js 일괄 치환.
- 영향: `src/entities/mobAppearance.js`, `src/entities/battleBall.js`, `src/hunting/huntingMonsters.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`, `docs/hunting-grounds-system.md`
- 검증: `npm test`, `npm run format:check`, `npm run check` 통과
- 미검증: 브라우저에서 polygon 몹 얼굴 회전 육안 확인

## [L1] 2026-07-06 — 물리 디버깅을 위한 ring buffer 기록 추가
- 맥락: 각속도/다각형 충돌 구현 중 NaN/Infinity 또는 이상 충돌이 발생할 때 직전 물리 이벤트를 추적할 수단이 필요. 과도한 finite guard 대신 ring buffer 기반 원인 추적을 우선.
- 결정: (1) `src/physics/PhysicsDebugRingBuffer.js` 신설 — 고정 길이(30) ring buffer, `push(event)`, `toArray()`, `clear()`, capacity 초과 시 오래된 이벤트 제거. (2) `snapshotPhysicsState(entity)` — position/velocity/angle/angularVelocity/torqueAccum 등을 값 복사로 스냅샷. (3) `validatePhysicsState(entity, elapsed)` — position/velocity/angle/angularVelocity NaN/Infinity 검사, 무효 시 ring buffer dump를 console.error로 출력. (4) BattleBall에 `physicsDebug` buffer 연결, `applyImpulse`/`applyTorque`/`applyAngularImpulse` 래퍼로 debug 이벤트 기록, `update()` 종료 시 summary snapshot + validate. (5) BattleSimulation.handleFighterCollision에 collision event 기록 (normal, overlap, contactPoint). (6) 테스트: ring buffer 단독(5종), BattleBall debug(4종), validate(3종) 등 12종.
- 영향: `src/physics/PhysicsDebugRingBuffer.js`, `src/physics/index.js`, `src/entities/battleBall.js`, `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`, `docs/development-rules.md`
- 검증: `npm test` (11개 스위트), `npm run format:check`, `npm run check` 통과
- 미검증: 실제 브라우저 게임플레이 중 물리 디버그 버퍼가 메모리에 미치는 영향

## [L1] 2026-07-06 — 회전 물리를 torque accumulator 기반으로 재설계
- 맥락: 기존 RotationalBody는 applyAngularImpulse가 angularVelocity를 직접 수정하고, torque 개념이 없어 한 프레임에 여러 충돌이 겹칠 때 불안정. 일반적인 2D 물리 엔진의 force→acceleration→velocity→position 흐름에 대응되는 회전 구조 필요.
- 결정: (1) RotationalBody에 torque accumulator(`_accumulatedTorque`), angular impulse accumulator(`_accumulatedAngularImpulse`), `_inverseMomentOfInertia`(solid disk I=0.5mr²), `angularDamping=0.98` 도입. (2) `applyTorque`는 누적만, `applyAngularImpulse`도 누적만 하고 `integrateRotation`에서 torque→angularAccel→velocity→damping→angle 흐름으로 일괄 처리 후 누적 초기화. (3) `_applyAngularCollisionResponse` 신설: 충돌 contactPoint와 normal의 2D cross로 torque 계산 → `applyAngularImpulse`로 누적. (4) `resolveFighterShapeCollision`에 `contactPoint` 추가 (circle-circle: 중첩 중점, circle-polygon: 최근접 vertex, polygon-polygon: 중심 중점). (5) 테스트: torque accumulation, multi-torque same-frame, torque+impulse 동시, polygon update integration, collision angular impulse 안전성 등 6종 추가 + 기존 RotationalBody 테스트 갱신.
- 영향: `src/physics/RotationalBody.js`, `src/physics/CollisionShape.js`, `src/simulation/battleSimulation.js`, `src/entities/battleBall.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (10개 스위트), `npm run format:check`, `npm run check` 통과
- 미검증: 브라우저에서 polygon 몹의 torque 기반 회전 + 다중 충돌 누적 육안 확인

## [L1] 2026-07-06 — 다각형 몹 충돌을 회전 shape 기반으로 전환
- 맥락: 다각형 몹(사냥터)은 외형만 다각형이고 충돌은 원형이어서, 시각적으로 polygon에 닿지 않았는데 충돌하는 문제. RotationalBody mixin이 이미 존재하나 BattleBall에 미적용.
- 결정: (1) BattleBall에 RotationalBody mixin 추가, polygon 몹은 무작위 angle/angularVelocity 초기화. (2) `_drawPolygonBody`에 `ctx.rotate(this.angle)` 적용, `computeRegularPolygonLocalPoints` 공유 함수로 렌더링-충돌 정합성 확보. (3) `CollisionShape.js`에 `getFighterCollisionShape`, `resolveFighterShapeCollision`, SAT 기반 `_resolvePolygonPolygon`/`_resolveCirclePolygon` 추가. (4) `handleFighterCollision`을 shape 기반으로 교체, SAT normal은 충돌 반응 방향으로, 분리는 SAT normal 방향 + bounding circle 하한 보정. (5) 테스트: circle-circle/polygon-polygon/circle-polygon 분리, 각도별 normal 변화, draw rotate, shape helper, rotation init/integrate 등 11종.
- 영향: `src/entities/battleBall.js`, `src/physics/CollisionShape.js`, `src/physics/index.js`, `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (10개 스위트), `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과
- 미검증: 실제 브라우저에서 polygon 몹 회전 + shape 충돌 육안 확인

## [L1] 2026-07-06 — 사냥터 초반 선택 이벤트에서 진행 UI가 막히지 않게 정리
- 맥락: 뱀파이어 박쥐 투사체가 타겟을 바라보며 날아가서 어색함. 박쥐는 자신의 velocity 방향을 보는 것이 자연스러움.
- 결정: `BatProjectile.update()`에서 `this.angle`을 항상 `Math.atan2(this.velocity.y, this.velocity.x)`로 설정. 타겟 유무에 따른 분기 제거.
- 영향: `src/entities/batProjectile.js`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과
- 미검증: 실제 브라우저에서 박쥐 떼 방향 육안 확인

## [L1] 2026-07-06 — 사냥터 초반 선택 이벤트에서 진행 UI가 막히지 않게 정리
- 맥락: 첫 번째나 두 번째 층에서 선택 이벤트(포탈/방랑 상인)가 발생하면 route 진행 상태가 남아 선택 UI가 가려지거나 진행이 막힘. `huntingMoveTo > 0`이 stale 상태로 남아 route UI가 계속 표시되고 choice UI와 겹치는 문제.
- 결정: (1) `_stopHuntingMoveForChoice()`에서 route 상태 완전 초기화(huntingMoveFrom/MoveTo/Step=0, MoveMax=10). (2) game-overlay.html의 route 표시 조건을 `huntingMoving || huntingMoveTo > 0` → `huntingMoving`으로 변경 (stale route 방지). (3) `Math.random` mock + `setTimeout` mock으로 첫층 포탈 시나리오 테스트 추가.
- 영향: `src/hunting/huntingManager.js`, `src/components/game-overlay.html`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과

## [L1] 2026-07-06 — 사냥터 이동 구간 표시를 10층 전진 기준으로 고정
- 맥락: 사냥터 이동 UI에서 진행 바는 10층 전진 기준인데 좌우 층 표시는 매 1층 이동의 현재/다음층(7F→8F)으로 바뀌어 의미가 어긋남.
- 결정: `advance()`에서 `routeStartFloor`/`routeEndFloor`/`routeMaxSteps`를 루프 전 한 번 계산. `_setHuntingMoveState`에 `routeStartFloor`/`routeEndFloor` 전달. 95층처럼 끝에 가까우면 routeMaxSteps가 5로 clamp. 중간 정지 시에도 route head는 시작/목표 구간 유지, message만 실제 층 표시.
- 영향: `src/hunting/huntingManager.js`, `tests/regression.mjs`, `docs/hunting-grounds-system.md`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과

## [L1] 2026-07-06 — 방어구 하나가 풀세트처럼 보이지 않게 외형을 분리
- 맥락: 천 갑옷 한 벌만 착용했는데 상단/하단 띠 + 좌측 방패가 모두 그려져 마치 풀셋 갑옷처럼 보이는 문제. 아이템 이름에 따라 다른 외형을 보여줘야 함.
- 결정: (1) `inferArmorVariant(item)` 도입 — 아이템 이름 기반 4종 variant 추론 (cloth/vest/shield/plate). `item.visualVariant`가 명시되면 우선. (2) `drawArmorVariant` dispatcher + `drawClothArmor`/`drawVestArmor`/`drawShieldArmor`/`drawPlateArmor` 4종 분리. cloth=얇은 천 띠 1개+측면 주름, vest=가슴 보호대+스트랩, shield=방패 단독, plate=기존 띠×2+방패. (3) 기존 `drawArmor` 삭제. (4) 테스트: 기준선 대비 ellipse 증감 검증, variant 추론 검증, shield/plate variant draw 검증.
- 영향: `src/entities/equipmentVisuals.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과

## [L1] 2026-07-06 — 장비 외형을 게임용 실루엣 원칙에 맞춰 다듬음
- 맥락: 장비 외형이 임시 선화처럼 보이고 완성도가 낮다는 피드백. 2D 게임 캐릭터 가독성 원칙(shape language, silhouette, soft outline)을 조사해 적용.
- 결정: (1) 무기: shaft+cross-guard+blade head 구조로 정착, 외곽선을 `#202020` 대신 `palette.dark`로 변경, blade에 하이라이트 라인 추가. (2) 방어구: 직선 band를 호(arc) 기반으로 변경, shield 내부에 십자 문양 추가, shield fill을 `glow`→`fill`로 변경해 실루엣 강화. (3) 장신구: 금속 받침 링 + 보석 본체 + 하이라이트 3단 구조 유지, 작은 연결 장식 추가. (4) RARITY_COLORS에 `dark` 키 추가(등급별 어두운 외곽선 색상). (5) 불필요한 `strokeEquipmentLine` helper 제거, 각 draw 함수에서 직접 stroke 호출로 가독성 향상.
- 영향: `src/entities/equipmentVisuals.js`, `docs/equipment-system.md`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과
- 참고: 80Level shape language, Disney Shape Language, Sprite-AI pixel art guide, Reddit pixel art outline feedback

## [L1] 2026-07-05 — 장비 외형 구체화 (창/장갑 띠/방패/원형 장신구)
- 맥락: 장비를 처음 착용했을 때 단순 선/다각형 조각처럼 보여 캐릭터 얼굴의 이상한 폴리곤으로 오해될 수 있음. 사용자가 샘플로 머리띠/몸띠/방패/창이 붙은 볼 실루엣을 제시.
- 결정: (1) Weapon은 오른쪽 외곽에 장착된 창 형태(손잡이, 창날, 손막이)로 구체화. (2) Armor는 얼굴 중앙을 덮지 않고 상단/하단 장갑 띠와 왼쪽 타원 방패로 표현. (3) Accessory는 마름모 보석 대신 장갑 띠 위의 원형 리벳/보석으로 변경해 얼굴 선과 혼동을 줄임. (4) 장비 draw 테스트를 새 실루엣 호출(weapon line, accessory circle, shield ellipse) 기준으로 갱신.
- 영향: `src/entities/equipmentVisuals.js`, `tests/regression.mjs`, `docs/equipment-system.md`, `SESSION-HANDOFF.md`
- 검증: `npm run format:check`, `npm run check`, `npm test`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 장비 렌더링 가독성 개선 (얼굴 침범 방지 + 슬롯별 시각 언어)
- 맥락: 장비 외형이 캐릭터 얼굴 영역을 가로질러 "이상한 폴리곤"처럼 보이는 문제. terrain polygon 버그가 아니라 장비 배치/형태의 시각 언어 문제.
- 결정: (1) Weapon: 칼날을 몸 중심을 가로지르는 대신 오른쪽 하단(angle=0.75 rad)으로 배치, 손잡이 이중 레일, 칼날 중앙선 추가. (2) Armor: 중앙 대형 육각 방패 대신 어깨 보호대(좌우 상단 호) + 하단 흉갑 호로 분리. (3) Accessory: 4방향 분산 배치(1.28/0.72/0.35/1.65 rad), 연결 링크 추가. (4) drawEquipmentItems에 ctx.save/restore 추가.
- 영향: `src/entities/equipmentVisuals.js`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과

## [L1] 2026-07-05 — terrain/body drawing ctx state 누수 방지 (save/restore)
- 맥락: terrainRenderer, _drawArenaBackground, _drawPolygonBody가 ctx.fillStyle/strokeStyle/lineWidth를 save/restore 없이 변경해 후속 face/equipment drawing에 누수.
- 결정: terrainRenderer의 drawCircleTerrain/drawPolygonTerrain, ui.js의 _drawArenaBackground, battleBall.js의 _drawPolygonBody에 ctx.save()/try-finally/restore() 적용.
- 영향: `src/terrain/terrainRenderer.js`, `src/ui.js`, `src/entities/battleBall.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과

## [L1] 2026-07-05 — 컬렉션 허브 장비 버튼 bridge 참조 오류 수정 + 장착/해제 저장 누락
- 맥락: collection-hub.html의 bridge가 `window.ballFightApp?.bridge` 또는 `window.CollectionHubService`를 참조 → 실제 장비 함수(`equipItem`, `unequipItem` 등)는 `window.BallFightComponentBridge`에만 존재 → Alpine 런타임 에러 `bridge.equipItem is not a function`.
- 결정: (1) bridge 참조 우선순위를 `window.BallFightComponentBridge`로 교정. (2) `componentBridge.js`의 `equipItem`/`unequipItem`에 `savePlayerProfile()` 호출 추가 (다른 장비 함수들과 일관성 확보, 새로고침 후 장착 상태 유지). (3) bridge 장비 함수 존재 여부 및 equip/unequip 저장 검증 테스트 추가.
- 영향: `src/components/collection-hub.html`, `src/componentBridge.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과

## [L1] 2026-07-05 — terrain polygon + rotational body 기반 확장
- 맥락: 기존 terrain 시스템이 circle shape만 지원해 확장성이 부족. polygon 충돌/렌더링과 회전 물리 mixin을 추가해 범용 shape 기반 구조로 정리.
- 결정: (1) `TERRAIN_SHAPES.POLYGON` 추가, terrain 데이터 모델에 `points` 배열, `angle` 필드 지원. (2) `RotationalBody` mixin 신설 (`src/physics/RotationalBody.js`): angle, angularVelocity, applyAngularImpulse, integrateRotation. `PhysicsBody`와 분리해 회전 가능한 객체만 선택 적용 가능. (3) `CollisionShape` helper 신설 (`src/physics/CollisionShape.js`): getWorldPolygonPoints, polygonBoundingRadius, resolvePolygonTerrainCollision (SAT 기반 circle-polygon). (4) terrainCollision/terrainRenderer를 shape dispatcher로 변경. (5) cave terrain factory에서 홀수 층에 polygon 1개 포함 생성 (4~6 vertex convex polygon). (6) concave polygon, projectile collision, pathfinding, 동적 회전 장애물은 후속 과제로 명시.
- 영향: `src/physics/RotationalBody.js`(신규), `src/physics/CollisionShape.js`(신규), `src/physics/index.js`, `src/terrain/terrainConfig.js`, `src/terrain/terrainFactory.js`, `src/terrain/terrainCollision.js`, `src/terrain/terrainRenderer.js`, `tests/regression.mjs`, `docs/development-rules.md`, `docs/hunting-grounds-system.md`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`(116파일), `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 사냥터 실제 지형 시스템 1차 구조 (cave 암벽 장애물)
- 맥락: 사냥터 맵을 단순 배경에서 실제 지형으로 확장하기 위한 기반 필요. 1차로 cave stage에 원형 암벽 장애물을 추가하고 fighter-terrain 충돌을 구현.
- 결정: (1) `src/terrain/` 모듈 신설 — config(TERRAIN_SHAPES/TYPES), factory(`createHuntingTerrain`), collision(`resolveTerrainCollision`), renderer(`drawTerrain`). (2) cave stage에만 3~5개 원형 암벽 생성, stageId+floor 기반 결정론적 배치, spawn 영역 회피. forest/desert는 빈 배열. (3) `BattleSimulation` constructor에 `terrain` 옵션 추가, `Simulation.keepInsideArena()`에서 `resolveTerrainCollisions()` 호출. (4) `ArenaRenderer`에서 배경과 border 사이에 terrain draw. (5) coincident center fallback 처리 (nx=1, ny=0). 투사체 충돌과 pathfinding은 후속 과제로 명시.
- 영향: `src/terrain/`(신규 5파일), `src/simulation/simulation.js`(terrain collision), `src/simulation/battleSimulation.js`(terrain 옵션), `src/app.js`(terrain 전달), `src/hunting/huntingManager.js`(createHuntingTerrain 호출), `src/ui.js`(drawTerrain), `tests/regression.mjs`(hunting-terrain 테스트), `docs/hunting-grounds-system.md`(§2.3), `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`(114파일), `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 사냥터 stage 배경 밝기 조정 (이름표 가독성 개선)
- 맥락: cave(`#4a4543`) 배경이 이름표 `#444444`와 대비 1.03:1로 거의 안 보이고, forest 줄무늬도 이름표와 대비 부족. desert는 비교적 괜찮았으나 전체적으로 패턴이 너무 진해 이펙트를 방해함.
- 결정: cave base `#4a4543→#9a928b`(대비 4.5:1), crack `#3d3836→#7f7770`, mineral `#5c5654→#b5ada4`. forest base `#7a9a5c→#9fbd7a`(대비 5.5:1), bush `#5d8040→#89aa66`, stripe `#4a6930→#78965b`. desert base `#d4b88c→#dcc9a3`, ripple `#c4a67a→#ccb78e`, grain `#bfa070→#c4a87a`. 인덱스 루프를 `Array.from`+`for...of`로 변환(프로젝트 코딩 규칙 준수). 이름표/HP바/이펙트 로직은 변경하지 않음.
- 영향: `src/ui.js`(3종 배경 색상+루프 스타일), `docs/hunting-grounds-system.md`(밝은 팔레트 언급), `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 사냥터 스테이지 선택 UI + stage theme 배경 렌더링
- 맥락: 동굴/숲/사막 스테이지 데이터가 이미 존재하나 유저가 선택할 UI가 없고, 전투 캔버스도 흰색 단일 배경이라 맵 차이를 체감할 수 없었음.
- 결정: (1) `showCharacterSelect()` 팝업에 `getUnlockedHuntingStageIds()` 기반 stage 선택 버튼 추가, 선택 시 `profile.hunting.selectedStageId` 갱신 후 `savePlayerProfile()`. 해금된 stage만 표시, 선택된 stage는 `.active` 하이라이트. (2) `BattleSimulation` constructor options에 `arenaTheme` 추가, `ArenaRenderer._drawArenaBackground()`에서 theme별 Canvas 2D 패턴 렌더링 — cave(암석 균열+광물), forest(덤불+나무 그림자), desert(모래결+모래알). unknown/null theme는 기본 밝은 회색 fallback. (3) `HuntingManager._startFloorBattle()`에서 stage theme를 `app.startMatch()`로 전달. (4) CSS: `.hunting-stage-select`, `.hunting-stage-btn.active` 등 스타일 추가.
- 영향: `src/hunting/huntingManager.js`(stage 선택 UI, theme 전달), `src/simulation/battleSimulation.js`(arenaTheme 옵션), `src/ui.js`(_drawArenaBackground, 3종 테마 메서드), `src/app.js`(arenaTheme 전달), `src/hunting/huntingConfig.js`(stage.theme 소스), `src/styles.css`(stage UI CSS), `tests/regression.mjs`(hunting-stage 테스트), `docs/hunting-grounds-system.md`(§2.2), `SESSION-HANDOFF.md`
- 검증: `npm test` (8개 스위트), `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 저HP 포탈 확률 보정 + 포탈 거부 억제 시스템
- 맥락: HP가 낮을 때 귀환 기회를 더 자주 제공하고, 포탈을 거부하면 일정 기간 포탈 반복을 억제하는 장치 필요.
- 결정: (1) `HUNTING_PORTAL_DECLINE` 상수 추가 (INITIAL_FLOORS=5, HP_MULT: [≥50%:×1.0, ≥30%:×1.8, <30%:×3.0]). (2) `getHuntingPortalWeightMultiplier(hpRatio, portalDeclineFloors)`로 포탈 가중치 계산 — HP 낮을수록 높고, decline 중이면 ×1.0 고정. (3) `rollWeightedEventType()`로 균등→가중치 기반 이벤트 선택 전환. (4) `advanceHuntingRun()`이 `portalDeclineFloors`를 1씩 감소, `hpRatio`를 context로 전달. (5) `HuntingManager.advance()` 시작 시 이전 이벤트가 PORTAL이면 `portalDeclineFloors=5` 설정. (6) run 상태에 `portalDeclineFloors` 필드 추가 (기본 0).
- 영향: `src/hunting/huntingConfig.js`(HUNTING_PORTAL_DECLINE), `src/hunting/huntingEncounters.js`(weighted event selection, getHuntingPortalWeightMultiplier, context 파라미터), `src/hunting/huntingState.js`(portalDeclineFloors, hpRatio 전달), `src/hunting/huntingManager.js`(portal decline 감지), `tests/regression.mjs`(hunting-portal 테스트 그룹), `docs/hunting-grounds-system.md`(§7.2), `SESSION-HANDOFF.md`
- 검증: `npm test` (7개 스위트), `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — combat relief 적용 순서 수정 (판정 전 감소 → 판정 후 감소)
- 맥락: 전투 직후 첫 층에 relief=2로 판정되는 버그. `advanceHuntingRun()`이 relief를 먼저 1 감소시킨 뒤 `rollHuntingFloorOutcome()`에 넘겨, 가장 강한 완충 단계(relief=3)를 건너뜀.
- 결정: 판정 시점에는 현재 `run.combatReliefFloors` 값을 그대로 사용하고, 반환 run에만 1 감소한 값을 저장. 테스트로 rng=0.17을 사용해 relief=3에서 COMBAT이 아닌 EVENT가 나오는지 검증. `huntingManager.js`의 미사용 `startFloor` 변수 제거.
- 영향: `src/hunting/huntingState.js`(advanceHuntingRun 순서), `src/hunting/huntingManager.js`(미사용 변수 제거), `tests/regression.mjs`(판정 순서 검증 추가)
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 전투 직후 확률 완충 시스템 + 이동 UI stale floor 버그 수정
- 맥락: (1) 사냥터 전투가 너무 자주 발생해 연속 전투 피로감 크다는 제보. (2) 전투 후 재전진 시 UI가 이전 전투 층을 기준으로 표시되는 버그.
- 결정: (1) `HUNTING_COMBAT_RELIEF` 상수 도입 (INITIAL_FLOORS=3). 전투 승리 후 `recordHuntingFloorResult(..., combatCleared: true)`로 relief 설정. `getHuntingFloorChances(floor, combatReliefFloors)`가 완충 단계에 따라 combat×0.35~0.75, event+(감소분×0.55~0.7)로 조정. `advanceHuntingRun()`이 층 이동마다 relief 1 감소. 100층은 완충 무시. (2) `HuntingManager.advance()`에서 `startFloor` 대신 `this._run.floor` 기준으로 UI 표시하도록 수정.
- 영향: `src/hunting/huntingConfig.js`(HUNTING_COMBAT_RELIEF 상수), `src/hunting/huntingEncounters.js`(getHuntingFloorChances/rollHuntingFloorOutcome 확장), `src/hunting/huntingState.js`(recordHuntingFloorResult/advanceHuntingRun), `src/hunting/huntingManager.js`(UI stale floor 수정, combatCleared 전달), `tests/regression.mjs`(hunting-relief 테스트 그룹), `docs/hunting-grounds-system.md`(§6.1 완충 규칙)
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 사냥터 버그 2건 수정: 첫 우승 후 버튼 미노출 / 이동 멈춤 혼동
- 맥락: 사용자 제보로 발견된 버그 2건. (1) 첫 토너먼트 우승 후 사냥터 버튼이 새로고침 전까지 나타나지 않음. (2) 사냥터 10층 전진이 2층에서 멈춘 것처럼 보이고, 다음 행동을 알려주지 않아 혼란.
- 결정: (1) `UIController.renderTournament()`에서 챔피언 결정 시 `tournamentActive = !tournament.champion`(false)로 설정하고, `showTournamentChampion()`에서 `refreshPlayerSetup()`을 호출해 `huntingAvailable`을 즉시 재계산. (2) `advance()`에 try-catch 안전장치 추가해 `_moving` 플래그 고착 방지. (3) 전투 승리 후 `huntingMoveMessage`에 "10층 전진 가능" 메시지 추가. (4) 포탈/상인 이벤트에서 `huntingLootSummary`로 현재 상태와 가능한 행동 표시. (5) `game-overlay.html`에 `.hunting-choice-hint` 요소 추가해 이동 상태 메시지를 선택 영역에서도 표시.
- 영향: `src/ui.js`(renderTournament 조건부), `src/app.js`(showTournamentChampion), `src/hunting/huntingManager.js`(try-catch, 메시지), `src/components/game-overlay.html`(hint 요소), `tests/regression.mjs`(tournamentActive/available 검증)
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 사냥터 100층 스테이지 원정 구조 구현
- 맥락: Codex가 사냥터 패턴 강화 구현을 일부 진행하다 중단. partial diff를 읽고 이어서 완성.
- 결정: (1) 사냥터 100층 구조 확정 — 시작 1층, 10층 전진 시 1층씩 이동, 전투/선택형이벤트/포탈/100층보스에서 정지, 빈층은 자동 진행. (2) `advance()`를 async 10-step 루프로 재작성, 층당 350ms 이동 애니메이션. (3) 포탈에서만 귀환 가능 (`canRetreatFromHuntingRun`), 포탈 지나치면 귀환 권한 소멸. (4) 새 이벤트 4종: portal(귀환 가능), wandering_merchant(정지), boon(파편 즉시), mishap(HP 손실). (5) 동굴/숲/사막 3스테이지, 100층 보스 처치 시 다음 스테이지 해금. (6) `rollHuntingFloorOutcome`으로 층 판정 (empty/combat/event/final_boss). (7) 테스트: 100층 구조, portal 전용 귀환, floor outcome, stage 해금, gameOverlay store 검증 완료.
- 영향: `src/hunting/huntingManager.js`(advance async 루프), `src/hunting/huntingState.js`(stage/portal), `src/hunting/huntingEncounters.js`(rollHuntingFloorOutcome), `src/hunting/huntingConfig.js`(100층/스테이지/이벤트), `src/components/game-overlay.html`(이동 UI/포탈 버튼), `src/playerProfile.js`(stage 해금), `src/ui.js`(store 초기값), `index.html`(V=0.24.5), `src/patchNotes.js`(v0.24.5), `tests/regression.mjs`(신규 100층 테스트), `scripts/huntingUserScenario.mjs`(12층 시나리오)
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-04 — 인라인 Alpine UI 5종 컴포넌트화 + ES module 이중 import 버그 수정
- 맥락: 남은 인라인 Alpine 패널(game-overlay, start-button, hunting-button, battle-log, fighter-strip)을 `src/components/<name>.html` 단일 HTML 컴포넌트로 분리. 컴포넌트화 후 액션 선택 팝업 클릭 불가 + 배틀 로그 위치 이상 버그 2건 발견.
- 결정: (1) game-overlay/start-button/hunting-button/battle-log/fighter-strip 5종 컴포넌트 생성 — 자체 `x-data` + `Alpine.reactive()` 상태 + `Alpine.store()` 브릿지 + scoped CSS. (2) 배틀 로그 `position: fixed` 누락 복구. (3) 액션 선택 팝업 클릭 버그 근본 원인: `index.html`에서 `?v=${V}` 캐시 버스팅으로 import한 module과 `app.js`에서 static import한 module이 다른 instance가 되어 module-level `_resolve` 변수가 공유되지 않음. (4) 수정: `_resolve`를 module-level 변수 → `Alpine.store("actionPicker")._resolve`에 저장. (5) 액션 선택기 `@click`을 `$dispatch('pick-action')` 이벤트 위임으로 변경 (x-for 내부 스코프 우회). (6) `docs/development-rules.md`에 "ES Module import 일관성 규칙" 섹션 추가.
- 영향: `src/components/game-overlay.html`(신규), `src/components/start-button.html`(신규), `src/components/hunting-button.html`(신규), `src/components/battle-log.html`(신규), `src/components/fighter-strip.html`(신규), `src/actionPicker.js`(Alpine store _resolve), `src/components/action-picker.html`($dispatch), `index.html`(스토어 초기화 6종), `src/ui.js`(store 브릿지 메서드), `src/app.js`(showTransientOverlay), `src/hunting/huntingManager.js`(store 브릿지), `src/styles.css`(CSS 5블록 제거), `docs/development-rules.md`(ES Module import 규칙 추가)
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-06 — 충돌 응답 경로를 실제 공통 물리 API로 수렴

- 맥락: 67052db에서 `collisionResponse.js`를 만들었으나 wall/terrain 충돌에서 여전히 velocity 반사+angular impulse를 분리 호출. 접선 마찰이 `+tangent * v_t * friction`으로 접선 속도를 증가시키는 물리 버그. fighter-fighter도 `applyDynamicCollisionResponse` 대신 `applyCollisionAngularImpulse`를 직접 2회 호출.
- 결정: (1) `applyCollisionResponse` 접선 마찰 방향을 `-tangent * v_t * friction`으로 수정, torque 마찰도 `-(r×T̂) * v_t * friction`으로 수렴 (물리 기반). (2) `_reflectX`/`_reflectY` 벽 충돌이 `applyCollisionResponse(entity, normal, contactPoint, preVel, { restitution:1, angularFactor:0.15, tangentialFriction:0.03 })`를 호출하게 변경, `_matchVelocity`/`_applyWallAngularImpulse` 제거. (3) `resolveCircleTerrainCollision`이 velocity 반사 대신 `applyCollisionResponse` 사용, `Vector2` import 제거. (4) `resolvePolygonTerrainCollision`의 두 collision case를 `applyCollisionResponse`로 통일, `reflectVelocity` 함수 제거. (5) `_applyAngularCollisionResponse`가 `applyDynamicCollisionResponse(a,b,normal,contactPoint,approachSpeed,{restitution,angularFactor})`를 호출하게 변경. (6) 접선 마찰 테스트(`testTangentialFrictionReducesSpeed`, `testApplyCollisionResponseWallReflects`) 신규.
- 영향: `src/physics/collisionResponse.js`, `src/physics/CollisionShape.js`, `src/physics/index.js`, `src/simulation/simulation.js`, `src/simulation/battleSimulation.js`, `src/terrain/terrainCollision.js`, `tests/regression.mjs`, `docs/development-rules.md`, `SESSION-HANDOFF.md`
- 검증: `npm test` (172개 스위트), `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과
- 미검증: 브라우저 육안 확인 (벽/terrain 충돌 회전 방향)

## [L1] 2026-07-08 — 플레이어 패널 모바일 스크롤 + 사냥터 스탯 배분 명시화

- 맥락: 장비 UI 추가 후 플레이어 패널 하단 스탯 배분 컨트롤이 모바일 세로 모드에서 도달 불가능. `:scope`의 `height:100%`가 부모 flex item 안에서 스크롤을 무력화함. 또한 사냥터 전투에 스탯 배분이 적용되긴 하지만 명시적인 검증이 없어 회귀 가능성 존재.
- 결정: (1) `:scope`에 `overflow-y:auto`, `overscroll-behavior:contain`, `-webkit-overflow-scrolling:touch` 추가. (2) 모바일 세로 portrait에서 `height:100%` 제거 → `max-height:100%`로 변경 + `padding-bottom:max(8px, env(safe-area-inset-bottom))` 추가. (3) 420px 이하에서 장비 슬롯 padding 축소, stat 버튼 min-height 30→32px, `.player-actions` 하단 safe-area 여백 추가. (4) 모바일 setup-hidden 상태에서는 실제 스크롤 소유자가 부모 `.tournament-panel`이므로 `overflow:auto`와 touch scrolling을 추가. (5) `testHuntingStartFloorBattleAppliesStatAllocation` 회귀 테스트 추가 — `_startFloorBattle`가 `applyStatAllocation` 결과와 일치하는 스펙을 생성하는지 검증. (6) 패치노트 v0.24.8 등록, index.html V=0.24.8로 캐시 버스터 갱신.
- 영향: `src/components/player-panel.html`, `src/styles.css`, `src/patchNotes.js`, `index.html`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs`, 모바일 브라우저 portrait 패널 스크롤 계측 통과

## [L1] 2026-07-06 — 벽/terrain 정적 충돌면 angular impulse 적용
- 맥락: fighter-fighter 충돌에만 angular impulse가 적용되고, 벽(arena wall)과 terrain(장애물) 충돌에서는 회전 물리가 전혀 발생하지 않아 모든 물리 상호작용을 통일하라는 요구사항을 충족하지 못함. 회전이 시각적 피드백과 플레이 피드백에 중요한 요소임.
- 결정: (1) `src/physics/staticCollisionResponse.js` 신설 — `applyStaticAngularImpulse(entity, normal, contactPoint, preCollisionVelocity, options)` 공통 헬퍼. 법선 impulse torque + 접선 마찰 torque 2성분 계산. torque arm이 0에 가까우면 접선 속도만으로 spin 생성. (2) `simulation.js`의 `_reflectX`/`_reflectY`에서 충돌 전 velocity를 저장하고 `applyStaticAngularImpulse` 호출 — 접점=벽 표면점. (3) `terrainCollision.js`의 `resolveCircleTerrainCollision`에서 velocity 반사 전 preVel 저장 → entity 표면 접점 계산 → angular impulse 적용. (4) `CollisionShape.js`의 `resolvePolygonTerrainCollision`에서 `closestEdgeNormal`에 contactPoint 반환 추가, edge collision loop에 bestContactX/Y 저장, angular impulse 적용. (5) 회귀 테스트 4종 추가 (wall/corner/circle-terrain/polygon-terrain angular impulse). fighter-fighter 공통 helper 리팩터링은 대규모 변경 방지를 위해 보류.
- 영향: `src/physics/staticCollisionResponse.js`(신규), `src/simulation/simulation.js`, `src/terrain/terrainCollision.js`, `src/physics/CollisionShape.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (17개 스위트), `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-07 — 충돌 응답을 rigid body impulse solver 구조에 맞춘다

- 맥락: 현재 `collisionResponse.js`는 normal impulse magnitude를 `|approachSpeed| * (1+e)`로 계산하고 angular impulse를 분리 적용하여, effective mass denominator에 inverse inertia((r×n)²/IA)가 누락된 임시 공식 상태. `core.applyCollisionImpulse`는 contact point/angular impulse를 무시한 pure linear normal impulse. `battleSimulation.js`는 `_applyCollisionPhysics`(linear normal)와 `_applyAngularCollisionResponse`(angular/tangent)로 분리되어 물리적으로 정확하지 않음.
- 결정: (1) `collisionResponse.js`에 contact point 기반 2D rigid-body impulse solver(`_resolveContactImpulse`, `_effectiveMassDenom`, `_applyImpulseToBodies`)를 구현. normal impulse `jn = -(1+e)·vn/denom_n`, tangent impulse `jt = -vt/denom_t` (Coulomb clamp), effective mass denominator에 `invMass + (r×d)²·invI` 포함. (2) `applyCollisionResponse`(정적)와 `applyDynamicCollisionResponse`(동적) 모두 공통 `_resolveContactImpulse`를 호출하도록 리팩터. (3) `battleSimulation.js`에서 `_applyCollisionPhysics` + `_applyAngularCollisionResponse` → 단일 `_applyRigidBodyCollision`으로 통합, impact 배율은 options로 전달. (4) `collisionAngularImpulse`는 legacy wrapper 유지. (5) impulse 질량 분배/off-center angular/effective mass 회전 기여/tangent friction 선형+각변환 검증 테스트 4종 추가.
- 영향: `src/physics/collisionResponse.js`(전면 재작성), `src/simulation/battleSimulation.js`(import/메서드 변경), `tests/regression.mjs`(신규 4종 테스트 + 1종 mock 보강), `docs/development-rules.md`(충돌 물리 설명 갱신), `SESSION-HANDOFF.md`
- 검증: `npm test`(18개 스위트), `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-07 — 충돌 angularFactor 기본값을 0.15→1로 변경하여 물리적 일관성 확보
- 맥락: rigid body impulse solver는 effective mass denominator에 회전 관성 기여(invI·(r×d)²)를 포함해 정확한 impulse J를 계산하지만, angular impulse 적용 시 `angularFactor=0.15`로 85%의 각운동량을 무시함. denominator는 전체 회전을 가정하고 J를 계산하는데 적용 시 15%만 반영되어 물리적 불일치 발생. Codex probe 결과 동적 충돌 각속도 0.63 rad/s (0.15배) vs 4.21 rad/s (1배).
- 결정: (1) `collisionResponse.js`의 `applyCollisionResponse`와 `applyDynamicCollisionResponse` 기본 `angularFactor`를 0.15→1로 변경. (2) 모든 호출자에서 명시적 `angularFactor: 0.15` 제거 (battleSimulation.js, simulation.js, terrainCollision.js, CollisionShape.js 4개 파일 8개 호출). (3) 테스트 강화: `testOffCenterAngularMagnitude`(임계값 5000, 0.15배면 2498로 실패), `testWallCollisionAngularNotReduced`(임계값 5000, 0.15배면 2534로 실패). (4) docs 갱신: `angularFactor: 0.15` 참조 제거, 물리적 일관성 설명 추가.
- 영향: `src/physics/collisionResponse.js`, `src/simulation/battleSimulation.js`, `src/simulation/simulation.js`, `src/terrain/terrainCollision.js`, `src/physics/CollisionShape.js`, `tests/regression.mjs`, `docs/development-rules.md`, `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과
- 미검증: 브라우저에서 캐릭터 회전 시각적 과도함 여부 — 물리적으로 정확해졌으므로 이전보다 회전이 강하게 보일 수 있음. 게임 느낌 튜닝이 필요하면 rigid body solver 내부가 아닌 시각적 감쇠 또는 외부 damping으로 처리해야 함.
- 후속 확인: Codex 검증 중 `src/physics/CollisionShape.js`의 폴리곤 지형 충돌 경로에 `angularFactor: 0.15`가 1개 남아 있음을 발견해 제거. `src` 런타임 경로에는 0.15 감쇠 호출이 남지 않음.

## [L1] 2026-07-07 — Anti-stall 책임 분리 리팩터 + 투사체 비리셋 회귀 테스트
- 맥락: 기존 `_fireAntiStallBurst()`가 active 필터/적대 쌍 검사/방향 계산/impulse 적용/시각 피드백/카운터 갱신을 모두 인라인으로 처리해 책임이 혼재됨. 또한 투사체 명중 시 anti-stall 타이머가 리셋되지 않는다는 명시적 보호 장치와 회귀 테스트가 없었음.
- 결정: (1) `_fireAntiStallBurst()`를 10개 소책임 메서드로 분리 — `_resetAntiStallTimerForFighterCollision()`, `_getActiveAntiStallFighters()`, `_hasHostileFighterPair()`, `_shouldTriggerAntiStallBurst()`, `_emitAntiStallBurstFeedback()`, `_getAntiStallDirection()`, `_getAntiStallImpulseMagnitude()`, `_applyAntiStallBurstImpulse()`, `_resetAntiStallAfterBurst()`, `_fireAntiStallBurst()`. (2) `handleFighterCollision`에서 `this._antiStallTimer = 0` → `_resetAntiStallTimerForFighterCollision()`으로 대체. (3) 회귀 테스트 `[anti-stall-projectile-no-reset]` 추가 — 실제 `spawnArrow` + projectile hit 경로로 대미지를 입힌 후 `_antiStallTimer`가 변하지 않음을 검증. (4) `docs/development-rules.md` anti-stall 섹션에 타이머 리셋 소스는 적대 전투원-vs-전투원 충돌만 가능하다는 규칙과 투사체/폭발/takeDamage 비리셋 규칙 명시. (5) 헬퍼 메서드 역할 목록 문서화.
- 영향: `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `docs/development-rules.md`, `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과
- 타이머 리셋이 적대 전투원 충돌(`handleFighterCollision`)에서만 발생하고 Arrow/Grenade/Orbit/Seed/Bullet/Bat 투사체 경로와 `takeDamage()`에서는 절대 발생하지 않음을 회귀 테스트로 검증 완료.

## 현재 기준 요약 (2026-07-07)
- 컴포넌트 파일 구조: `src/components/<name>.html` (플랫, 폴더 없음), 9개 컴포넌트
- **사냥터 100층 구조**: 시작 1층, 10층 전진 루프, 전투/포탈/상인/챔피언에서 정지, 빈층/축복/함정/휴식/상자/제단은 자동 진행
- **3스테이지**: 동굴→숲→사막, 100층 보스 처치 시 해금
- **포탈 귀환**: 포탈 이벤트에서만 귀환 가능, 포탈 지나치면 권한 소멸
- 컴포넌트 목록: `<xp-reward-panel>`, `<xp-progress-bar>`, `<popup-dialog>`, `<toast-notification>`, `<action-picker>`, `<patch-notes>`, `<collection-hub>`, `<player-panel>`, `<tournament-bracket>`
- 컴포넌트 패턴: 자체 `x-data` 스코프 + `Alpine.reactive()` 클로저 상태 + `Alpine.store()` 데이터 브릿지 + scoped CSS (`[data-v-xxxxx]` 선택자 프리픽스)
- **Alpine.store()는 절대 `null`을 값으로 설정하지 않음** — `Object.getOwnPropertyDescriptors(null)` TypeError 방지를 위해 항상 `{ visible: false, ... }` 객체 사용
- PopupService: `Alpine.store('popupDialog')` 기반, `close()` 정적 메서드 추가됨
- 사냥터 MVP: 캐릭터 선택 → 층별 BattleSimulation 1v1 → HP 캐리오버 → 귀환/전진 선택 → 랜덤 이벤트(휴식지/상자방/저주받은 제단/챔피언 난입) → 패배/귀환 시 프로필 병합. 액션 선택은 `skipActionPick: true`로 스킵
- 사냥터 상자: 5등급 비용/보상 테이블 연결 완료. 해조각은 즉시 반영, HP 회복/임시 스탯은 deferred effect payload로 반환
- 사냥터 오버레이 내 버튼은 `.overlay { pointer-events: none }` 영향으로 클릭 안 됨 → `.hunting-choice-buttons { pointer-events: auto }` 필수
- 검증 완료: `npm test`, `npm run check`, `npm run format:check` 통과
- 인라인 Alpine 패널 0개, 모든 패널/오버레이/모달은 컴포넌트화 완료
- **player-panel**: $dispatch 이벤트 패턴 (`adjust-stat`, `random-allocation`, `reset-allocation`, `adjust-challenge-level`, `open-collection-hub`)으로 부모 appStore와 통신. `id="playerFaceCanvas"`는 document.getElementById로 접근 가능
- **tournament-bracket**: aside.tournament-panel을 root로 포함, `state.visible`로 setup-hidden 제어
- 다음 우선순위: 사냥터 deferred effect 적용 UI/런 시작 연결, PPO 학습 결과 저장 구조, Time Warp 재학습/Dash 밸런스 검토

## [L2] 2026-07-02 — 보상 3축 설계 + 액션별 가중치 + 게임 통합 완료
- 배경: 구버전 모델(승패만 보상)이 스팸 문제. HP weight만으로는 방어형 액션 불이익.
- 결정: (1) 보상 = 승패 ±1 + 액션HP피해×0.3 - 내HP손실×0.15 - 사용횟수×0.02 (2) 액션 타입별 가중치 맵: 공격형(shockwave 0.5/0.1), 방어형(evade 0.1/0.5), 유틸형(rush 0.15/0.15) (3) 훈련 0.5초 간격, 게임 매 틱 평가 (4) 이펙트 _executeAction으로 통합 (5) pendingActions 큐화 (6) TimeWarp 시전자별 독립 타이머
- 영향: `scripts/rl/train.mjs`, `src/simulation/aiActionController.js`, `src/simulation/battleSimulation.js`, `src/app.js`, `src/clickActions.js`, `scripts/benchmark.mjs`, `src/ai/rlPolicy.js`

## [L1] 2026-06-29 — RL PPO 학습 파이프라인 완성
- 맥락: AI 액션 canAIUse 수동 튜닝 한계 → PPO로 캐릭터×액션 조합별 최적 사용 확률 자동 학습
- 결정: (1) PPO Actor-Critic (16→16→1 Bernoulli 정책), GAE, mini-batch SGD로 `scripts/rl/train.mjs` 구현 (2) 피처 16차원 순수 벡터 (HP비율, 위치벡터, 속도벡터, 투사체벡터, 경과시간, 캐릭터 인덱스) — 파생값/불리언 플래그 없음 (3) `--help` 도움말, 학습 완료 시 `scripts/rl/report_*.json` 자동 저장 (4) `node scripts/rl/train.mjs` 한 줄로 전체 실행
- 영향: `scripts/rl/train.mjs`, `scripts/rl/features.js`, `scripts/rl/policyNetwork.js`, `scripts/rl/normalizer.js`, `docs/rl-optimization-guide.md`

## [L2] 2026-06-28 — AI 액션 시스템 간소화 + Shockwave 버프
- 배경: canAIUse가 대부분 거리 제한으로 차단되어 AI가 아무 액션도 못 쓰는 문제 → RL 학습 위해 모든 액션 허용 필요
- 결정: (1) 모든 `canAIUse`가 `true` 반환, 기존 로직은 주석 보존 (2) `_pickAction()` 제거, `selectAction()`에서 캐릭터 타입 기반 가중치 랜덤 선택 (3) Rush/TimeWarp/Counter/ProjectileGuard/Endure/LifeSteal/Evade에 `getFailureReason` 가드 추가 (효과 활성 중 재사용 방지) (4) Shockwave 반경 150→250, HP 40% 미만 + 거리 250 이하에서만 사용 (방어적)
- 영향: `src/clickActions.js`, `src/simulation/aiActionController.js`

## [L1] 2026-06-28 — RL 최적화 가이드 문서 작성
- 맥락: AI 액션 `canAIUse` 파라미터 수동 튜닝이 번거로워 RL/자동최적화 도입 검토
- 결정: `docs/rl-optimization-guide.md` 작성 — 게임 구조·관측공간(24차원)·행동공간·보상함수·DQN 학습코드·기존 게임 임베딩 전략을 포괄하는 설계 문서
- 영향: `docs/rl-optimization-guide.md`

## [L1] 2026-06-28 — HP 게이트 30% + 쿨다운 제거 + Shockwave 회피용 전환
- 맥락: `aiEnabled: true`여도 `_pickAction()`이 `canAIUse` 통과 액션이 없으면 `null` 반환 → `_chosenAction` 미설정 → `clickActionName` 미설정 → UI에 AI 캐릭터 액션명 미표시
- 결정: (1) `_pickAction()`에서 viable이 0이면 전체 풀에서 랜덤 fallback 선택 — `_chosenAction`이 null이 되는 경우 제거 (2) `docs/click-actions.md`에 AI 액션 규칙(할당·고정·canAIUse) 문서화, 액션 선택 주기를 토너먼트 단위로 정정 (3) `aiEnabled` 중복 키 제거, `false` 기본값 + 주석 힌트 패턴 통일
- 영향: `src/simulation/aiActionController.js`, `src/app.js`, `docs/click-actions.md`

## [L1] 2026-06-28 — 스탯 표시 버그 수정 (stats 네임스페이스 누락 참조)
- 맥락: `6538ebb`에서 `statAllocation`을 `BattleBall.stats.allocation`으로 이동했으나 `src/ui.js`, ability 3종, `heroOrb.js`, `tests/regression.mjs`의 참조가 미업데이트되어 스탯 표시가 깨짐
- 결정: `fighter.statAllocation` → `fighter.stats.allocation` (11곳), `fighter.stats?.hp` → `fighter.hp/maxHp` (2곳), `owner.statAllocation` → `owner.stats?.allocation` (4곳) 으로 수정. optional chaining 보강
- 영향: `src/ui.js`, `src/abilities/ability.js`, `src/abilities/orbitAbility.js`, `src/abilities/rageAbility.js`, `src/entities/heroOrb.js`, `tests/regression.mjs`

## [L1] 2026-06-27 — 시간 왜곡 타이머, 배속 영향 제거
- 맥락: `timeSlowRemaining`이 `speedDelta`(배속 적용된 값)로 카운트다운되어 4배속에서 0.5초가 0.125초만에 만료됨
- 결정: `BattleSimulation.update(delta, realDelta=delta)`로 실제 시간 파라미터 추가, `timeSlowRemaining`은 `realDelta`로 감소, 엔티티 업데이트는 `delta`(speedDelta) 기준 유지
- 영향: `src/app.js`, `src/simulation/battleSimulation.js`

## [L1] 2026-06-27 — 시간 왜곡 면제 시스템
- 맥락: `entity === this.playerBall` 하드코딩 → 관전 모드나 AI 사용 시 아무도 면제 안 됨
- 결정: `timeSlowExempt` Set 도입, `TimeWarpAction.apply()`에서 시전자 추가
- 영향: `src/simulation/battleSimulation.js`, `src/clickActions.js`

## [L1] 2026-06-27 — 인게임 버그 2건 수정
- 맥락: `assignActions: true` 하드코딩 → 챌린지 레벨 무관하게 AI 액션 항상 활성. `applyKnockback` speedBoost에 `multiplier` 누락 → NaN 가능성
- 결정: `assignActions` 줄 제거, `multiplier: 1` 추가
- 영향: `src/app.js`, `src/entities/battleBall.js`

## [L1] 2026-06-27 — AI 액션 컨트롤러 개선
- 맥락: 액션 사용 시 승률이 오히려 하락하는 캐릭터 6종 발견 (Phantom -7.8%, Trickster -7.5% 등)
- 결정: (1) HP 50% 미만이면 액션 사용 금지 (2) 쿨다운 6→15초 (3) 저HP 시 `_pickAction`에서 흡혈/회피 우선 가중치 (4) 액션 고정(locking)은 유지 — 사람도 첫 카드 선택 후 고정
- 영향: `src/simulation/aiActionController.js`

## [L2] 2026-06-27 — balanceSim으로 승률 검증
- 배경: AI가 새 스크립트(`scripts/aiVerify.mjs`)를 만들었으나 기존 `tests/balanceSim.mjs`가 더 완성도 높음
- 결정: 중복 스크립트 삭제, 원본 balanceSim으로 30 토너먼트 검증
- 영향: `scripts/aiVerify.mjs` 삭제

## [L1] 2026-06-27 — 세션 핸드오프 시스템
- 맥락: 매 새 대화마다 이전 컨텍스트를 이어받을 방법 필요
- 결정: (1) `AGENTS.md`에 시작 루틴(handoff 파일 읽기) 규칙 추가 (2) 결정 발생 시점마다 실시간 기록 (3) L1/L2/L3 우선순위 레벨링 (4) 단일 파일로 결정 히스토리 관리
- 영향: `AGENTS.md`, `SESSION-HANDOFF.md`

## [L1] 2026-06-27 — AGENTS.md 리팩터링
- 맥락: 200줄 중 다수가 효과 없음 (출력 형식 강제, DeepSeek 보완 장치 장황, development-rules.md 중복)
- 결정: 200줄→55줄로 축소, 핵심 규칙·코드스타일·아키텍처 원칙만 유지
- 영향: `AGENTS.md`

## [L1] 2026-06-27 — ABILITY_MAP 3군데 누락 수정
- 맥락: Vampire/Gunner/Phantom 얼굴이 UI에서 안 보임. `ui.js`, `app.js`의 ABILITY_MAP과 import에 3종 누락
- 결정: import 추가, ABILITY_MAP에 3종 추가
- 영향: `src/ui.js`, `src/app.js`

## [L1] 2026-06-27 — SESSION-HANDOFF.md 워크스페이스 루트로 이동
- 맥락: `/memories/repo/` 경로는 사용자에게 안 보임
- 결정: 워크스페이스 루트 `SESSION-HANDOFF.md`를 primary로, AGENTS.md의 읽기/쓰기 모두 이 파일 대상으로 변경
- 영향: `AGENTS.md`, `SESSION-HANDOFF.md`

## [L3] FIGHTER_IDS/ABILITY_TYPES 누락 추가 (Vampire/Gunner/Phantom)
## [L3] regression.mjs 테스트 복구 (구현과 불일치하던 테스트 값, 미구현 기능 테스트)
## [L3] balanceSim 30T 검증 통과, npm test 통과, format:check 통과

## [L1] 2026-06-27 — 시간왜곡 canAIUse 재설계 (원거리/근접 구분)
- 맥락: 기존 `상대속도 > 내속도 × 1.5`는 조건이 너무 엄격해 AI가 거의 사용 안 함
- 결정: 원거리(archer/grenade/gunner)는 상대 접근속도>80 & 거리<350, 근접은 상대 도망속도>40 & 거리<300
- 영향: `src/clickActions.js`

## [L1] 2026-06-27 — 7개 액션 canAIUse 전면 개선
- 맥락: 30T balanceSim에서 Orbit(-16%), Hero(-16%), Phantom(-11%) 등 액션 사용 시 승률 하락
- 결정: Rush(근접전용, 거리>300), Counter/Endure/Evade(충돌 임박 시), Guard(투사체 접근 시), LifeSteal(HP≤50%), Shockwave(그대로)
- 영향: `src/clickActions.js`

## [L1] 2026-06-27 — 캐릭터-액션 조합별 베이스라인 대비 분석
- 결정: balanceSim 25T로 캐릭터×액션 매트릭스 출력, 베이스라인 대비 델타로 AI 조건 진단
- 발견: 충격파(Trickster/Dash/Rage에 독), 돌진(Phantom/Gunner에 독), 회피(Eater/Grenade/Hero에 독)

## [L1] 2026-06-27 — 회피(Evade) 리워크: 좌우 90도 꺾기
- 맥락: 타이밍형은 버티기와 유사, 대시형은 Dash와 유사 → 차별화 필요
- 결정: 현재 진행방향에서 좌/우 랜덤 90도로 꺾어 회피. 800px/s, +30%속도 0.4초, HP 0.8%, 거리<220 & 접근>40 & 50%확률
- 영향: `src/clickActions.js`

## [L1] 2026-06-27 — 버티기(Endure) 원복
- 맥락: 0.5초/50%DR로 버프했으나 리턴이 너무 적어짐
- 결정: 원래값 0.2초/80%DR/1.0%HP로 복구, canAIUse 인간분산 50% 유지
- 영향: `src/clickActions.js`, `tests/regression.mjs`

## [L1] 2026-06-27 — 밸런싱 방침 확정
- 맥락: 특정 조합 사기(OP) 방지가 목적. 안 어울리는 조합은 유저가 안 고르므로 제한 불필요
- 결정: 캐릭터 타입별 액션 제한 없음. OP 조합 식별 시 해당 액션 파라미터 조정으로 대응
- 영향: 추후 밸런싱 방향

## [L1] 2026-06-27 — 카운터/버티기 인간 수준 분산 추가
- 맥락: AI가 충돌 타이밍을 완벽하게 계산, Counter/Endure를 100% 성공률로 사용 → 사기. 시뮬: AI 100% vs 인간(반응150ms+예측오차) 54%
- 결정: Counter 55%, Endure 50% 확률로만 활성화 → 인간 수준으로
- 영향: `src/clickActions.js`

## [L1] 2026-06-27 — debug 네임스페이스 + 계층 구조 규칙
- 맥락: 디버그 변수들이 평면적으로 흩어짐 (startCharacter, debugAIEnabled 등)
- 결정: `this.debug = { startCharacter, aiEnabled }` 네임스페이스로 그룹화, `docs/development-rules.md`에 계층 구조 규칙 추가
- 영향: `src/app.js`, `docs/development-rules.md`

## [L1] 2026-06-28 — BattleApp._speed/_action + BattleBall.hero/mastery 네임스페이스
- 맥락: 계층 구조 규칙을 전체 코드베이스에 적용
- 결정: `_battleSpeed/_speedIndicator*` → `this._speed`, `selectedActionId/currentMatchAction` → `this._action`, `heroOrbBonuses/Carryover` → `this.hero`, `masteryPhysicsModifiers/ActionModifiers/CombatPassives` → `this.mastery`
- 영향: `src/app.js`, `src/entities/battleBall.js`, `src/entities/heroOrb.js`, `src/simulation/battleSimulation.js`, `src/ui.js`, `tests/regression.mjs`

## [L1] 2026-06-28 — BattleBall.meta: ability가 자신의 메타정보 소유
- 맥락: `isRanged` 판단을 위해 `RANGED_IDS` Set을 여러 곳에서 하드코딩 중 → ability가 자신의 메타정보를 갖고 BattleBall은 getter로 위임
- 결정: `Ability.meta` getter 추가 (기본 `{ isRanged: false }`), ArcherAbility/GrenadeAbility/GunnerAbility에서 `{ isRanged: true }` 오버라이드, `BattleBall.meta` getter는 `this.ability?.meta`로 위임, aiActionController/clickActions에서 `RANGED_IDS` 제거하고 `fighter.meta.isRanged` 사용
- 영향: `src/abilities/ability.js`, `archerAbility.js`, `grenadeAbility.js`, `gunnerAbility.js`, `src/entities/battleBall.js`, `src/simulation/aiActionController.js`, `src/clickActions.js`

## [L1] 2026-06-28 — BattleBall state/flags/display + Ability state 계층화
- 맥락: BattleBall과 Ability 하위클래스에 30~50개 평면 프로퍼티가 흩어져 변수 스코프 구분 불가
- 결정: BattleBall에 `state`(slow/speedBoost/forcedHeading/movement/swallowed/wallSlam/bounced), `flags`(defeated/destroyed), `display`(spinRotation/scale) 네임스페이스 추가. 10개 Ability 하위클래스에 `state` 네임스페이스 추가 (가변 상태변수 이동). config 상수는 직접 프로퍼티 유지.
- 영향: `src/entities/battleBall.js`, `src/simulation/simulation.js` (optional chaining 추가), `src/abilities/*.js` (10개 파일), `src/simulation/battleSimulation.js`, `src/core.js`, `src/clickActions.js`, `src/combatEffects.js`, `src/app.js`, `src/ui.js`, `src/entities/*.js`, `tests/regression.mjs`, `tests/balanceSim.mjs`

## [L1] 2026-06-28 — UI 로그 순서 수정 + appendCapped 공통 헬퍼
- 맥락: `unshift`로 로그가 위에 쌓임 → 아래로 쌓이게 `push`로 변경, `utils.js`에 `appendCapped` 추가로 통일
- 영향: `src/ui.js`, `src/utils.js`

## [L1] 2026-06-28 — 도전단계 Alpine ↔ 프로필 동기화 버그 수정
- 맥락: UI에서 도전단계 조정해도 프로필에 저장 안 됨 → 토너먼트 시작 시 이전 값 사용
- 결정: `startTournament()`에서 Alpine `challengeLevel` 우선, 프로필도 동기화
- 영향: `src/app.js`

## [L1] 2026-06-28 — BattleBall.stats 네임스페이스 (base stat)
- 맥락: `baseDamage`, `baseDefense`, `baseSpeed`, `baseRadius` 등 base stat들이 평면에 흩어짐
- 결정: `this.stats` 네임스페이스 추가 — `baseDamage`, `baseDefense`, `baseSpeed`, `baseRadius`, `mass`, `allocation` 이동. `hp`, `radius`, `mass`는 외부 호환성을 위해 평면 프로퍼티로도 유지
- 영향: `src/entities/battleBall.js`, `src/abilities/*.js` (12개), `src/app.js`, `src/clickActions.js`, `src/combatEffects.js`, `src/core.js`, `src/entities/*.js` (6개), `src/simulation/battleSimulation.js`, `src/ui.js`, `tests/regression.mjs`

## [L1] 2026-06-28 — 푸시 전 패치노트/문서 경로 정합성
- 맥락: main 푸시 전 `PATCH_NOTES` 작성 규칙이 있는데 미푸시 리팩토링/핫픽스 범위에 패치노트가 없었고, 문서가 실제 파일명 `src/patchNotes.js`가 아닌 옛 경로를 가리킴
- 결정: `v0.22.0` 패치노트 추가, 문서/주석의 패치노트 경로를 `src/patchNotes.js`로 통일
- 영향: `src/patchNotes.js`, `AGENTS.md`, `docs/*`, `src/utils.js`, `SESSION-HANDOFF.md`

## [L1] 2026-06-28 — 경험치 및 캐릭터 레벨 시스템 설계 문서화
- 맥락: 업적 위주 성장만으로는 전투 직후 즉각적인 보상이 부족하게 느껴짐
- 결정: 캐릭터별 XP/레벨을 단기 보상 시스템으로 분리하고, 패배해도 지급되는 XP, 대표 행동 XP, 레벨 보상, 결과 화면 UX, 저장 구조, 회귀 조건을 `docs/experience-system.md`에 기록
- 영향: `docs/experience-system.md`, 성장/도감/숙련도/컬렉션 허브/저장 문서 링크

## [L1] 2026-06-28 — XP 성장에 따른 상대 성장 보정 고려
- 맥락: 플레이어 캐릭터 레벨만 오르면 장기적으로 게임이 너무 쉬워질 수 있음
- 결정: 상대도 저장 XP를 갖는 방식 대신, 토너먼트 시작 시 플레이어 캐릭터 레벨에서 `rivalExperienceScaling`을 파생해 hp/damage/defense에만 제한 적용. 보정은 상한을 두고 도전 단계와 분리해 문서화.
- 영향: `docs/experience-system.md`

## [L1] 2026-06-28 — AI 우승자는 영구 성장 대신 디펜딩 챔피언화
- 맥락: AI 우승 캐릭터가 계속 스탯 성장하면 원래 강한 캐릭터가 더 자주 이기는 양의 피드백으로 밸런스가 깨질 수 있음
- 결정: AI 우승자는 `defendingChampion`으로 저장해 표시/현상금 대상이 되며, 전투력 보정은 없거나 다음 토너먼트 1회성 `championAura`로 제한. 필요 시 최근 우승률이 높은 캐릭터의 보정을 감쇠.
- 영향: `docs/experience-system.md`

## [L1] 2026-06-28 — 디펜딩 챔피언 시각 표식 및 반응형 UI 설계
- 맥락: 챔피언은 텍스트 로그만으로는 전투 중 구분이 약하고, 모바일/PC 화면에서 표시 밀도 요구가 다름
- 결정: 전장 내 챔피언 모자 표식, PC 대진표 배너/현상금 chip/HUD, 모바일 compact strip/짧은 bracket row/결과 팝업 우선순위를 `docs/experience-system.md`에 구체화
- 영향: `docs/experience-system.md`

## [L1] 2026-06-28 — 사냥터 및 상자 해금 시스템 설계 문서화
- 맥락: 토너먼트와 별개로 로그라이크식 사냥터에서 여러 적을 상대하고, 승리 후 귀환/전진을 선택하며, 처치 재화로 등급별 상자를 여는 루프를 구상
- 결정: 사냥터는 토너먼트와 분리된 연전 파밍 모드로 정의. 층, 조우, 귀환/전진, 랜덤 이벤트, 열쇠 조각, 상자 등급/개봉 비용, pending/secured loot, 보관함 UI 요구사항을 `docs/hunting-grounds-system.md`에 기록
- 영향: `docs/hunting-grounds-system.md`, `docs/collection-hub-ui.md`, `docs/player-data-storage-security.md`

## [L1] 2026-06-28 — 다수 전투를 위한 팀 기반 리팩터링
- 맥락: 사냥터와 1대n/n대n 전투를 위해 기존 전투가 사실상 1대1 전제에 머물러 있고, 같은 팀끼리 피해를 주지 않는 구조가 필요
- 결정: `BattleBall.teamId`와 `simulation.isHostile()`, `getEnemiesOf()`, `getNearestEnemy()`를 도입. 명시적 팀이 없으면 fighter별 고유 팀을 부여해 기존 개인전 동작을 유지하고, 같은 팀끼리는 충돌 물리만 적용하며 피해/적대 효과를 차단. 승패는 남은 적대 팀 수로 판단
- 영향: `src/entities/battleBall.js`, `src/simulation/simulation.js`, `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `docs/development-rules.md`, `docs/game-rules.md`, `docs/hunting-grounds-system.md`

## [L1] 2026-06-28 — 스탯 배분 UI 초기화 버그 수정
- 맥락: Alpine 스탯 배분 버튼은 UI 내부 `allocation`만 갱신하고 `BattleApp.playerStatAllocation`에는 알리지 않아, `refreshPlayerSetup()` 같은 화면 갱신이 들어오면 앱이 가진 이전 0 배분으로 UI가 다시 덮일 수 있었음
- 결정: `adjustStat()`, `randomAllocation()`, `resetAllocation()` 후 `allocation-changed` 이벤트를 발행해 앱 상태를 즉시 동기화. `renderPlayerSetup()`은 전달받은 배분 객체를 복사해 UI가 호출자 객체를 직접 변형하지 않게 함
- 영향: `src/ui.js`, `tests/regression.mjs`, `src/patchNotes.js`

## [L1] 2026-06-28 — 스탯 배분 핫픽스 캐시 버전 갱신
- 맥락: 스탯 배분 초기화 수정 후에도 `index.html`의 모듈 캐시 버전 `V`가 오래된 `0.18.1`이라 브라우저가 이전 `src/ui.js?v=0.18.1`을 재사용하면 동일 버그가 계속 보일 수 있었음
- 결정: `index.html`의 캐시 버전을 최신 패치노트 버전 `0.23.2`로 갱신하고, 회귀 테스트에서 `index.html`의 `V`가 `PATCH_NOTES[0].version`과 일치하는지 검증
- 영향: `index.html`, `src/patchNotes.js`, `tests/regression.mjs`

## [L1] 2026-06-28 — 스탯 배분 초기화 race E2E 검증 및 차단
- 맥락: 실제 Playwright E2E에서 수동/자동 배분 후 시작은 유지됐지만, Alpine UI가 BattleApp import보다 먼저 활성화되어 앱 이벤트 리스너 부착 전 입력이 발생할 수 있는 구조를 확인
- 결정: BattleApp 생성 시 이미 존재하는 Alpine `allocation`을 즉시 흡수하고, 로딩 오버레이 제거를 Alpine `x-init`이 아니라 앱 모듈 import 완료 후로 이동. 최신 캐시 버전은 `0.23.3`으로 갱신
- 영향: `src/app.js`, `index.html`, `src/patchNotes.js`, `tests/regression.mjs`

## [L1] 2026-06-29 — PPO 학습 아키텍처 문서명 및 표현 정리
- 맥락: AI 코드 개발 관련 문서가 숫자 임시 파일명으로 생성되어 있고, 제목/섹션/코드 주석에 장식 이모티콘이 많아 장기 문서로 쓰기 어려움
- 결정: 문서 파일명을 `docs/ppo-learning-architecture.md`로 변경하고, PPO/Actor-Critic 데이터 흐름 설명에서 장식 이모티콘과 과한 표현을 문서형 톤으로 정리. 다음 개발 단계는 학습 코드 개선으로 이어감
- 영향: `docs/ppo-learning-architecture.md`, `SESSION-HANDOFF.md`

## [L1] 2026-06-29 — PPO Actor-Critic 학습 코드 반영
- 맥락: 기존 학습 초안은 REINFORCE 단일 정책망 구조라 PPO 문서의 Actor/Critic, old log probability, clipped ratio 업데이트와 맞지 않았음
- 결정: `scripts/rl/policyNetwork.js`에 TensorFlow.js 기반 Actor/Critic 생성, Bernoulli sampling, Critic value prediction, PPO clipped update를 구현하고 `scripts/rl/train.mjs`를 에피소드 rollout → discounted return/advantage batch → PPO epoch 학습 흐름으로 변경. Node 실행 시 CPU 백엔드를 명시하고 짧은 학습 실행용 환경변수를 지원. 액션별 `getFailureReason()`은 PPO rollout의 불가능/중복 액션 필터로 사용
- 영향: `scripts/rl/*`, `src/clickActions.js`, `tests/regression.mjs`, `docs/rl-optimization-guide.md`, `package.json`, `package-lock.json`

## [L1] 2026-06-29 — PPO 학습률 확인 및 rollout buffer 보강
- 맥락: 300 에피소드 비교에서 `lr=3e-4`, `lr=1e-3`, `lr=0` 간 승률 개선이 뚜렷하지 않았고, Eater × LifeSteal은 Rage 상대 승률이 계속 0%라 승패 보상만으로 학습 신호가 부족했음
- 결정: 현재는 중간 보상이 없으므로 보상은 게임 종료 후 승/패 terminal reward만 사용. 대신 PPO rollout buffer를 64 에피소드로 늘리고, decision 샘플을 shuffle한 뒤 `miniBatchSize` 단위로 나눠 여러 epoch 학습하도록 변경. 최근 윈도우 기준 승률/평균 보상/액션 사용률/Actor 평균 확률 로그로 학습 추세를 확인
- 영향: `scripts/rl/train.mjs`, `scripts/rl/policyNetwork.js`, `tests/regression.mjs`, `docs/rl-optimization-guide.md`, `SESSION-HANDOFF.md`

## [L1] 2026-06-29 — 전체 캐릭터 × 전체 액션 PPO 학습 지원
- 맥락: 기존 학습 스크립트는 Dash/Rush, Archer/TimeWarp, Eater/LifeSteal 3개 조합만 하드코딩되어 있어 N 캐릭터 × N 액션 학습을 할 수 없었음
- 결정: 기본 학습 대상을 로스터 전체 캐릭터 × 액션 풀 전체 액션으로 확장. `RL_CHARACTERS`, `RL_ACTIONS`, `RL_MAX_COMBOS`, `RL_OPPONENT_MODE`, `RL_FIXED_OPPONENT`, `RL_NORMALIZER_SAMPLES` 환경변수로 부분 학습/랜덤 상대/스모크 테스트를 지원. 공통 normalizer를 한 번 초기화한 뒤 조합별 clone으로 복사해 초기화 비용을 줄임
- 영향: `scripts/rl/train.mjs`, `scripts/rl/normalizer.js`, `tests/regression.mjs`, `docs/rl-optimization-guide.md`, `SESSION-HANDOFF.md`

## [L1] 2026-06-29 — PPO 학습 전/후 deterministic 평가 추가
- 맥락: 훈련 중 승률은 Actor 샘플링과 탐험이 섞여 있어 학습 전후 정책 자체가 개선됐는지 판단하기 어려웠음
- 결정: 각 캐릭터 × 액션 조합마다 학습 전 `eval before`, 학습 후 `eval after`를 deterministic 정책으로 별도 실행. 평가는 `RL_EVAL_THRESHOLD` 이상일 때만 액션을 사용하고 normalizer 통계를 업데이트하지 않으며, `RL_EVAL_EPISODES`로 평가 횟수를 조절. 최종 결과에 `eval before -> after`와 delta를 출력
- 영향: `scripts/rl/train.mjs`, `scripts/rl/policyNetwork.js`, `tests/regression.mjs`, `docs/rl-optimization-guide.md`

## [L1] 2026-07-02 — Orbit 투사체 벽 반사 버그 수정
- 맥락: Orbit 투사체가 벽에 튕기지 않고 달라붙는 버그 발견
- 결정: `bx, by` 위치 저장을 `_integrateAndClamp()` 전으로 이동, 중복 `keepEntityInsideArena` 제거
  - 원인: `_integrateAndClamp()`가 내부에서 이미 클램프한 후에 `bx,by`를 저장해 충돌 감지 실패
  - `dir`이 갱신되지 않아 매 프레임 `applyImpulse`가 속도를 다시 벽 방향으로 되돌림
- 영향: `src/entities/orbitProjectile.js`

## [L1] 2026-07-02 — AI 액션 spend 실패 시 _consecutiveYes 미초기화 버그 수정
- 맥락: AI가 HP=1일 때 spendHpForAction이 0 반환 → _consecutiveYes가 3+ 유지 →
  매 프레임 decided=true로 재시도 → 회복 시 쿨다운 없이 즉시 발동 (burst)
- 결정: spend 실패 시 `_consecutiveYes = 0` 리셋 추가, _nextAvailableAt은 유지
- 영향: `src/simulation/aiActionController.js`

## [L2] 2026-07-03 — Time Warp RL 패널티 0.02→0.15 인상 (코드만, 미학습)
- 배경: Time Warp가 훈련 중 0.5s마다 무조건 사용하도록 학습 (95.87% 승률). 사용 패널티 0.02가 너무 낮아 스팸이 최적 전략.
- 결정: `time_warp` penalty 0.02→0.15 (7.5배). 10회 사용 시 -1.5 보상 차감. 재학습 필요.
- 영향: `scripts/rl/train.mjs`

## [L2] 2026-07-03 — Shockwave 밀치기 재설계 (applyKnockback + 벽꽝)
- 배경: 1) `applyImpulse`만 사용 → 같은 프레임 `_applyVelocityCorrection`이 즉시 상쇄 → 넉백 미체감. 2) 데미지 0 + 벽 충돌 피드백 없음.
- 결정: (1) `fighter.applyImpulse()` → `fighter.applyKnockback(vel, 0.12)`로 변경 — `forceHeading`으로 0.12s 동안 넉백 방향 유지, 속도보정이 방해하지 않음. (2) `DEFAULT_PUSH_FORCE` 400→600 (50%↑). (3) `WallSlamEffect` 추가 — 벽 충돌 시 데미지(`force×0.05`, 최대 30) + 시각/사운드 피드백.
- 영향: `src/clickActions.js` (WallSlamEffect import, applyKnockback 사용, pushForce 증가)

## [L1] 2026-07-03 — PPO rollout의 기존 AI 액션 호출 기본 비활성화
- 맥락: `BattleSimulation`의 `assignActions`는 false여도 `scripts/rl/train.mjs`가 직접 `fighter.aiController`를 붙이면 `BattleBall.update()`에서 기존 `AIActionController.evaluate()`가 Actor 선택과 별개로 액션을 발동할 수 있었음
- 결정: `RL_BUILTIN_AI_ACTIONS` 플래그를 추가하고 기본값을 false로 설정. normalizer 샘플링과 학습/평가 episode 모두 기본적으로 기존 AI 컨트롤러를 붙이지 않으며, PPO Actor가 직접 `scheduleAction()`한 액션만 반영
- 영향: `scripts/rl/train.mjs`, `docs/rl-optimization-guide.md`

## [L1] 2026-07-03 — 앱 기본 디버그 AI 액션 플래그 비활성화
- 맥락: `BattleApp.debug.aiEnabled`가 true라 일반 앱 실행에서도 `assignActions`가 켜져 기존 AI 액션 컨트롤러가 자동 부착될 수 있었음
- 결정: `this.debug.aiEnabled` 기본값을 false로 변경. 단, 챌린지 레벨이 1 이상이면 기존 조건 `this._currentChallengeLevel > 0`에 의해 AI 액션 배정은 계속 활성화됨
- 영향: `src/app.js`

## [L1] 2026-07-03 — XP 결과 오버레이 브라우저 E2E 진단
- 맥락: XP 지급 로그/토스트는 나오지만 결과 오버레이의 XP subtext가 실제 브라우저에서 안 보인다는 의심이 있어 DevTools 수준 상태 확인이 필요했음
- 결정: 로컬 서버(`http://127.0.0.1:4173/`)에서 Playwright 브라우저 E2E로 토너먼트 1회 진행. `window.ballFightApp._lastXpResult`는 `{ xpGained: 7, totalXp: 7, level: 1, levelUp: false }`, `app.ui.state.overlaySubtext`는 `+7XP (Lv.1) | 도전 단계 0 도전 실패 | 해금 단계는 유지됩니다`, overlay `<p>` 텍스트와 `display:block` 확인. 현재 코드 기준 XP UI는 표시 정상으로 판정
- 영향: 코드 변경 없음, `SESSION-HANDOFF.md`

## [L1] 2026-07-03 — XP를 유저 매치 종료마다 즉시 지급
- 맥락: XP는 원래 토너먼트 종료 시점이 아니라 유저가 참가한 매 전투 종료 직후 보여야 하는 보상인데, 기존 구현은 `showTournamentChampion()`에서 토너먼트 단위로 지급해 최종 화면에서만 표시됐음
- 결정: `grantExperienceFromMatchReport()`를 추가하고 `BattleApp.finishMatch()`가 유저 참가 매치 리포트를 완성한 직후 XP 지급, 로그, 토스트, 결과 오버레이 subtext, 프로필 저장을 처리하도록 변경. 토너먼트 종료 단계의 일괄 XP 지급은 제거하고 업적/숙련도/도전 단계 처리만 남김
- 영향: `src/app.js`, `src/experience/experienceService.js`, `src/experience/index.js`, `tests/regression.mjs`, `docs/experience-system.md`
- 검증: `npm test`, `npm run check`, `npm run format:check` 통과. Playwright E2E에서 첫 유저 매치 종료 직후 `overlaySubtext="+7XP (Lv.1)"`, overlay `<p>` `display:block`, 스크린샷 `tmp-xp-match-proof.png` 확인

## [L1] 2026-07-04 — 캐릭터별 XP 저장과 XP 전용 UI 정합화
- 맥락: 경험치는 원래 캐릭터별 성장인데 구현이 전역 `experience.currentXp`로 되어 있어 캐릭터별 XP를 초기 화면/도감에서 볼 수 없었고, 매치 종료 보상도 텍스트 한 줄이라 보상감이 약했음
- 결정: `experience.byCharacter[characterId].currentXp`를 정식 저장 구조로 도입하고 전역 `currentXp`는 합계/레거시 호환 필드로 유지. 레거시 전역 XP만 있는 세이브는 최근 플레이 기록 캐릭터로 귀속. 매치 종료 결과 오버레이에 자동 진행을 막지 않는 XP 전용 바 패널을 추가하고, 초기 내 캐릭터 패널과 컬렉션 허브 도감 카드/상세에 캐릭터별 XP 레벨/진행도/다음 보상을 표시
- 영향: `src/playerProfile.js`, `src/experience/experienceService.js`, `src/experience/index.js`, `src/app.js`, `src/ui.js`, `src/collection/collectionViewModel.js`, `index.html`, `src/styles.css`, `tests/regression.mjs`, `docs/experience-system.md`, `docs/collection-hub-ui.md`
- 검증: `npm test`, `npm run check`, `npm run format:check` 통과. Playwright E2E에서 PC 결과 XP 패널 `width:60%`, `byCharacter.dash.currentXp=60`, 도감 상세 `60/100 XP`, 모바일 결과 XP 패널 `bodyScrollWidth=viewportWidth=390` 확인

## [L1] 2026-07-04 — 사냥터 MVP 기반 상태/보상/보관함 저장 구조 구현
- 맥락: 다음 단계가 사냥터 MVP 구현이며, 실제 전투 UI를 붙이기 전에 우승 캐릭터 입장 조건, 층간 HP 누적 상태, 귀환/패배 보상 처리, 상자 파손 연쇄 확률을 순수 함수로 먼저 고정해야 했음
- 결정: `src/hunting/` 모듈을 추가해 사냥터 설정, 보상, 적 스케일링, 이벤트, 런 상태, 상자 개봉 가능 여부를 분리 구현. `playerProfile.hunting`에 해조각/상자/설계도/통계를 저장하고 sanitize에서 중복 상자 ID를 제거. 컬렉션 허브에는 보관함 탭을 최소 표시해 해조각과 상자 목록/개봉 가능 여부를 확인할 수 있게 함
- 영향: `src/hunting/*`, `src/playerProfile.js`, `src/collection/collectionViewModel.js`, `src/ui.js`, `index.html`, `src/styles.css`, `tests/regression.mjs`, `docs/hunting-grounds-system.md`, `docs/collection-hub-ui.md`
- 검증: `npm test` 통과. 입장 조건, 층별 스케일링, 해조각 보상, pending→secured 귀환, 패배 시 상자 파손 순서/50% 해조각/70% XP 보존, 상자 개봉 비용, 프로필 sanitize, 보관함 ViewModel을 회귀 테스트로 확인

## [L1] 2026-07-04 — Alpine 템플릿 컴포넌트 시스템 기반 구성
- 맥락: 사용자가 기존 Alpine 개발에서 쓰던 `x-component`/`template-*` 기반 커스텀 컴포넌트 패턴을 이 프로젝트에도 구성하기 원했고, 사냥터 UI 전에 시스템부터 잡아야 했음
- 결정: Alpine 공식 확장 문서 기준에 맞춰 `Alpine.start()` 전 `registerAlpineComponentSystem(Alpine)`을 등록. `src/alpineTemplateComponents.js`에 `x-component` directive, kebab-case 이름 검증, `template-` 접두사 해석, `template.content.cloneNode(true)` 복제, 복제된 자식 루트 `Alpine.initTree(child)` 초기화를 구현. 호스트 자체 재초기화는 피함
- 영향: `src/alpineTemplateComponents.js`, `index.html`, `tests/regression.mjs`, `docs/alpine-component-system.md`, `docs/development-rules.md`, `SESSION-HANDOFF.md`
- 검증: `npm test`의 `[alpine-components] ok`에서 이름 검증/템플릿 해석/마운트/등록 동작 확인

## [L1] 2026-07-04 — x-component 실사용/중첩/예외 예시 추가
- 맥락: 시스템만 있고 실제 사용 예시가 없어 사용자가 일반 예시, 중첩 컴포넌트 예시, 예외사항 예시를 요청
- 결정: 결과 오버레이 XP 보상 패널을 `template-xp-reward-panel` + `x-component="xp-reward-panel"` 실사용 예시로 전환하고, 내부 XP 진행 바를 `template-xp-progress-bar` + 중첩 `x-component="xp-progress-bar"`로 분리. 문서에 일반/중첩/잘못된 이름/없는 템플릿/대량 반복/외부 입력 금지 예시를 추가하고 회귀 테스트에 실제 HTML 예시 존재, 중첩 mount, invalid/missing template, `initTree` 부재 fallback 검증을 추가
- 영향: `index.html`, `docs/alpine-component-system.md`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm run format`, `npm test`, `npm run check`, `npm run format:check` 통과. 브라우저 DOM 확인에서 `xp-reward-panel`/`xp-progress-bar` 템플릿 존재, 보상 패널/중첩 진행 바 `data-component` 스탬프, `.xp-bar` 마운트, 콘솔 에러 없음 확인
- 현재 상태: 바로 아래 태그 기반 전환 결정으로 실제 사용 예시는 `<xp-reward-panel>`/`<xp-progress-bar>`가 기준이며, `x-component`는 보조/호환 문법으로만 유지

## [L1] 2026-07-04 — 템플릿 컴포넌트 기본 문법을 태그 기반으로 전환
- 맥락: 사용자가 예전 Alpine 컴포넌트 시스템처럼 `div x-component`가 아니라 태그 자체로 컴포넌트를 쓰는 방식을 선호한다고 확인
- 결정: `src/alpineTemplateComponents.js`에 `<component-name>` 태그 호스트 탐색/마운트 기능을 추가하고, `registerAlpineComponentSystem(Alpine)`이 `Alpine.start()` 전에 태그 컴포넌트를 템플릿으로 확장하게 변경. `x-component` directive는 호환/보조 문법으로 유지. XP 보상 패널 실사용 예시는 `<xp-reward-panel>`, 중첩 진행 바는 `<xp-progress-bar>`로 전환
- 영향: `src/alpineTemplateComponents.js`, `index.html`, `tests/regression.mjs`, `docs/alpine-component-system.md`, `docs/development-rules.md`, `SESSION-HANDOFF.md`
- 검증: `npm run format`, `npm test`, `npm run check`, `npm run format:check` 통과. 브라우저 DOM 확인에서 `xComponentHosts=0`, `<xp-reward-panel>`/`<xp-progress-bar>` `data-component` 스탬프, `.xp-bar` 마운트, 콘솔 에러 없음 확인

## [L1] 2026-07-04 — 템플릿 컴포넌트 파일 분리 (template.html + script 일체형)
- 맥락: index.html에 인라인 `<template>`이 있어 컴포넌트가 늘어날수록 유지보수 어려움. HTML을 JS 문자열로 넣으면 IDE 도움(구문 강조, 자동완성)을 못 받음
- 결정: (1) `src/componentLoader.js` 추가 — fetch → `<template>` 주입, `<script>`는 분리해서 실행 (2) 기존 `<template>`을 `src/components/<name>/template.html`로 분리, `<script>` 포함 가능 (3) 컴포넌트별 Alpine.data 등록은 template.html 내 `<script>`로 처리
- 영향: `src/componentLoader.js` 생성, `src/components/xp-reward-panel/template.html`, `src/components/xp-progress-bar/template.html`, `index.html`(`<template>` 2개 제거, `loadTemplates()` 호출 추가), `tests/regression.mjs`(inline template 검증 대신 COMPONENTS 배열 검증)
- 검증: `npm test`, `npm run check`, `npm run format:check` 통과

## [L2] 2026-07-04 — 컴포넌트 자체 x-data 스코프 + Alpine.store() 브릿지
- 배경: 분리된 컴포넌트가 여전히 부모 appStore의 xpReward를 직접 참조해 독립적이지 않음. Vue 컴포넌트처럼 각 컴포넌트가 자체 스코프를 가져야 함
- 결정: (1) 각 템플릿 root에 `x-data="ComponentName"` 추가 (2) 데이터 교환은 `Alpine.store('xpReward', data)`로 통일 (3) `UIController._showXpReward`에서 `s.xpReward = {...}` → `Alpine.store('xpReward')`로 변경 (4) `index.html`의 `<xp-reward-panel>`에서 `x-show`/`x-bind:class`를 템플릿 내부로 이동
- 영향: `src/ui.js`(UIController store 변경), `index.html`, `src/components/xp-reward-panel/template.html`(x-data + $store), `src/components/xp-progress-bar/template.html`(x-data + $store), `tests/regression.mjs`(Alpine store mock 추가)
- 검증: `npm test`, `npm run check`, `npm run format:check` 통과

## [L2] 2026-07-04 — 컴포넌트 폴더 구조를 단일 HTML 파일로 플랫화
- 배경: `src/components/<name>/template.html`은 폴더 하나에 파일 하나만 담겨 불필요하게 깊음
- 결정: `src/components/<name>.html`로 평탄화. 폴더 제거, 파일만 존재
- 영향: `src/components/xp-reward-panel.html`, `src/components/xp-progress-bar.html`, `src/componentLoader.js`(fetch 경로), `tests/regression.mjs`(URL 경로), `docs/alpine-component-system.md`

## [L1] 2026-07-04 — PopupDialog 컴포넌트화 (x-html → Alpine.store() + scoped CSS)
- 맥락: PopupService가 `Alpine.$data(root)`로 직접 Alpine 데이터를 조작하고, x-html body를 인라인 Alpine 템플릿이 렌더링하는 구조 → 컴포넌트 시스템 첫 확장 대상
- 결정: (1) `src/components/popup-dialog.html` 생성 — 자체 `x-data="popupDialog"` + `$store.popupDialog` 구독 + 모든 `bf-popup-*` 스타일 scoped CSS로 이동 + x-html body 유지 (2) `PopupService.show()` → `Alpine.store('popupDialog', data)`로 변경, `window.PopupService = PopupService`로 전역 노출 (3) `src/ui.js`에서 `popupVisible`/`popupContent`/`closePopup()` 제거 (4) `index.html` 인라인 팝업 템플릿 → `<popup-dialog>` 태그로 대체 (5) `src/styles.css`에서 `bf-popup-*` 13개 규칙 제거 (help-section 등은 x-html 컨텐츠 스타일로 유지)
- 영향: `src/components/popup-dialog.html`(신규), `src/popup.js`, `src/ui.js`, `index.html`, `src/styles.css`, `src/componentLoader.js`(COMPONENTS 추가)
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-04 — componentLoader 자동 발견으로 전환 (COMPONENTS 배열 제거)
- 맥락: 컴포넌트 추가 시마다 `COMPONENTS` 배열에 이름을 수동 등록해야 하는 번거로움
- 결정: `loadTemplates()`가 DOM을 스캔하여 `<xp-reward-panel>` 같은 커스텀 태그를 자동 발견. 이미 로드된 템플릿 내부의 중첩 컴포넌트도 재귀적으로 발견. `COMPONENTS` 배열과 `components` 파라미터 제거. `getLoadedComponents()` 헬퍼 export
- 영향: `src/componentLoader.js`, `tests/regression.mjs`(COMPONENTS import 제거, 파일 존재 검증으로 대체)
- 검증: `npm test`, `npm run format:check` 통과

## [L2] 2026-07-04 — `Alpine.reactive()`로 컴포넌트 상태 반응성 수정
- 배경: `Alpine.data()` 컴포넌트의 `$watch` 콜백과 클로저 함수에서 `const state = {}`의 속성을 직접 변경할 때 Alpine의 reactive Proxy를 우회하여 DOM 업데이트가 발생하지 않는 문제 발견. 도움말 `?` 버튼 클릭 시 popup이 표시되지 않던 원인.
- 결정: 모든 컴포넌트에서 `const state = { ... }`를 `const state = Alpine.reactive({ ... })`로 변경. `Alpine.reactive()`는 Alpine 3.x의 public API로, Proxy 기반 깊은 반응성 객체를 생성하여 클로저 내 돌연변이도 Alpine 의존성 추적을 트리거함.
- 영향: `src/components/popup-dialog.html`, `src/components/xp-reward-panel.html`, `src/components/toast-notification.html`
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-04 — 액션 선택기, 패치노트, 컬렉션 허브 컴포넌트화 완료
- 맥락: 남은 인라인 Alpine 패널(액션 선택기, 패치노트, 컬렉션 허브)을 단일 HTML 파일 컴포넌트로 분리. 컬렉션 허브는 4탭/계산 getter/400줄 scoped CSS 포함
- 결정: (1) `src/components/action-picker.html` — `Alpine.reactive()` 상태 + scoped CSS. `src/actionPicker.js` — `ActionPickerService.show()/resolve()`. (2) `src/components/patch-notes.html` — `Alpine.reactive()` + scoped CSS. `src/patchNotesService.js` — `PatchNotesService.show()/dismiss()`. (3) `src/components/collection-hub.html` — 4탭 모달, `Alpine.reactive()`에 computed getter(`filteredRoster/Mastery/Achievement/StorageItems`) 포함, scoped CSS ~400줄. `src/collectionHubService.js` — `CollectionHubService.render()/open()/close()`. (4) `index.html` — 3개 `<template>` 제거. (5) `src/ui.js` — `actionPicker*`/`patch*`/`collectionHub*` 상태/메서드 제거. (6) `src/app.js` — `waitForActionPick` → `ActionPickerService.show()`, `renderCollectionHub` → `CollectionHubService.render()`. (7) `src/styles.css` — `.action-*` `.patch-*` `.ch-*` CSS 제거 (총 ~650줄). (8) `componentLoader.js` — 자동 발견으로 전환 완료.
- 영향: `src/components/action-picker.html`, `src/actionPicker.js`, `src/components/patch-notes.html`, `src/patchNotesService.js`, `src/components/collection-hub.html`, `src/collectionHubService.js`, `index.html`, `src/ui.js`, `src/app.js`, `src/styles.css`, `docs/alpine-component-system.md`
- 검증: `npm test`, `npm run format:check` 통과. 인라인 Alpine 패널 0개

## [L1] 2026-07-04 — 사냥터 MVP 전투 연결 완료
- 맥락: 사냥터 기반 코드(huntingState/huntingConfig/huntingEncounters/huntingRewards)는 구현되어 있었으나 메인 화면 입장 버튼, 캐릭터 선택, 실제 BattleSimulation 연동, 승리 후 귀환/전진 선택 UI가 없었음
- 결정: (1) `src/hunting/huntingManager.js` — HuntingManager 클래스. `BattleApp._onSimulationResult` 훅을 통해 사냥 전투 완료 처리, 층별 HP 캐리오버, 귀환/전진/랜덤 이벤트 처리, 프로필 병합 담당. (2) `src/app.js` — `_onSimulationResult` 훅 추가, `loop()`에서 사냥 전투 완료 시 `finishMatch()` 대신 훅 호출, `_huntingDone` 플래그로 "확인" 버튼이 `startTournament()`를 트리거하지 않도록 방지. (3) `index.html` — `⚔ 사냥터` 버튼 (조건 `!locked && !tournamentActive && !huntingActive`), overlay 카드 내 귀환/전진 선택 버튼. (4) `src/ui.js` — `huntingActive`, `huntingChoiceVisible`, `huntingFloor`, `huntingCharacterName`, `huntingLootSummary` 상태 + `openHuntingLobby()/huntingRetreat()/huntingAdvance()` 메서드. (5) `src/styles.css` — 사냥터 버튼/선택/오버레이 CSS 추가
- 영향: `src/hunting/huntingManager.js`(신규), `src/app.js`, `index.html`, `src/ui.js`, `src/styles.css`
- 검증: `npm test`, `npm run format:check` 통과

## [L2] 2026-07-04 — scoped CSS `@scope` → 선택자 프리픽스 방식으로 전환
- 배경: `@scope ([data-v-xxxxx])` 방식은 브라우저 지원 범위가 제한적이고(Chrome 118+/Firefox 146+), `<style scoped>` 내 선언된 선택자만 스코핑하는 원래 의도와 달리 `@scope` 블록 전체가 모든 자손 선택자의 스코프를 변경
- 결정: `componentLoader.js`에 `rewriteScopedCss()` 추가 — CSS 토크나이저로 각 선택자를 파싱하여 `[data-v-xxxxx]` 프리픽스를 붙임. `:scope`는 `[data-v-xxxxx]`로 변환. `@media`/`@supports`는 재귀 처리. 주석/`@keyframes`는 건너뜀. 템플릿 HTML의 클래스명은 변경되지 않음
- 영향: `src/componentLoader.js`(신규 함수 `rewriteScopedCss`, `loadSingle`에서 `@scope` 대신 사용), `docs/alpine-component-system.md`(설명 업데이트)
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-04 — 사냥터 운영 버그 5종 수정 + 액션 선택 스킵 플래그
- 맥락: 사냥터 MVP 전투 연결 후 발견된 버그들 — 컬렉션 허브 흰 글자, 팝업 크기 변동, 사냥터 버튼 위치, Alpine store null 크래시, PopupService.close 미구현, 전진/귀환 버튼 미클릭
- 결정: (1) 컬렉션 허브 `.ch-detail-body`/`.ch-mast-info`/`.ch-ach-info`에 `color` 추가 (body `#f4f7fb` 상속 방지). (2) `.ch-content` `min-height: 0` → `400px` (탭 전환 시 팝업 수축 방지). (3) `.hunting-btn.control-button` `bottom: 64px` → `90px` (시작 버튼과 간격 확보). (4) `Alpine.store("name", null)` 3건 → `{ visible: false, ... }` 객체로 변경 (Alpine 내부 `Object.getOwnPropertyDescriptors(null)` TypeError 방지). (5) `PopupService.close()` 정적 메서드 추가. (6) `startMatch({ skipActionPick: true })` — 사냥터에서 액션 선택 UI 스킵. (7) `.hunting-choice-buttons { pointer-events: auto }` — overlay의 `pointer-events: none` 우회.
- 영향: `src/components/collection-hub.html`, `src/actionPicker.js`, `src/patchNotesService.js`, `src/components/popup-dialog.html`, `src/popup.js`, `src/app.js`, `src/hunting/huntingManager.js`, `src/styles.css`

## [L1] 2026-07-04 — 사냥터 상자 보상 테이블과 이벤트 확장 연결
- 맥락: 사냥터 전투 연결 이후 `createHuntingChest()`가 등급/id 중심 더미에 가까웠고, 이벤트 풀도 휴식지/상자방 중심이라 실제 로그라이크식 보상/위험 선택감이 부족했음
- 결정: (1) 상자 5등급과 `key_shards`/`instant_heal`/`temporary_stat` 보상 타입, 등급별 reward table, `rewardTableVersion`, `rewardPreview`, `openCost`를 추가. (2) `openHuntingChest()`가 실제 reward를 굴리고 해조각 보상은 즉시 프로필에 반영, HP/임시 스탯은 후속 런 적용용 deferred effect로 반환. (3) `rest_site`, `chest_room`, `cursed_altar`, `champion_intrusion` 이벤트 payload를 생성. (4) 저주받은 제단은 `run.statModifiers`에 gain/loss modifier를 추가하고 전투 클리어 시 지속 층수를 소모. (5) 챔피언 난입은 다음 적을 champion 타입으로 스케일하고 승리 해조각 보상에 1.5배 배율 적용
- 영향: `src/hunting/huntingConfig.js`, `src/hunting/huntingRewards.js`, `src/hunting/chestRewards.js`, `src/hunting/huntingEncounters.js`, `src/hunting/huntingState.js`, `src/hunting/huntingManager.js`, `tests/regression.mjs`, `docs/hunting-grounds-system.md`, `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run check`, `npm run format:check` 통과

## 진행 중 이슈
- 밸런스 안정화됨 (±20% 이상 극단치 없음). Dash +27% 강세, 일부 캐릭터 약하락
- Time Warp 패널티 인상은 재학습 후 반영
- 사냥터 HP 층간 완전 누적 적용, 휴식지 이벤트 회복량 25%는 임시값
- 사냥터 HP/임시 스탯 상자 보상은 deferred effect payload까지만 반환됨 — 실제 런 시작/진행 UI 적용은 후속 작업
- **Alpine.store() 절대 null 설정 금지** — 모든 서비스/컴포넌트에서 강제해야 함. 대신 `{ visible: false, ... }` 빈 상태 객체 사용
- **ES Module 이중 import 방지**: module-level 변수가 필요한 서비스는 Alpine store에 저장. `index.html`에서 `?v=${V}` import와 JS static import가 다른 instance를 생성할 수 있음.

## 다음 할 일
1. 전체 N×N PPO 학습 결과 저장 구조 설계: `{charId, actionId}`별 Actor/Critic/normalizer 저장 단위 결정
2. 사냥터 deferred effect 적용 UI/런 시작 연결: `instant_heal`, `temporary_stat` 보상을 다음 사냥터 런에 실제 적용
3. Time Warp 패널티 인상분 재학습 및 Dash +27% 강세 밸런스 검토

## [L1] 2026-07-04 — player-panel / tournament-bracket 컴포넌트화 ($dispatch 이벤트 패턴 적용)
- 맥락: 마지막 남은 인라인 Alpine 패널 2개(player-panel, bracket)를 컴포넌트화. player-panel은 x-for 내부 버튼이 많아 기존 `@click="adjustStat()"` 호출이 컴포넌트 x-data 스코프 밖으로 나가면 동작하지 않는 문제가 있음
- 결정: (1) `<player-panel>` — 자체 `x-data="playerPanel"` + `Alpine.reactive()` 상태 + `Alpine.store("playerPanel")` 브릿지. 모든 액션 버튼을 `$dispatch('adjust-stat', {key, delta})`, `$dispatch('random-allocation')`, `$dispatch('reset-allocation')`, `$dispatch('adjust-challenge-level', {delta})`, `$dispatch('open-collection-hub')`로 변경. 이벤트 리스너는 appStore.init()의 `_listenComponentEvents()`에서 document.addEventListener로 등록. (2) `<tournament-bracket>` — `aside.tournament-panel`을 root로 포함, `state.visible`/`phase`/`rounds`를 Alpine.store 브릿지로 제어. (3) `renderPlayerSetup()` — appStore + Alpine.store("playerPanel") 이중 동기화. (4) `renderTournament()` — `Alpine.store("tournamentBracket")`에 visible/phase/rounds 기록. (5) `_syncSummary()` — 추가로 `Alpine.store("playerPanel")`에 allocation/allocationSummary/remainingPoints 동기화. (6) `adjustChallengeLevel()` — 추가로 `_syncPlayerPanelChallenge()` 호출. (7) CSS — player-panel/bracket/tournament-panel 전용 CSS ~52개 규칙을 styles.css에서 제거하고 각 컴포넌트 scoped CSS로 이동
- 영향: `src/components/player-panel.html`(신규), `src/components/tournament-bracket.html`(신규), `src/ui.js`(renderPlayerSetup/renderTournament/_syncSummary store 브릿지 + _listenComponentEvents + _syncPlayerPanelChallenge), `index.html`(store 초기화 2종 + 인라인 패널→컴포넌트 태그 교체), `src/styles.css`(~52개 규칙 제거), `tests/regression.mjs`(store 초기화 2종 추가)
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-04 — 사냥터 전투 컨셉을 1대다 몹 전투로 재정렬
- 맥락: 사용자가 현재 사냥터가 의도와 다르게 로스터 캐릭터 1대1 반복처럼 구성되어 있다고 지적. 사냥터는 기본적으로 플레이어 1명 대 다수 몹 전투여야 하고, 기존 기본 캐릭터들은 일반 적이 아니라 중간 보스 정도로 사용해야 함.
- 결정: 사냥터 전용 몹 스펙을 `melee`/`ranged` 2종으로 추가하고, 일반 층은 다수 몹 팩으로 구성. 3층 단위 또는 `champion_intrusion` 이벤트에서는 로스터 캐릭터를 중간 보스로 변환해 몹과 함께 등장. 플레이어/적은 `hunting-player`/`hunting-enemy` 팀으로 구분해 같은 팀 피해를 방지.
- 결정: 물리 경기장 크기는 유지하고 `ArenaCamera` 렌더 줌으로 사냥터 다수전 시야만 `0.78`로 축소. 일반 1대1은 기본 `1.0` 시야 유지.
- 영향: `src/hunting/huntingMonsters.js`, `src/hunting/huntingManager.js`, `src/simulation/battleSimulation.js`, `src/camera.js`, `src/ui.js`, `src/app.js`, `tests/regression.mjs`, `docs/hunting-grounds-combat-update.md`

## [L1] 2026-07-04 — 사냥터 버튼은 우승 캐릭터가 있을 때만 노출
- 맥락: 사용자가 사냥터는 기본적으로 한 번이라도 우승해서 사용 가능한 캐릭터가 존재할 때 버튼이 생성되어야 한다고 요청.
- 결정: `refreshPlayerSetup()`에서 `getEligibleHuntingCharacters(playerProfile, roster)` 결과를 기준으로 `huntingAvailable` 상태를 계산하고, 메인 화면 사냥터 버튼은 `huntingAvailable && !tournamentActive && !huntingActive`일 때만 표시.
- 영향: `src/app.js`, `src/ui.js`, `index.html`, `tests/regression.mjs`

## [L1] 2026-07-04 — 근접몹은 전용 추적 능력으로 이동
- 맥락: 사용자가 사냥터 근접몹이 움직이지 않는다고 보고. 기존 근접몹은 `dash` 능력을 재사용해 쿨다운 돌진 외에는 플레이어 추적형 몹처럼 보이지 않았음.
- 결정: `HuntingMeleeAbility`를 추가해 근접몹이 매 프레임 가장 가까운 적을 향해 조향하도록 변경. 근접몹 스펙은 `ability: "hunting_melee"`를 사용하고, 시뮬레이션/UI ability map에 등록.
- 검증: 수치 시뮬레이션에서 근접몹과 플레이어 거리 `460 -> 187.55` 감소 확인. `npm test`, `npm run check`, `npm run format:check` 통과.
- 영향: `src/abilities/huntingMeleeAbility.js`, `src/abilities/index.js`, `src/hunting/huntingMonsters.js`, `src/simulation/battleSimulation.js`, `src/ui.js`, `tests/regression.mjs`

## [L1] 2026-07-04 — 사냥터는 실제 물리 맵을 키우고 카메라는 전체 맵에 맞춤
- 맥락: 사용자가 기존 구현은 카메라 줌만 바뀌고 실질 맵 크기가 커지지 않았다고 지적. 카메라는 기본적으로 전체 맵을 보이게 하고, 사냥터는 실제 맵 크기를 더 크게 조절해야 함.
- 결정: `BattleSimulation`이 `arenaWidth`/`arenaHeight` 옵션을 받아 실제 `Simulation.width/height`를 바꾸도록 변경. 사냥터는 `HUNTING_ARENA` 1280×1280을 사용. `ArenaCamera`는 전투원 수 기반 자동 줌아웃을 제거하고 현재 시뮬레이션 맵 전체를 캔버스에 fit-to-map으로 맞춤.
- 검증: 수치 시뮬레이션에서 사냥터 arena `[1280,1280]`, 960 캔버스 cameraScale `0.75` 확인. `npm test`, `npm run check`, `npm run format:check` 통과.
- 영향: `src/hunting/huntingConfig.js`, `src/hunting/huntingManager.js`, `src/simulation/battleSimulation.js`, `src/camera.js`, `src/ui.js`, `src/app.js`, `tests/regression.mjs`, `docs/hunting-grounds-combat-update.md`

## [L1] 2026-07-05 — player-panel $dispatch → $store._actions 전환 (버튼 무반응 디버깅 중)
- 맥락: `@click="$dispatch(...)"` 이벤트가 `template.cloneNode(true)`로 복제된 컴포넌트 내부에서 `document` 리스너까지 전파되지 않는 문제. `_listenComponentEvents()`를 appStore.init()에서 등록해 document가 이벤트를 수신하게 했으나, 실제 브라우저에서 버튼이 여전히 무반응.
- 결정: $dispatch 이벤트 패턴을 폐기하고 `Alpine.store("playerPanel")._actions` 콜백 객체로 전환. UIController._exposeActionsToPlayerPanel()이 `renderPlayerSetup()` 실행 직후 store._actions에 바인딩된 콜백({adjustStat, randomAllocation, resetAllocation, adjustChallengeLevel, openCollectionHub})을 저장. 템플릿은 `@click="$store.playerPanel._actions.adjustStat(key, delta)"`로 직접 호출. _listenComponentEvents() 제거.
- 영향: `src/components/player-panel.html`(@click 모두 $store._actions로 변경, state getter 제거), `src/ui.js`(_exposeActionsToPlayerPanel 추가, _listenComponentEvents 제거), `index.html`(store 초기화에 _actions: null 추가)
- 검증: `npm test`, `npm run format:check` 통과. BUT 브라우저에서 버튼 여전히 무반응 (원인 불명)
- 미해결 원인 추정: `$watch("$store.playerPanel", callback)`가 전체 store 참조를 감시하므로 store 내부 속성 변경(alocation 등)이 발생해도 watcher가 재실행되지 않을 가능성. 현지 `state → `$store.playerPanel` 직접 참조로 전환 시도 예정. player-panel 템플릿이 `state.xxx` 대신 `$store.playerPanel.xxx`를 직접 사용하면 watcher 회피 가능.

## [L1] 2026-07-05 — 사냥터 몹 사망 즉시 폭발 이펙트 + 화면 제거
- 맥락: 몹 캐릭터가 HP=0이 되면 `flags.defeated=true`만 설정되어 `update()`가 중단되지만 `draw()`는 계속 그려서 죽은 몹이 멈춰있는 버그처럼 보임
- 결정: (1) `BattleBall.takeDamage()`에서 HP<=0 시 `flags.destroyed=true`를 함께 설정하고 `sim.spawnDeathExplosion()` + 로그를 즉시 호출. (2) `BattleSimulation.resolveResult()`에서 이미 `flags.destroyed`가 true인 패자는 중복 이펙트를 건너뛰도록 `continue` 추가.
- 영향: `src/entities/battleBall.js:304-311`, `src/simulation/battleSimulation.js:435`
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-05 — 몹 전투원 fighter strip 제외 + 인게임 HP바
- 맥락: 몹이 많으면 fighter strip이 늘어나 캔버스가 위로 밀리는 레이아웃 문제. UX 개선 요청으로 미니보스만 strip 표시, 일반 몹은 캔버스 내 HP 바로만 확인.
- 결정: (1) `ui.js renderRoster()`에서 `fighter.hunting?.isMob` 필터 추가. (2) `BattleBall`에 `this.hunting = spec.hunting` 저장. (3) `BattleBall._drawMobHpBar()` 신규 — 몹 볼 위에 컬러 구간 HP바 렌더링 (초록>노랑>빨강).
- 영향: `src/ui.js:469`(필터), `src/entities/battleBall.js:48,317-322,347-361`(hunting prop, HP바)
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-05 — 장비 시스템 MVP (상자 보상 교체 + 인벤토리 + 스탯 적용)
- 맥락: 상자가 INSTANT_HEAL/TEMP_STAT 일시적 효과를 주고 있었으나, docs/equipment-system.md 설계대로 장비를 주도록 변경. deferredEffects 체계 정리.
- 결정: (1) INSTANT_HEAL/TEMP_STAT 제거 — `HUNTING_CHEST_REWARD_TYPES`에서 삭제, 보상 테이블에서 항목 제거, `_consumeDeferredEffects()`, `_pendingHeal`, `deferredEffects` 필드 전면 제거. (2) `src/hunting/equipmentConfig.js` 생성 — 슬롯/등급별 스탯 범위, 특수 옵션 풀, 장비 이름 풀, `createEquipmentInstance()`, `applyEquipmentStats()`, `getEquippedStatBonuses()`. (3) 프로필 `equipment.inventory/equipped/enhancementStones/maxInventorySlots` 추가 + sanitize. (4) 상자 보상 테이블에 EQUIPMENT 타입 추가 — SHARDS와 장비 2지선다. (5) `openHuntingChest()` → 장비 인스턴스 생성 → 인벤토리 추가 → 팝업에 장비 정보 표시. (6) `applyEquipmentStats()`를 `huntingManager._startFloorBattle()`에 적용. (7) 컬렉션 허브 장비 탭 추가 — 슬롯 현황 + 인벤토리 목록 + 장착/해제 버튼. (8) equip/unequip 브릿지 메서드 추가.
- 영향: `src/hunting/equipmentConfig.js`(신규), `src/hunting/huntingConfig.js`, `src/hunting/huntingRewards.js`, `src/hunting/chestRewards.js`, `src/hunting/huntingManager.js`, `src/playerProfile.js`, `src/collectionHubService.js`, `src/componentBridge.js`, `src/components/collection-hub.html`, `src/collection/collectionViewModel.js`, `tests/regression.mjs`
- 검증: `npm test`, `npm run format` 통과

## [L1] 2026-07-05 — 파편 리네임 + 상자 개봉 UI + deferredEffects 적용
- 맥락: "해조각" 명칭을 "파편"으로 변경. 상자 개봉/보상 시스템 미완성 상태를 완료.
- 결정: (1) `keyShards`→`shards`, `KEY_SHARDS`→`SHARDS`, `rollKeyShardReward`→`rollShardReward`, 상수명 전체 리네임, UI 텍스트 "해조각"→"파편". (2) `profile.hunting.deferredEffects` 배열 추가 — INSTANT_HEAL/TEMP_STAT 보상을 프로필에 저장. (3) `huntingManager._consumeDeferredEffects()` 사냥터 런 시작 시 deferredEffects 소비 (HP 회복, 임시 스탯 버프). (4) `collectionHubService.openChest()` 보관함 개봉 로직 연결. (5) collection-hub storage 탭 상자 카드에 `@click` + `openChest(item)` 핸들러. (6) 개봉 결과 PopupService 팝업 표시. (7) epic/legendary CSS + 필터 옵션 추가.
- 영향: `src/components/collection-hub.html`, `src/collectionHubService.js`, `src/componentBridge.js`, `src/hunting/chestRewards.js`, `src/hunting/huntingConfig.js`, `src/hunting/huntingManager.js`, `src/hunting/huntingRewards.js`, `src/hunting/huntingState.js`, `src/playerProfile.js`, `src/collection/collectionViewModel.js`, `tests/regression.mjs`
- 검증: `npm test`, `npm run format` 통과

## [L1] 2026-07-05 — 몹 랜덤 외형 시스템 (다각형 몸 + 다양한 표정)
- 맥락: 사냥터 몹이 모두 동그란 원형 + 기본 표정이라 단조로움. 랜덤 외형으로 다양화 요청.
- 결정: (1) `src/entities/mobAppearance.js` 신규 — BODY_SHAPES(0/3/4/5/6/8각형), FACE_TEMPLATES 8종(default/angry/xeye/ooo/dash/skele/cyclops/happy), `generateMobAppearance(rng)` 내보냄. (2) `BattleBall.appearance`에 `{sides, face}` 저장. (3) `draw()`에서 `sides>0`이면 `_drawPolygonBody()`로 n각형 렌더링(짝수는 상단 평면 정렬). (4) `drawFace()`에서 ability fallback 후 `_drawAppearanceFace()` 호출. (5) `createHuntingMobSpec()`에서 `appearance: generateMobAppearance(rng)` 추가.
- 영향: `src/entities/mobAppearance.js`(신규), `src/entities/battleBall.js`, `src/entities/index.js`, `src/hunting/huntingMonsters.js`
- 검증: `npm test`, `npm run format:check` 통과

## 진행 중 이슈 (2026-07-05 갱신)
- **player-panel 버튼 무반응**: `$store._actions` 콜백은 논리적으로 정상 (`UIController._exposeActionsToPlayerPanel`가 `this.state?.adjustStat()`를 바인딩). 원인이 `$watch` 의존성 추적 문제일 가능성이 높아, `state` + watcher 패턴을 폐기하고 템플릿이 직접 `$store.playerPanel.xxx`를 읽도록 전환할 계획. `$store`는 Alpine magic으로 의존성 추적이 정확함.
- **사냥터 deferred effect UI 연결**: instant_heal/temporary_stat 보상은 payload까지만 반환, 실제 런 연결은 미구현

## 다음 할 일 (2026-07-05 갱신)
1. **player-panel 버튼 수정**: `state` + `$watch` → `$store.playerPanel.*` 직접 템플릿 참조로 전환 (watcher 의존성 추적 우회)
2. 전체 N×N PPO 학습 결과 저장 구조 설계
3. 사냥터 deferred effect 적용 UI/런 시작 연결
4. Time Warp 패널티 인상분 재학습 및 Dash +27% 강세 밸런스 검토

## [L1] 2026-07-05 — player-panel 스탯 버튼 브라우저 검증 및 회귀 테스트 고정
- 맥락: 이전 핸드오프에서 player-panel 스탯 버튼이 실제 브라우저에서 무반응이라고 기록되어 있었고, `$store.playerPanel._actions` 연결 경로가 의심 대상이었다.
- 결정: 로컬 브라우저에서 `http://127.0.0.1:4173/`를 열어 첫 체력 `+` 버튼 클릭을 검증했다. 클릭 후 체력 배분이 `0% → 1%`, 남은 포인트가 `100 → 99`로 갱신되어 현재 구현은 정상 동작함을 확인했다. 재발 방지를 위해 `renderPlayerSetup()` 회귀 테스트에 `playerPanel` store `_actions.adjustStat()`가 appStore allocation과 store allocation/remainingPoints를 함께 동기화하는 검증을 추가했다.
- 영향: `tests/regression.mjs`

## [L2] 2026-07-05 — UI 컴포넌트 store 복사층 제거 + 액션 패턴 통일
- 배경: UI 컴포넌트화 과정에서 단순 표시 컴포넌트도 `$watch("$store...")`로 store를 로컬 `Alpine.reactive()` state에 복사하고 있어 불필요한 중간 상태가 늘어났다. 또한 버튼 액션이 `$dispatch`, `window.ballFightApp`, `$store._actions`로 섞여 있어 다음 컴포넌트 작업의 기준이 흐려졌다.
- 결정: 중첩 컴포넌트 로더는 사용자가 의도적으로 제외한 단순 로딩 구조를 유지한다. 대신 start-button/hunting-button/battle-log/fighter-strip/game-overlay/tournament-bracket/player-panel은 가능한 범위에서 `$store` 직접 참조로 전환하고, 사용자 액션은 store `_actions` 콜백으로 통일한다. `UIController`에는 `getAlpineStore`/`patchAlpineStore`/`setAlpineStore` 헬퍼를 추가해 반복 store 접근을 줄인다.
- 영향: `src/components/*.html` 일부, `src/ui.js`, `src/app.js`, `index.html`, `tests/regression.mjs`
- 검증: `npm test`, `npm run check`, `npm run format:check`, 브라우저에서 스탯 버튼/자동 배분/시작 버튼 흐름 확인

## [L1] 2026-07-05 — 태그 컴포넌트 정의는 빈 스코프라도 유지
- 맥락: store 직접 참조로 단순화하는 과정에서 일부 태그 컴포넌트의 루트 `x-data`와 `<script> Alpine.data(...)` 등록까지 제거되어, 파일 구조상 컴포넌트 정의가 사라진 것처럼 보이는 문제가 있었다.
- 결정: start-button/hunting-button/battle-log/fighter-strip/game-overlay/player-panel/tournament-bracket는 `$store` 직접 참조를 유지하되, 루트 `x-data="<componentName>"`와 `<script> Alpine.data("<componentName>", () => ({})) </script>`를 반드시 둔다. 로컬 state 복사와 watcher는 필요한 컴포넌트에만 사용한다.
- 영향: `src/components/start-button.html`, `src/components/hunting-button.html`, `src/components/battle-log.html`, `src/components/fighter-strip.html`, `src/components/game-overlay.html`, `src/components/player-panel.html`, `src/components/tournament-bracket.html`, `docs/alpine-component-system.md`

## [L1] 2026-07-05 — UI 핸들러는 컴포넌트에, 게임 로직은 app/game에 둔다
- 맥락: `_actions`를 Alpine store에 주입하는 방식은 store가 데이터 브릿지가 아니라 콜백 레지스트리가 되어 책임 경계가 흐려졌다. 사용자는 UI 관련 로직은 컴포넌트가 갖고, 게임 관련 로직은 게임/app 쪽 공개 핸들러에 남는 구조를 요청했다.
- 결정: start-button/hunting-button/game-overlay/player-panel의 `@click`은 컴포넌트 `Alpine.data()` 메서드를 호출한다. 컴포넌트 메서드는 `window.BallFightComponentBridge`를 통해 `appStore()` 또는 `BattleApp`/`HuntingManager` 공개 메서드를 호출한다. `Alpine.store()`의 `_actions` 초기값과 `BattleApp._exposeComponentActions()`, `UIController._exposeActionsToPlayerPanel()`는 제거한다.
- 영향: `src/componentBridge.js`, `src/components/start-button.html`, `src/components/hunting-button.html`, `src/components/game-overlay.html`, `src/components/player-panel.html`, `index.html`, `src/app.js`, `src/ui.js`, `tests/regression.mjs`, `docs/alpine-component-system.md`, `docs/development-rules.md`

## [L1] 2026-07-05 — 장비 시스템: 상자 보상을 장비로 교체 (INSTANT_HEAL/TEMP_STAT 제거)
- 맥락: 상자가 INSTANT_HEAL/TEMP_STAT 같은 일시적 효과 대신 docs/equipment-system.md 설계대로 장비를 주도록 변경.
- 결정: (1) `HUNTING_CHEST_REWARD_TYPES`에서 INSTANT_HEAL/TEMP_STAT 삭제, deferredEffects 체계 전면 제거(`_consumeDeferredEffects()`, `_pendingHeal`, `deferredEffects` 필드). (2) `src/hunting/equipmentData.js` — 순수 계층형 설정 데이터(EQUIPMENT.SLOTS.WEAPON 형태). (3) `src/hunting/equipmentConfig.js` — create/apply/disassemble/expandInventory. (4) 프로필 `equipment.inventory/equipped/enhancementStones/maxInventorySlots`. (5) 상자 보상 SHARDS+EQUIPMENT 2지선다, 용량 초과 시 `inventory_full` 차단. (6) 컬렉션 허브 장비 탭(슬롯/인벤토리/장착/해제/분해/확장). (7) `componentBridge.js`에 expandInventory/disassembleItem 추가.
- 영향: `src/hunting/equipmentData.js`(신규), `src/hunting/equipmentConfig.js`(신규), `src/hunting/chestRewards.js`, `src/hunting/huntingRewards.js`, `src/hunting/huntingManager.js`, `src/playerProfile.js`, `src/collectionHubService.js`, `src/componentBridge.js`, `src/components/collection-hub.html`, `src/collection/collectionViewModel.js`, `tests/regression.mjs`
- 검증: `npm test`, `npm run format` 통과. `node scripts/huntingUserScenario.mjs` 100런 인벤토리 초과 없이 정상 동작.

## [L1] 2026-07-05 — 사냥 시뮬레이션 스크립트 (huntingSim + huntingUserScenario)
- 맥락: 장비 드롭 분포와 인벤토리 관리 시나리오를 시뮬레이션으로 검증 필요. 추측만으로 코드 수정 금지 규칙에 따라 먼저 시뮬레이션.
- 결정: (1) `scripts/huntingSim.mjs` — 장비 드롭/스탯 분포 시뮬레이터. OVERRIDES 블록으로 rarity 비율/스탯 범위 조절 가능. (2) `scripts/huntingUserScenario.mjs` — 실제 유저 시나리오: 100런 반복, 파편 순환, 인벤토리 관리(확장/분해), 장비 스탯 성장 추적. 10런 단위 리포트.
- 영향: `scripts/huntingSim.mjs`(신규), `scripts/huntingUserScenario.mjs`(신규)
- 검증: 시뮬레이션에서 인벤토리 초과 자동 탐지 → expandInventory/disassembleEquipment 추가 → 정상 순환 확인 (인벤토리 40/41, 확장 12회, 파편 1787 잔여)

## [L2] 2026-07-05 — 컬렉션 허브 글자색 버그 수정
- 배경: `body` 기본 글자색 `--text: #f4f7fb`(거의 흰색)이 `.ch-frame`(배경 `#ffffff`)에 상속되어 흰 바탕에 흰 글자가 되어 안 보임.
- 결정: `.ch-frame`에 `color: #202020` 추가. 중복으로 지정된 `color: #202020` 10개 요소에서 제거 (이제 상속받음).
- 영향: `src/components/collection-hub.html`

## 진행 중 이슈 (2026-07-05 갱신)
- 장비 시스템 MVP 완료. 강화(Enhancement) 시스템 미구현.
- 인벤토리 자동 관리: 확장(파편 100→+3칸, 최대 100), 분해(등급별 강화석).
- 사냥 deferred effects 완전 제거됨 (장비 시스템으로 대체).

## [L1] 2026-07-05 — 장비 강화 시스템 구현
- 맥락: docs/equipment-system.md 설계에 따른 강화 시스템 MVP 구현. 장비 스탯 % 증가, 실패 확률, 분해 시 강화 단계 비례 보상.
- 결정: (1) `equipmentData.js` — ENHANCE 상수 추가(MAX_LEVEL=5, MAX_FAILURE_RATE=0.8, STAT_BONUS_PER_LEVEL=0.2, COST 테이블). (2) `equipmentConfig.js` — `calculateEnhanceCost()`, `calculateEnhanceFailureRate()`, `enhanceEquipment()` (성공 시 +1레벨, 실패 시 -1레벨(0下限)). 분해 시 `enhanceLevel` 비례 추가 보상(+50%/레벨). `getEquippedStatBonuses()`에 강화 배율 반영. (3) `instanceId` 중복 버그 수정 — `_eqCounter` 추가. (4) `componentBridge.js` — `enhanceItem()` 동적 import. (5) `collectionViewModel.js` — 각 장비에 `canEnhance`, `enhanceCost`, `enhanceFailureRate` 추가. (6) `collection-hub.html` — 카드 헤더에 `+N` 강화 레벨 배지, 액션에 강화 버튼(실패율 표시). (7) `src/hunting/index.js` — `equipmentConfig.js` re-export 추가.
- 영향: `src/hunting/equipmentData.js`, `src/hunting/equipmentConfig.js`, `src/hunting/index.js`, `src/componentBridge.js`, `src/collection/collectionViewModel.js`, `src/components/collection-hub.html`, `tests/regression.mjs`
- 검증: `npm test` 4/4 ok, `npm run format` 통과. 회귀 테스트에서 강화 성공/실패/0下限/최대레벨차단/재료부족/스탯반영/없는장비 케이스 모두 검증.

## 진행 중 이슈 (2026-07-05 갱신)
- 장비 시스템 MVP + 강화 완료. 합성 승급/판매/레벨 제한/외형 draw는 미구현.
- `createEquipmentInstance` instanceId 중복 방지용 `_eqCounter` 도입 (모듈 수준 카운터).

## 다음 할 일 (2026-07-05 갱신)
1. **장비 합성 승급 시스템**: 같은 등급 장비 2개 + 추가 재료 → 한 단계 높은 등급 장비 1개. 캐릭터 레벨 제한 적용.
2. 장비 판매 (파편 환급)
3. 전체 N×N PPO 학습 결과 저장 구조 설계
4. Time Warp 패널티 인상분 재학습 및 Dash +27% 강세 밸런스 검토

## [L1] 2026-07-05 — 장비 합성/판매 및 토너먼트 적용 검증
- 맥락: 사용자가 장비 시스템 구현과 테스트 구성을 이어서 완료/검증하라고 요청. 기존 구현은 강화/분해/확장까지 있었고, 문서상 중복 장비 처리(합성/판매)와 토너먼트 장비 스탯 적용이 비어 있었음.
- 결정: 같은 등급 장비 2개 + 강화석/파편 비용으로 다음 등급 랜덤 장비 1개를 만드는 합성 승급, 등급별 파편 환급 판매를 추가. 장비 스탯은 사냥터뿐 아니라 토너먼트 시작 시 플레이어 스펙에도 적용. 컬렉션 허브 장비 카드에 합성/판매 버튼과 비용/보상 정보를 노출.
- 영향: `src/hunting/equipmentData.js`, `src/hunting/equipmentConfig.js`, `src/collection/collectionViewModel.js`, `src/components/collection-hub.html`, `src/componentBridge.js`, `src/app.js`, `tests/regression.mjs`, `scripts/huntingUserScenario.mjs`, `docs/equipment-system.md`
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과. 회귀 테스트에서 강화/합성/판매/토너먼트 장비 스탯 적용을 검증.

## 진행 중 이슈 (2026-07-05 갱신)
- 장비 시스템 MVP + 강화 + 합성/판매 완료. 캐릭터 레벨 제한과 장비 외형 draw는 미구현.
- 합성 MVP 수치: common→uncommon 강화석2/파편20, uncommon→rare 강화석5/파편40, rare→epic 강화석12/파편80, epic→legendary 강화석25/파편150.

## [L1] 2026-07-05 — 장비 외형 draw 구현
- 맥락: 사용자가 장비 draw 구현을 요청. 기존 장비 시스템은 스탯/인벤토리/강화/합성/판매까지 있었지만 전투 캔버스에서 장착 장비가 보이지 않았음.
- 결정: 프로필에는 함수 대신 순수 데이터 `draw` 키(`weapon`/`armor`/`accessory`)만 저장하고, 런타임에서 `src/entities/equipmentVisuals.js`가 슬롯/등급별 draw 함수를 해석한다. `applyEquipmentStats()`는 장착 장비 목록을 `equipment.equippedItems`로 전투 스펙에 전달하고, `BattleBall.draw()`는 몸체 렌더링 후 무기/방어구/장신구 오버레이를 그린다.
- 영향: `src/hunting/equipmentData.js`, `src/hunting/equipmentConfig.js`, `src/entities/equipmentVisuals.js`, `src/entities/battleBall.js`, `src/components/collection-hub.html`, `src/componentLoader.js`, `index.html`, `src/patchNotes.js`, `tests/regression.mjs`, `docs/equipment-system.md`
- 검증: `npm test`, `npm run check`, `npm run format:check` 통과. 로컬 브라우저 새 로드에서 `v0.24.2` 패치노트 노출, 로딩 제거, 컬렉션 허브 마운트, 새 로드 이후 콘솔 에러 없음 확인.

## [L1] 2026-07-05 — 장비 캐릭터 레벨 제한 적용
- 맥락: 장비 시스템의 다음 미구현 항목이 캐릭터 레벨 제한이었고, 문서상 Rare/Epic/Legendary 장비는 캐릭터별 XP 레벨 요구 조건을 만족해야 장착 가능해야 했다. 구현 전 시뮬레이션에서 Lv.1 캐릭터도 Rare 장비 스탯을 받는 결함을 확인했다.
- 결정: 등급별 요구 레벨(Common 1, Uncommon 3, Rare 5, Epic 8, Legendary 10)을 `equipmentData`에 추가하고, `equipmentConfig`에 요구 레벨/캐릭터 레벨/장착 가능 판정 함수를 모았다. `applyEquipmentStats()`와 `getEquippedItems()`는 `spec.id`의 캐릭터 레벨을 기준으로 잠긴 장비를 스탯/외형에서 제외한다. 컬렉션 허브 장비 카드는 요구 레벨과 잠김 상태를 보여주며, 실제 장착 액션도 같은 판정으로 차단한다. 토너먼트 시작 시 장비 외형 목록도 전투 스펙에 복사하도록 보강했다.
- 영향: `src/hunting/equipmentData.js`, `src/hunting/equipmentConfig.js`, `src/componentBridge.js`, `src/collection/collectionViewModel.js`, `src/components/collection-hub.html`, `src/app.js`, `src/patchNotes.js`, `index.html`, `tests/regression.mjs`, `docs/equipment-system.md`
- 검증: 구현 전 `scripts/equipmentLevelLimitProbe.mjs`로 Lv.1 Rare 장비 스탯이 적용되는 결함 확인 → 구현 후 Lv.1 damage 10 / Lv.5 damage 18로 수정 확인 후 임시 스크립트 제거. `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과.

## 진행 중 이슈 (2026-07-05 갱신)
- 장비 시스템 MVP + 강화 + 합성/판매 + 슬롯별 외형 draw + 캐릭터 레벨 제한 + 시작 전 장비 UI 연결 완료. 아이템별 고유 외형 세분화는 추후 결정.

## [L1] 2026-07-05 — 시작 전 장비 화면 UI 연결
- 맥락: 사용자가 장비 화면 UI 진행을 요청. 컬렉션 허브 장비 탭은 이미 실제 관리 UI를 제공하므로, 토너먼트/사냥터 입장 직전 중복 UI를 새로 만들기보다 시작 패널에서 현재 장비 상태를 확인하고 장비 탭으로 바로 진입하는 흐름이 적합했음.
- 결정: player-panel에 장비 요약 블록을 추가해 현재 캐릭터 레벨, 인벤토리 사용량, 슬롯별 장착/잠김 상태, 적용 중인 장비 스탯을 표시한다. “장비 화면” 버튼은 `BallFightComponentBridge.openCollectionHub("equipment")`를 통해 컬렉션 허브 장비 탭을 연다. `UIController.renderPlayerSetup()`과 Alpine store 초기값, 테스트 하네스를 모두 같은 `equipmentSummary` 구조로 맞춘다.
- 영향: `src/app.js`, `src/ui.js`, `src/components/player-panel.html`, `index.html`, `src/patchNotes.js`, `tests/regression.mjs`, `docs/equipment-system.md`


## [L1] 2026-07-06 — 모든 BattleBall 기본 회전 + rotationEnabled 플래그 추가
- 맥락: 기존에는 다각형 몹(사냥터)만 회전하고 원형 캐릭터는 angle=0/angularVelocity=0으로 고정되어 회전 물리가 전혀 작동하지 않음. 회전 face/equipment도 미적용.
- 결정: (1) BattleBall 생성자에서 모든 볼에 angle/angularVelocity를 초기화 (원형도 무작위 각도와 각속도). spec.rotationEnabled !== false로 플래그 추가, false면 angle/angularVelocity=0. (2) update()에서 rotationEnabled일 때만 integrateRotation 호출, 비활성 시 clearAngularForces()로 accumulator 정리. (3) faceRotation: polygon은 기존대로 this.angle, circle은 rotationEnabled ? this.angle + wallSlamSpin : wallSlamSpin. (4) 장비 회전: circle + rotationEnabled 시 save → translate(center) → rotate(angle) 컨텍스트에서 drawEquipmentItems 호출. (5) 이름표·HP바·movement ring은 회전하지 않음. (6) wallSlam spinRotation은 rotationEnabled와 관계없이 시각 회전 유지.
- 영향: src/entities/battleBall.js, tests/regression.mjs, docs/development-rules.md, docs/hunting-grounds-system.md, SESSION-HANDOFF.md
- 검증: npm test, npm run format:check, npm run check, node scripts/huntingUserScenario.mjs 통과
- 미검증: 브라우저에서 원형 캐릭터 face/equipment 회전 육안 확인

## [L1] 2026-07-06 — 정적/동적 충돌 angular impulse 통합 리팩터링
- 맥락: 기존 `staticCollisionResponse.js`의 `applyStaticAngularImpulse`는 벽/terrain 전용, `battleSimulation.js`의 `_applyAngularCollisionResponse`는 fighter-fighter 전용으로, 동일한 torque 공식(`r × normal * impulseMag * angularFactor`)이 중복되었다. 또한 duck typing으로 `applyAngularImpulse` 유무를 감지하는 원칙이 지켜지지 않았다.
- 결정: (1) `src/physics/collisionResponse.js` 신설 — `applyCollisionAngularImpulse(body, normal, contactPoint, impulseMag, angularFactor, tangentialSpeed, tangentialFriction)` 저수준 helper. `applyCollisionResponse(body, normal, contactPoint, preCollisionVelocity, options)` 단일-body 충돌. `applyDynamicCollisionResponse(bodyA, bodyB, normal, contactPoint, approachSpeed, options)` 동적-동적 충돌. 모든 body는 duck typing(applyImpulse/applyAngularImpulse 존재 여부)으로 능력 감지. (2) `staticCollisionResponse.js` 삭제 — 모든 호출을 collisionResponse.js로 대체. (3) `simulation.js` _reflectX/_reflectY: `_applyWallAngularImpulse` 공통 메서드로 정리. (4) `terrainCollision.js` resolveCircleTerrainCollision, `CollisionShape.js` resolvePolygonTerrainCollision: inlined impulseMag 계산 → `applyCollisionAngularImpulse` 호출. (5) `battleSimulation.js` _applyAngularCollisionResponse: 자체 torque 계산 → `applyCollisionAngularImpulse` 2회 호출로 대체. (6) 테스트 6종 추가: duck typing 감지, 선형 impulse, 동적 페어, no-potential, no-angular body. (7) `docs/development-rules.md` 충돌 물리 섹션에 collisionResponse 모듈 원칙 명시.
- 영향: `src/physics/collisionResponse.js`(신규), `src/physics/staticCollisionResponse.js`(삭제), `src/physics/index.js`, `src/simulation/simulation.js`, `src/terrain/terrainCollision.js`, `src/physics/CollisionShape.js`, `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `docs/development-rules.md`, `SESSION-HANDOFF.md`
- 검증: `npm test` (20개 스위트), `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과

## [L2] 2026-07-09 — regression.mjs 정합성 버그 수정 (Alpine store 오염 + mock 누락)
- 배경: Phase 6(gameBridge 전환) 후 `testMatchEndGrantsImmediateExperience`가 overlay subtext/XPReward/로그 검증에서 실패. 또한 `loadModuleAppWithInitialAlpineAllocation`이 `Object.assign(globalThis, harness.context)`로 global Alpine store를 오염시켜 후속 테스트가 엉뚱한 mock을 읽는 버그가 있었음.
- 결정:
  1. `loadModuleAppWithInitialAlpineAllocation`에서 `Object.assign(globalThis, ...)` 전후로 `globalThis.Alpine`/`globalThis.gameBridge` save-restore 추가
  2. `gameOverlay` mock의 `show()`가 실제 component처럼 `xpRewardPanel.animate(xpReward)`를 호출하도록 수정
  3. `xpRewardPanel` mock에 `animate()` 메서드 추가 (실제 component 구현과 동일)
  4. `battleLog` mock의 `add()`가 `items`에 push하도록 수정 (빈 함수여서 로그 테스트 항상 실패)
  5. `loadModuleApp()` 내 중복 `uiManager.register("xpRewardPanel", ...)` 제거
- 영향: `tests/regression.mjs` — mock 객체 5종 수정, Alpine store save-restore 추가
- 검증: `npm test` (57개 스위트 전부 통과), `npm run format:check` 통과

## [L2] 2026-07-09 — 런타임 컴포넌트 미등록 버그 수정 (collection-hub, xp-reward-panel, xp-progress-bar)
- 배경: Phase 6(gameBridge 전환) 후 브라우저 콘솔에 `[gameBridge] 'collectionHub'/'xpRewardPanel' 컴포넌트를 찾을 수 없습니다` 경고 발생.
  1. collection-hub.html이 `Alpine.data()`를 직접 사용 — createGameUI로 감싸지 않아 uiManager 미등록
  2. loadTemplates()가 document.body.innerHTML만 스캔 — xp-reward-panel/xp-progress-bar는 다른 템플릿 내부에만 있어 로딩되지 않음
  3. xp-progress-bar가 제거된 `$store.xpReward`를 참조
- 결정:
  1. collection-hub.html: `Alpine.data` → `createGameUI`
  2. componentLoader.js: loadTemplates()가 로드된 `<template>` 내용도 재귀 스캔하도록 개선
  3. xp-progress-bar.html: `Alpine.data` → `createGameUI`, `$store.xpReward` → gameBridge.get()
- 영향: src/componentLoader.js, src/components/collection-hub.html, src/components/xp-progress-bar.html
- 검증: npm test (57개 스위트 전부 통과), npm run format:check 통과

## [L1] 2026-07-09 — 스탯 배분 후 시작 버튼 미표시 버그 수정
- 맥락: Phase 6(gameBridge 전환) 후 `adjustStat()`, `randomAllocation()`, `resetAllocation()`이 `_panel` 할당만 갱신하고 `_startBtn.setState()`를 호출하지 않음. 이전 UIController는 Alpine store 구독으로 버튼이 자동 갱신됐으나 새 아키텍처에서는 `disabledOverride`/`textOverride`가 `refreshPlayerSetup()` 초기값에 고정되어 버튼 상태가 영원히 변하지 않음.
- 결정:
  1. `_syncStartButton()` 헬퍼 메서드 추가 — `panel.remainingPoints`를 읽어 `_startBtn.setState({ disabled, text })` 호출
  2. `adjustStat()`, `randomAllocation()`, `resetAllocation()` 끝에 `_syncStartButton()` 추가
  3. `refreshPlayerSetup()` 내 중복된 `_startBtn.setState()` 로직을 `_syncStartButton()` 호출로 대체
- 영향: `src/app.js` — `_syncStartButton()` 신규, stat 3개 mutation 메서드에 추가, refreshPlayerSetup() 내 중복 제거
- 검증: `npm test` (57개 스위트 전부 통과), `npm run format:check` 통과

## [L1] 2026-07-10 — 스탯 배분 동기화 누락 버그 수정 (UI 배분값이 전투에 미반영)
- 맥락: `adjustStat()`, `randomAllocation()`, `resetAllocation()`이 `this._panel.allocation`만 갱신하고 `this.playerStatAllocation`을 갱신하지 않아, 토너먼트 시작 시 UI에 표시된 배분값과 실제 전투 스펙이 달랐음. `startTournament()`에서 `alloc`을 다시 읽을 때까지 불일치가 지속됨.
- 결정: 세 메서드 마지막에 `this._syncPlayerStatAllocationFromUi()` 호출 추가 — 기존 헬퍼가 `panel.allocation`을 `playerStatAllocation`에 즉시 병합. 신규 회귀 테스트 `testAdjustRandomResetSyncPlayerStatAllocation`으로 세 경로 모두 검증.
- 영향: `src/app.js`(세 메서드에 `this._syncPlayerStatAllocationFromUi()` 추가), `tests/regression.mjs`(신규 테스트 + runner 등록), `SESSION-HANDOFF.md`
- 검증: `npm test` (신규 테스트 통과, 기존 57개 스위트 유지), `npm run check`, `npm run format:check` 통과. 브라우저에서 자동 배분 후 `playerStatAllocation` 즉시 갱신 확인.

## 진행 중 이슈
- 없음 (58개 스위트 전부 통과, 브라우저 콘솔 gameBridge 경고 3종 해결 완료)

## [L1] 2026-07-12 — Alpine 템플릿 표현식 window.uiManager → $store.uiManager 전환
- 맥락: `xp-progress-bar.html`의 `x-bind:style` 표현식이 `window.uiManager?.getComponent(...)`을 사용해 Alpine의 반응형 의존성 추적을 우회함. 동일 템플릿에서 `$store.uiManager.getComponent(...)`는 Alpine magic으로 반응형 의존성을 자동 추적하여 Store 변경 시 바인딩이 다시 평가됨.
- 결정:
  (1) `xp-progress-bar.html`의 `x-bind:style` 표현식을 `$store.uiManager.getComponent('xpRewardPanel')?.animatedProgressPct ?? 0`로 교체 — `$store` magic은 Alpine의 반응형 Proxy를 통해 읽어 Store 변경 시 바인딩 재평가 트리거.
  (2) `src/components/*.html` 전수 감사 — `window.uiManager`가 Alpine directive 라인(`x-bind:`, `x-data`, `x-on`, `x-show` 등)에 있는지 확인. `game-overlay.html`의 3개 `window.uiManager`는 `<script>` 내부 컴포넌트 메서드로, Alpine 템플릿 표현식이 아니므로 보존(요구사항 #4).
  (3) 회귀 테스트 2종 신설: `[alpine-no-window-uimanager]` — 모든 컴포넌트 HTML의 Alpine directive 라인에 `window.uiManager`가 없음을 증명. `[xp-progress-store-uimanager]` — `xp-progress-bar.html`의 `x-bind:style`이 `$store.uiManager`를 사용함을 단언.
- 영향: `src/components/xp-progress-bar.html`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (신규 2종 포함 60개 스위트 통과), `npm run check`(126파일), `npm run format:check`, `node scripts/huntingUserScenario.mjs`, `git diff --check`, `rg "window\\.uiManager" src/components/ -g "*.html"` 결과 3개 모두 `<script>` 내부 (game-overlay.html).

## 진행 중 이슈
