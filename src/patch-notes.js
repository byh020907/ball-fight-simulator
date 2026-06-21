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
        version: "0.6.5",
        date: "2026-06-22",
        title: "v0.6.5 업데이트",
        changes: [
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
            { type: "feature", text: "Eater Ball 방어력 재설계 — 피스트 중 방어력 3배 (4→12), 뱉은 후 쿨타임 초기화." },
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
            { type: "feature", text: "Eater Ball 방어력 상향 — 기본 방어 1.5배, 피스트 중 3배." },
            { type: "feature", text: "Eater Ball 피스트 중 상대 유도 기능 추가." },
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
