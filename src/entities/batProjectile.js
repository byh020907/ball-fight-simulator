import { Projectile, Vector2 } from "../core.js";
import { BloodBatBurstEffect, BloodBiteEffect } from "../effects/index.js";

const BAT_RADIUS = 10;
const BAT_LIFE = 4.0;
const MAX_SPEED_MULT = 1.5;
const BASE_BITE_DAMAGE_MULTIPLIER = 0.2;
const REPEAT_BITE_DAMAGE_MULTIPLIER = 0.05;
const BITE_LIFESTEAL_RATE = 0.7;
const BITE_COOLDOWN = 1;
const BITE_RECOIL_SPEED = 240;
const HOMING_LOCK_DURATION = 0.15;
const LIFE_BURST_RADIUS = 65;
const LIFE_BURST_DAMAGE_MULTIPLIER = 0.05;
const EXPIRATION_WARNING_DURATION = 0.28;
const COMMAND_WAYPOINT_RADIUS = 44;
export const BAT_COMMAND_VISUAL_CONFIG = Object.freeze({
    color: "#ff6f91",
    outlineWidth: 2,
    waypointRadius: 3,
    trailLength: 14,
    trailInterval: 0.04,
    trailLifetime: 0.32,
    lineWidth: 3,
    dash: [6, 5]
});

// Boids weights (px/s/s accelerations, frame-rate independent)
const COHESION_WEIGHT = 5;
const ALIGNMENT_WEIGHT = 8;
const SEPARATION_WEIGHT = 30;
const SEPARATION_RADIUS = 24;
const TARGET_ATTRACTION_WEIGHT = 10;

// Flutter
const FLUTTER_FREQ = 28;
const FLUTTER_AMP = 6;

export class BatProjectile extends Projectile {
    constructor(owner, position, velocity, flock, options = {}) {
        super(owner, position, velocity, BAT_RADIUS);
        this.life = options.life ?? BAT_LIFE;
        this.maxLife = this.life;
        this.angle = Math.atan2(velocity.y, velocity.x);
        this.time = 0;
        this._flock = flock;
        this._ability = options.ability ?? null;
        this._repeatBite = Boolean(options.repeatBite);
        this._lifeBurst = Boolean(options.lifeBurst);
        this._lastBiteAt = new WeakMap();
        this._homingLockedUntil = 0;
        this._lifetimeBurstTriggered = false;
        this.commandGuided = Boolean(options.commandGuided);
        this.commandRoute = this.commandGuided ? (options.commandRoute ?? []).map((point) => ({ ...point })) : [];
        this.commandTerminalTargetId = options.commandTerminalTargetId ?? null;
        this.commandCycle = options.commandCycle ?? null;
        this.onSettled = typeof options.onSettled === "function" ? options.onSettled : null;
        this.commandTrail = [];
        this._commandRouteIndex = 0;
        this._commandTrailElapsed = 0;
        this._commandWaypointsReached = 0;
        this._commandBites = 0;
        this._commandTerminalBites = 0;
        this._commandActualDamage = 0;
        this._commandActualHealing = 0;
        this._settled = false;
    }

    get isHomingLocked() {
        return this.time < this._homingLockedUntil;
    }

    update(delta, simulation) {
        if (this.isExpired) return;
        this.time += delta;
        const target = this._getGuidanceTarget(simulation);

        if (!this.isHomingLocked) {
            this._applyGuidance(delta, target);
        }
        this._integrateFlutter(delta);
        this._recordCommandTrail(delta);
        simulation.keepEntityInsideArena(this);
        if (!this._lifecycleCheck(delta, simulation)) {
            simulation.spawnParticleBurst(this.position.clone(), "#441122", {
                count: 6,
                speed: 100,
                radiusMin: 1,
                radiusMax: 3,
                gravity: 200
            });
            return;
        }
        this.angle = Math.atan2(this.velocity.y, this.velocity.x);
        this._hitCheck(simulation);
    }

