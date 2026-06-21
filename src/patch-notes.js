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
 * 누적 패치노트 목록. 가장 오래된 버전이 앞, 최신이 뒤.
 * 유저가 마지막으로 확인한 버전 이후의 항목만 팝업에 표시됩니다.
 * @type {PatchEntry[]}
 */
export const PATCH_NOTES = [
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
    }
];
