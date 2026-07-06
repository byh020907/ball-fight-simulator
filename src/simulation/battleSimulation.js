import { applyCollisionImpulse, Vector2 } from "../core.js";
import { resolveFighterShapeCollision } from "../physics/CollisionShape.js";
import { applyCollisionAngularImpulse } from "../physics/collisionResponse.js";
import {
    ArcherAbility,
    EaterAbility,
    GrenadeAbility,
    OrbitAbility,
    RageAbility,
    TricksterAbility,
    DashAbility,
    BatBallAbility,
    HeroAbility,
    VampireAbility,
    GunnerAbility,
    PhantomAbility,
    HuntingMeleeAbility
} from "../abilities/index.js";
import { BattleBall } from "../entities/index.js";
import { GravityParticle } from "../effects/index.js";
import { Simulation } from "./simulation.js";
import { AIActionController } from "./aiActionController.js";

const ABILITY_TYPES = {
    archer: ArcherAbility,
    orbit: OrbitAbility,
    trickster: TricksterAbility,
    grenade: GrenadeAbility,
    dash: DashAbility,
    rage: RageAbility,
    eater: EaterAbility,
    bat_ball: BatBallAbility,
    hero: HeroAbility,
    vampire: VampireAbility,
    gunner: GunnerAbility,
    phantom: PhantomAbility,
    hunting_melee: HuntingMeleeAbility
};

const COLLISION_RESTITUTION = 0.92;
const COLLISION_SEPARATION_PADDING = 0.6;
const DEFAULT_ARENA_SIZE = 960;

function normalizeArenaSize(value) {
    if (!Number.isFinite(value)) return DEFAULT_ARENA_SIZE;
    return Math.max(DEFAULT_ARENA_SIZE, Math.round(value));
}

