/**
 * BurstSequencer 믹스인 — 연발 발사(burst fire) 상태머신을 제공합니다.
 *
 * 제공 속성:
 *   this._burstRemaining — 남은 발사 횟수
 *   this._burstTotal     — 총 발사 횟수
 *   this._burstTimer     — 다음 발사까지 남은 시간
 *   this._burstInterval  — 발사 간격 (초)
 *
 * 제공 getter:
 *   this.isBursting  — 버스트 발사 중인지
 *   this.burstProgress — 0→1 버스트 진행도
 *
 * 제공 메서드:
 *   startBurst(count, interval) — 버스트 시작
 *   tickBurst(delta, onFire)    — delta만큼 진행, 발사 시 onFire(index) 호출
 */
export const BURST_RESULTS = Object.freeze({
    FIRED: "fired",
    PAUSED: "paused",
    CANCELLED: "cancelled",
    WAITING: "waiting"
});

const BURST_CALLBACK_RESULTS = new Set([BURST_RESULTS.FIRED, BURST_RESULTS.PAUSED, BURST_RESULTS.CANCELLED]);

export default function BurstSequencer(Base) {
    return class extends Base {
        constructor(...args) {
            super(...args);
            this._burstRemaining = 0;
            this._burstTotal = 0;
            this._burstTimer = 0;
            this._burstInterval = 0.1;
        }

        get isBursting() {
            return this._burstRemaining > 0;
        }

        get burstProgress() {
            return this._burstTotal > 0 ? (this._burstTotal - this._burstRemaining) / this._burstTotal : 1;
        }

        startBurst(count, interval) {
            this._burstTotal = count;
            this._burstRemaining = count;
            this._burstInterval = interval;
            this._burstTimer = 0;
        }

        /**
         * 버스트 타이머를 진행하고, 발사 시점이면 callback을 호출합니다.
         * @param {number} delta
         * @param {(index: number) => void} onFire — 발사할 때 호출 (현재 인덱스 전달)
         */
        tickBurst(delta, onFire) {
            if (!this.isBursting) return BURST_RESULTS.CANCELLED;
            this._burstTimer -= delta;
            if (this._burstTimer > 0) return BURST_RESULTS.WAITING;

            const result = onFire(this._burstTotal - this._burstRemaining) ?? BURST_RESULTS.FIRED;
            if (!BURST_CALLBACK_RESULTS.has(result)) {
                throw new TypeError(`Unknown burst callback result: ${String(result)}`);
            }
            if (result === BURST_RESULTS.CANCELLED) {
                this._burstRemaining = 0;
                return result;
            }
            if (result === BURST_RESULTS.PAUSED) {
                return result;
            }
            if (result === BURST_RESULTS.FIRED) {
                this._burstRemaining--;
                this._burstTimer = this._burstInterval;
            }
            return result;
        }
    };
}
