import { RENDER_LAYERS, TimedEffect, Vector2, randomSpin } from "../core.js";
import { ActionContext } from "../clickActions.js";
import { DashEffect } from "../combatEffects.js";
import { CooldownBank, mixins, PhysicsBody, RotationalBody, PhysicsMaterialBody } from "../physics/index.js";
import { computeRegularPolygonLocalPoints } from "../physics/CollisionShape.js";
import {
    PhysicsDebugRingBuffer,
    snapshotPhysicsState,
    validatePhysicsState
} from "../physics/PhysicsDebugRingBuffer.js";
import { MobAppearance } from "./mobAppearance.js";
import { drawEquipmentItems, getCharacterOutlineWidth } from "./equipmentVisuals.js";
import { applyHeroOrbCarryoverToBattleBall, mergeHeroOrbCarryover, HERO_ORB_CARRYOVER_RATE } from "./heroOrb.js";
import { createEquipmentCombatEffects } from "../hunting/equipmentEffects.js";
import { AbilitySet } from "../abilities/abilitySet.js";
import {
    drawRebirthVisualOverlay,
    drawRebirthVisualUnderlay,
    getRebirthVisualProfile
} from "../rebirth/rebirthVisuals.js";

const EQUIPMENT_EFFECT_COOLDOWN_KEYS = Object.freeze({ hpSteal: "hpSteal" });

export class BattleBall extends mixins([PhysicsBody, RotationalBody, PhysicsMaterialBody]) {
    constructor(spec, position) {
        super();
        this.id = spec.id;
        this.abilityId = spec.ability;
        this.teamId = spec.teamId;
        this.name = spec.name;
        this.title = spec.title;
        this.description = spec.description;
        this.color = spec.color;
        this.rebirthCount = Math.max(0, Math.floor(Number.isFinite(spec.rebirthCount) ? spec.rebirthCount : 0));
        this.face = spec.face ?? spec.id;
        this.maxHp = spec.stats.hp;
        this.hp = Number.isFinite(spec.initialHp)
            ? Math.max(0, Math.min(this.maxHp, Math.round(spec.initialHp)))
            : spec.stats.hp;
        this.stats = {
            baseDamage: spec.stats.damage,
            baseDefense: spec.stats.defense,
            baseSpeed: spec.stats.speed,
            baseSkill: spec.stats.skill ?? 0,
            baseRadius: spec.stats.radius,
            mass: spec.stats.mass,
            criticalChance: 5,
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
            periodicDamage: [],
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
            scale: 1
        };
        this.abilities = new AbilitySet(this);
        this.progression = {
            characterId: spec.id,
            level: 1,
            baseStatBonuses: {},
            abilityTier: 0,
            rewardIds: []
        };
        this.hero = {
            bonuses: { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0, critical: 0 },
            carryover: { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0, critical: 0 }
        };
        this.applyHeroOrbCarryover(spec.hero?.carryover);
        this.hunting = spec.hunting ?? null;
        this.appearance = spec.appearance ?? { sides: 0, face: "default" };
        // RotationalBody 초기화: angle 기본값 0 (대기화면 upright), 회전은 runtime angularVelocity/integrateRotation로 동작
        this.rotationEnabled = spec.rotationEnabled !== false;
        if (!this.rotationEnabled) {
            this.angle = 0;
            this.angularVelocity = 0;
        } else if (this.appearance.sides > 0) {
            this.angle = this.appearance.angle ?? 0;
            this.angularVelocity = this.appearance.angularVelocity ?? randomSpin();
        } else {
            this.angle = 0;
            this.angularVelocity = randomSpin();
        }
        this.equipment = {
            items: Array.isArray(spec.equipment?.equippedItems) ? spec.equipment.equippedItems : []
        };
        this.equipmentEffects = createEquipmentCombatEffects(this.equipment.items);
        this.mass *= this.equipmentEffects.massMultiplier;
        this.stats.mass = this.mass;
        this._equipmentEffectCooldowns = new CooldownBank({ [EQUIPMENT_EFFECT_COOLDOWN_KEYS.hpSteal]: 0 });
        this._igniteState = null;
        this._tempCritMultiplier = null;
        this.mastery = {
            physics: spec.mastery?.physics ?? {
                velocityRecoveryBonus: 0,
                wallBounce: 0
            },
            combat: spec.mastery?.combat ?? { incomingCollisionDamageReduce: 0, outgoingCollisionDamageBonus: 0 },
            action: spec.mastery?.action ?? {
                hpCostPercentReduction: 0,
                cooldownPercent: 0
            },
            passives: spec.mastery?.passives ?? [],
            _states: null
        };
        this._masteryCooldowns = new CooldownBank(
            Object.fromEntries(this.mastery.passives.map((effect) => [effect.id, effect.cooldown ?? 0]))
        );
        this.rebirthEffects = {
            abilityCooldownMultiplier: 1
        };
        this.setPhysicsMaterial(spec.physicsMaterial ?? "rubberBall");
        this.actionContext = new ActionContext();
        this.aiController = null;

        // 물리 디버깅 ring buffer (게임 결과에 영향 없음)
        this.physicsDebug = new PhysicsDebugRingBuffer(30);
    }

