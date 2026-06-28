// ── Cookie utilities ────────────────────────────────────────────────────────
//
// 범용 쿠키 읽기/쓰기. patch-notes 외 다른 곳에서도 재사용 가능.
// 이 파일이 너무 커지면 목적별로 분리하세요 (예: src/cookie.js, src/patch-utils.js 등).
// ─────────────────────────────────────────────────────────────────────────────

import { PATCH_NOTES } from "./patchNotes.js";

const COOKIE_PATCH = "ballfight_patch";

/** @param {string} name */
function getCookie(name) {
    const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : "";
}

/** @param {string} name @param {string} value */
function setCookie(name, value) {
    document.cookie =
        name + "=" + encodeURIComponent(value) + "; path=/; max-age=" + 60 * 60 * 24 * 365 + "; SameSite=Lax";
}

// ── Patch-note helpers (depends on PATCH_NOTES from patchNotes.js) ─────────

/** 지금까지 본 가장 최신 버전 (쿠키). */
export function getSeenVersion() {
    return getCookie(COOKIE_PATCH);
}

/** @param {string} version */
export function setSeenVersion(version) {
    setCookie(COOKIE_PATCH, version);
}

/** PATCH_NOTES 배열에서 가장 최신 항목의 버전 (맨 앞). */
export function getLatestVersion() {
    return PATCH_NOTES.length > 0 ? PATCH_NOTES[0].version : "";
}

/** 쿠키보다 새로운 항목만 반환 (최신순, 배열 순서 유지). */
export function getUnseenEntries() {
    const seen = getSeenVersion();
    if (!seen) return [...PATCH_NOTES];
    const idx = PATCH_NOTES.findIndex((e) => e.version === seen);
    // newest-first → entries before `idx` are newer than seen
    return idx > 0 ? PATCH_NOTES.slice(0, idx) : [];
}

export function shouldShowPatchNotes() {
    return getUnseenEntries().length > 0;
}

export function dismissPatchNotes() {
    setSeenVersion(getLatestVersion());
}

// ── 공통 배열 헬퍼 ──────────────────────────────────────────────────────

/** 배열 끝에 항목 추가 후 최대 개수로 자름 (로그 등에 사용) */
export function appendCapped(arr, item, max) {
    arr.push(item);
    if (arr.length > max) arr.splice(0, arr.length - max);
    return arr;
}
