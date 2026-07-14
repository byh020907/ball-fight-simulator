import { Vector2 } from "../core.js";
import { Ability } from "../abilities/ability.js";
import { AbilitySet } from "../abilities/abilitySet.js";
import { getAbilityDisplayName } from "../abilities/abilityMetadata.js";
import { getContactDamageSpeed } from "../physics/contactDamage.js";
import {
    ArcherAbility,
    EaterAbility,
    GrenadeAbility,
    OrbitAbility,
    RageAbility,
    SpinAbility,
    TricksterAbility,
    DashAbility,
    BatBallAbility,
    HeroAbility,
    VampireAbility,
    GunnerAbility,
    PhantomAbility,
    HuntingMeleeAbility,
    HuntingMobAbility
} from "../abilities/index.js";
import { BattleBall } from "../entities/index.js";
import { GravityParticle } from "../effects/index.js";
import { FighterPhysicsSimulation } from "./fighterPhysicsSimulation.js";
import { AIActionController } from "./aiActionController.js";

const ABILITY_TYPES = {
    none: Ability,
    archer: ArcherAbility,
    orbit: OrbitAbility,
    trickster: TricksterAbility,
    grenade: GrenadeAbility,
    dash: DashAbility,
    rage: RageAbility,
    spin: SpinAbility,
    eater: EaterAbility,
    bat_ball: BatBallAbility,
    hero: HeroAbility,
    vampire: VampireAbility,
    gunner: GunnerAbility,
    phantom: PhantomAbility,
    hunting_melee: HuntingMeleeAbility,
    hunting_mob: HuntingMobAbility
};

const ANTI_STALL_INTERVAL = 8;
const ANTI_STALL_WALL_REACH_SECONDS = 1;
const ANTI_STALL_VELOCITY_CORRECTION_RATE = 5.5;
const ANTI_STALL_MIN_IMPULSE = 650;
const ANTI_STALL_MAX_IMPULSE = 2200;

export class BattleSimulation extends FighterPhysicsSimulation {
    constructor(fighterSpecs, hooks, playerBall = null, options = {}) {
        super(options);
        this.hooks = hooks;
        const spawnPoints = this.createSpawnPoints(fighterSpecs.length);
        this.fighters = fighterSpecs.map((spec, index) => {
            const fighterSpec = {
                ...spec,
                teamId: spec.teamId ?? spec.team ?? `fighter-${index}`
            };
            const fighter = new BattleBall(fighterSpec, spawnPoints[index]);
            fighter.simulation = this;
            fighter.bindAbilitySet(this.createAbilitySet(fighterSpec.ability, fighter));
            this.hooks.onBattleBallReady?.(fighter, fighterSpec, this);
            return fighter;
        });
        this.entities = [...this.fighters];
        this.elapsed = 0;
        this.overtimeStartsAt = 26;
        this.overtimeAnnounced = false;
        this.overtimeParticleTimer = 0;
        this.finished = false;
        this.winner = null;
        this.loser = null;
        this.camera = {
            zoom: Number.isFinite(options.cameraZoom) ? Math.max(0.55, Math.min(1.25, options.cameraZoom)) : 1
        };
        this.resultAnimationTime = 0;
        this.resultReady = false;
        this.hostileAbsenceGraceDuration = Math.max(0, options.hostileAbsenceGraceDuration ?? 0);
        this.hostileAbsenceGraceTeamId = options.hostileAbsenceGraceTeamId ?? null;
        this._hostileAbsenceElapsed = 0;

        // ── 클릭 액션 시스템 ──
        this.playerBall = playerBall;
        this._clickActionContext = {
            pendingActions: [], // 큐: 여러 액션이 한 프레임에 예약되어도 안전
            timeWarps: new Map(), // Map<ball, remainingSeconds> — 시전자별 독립 타이머
            timeSlowFactor: 0.35
        };

        // ── Anti-stall ──
        this._antiStallTimer = 0;
        this._antiStallBurstCount = 0;

        // ── AI 액션 컨트롤러 ──
        if (hooks.assignActions || options.assignActions) {
            for (const fighter of this.fighters) {
                if (fighter === this.playerBall) continue;
                fighter.aiController = new AIActionController();
                fighter.aiController.selectAction(this, fighter);
            }
        }
    }

