/**
 * 활성 엔티티 수가 예약 슬롯을 포함한 상한을 넘지 않도록 오래된 항목부터 만료시킵니다.
 */
export function enforceActiveEntityLimit(
    entities,
    maximum,
    { reserveSlots = 0, getOrder = null, expire = (entity) => (entity.isExpired = true) } = {}
) {
    const allowed = Math.max(0, Math.floor(maximum) - Math.max(0, Math.floor(reserveSlots)));
    const active = entities.filter((entity) => !entity.isExpired);
    if (getOrder) active.sort((left, right) => getOrder(left) - getOrder(right));
    while (active.length > allowed) expire(active.shift());
    return active.filter((entity) => !entity.isExpired);
}
