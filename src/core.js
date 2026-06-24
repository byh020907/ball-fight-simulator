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

/** Named render layers for ArenaRenderer ??lower values draw first. */
export const RENDER_LAYERS = Object.freeze({
    /** Particles, visual effects, projectiles ??behind fighters. */
    BACKGROUND: 0,
    /** Fighters. */
    FIGHTER: 1,
    /** Floating text, UI overlays on the canvas ??in front of fighters. */
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

    /** Render priority ??lower values draw first (behind). */
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
     * ?ъ궗泥?怨듯넻 hit 泥섎━ (Template Method).
     * Subclass??_getHitDamage, _getHitLabel, _onHitEffects留?援ы쁽.
     * Projectile-only mitigation is owned by target ActionContext effects.
     */
    dealDamageToTarget(target, rawDamage, source, label, simulation) {
        const finalDamage =
            target.actionContext?.onProjectileDamage?.(rawDamage, this, source, label, simulation, target) ?? rawDamage;
        target.takeDamage(finalDamage, source, label);
    }

    /**
     * ?ъ궗泥?update 怨듯넻 ?쒗뵆由?
     * Subclass??_findTarget(sim), _getHitDamage(), _getHitLabel(), _onHitEffects()瑜?援ы쁽.
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

    /** hit 泥댄겕留???而ㅼ뒪? update?먯꽌 ?몄텧 媛??*/
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

    /** @returns {import("./entities/index.js").BattleBall|null} ??subclass override */
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
 * ?ъ궗泥?怨듯넻 踰좎씠????owner/ownerId 以묐났 ?쒓굅.
 * 紐⑤뱺 ?ъ궗泥?SeedOrb, ArrowProjectile, OrbitProjectile, Grenade)?????대옒?ㅻ? extends.
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
 * 蹂쇱쓣 紐⑺몴 諛⑺뼢?쇰줈 ?좊룄?⑸땲??
 *
 * @param {import("./entities/index.js").BattleBall} ball
 * @param {{ position:Vector2 }} target
 * @param {number} delta
 * @param {{ turnRate?:number, instant?:boolean, persist?:boolean }} [opts]
 *   turnRate: 珥덈떦 ?뚯쟾 媛곷룄 (?쇰뵒?? 湲곕낯 2.4)
 *   instant: true硫??꾩옱 諛⑺뼢 臾댁떆?섍퀬 利됱떆 紐⑺몴 諛⑺뼢 (湲곕낯 false)
 *   persist: true硫?forceHeading 吏??媛깆떊 (湲곕낯 false)
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
 * ?⑥떆釉??뚰뵾 ???곷?媛 ?쇱젙 嫄곕━ ?대궡濡??묎렐?섍퀬, owner媛 ?곷?瑜??ν빐 ?대룞 以묒씪 ??諛쒕룞?⑸땲??
 *
 * ?뚰뵾 諛⑺뼢: ?곷? 吏꾪뻾 諛⑺뼢 湲곗? owner???꾩튂???곕씪 醫??곕줈 ?뚰뵾?⑸땲??
 * forceHeading???ъ슜??湲곕낯 ?대룞 紐⑺몴 諛⑺뼢???좉퉸 怨좎젙?⑸땲??
 *
 * @param {import("./entities/index.js").BattleBall} owner - ?뚰뵾??蹂? * @param {import("./entities/index.js").BattleBall} target - ?묎렐?섎뒗 ?곷?
 * @param {number} range - ?뚰뵾 諛쒕룞 嫄곕━
 * @param {number} strength - ?뚰뵾 媛뺣룄 (0~1)
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