    /** 액션 예약 — 큐에 추가 (여러 액션이 동시에 예약되어도 안전) */
    scheduleAction(actionInstance, playerBall, paidCost = 0) {
        this._clickActionContext.pendingActions.push({ actionInstance, playerBall, paidCost });
    }

    /** 예약된 액션들을 순차 적용 (update()에서 호출) */
    _consumePendingActions() {
        const ctx = this._clickActionContext;
        while (ctx.pendingActions.length > 0) {
            const pa = ctx.pendingActions.shift();
            this._executeAction(pa.actionInstance, pa.playerBall, pa.paidCost);
        }
    }

    _executeAction(actionInstance, ball, paidCost) {
        if (!actionInstance || !ball) return;
        // 공통 피드백 — 플레이어/AI 모두 동일한 시각 효과
        this.spawnExplosion(ball.position.clone(), "#cccccc");
        this.spawnPulse(ball.position.clone(), "#ffffff");
        this.playSound("dash");
        actionInstance.apply(this, ball, paidCost);
    }

    // ── Action data interfaces ──────────────────────────────────────

    /** 시전자별 Time Warp 등록. duration만큼 상대를 느리게 함. */
    addTimeWarp(caster, duration) {
        const current = this._clickActionContext.timeWarps.get(caster) ?? 0;
        this._clickActionContext.timeWarps.set(caster, Math.max(current, duration));
    }

    /** 활성화된 Time Warp가 하나라도 있으면 true (getFailureReason 용) */
    getTimeSlowRemaining() {
        return this._clickActionContext.timeWarps.size > 0 ? 1 : 0;
    }

    /** @returns {boolean} 이 엔티티가 어떤 Time Warp에든 면제인가 (자신이 시전자) */
    _isTimeWarpExempt(entity) {
        return this._clickActionContext.timeWarps.has(entity);
    }

    get timeSlowFactor() {
        return this._clickActionContext.timeSlowFactor;
    }

    createSpawnPoints(count) {
        if (count <= 0) return [];

        const points = [];
        const margin = 120;
        const center = new Vector2(this.width / 2, this.height / 2);

        if (count === 1) return [center];
        if (count === 2) {
            return [
                new Vector2(this.width * 0.32, this.height * 0.5),
                new Vector2(this.width * 0.68, this.height * 0.5)
            ];
        }

        points.push(new Vector2(this.width * 0.28, this.height * 0.5));
        const enemyCount = count - 1;
        const arcStart = -Math.PI * 0.64;
        const arcEnd = Math.PI * 0.64;

        for (let index = 0; index < enemyCount; index += 1) {
            const ratio = enemyCount === 1 ? 0.5 : index / (enemyCount - 1);
            const angle = arcStart + (arcEnd - arcStart) * ratio;
            const candidate = new Vector2(
                this.width * 0.68 + Math.cos(angle) * this.width * 0.12,
                this.height * 0.5 + Math.sin(angle) * this.height * 0.31
            );
            candidate.x = Math.max(margin, Math.min(this.width - margin, candidate.x));
            candidate.y = Math.max(margin, Math.min(this.height - margin, candidate.y));
            points.push(candidate);
        }

        return points;
    }

    createAbility(type, owner, context = {}) {
        const AbilityType = ABILITY_TYPES[type];
        if (!AbilityType) {
            throw new Error(`Unknown ability type: ${type}`);
        }
        const role = context.role ?? "primary";
        const abilityId = context.abilityId ?? type;
        return new AbilityType(owner, this).setContext({
            abilityId,
            role,
            abilityTier: context.abilityTier ?? null,
            instanceKey: context.instanceKey ?? `${role}:${abilityId}`,
            displayName: context.displayName ?? getAbilityDisplayName(abilityId)
        });
    }

