export class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

    add(other) {
        this.x += other.x;
        this.y += other.y;
        return this;
    }

    subtract(other) {
        this.x -= other.x;
        this.y -= other.y;
        return this;
    }

    scale(value) {
        this.x *= value;
        this.y *= value;
        return this;
    }

    length() {
        return Math.hypot(this.x, this.y);
    }

    normalize() {
        const size = this.length() || 1;
        this.x /= size;
        this.y /= size;
        return this;
    }

    static add(a, b) {
        return new Vector2(a.x + b.x, a.y + b.y);
    }

    static subtract(a, b) {
        return new Vector2(a.x - b.x, a.y - b.y);
    }

    static fromAngle(angle, radius) {
        return new Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
}

/** Named render layers for ArenaRenderer — lower values draw first. */
export const RENDER_LAYERS = Object.freeze({
    /** Particles, visual effects, projectiles — behind fighters. */
    BACKGROUND: 0,
    /** Fighters. */
    FIGHTER: 1,
    /** Floating text, UI overlays on the canvas — in front of fighters. */
    FOREGROUND: 2
});

export class CombatEntity {
    constructor(position, velocity, radius) {
        this.position = position;
        this.velocity = velocity;
        this.radius = radius;
        this.isExpired = false;
    }

    /** Render priority — lower values draw first (behind). */
    static renderLayer = RENDER_LAYERS.BACKGROUND;
    get renderLayer() {
        return this.constructor.renderLayer;
    }

    update() {}
    draw() {}
}

export class TimedEffect {
    constructor(duration) {
        this.duration = duration;
        this.elapsed = 0;
    }

    get finished() {
        return this.elapsed >= this.duration;
    }

    tick(delta) {
        this.elapsed += delta;
    }
}

export const FIGHTER_IDS = Object.freeze({
    ARCHER: "archer",
    ORBIT: "orbit",
    TRICKSTER: "trickster",
    GRENADE: "grenade",
    DASH: "dash",
    RAGE: "rage",
    EATER: "eater"
});

/**
 * 볼을 목표 방향으로 유도합니다.
 *
 * @param {import("./entities.js").BattleBall} ball
 * @param {{ position:Vector2 }} target
 * @param {number} delta
 * @param {{ turnRate?:number, instant?:boolean, persist?:boolean }} [opts]
 *   turnRate: 초당 회전 각도 (라디안, 기본 2.4)
 *   instant: true면 현재 방향 무시하고 즉시 목표 방향 (기본 false)
 *   persist: true면 forceHeading 지속 갱신 (기본 false)
 */
export function steerBallToward(ball, target, delta, opts = {}) {
    const { turnRate = 2.4, instant = false, persist = false } = opts;
    const desired = Vector2.subtract(target.position, ball.position).normalize();

    let heading;
    if (instant) {
        heading = desired;
    } else {
        const current =
            ball.forcedHeading?.direction?.clone() ??
            (ball.velocity.length() > 0 ? ball.velocity.clone().normalize() : desired);
        const cross = current.x * desired.y - current.y * desired.x;
        const dot = current.x * desired.x + current.y * desired.y;
        const angle = Math.atan2(cross, dot);
        const turn = Math.max(-turnRate * delta, Math.min(turnRate * delta, angle));
        const nextAngle = Math.atan2(current.y, current.x) + turn;
        heading = Vector2.fromAngle(nextAngle, 1);
    }

    if (ball.forcedHeading && persist) {
        ball.forcedHeading.direction = heading;
        ball.forcedHeading.effect.elapsed = 0;
    } else if (persist) {
        ball.forceHeading(heading, 0.35);
    } else {
        ball.forceHeading(heading, 0.1);
    }
}
