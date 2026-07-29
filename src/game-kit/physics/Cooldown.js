/**
 * Cooldown 믹스인 — 쿨다운 타이머 관리를 제공합니다.
 *
 * 제공 속성:
 *   this._cooldownDuration  — 기본 쿨다운 시간
 *   this._cooldownRemaining — 남은 쿨다운 시간
 *
 * 제공 getter:
 *   this.cooldownReady    — 쿨다운 완료 여부
 *   this.cooldownProgress — 0→1 쿨다운 진행도
 *
 * 제공 메서드:
 *   tickCooldown(delta)           — delta만큼 쿨다운 감소
 *   resetCooldown(duration)       — 쿨다운 초기화 (duration 생략 시 기존 값)
 *   setCooldownDuration(duration) — 쿨다운 시간 설정
 */
export default function Cooldown(Base) {
    return class extends Base {
        constructor(...args) {
            super(...args);
            this._cooldownDuration = 0;
            this._cooldownRemaining = 0;
        }

        get cooldownReady() {
            return this._cooldownRemaining <= 0;
        }

        get cooldownRemaining() {
            return this._cooldownRemaining;
        }

        get cooldownProgress() {
            return this._cooldownDuration > 0
                ? Math.max(0, Math.min(1, 1 - this._cooldownRemaining / this._cooldownDuration))
                : 1;
        }

        tickCooldown(delta) {
            this.reduceCooldown(delta);
        }

        reduceCooldown(amount) {
            this._cooldownRemaining = Math.max(0, this._cooldownRemaining - Math.max(0, amount));
            return this._cooldownRemaining;
        }

        setCooldownRemaining(remaining) {
            this._cooldownRemaining = Math.max(0, Number(remaining) || 0);
            return this._cooldownRemaining;
        }

        resetCooldown(duration) {
            if (duration !== undefined) {
                this._cooldownDuration = duration;
            }
            this._cooldownRemaining = this._cooldownDuration;
        }

        setCooldownDuration(duration) {
            this._cooldownDuration = duration;
            this._cooldownRemaining = Math.min(this._cooldownRemaining, duration);
        }
    };
}