    createAbilitySet(type, owner, context = {}) {
        return new AbilitySet(owner, {
            primary: this.createAbility(type, owner, { ...context, role: "primary" })
        });
    }

    spawnFighter(spec, position) {
        const fighter = new BattleBall(spec, position.clone());
        fighter.simulation = this;
        fighter.bindAbilitySet(this.createAbilitySet(spec.ability, fighter));
        this.hooks.onBattleBallReady?.(fighter, spec, this);
        this.fighters.push(fighter);
        this.entities.push(fighter);
        return fighter;
    }

    replaceFighter(fighter, replacements) {
        if (!Array.isArray(replacements) || replacements.length === 0) return [];
        const fighterIndex = this.fighters.indexOf(fighter);
        if (fighterIndex < 0 || fighter.flags.defeated) return [];

        fighter.flags.defeated = true;
        fighter.flags.destroyed = true;
        fighter.isExpired = true;
        this.fighters.splice(fighterIndex, 1);
        return replacements.map(({ spec, position }) => this.spawnFighter(spec, position));
    }

    isOvertime() {
        return this.elapsed >= this.overtimeStartsAt;
    }

    getOvertimeProgress() {
        return Math.max(0, this.elapsed - this.overtimeStartsAt);
    }

    /**
     * 오버타임 전용 피해량 배율.
     * 평소에는 1 (영향 없음), 오버타임 진입 후 1.35부터 서서히 증가해 최대 3까지 올라갑니다.
     */
    getDamageMultiplier() {
        return this.isOvertime() ? Math.min(3, 1.35 + this.getOvertimeProgress() * 0.085) : 1;
    }

    /**
     * 오버타임 전용 속도 배율.
     * 평소에는 1 (영향 없음), 오버타임 진입 후 1.12부터 서서히 증가해 최대 1.58까지 올라갑니다.
     */
    getSpeedMultiplier(ball = null) {
        const overtimeMult = this.isOvertime() ? Math.min(1.58, 1.12 + this.getOvertimeProgress() * 0.026) : 1;
        const actionMult = ball?.actionContext?.getSpeedMultiplier() ?? 1;
        return overtimeMult * actionMult;
    }

    addLog(message) {
        this.hooks.onLog(message);
    }

    playSound(type, intensity = 1) {
        this.hooks.onSound?.(type, intensity);
    }

    // ── Game loop ─────────────────────────────────────────────────────────

    /**
     * @param {number} delta - 배속이 적용된 delta (엔티티 이동, 경과 시간 등)
     * @param {number} [realDelta=delta] - 실제 경과 시간 (시간 왜곡 타이머 등)
     */
    update(delta, realDelta = delta) {
        if (this.finished) {
            this.updateResultEffects(delta);
            return;
        }

        // 지연 적용 패턴 — 클릭 핸들러가 예약한 액션을 충돌 전에 처리
        this._consumePendingActions();

        this.elapsed += delta;
        this.updateScreenShake(delta);

        if (this.isOvertime()) {
            if (!this.overtimeAnnounced) {
                this.overtimeAnnounced = true;
                this.hooks.onOvertime?.();
                this.addLog("Overtime begins. Impact speed and crash damage are rising.");
            }
            this.updateOvertimeParticles(delta);
        }

        // 시간 왜곡 타이머 — 실제 시간으로 카운트다운 (배속 영향 없음)
        const ctx = this._clickActionContext;
        for (const [caster, remaining] of ctx.timeWarps) {
            const newRemaining = remaining - realDelta;
            if (newRemaining <= 0) {
                ctx.timeWarps.delete(caster);
            } else {
                ctx.timeWarps.set(caster, newRemaining);
            }
        }

        this.handleCollision();
        this._checkAntiStall(delta);

        // 시간 왜곡 적용: 자신이 시전한 Time Warp가 아니면 느려짐 (중첩 없음)
        for (const entity of this.entities) {
            const isSlowed = ctx.timeWarps.size > 0 && !ctx.timeWarps.has(entity);
            const scaledDelta = isSlowed ? delta * ctx.timeSlowFactor : delta;
            entity.update(scaledDelta, this);
        }
        this.entities = this.entities.filter((entity) => !entity.isExpired);

        this.checkResult(delta);
    }

