/**
 * PhysicsDebugRingBuffer — 물리 디버깅용 고정 길이 ring buffer.
 *
 * NaN/Infinity 또는 이상 충돌 발생 시 직전 물리 이벤트를 추적하기 위한 유틸입니다.
 * 게임 결과에 영향을 주지 않으며, 기록 실패가 전투 로직을 깨지 않습니다.
 *
 * 사용법:
 *   const buf = new PhysicsDebugRingBuffer(30);
 *   buf.push({ type: "impulse", entityId: "archer", ... });
 *   buf.toArray();  // 복사본 배열 반환
 *   buf.clear();
 */
export class PhysicsDebugRingBuffer {
    #buffer;
    #capacity;
    #head;
    #size;

    constructor(capacity = 30) {
        this.#capacity = Math.max(1, Math.floor(capacity));
        this.#buffer = new Array(this.#capacity);
        this.#head = 0;
        this.#size = 0;
    }

    /**
     * 이벤트를 ring buffer에 추가합니다.
     * capacity를 초과하면 가장 오래된 이벤트가 제거됩니다.
     * 예외를 발생시키지 않으며, 기록 실패 시 조용히 무시합니다.
     */
    push(event) {
        try {
            const idx = (this.#head + this.#size) % this.#capacity;
            this.#buffer[idx] = event;
            if (this.#size < this.#capacity) {
                this.#size++;
            } else {
                this.#head = (this.#head + 1) % this.#capacity;
            }
        } catch {
            // 기록 실패는 조용히 무시
        }
    }

    /** 저장된 이벤트의 복사본 배열을 반환합니다. 내부 배열 참조를 직접 노출하지 않습니다. */
    toArray() {
        const result = [];
        for (let i = 0; i < this.#size; i++) {
            result.push(this.#buffer[(this.#head + i) % this.#capacity]);
        }
        return result;
    }

    /** 모든 이벤트를 제거합니다. */
    clear() {
        this.#head = 0;
        this.#size = 0;
        // 참조 해제 (GC)
        for (let i = 0; i < this.#capacity; i++) {
            this.#buffer[i] = undefined;
        }
    }

    /** 현재 저장된 이벤트 개수 */
    get length() {
        return this.#size;
    }
}

/**
 * entity의 현재 물리 상태 스냅샷을 생성합니다 (값 복사).
 * Vector2는 {x, y} 객체로 복사됩니다.
 */
export function snapshotPhysicsState(entity) {
    const pos = entity.position ?? entity.pos ?? { x: 0, y: 0 };
    const vel = entity.velocity ?? { x: 0, y: 0 };
    return {
        position: { x: pos.x, y: pos.y },
        velocity: { x: vel.x, y: vel.y },
        angle: entity.angle ?? 0,
        angularVelocity: entity.angularVelocity ?? 0,
        angularAcceleration: null, // 필요 시 계산 가능
        accumulatedTorque: entity._accumulatedTorque ?? null,
        accumulatedAngularImpulse: entity._accumulatedAngularImpulse ?? null
    };
}

/**
 * entity의 핵심 물리 상태가 유효한지 확인합니다.
 * position, velocity, angle, angularVelocity가 NaN/Infinity인지 검사.
 * 무효 상태 발견 시 ring buffer 내용을 console.error로 출력합니다.
 *
 * @param {object} entity - BattleBall 인스턴스
 * @param {number} [elapsed] - simulation 경과 시간 또는 frame 정보
 */
export function validatePhysicsState(entity, elapsed) {
    const pos = entity.position ?? entity.pos;
    const vel = entity.velocity;
    const angle = entity.angle;
    const angVel = entity.angularVelocity;

    const checks = [
        { name: "position.x", value: pos?.x },
        { name: "position.y", value: pos?.y },
        { name: "velocity.x", value: vel?.x },
        { name: "velocity.y", value: vel?.y },
        { name: "angle", value: angle },
        { name: "angularVelocity", value: angVel }
    ];

    let invalid = false;
    for (const check of checks) {
        if (!Number.isFinite(check.value)) {
            invalid = true;
            break;
        }
    }

    if (invalid && entity.physicsDebug) {
        const events = entity.physicsDebug.toArray();
        const header = `[PhysicsDebug] invalid state on "${entity.name ?? entity.id}" at elapsed=${elapsed ?? "?"}`;
        console.error(header + "\n" + JSON.stringify(events, null, 2));
        return false;
    }
    return true;
}
