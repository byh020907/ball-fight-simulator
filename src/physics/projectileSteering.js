import { Vector2 } from "../core.js";

const EPSILON = 1e-9;

function clampTurn(turn, maximumTurn) {
    return Math.max(-maximumTurn, Math.min(maximumTurn, turn));
}

/**
 * 현재 투사체 속도의 크기를 보존한 채 목표 위치 쪽으로 제한 회전합니다.
 * 속도 변경은 PhysicsBody의 impulse 경로로만 전달합니다.
 */
export function steerProjectileVelocityToward(body, targetPosition, delta, maximumTurnRate) {
    const currentVelocity = body.velocity;
    const speed = Math.hypot(currentVelocity.x, currentVelocity.y);
    const targetOffset = Vector2.subtract(targetPosition, body.position);
    if (speed <= EPSILON || Math.hypot(targetOffset.x, targetOffset.y) <= EPSILON) return false;

    const currentAngle = Math.atan2(currentVelocity.y, currentVelocity.x);
    const targetAngle = Math.atan2(targetOffset.y, targetOffset.x);
    const angleDelta = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
    const turn = clampTurn(angleDelta, Math.max(0, maximumTurnRate * delta));
    const nextVelocity = Vector2.fromAngle(currentAngle + turn, speed);
    body.applyImpulse(Vector2.subtract(nextVelocity, currentVelocity));
    return true;
}
