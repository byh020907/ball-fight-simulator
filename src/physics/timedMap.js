/** 숫자 남은 시간을 값으로 갖는 Map을 한 프레임 진행하고 만료 항목을 제거합니다. */
export function tickTimedMap(entries, delta, { isInvalid = () => false } = {}) {
    const elapsed = Math.max(0, Number(delta) || 0);
    for (const [key, remaining] of entries) {
        const next = Math.max(0, remaining - elapsed);
        if (next <= 0 || isInvalid(key)) entries.delete(key);
        else entries.set(key, next);
    }
    return entries;
}
