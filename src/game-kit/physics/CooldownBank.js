function normalizeTime(value) {
    return Math.max(0, Number(value) || 0);
}

/** 한 소유자가 가진 여러 이름 기반 쿨타임을 독립적으로 관리하는 조합 객체입니다. */
export class CooldownBank {
    constructor(durations = {}) {
        this._entries = new Map(
            Object.entries(durations).map(([key, duration]) => [
                key,
                { duration: normalizeTime(duration), remaining: 0 }
            ])
        );
    }

    has(key) {
        return this._entries.has(key);
    }

    isReady(key) {
        return this._getEntry(key).remaining <= 0;
    }

    getRemaining(key) {
        return this._getEntry(key).remaining;
    }

    getDuration(key) {
        return this._getEntry(key).duration;
    }

    reset(key, duration) {
        const entry = this._getEntry(key);
        if (duration !== undefined) entry.duration = normalizeTime(duration);
        entry.remaining = entry.duration;
        return entry.remaining;
    }

    setRemaining(key, remaining) {
        const entry = this._getEntry(key);
        entry.remaining = normalizeTime(remaining);
        return entry.remaining;
    }

    clear(key) {
        return this.setRemaining(key, 0);
    }

    tick(delta, keys = null) {
        const elapsed = normalizeTime(delta);
        const selectedKeys = keys ?? this._entries.keys();
        for (const key of selectedKeys) {
            const entry = this._getEntry(key);
            entry.remaining = Math.max(0, entry.remaining - elapsed);
        }
    }

    consume(key, delta) {
        const elapsed = normalizeTime(delta);
        const entry = this._getEntry(key);
        const consumed = Math.min(elapsed, entry.remaining);
        entry.remaining -= consumed;
        return elapsed - consumed;
    }

    _getEntry(key) {
        const entry = this._entries.get(key);
        if (!entry) throw new Error(`Unknown cooldown key: ${String(key)}`);
        return entry;
    }
}
