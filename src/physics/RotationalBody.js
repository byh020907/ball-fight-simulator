/**
 * RotationalBody mixin — 회전 물리 (torque accumulator 기반).
 *
 * 선형 물리 흐름: force → acceleration → velocity → position
 * 회전 물리 흐름: torque → angularAcceleration → angularVelocity → angle
 *
 * 사용법:
 *   import mixins, { RotationalBody } from "./physics/index.js";
 *   class SpinningThing extends mixins(BaseClass, RotationalBody) { ... }
 *
 * 제공 필드/메서드:
 *   this.angle                    — 현재 회전각 (rad)
 *   this.angularVelocity          — 각속도 (rad/s)
 *   this.angularDamping           — 감쇠 계수 (0~1, 기본 0.98)
 *   this._accumulatedTorque       — 프레임 누적 torque (integrate 시 초기화)
 *   this._accumulatedAngularImpulse — 프레임 누적 angular impulse (integrate 시 초기화)
 *   this._inverseMomentOfInertia  — 1 / (0.5 * mass * radius^2)
 *
 *   _computeMomentOfInertia()     — mass, radius 기반 MOI 갱신
 *   applyTorque(value)            — torque 누적 (angularVelocity 직접 수정 금지)
 *   applyAngularImpulse(value)    — angular impulse 누적
 *   clearAngularForces()          — 누적값 초기화
 *   integrateRotation(delta)      — torque→accel→velocity→angle 적분 + 누적 초기화
 */
export default function RotationalBody(Base) {
    return class extends Base {
        constructor() {
            super();
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
         *   1. _computeMomentOfInertia() — mass/radius 반영
         *   2. torque → angularAcceleration → angularVelocity
         *   3. angular impulse → angularVelocity
         *   4. angularVelocity *= angularDamping
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

            // 3. angular impulse 적용 (충돌 등)
            this.angularVelocity += this._accumulatedAngularImpulse;

            // 4. damping (폭주 방지)
            const dampFactor = Math.max(0, Math.min(1, this.angularDamping));
            this.angularVelocity *= dampFactor;

            // 5. angularVelocity → angle
            this.angle += this.angularVelocity * delta;

            // 6. 누적 초기화
            this.clearAngularForces();
        }
    };
}
