import { Projectile, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "../game-kit/canvas/effectVisibility.js";

export const GUNNER_COMMAND_VISUAL_CONFIG = Object.freeze({
    color: "#8df7ff",
    trailLength: 12,
    lineWidth: 3,
    dash: Object.freeze([6, 4]),
    ringPadding: 5
});

export class BulletProjectile extends Projectile {
    constructor(
        owner,
        position,
        velocity,
        damageMult = 0.5,
        isFinisher = false,
        cdReduction = 0,
        sourceAbility = null,
        options = {}
    ) {
        super(owner, position, velocity, 4);
        this.life = 3.0;
        this.angle = Math.atan2(velocity.y, velocity.x);
        this.damageMult = damageMult;
        this.isFinisher = isFinisher;
        this.cdReduction = cdReduction;
        this.sourceAbility = sourceAbility;
        this.canBounce = options.canBounce ?? true;
        this.canCollect = options.canCollect ?? true;
        this.canRefire = options.canRefire ?? true;
        this.canStack = options.canStack ?? true;
        this.retargetAfterBounce = options.retargetAfterBounce ?? false;
        this.retargetConsumed = false;
        this.isRefire = options.isRefire ?? false;
        this.turretShot = options.turretShot ?? false;
        this.commandGuided = options.commandGuided === true;
        this.commandCycle = options.commandCycle ?? null;
        this.commandTerminalTargetId = options.commandTerminalTargetId ?? null;
        this.commandShotIndex = options.commandShotIndex ?? null;
        this.onSettled = typeof options.onSettled === "function" ? options.onSettled : null;
        this.commandTrail = this.commandGuided ? [this.position.clone()] : [];
        this._settled = false;
        this.age = 0;
        this._trail = [];
        this._bounceCount = 0;
        if (isFinisher) this.radius = 7;
    }

    update(delta, simulation) {
        this.age += delta;
        this.integrate(delta);
        const unclamped = this.position.clone();
        simulation.keepEntityInsideArena(this);
        const bounced = this.position.x !== unclamped.x || this.position.y !== unclamped.y;
        if (bounced) {
            this._bounceCount++;
            if (!this.canBounce) {
                this._settle({ collected: false, hit: false, targetId: null, actualDamage: 0 });
                this.isExpired = true;
                return;
            }
            if (this.retargetAfterBounce && !this.retargetConsumed) {
                this._retargetAfterRicochet(simulation);
            }
            simulation.addSparkBurst(this.position.clone(), this.isRefire ? "#66f2e2" : "#ffdd44");
            simulation.playSound("hit", 0.3);
        }
        this._trail.push(this.position.clone());
        if (this._trail.length > 8) this._trail.shift();
        if (!this._lifecycleCheck(delta, simulation)) return;
        this.angle = Math.atan2(this.velocity.y, this.velocity.x);
        this._hitCheck(simulation);
        if (!this.isExpired && this.age >= 0.08) this._ownerCollectCheck(simulation);
        if (this.commandGuided) this._recordCommandTrail();
    }

    _retargetAfterRicochet(simulation) {
        const terminal = simulation
            .getEnemiesOf(this.owner)
            .find((candidate) => candidate.id === this.commandTerminalTargetId && !candidate.flags.defeated);
        const target =
            terminal ??
            simulation.getEnemiesOf(this.owner).reduce((nearest, candidate) => {
                if (!nearest) return candidate;
                const candidateDistance = Vector2.subtract(candidate.position, this.position).length();
                const nearestDistance = Vector2.subtract(nearest.position, this.position).length();
                return candidateDistance < nearestDistance ? candidate : nearest;
            }, null);
        this.retargetConsumed = true;
        this.canBounce = false;
        if (!target) return;
        const direction = Vector2.subtract(target.position, this.position);
        if (direction.length() <= 0.001) return;
        const desiredVelocity = direction.normalize().scale(this.velocity.length());
        this.applyImpulse(Vector2.subtract(desiredVelocity, this.velocity));
        const trailDirection = direction.clone().normalize();
        simulation.spawnSlash(this.position.clone(), Vector2.add(this.position, trailDirection.scale(48)), "#66f2e2");
    }

    _ownerCollectCheck(simulation) {
        const dist = Vector2.subtract(this.position, this.owner.position).length();
        if (dist > this.owner.radius + this.radius) return;
        if (!this.canCollect) {
            this._settle({ collected: false, hit: false, targetId: null, actualDamage: 0 });
            this.isExpired = true;
            return;
        }
        const ability = this.sourceAbility;
        if (ability && typeof ability.reduceCooldown === "function") {
            ability.reduceCooldown(this.cdReduction);
            simulation.spawnActionText(this.owner.position.clone(), `CD -${this.cdReduction.toFixed(3)}s`, "#44ddff");
            simulation.addSparkBurst(this.position.clone(), "#44ddff");
            simulation.playSound("shoot", 0.4);
        }
        ability?.onBulletCollected?.(this, simulation);
        this._settle({ collected: true, hit: false, targetId: null, actualDamage: 0 });
        this.isExpired = true;
    }

    _getHitDamage() {
        return Math.round(this.owner.stats.baseDamage * this.damageMult);
    }

    _getHitLabel() {
        if (this.turretShot) return "Turret Shot";
        if (this.isRefire) return "Ricochet Reload";
        return this.isFinisher ? "Finisher" : "Bullet";
    }

    _projectileHitCheck(simulation) {
        const target = this._findTarget(simulation);
        if (!target || target.flags.defeated) return;
        const distance = Vector2.subtract(this.position, target.position).length();
        if (distance > target.radius + this.radius) return;
        const hpBefore = target.hp;
        this.dealDamageToTarget(target, this._getHitDamage(), this.owner, this._getHitLabel(), simulation);
        const actualDamage = Math.max(0, hpBefore - target.hp);
        this._onHitEffects(target, simulation, actualDamage);
        this.isExpired = true;
    }

    _onHitEffects(target, simulation, actualDamage) {
        simulation.spawnSlash(
            this.position.clone(),
            Vector2.add(
                this.position,
                this.velocity
                    .clone()
                    .normalize()
                    .scale(this.isFinisher ? 60 : 30)
            ),
            this.isFinisher ? "#ff4488" : "#ffee88"
        );
        if (this.isFinisher) {
            simulation.spawnExplosion(this.position.clone(), "#ff4488");
            simulation.spawnPulse(this.position.clone(), "#ff4488");
            simulation.shakeScreen(0.15, 8);
        } else {
            simulation.spawnExplosion(this.position.clone(), "#ffdd44");
        }
        if (this.commandGuided) simulation.spawnPulse(this.position.clone(), GUNNER_COMMAND_VISUAL_CONFIG.color);
        simulation.playSound("hit", this.isFinisher ? 0.9 : 0.5);
        this._settle({ collected: false, hit: true, targetId: target.id, actualDamage });
    }

    _onExpired() {
        this._settle({ collected: false, hit: false, targetId: null, actualDamage: 0 });
    }

    _recordCommandTrail() {
        this.commandTrail.push(this.position.clone());
        if (this.commandTrail.length > GUNNER_COMMAND_VISUAL_CONFIG.trailLength) this.commandTrail.shift();
    }

    _settle(outcome) {
        if (this._settled) return;
        this._settled = true;
        this.onSettled?.({
            ...outcome,
            isFinisher: this.isFinisher,
            isRefire: this.isRefire,
            commandShotIndex: this.commandShotIndex
        });
    }

    draw(ctx) {
        if (this.commandGuided) this._drawCommandTracer(ctx);
        if (this._trail.length > 1) {
            const trailColor = this.isRefire ? "#66f2e2" : this.isFinisher ? "#ff4488" : "#ffdd44";
            for (let index = 0; index < this._trail.length - 1; index++) {
                const alpha = (index / this._trail.length) * (this.isFinisher ? 0.6 : 0.4);
                ctx.fillStyle = `rgba(${this.isRefire ? "102, 242, 226" : this.isFinisher ? "255, 68, 136" : "255, 220, 68"}, ${alpha})`;
                ctx.beginPath();
                ctx.arc(this._trail[index].x, this._trail[index].y, this.radius * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);

        // Outer glow for finisher
        if (this.isFinisher) {
            ctx.fillStyle = "rgba(255, 68, 136, 0.25)";
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = this.isRefire ? "#66f2e2" : this.isFinisher ? "#ff4488" : "#ffdd44";
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(-1, -1, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _drawCommandTracer(ctx) {
        const config = GUNNER_COMMAND_VISUAL_CONFIG;
        if (this.commandTrail.length > 1) {
            ctx.save();
            ctx.strokeStyle = config.color;
            ctx.lineWidth = getVisibleLineWidth(ctx, "standard", config.lineWidth);
            ctx.setLineDash(config.dash);
            ctx.beginPath();
            this.commandTrail.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.restore();
        }
        ctx.save();
        ctx.strokeStyle = config.color;
        ctx.lineWidth = getVisibleLineWidth(ctx, "standard", config.lineWidth);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius + config.ringPadding, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
