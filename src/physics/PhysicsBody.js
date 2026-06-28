import { Vector2 } from "../core.js";

const BASE_VELOCITY_CORRECTION_RATE = 5.5;

/**
 * PhysicsBody 믹스인 — 물리 시뮬레이션에 필요한 상태와 연산을 제공합니다.
 *
 * 제공 속성:
 *   this.pos       — 위치 (Vector2)
 *   this.velocity  — 속도 (Vector2)
 *   this.mass      — 질량
 *   this.radius    — 반지름
 *   this.bounced   — 프레임 내 벽 충돌 여부
 *
 * 제공 메서드:
 *   applyImpulse(vec)          — 순간 속도 변화 적용
 *   applyForce(vec)            — 지속 힘 누적
 *   integrate(delta)           — 속도 → 위치 적분
 *   _applyVelocityCorrection(sim, delta)  — 목표 속도로 지수 감쇠
 *   _computeDesiredVelocity(sim)         — 목표 속도 계산
 */
export default function PhysicsBody(Base) {
    return class extends Base {
        constructor() {
            super();
            this.pos = new Vector2();
            this.velocity = new Vector2();
            this.mass = 1;
            this.radius = 10;
            this.bounced = false;
            this._forceAccum = new Vector2();
        }

        // ── 위치 접근자 (기존 position과 호환) ──

        get position() {
            return this.pos;
        }
        set position(v) {
            this.pos = v;
        }

        // ── 충격량 (즉시 속도 변경) ──

        applyImpulse(impulse) {
            this.velocity.add(impulse);
        }

        // ── 지속 힘 누적 ──

        applyForce(force) {
            this._forceAccum.add(force);
        }

        // ── 속도 → 위치 적분 ──

        integrate(delta) {
            this.pos.add(this.velocity.clone().scale(delta));
        }

        // ── 속도 보정 (목표 속도로 지수 감쇠) ──

        _applyVelocityCorrection(simulation, delta) {
            const desired = this._computeDesiredVelocity(simulation);
            const recoBonus = 1 + (this.mastery?.physics?.velocityRecoveryBonus ?? 0);
            const rate = BASE_VELOCITY_CORRECTION_RATE * recoBonus;
            const correction = 1 - Math.exp(-rate * delta);
            this.applyImpulse(Vector2.subtract(desired, this.velocity).scale(correction));
        }

        /**
         * 목표 속도 계산.
         * 하위 클래스에서 `getStatModifiers()`, `getSpeedMultiplier()`를 제공해야 합니다.
         */
        _computeDesiredVelocity(simulation) {
            const modifiers = this.getStatModifiers?.() ?? { speed: 1 };
            const slowMult = this.state?.slow ? this.state.slow.amount : 1;
            const boostMult = this.state?.speedBoost ? this.state.speedBoost.multiplier : 1;
            const movementSpeed = this.state?.movement?.getSpeed?.(this);

            const currentDir =
                this.velocity.length() > 0
                    ? this.velocity.clone().normalize()
                    : Vector2.fromAngle(Math.random() * Math.PI * 2, 1);

            const heading = this.state?.forcedHeading;
            const direction = heading ? heading.direction.clone() : currentDir;

            const speedOverride = movementSpeed ?? this.state?.speedBoost?.speedOverride;
            const baseSpeed = this.stats?.baseSpeed ?? this.baseSpeed ?? 100;
            const speedMult = simulation?.getSpeedMultiplier?.(this) ?? 1;

            return direction.scale(speedOverride ?? baseSpeed * modifiers.speed * slowMult * boostMult * speedMult);
        }
    };
}