    beforeFighterPhysicsCollision(context) {
        if (!context.hostile) return;

        const { a, b, normal, contactPoint, aModifiers, bModifiers } = context;
        this._resetAntiStallTimerForFighterCollision();

        const aCollisionEffects = a.getActiveMasteryCollisionEffects?.() ?? [];
        const bCollisionEffects = b.getActiveMasteryCollisionEffects?.() ?? [];
        context.masteryEffectsByAttacker = new Map([
            [a, aCollisionEffects],
            [b, bCollisionEffects]
        ]);

        let damageFromAToB = this.calculateCollisionDamageWithContact(a, b, normal, contactPoint) * aModifiers.damage;
        let damageFromBToA =
            this.calculateCollisionDamageWithContact(b, a, normal.clone().scale(-1), contactPoint) * bModifiers.damage;
        damageFromAToB = this._applyMasteryBeforeCollisionDamageEffects(aCollisionEffects, {
            attacker: a,
            defender: b,
            outgoingDamage: damageFromAToB
        });
        damageFromBToA = this._applyMasteryBeforeCollisionDamageEffects(bCollisionEffects, {
            attacker: b,
            defender: a,
            outgoingDamage: damageFromBToA
        });

        const aCollision = a.actionContext.onFighterCollision(a, b, damageFromAToB, damageFromBToA, this);
        damageFromAToB = aCollision.outgoingDamage;
        damageFromBToA = aCollision.incomingDamage;

        const bCollision = b.actionContext.onFighterCollision(b, a, damageFromBToA, damageFromAToB, this);
        damageFromBToA = bCollision.outgoingDamage;
        damageFromAToB = bCollision.incomingDamage;

        damageFromAToB = a.abilities.modifyOutgoingFighterCollisionDamage(damageFromAToB, b, context);
        damageFromBToA = b.abilities.modifyOutgoingFighterCollisionDamage(damageFromBToA, a, context);

        const damageToA = damageFromBToA > 0 ? a.takeDamage(damageFromBToA, b, "Crash").actualDamage : 0;
        const damageToB = damageFromAToB > 0 ? b.takeDamage(damageFromAToB, a, "Crash").actualDamage : 0;

        context.damageFromAToB = damageToB;
        context.damageFromBToA = damageToA;
    }

    beginFighterPhysicsCollision(context) {
        if (!context.hostile) return;
        context.damageByAttacker = new Map([
            [context.a, 0],
            [context.b, 0]
        ]);
        this._activeFighterCollisionContext = context;
    }

    finalizeFighterPhysicsCollision(context) {
        try {
            if (context.hostile) {
                this._applyMasteryAfterCollisionDamageEffects(context);
                this._applyCollisionHpSteal(context);
            }
        } finally {
            if (this._activeFighterCollisionContext === context) {
                this._activeFighterCollisionContext = null;
            }
        }
    }

    modifyFighterCollisionDamage(amount, source, target) {
        const context = this._activeFighterCollisionContext;
        if (!context || !this._isFighterCollisionPair(context, source, target)) return amount;
        const equipmentMultiplier = source.equipmentEffects?.crashDamageMultiplier ?? 1;
        const masteryMultiplier = 1 + (source.mastery.combat?.outgoingCollisionDamageBonus ?? 0);
        return amount * equipmentMultiplier * masteryMultiplier;
    }

