/**
 * RotationalBody mixin — 회전 물리 (torque/impulse accumulator 기반).
 *
 * 선형 물리 흐름: force → acceleration → velocity → position
 * 회전 물리 흐름: torque → angularAcceleration → angularVelocity → angle
 *
 * applyAngularImpulse(value)는 각운동량 L을 누적합니다.
 * integrateRotation에서 Δω = L * I⁻¹ 로 angularVelocity에 반영됩니다.
 *
 * 사용법:
 *   import mixins, { RotationalBody } from "./physics/index.js";
 *   class SpinningThing extends mixins(BaseClass, RotationalBody) { ... }
 *
 * 제공 필드/메서드:
 *   this.angle                    — 현재 회전각 (rad)
 *   this.angularVelocity          — 각속도 (rad/s)
 *   this.angularDamping           — 감쇠 계수, 초당 유지율 (0~1, 기본 0.98).
 *                                   실제 적용: angularVelocity *= angularDamping ^ delta
 *   this._accumulatedTorque       — 프레임 누적 torque (integrate 시 초기화)
 *   this._accumulatedAngularImpulse — 프레임 누적 angular impulse L (integrate 시 초기화)
 *   this._inverseMomentOfInertia  — 1 / (0.5 * mass * radius^2)
 *
 *   _computeMomentOfInertia()     — mass, radius 기반 MOI 갱신
 *   applyTorque(value)            — torque 누적 (angularVelocity 직접 수정 금지)
 *   applyAngularImpulse(value)    — angular impulse L 누적
 *   clearAngularForces()          — 누적값 초기화
 *   integrateRotation(delta)      — torque→accel→velocity→angle 적분 + 누적 초기화
 */
export default function RotationalBody(Base) {
    return class extends Base {
        constructor(...args) {
            super(...args);
            this.angle = 0;
            this.angularVelocity = 0;
            this._accumulatedTorque = 0;
            this._accumulatedAngularImpulse = 0;
            this.angularDamping = 0.98;
            this._inverseMomentOfInertia = 0;
        }

        /** mass, radius 기반 solid disk momentOfInertia 역수 계산 */
        _computeMomentOfInertia() {
            const mass = this.mass ?? 1;
            const radius = this.radius ?? 10;
            // solid disk: I = 0.5 * m * r^2
            const moi = 0.5 * mass * radius * radius;
            this._inverseMomentOfInertia = moi > 0.0001 ? 1 / moi : 0;
        }

        /** torque 누적. angularVelocity를 직접 수정하지 않습니다. */
        applyTorque(value) {
            if (!Number.isFinite(value)) return;
            this._accumulatedTorque += value;
        }

        /** angular impulse 누적. 충돌 등에서 순간 회전 충격을 전달합니다. */
        applyAngularImpulse(value) {
            if (!Number.isFinite(value)) return;
            this._accumulatedAngularImpulse += value;
        }

        /** 프레임 누적 torque/impulse 초기화 */
        clearAngularForces() {
            this._accumulatedTorque = 0;
            this._accumulatedAngularImpulse = 0;
        }

        /**
         * 회전 적분 (매 프레임 update에서 호출).
         *
         * 흐름:
         *   1. _computeMomentOfInertia() — mass/radius 기반 I⁻¹ 갱신
         *   2. torque → angularAcceleration → angularVelocity
         *   3. angular impulse L → Δω = L * I⁻¹ → angularVelocity
         *   4. angularVelocity *= angularDamping ^ delta (프레임레이트 독립)
         *   5. angularVelocity → angle
         *   6. clearAngularForces() — 누적 초기화
         */
        integrateRotation(delta) {
            if (!Number.isFinite(delta) || delta <= 0) return;
            this._computeMomentOfInertia();

            // 1. torque → angularAcceleration
            const angularAccel = this._accumulatedTorque * this._inverseMomentOfInertia;

            // 2. angularAcceleration → angularVelocity
            this.angularVelocity += angularAccel * delta;

            // 3. angular impulse L → Δω = L * I⁻¹ (질량/반경이 클수록 회전 변화 적음)
            this.angularVelocity += this._accumulatedAngularImpulse * this._inverseMomentOfInertia;

            // 4. damping (폭주 방지, 프레임레이트 독립)
            const dampFactor = Math.max(0, Math.min(1, this.angularDamping));
            this.angularVelocity *= Math.pow(dampFactor, delta);

            // 5. angularVelocity → angle
            this.angle += this.angularVelocity * delta;

            // 6. 누적 초기화
            this.clearAngularForces();
        }
    };
}
