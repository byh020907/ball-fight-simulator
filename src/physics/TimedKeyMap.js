function normalizeTime(value) {
    return Math.max(0, Number(value) || 0);
}

/** 키마다 동적으로 생성되는 제한 시간을 소유하고 만료 항목을 자동 제거하는 조합 객체입니다. */
export class TimedKeyMap {
    constructor({ isInvalid = () => false } = {}) {
        this._remainingByKey = new Map();
        this._isInvalid = isInvalid;
    }

    get size() {
        return this._remainingByKey.size;
    }

    has(key) {
        return this._remainingByKey.has(key);
    }

    getRemaining(key) {
        return this._remainingByKey.get(key) ?? 0;
    }

    start(key, duration) {
        const remaining = normalizeTime(duration);
        if (remaining <= 0 || this._isInvalid(key)) {
            this._remainingByKey.delete(key);
            return 0;
        }
        this._remainingByKey.set(key, remaining);
        return remaining;
    }

    cancel(key) {
        return this._remainingByKey.delete(key);
    }

    clear() {
        this._remainingByKey.clear();
    }

    tick(delta) {
        const elapsed = normalizeTime(delta);
        for (const [key, remaining] of this._remainingByKey) {
            const next = Math.max(0, remaining - elapsed);
            if (next <= 0 || this._isInvalid(key)) this._remainingByKey.delete(key);
            else this._remainingByKey.set(key, next);
        }
    }
}
