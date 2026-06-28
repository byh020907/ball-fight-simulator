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
import { LifeSpan, mixins, PhysicsBody } from "./physics/index.js";

export const RENDER_LAYERS = Object.freeze({
    BACKGROUND: 0,
    FIGHTER: 1,
    FOREGROUND: 2
});

// ── ProjectileBehavior (local function, no circular deps) ──────────────────

function ProjectileBehavior(Base) {
    return class extends Base {
        constructor() {
            super();
            this.owner = null;
            this.ownerId = null;
        }

        updateProjectile(delta, simulation) {
            this.integrate(delta);
            simulation.keepEntityInsideArena(this);
            if (this.life != null && !this.tickLife(delta)) {
                this._onExpired(simulation);
                return;
            }
            this._projectileHitCheck(simulation);
        }

        _projectileHitCheck(simulation) {
            const target = this._findTarget(simulation);
            if (!target || target.flags.defeated) return;
            const dist = Vector2.subtract(this.position, target.position).length();
            if (dist > target.radius + this.radius) return;
            const rawDmg = this._getHitDamage(simulation);
            this.dealDamageToTarget(target, rawDmg, this.owner, this._getHitLabel(), simulation);
            this._onHitEffects(target, simulation);
            this.isExpired = true;
        }

        dealDamageToTarget(target, rawDamage, source, label, simulation) {
            const final =
                target.actionContext?.onProjectileDamage?.(rawDamage, this, source, label, simulation, target) ??
                rawDamage;
            target.takeDamage(final, source, label);
        }

        _findTarget(simulation) {
            return simulation.getOpponent(this.owner);
        }
        _getHitDamage() {
            return 0;
        }
        _getHitLabel() {
            return "Hit";
        }
        _onHitEffects(target, simulation) {}
        _onExpired(simulation) {}
    };
}

// ── CombatEntity (물리 + 수명만, 투사체 로직 없음) ──────────────────────────

export class CombatEntity extends mixins([PhysicsBody, LifeSpan]) {
    constructor(position, velocity, radius) {
        super();
        this.pos = position;
        this.velocity = velocity;
        this.radius = radius;
        this.isExpired = false;
    }

    static renderLayer = RENDER_LAYERS.BACKGROUND;
    get renderLayer() {
        return this.constructor.renderLayer;
    }

    update() {}
    draw() {}
}

// ── Projectile (물리 + 수명 + 투사체 로직) ──────────────────────────────────

export class Projectile extends mixins([PhysicsBody, LifeSpan, ProjectileBehavior]) {
    constructor(owner, position, velocity, radius) {
        super();
        this.pos = position;
        this.velocity = velocity;
        this.radius = radius;
        this.isExpired = false;
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
    VAMPIRE: "vampire",
    GUNNER: "gunner",
    PHANTOM: "phantom",
    HERO: "hero"
});

const EVADE_IMPULSE_RESPONSE = 0.72;

/**
 * 볼을 목표 방향으로 조준.
 *
 * @param {import("./entities/index.js").BattleBall} ball
 * @param {{ position:Vector2 }} target
 * @param {number} delta
 * @param {{ turnRate?:number, instant?:boolean, persist?:boolean }} [opts]
 *   turnRate: 초당 회전 속도 (라디안, 기본 2.4)
 *   instant: true면 현재 방향 무시하고 즉시 목표 방향 (기본 false)
 *   persist: true면 forceHeading 지속 가능 (기본 false)
 */