    modifyIncomingFighterCollisionDamage(amount, source, target) {
        const context = this._activeFighterCollisionContext;
        if (!context || !this._isFighterCollisionPair(context, source, target)) return amount;
        return amount * (1 - (target.mastery.combat?.incomingCollisionDamageReduce ?? 0));
    }

    recordFighterCollisionDamage(source, target, actualDamage) {
        const context = this._activeFighterCollisionContext;
        if (!context || !this._isFighterCollisionPair(context, source, target) || actualDamage <= 0) return;
        context.damageByAttacker.set(source, (context.damageByAttacker.get(source) ?? 0) + actualDamage);
    }

    _isFighterCollisionPair(context, source, target) {
        return (source === context.a && target === context.b) || (source === context.b && target === context.a);
    }

    _applyCollisionHpSteal(context) {
        for (const attacker of [context.a, context.b]) {
            const totalActualDamage = context.damageByAttacker.get(attacker) ?? 0;
            const effects = attacker.equipmentEffects;
            if (totalActualDamage <= 0 || effects.hpStealRatio <= 0 || attacker.hp >= attacker.maxHp) continue;
            if (!attacker.isEquipmentEffectReady("hpSteal")) continue;

            const restored = attacker.heal(totalActualDamage * effects.hpStealRatio);
            if (restored <= 0) continue;

            attacker.triggerEquipmentEffectCooldown("hpSteal", effects.hpStealCooldown);
            this.spawnActionText(attacker.position.clone(), `갈망 +${restored} HP`, "#44cc66");
            this.addLog(`${attacker.name} restores ${restored} HP with 갈망.`);
        }
    }

    getFighterCollisionResponseOptions(context) {
        const { a, b, aModifiers, bModifiers } = context;
        const impactA = aModifiers.impact ?? 1;
        const impactB = bModifiers.impact ?? 1;
        const angularMasteryA = 1 + (a.mastery.physics?.collisionAngularImpulse ?? 0);
        const angularMasteryB = 1 + (b.mastery.physics?.collisionAngularImpulse ?? 0);
        return {
            impactA,
            impactB,
            angularScaleA: impactB * a.equipmentEffects.collisionAngularMultiplier * angularMasteryA,
            angularScaleB: impactA * b.equipmentEffects.collisionAngularMultiplier * angularMasteryB
        };
    }

    afterFighterPhysicsCollision(context) {
        const { a, b, contactPoint } = context;
        if (!context.hostile) {
            a.abilities.onAllyCollision(b, context);
            b.abilities.onAllyCollision(a, context);
            return;
        }

        a.abilities.onFighterCollisionDamageResolved(b, context.damageFromAToB, context);
        b.abilities.onFighterCollisionDamageResolved(a, context.damageFromBToA, context);
        this._handleDashCollisions(a, b, contactPoint);

        a.abilities.onCollision(b, { contactPoint });
        b.abilities.onCollision(a, { contactPoint });
        this._recordPhysicsDebugCollision(context);
    }

    shouldEmitFighterCollisionFeedback(context) {
        return context.hostile && context.approachSpeed < 0;
    }

    notifyFighterStaticCollision(fighter, context) {
        for (const observer of this.fighters) {
            observer.abilities.onFighterStaticCollision(fighter, context);
        }
    }

    emitFighterCollisionFeedback(context) {
        const { a, b, damageFromAToB = 0, damageFromBToA = 0 } = context;
        this.playSound("crash", Math.min(1.8, 0.8 + Math.abs(damageFromAToB + damageFromBToA) / 24));
        this.addSparkBurst(Vector2.add(a.position, b.position).scale(0.5), "#ffffff");
        this.addSparkBurst(a.position.clone(), a.color);
        this.addSparkBurst(b.position.clone(), b.color);
    }