    _applyGuidance(delta, target) {
        const nextVelocity = this.velocity.clone().add(this._computeBoidsForce(delta));
        if (target && !target.flags.defeated) {
            const toTarget = Vector2.subtract(target.position, this.position).normalize();
            nextVelocity.add(toTarget.scale(TARGET_ATTRACTION_WEIGHT * 60 * delta));
        }
        const maxSpeed = this.owner.stats.baseSpeed * MAX_SPEED_MULT;
        if (nextVelocity.length() > maxSpeed) nextVelocity.normalize().scale(maxSpeed);
        this.applyImpulse(Vector2.subtract(nextVelocity, this.velocity));
    }

    _getGuidanceTarget(simulation) {
        if (this.commandGuided) {
            const point = this.commandRoute[this._commandRouteIndex];
            if (point) {
                const distance = Vector2.subtract(new Vector2(point.x, point.y), this.position).length();
                if (distance <= COMMAND_WAYPOINT_RADIUS) {
                    simulation.spawnPulse(new Vector2(point.x, point.y), "#ff315f");
                    this._commandWaypointsReached += 1;
                    this._commandRouteIndex += 1;
                }
            }
            const nextPoint = this.commandRoute[this._commandRouteIndex];
            if (nextPoint) return { position: new Vector2(nextPoint.x, nextPoint.y), flags: { defeated: false } };
            const terminal = simulation
                .getEnemiesOf(this.owner)
                .find((target) => target.id === this.commandTerminalTargetId && !target.flags.defeated);
            if (terminal) return terminal;
        }
        return this._findTarget(simulation);
    }

    _recordCommandTrail(delta) {
        if (!this.commandGuided) return;
        this._commandTrailElapsed += delta;
        for (const sample of this.commandTrail) sample.age += delta;
        this.commandTrail = this.commandTrail.filter((sample) => sample.age < BAT_COMMAND_VISUAL_CONFIG.trailLifetime);
        while (this._commandTrailElapsed >= BAT_COMMAND_VISUAL_CONFIG.trailInterval) {
            this._commandTrailElapsed -= BAT_COMMAND_VISUAL_CONFIG.trailInterval;
            this.commandTrail.push({ point: this.position.clone(), age: 0 });
            if (this.commandTrail.length > BAT_COMMAND_VISUAL_CONFIG.trailLength) this.commandTrail.shift();
        }
    }

    _integrateFlutter(delta) {
        const flutter = Math.sin(this.time * FLUTTER_FREQ) * FLUTTER_AMP * delta;
        this.position.add(this.velocity.clone().scale(delta));
        const perpendicular = new Vector2(-this.velocity.y, this.velocity.x).normalize();
        this.position.add(perpendicular.scale(flutter));
    }

    _computeBoidsForce(delta) {
        if (!this._flock || this._flock.length < 2) return new Vector2(0, 0);

        let cohesion = new Vector2(0, 0);
        let alignment = new Vector2(0, 0);
        let separation = new Vector2(0, 0);
        let neighborCount = 0;

        for (const other of this._flock) {
            if (other === this || other.isExpired || other.isExpired === undefined) continue;
            const difference = Vector2.subtract(other.position, this.position);
            const distance = difference.length();
            if (distance > 150) continue;

            neighborCount++;
            cohesion.add(other.position);
            alignment.add(other.velocity);

            if (distance < SEPARATION_RADIUS && distance > 0.1) {
                separation.subtract(
                    difference
                        .clone()
                        .normalize()
                        .scale(1 / distance)
                );
            }
        }

        if (neighborCount === 0) return new Vector2(0, 0);

        cohesion.scale(1 / neighborCount);
        cohesion.subtract(this.position);
        cohesion.normalize().scale(COHESION_WEIGHT * 60 * delta);

        alignment.scale(1 / neighborCount);
        alignment.normalize().scale(ALIGNMENT_WEIGHT * 60 * delta);

        separation.scale(SEPARATION_WEIGHT * 60 * delta);
        return Vector2.add(Vector2.add(cohesion, alignment), separation);
    }

    _hitCheck(simulation) {
        const targets = simulation.getEnemiesOf?.(this.owner) ?? [];
        for (const target of targets) {
            if (target.flags.defeated || !this._isTouching(target) || !this._canBite(target)) continue;
            this._bite(target, simulation);
            if (!this._repeatBite) {
                this.isExpired = true;
                this._settle();
                return;
            }
        }
    }

    _isTouching(target) {
        return Vector2.subtract(this.position, target.position).length() <= target.radius + this.radius;
    }