    /**
     * @param {{ hp?: number, damage?: number, speed?: number, defense?: number, skill?: number }} carryover
     */
    applyHeroOrbCarryover(carryover) {
        applyHeroOrbCarryoverToBattleBall(this, carryover);
    }

    /**
     * 승리한 BattleBall의 bonuses를 carryover로 변환해 대상 spec으로 병합합니다.
     * @param {{ hero?: { carryover: { hp: number, damage: number, speed: number, defense: number, skill: number } } }} targetSpec
     * @param {number} [rate=HERO_ORB_CARRYOVER_RATE]
     * @returns {{ hp?: number, damage?: number, speed?: number, defense?: number, skill?: number }}
     */
    mergeHeroOrbCarryoverInto(targetSpec, rate = HERO_ORB_CARRYOVER_RATE) {
        return mergeHeroOrbCarryover(targetSpec, this.hero.bonuses, rate);
    }

    get renderLayer() {
        return RENDER_LAYERS.FIGHTER;
    }

    get meta() {
        return this.abilities.meta;
    }

    get ability() {
        return this.abilities.primary;
    }

    bindAbility(ability) {
        return this.abilities.setPrimary(ability);
    }

    bindAbilitySet(abilitySet) {
        if (!(abilitySet instanceof AbilitySet) || abilitySet.owner !== this) {
            throw new Error("BattleBall requires an AbilitySet owned by itself");
        }

        this.abilities = abilitySet;
        return this.abilities;
    }

    getStatModifiers() {
        return this.abilities.getStatModifiers();
    }

    getSkillPoints() {
        return this.stats.baseSkill + (this.stats.allocation?.skill ?? 0) + (this.hero?.bonuses?.skill ?? 0);
    }

    getTotalAttackDamage() {
        return this.stats.baseDamage;
    }

    // ── 물리 디버그 래퍼 (원본 믹스인 메서드를 보존하고 기록 추가) ──

    applyImpulse(impulse) {
        // PhysicsBody.applyImpulse 호출 (프로토타입 체인 상의 원본)
        const proto = Object.getPrototypeOf(Object.getPrototypeOf(this));
        if (proto && typeof proto.applyImpulse === "function") {
            proto.applyImpulse.call(this, impulse);
        }
        // debug 기록 (실패해도 게임 영향 없음)
        try {
            this.physicsDebug?.push({
                type: "impulse",
                entityId: this.id,
                entityName: this.name,
                impulse: { x: impulse.x, y: impulse.y }
            });
        } catch {
            /* 무시 */
        }
    }

    applyTorque(value) {
        const proto = Object.getPrototypeOf(Object.getPrototypeOf(this));
        if (proto && typeof proto.applyTorque === "function") {
            proto.applyTorque.call(this, value);
        }
        try {
            this.physicsDebug?.push({
                type: "torque",
                entityId: this.id,
                entityName: this.name,
                torque: value
            });
        } catch {
            /* 무시 */
        }
    }