    _recordPhysicsDebugCollision(context) {
        try {
            const { a, b, normal, result, contactPoint } = context;
            const collisionEvent = {
                type: "collision",
                entityIdA: a.id,
                entityNameA: a.name,
                entityIdB: b.id,
                entityNameB: b.name,
                normal: { x: normal.x, y: normal.y },
                overlap: result.overlap,
                contactPoint: contactPoint ? { x: contactPoint.x, y: contactPoint.y } : null
            };
            a.physicsDebug?.push(collisionEvent);
            b.physicsDebug?.push(collisionEvent);
        } catch {
            // Debug capture must never affect gameplay.
        }
    }

    _applyMasteryBeforeCollisionDamageEffects(effects, payload) {
        return effects.reduce((outgoingDamage, effect) => {
            if (typeof effect.onBeforeFighterCollisionDamage !== "function") return outgoingDamage;
            const result = effect.onBeforeFighterCollisionDamage({ ...payload, simulation: this, outgoingDamage });
            if (result?.consumed) effect.active = false;
            return result?.outgoingDamage ?? outgoingDamage;
        }, payload.outgoingDamage);
    }

    _applyMasteryAfterCollisionDamageEffects(context) {
        for (const attacker of [context.a, context.b]) {
            const actualOutgoingDamage = context.damageByAttacker.get(attacker) ?? 0;
            const effects = context.masteryEffectsByAttacker?.get(attacker) ?? [];
            for (const effect of effects) {
                if (typeof effect.onAfterFighterCollisionDamage !== "function") continue;
                const result = effect.onAfterFighterCollisionDamage({
                    simulation: this,
                    attacker,
                    actualOutgoingDamage
                });
                if (result?.consumed) effect.active = false;
            }
        }
    }

    _handleDashCollisions(a, b, contactPoint) {
        for (const [attacker, defender] of [
            [a, b],
            [b, a]
        ]) {
            if (!attacker.state.movement) continue;
            attacker.state.movement.onCollision(attacker, defender, this, contactPoint);
            if (attacker.state.movement?.expired) {
                attacker.state.movement = null;
                // 대시 종료 시 방향 고정도 같이 제거합니다.
                if (attacker.state.forcedHeading) {
                    attacker.state.forcedHeading = null;
                }
            }
        }
    }

    calculateCollisionDamage(attacker, defender, attackerToDefender, contactPoint = null) {
        const { linearSpeed: attackerSpeed, damageSpeed } = getContactDamageSpeed(attacker, contactPoint);
        const defenderSpeed = defender.velocity.length();
        const attackerDirection =
            attackerSpeed > 0 ? attacker.velocity.clone().normalize() : attackerToDefender.clone();
        const defenderDirection =
            defenderSpeed > 0 ? defender.velocity.clone().normalize() : attackerToDefender.clone().scale(-1);
        const aimAlignment = Math.max(
            0,
            attackerDirection.x * attackerToDefender.x + attackerDirection.y * attackerToDefender.y
        );
        const defenderFacing = Math.max(
            0,
            defenderDirection.x * -attackerToDefender.x + defenderDirection.y * -attackerToDefender.y
        );
        const sideExposure = 1 - defenderFacing;

        // Speed efficiency: 현재 속도 / baseSpeed (스탯 보정 완료된 기준, 1=기본)
        if (!Number.isFinite(attacker.stats.baseSpeed) || attacker.stats.baseSpeed <= 0) {
            this.addLog(`[오류] ${attacker.name} 스탯 이상 (baseSpeed=${attacker.stats.baseSpeed})`);
        }
        const speedEff = attacker.stats.baseSpeed > 0 ? damageSpeed / attacker.stats.baseSpeed : 1;
        // Direction efficiency: 0~1 (alignment + hitting from the side)
        const dirEff = aimAlignment * 0.55 + sideExposure * 0.45;
        // Glancing blow penalty
        const glancingPenalty = aimAlignment < 0.22 ? 0.5 : 1;
        // Combined efficiency (상한 없음, 기본속도=1 기준 speedEff × 방향 × 글랜싱)
        const efficiency = speedEff * dirEff * glancingPenalty;

        return Math.max(1, Math.round(attacker.stats.baseDamage * efficiency * this.getDamageMultiplier()));
    }