    _canBite(target) {
        return this.time - (this._lastBiteAt.get(target) ?? -Infinity) >= BITE_COOLDOWN;
    }

    _bite(target, simulation) {
        this._lastBiteAt.set(target, this.time);
        const normal = this._getContactNormal(target);
        const contactPoint = Vector2.add(target.position, normal.clone().scale(target.radius));
        const damageResult = this._dealBiteDamage(target, simulation);
        if (this.commandCycle) {
            this._commandBites += 1;
            this._commandTerminalBites += target.id === this.commandTerminalTargetId ? 1 : 0;
            this._commandActualDamage += damageResult.actualDamage;
            this._commandActualHealing += damageResult.healedAmount;
        }
        this._spawnBiteFeedback(contactPoint, normal, simulation);
        simulation.playSound("hit");
        simulation.addLog(
            `${this.owner.name}'s bat drains ${target.name} for ${damageResult.actualDamage} and heals ${damageResult.healedAmount}.`
        );

        if (damageResult.actualDamage > 0) {
            this._ability?.onBatBite(target, contactPoint, this);
        }
        if (!this._repeatBite) return;
        this.applyImpulse(normal.clone().scale(BITE_RECOIL_SPEED));
        this._homingLockedUntil = this.time + HOMING_LOCK_DURATION;
    }

    _getContactNormal(target) {
        const normal = Vector2.subtract(this.position, target.position);
        if (normal.length() > 0.001) return normal.normalize();
        if (this.velocity.length() > 0.001) return this.velocity.clone().normalize().scale(-1);
        return Vector2.subtract(this.owner.position, target.position).normalize();
    }

    _dealBiteDamage(target, simulation) {
        const rawDamage = this._getHitDamage();
        if (this._ability) {
            return this._ability.dealVampireDamage(target, rawDamage, this._getHitLabel(), { projectile: this });
        }
        const finalDamage =
            target.actionContext?.onProjectileDamage?.(
                rawDamage,
                this,
                this.owner,
                this._getHitLabel(),
                simulation,
                target
            ) ?? rawDamage;
        const { actualDamage } = target.takeDamage(finalDamage, this.owner, this._getHitLabel());
        const healedAmount = actualDamage > 0 ? this.owner.heal(actualDamage * BITE_LIFESTEAL_RATE) : 0;
        return { actualDamage, healedAmount };
    }

    _spawnBiteFeedback(contactPoint, normal, simulation) {
        simulation.entities.push(new BloodBiteEffect(contactPoint, normal));
        simulation.spawnParticleBurst(contactPoint, "#b5123f", {
            count: 5,
            speed: 90,
            radiusMin: 1,
            radiusMax: 2,
            gravity: 240,
            direction: normal,
            spread: Math.PI * 0.65
        });
    }

    _getHitDamage() {
        const multiplier = this._repeatBite ? REPEAT_BITE_DAMAGE_MULTIPLIER : BASE_BITE_DAMAGE_MULTIPLIER;
        return this.owner.stats.baseDamage * multiplier;
    }

    _getHitLabel() {
        return "Bat Bite";
    }

    _onExpired(simulation) {
        if (this._lifeBurst && !this._lifetimeBurstTriggered) {
            this._lifetimeBurstTriggered = true;
            const center = this.position.clone();
            for (const target of simulation.getEnemiesOf(this.owner)) {
                const distance = Vector2.subtract(target.position, center).length();
                if (distance > LIFE_BURST_RADIUS + target.radius) continue;
                const result = this._ability?.dealVampireDamage(
                    target,
                    this.owner.stats.baseDamage * LIFE_BURST_DAMAGE_MULTIPLIER,
                    "Bat Life Burst"
                );
                if (this.commandCycle && result) {
                    this._commandActualDamage += result.actualDamage;
                    this._commandActualHealing += result.healedAmount;
                }
            }
            simulation.entities.push(new BloodBatBurstEffect(center, LIFE_BURST_RADIUS));
            simulation.spawnParticleBurst(center, "#8d1235", {
                count: 9,
                speed: 125,
                radiusMin: 1,
                radiusMax: 3,
                gravity: 180
            });
        }
        this._settle();
    }