    applyAngularImpulse(value) {
        const proto = Object.getPrototypeOf(Object.getPrototypeOf(this));
        if (proto && typeof proto.applyAngularImpulse === "function") {
            proto.applyAngularImpulse.call(this, value);
        }
        try {
            this.physicsDebug?.push({
                type: "angularImpulse",
                entityId: this.id,
                entityName: this.name,
                angularImpulse: value
            });
        } catch {
            /* 무시 */
        }
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

    swapPositionWith(other) {
        const ownPosition = this.position.clone();
        this.position = other.position.clone();
        other.position = ownPosition;
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
        this.state.periodicDamage = [];
        this.state.swallowed = null;
        this.state.wallSlam = null;
        this._igniteState = null;
    }

    destroyForResult() {
        this.freezeForResult();
        this.flags.defeated = true;
        this.flags.destroyed = true;
    }

    heal(amount) {
        const restored = Math.min(Math.max(0, Math.round(amount)), this.maxHp - this.hp);
        if (restored <= 0) return 0;
        this.hp += restored;
        this.simulation?.hooks?.onHpChanged?.(this.id, this.hp, this.maxHp);
        return restored;
    }

    isEquipmentEffectReady(type) {
        return this._equipmentEffectCooldowns.isReady(type);
    }

    triggerEquipmentEffectCooldown(type, duration) {
        this._equipmentEffectCooldowns.reset(type, duration);
    }

    applyWallBounceBoost(xNormal, yNormal) {
        const equipmentMultiplier = this.equipmentEffects.wallBounceMultiplier;
        const masteryBonus = this.mastery.physics.wallBounce ?? 0;
        const totalMultiplier = equipmentMultiplier * (1 + masteryBonus);
        if (totalMultiplier <= 1) return;

        const normal = (xNormal ?? yNormal)?.clone();
        if (!normal) return;
        if (xNormal && yNormal) normal.add(yNormal).normalize();

        const outgoingSpeed = Math.max(0, this.velocity.dot(normal));
        if (!Number.isFinite(outgoingSpeed) || outgoingSpeed <= 0) return;
        this.applyImpulse(normal.scale(outgoingSpeed * (totalMultiplier - 1)));
    }

    getAbilityUiState() {
        return this.abilities.getPrimaryUiState();
    }

    getAbilityUiStates() {
        return this.abilities.getUiStates();
    }

    getShieldState() {
        return this.abilities.getShieldState();
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
        this.abilities.update(delta, target);

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

        this.radius = this.stats.baseRadius * this.abilities.getRadiusScale();
        this._applyVelocityCorrection(simulation, delta);
        this.integrate(delta);
        simulation.keepInsideArena(this);
        if (this.bounced) this.state.forcedHeading = null;
        if (this.rotationEnabled) {
            this.integrateRotation(delta);
        } else {
            this.clearAngularForces();
        }

        // ── update summary debug snapshot (값 복사) ──
        try {
            this.physicsDebug?.push({
                type: "update",
                entityId: this.id,
                entityName: this.name,
                elapsed: simulation.elapsed,
                ...snapshotPhysicsState(this)
            });
        } catch {
            /* 무시 */
        }
        // ── invalid state 검증 ──
        validatePhysicsState(this, simulation.elapsed);
    }

    _tickMasteryPassives(delta) {
        const states = this._getMasteryPassiveStates();
        const inactiveIds = states.filter((state) => !state.active).map((state) => state.id);
        this._masteryCooldowns.tick(delta, inactiveIds);
        for (const state of states) {
            if (state.active) continue;
            if (this._masteryCooldowns.isReady(state.id)) {
                state.active = true;
                this._masteryCooldowns.reset(state.id);
            }
        }
    }

    _getMasteryPassiveStates() {
        if (!this.mastery._states) {
            this.mastery._states = this.mastery.passives.map((effect) => ({
                ...effect,
                active: false
            }));
        }
        return this.mastery._states;
    }

    /** 다음 적대 전투원 충돌에 사용할 준비된 숙련도 효과를 반환한다. */
    getActiveMasteryCollisionEffects() {
        return this._getMasteryPassiveStates().filter((effect) => effect.active);
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
        this._equipmentEffectCooldowns.tick(delta);
        for (const effect of this.state.periodicDamage) {
            effect.tick(this, delta);
        }
        this.state.periodicDamage = this.state.periodicDamage.filter((effect) => !effect.finished);
        this.actionContext.tickTimers(this, delta);
    }

    applySlow(duration, amount) {
        this.state.slow = new TimedEffect(duration);
        this.state.slow.amount = amount;
    }

    addPeriodicDamageEffect(effect) {
        this.state.periodicDamage.push(effect);
        return effect;
    }

    getCriticalChance() {
        return Math.max(0, Math.min(100, this.stats.criticalChance ?? 5));
    }

    rollCritical(attacker, critChanceOverride) {
        if (!attacker || attacker === this) return false;
        let critChance = critChanceOverride ?? attacker.getCriticalChance?.() ?? attacker.stats?.criticalChance ?? 5;
        if (attacker._tempCritMultiplier) {
            critChance = Math.min(100, critChance * attacker._tempCritMultiplier);
        }
        return Math.random() * 100 < critChance;
    }

    takeDamage(amount, source, label = "Hit", options = {}) {
        if (this.flags.defeated) return { actualDamage: 0, absorbedDamage: 0, isCritical: false };
        if (this.state.damageImmunityUntil && this.simulation?.elapsed < this.state.damageImmunityUntil) {
            return { actualDamage: 0, absorbedDamage: 0, isCritical: false };
        }
        const isCritical = source && source !== this && this.rollCritical(source);
        if (isCritical) {
            amount = Math.round(amount * 2);
        }
        const sim = source?.simulation ?? this.simulation;
        amount = sim?.modifyFighterCollisionDamage?.(amount, source, this, label) ?? amount;
        amount = this.actionContext.onDamageTaken(amount, source, label);
        amount = sim?.modifyIncomingFighterCollisionDamage?.(amount, source, this, label) ?? amount;
        const abilityDefMult = this.getStatModifiers().defense;
        const totalDefense = options.ignoreDefense ? 0 : Math.round(this.stats.baseDefense * abilityDefMult);
        const hpBefore = this.hp;
        const rawActual = Math.max(1, Math.round(amount - totalDefense));
        const absorption = this.abilities.absorbIncomingDamage(rawActual, source, label, options);
        const absorbedDamage = Math.max(0, Math.min(rawActual, absorption.absorbedDamage ?? 0));
        const actual = Math.min(Math.max(0, absorption.remainingDamage ?? rawActual), hpBefore);
        this.hp = Math.max(0, this.hp - actual);
        const actualDamage = hpBefore - this.hp;
        if (sim && actualDamage > 0) {
            sim.hooks?.onDamageTaken?.(this.id, actualDamage);
            if (source) sim.hooks?.onDamageDealt?.(source.id, actualDamage);
            sim.hooks?.onHpChanged?.(this.id, this.hp, this.maxHp);
            sim.recordFighterCollisionDamage?.(source, this, actualDamage);
        }
        if (label !== "Wall Slam") {
            sim?.shakeScreen?.(0.16, Math.min(18, 7 + actual * 0.55));
        }
        if (label !== "Crash") {
            sim?.playSound?.("hit", Math.min(1.8, 0.7 + actual / 18));
        }
        if (actual >= 1 && sim && !options.suppressDamageNumber) {
            if (isCritical) {
                sim.spawnCriticalNumber(this.position.clone(), Math.round(actual));
            } else {
                sim.spawnDamageNumber(this.position.clone(), Math.round(actual), "#ff3333");
            }
        }
        if (actual >= 10) {
            sim?.addLog?.(
                `${label} lands on ${this.name} for ${Math.round(actual)} damage${isCritical ? " (CRIT!)" : ""}.`
            );
        }
        if (this.hp <= 0) {
            const s = source?.simulation ?? this.simulation;
            if (s?.tryConsumePlayerLife?.(this)) return { actualDamage, absorbedDamage, isCritical };
            const defeatContext = { source, label, simulation: s };
            const suppressLootDrop = this.abilities.onOwnerDefeated(defeatContext);
            this.flags.defeated = true;
            this.flags.destroyed = true;
            if (s) {
                s.spawnDeathExplosion(this.position.clone(), this.color);
                s.addLog(`${this.name} has been defeated.`);
                s.hooks?.onFighterDefeated?.(this, { ...defeatContext, suppressLootDrop });
            }
        }
        return { actualDamage, absorbedDamage, isCritical };
    }

    draw(ctx) {
        if (this.flags.destroyed || this.state.swallowed) return;
        ctx.save();
        const rebirthVisual = getRebirthVisualProfile(this.rebirthCount);
        drawRebirthVisualUnderlay(ctx, this, rebirthVisual);
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
            ctx.lineWidth = getCharacterOutlineWidth(this.radius);
            ctx.stroke();
        }
        const outlineWidth = getCharacterOutlineWidth(this.radius);
        // 장비 회전: 원형 + rotationEnabled 시 body angle 기준
        if (this.appearance.sides === 0 && this.rotationEnabled) {
            ctx.save();
            ctx.translate(this.position.x, this.position.y);
            ctx.rotate(this.angle);
            const rotatedBall = Object.create(this);
            rotatedBall.position = new Vector2(0, 0);
            drawEquipmentItems(ctx, rotatedBall, this.equipment.items, outlineWidth);
            ctx.restore();
        } else {
            drawEquipmentItems(ctx, this, this.equipment.items, outlineWidth);
        }
        // 얼굴 회전: polygon은 항상 this.angle, 원형은 rotationEnabled에 따라 적용
        const faceRotation = this.appearance.sides > 0 ? this.angle : this.rotationEnabled ? this.angle : 0;
        this.drawFace(ctx, faceRotation);
        this.abilities.draw(ctx);
        for (const effect of this.state.periodicDamage) {
            if (effect.renderInFighter !== false) effect.draw?.(ctx, this);
        }
        drawRebirthVisualOverlay(ctx, this, rebirthVisual);
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
        ctx.save();
        try {
            const { x, y } = this.position;
            const n = this.appearance.sides;
            const r = this.radius;
            const points = computeRegularPolygonLocalPoints(n, r);
            ctx.translate(x, y);
            ctx.rotate(this.angle);
            ctx.beginPath();
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "#202020";
            ctx.lineWidth = Math.max(3, r * 0.07);
            ctx.stroke();
        } finally {
            ctx.restore();
        }
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
        const drawn = this.abilities.drawFace(ctx, rotation, this);
        if (!drawn) {
            this._drawAppearanceFace(ctx);
        }
        ctx.restore();
    }

    _drawAppearanceFace(ctx) {
        const template = MobAppearance.getTemplate(this.appearance.face);
        template.draw(ctx, this.radius);
    }
}
