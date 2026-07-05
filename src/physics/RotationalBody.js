/**
 * RotationalBody mixin — 회전 물리.
 *
 * 사용법:
 *   import mixins, { RotationalBody } from "./physics/index.js";
 *   class SpinningThing extends mixins(BaseClass, RotationalBody) { ... }
 *
 * 제공 필드/메서드:
 *   this.angle            — 현재 회전각 (rad)
 *   this.angularVelocity  — 각속도 (rad/s)
 *   this.angularDamping   — 감쇠 계수 (0~1, 1=감쇠 없음)
 *   applyAngularImpulse(value) — 각속도 증가
 *   integrateRotation(delta)    — 각속도 적분 + angle 갱신
 */
export default function RotationalBody(Base) {
    return class extends Base {
        constructor() {
            super();
            this.angle = 0;
            this.angularVelocity = 0;
            this.angularDamping = 1;
        }

        applyAngularImpulse(value) {
            if (!Number.isFinite(value)) return;
            this.angularVelocity += value;
        }

        integrateRotation(delta) {
            if (!Number.isFinite(delta) || delta <= 0) return;
            const damped = this.angularVelocity * this.angularDamping;
            this.angle += damped * delta;
        }
    };
}
