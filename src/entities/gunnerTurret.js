import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "../effects/effectVisibility.js";
import { tickTimedMap } from "../physics/index.js";
import { BulletProjectile } from "./bulletProjectile.js";

const TURRET_LIFETIME = 8;
const TURRET_FIRE_INTERVAL = 0.6;
const TURRET_AIM_DURATION = 0.12;
const TURRET_RADIUS = 24;

export class GunnerTurret extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(owner, position, { movementMode = "fixed", onDismiss = null } = {}) {
        super(position.clone(), new Vector2(), TURRET_RADIUS);
        this.id = `gunner-turret-${owner.id}`;
        this.name = `${owner.name} Turret`;
        this.owner = owner;
        this.simulation = owner.simulation;
        this.ownerId = owner.id;
        this.teamId = owner.teamId;
        this.onDismiss = onDismiss;
        this.movementMode = movementMode;
        this.isCombatTarget = true;
        this.life = TURRET_LIFETIME;
        this.maxLife = TURRET_LIFETIME;
        this.maxHp = Math.max(1, Math.round(owner.maxHp * 0.25));
        this.hp = this.maxHp;
        this.mass = Math.max(6, owner.mass * 0.45);
        this.flags = { defeated: false, destroyed: false };
        this.state = { swallowed: null };
        this.stats = { baseDamage: owner.stats.baseDamage * 0.3, baseSpeed: 80, baseDefense: 0 };
        this.actionContext = null;
        this.fireTimer = 0.24;
        this.aimTimer = 0;
        this.aimTarget = null;
        this.deployElapsed = 0;
        this.collisionCooldowns = new Map();
    }

    update(delta, simulation) {
        this.deployElapsed += delta;
        this._tickCollisionCooldowns(delta);
        if (this.movementMode === "mobile") this._moveTowardEnemy(delta, simulation);
        this.integrate(delta);
        simulation.keepEntityInsideArena(this, { resolveTerrain: true });
        this._handleFighterContacts(simulation);
        this._tickFire(delta, simulation);
        if (!this.tickLife(delta)) this.dismiss(simulation);
    }

    _moveTowardEnemy(delta, simulation) {
        const target = simulation.getNearestEnemy(this);
        if (!target) return;
        const direction = Vector2.subtract(target.position, this.position);
        if (direction.length() <= 0.001) return;
        const desiredVelocity = direction.normalize().scale(this.stats.baseSpeed);
        this.applyImpulse(Vector2.subtract(desiredVelocity, this.velocity).scale(Math.min(1, delta * 5)));
    }

    _tickCollisionCooldowns(delta) {
        tickTimedMap(this.collisionCooldowns, delta);
    }

    _handleFighterContacts(simulation) {
        for (const fighter of simulation.getEnemiesOf(this)) {
            if (fighter.isCombatTarget) continue;
            const offset = Vector2.subtract(fighter.position, this.position);
            const distance = offset.length();
            const overlap = this.radius + fighter.radius - distance;
            if (overlap <= 0) continue;
            const normal = distance > 0 ? offset.normalize() : new Vector2(1, 0);
            fighter.applyPositionCorrection(normal.clone().scale(overlap + 0.5));
            if (!this.collisionCooldowns.has(fighter.id)) {
                this.collisionCooldowns.set(fighter.id, 0.25);
                this.takeDamage(fighter.stats.baseDamage, fighter, "Turret Collision");
            }
            if (this.movementMode === "mobile") {
                this.applyImpulse(normal.clone().scale(-120));
            }
        }
    }

    _tickFire(delta, simulation) {
        if (this.aimTarget) {
            this.aimTimer -= delta;
            if (this.aimTimer > 0) return;
            const target = this.aimTarget.flags.defeated ? simulation.getNearestEnemy(this) : this.aimTarget;
            this.aimTarget = null;
            if (target) this._fireAt(target, simulation);
            this.fireTimer = TURRET_FIRE_INTERVAL - TURRET_AIM_DURATION;
            return;
        }
        this.fireTimer -= delta;
        if (this.fireTimer > 0 || this.flags.defeated) return;
        const target = simulation.getNearestEnemy(this);
        if (!target) return;
        this.aimTarget = target;
        this.aimTimer = TURRET_AIM_DURATION;
    }

    _fireAt(target, simulation) {
        const direction = Vector2.subtract(target.position, this.position);
        if (direction.length() <= 0.001) return;
        direction.normalize();
        const start = Vector2.add(this.position, direction.clone().scale(this.radius + 6));
        const bullet = new BulletProjectile(this, start, direction.scale(620), 1, false, 0, null, {
            canBounce: false,
            canCollect: false,
            canRefire: false,
            canStack: false,
            turretShot: true
        });
        simulation.entities.push(bullet);
        simulation.spawnSlash(start, Vector2.add(start, direction.clone().scale(36)), "#66f2e2");
        simulation.playSound("shoot", 0.55);
    }

    takeDamage(amount, source, label = "Hit") {
        if (this.flags.defeated) return { actualDamage: 0 };
        const hpBefore = this.hp;
        this.hp = Math.max(0, this.hp - Math.max(1, Math.round(amount)));
        const actualDamage = hpBefore - this.hp;
        const simulation = source?.simulation ?? this.owner.simulation;
        if (actualDamage > 0) simulation?.spawnDamageNumber?.(this.position.clone(), actualDamage, "#66f2e2");
        if (this.hp <= 0) this.dismiss(simulation, { destroyed: true });
        return { actualDamage };
    }

    dismiss(simulation, { destroyed = false } = {}) {
        if (this.flags.defeated) return;
        this.flags.defeated = true;
        this.flags.destroyed = destroyed;
        this.isExpired = true;
        this.onDismiss?.(this, { destroyed });
        simulation?.spawnParticleBurst?.(this.position.clone(), "#66f2e2", {
            count: destroyed ? 22 : 10,
            speed: destroyed ? 240 : 120,
            radiusMin: 2,
            radiusMax: 5,
            gravity: 520
        });
        if (destroyed) simulation?.playSound?.("hit", 0.8);
    }

    draw(ctx) {
        const deploy = Math.min(1, this.deployElapsed / 0.3);
        const remaining = Math.max(0, this.life / this.maxLife);
        const y = this.position.y + (1 - deploy) * 24;
        ctx.save();
        ctx.globalAlpha = deploy;
        ctx.fillStyle = "#25343b";
        ctx.strokeStyle = "#66f2e2";
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
        ctx.fillRect(this.position.x - 15, y - 15, 30, 30);
        ctx.strokeRect(this.position.x - 15, y - 15, 30, 30);
        ctx.fillStyle = "#ffd84d";
        ctx.fillRect(this.position.x - 3, y - 23, 6, 18);
        if (this.aimTarget && !this.aimTarget.flags.defeated) {
            ctx.strokeStyle = "#66f2e2";
            ctx.lineWidth = getVisibleLineWidth(ctx, "hairline", 2);
            ctx.beginPath();
            ctx.moveTo(this.position.x, y - 23);
            ctx.lineTo(this.aimTarget.position.x, this.aimTarget.position.y);
            ctx.stroke();
        }
        ctx.strokeStyle = "rgba(102, 242, 226, 0.82)";
        ctx.beginPath();
        ctx.arc(
            this.position.x,
            this.position.y,
            this.radius + 7,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * remaining
        );
        ctx.stroke();
        const barWidth = this.radius * 2;
        ctx.fillStyle = "#202020";
        ctx.fillRect(this.position.x - this.radius, y - 34, barWidth, 5);
        ctx.fillStyle = "#66f2e2";
        ctx.fillRect(this.position.x - this.radius, y - 34, barWidth * (this.hp / this.maxHp), 5);
        ctx.restore();
    }
}
