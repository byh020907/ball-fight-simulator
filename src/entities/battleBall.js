import { RENDER_LAYERS, TimedEffect, Vector2 } from "../core.js";
import { ActionContext } from "../clickActions.js";
import { DashEffect } from "../combatEffects.js";
import { mixins, PhysicsBody } from "../physics/index.js";
import { getFaceTemplate } from "./mobAppearance.js";
import { drawEquipmentItems } from "./equipmentVisuals.js";

export class BattleBall extends mixins([PhysicsBody]) {
    constructor(spec, position) {
        super();
        this.id = spec.id;
        this.teamId = spec.teamId;
        this.name = spec.name;
        this.title = spec.title;
        this.description = spec.description;
        this.color = spec.color;
        this.face = spec.face ?? spec.id;
        this.maxHp = spec.stats.hp;
        this.hp = spec.stats.hp;
        this.stats = {
            baseDamage: spec.stats.damage,
            baseDefense: spec.stats.defense,
            baseSpeed: spec.stats.speed,
            baseRadius: spec.stats.radius,
            mass: spec.stats.mass,
            allocation: spec.statAllocation ?? null
        };
        // PhysicsBody 프로퍼티 초기화
        this.pos = position;
        this.radius = spec.stats.radius;
        this.mass = spec.stats.mass;
        this.velocity = Vector2.fromAngle(Math.random() * Math.PI * 2, 120 + Math.random() * 90);
        this.bounced = false;
        this.state = {
            slow: null,
            speedBoost: null,
            forcedHeading: null,
            movement: null,
            swallowed: null,
            wallSlam: null
        };
        this.flags = {
            defeated: false,
            destroyed: false
        };
        this.display = {
            spinRotation: 0,
            scale: 1
        };
        this.ability = null;
        this.hero = {
            bonuses: { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0 },
            carryover: { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0 }
        };
        this.hunting = spec.hunting ?? null;
        this.appearance = spec.appearance ?? { sides: 0, face: "default" };
        this.equipment = {
            items: Array.isArray(spec.equipment?.equippedItems) ? spec.equipment.equippedItems : []
        };
        this.mastery = {
            physics: spec.mastery?.physics ?? {
                incomingKnockbackReduce: 0,
                outgoingImpactBonus: 0,
                velocityRecoveryBonus: 0
            },
            action: spec.mastery?.action ?? {
                hpCostPercentReduction: 0,
                minHpCostPercent: 0
            },
            passives: spec.mastery?.passives ?? [],
            _states: null
        };
        this.actionContext = new ActionContext();
        this.aiController = null;
    }

    get renderLayer() {
        return RENDER_LAYERS.FIGHTER;
    }

    get meta() {
        return this.ability?.meta ?? { isRanged: false };
    }

    bindAbility(ability) {
        this.ability = ability;
    }

    getStatModifiers() {
        return this.ability ? this.ability.getStatModifiers() : { speed: 1, damage: 1, defense: 1, impact: 1 };
    }

    setSpeedBoost(duration, multiplier, color = this.color) {
        this.state.speedBoost = { effect: new TimedEffect(duration), multiplier, color };
    }

    forceHeading(direction, duration) {
        this.state.forcedHeading = {
            effect: new TimedEffect(duration),
            direction: direction.clone().normalize()
        };
    }

    applyKnockback(velocity, duration) {
        this.forceHeading(velocity, duration);
        this.applyImpulse(velocity);
    }

    /**
     * 대시 발동 — setMovementEffect + forceHeading + applyImpulse를 한 번에 처리합니다.
     * @param {Vector2} direction - 대시 방향
     * @param {object} opts
     * @param {number} opts.duration - 지속 시간
     * @param {number} opts.multiplier - 속도 배율
     * @param {number} [opts.speedOverride] - 명시적 속도 (생략 시 baseSpeed * multiplier)
     * @param {string} [opts.color] - 색상 (기본 this.color)
     * @param {number} [opts.collisionDamage] - 충돌 데미지
     * @param {string} [opts.collisionLabel] - 충돌 라벨
     * @param {boolean} [opts.showRing] - 링 표시 여부
     */
    initiateDash(direction, opts = {}) {
        const {
            duration,
            multiplier,
            speedOverride,
            color = this.color,
            collisionDamage = 0,
            collisionLabel = "Dash Contact",
            showRing = true,
            noHeading = false
        } = opts;
        const speed = speedOverride ?? this.stats.baseSpeed * multiplier;

        this.setMovementEffect(
            new DashEffect({
                duration,
                multiplier,
                speedOverride: speed,
                color,
                showRing,
                collisionDamage,
                collisionLabel,
                untilImpact: true,
                untilWall: true
            })
        );
        if (!noHeading) {
            this.forceHeading(direction, duration);
        }
        this.applyImpulse(direction.clone().scale(speed).subtract(this.velocity));
    }

