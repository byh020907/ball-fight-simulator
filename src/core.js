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

    dot(other) {
        return this.x * other.x + this.y * other.y;
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
        // Initial state only. Runtime velocity changes should use applyImpulse().
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

    applyImpulse(impulse) {
        this.velocity.add(impulse);
    }

    /**
     * 투사체 공통 hit 처리 (Template Method).
     * Subclass는 _getHitDamage, _getHitLabel, _onHitEffects만 구현.
     * Projectile-only mitigation is owned by target ActionContext effects.
     */
    dealDamageToTarget(target, rawDamage, source, label, simulation) {
        const finalDamage =
            target.actionContext?.onProjectileDamage?.(rawDamage, this, source, label, simulation, target) ?? rawDamage;
        target.takeDamage(finalDamage, source, label);
    }

    /**
     * 투사체 update 공통 템플릿.
     * Subclass는 _findTarget(sim), _getHitDamage(), _getHitLabel(), _onHitEffects()를 구현.
     */
    updateProjectile(delta, simulation) {
        this.position.add(this.velocity.clone().scale(delta));
        simulation.keepEntityInsideArena(this);

        if (this.life != null) {
            this.life -= delta;
            if (this.life <= 0) {
                this._onExpired(simulation);
                this.isExpired = true;
                return;
            }
        }

        this._projectileHitCheck(simulation);
    }

    /** hit 체크만 — 커스텀 update에서 호출 가능 */
    _projectileHitCheck(simulation) {
        const target = this._findTarget(simulation);
        if (!target || target.isDefeated) return;

        const dist = Vector2.subtract(this.position, target.position).length();
        if (dist > target.radius + this.radius) return;

        const rawDmg = this._getHitDamage(simulation);
        this.dealDamageToTarget(target, rawDmg, this.owner, this._getHitLabel(), simulation);
        this._onHitEffects(target, simulation);
        this.isExpired = true;
    }

    /** @returns {import("./entities.js").BattleBall|null} — subclass override */
    _findTarget(simulation) {
        return null;
    }
    _getHitDamage() {
        return 0;
    }
    _getHitLabel() {
        return "Hit";
    }
    _onHitEffects(target, simulation) {}
    _onExpired(simulation) {}
}

/**
 * 투사체 공통 베이스 — owner/ownerId 중복 제거.
 * 모든 투사체(SeedOrb, ArrowProjectile, OrbitProjectile, Grenade)는 이 클래스를 extends.
 */
export class Projectile extends CombatEntity {
    constructor(owner, position, velocity, radius) {
        super(position, velocity, radius);
        this.owner = owner;
        this.ownerId = owner.id;
    }
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
    EATER: "eater",
    BAT_BALL: "bat_ball",
    HERO: "hero"
});

const EVADE_IMPULSE_RESPONSE = 0.72;

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

/**
 * 패시브 회피 — 상대가 일정 거리 이내로 접근하고, owner가 상대를 향해 이동 중일 때 발동합니다.
 *
 * 회피 방향: 상대 진행 방향 기준 owner의 위치에 따라 좌/우로 회피합니다.
 * forceHeading을 사용해 기본 이동 목표 방향을 잠깐 고정합니다.
 *
 * @param {import("./entities.js").BattleBall} owner - 회피할 볼
 * @param {import("./entities.js").BattleBall} target - 접근하는 상대
 * @param {number} range - 회피 발동 거리
 * @param {number} strength - 회피 강도 (0~1)
 */
export function evadeTarget(owner, target, range, strength) {
    if (!target || target.isDefeated || owner.swallowedState || owner.wallSlamState) return;

    const toTarget = Vector2.subtract(target.position, owner.position);
    const dist = toTarget.length();
    if (dist >= range || dist <= 5) return;

    const towardOpponent = toTarget.normalize();

    const myDir = owner.velocity.length() > 5 ? owner.velocity.clone().normalize() : null;
    const movingToward = myDir ? myDir.x * towardOpponent.x + myDir.y * towardOpponent.y > 0 : true;
    if (!movingToward) return;

    const oppDir =
        target.velocity.length() > 5 ? target.velocity.clone().normalize() : towardOpponent.clone().scale(-1);

    const side = oppDir.x * (owner.position.y - target.position.y) - oppDir.y * (owner.position.x - target.position.x);

    const dodgeDir = side > 0 ? new Vector2(-oppDir.y, oppDir.x) : new Vector2(oppDir.y, -oppDir.x);

    const intensity = (1 - dist / range) * strength;
    const current = myDir ?? dodgeDir;
    const blended = current.add(dodgeDir.scale(intensity)).normalize();
    const desiredSpeed = Math.max(owner.velocity.length(), owner.baseSpeed * owner.getStatModifiers().speed);
    const desiredVelocity = blended.clone().scale(desiredSpeed);
    owner.applyImpulse(Vector2.subtract(desiredVelocity, owner.velocity).scale(EVADE_IMPULSE_RESPONSE * intensity));

    if (owner.forcedHeading) {
        owner.forcedHeading.direction = blended;
        owner.forcedHeading.effect.elapsed = 0;
    } else {
        owner.forceHeading(blended, 0.35);
    }
}
