// ── Patch notes data ────────────────────────────────────────────────────────
//
// 패치노트 작성 규칙은 docs/patch-notes-guide.md 를 참고하세요.
//   - version 증가 / date 갱신 / changes 배열 추가
//   - type: feature | refactor | fix | style (새 type 추가시 CSS도 필요)
//   - 한국어, 유저 시점, 간결하게
//
// 이전 버전 패치노트는 docs/patch-notes-archive.md 에 보관합니다.
// ─────────────────────────────────────────────────────────────────────────────

export const PATCH_NOTES = {
    /** Bump this when new patch notes should be shown. */
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
};

// ── Cookie helpers ──────────────────────────────────────────────────────────

const COOKIE_NAME = "ballfight_patch";

export function getSeenVersion() {
    const match = document.cookie.match(new RegExp("(?:^|; )" + COOKIE_NAME + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : "";
}

export function setSeenVersion(version) {
    document.cookie =
        COOKIE_NAME + "=" + encodeURIComponent(version) + "; path=/; max-age=" + 60 * 60 * 24 * 365 + "; SameSite=Lax";
}

export function shouldShowPatchNotes() {
    return getSeenVersion() !== PATCH_NOTES.version;
}

export function dismissPatchNotes() {
    setSeenVersion(PATCH_NOTES.version);
}