export function steerBallToward(ball, target, delta, opts = {}) {
    const { turnRate = 2.4, instant = false, persist = false } = opts;
    const desired = Vector2.subtract(target.position, ball.position).normalize();

    let heading;
    if (instant) {
        heading = desired;
    } else {
        const current =
            ball.state.forcedHeading?.direction?.clone() ??
            (ball.velocity.length() > 0 ? ball.velocity.clone().normalize() : desired);
        const cross = current.x * desired.y - current.y * desired.x;
        const dot = current.x * desired.x + current.y * desired.y;
        const angle = Math.atan2(cross, dot);
        const turn = Math.max(-turnRate * delta, Math.min(turnRate * delta, angle));
        const nextAngle = Math.atan2(current.y, current.x) + turn;
        heading = Vector2.fromAngle(nextAngle, 1);
    }

    if (ball.state.forcedHeading && persist) {
        ball.state.forcedHeading.direction = heading;
        ball.state.forcedHeading.effect.elapsed = 0;
    } else if (persist) {
        ball.forceHeading(heading, 0.35);
    } else {
        ball.forceHeading(heading, 0.1);
    }
}

/**
 * 패시브 회피 — 상대가 일정 거리 이내로 접근하고, owner가 상대를 향해 이동 중일 때 발동.
 *
 * 회피 방향: 상대 진행 방향 기준 owner의 위치에 따라 좌/우로 회피.
 * forceHeading을 사용해 기본 이동 목표 방향을 잠깐 고정.
 *
 * @param {import("./entities/index.js").BattleBall} owner - 회피할 볼
 * @param {import("./entities/index.js").BattleBall} target - 접근하는 상대
 * @param {number} range - 회피 발동 거리
 * @param {number} strength - 회피 강도 (0~1)
 */
export function evadeTarget(owner, target, range, strength) {
    if (!target || target.flags.defeated || owner.state.swallowed || owner.state.wallSlam) return;

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
    const desiredSpeed = Math.max(owner.velocity.length(), owner.stats.baseSpeed * owner.getStatModifiers().speed);
    const desiredVelocity = blended.clone().scale(desiredSpeed);
    owner.applyImpulse(Vector2.subtract(desiredVelocity, owner.velocity).scale(EVADE_IMPULSE_RESPONSE * intensity));

    if (owner.state.forcedHeading) {
        owner.state.forcedHeading.direction = blended;
        owner.state.forcedHeading.effect.elapsed = 0;
    } else {
        owner.forceHeading(blended, 0.35);
    }
}

/**
 * 탄성 충돌 impulse를 두 엔티티에 적용한다.
 * CollisionEntity(mass, velocity, applyImpulse) 인터페이스를 가진 모든 객체에 사용 가능.
 *
 * @param {{ mass:number, velocity:Vector2, applyImpulse:(v:Vector2)=>void }} a
 * @param {{ mass:number, velocity:Vector2, applyImpulse:(v:Vector2)=>void }} b
 * @param {Vector2} normal - a에서 b로의 충돌 법선
 * @param {number} restitution - 반발 계수 (0~1)
 * @param {{ impactA?:number, impactB?:number, minApproachSpeed?:number }} [modifiers]
 * @returns {{ impulseMagnitude:number }} 계산된 impulse 크기
 */
export function applyCollisionImpulse(a, b, normal, restitution, modifiers = {}) {
    const impactA = modifiers.impactA ?? 1;
    const impactB = modifiers.impactB ?? 1;
    const minApproachSpeed = modifiers.minApproachSpeed ?? 0;
    const relativeVelocity = Vector2.subtract(b.velocity, a.velocity);
    let approachSpeed = relativeVelocity.dot(normal);
    // 분리 중이어도 최소 접근 속도가 설정되어 있으면 impulse 적용
    if (approachSpeed > 0 && minApproachSpeed <= 0) return { impulseMagnitude: 0 };
    if (Math.abs(approachSpeed) < minApproachSpeed) {
        approachSpeed = approachSpeed >= 0 ? minApproachSpeed : -minApproachSpeed;
    }

    const invMassA = 1 / Math.max(0.001, a.mass);
    const invMassB = 1 / Math.max(0.001, b.mass);
    const impulseMagnitude = (-(1 + restitution) * approachSpeed) / (invMassA + invMassB);

    a.applyImpulse(normal.clone().scale(-impulseMagnitude * invMassA * impactB));
    b.applyImpulse(normal.clone().scale(impulseMagnitude * invMassB * impactA));
    return { impulseMagnitude };
}
