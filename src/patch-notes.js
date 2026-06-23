// ── Patch notes data ────────────────────────────────────────────────────────
//
// 패치노트 작성 규칙은 docs/patch-notes-guide.md 를 참고하세요.
//   - version 증가 / date 갱신 / changes 배열 추가
//   - type: feature | refactor | fix | style (새 type 추가시 CSS도 필요)
//   - 한국어, 유저 시점, 간결하게
//
// 유틸 함수(getUnseenEntries, dismissPatchNotes 등)는 src/utils.js 에 있습니다.
// 이전 버전중 PATCH_NOTES 배열에 남길 필요가 없는 항목은
// docs/patch-notes-archive.md 에 보관합니다.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ version:string, date:string, title:string, changes:Array<{type:string,text:string}> }} PatchEntry
 *
 * 누적 패치노트 목록. **맨 앞이 최신 버전**입니다.
 * 유저가 마지막으로 확인한 버전 이후의 항목만 팝업에 표시됩니다.
 * @type {PatchEntry[]}
 */
export const PATCH_NOTES = [
    {
        version: "0.9.0",
        date: "2026-06-23",
        title: "v0.9.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "카운터/투사체 방어 리워크 — 이제 무조건 발동 후 판정 window 방식. 카운터는 0.20초 안에 상대 충돌 피해를 반사하고, 투사체 방어는 0.3초 안에 투사체 75% 경감 및 성공 시 비용 회수."
            },
            {
                type: "feature",
                text: "액션 실패 시 피드백 텍스트 추가 — 조건 불충족 시 빨간색 문구가 표시됩니다."
            },
            {
                type: "refactor",
                text: "BattleBall 클릭 액션 시스템 리팩토링 — ActionContext 단일 ref로 통합, 모든 액션 변수/로직 분리."
            },
            {
                type: "refactor",
                text: "DashEffect/WallSlamEffect 런타임 이펙트 분리 — 대시/벽 충돌 로직이 독립 클래스로 통합되었습니다."
            },
            {
                type: "refactor",
                text: "투사체 방어 재설계 — 투사체 사전 탐색 제거, CombatEntity 경감 로직 제거, ActionContext timed effect로 대체."
            },
            {
                type: "refactor",
                text: "액션 description/cost를 모듈 상수 기반 템플릿으로 변경 — 정합성 자동 유지."
            },
            {
                type: "refactor",
                text: "코드베이스 안티패턴 11건 개선 — Template Method, 메서드 분리, 중복 제거, 캡슐화 강화."
            },
            {
                type: "refactor",
                text: "PopupService closeOnOutside 속성 복원 — false 시 바깥 클릭으로 팝업 닫힘 방지."
            },
            {
                type: "fix",
                text: "Dash Ball 충돌/벽 꽂힘 버그 수정 — 대시 종료 시 forcedHeading 미제거로 속도가 덮어써지던 문제."
            },
            {
                type: "fix",
                text: "Trickster 씨앗 본인도 먹을 수 있도록 수정 — 모든 파이터 검사, 대시 방향은 항상 상대방."
            },
            {
                type: "fix",
                text: "Orbit Ball 프리뷰 화면 shard 지글거림 수정 — 매 프레임 BattleBall 재생성 제거."
            },
            {
                type: "fix",
                text: "액션 선택 중복 요청 방지 — waitForActionPick 가드 추가."
            },
            {
                type: "fix",
                text: "UI 텍스트 커서 숨김 — .app에 user-select:none 적용."
            },
            {
                type: "style",
                text: "액션 효과값 0.05(5%) 단위, HP 코스트 0.5%p 단위로 정렬."
            },
            {
                type: "style",
                text: "시간 왜곡 슬로우 강화 — 상대 속도 45%→35%."
            }
        ]
    },
    {
        version: "0.8.0",
        date: "2026-06-22",
        title: "v0.8.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "클릭 액션 시스템 추가 — 매치 시작 시 5개 액션 중 3개를 뽑아 1개 선택. 캔버스 클릭으로 발동, HP 소모."
            },
            {
                type: "feature",
                text: "액션: 시간 왜곡 — HP 50% 이하에서 0.25초간 상대만 슬로우"
            },
            {
                type: "feature",
                text: "액션: 돌진 — 1초간 속도 +50%"
            },
            {
                type: "feature",
                text: "액션: 카운터 — 0.20초 안에 충돌 시 상대 충돌 피해 반사"
            },
            {
                type: "feature",
                text: "액션: 투사체 방어 — 0.3초 안에 맞는 투사체 데미지 75% 경감, 성공 시 비용 회수"
            },
            {
                type: "feature",
                text: "액션: 버티기 — 0.1초간 모든 데미지 80% 경감"
            },
            {
                type: "feature",
                text: "TriggerStrategy 패턴 — Tap/Release/Hold 세 가지 발동 방식 지원 (현재는 Tap만 사용)"
            }
        ]
    },
    {
        version: "0.7.0",
        date: "2026-06-22",
        title: "v0.7.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "신규 캐릭터 Bat Ball 추가 — 120도 시야 범위가 좌우로 스캔하며 적을 휘둘러 넉백을 줍니다."
            },
            {
                type: "refactor",
                text: "Sword Night → Bat Ball 리브랜딩: 방망이 VFX, 캡 모자 얼굴로 변경"
            },
            {
                type: "style",
                text: "Bat Ball 캡모자 크기 확대 + 눈과 간격 조정"
            },
            {
                type: "style",
                text: "docs/click-actions.md 설계 문서 추가 (클릭 액션 시스템, 미구현)"
            },
            {
                type: "refactor",
                text: "넉백 시스템 재설계 — forceHeading에 overrideVelocity 통합, knockbackState 제거. 벽 충돌 시 넉백 종료."
            },
            {
                type: "refactor",
                text: "applyKnockback이 속도 벡터를 직접 받도록 변경 — 투사체 속도가 넉백에 반영됩니다."
            }
        ]
    },
    {
        version: "0.6.4",
        date: "2026-06-21",
        title: "v0.6.4 업데이트",
        changes: [
            {
                type: "refactor",
                text: "넉백 시스템 개선 — forceHeading+speedBoost 기반 다프레임 지속, applyKnockback 공용 메서드."
            },
            { type: "buff", text: "Orbit 위성 3→5개, 리차지 2초→1초 (쿨타임 스탯으로 추가 단축)." }
        ]
    },
    {
        version: "0.6.3",
        date: "2026-06-21",
        title: "v0.6.3 업데이트",
        changes: [
            {
                type: "feature",
                text: "Orbit Ball 상향 — 위성 3개 충전 시 3연속 원거리 발사 (가속/벽튕김), 쿨타임 스탯이 재충전 속도에 반영."
            },
            {
                type: "refactor",
                text: "OrbitProjectile 엔티티 분리 — 기존 Ability 내부 배열 대신 Arrow/Grenade와 동일한 구조."
            }
        ]
    },
    {
        version: "0.6.2",
        date: "2026-06-21",
        title: "v0.6.2 업데이트",
        changes: [
            {
                type: "feature",
                text: "Grenade Ball 상향 — 수류탄 벽 튕김(최대 2회), 폭발 데미지 20~40, 패시브 회피 추가."
            },
            {
                type: "feature",
                text: "투사체 데미지 baseDamage 연동 — Arrow/Grenade/Shard/Seed 데미지가 공격 스탯에 비례합니다."
            },
            { type: "refactor", text: "evadeTarget 공용 함수 추출 — Archer/Grenade가 회피 로직 공유." }
        ]
    },
    {
        version: "0.6.1",
        date: "2026-06-21",
        title: "v0.6.1 업데이트",
        changes: [
            {
                type: "fix",
                text: "충돌 피해 speedEff 상한 제거 — 빠른 볼이 속도 비례 더 큰 피해를 줍니다. (Rage 5배속 보상)"
            },
            { type: "fix", text: "Eater Ball UI 버그 수정 — 삼킨 후 쿨타임 게이지가 8.5%에 고정되던 문제 수정." },
            { type: "fix", text: "벽꿍 데미지 상향 — 방어력 적용 후 너무 낮아져 8→15로 상승." }
        ]
    },
    {
        version: "0.6.0",
        date: "2026-06-21",
        title: "v0.6.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "방어력(DEF) 스탯 추가 — 받는 피해에서 방어력만큼 차감됩니다. roster에 캐릭터별 기본 방어력 추가."
            },
            { type: "feature", text: "Eater Ball 방어력 재설계 — 피스트 중 방어력 1.5배, 뱉은 후 쿨타임 초기화." },
            { type: "refactor", text: "충돌 피해 계산 체계 정리 — 3단계(충돌 × 능력보정 − 방어력)로 문서화." },
            { type: "style", text: "게임 도움말 업데이트 — 방어력/5스탯, 모든 능력 설명 최신화." }
        ]
    },
    {
        version: "0.5.0",
        date: "2026-06-21",
        title: "v0.5.0 업데이트",
        changes: [
            {
                type: "refactor",
                text: "쿨타임 공식 변경 — 선형(1 - skill/100)에서 체감형(100/(100+skill))으로, 100포인트 시 50% 단축."
            },
            { type: "feature", text: "Rage Ball 상향 — 최고 속도 5배, 쿨타임 스탯이 충전 시간에 반영됩니다." },
            {
                type: "fix",
                text: "Eater Ball 버그 수정 — 피스트 종료 후 쿨타임 즉시 재시작 버그 수정, 뱉은 후 쿨타임 초기화."
            },
            {
                type: "fix",
                text: "Eater Ball 크기 조절 버그 수정 — 삼키면 1.5배로 커지고, 뱉으면 원래 크기로 돌아옵니다."
            }
        ]
    },
    {
        version: "0.4.0",
        date: "2026-06-21",
        title: "v0.4.0 업데이트",
        changes: [
            {
                type: "refactor",
                text: "충돌 피해 공식 개선 — damage가 최대 피해량을 의미하는 정수로 변경, 속도/방향 기반 효율(0~1) 곱셈."
            },
            { type: "feature", text: "스탯 초기화 버튼 추가 — 자동 배분 옆에 초기화 버튼이 생겼습니다." },
            { type: "fix", text: "Dash Ball 너프 — 쿨다운 최대 2단계(75% 감소), 벽 충돌 시 스택 완전 초기화." },
            { type: "refactor", text: "ESM 모듈 로딩 방식으로 변경 — window 전역 패턴 제거." }
        ]
    },
    {
        version: "0.3.1",
        date: "2026-06-21",
        title: "v0.3.1 업데이트",
        changes: [
            { type: "feature", text: "Eater Ball 방어력 조정 — 평균권 기본 방어와 피스트 중 1.5배 보정." },
            { type: "feature", text: "Eater Ball 피스트 중 제한 각도 유도 기능 추가." },
            { type: "feature", text: "쿨타임 스탯 추가 — 스킬 쿨타임을 포인트당 1% 단축합니다." }
        ]
    },
    {
        version: "0.3.0",
        date: "2026-06-21",
        title: "v0.3.0 업데이트",
        changes: [
            { type: "feature", text: "Archer Ball 능력 개선 — 활 당기기 애니메이션, 2연속 빗나감 시 3연속 발사." },
            { type: "feature", text: "Archer Ball 패시브 회피 — 상대가 접근하면 옆으로 자동 회피합니다." },
            { type: "refactor", text: "시뮬레이션 구조 개선 — Simulation/TestSimulation 베이스 클래스 도입." },
            { type: "refactor", text: "패치노트 시스템 개선 — 놓친 버전도 함께 표시됩니다." },
            { type: "style", text: "데미지 숫자 디자인 개선 및 팝업 버튼 하단 고정." }
        ]
    },
    {
        version: "0.2.2",
        date: "2026-06-21",
        title: "v0.2.2 업데이트",
        changes: [
            { type: "fix", text: "팝업 닫힐 때 콘텐츠가 먼저 사라지던 버그를 수정했습니다." },
            { type: "fix", text: "파이터 카드가 좁은 화면에서 레이아웃이 깨지던 문제를 수정했습니다." },
            { type: "style", text: "게임 도움말 아이콘을 스탯 창 상단으로 이동했습니다." }
        ]
    },
    {
        version: "0.2.1",
        date: "2026-06-21",
        title: "v0.2.1 업데이트",
        changes: [
            { type: "feature", text: "게임 시스템 도움말 추가 — 우측 상단 ? 버튼을 눌러 확인하세요." },
            { type: "refactor", text: "팝업 시스템을 Alpine 컴포넌트 기반으로 개선했습니다." },
            { type: "fix", text: "고유 능력 설명을 실제 구현과 일치하도록 수정했습니다." },
            { type: "style", text: "데미지 숫자 디자인을 개선했습니다." }
        ]
    },
    {
        version: "0.2.0",
        date: "2026-06-21",
        title: "v0.2.0 업데이트",
        changes: [
            { type: "feature", text: "실시간 데미지 숫자 표시 — 타격 시 피해량이 캐릭터 위에 떠오릅니다." },
            { type: "feature", text: "스탯 밸런스 배율 시스템 — 스탯을 골고루 분배할수록 더 높은 배율을 받습니다." },
            { type: "refactor", text: "UI 시스템을 Alpine.js 컴포넌트 기반으로 개선했습니다." },
            { type: "fix", text: "스탯 분배 화면에서 발생하던 스택 오버플로우 오류를 수정했습니다." },
            { type: "style", text: "데미지 숫자 폰트 및 디자인을 플랫 스타일로 개선했습니다." }
        ]
    }
];