    _settle() {
        if (this._settled) return;
        this._settled = true;
        this.onSettled?.({
            commandGuided: this.commandGuided,
            bites: this._commandBites,
            terminalBites: this._commandTerminalBites,
            actualDamage: this._commandActualDamage,
            actualHealing: this._commandActualHealing,
            waypointsReached: this._commandWaypointsReached
        });
    }

    draw(ctx) {
        this._drawCommandTrail(ctx);
        this._drawRecoilTrail(ctx);
        this._drawBat(ctx);
        this._drawCommandMarker(ctx);
    }

    _drawCommandTrail(ctx) {
        if (!this.commandGuided) return;
        const config = BAT_COMMAND_VISUAL_CONFIG;
        ctx.save();
        if (this.commandTrail.length > 1) {
            ctx.strokeStyle = config.color;
            ctx.lineWidth = config.lineWidth;
            ctx.setLineDash(config.dash);
            for (const [index, sample] of this.commandTrail.slice(1).entries()) {
                const previous = this.commandTrail[index];
                ctx.globalAlpha = Math.max(0, 1 - previous.age / config.trailLifetime);
                ctx.beginPath();
                ctx.moveTo(previous.point.x, previous.point.y);
                ctx.lineTo(sample.point.x, sample.point.y);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    _drawCommandMarker(ctx) {
        if (!this.commandGuided) return;
        const config = BAT_COMMAND_VISUAL_CONFIG;
        ctx.save();
        ctx.setLineDash([]);
        ctx.strokeStyle = config.color;
        ctx.lineWidth = config.outlineWidth;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = config.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, config.waypointRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _drawRecoilTrail(ctx) {
        if (!this.isHomingLocked || this.velocity.length() <= 0) return;
        const direction = this.velocity.clone().normalize();
        ctx.save();
        ctx.strokeStyle = "rgba(181, 18, 63, 0.55)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(this.position.x - direction.x * 8, this.position.y - direction.y * 8);
        ctx.lineTo(this.position.x - direction.x * 32, this.position.y - direction.y * 32);
        ctx.stroke();
        ctx.restore();
    }

    _drawBat(ctx) {
        const expirationProgress = this._lifeBurst
            ? Math.max(0, Math.min(1, 1 - this.life / EXPIRATION_WARNING_DURATION))
            : 0;
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);
        const contraction = 1 - expirationProgress * 0.42;
        ctx.scale(contraction, contraction);
        this._drawExpirationMist(ctx, expirationProgress);
        this._drawWings(ctx, expirationProgress);
        this._drawBody(ctx, expirationProgress);
        this._drawEyes(ctx);
        ctx.restore();
    }

    _drawExpirationMist(ctx, progress) {
        if (progress <= 0) return;
        ctx.fillStyle = `rgba(151, 18, 52, ${progress * 0.35})`;
        ctx.beginPath();
        ctx.arc(0, 0, 12 + progress * 8, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawWings(ctx, expirationProgress) {
        const flap = Math.sin(this.time * 20);
        const wingScale = (0.5 + Math.abs(flap) * 0.5) * (1 - expirationProgress * 0.8);
        const wingLift = Math.sin(this.time * 20) * 3 * (1 - expirationProgress);
        ctx.fillStyle = "#331122";
        ctx.beginPath();
        ctx.moveTo(wingLift, -3);
        ctx.quadraticCurveTo(-wingScale * 12 - 3, -9 * wingScale - 3, -3, -16 * wingScale);
        ctx.quadraticCurveTo(wingLift + 2, -10 * wingScale, wingLift, -3);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-wingLift, 3);
        ctx.quadraticCurveTo(wingScale * 12 + 3, 9 * wingScale + 3, 3, 16 * wingScale);
        ctx.quadraticCurveTo(-wingLift - 2, 10 * wingScale, -wingLift, 3);
        ctx.fill();
    }

    _drawBody(ctx, expirationProgress) {
        ctx.fillStyle = expirationProgress > 0 ? "#7d1836" : "#442233";
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.owner.color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    _drawEyes(ctx) {
        const glow = Math.sin(this.time * 8) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 60, 80, ${glow})`;
        for (const y of [-1.8, 1.8]) {
            ctx.beginPath();
            ctx.arc(5.5, y, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = "#ffccdd";
        for (const y of [-1.8, 1.8]) {
            ctx.beginPath();
            ctx.arc(5.5, y, 0.9, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