    setMovementEffect(effect) {
        this.state.movement = effect;
    }

    clearDash() {
        this.state.movement = null;
        this.state.forcedHeading = null;
        this.state.speedBoost = null;
    }

    freezeForResult() {
        this.applyImpulse(this.velocity.clone().scale(-1));
        this.clearDash();
        this.state.slow = null;
        this.state.swallowed = null;
        this.state.wallSlam = null;
    }

    destroyForResult() {
        this.freezeForResult();
        this.flags.defeated = true;
        this.flags.destroyed = true;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    getAbilityUiState() {
        return this.ability?.getUiState?.() ?? { label: "Passive", progress: 1 };
    }

    initState() {
        this.bounced = false;
    }

    update(delta, simulation) {
        if (this.flags.defeated) return;
        this.initState();

        if (this.state.swallowed) {
            this.pos = this.state.swallowed.owner.pos.clone();
            this.applyImpulse(this.velocity.clone().scale(-1));
            return;
        }

        const target = simulation.getOpponent(this);
        this._tickTimers(delta);
        this._tickMasteryPassives(delta);
        this.ability?.update(delta, target);

        if (this.aiController) {
            try {
                const result = this.aiController.evaluate(simulation, this, delta);
                if (result) {
                    simulation.scheduleAction(result.action, result.fighter, result.paidCost);
                }
            } catch (e) {
                console.warn("[AI] evaluate error:", e.message);
            }
        }

        this.radius = this.stats.baseRadius * (this.ability?.getRadiusScale?.() ?? 1);
        this._applyVelocityCorrection(simulation, delta);
        this.integrate(delta);
        simulation.keepInsideArena(this);
        if (this.bounced) this.state.forcedHeading = null;
    }

    _tickMasteryPassives(delta) {
        if (!this.mastery._states) {
            this.mastery._states = this.mastery.passives.map((def) => ({
                id: def.id,
                type: def.type,
                damageBonus: def.damageBonus ?? 0,
                cooldownRemaining: 0,
                cooldownDuration: def.cooldown ?? 0,
                active: false
            }));
        }
        for (const state of this.mastery._states) {
            if (state.active) continue;
            state.cooldownRemaining -= delta;
            if (state.cooldownRemaining <= 0) {
                state.active = true;
                state.cooldownRemaining = state.cooldownDuration;
            }
        }
    }

    /** 충돌 시 숙련도 패시브 적용. 충돌 핸들러에서 호출. */
    consumeMasteryCollisionBonus() {
        let bonus = 0;
        for (const state of this.mastery._states ?? []) {
            if (!state.active || state.type !== "periodic_collision_bonus") continue;
            bonus += state.damageBonus;
            state.active = false;
        }
        return bonus;
    }

    _tickTimers(delta) {
        const tick = (effect, onFinish) => {
            if (!effect) return;
            effect.tick(delta);
            if (effect.finished) onFinish();
        };
        tick(this.state.slow, () => (this.state.slow = null));
        tick(this.state.speedBoost?.effect, () => (this.state.speedBoost = null));
        tick(this.state.forcedHeading?.effect, () => (this.state.forcedHeading = null));
        if (this.state.movement) {
            this.state.movement.tick(this, delta);
            if (this.state.movement.expired) {
                this.state.movement = null;
                if (this.state.forcedHeading) this.state.forcedHeading = null;
            }
        }
        if (this.state.wallSlam) {
            if (this.state.wallSlam.tick(this, delta)) {
                this.state.wallSlam = null;
            }
        }
        this.actionContext.tickTimers(this, delta);
    }

    applySlow(duration, amount) {
        this.state.slow = new TimedEffect(duration);
        this.state.slow.amount = amount;
    }

    takeDamage(amount, source, label = "Hit") {
        if (this.flags.defeated) return { actualDamage: 0 };
        amount = this.actionContext.onDamageTaken(amount, source, label);
        const abilityDefMult = this.getStatModifiers().defense;
        const totalDefense = Math.round(this.stats.baseDefense * abilityDefMult);
        const hpBefore = this.hp;
        const rawActual = Math.max(1, Math.round(amount - totalDefense));
        const actual = Math.min(rawActual, hpBefore);
        this.hp = Math.max(0, this.hp - actual);
        const actualDamage = hpBefore - this.hp;
        const sim = source?.simulation ?? this.simulation;
        if (sim && actualDamage > 0) {
            sim.hooks?.onDamageTaken?.(this.id, actualDamage);
            if (source) sim.hooks?.onDamageDealt?.(source.id, actualDamage);
            sim.hooks?.onHpChanged?.(this.id, this.hp, this.maxHp);
        }
        if (label !== "Wall Slam") {
            sim?.shakeScreen?.(0.16, Math.min(18, 7 + actual * 0.55));
        }
        if (label !== "Crash") {
            sim?.playSound?.("hit", Math.min(1.8, 0.7 + actual / 18));
        }
        if (actual >= 1 && sim) {
            sim.spawnDamageNumber(this.position.clone(), Math.round(actual), "#ff3333");
        }
        if (actual >= 10) {
            sim?.addLog?.(`${label} lands on ${this.name} for ${Math.round(actual)} damage.`);
        }
        if (this.hp <= 0) {
            this.flags.defeated = true;
            this.flags.destroyed = true;
            const s = source?.simulation ?? this.simulation;
            if (s) {
                s.spawnDeathExplosion(this.position.clone(), this.color);
                s.addLog(`${this.name} has been defeated.`);
            }
        }
        return { actualDamage };
    }

    draw(ctx) {
        if (this.flags.destroyed || this.state.swallowed) return;
        ctx.save();
        const scale = this.display.scale;
        if (scale !== 1) {
            ctx.translate(this.position.x, this.position.y);
            ctx.scale(scale, scale);
            ctx.translate(-this.position.x, -this.position.y);
            ctx.globalAlpha *= scale;
        }
        ctx.fillStyle = this.color;
        if (this.appearance.sides > 0) {
            this._drawPolygonBody(ctx);
        } else {
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#202020";
            ctx.lineWidth = Math.max(3, this.radius * 0.07);
            ctx.stroke();
        }
        drawEquipmentItems(ctx, this, this.equipment.items);
        this.drawFace(ctx, this.state.wallSlam ? this.display.spinRotation : 0);
        this.ability?.draw?.(ctx);
        if (this.state.movement?.showRing) {
            ctx.strokeStyle = this.state.movement.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.radius + 18, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (this.hunting?.isMob) {
            this._drawMobHpBar(ctx);
        }
        this._drawNameplate(ctx);
        ctx.restore();
    }

    _drawNameplate(ctx) {
        if (this.flags.destroyed) return;
        const y = this.position.y + this.radius + 18;
        ctx.save();
        ctx.font = "700 13px Bahnschrift, Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#444444";
        ctx.fillText(this.name, this.position.x, y);
        ctx.restore();
    }

    _drawMobHpBar(ctx) {
        if (this.flags.defeated) return;
        const barWidth = this.radius * 2.2;
        const barHeight = 5;
        const x = this.position.x - barWidth / 2;
        const y = this.position.y - this.radius - 10;
        const hpPct = Math.max(0, this.hp / this.maxHp);
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.fillStyle = hpPct > 0.5 ? "#4caf50" : hpPct > 0.25 ? "#ff9800" : "#f44336";
        ctx.fillRect(x, y, barWidth * hpPct, barHeight);
        ctx.restore();
    }

    _drawPolygonBody(ctx) {
        const { x, y } = this.position;
        const n = this.appearance.sides;
        const a = (Math.PI * 2) / n;
        const r = this.radius;
        const offset = -Math.PI / 2 - a / 2;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const angle = i * a + offset;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = Math.max(3, r * 0.07);
        ctx.stroke();
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
        const drawn = this.ability?.drawFace?.(ctx, rotation, this);
        if (!drawn) {
            this._drawAppearanceFace(ctx);
        }
        ctx.restore();
    }

    _drawAppearanceFace(ctx) {
        const template = getFaceTemplate(this.appearance.face);
        template.draw(ctx, this.radius);
    }
}