export class BattleSimulation extends Simulation {
    constructor(fighterSpecs, hooks, playerBall = null, options = {}) {
        super();
        this.width = normalizeArenaSize(options.arenaWidth);
        this.height = normalizeArenaSize(options.arenaHeight);
        this.arenaTheme = options.arenaTheme ?? null;
        this.terrain = Array.isArray(options.terrain) ? options.terrain : [];
        this.hooks = hooks;
        const spawnPoints = this.createSpawnPoints(fighterSpecs.length);
        this.fighters = fighterSpecs.map((spec, index) => {
            const fighterSpec = {
                ...spec,
                teamId: spec.teamId ?? spec.team ?? `fighter-${index}`
            };
            const fighter = new BattleBall(fighterSpec, spawnPoints[index]);
            fighter.simulation = this;
            fighter.bindAbility(this.createAbility(fighterSpec.ability, fighter));
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

        // ── 클릭 액션 시스템 ──
        this.playerBall = playerBall;
        this._clickActionContext = {
            pendingActions: [], // 큐: 여러 액션이 한 프레임에 예약되어도 안전
            timeWarps: new Map(), // Map<ball, remainingSeconds> — 시전자별 독립 타이머
            timeSlowFactor: 0.35
        };

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

    createAbility(type, owner) {
        const AbilityType = ABILITY_TYPES[type];
        if (!AbilityType) {
            throw new Error(`Unknown ability type: ${type}`);
        }
        return new AbilityType(owner, this);
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

        // 시간 왜곡 적용: 자신이 시전한 Time Warp가 아니면 느려짐 (중첩 없음)
        for (const entity of this.entities) {
            const isSlowed = ctx.timeWarps.size > 0 && !ctx.timeWarps.has(entity);
            const scaledDelta = isSlowed ? delta * ctx.timeSlowFactor : delta;
            entity.update(scaledDelta, this);
        }
        this.entities = this.entities.filter((entity) => !entity.isExpired);

        this.checkResult();
    }

    handleCollision() {
        for (const [a, b] of this.getFighterPairs()) {
            this.handleFighterCollision(a, b);
        }
    }

    getFighterPairs() {
        return this.fighters.flatMap((fighter, index) =>
            this.fighters.slice(index + 1).map((opponent) => [fighter, opponent])
        );
    }

    handleFighterCollision(a, b) {
        if (a.flags.defeated || b.flags.defeated || a.state.swallowed || b.state.swallowed) return;

        const result = resolveFighterShapeCollision(a, b);
        if (!result || !result.normal || result.overlap <= 0) return;

        const normal = result.normal;
        const sepVec = result.separationVec;
        if (sepVec) {
            // SAT normal 방향 분리 벡터 사용 (polygon 충돌)
            const pad = COLLISION_SEPARATION_PADDING;
            const totalX = sepVec.x + (sepVec.x > 0 ? pad : -pad);
            const totalY = sepVec.y + (sepVec.y > 0 ? pad : -pad);
            a.position.add(new Vector2(-totalX / 2, -totalY / 2));
            b.position.add(new Vector2(totalX / 2, totalY / 2));
        } else {
            // circle-circle: 기존 normal 기반 분리
            const separationOverlap = result.separationOverlap ?? result.overlap;
            this._resolveOverlap(a, b, normal, separationOverlap);
        }

        const aModifiers = a.getStatModifiers();
        const bModifiers = b.getStatModifiers();

        // 충돌 전 relative velocity — 선형 impulse 적용 전에 계산하여 angular response에 전달
        const preCollisionVel = Vector2.subtract(b.velocity, a.velocity);
        const preCollisionVelAlongNormal = preCollisionVel.dot(normal);

        if (!this.isHostile(a, b)) {
            this._applyCollisionPhysics(a, b, normal, aModifiers, bModifiers);
            this._applyAngularCollisionResponse(a, b, normal, result.contactPoint, preCollisionVelAlongNormal);
            return;
        }

        let damageFromAToB = this.calculateCollisionDamage(a, b, normal) * aModifiers.damage;
        let damageFromBToA = this.calculateCollisionDamage(b, a, normal.clone().scale(-1)) * bModifiers.damage;

        [damageFromAToB, damageFromBToA] = this._applyMasteryCollisionPassives(a, b, damageFromAToB, damageFromBToA);

        const aCollision = a.actionContext.onFighterCollision(a, b, damageFromAToB, damageFromBToA, this);
        damageFromAToB = aCollision.outgoingDamage;
        damageFromBToA = aCollision.incomingDamage;

        const bCollision = b.actionContext.onFighterCollision(b, a, damageFromBToA, damageFromAToB, this);
        damageFromBToA = bCollision.outgoingDamage;
        damageFromAToB = bCollision.incomingDamage;

        if (damageFromBToA > 0) a.takeDamage(damageFromBToA, b, "Crash");
        if (damageFromAToB > 0) b.takeDamage(damageFromAToB, a, "Crash");
        this._applyCollisionPhysics(a, b, normal, aModifiers, bModifiers);
        this._applyAngularCollisionResponse(a, b, normal, result.contactPoint, preCollisionVelAlongNormal);
        this._handleDashCollisions(a, b);

        a.ability?.onCollision(b);
        b.ability?.onCollision(a);

        // ── physics debug collision event (실패해도 게임 영향 없음) ──
        try {
            const collisionEvent = {
                type: "collision",
                entityIdA: a.id,
                entityNameA: a.name,
                entityIdB: b.id,
                entityNameB: b.name,
                normal: { x: normal.x, y: normal.y },
                overlap: result.overlap,
                contactPoint: result.contactPoint ? { x: result.contactPoint.x, y: result.contactPoint.y } : null
            };
            a.physicsDebug?.push(collisionEvent);
            b.physicsDebug?.push(collisionEvent);
        } catch {
            /* 무시 */
        }

        this.playSound("crash", Math.min(1.8, 0.8 + Math.abs(damageFromAToB + damageFromBToA) / 24));
        this.addSparkBurst(Vector2.add(a.position, b.position).scale(0.5), "#ffffff");
        this.addSparkBurst(a.position.clone(), a.color);
        this.addSparkBurst(b.position.clone(), b.color);
    }

    _resolveOverlap(a, b, normal, overlap) {
        const separation = overlap + COLLISION_SEPARATION_PADDING;
        a.position.add(normal.clone().scale(-separation / 2));
        b.position.add(normal.clone().scale(separation / 2));
    }

    _applyCollisionPhysics(a, b, normal, aMod, bMod) {
        const relativeVelocity = Vector2.subtract(b.velocity, a.velocity);
        const velocityAlongNormal = relativeVelocity.dot(normal);
        if (velocityAlongNormal > 0) return;

        // 숙련도 물리 보정 적용
        const aOutgoingBonus = 1 + (a.mastery.physics?.outgoingImpactBonus ?? 0);
        const bOutgoingBonus = 1 + (b.mastery.physics?.outgoingImpactBonus ?? 0);
        const aIncomingReduce = 1 - (a.mastery.physics?.incomingKnockbackReduce ?? 0);
        const bIncomingReduce = 1 - (b.mastery.physics?.incomingKnockbackReduce ?? 0);

        applyCollisionImpulse(a, b, normal, COLLISION_RESTITUTION, {
            impactA: aMod.impact * aOutgoingBonus * bIncomingReduce,
            impactB: bMod.impact * bOutgoingBonus * aIncomingReduce
        });
    }

    /**
     * 충돌 접촉점 기반 회전 angular impulse 적용.
     * contactPoint가 중심에서 떨어져 있을수록 큰 회전력을 받습니다.
     * 각 fighter의 applyAngularImpulse()를 통해 누적되며, 다음 integrateRotation에서 반영됩니다.
     */
    _applyAngularCollisionResponse(a, b, normal, contactPoint, preCollisionVelAlongNormal) {
        if (!contactPoint) return;
        if (preCollisionVelAlongNormal >= 0) return;

        const impulseMag = Math.abs(preCollisionVelAlongNormal) * (1 + COLLISION_RESTITUTION);
        const ANGULAR_COLLISION_FACTOR = 0.15;

        applyCollisionAngularImpulse(a, normal, contactPoint, impulseMag, ANGULAR_COLLISION_FACTOR);
        const inverseNormal = { x: -normal.x, y: -normal.y };
        applyCollisionAngularImpulse(b, inverseNormal, contactPoint, impulseMag, ANGULAR_COLLISION_FACTOR);
    }

    /** 숙련도 충돌 패시브: 주기적 충돌 피해 보너스 적용 */
    _applyMasteryCollisionPassives(a, b, damageFromAToB, damageFromBToA) {
        const aPassiveBonus = a.consumeMasteryCollisionBonus?.() ?? 0;
        const bPassiveBonus = b.consumeMasteryCollisionBonus?.() ?? 0;
        if (aPassiveBonus > 0) {
            damageFromAToB = Math.round(damageFromAToB * (1 + aPassiveBonus));
            this.spawnActionText(a.position.clone(), `숙련도 +${(aPassiveBonus * 100).toFixed(0)}%`, "#ff4444");
        }
        if (bPassiveBonus > 0) {
            damageFromBToA = Math.round(damageFromBToA * (1 + bPassiveBonus));
            this.spawnActionText(b.position.clone(), `숙련도 +${(bPassiveBonus * 100).toFixed(0)}%`, "#ff4444");
        }
        return [damageFromAToB, damageFromBToA];
    }

    _handleDashCollisions(a, b) {
        for (const [attacker, defender] of [
            [a, b],
            [b, a]
        ]) {
            if (!attacker.state.movement) continue;
            attacker.state.movement.onCollision(attacker, defender, this);
            if (attacker.state.movement?.expired) {
                attacker.state.movement = null;
                // 대시 종료 시 방향 고정도 같이 제거합니다.
                if (attacker.state.forcedHeading) {
                    attacker.state.forcedHeading = null;
                }
            }
        }
    }

    calculateCollisionDamage(attacker, defender, attackerToDefender) {
        const attackerSpeed = attacker.velocity.length();
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
        const speedEff = attacker.stats.baseSpeed > 0 ? attackerSpeed / attacker.stats.baseSpeed : 1;
        // Direction efficiency: 0~1 (alignment + hitting from the side)
        const dirEff = aimAlignment * 0.55 + sideExposure * 0.45;
        // Glancing blow penalty
        const glancingPenalty = aimAlignment < 0.22 ? 0.5 : 1;
        // Combined efficiency (상한 없음, 기본속도=1 기준 speedEff × 방향 × 글랜싱)
        const efficiency = speedEff * dirEff * glancingPenalty;

        return Math.max(1, Math.round(attacker.stats.baseDamage * efficiency * this.getDamageMultiplier()));
    }

    checkResult() {
        const alive = this.fighters.filter((f) => !f.flags.defeated);
        const aliveTeams = new Set(alive.map((fighter) => fighter.teamId));
        if (alive.length > 0 && aliveTeams.size === 1) {
            this.resolveResult(alive[0]);
            return;
        }
        if (alive.length === 0) {
            this.resolveResult(this.fighters.reduce((best, current) => (current.hp > best.hp ? current : best)));
        }
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
