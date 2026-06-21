import { CombatEntity, RENDER_LAYERS, TimedEffect, Vector2 } from "./core.js";

export class SeedOrb extends CombatEntity {
    constructor(owner, position, velocity, life) {
        super(position, velocity, 14);
        this.owner = owner;
        this.life = life;
    }

    update(delta, simulation) {
        this.life -= delta;
        this.position.add(this.velocity.clone().scale(delta));
        simulation.keepEntityInsideArena(this);
        if (this.life <= 0) {
            this.isExpired = true;
        }

        for (const fighter of simulation.fighters.filter((candidate) => !candidate.isDefeated)) {
            const distance = Vector2.subtract(this.position, fighter.position).length();
            if (distance > this.radius + fighter.radius) {
                continue;
            }

            const target = simulation.getOpponent(this.owner);
            const dashDirection = target
                ? Vector2.subtract(target.position, this.owner.position).normalize()
                : this.velocity.clone().normalize();
            this.owner.startDash(dashDirection, {
                multiplier: 2.05,
                color: this.owner.color,
                collisionDamage: Math.round(this.owner.baseDamage * 1.3),
                collisionLabel: "Seed Dash",
                untilImpact: true,
                untilWall: true,
                maxDuration: 1.55
            });
            simulation.spawnSlash(
                this.owner.position.clone(),
                Vector2.add(this.owner.position, dashDirection.clone().scale(150)),
                this.owner.color
            );
            simulation.spawnPulse(this.position.clone(), this.owner.color);
            simulation.playSound("dash");
            simulation.addLog(`${fighter.name} catches a seed and triggers ${this.owner.name}'s dash.`);

            simulation.addSparkBurst(this.position.clone(), this.owner.color);
            this.isExpired = true;
            break;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.owner.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }
}

export class ArrowProjectile extends CombatEntity {
    constructor(owner, position, velocity) {
        super(position, velocity, 8);
        this.owner = owner;
        this.life = 1.55;
        this.angle = 0;
        this.syncFacingToVelocity();
    }

    syncFacingToVelocity() {
        if (this.velocity.length() > 0) {
            this.angle = Math.atan2(this.velocity.y, this.velocity.x);
        }
    }

    update(delta, simulation) {
        this.life -= delta;
        this.position.add(this.velocity.clone().scale(delta));
        simulation.keepEntityInsideArena(this);
        this.syncFacingToVelocity();
        if (this.life <= 0) {
            this.isExpired = true;
            this._abilityRef?.onArrowResult?.(false);
        }

        const target = simulation.getOpponent(this.owner);
        if (!target || target.isDefeated) {
            return;
        }

        const distance = Vector2.subtract(this.position, target.position).length();
        if (distance <= target.radius + this.radius) {
            target.takeDamage(Math.round(this.owner.baseDamage * 1.4), this.owner, "Arrow Shot");
            target.velocity.add(this.velocity.clone().normalize().scale(160));
            simulation.playSound("hit");
            simulation.spawnSlash(
                this.position.clone(),
                Vector2.add(this.position, this.velocity.clone().normalize().scale(70)),
                this.owner.color
            );
            simulation.addSparkBurst(this.position.clone(), this.owner.color);
            simulation.addLog(`${this.owner.name}'s arrow pierces ${target.name}.`);
            this.isExpired = true;
            this._abilityRef?.onArrowResult?.(true);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.owner.color;
        ctx.fillRect(-20, -4, 40, 8);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(6, -2, 14, 4);
        ctx.restore();
    }
}

export class Grenade extends CombatEntity {
    constructor(owner, targetPosition, fuseTime = 1.08) {
        const start = owner.position.clone();
        const safeFuse = Math.max(0.32, fuseTime);
        const drift = Vector2.subtract(targetPosition, start).scale(1 / safeFuse);
        super(start, drift, 12);
        this.owner = owner;
        this.targetPosition = targetPosition;
        this.timer = safeFuse;
        this.maxTimer = this.timer;
        this.explosionRadius = 150;
        this.innerRadius = 62;
        this.bounces = 0;
        this.maxBounces = 2;
    }

    update(delta, simulation) {
        this.timer -= delta;
        this.position.add(this.velocity.clone().scale(delta));

        // Wall bounce (공용 keepEntityInsideArena 사용, 최대 2회)
        if (this.bounces < this.maxBounces) {
            const bx = this.position.x,
                by = this.position.y;
            simulation.keepEntityInsideArena(this);
            if (this.position.x !== bx || this.position.y !== by) {
                this.bounces++;
                simulation.playSound("bounce", 0.5);
            }
        }

        if (this.timer > 0) {
            return;
        }

        const target = simulation.getOpponent(this.owner);
        let hit = false;
        if (target && !target.isDefeated) {
            const distance = Vector2.subtract(this.position, target.position).length();
            if (distance <= this.explosionRadius) {
                hit = true;
                const edgeProgress = Math.max(
                    0,
                    Math.min(1, (distance - this.innerRadius) / (this.explosionRadius - this.innerRadius))
                );
                const damage = Math.round(this.owner.baseDamage * (2.0 - edgeProgress * 1.0));
                const knockback = 350 - edgeProgress * 140;
                target.takeDamage(damage, this.owner, "Grenade");
                target.velocity.add(Vector2.subtract(target.position, this.position).normalize().scale(knockback));
            }
        }

        simulation.spawnExplosion(this.position.clone(), this.owner.color);
        simulation.playSound("explosion");
        this.owner.ability?.onGrenadeResult?.(hit);
        simulation.addLog(`${this.owner.name}'s grenade explodes.`);
        this.isExpired = true;
    }

