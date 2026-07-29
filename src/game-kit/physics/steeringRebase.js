function normalizeDirection(vector, fallback) {
    const length = Math.hypot(vector?.x ?? 0, vector?.y ?? 0);
    if (length > 0) return { x: vector.x / length, y: vector.y / length };
    return fallback;
}

/**
 * 정적 표면 반사 뒤 조향 경로를 실제 반사 속도에서 다시 시작할 상태를 만듭니다.
 * 입력 target은 호출자가 보존하는 고정 월드 좌표이며 이 helper는 추적하지 않습니다.
 */
export function createSteeringRebaseState({ fixedTarget, currentPosition, reflectedVelocity, duration }) {
    const targetDirection = normalizeDirection(
        {
            x: fixedTarget.x - currentPosition.x,
            y: fixedTarget.y - currentPosition.y
        },
        { x: 1, y: 0 }
    );
    const startDirection = normalizeDirection(reflectedVelocity, targetDirection);

    return {
        startDirection,
        targetDirection,
        startAngle: Math.atan2(startDirection.y, startDirection.x),
        targetAngle: Math.atan2(targetDirection.y, targetDirection.x),
        elapsed: 0,
        duration: Math.max(Number.EPSILON, duration)
    };
}
