import { CombatEntity, Projectile, RENDER_LAYERS, TimedEffect, Vector2 } from "./core.js";
import { ActionContext } from "./click-actions.js";
import { DashEffect } from "./combat-effects.js";

export class SeedOrb extends Projectile {
    constructor(owner, position, velocity, life) {
        super(owner, position, velocity, 14);
        this.life = life;
    }

    update(delta, simulation) {
        this.life -= delta;
        this.position.add(this.velocity.clone().scale(delta));
        simulation.keepEntityInsideArena(this);
        if (this.life <= 0) {
            this.isExpired = true;
        }

        // hit 체크 — 템플릿 메서드 사용
        this._projectileHitCheck(simulation);
    }

    /** @returns {import("./core.js").CombatEntity} */
    _findTarget(simulation) {
        return simulation.getOpponent(this.owner);
    }

    _getHitDamage() {
        return 0;
    }

    _getHitLabel() {
        return "";
    }

    _onHitEffects(target, simulation) {
        const dashDirection = target
            ? Vector2.subtract(target.position, this.owner.position).normalize()
            : this.velocity.clone().normalize();
        this.owner.setMovementEffect(
            new DashEffect({
                duration: 1.55,
                multiplier: 2.05,
                color: this.owner.color,
                collisionDamage: Math.round(this.owner.baseDamage * 1.3),
                collisionLabel: "Seed Dash",
                untilImpact: true,
                untilWall: true
            })
        );
        this.owner.forceHeading(dashDirection, 1.55);
        this.owner.velocity = dashDirection.clone().scale(this.owner.baseSpeed * 2.05);
        simulation.spawnSlash(
            this.owner.position.clone(),
            Vector2.add(this.owner.position, dashDirection.clone().scale(150)),
            this.owner.color
        );
        simulation.spawnPulse(this.position.clone(), this.owner.color);
        simulation.playSound("dash");
        simulation.addLog(`${target?.name ?? "Someone"} catches a seed and triggers ${this.owner.name}'s dash.`);
        simulation.addSparkBurst(this.position.clone(), this.owner.color);
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

export class ArrowProjectile extends Projectile {
    constructor(owner, position, velocity) {
        super(owner, position, velocity, 8);
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
        this.updateProjectile(delta, simulation);
        this.syncFacingToVelocity();
    }

    _findTarget(simulation) {
        return simulation.getOpponent(this.owner);
    }

    _getHitDamage() {
        return Math.round(this.owner.baseDamage * 1.4);
    }

    _getHitLabel() {
        return "Arrow Shot";
    }

    _onHitEffects(target, simulation) {
        target.applyKnockback(this.velocity.clone().scale(0.6), 0.2);
        simulation.playSound("hit");
        simulation.spawnSlash(
            this.position.clone(),
            Vector2.add(this.position, this.velocity.clone().normalize().scale(70)),
            this.owner.color
        );
        simulation.addSparkBurst(this.position.clone(), this.owner.color);
        simulation.addLog(`${this.owner.name}'s arrow pierces ${target.name}.`);
        this._abilityRef?.onArrowResult?.(true);
    }

    _onExpired(simulation) {
        this._abilityRef?.onArrowResult?.(false);
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

export class OrbitProjectile extends Projectile {
    constructor(owner, position, direction, size) {
        super(owner, position, new Vector2(0, 0), 11);
        this.dir = direction.clone().normalize();
        this.life = 1.2;
        this.angle = Math.atan2(this.dir.y, this.dir.x);
        this.size = size;
        this.elapsed = 0;
        this.accelDuration = 1;
        this.maxSpeed = owner.baseSpeed * 5;
    }

    update(delta, simulation) {
        this.elapsed += delta;
        this.life -= delta;

        // Accelerate from 0 to maxSpeed over accelDuration
        const progress = Math.min(1, this.elapsed / this.accelDuration);
        const speed = progress * this.maxSpeed;
        this.velocity = this.dir.clone().scale(speed);

        this.position.add(this.velocity.clone().scale(delta));

        // Bounce off walls, update direction after bounce
        const bx = this.position.x,
            by = this.position.y;
        simulation.keepEntityInsideArena(this);
        if (this.position.x !== bx || this.position.y !== by) {
            this.dir = this.velocity.clone().normalize();
            this.angle = Math.atan2(this.dir.y, this.dir.x);
        }

        if (this.life <= 0) {
            this.isExpired = true;
        }

        // Hit check (공통 템플릿 사용)
        this._projectileHitCheck(simulation);
    }

    _findTarget(simulation) {
        return simulation.getOpponent(this.owner);
    }

    _getHitDamage() {
        return Math.round(this.owner.baseDamage * 0.8);
    }

    _getHitLabel() {
        return "Orbit Shot";
    }

    _onHitEffects(target, simulation) {
        target.applyKnockback(this.velocity.clone().scale(0.4), 0.15);
        simulation.spawnSlash(this.position.clone(), target.position.clone(), this.owner.color);
        simulation.addSparkBurst(this.position.clone(), this.owner.color);
        simulation.playSound("orbit");
        simulation.addLog(`${this.owner.name}'s orbit shard strikes ${target.name}.`);
    }

    draw(ctx) {
        const s = this.size ?? 16;
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = "#ffea00";
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = 3;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.restore();
    }
}

export class Grenade extends Projectile {
    constructor(owner, targetPosition, fuseTime = 1.08) {
        const start = owner.position.clone();
        const safeFuse = Math.max(0.32, fuseTime);
        const drift = Vector2.subtract(targetPosition, start).scale(1 / safeFuse);
        super(owner, start, drift, 12);
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
                const raw = Math.round(this.owner.baseDamage * (4.0 - edgeProgress * 2.0));
                this.dealDamageToTarget(target, raw, this.owner, "Grenade", simulation);
                const kbDir = Vector2.subtract(target.position, this.position).normalize();
                target.applyKnockback(kbDir.scale(400), 0.35);
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
        this.movementEffect = null;
        this.swallowedState = null;
        this.wallSlamState = null;
        this.flags = {};
        this.bounced = false;
        this.ability = null;
        this.isDefeated = false;
        this.isDestroyed = false;
        this.spinRotation = 0;
        this.statAllocation = spec.statAllocation ?? null;

        // ── 클릭 액션 시스템 (Action이 등록한 런타임 effect 저장소) ──
        this.actionContext = new ActionContext();
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

    forceHeading(direction, duration, overrideVelocity = null) {
        this.forcedHeading = {
            effect: new TimedEffect(duration),
            direction: direction.clone().normalize(),
            overrideVelocity
        };
    }

    /** 속도 벡터 기반 넉백 (forceHeading에 velocity 오버라이드) */
    applyKnockback(velocity, duration) {
        this.forceHeading(velocity, duration, velocity.clone());
    }

    /** DashEffect 등록 (Ability/Projectile이 생성) */
    setMovementEffect(effect) {
        this.movementEffect = effect;
    }

    clearDash() {
        this.movementEffect = null;
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

    // ── 클릭 액션 데이터 인터페이스 ──

    getAbilityUiState() {
        return this.ability?.getUiState?.() ?? { label: "Passive", progress: 1 };
    }

    /** 매 update 프레임마다 초기화할 상태 */
    initState() {
        this.bounced = false;
    }

    update(delta, simulation) {
        if (this.isDefeated) return;

        this.initState();

        if (this.swallowedState) {
            this.position = this.swallowedState.owner.position.clone();
            this.velocity = new Vector2();
            return;
        }

        const target = simulation.getOpponent(this);
        this._tickTimers(delta);

        this.ability?.update(delta, target);
        this.radius = this.baseRadius * (this.ability?.getRadiusScale?.() ?? 1);
        this.velocity = this._computeVelocity(simulation);

        this.position.add(this.velocity.clone().scale(delta));
        simulation.keepInsideArena(this);
        if (this.forcedHeading?.overrideVelocity && this.bounced) this.forcedHeading = null;
    }

    /** 모든 프레임 기반 타이머를 한 번에 갱신 */
    _tickTimers(delta) {
        const tick = (effect, onFinish) => {
            if (!effect) return;
            effect.tick(delta);
            if (effect.finished) onFinish();
        };

        tick(this.slowEffect, () => (this.slowEffect = null));
        tick(this.speedBoost?.effect, () => (this.speedBoost = null));
        tick(this.forcedHeading?.effect, () => (this.forcedHeading = null));

        if (this.movementEffect) {
            this.movementEffect.tick(this, delta);
            if (this.movementEffect.expired) this.movementEffect = null;
        }

        if (this.wallSlamState) {
            if (this.wallSlamState.tick(this, delta)) {
                this.wallSlamState = null;
            }
        }

        this.actionContext.tickTimers(delta);
    }

    /** 속도 계산 — 이동 보정치, 강제 방향, 넉백을 종합 */
    _computeVelocity(simulation) {
        const modifiers = this.getStatModifiers();
        const slowMult = this.slowEffect ? this.slowEffect.amount : 1;
        const boostMult = this.speedBoost ? this.speedBoost.multiplier : 1;
        const movementSpeed = this.movementEffect?.getSpeed(this);
        const currentDir =
            this.velocity.length() > 0
                ? this.velocity.clone().normalize()
                : Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
        const direction = this.forcedHeading ? this.forcedHeading.direction.clone() : currentDir;
        const knockbackVel = this.forcedHeading?.overrideVelocity;

        return (
            knockbackVel ??
            direction.scale(
                movementSpeed ??
                    this.speedBoost?.speedOverride ??
                    this.baseSpeed * modifiers.speed * slowMult * boostMult * simulation.getSpeedMultiplier(this)
            )
        );
    }

    applySlow(duration, amount) {
        this.slowEffect = new TimedEffect(duration);
        this.slowEffect.amount = amount;
    }

    takeDamage(amount, source, label = "Hit") {
        if (this.isDefeated) {
            return;
        }

        // ClickAction이 등록한 effect를 ActionContext가 전달한다.
        amount = this.actionContext.onDamageTaken(amount, source, label);

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

        if (this.movementEffect?.showRing) {
            ctx.strokeStyle = this.movementEffect.color;
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