    draw(ctx) {
        const charge = 1 - Math.max(0, this.timer / this.maxTimer);
        ctx.save();
        ctx.strokeStyle = this.owner.color;
        ctx.lineWidth = 5;
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.explosionRadius * (0.72 + charge * 0.28), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = this.owner.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

export class BattleBall {
    constructor(spec, position) {
        this.id = spec.id;
        this.name = spec.name;
        this.title = spec.title;
        this.description = spec.description;
        this.color = spec.color;
        this.face = spec.face ?? spec.id;
        this.maxHp = spec.stats.hp;
        this.hp = spec.stats.hp;
        this.baseDamage = spec.stats.damage;
        this.baseDefense = spec.stats.defense;
        this.baseSpeed = spec.stats.speed;
        this.baseRadius = spec.stats.radius;
        this.radius = spec.stats.radius;
        this.mass = spec.stats.mass;
        this.position = position;
        this.velocity = Vector2.fromAngle(Math.random() * Math.PI * 2, 120 + Math.random() * 90);
        this.slowEffect = null;
        this.speedBoost = null;
        this.forcedHeading = null;
        this.dashState = null;
        this.swallowedState = null;
        this.wallSlamState = null;
        this.flags = {};
        this.ability = null;
        this.isDefeated = false;
        this.isDestroyed = false;
        this.spinRotation = 0;
        this.statAllocation = spec.statAllocation ?? null;
    }

    get renderLayer() {
        return RENDER_LAYERS.FIGHTER;
    }

    bindAbility(ability) {
        this.ability = ability;
    }

    getStatModifiers() {
        return this.ability ? this.ability.getStatModifiers() : { speed: 1, damage: 1, defense: 1, impact: 1 };
    }

    setSpeedBoost(duration, multiplier, color = this.color) {
        this.speedBoost = { effect: new TimedEffect(duration), multiplier, color };
    }

    forceHeading(direction, duration) {
        this.forcedHeading = { effect: new TimedEffect(duration), direction: direction.clone().normalize() };
    }

    startDash(direction, config = {}) {
        const duration = config.maxDuration ?? 1.4;
        const normalized = direction.clone().normalize();
        this.dashState = {
            color: config.color ?? this.color,
            multiplier: config.multiplier ?? 1.8,
            speedOverride: config.speedOverride ?? null,
            collisionDamage: config.collisionDamage ?? 0,
            collisionLabel: config.collisionLabel ?? "Dash",
            collisionSlow: config.collisionSlow ?? null,
            untilImpact: Boolean(config.untilImpact),
            untilWall: Boolean(config.untilWall),
            effect: new TimedEffect(duration)
        };
        this.forcedHeading =
            config.lockHeading === false ? null : { effect: new TimedEffect(duration), direction: normalized.clone() };
        const dashSpeed = this.dashState.speedOverride ?? this.baseSpeed * this.dashState.multiplier;
        this.velocity = normalized.clone().scale(dashSpeed);
        this.speedBoost = {
            effect: new TimedEffect(duration),
            multiplier: this.dashState.multiplier,
            color: this.dashState.color,
            speedOverride: this.dashState.speedOverride,
            showRing: config.showSpeedRing !== false
        };
    }

    clearDash() {
        this.dashState = null;
        this.forcedHeading = null;
        this.speedBoost = null;
    }

    freezeForResult() {
        this.velocity = new Vector2();
        this.clearDash();
        this.slowEffect = null;
        this.swallowedState = null;
        this.wallSlamState = null;
    }

    destroyForResult() {
        this.freezeForResult();
        this.isDefeated = true;
        this.isDestroyed = true;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    getAbilityUiState() {
        return this.ability?.getUiState?.() ?? { label: "Passive", progress: 1 };
    }

    update(delta, simulation) {
        if (this.isDefeated) {
            return;
        }

        if (this.swallowedState) {
            this.position = this.swallowedState.owner.position.clone();
            this.velocity = new Vector2();
            return;
        }

        const target = simulation.getOpponent(this);

        if (this.slowEffect) {
            this.slowEffect.tick(delta);
            if (this.slowEffect.finished) {
                this.slowEffect = null;
            }
        }

        if (this.speedBoost) {
            this.speedBoost.effect.tick(delta);
            if (this.speedBoost.effect.finished) {
                this.speedBoost = null;
            }
        }

        if (this.forcedHeading) {
            this.forcedHeading.effect.tick(delta);
            if (this.forcedHeading.effect.finished) {
                this.forcedHeading = null;
            }
        }

        if (this.dashState) {
            this.dashState.effect.tick(delta);
            if (this.dashState.effect.finished) {
                this.clearDash();
            }
        }

        if (this.wallSlamState) {
            this.wallSlamState.effect.tick(delta);
            this.wallSlamState.cooldown = Math.max(0, this.wallSlamState.cooldown - delta);
            const spinDirection = this.velocity.x >= 0 ? 1 : -1;
            this.spinRotation +=
                spinDirection * Math.max(8, this.velocity.length() / Math.max(1, this.radius)) * delta * 1.55;
            if (this.wallSlamState.effect.finished) {
                this.wallSlamState = null;
            }
        }

        this.ability?.update(delta, target);
        const radiusScale = this.ability?.getRadiusScale?.() ?? 1;
        this.radius = this.baseRadius * radiusScale;
        const modifiers = this.getStatModifiers();
        const slowMultiplier = this.slowEffect ? this.slowEffect.amount : 1;
        const boostMultiplier = this.speedBoost ? this.speedBoost.multiplier : 1;
        const currentDirection =
            this.velocity.length() > 0
                ? this.velocity.clone().normalize()
                : Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
        const direction = this.forcedHeading ? this.forcedHeading.direction.clone() : currentDirection;

        const speedLimit =
            this.dashState?.speedOverride ??
            this.speedBoost?.speedOverride ??
            this.baseSpeed * modifiers.speed * slowMultiplier * boostMultiplier * simulation.getSpeedMultiplier();
        this.velocity = direction.scale(speedLimit);

        this.position.add(this.velocity.clone().scale(delta));
        simulation.keepInsideArena(this);
    }

    applySlow(duration, amount) {
        this.slowEffect = new TimedEffect(duration);
        this.slowEffect.amount = amount;
    }

    takeDamage(amount, source, label = "Hit") {
        if (this.isDefeated) {
            return;
        }

        const abilityDefMult = this.getStatModifiers().defense;
        const totalDefense = Math.round(this.baseDefense * abilityDefMult);
        const actual = Math.max(1, Math.round(amount - totalDefense));
        this.hp = Math.max(0, this.hp - actual);
        if (label !== "Wall Slam") {
            source?.simulation?.shakeScreen?.(0.16, Math.min(18, 7 + actual * 0.55));
        }
        if (label !== "Crash") {
            source?.simulation?.playSound?.("hit", Math.min(1.8, 0.7 + actual / 18));
        }
        if (actual >= 1 && source?.simulation) {
            source.simulation.spawnDamageNumber(this.position.clone(), Math.round(actual), "#ff3333");
        }
        if (actual >= 10) {
            source?.simulation?.addLog?.(`${label} lands on ${this.name} for ${Math.round(actual)} damage.`);
        }
        if (this.hp <= 0) {
            this.isDefeated = true;
        }
    }

    draw(ctx) {
        if (this.isDestroyed || this.swallowedState) {
            return;
        }

        ctx.save();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#202020";
        ctx.lineWidth = Math.max(3, this.radius * 0.07);
        ctx.stroke();

        this.drawFace(ctx, this.wallSlamState ? this.spinRotation : 0);

        this.ability?.draw?.(ctx);

        if (this.speedBoost && this.speedBoost.showRing !== false) {
            ctx.strokeStyle = this.speedBoost.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.radius + 18, 0, Math.PI * 2);
            ctx.stroke();
        }

        this._drawNameplate(ctx);

        ctx.restore();
    }

    _drawNameplate(ctx) {
        if (this.isDestroyed) return;
        const y = this.position.y + this.radius + 18;
        ctx.save();
        ctx.font = "700 13px Bahnschrift, Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#444444";
        ctx.fillText(this.name, this.position.x, y);
        ctx.restore();
    }

    drawFace(ctx, rotation = 0) {
        const r = this.radius;
        const x = this.position.x;
        const y = this.position.y;
        const time = performance.now() / 1000;
        const bob = Math.sin(time * 5 + x * 0.01) * r * 0.025;

        ctx.save();
        ctx.translate(x, y + bob);
        ctx.rotate(rotation);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#202020";
        ctx.fillStyle = "#202020";
        ctx.lineWidth = Math.max(3, r * 0.075);

        if (!this.ability?.drawFace?.(ctx, rotation, this)) {
            this._drawDefaultFace(ctx);
        }

        ctx.restore();
    }

    _drawDefaultFace(ctx) {
        const r = this.radius;
        const time = performance.now() / 1000;
        const blink = Math.sin(time * 2.6 + this.position.y * 0.01) > 0.93 ? 0.22 : 1;

        const dotEye = (ex, ey, size = 0.055) => {
            ctx.beginPath();
            ctx.ellipse(ex * r, ey * r, size * r, size * r * blink, 0, 0, Math.PI * 2);
            ctx.fill();
        };
        const arc = (cx, cy, radius, start, end) => {
            ctx.beginPath();
            ctx.arc(cx * r, cy * r, radius * r, start, end);
            ctx.stroke();
        };

        dotEye(-0.22, -0.08, 0.052);
        dotEye(0.22, -0.08, 0.052);
        arc(0, 0.16, 0.2, 0.1, Math.PI - 0.1);
    }
}