    /**
     * 접촉점 정보를 포함한 충돌 대미지 계산.
     * 접점 회전 속도는 선형 속도와 같은 차원으로 환산되어 피해 속도에 합산됩니다.
     */
    calculateCollisionDamageWithContact(attacker, defender, attackerToDefender, contactPoint) {
        return this.calculateCollisionDamage(attacker, defender, attackerToDefender, contactPoint);
    }

    _checkAntiStall(delta) {
        if (this.finished) return;
        this._antiStallTimer += delta;
        if (this._antiStallTimer < ANTI_STALL_INTERVAL) return;
        const burst = this._shouldTriggerAntiStallBurst();
        if (!burst.shouldTrigger) return;
        this._fireAntiStallBurst(burst.fighters);
    }

    _resetAntiStallTimerForFighterCollision() {
        this._antiStallTimer = 0;
    }

    _getActiveAntiStallFighters() {
        return this.fighters.filter((f) => !f.flags.defeated && !f.state.swallowed);
    }

    _hasHostileFighterPair(fighters) {
        for (let i = 0; i < fighters.length; i++) {
            for (let j = i + 1; j < fighters.length; j++) {
                if (this.isHostile(fighters[i], fighters[j])) {
                    return true;
                }
            }
        }
        return false;
    }

    _shouldTriggerAntiStallBurst() {
        const active = this._getActiveAntiStallFighters();
        if (active.length < 2 || !this._hasHostileFighterPair(active)) return { shouldTrigger: false, fighters: [] };
        return { shouldTrigger: true, fighters: active };
    }

    _emitAntiStallBurstFeedback(center) {
        this.spawnExplosion(center.clone(), "#ff4444");
        this.spawnPulse(center.clone(), "#ff4444");
        this.playSound("dash", 1.5);
        this.addLog("정체된 궤도를 깨기 위해 경기장 중앙 충격파가 발생했습니다.");
    }

    _getAntiStallDirection(fighter, center, index, total) {
        const diff = Vector2.subtract(fighter.position, center);
        const dist = diff.length();
        if (dist > 5) {
            return diff.clone().normalize();
        }
        const angle = (index / total) * Math.PI * 2;
        return Vector2.fromAngle(angle, 1);
    }

    _getAntiStallDistanceToWall(fighter, direction) {
        const distances = [];
        if (direction.x > 0) distances.push((this.width - fighter.radius - fighter.position.x) / direction.x);
        if (direction.x < 0) distances.push((fighter.position.x - fighter.radius) / -direction.x);
        if (direction.y > 0) distances.push((this.height - fighter.radius - fighter.position.y) / direction.y);
        if (direction.y < 0) distances.push((fighter.position.y - fighter.radius) / -direction.y);
        return Math.max(0, Math.min(...distances.filter(Number.isFinite)));
    }

    _getAntiStallImpulseMagnitude(fighter, direction) {
        const baseSpeed =
            Number.isFinite(fighter.stats.baseSpeed) && fighter.stats.baseSpeed > 0 ? fighter.stats.baseSpeed : 200;
        const distanceToWall = this._getAntiStallDistanceToWall(fighter, direction);
        const decay = 1 - Math.exp(-ANTI_STALL_VELOCITY_CORRECTION_RATE * ANTI_STALL_WALL_REACH_SECONDS);
        const targetSpeed =
            baseSpeed +
            (Math.max(0, distanceToWall - baseSpeed * ANTI_STALL_WALL_REACH_SECONDS) *
                ANTI_STALL_VELOCITY_CORRECTION_RATE) /
                decay;
        const currentOutwardSpeed = fighter.velocity.dot(direction);
        if (currentOutwardSpeed >= targetSpeed) return 0;
        return Math.max(ANTI_STALL_MIN_IMPULSE, Math.min(ANTI_STALL_MAX_IMPULSE, targetSpeed - currentOutwardSpeed));
    }

