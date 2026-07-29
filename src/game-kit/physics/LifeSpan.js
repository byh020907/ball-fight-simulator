/**
 * LifeSpan 믹스인 — 수명 기반 소멸 패턴을 제공합니다.
 *
 * 제공 속성:
 *   this.life      — 남은 수명 (초)
 *   this.maxLife   — 최대 수명 (초, progress 계산용)
 *
 * 제공 getter:
 *   this.lifeProgress — 0→1 소멸 진행도
 *   this.isAlive      — 수명 남았는지 여부
 *
 * 제공 메서드:
 *   tickLife(delta) — delta만큼 수명 감소, 만료 시 isExpired=true 설정 후 false 반환
 */
export default function LifeSpan(Base) {
    return class extends Base {
        constructor() {
            super();
            this.life = 1;
            this.maxLife = 1;
        }

        get lifeProgress() {
            return this.maxLife > 0 ? 1 - Math.max(0, this.life / this.maxLife) : 0;
        }

        get isAlive() {
            return this.life > 0;
        }

        /**
         * 수명을 delta만큼 감소시키고 만료 여부를 반환합니다.
         * @param {number} delta
         * @returns {boolean} true = 아직 살아있음, false = 만료됨 (isExpired 설정됨)
         */
        tickLife(delta) {
            this.life -= delta;
            if (this.life <= 0) {
                this.isExpired = true;
                return false;
            }
            return true;
        }
    };
}