    _applyAntiStallBurstImpulse(fighters, center) {
        for (let i = 0; i < fighters.length; i++) {
            const fighter = fighters[i];
            const dir = this._getAntiStallDirection(fighter, center, i, fighters.length);
            const magnitude = this._getAntiStallImpulseMagnitude(fighter, dir);
            if (magnitude > 0) fighter.applyImpulse(dir.scale(magnitude));
        }
    }

    _resetAntiStallAfterBurst() {
        this._antiStallBurstCount++;
        this._antiStallTimer = 0;
    }

    _fireAntiStallBurst(fighters) {
        const center = new Vector2(this.width / 2, this.height / 2);

        this._emitAntiStallBurstFeedback(center);
        this._applyAntiStallBurstImpulse(fighters, center);
        this._resetAntiStallAfterBurst();
    }

    checkResult(delta = 0) {
        const alive = this.fighters.filter((f) => !f.flags.defeated);
        const aliveTeams = new Set(alive.map((fighter) => fighter.teamId));
        if (alive.length === 0) {
            this.resolveResult(this.fighters.reduce((best, current) => (current.hp > best.hp ? current : best)));
            return;
        }
        if (aliveTeams.size > 1) {
            this._hostileAbsenceElapsed = 0;
            return;
        }
        if (this.hostileAbsenceGraceDuration <= 0) {
            this.resolveResult(alive[0]);
            return;
        }
        if (
            this.hostileAbsenceGraceTeamId &&
            !alive.some((fighter) => fighter.teamId === this.hostileAbsenceGraceTeamId)
        ) {
            this.resolveResult(alive[0]);
            return;
        }
        this._hostileAbsenceElapsed += Math.max(0, delta);
        if (this._hostileAbsenceElapsed >= this.hostileAbsenceGraceDuration) this.resolveResult(alive[0]);
    }

    resolveResult(winner) {
        if (this.finished) return;
        this.finished = true;
        this.winner = winner;
        this.loser = this.fighters.find((fighter) => this.isHostile(winner, fighter)) ?? null;
        this.resultAnimationTime = 0;
        this.resultReady = false;
        for (const fighter of this.fighters) fighter.freezeForResult();
        for (const loser of this.fighters.filter((fighter) => this.isHostile(winner, fighter))) {
            if (loser.flags.destroyed) continue;
            const pos = loser.position.clone();
            const color = loser.color;
            loser.destroyForResult();
            this.spawnDeathExplosion(pos, color);
            this.addLog(`${loser.name} bursts apart in the arena.`);
        }
        this.hooks.onResultResolved?.(winner, { simulation: this });
    }

    updateResultEffects(delta) {
        this.resultAnimationTime += delta;
        this.updateScreenShake(delta);
        for (const entity of this.entities) entity.update(delta, this);
        this.entities = this.entities.filter((e) => !e.isExpired);
        if (this.resultAnimationTime >= 2.15) this.resultReady = true;
    }

    updateOvertimeParticles(delta) {
        this.overtimeParticleTimer -= delta;
        if (this.overtimeParticleTimer > 0) return;
        this.overtimeParticleTimer = 0.055;
        const count = 2 + Math.floor(Math.min(4, this.getOvertimeProgress() / 4));
        for (let i = 0; i < count; i++) {
            const x = 40 + Math.random() * (this.width - 80);
            const y = 24 + Math.random() * 80;
            const color = Math.random() > 0.45 ? "#ff8a00" : "#ff2d2d";
            this.entities.push(
                new GravityParticle(
                    new Vector2(x, y),
                    new Vector2((Math.random() - 0.5) * 70, 80 + Math.random() * 120),
                    {
                        color,
                        gravity: 1200,
                        radius: 2 + Math.random() * 3,
                        life: 1.7 + Math.random() * 0.8,
                        bounce: 0.08,
                        settleDelay: 0.55 + Math.random() * 0.45
                    }
                )
            );
        }
    }
}
