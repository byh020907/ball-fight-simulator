import { Vector2 } from "../core.js";
import {
    ArcherAbility,
    EaterAbility,
    GrenadeAbility,
    OrbitAbility,
    RageAbility,
    TricksterAbility,
    DashAbility,
    BatBallAbility,
    HeroAbility
} from "../abilities/index.js";
import { BattleBall } from "../entities.js";
import { GravityParticle } from "../effects.js";
import { Simulation } from "./Simulation.js";

const ABILITY_TYPES = {
    archer: ArcherAbility,
    orbit: OrbitAbility,
    trickster: TricksterAbility,
    grenade: GrenadeAbility,
    dash: DashAbility,
    rage: RageAbility,
    eater: EaterAbility,
    bat_ball: BatBallAbility,
    hero: HeroAbility
};

export class BattleSimulation extends Simulation {
    constructor(fighterSpecs, hooks, playerBall = null) {
        super();
        this.hooks = hooks;
        const spawnPoints = this.createSpawnPoints(fighterSpecs.length);
        this.fighters = fighterSpecs.map((spec, index) => {
            const fighter = new BattleBall(spec, spawnPoints[index]);
            fighter.simulation = this;
            fighter.bindAbility(this.createAbility(spec.ability, fighter));
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
        this.resultAnimationTime = 0;
        this.resultReady = false;

        // ── 클릭 액션 시스템 ──
        this.playerBall = playerBall;
        this._clickActionContext = {
            pendingAction: null,
            timeSlowRemaining: 0,
            timeSlowFactor: 0.35
        };
    }

    /** 액션 예약 — _clickActionContext로 위임 */
    scheduleAction(actionInstance, playerBall, paidCost = 0) {
        this._clickActionContext.pendingAction = { actionInstance, playerBall, paidCost };
    }

    /** 예약된 액션을 꺼내서 적용 (update()에서 호출) */
    _consumePendingAction() {
        const ctx = this._clickActionContext;
        if (!ctx.pendingAction) return null;
        const pa = ctx.pendingAction;
        ctx.pendingAction = null;
        return pa;
    }

    // ── Action data interfaces ──────────────────────────────────────

    getTimeSlowRemaining() {
        return this._clickActionContext.timeSlowRemaining;
    }
    setTimeSlowRemaining(v) {
        this._clickActionContext.timeSlowRemaining = v;
    }
    get timeSlowFactor() {
        return this._clickActionContext.timeSlowFactor;
    }

    createSpawnPoints(count) {
        const points = [];
        const margin = 140;
        const center = new Vector2(this.width / 2, this.height / 2);
        while (points.length < count) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 170 + Math.random() * 120;
            const candidate = new Vector2(center.x + Math.cos(angle) * distance, center.y + Math.sin(angle) * distance);
            candidate.x = Math.max(margin, Math.min(this.width - margin, candidate.x));
            candidate.y = Math.max(margin, Math.min(this.height - margin, candidate.y));
            const clear = points.every((point) => Vector2.subtract(point, candidate).length() > 210);
            if (clear) points.push(candidate);
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

    update(delta) {
        if (this.finished) {
            this.updateResultEffects(delta);
            return;
        }

        // 지연 적용 패턴 — 클릭 핸들러가 예약한 액션을 충돌 전에 처리
        const pa = this._consumePendingAction();
        if (pa) {
            const { actionInstance, playerBall: pb, paidCost } = pa;
            if (actionInstance && pb) {
                this.addLog(`[액션] 효과 적용: ${actionInstance.name}`);
                actionInstance.apply(this, pb, paidCost);
            }
        }

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

        // 시간 왜곡 타이머
        const ctx = this._clickActionContext;
        if (ctx.timeSlowRemaining > 0) ctx.timeSlowRemaining -= delta;

        this.handleCollision();

        // 시간 왜곡 적용: 상대 엔티티만 느린 delta
        for (const entity of this.entities) {
            const isPlayer = entity === this.playerBall;
            const scaledDelta = ctx.timeSlowRemaining > 0 && !isPlayer ? delta * ctx.timeSlowFactor : delta;
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
        if (a.isDefeated || b.isDefeated || a.swallowedState || b.swallowedState) return;

        const difference = Vector2.subtract(b.position, a.position);
        const distance = difference.length();
        const overlap = a.radius + b.radius - distance;
        if (overlap <= 0) return;

        const normal = difference.normalize();
        this._resolveOverlap(a, b, normal, overlap);

        const aModifiers = a.getStatModifiers();
        const bModifiers = b.getStatModifiers();
        let damageFromAToB = this.calculateCollisionDamage(a, b, normal) * aModifiers.damage;
        let damageFromBToA = this.calculateCollisionDamage(b, a, normal.clone().scale(-1)) * bModifiers.damage;

        const aCollision = a.actionContext.onFighterCollision(a, b, damageFromAToB, damageFromBToA, this);
        damageFromAToB = aCollision.outgoingDamage;
        damageFromBToA = aCollision.incomingDamage;

        const bCollision = b.actionContext.onFighterCollision(b, a, damageFromBToA, damageFromAToB, this);
        damageFromBToA = bCollision.outgoingDamage;
        damageFromAToB = bCollision.incomingDamage;

        if (damageFromBToA > 0) a.takeDamage(damageFromBToA, b, "Crash");
        if (damageFromAToB > 0) b.takeDamage(damageFromAToB, a, "Crash");

        this._applyCollisionPhysics(a, b, normal, aModifiers, bModifiers);
        this._handleDashCollisions(a, b);

        a.ability?.onCollision(b);
        b.ability?.onCollision(a);

        this.playSound("crash", Math.min(1.8, 0.8 + Math.abs(damageFromAToB + damageFromBToA) / 24));
        this.addSparkBurst(Vector2.add(a.position, b.position).scale(0.5), "#ffffff");
        this.addSparkBurst(a.position.clone(), a.color);
        this.addSparkBurst(b.position.clone(), b.color);
    }

    _resolveOverlap(a, b, normal, overlap) {
        a.position.add(normal.clone().scale(-overlap / 2));
        b.position.add(normal.clone().scale(overlap / 2));
    }

    _applyCollisionPhysics(a, b, normal, aMod, bMod) {
        const tangent = new Vector2(-normal.y, normal.x);
        const aN = a.velocity.x * normal.x + a.velocity.y * normal.y;
        const bN = b.velocity.x * normal.x + b.velocity.y * normal.y;
        const aT = a.velocity.x * tangent.x + a.velocity.y * tangent.y;
        const bT = b.velocity.x * tangent.x + b.velocity.y * tangent.y;
        const nextAN = (aN * (a.mass - b.mass) + 2 * b.mass * bN) / (a.mass + b.mass);
        const nextBN = (bN * (b.mass - a.mass) + 2 * a.mass * aN) / (a.mass + b.mass);
        a.velocity = tangent
            .clone()
            .scale(aT)
            .add(normal.clone().scale(nextAN * bMod.impact));
        b.velocity = tangent
            .clone()
            .scale(bT)
            .add(normal.clone().scale(nextBN * aMod.impact));
    }

    _handleDashCollisions(a, b) {
        for (const [attacker, defender] of [
            [a, b],
            [b, a]
        ]) {
            if (!attacker.movementEffect) continue;
            attacker.movementEffect.onCollision(attacker, defender, this);
            if (attacker.movementEffect?.expired) {
                attacker.movementEffect = null;
                // 대시 종료 시 forcedHeading 제거 (overrideVelocity 유무 불문)
                if (attacker.forcedHeading) {
                    attacker.forcedHeading = null;
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
        const speedEff = attackerSpeed / attacker.baseSpeed;
        // Direction efficiency: 0~1 (alignment + hitting from the side)
        const dirEff = aimAlignment * 0.55 + sideExposure * 0.45;
        // Glancing blow penalty
        const glancingPenalty = aimAlignment < 0.22 ? 0.5 : 1;
        // Combined efficiency (상한 없음, 기본속도=1 기준 speedEff × 방향 × 글랜싱)
        const efficiency = speedEff * dirEff * glancingPenalty;

        return Math.max(1, Math.round(attacker.baseDamage * efficiency * this.getDamageMultiplier()));
    }

    checkResult() {
        const alive = this.fighters.filter((f) => !f.isDefeated);
        if (alive.length === 1) {
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
        this.loser = this.fighters.find((f) => f !== winner) ?? null;
        this.resultAnimationTime = 0;
        this.resultReady = false;
        for (const fighter of this.fighters) fighter.freezeForResult();
        if (this.loser) {
            const pos = this.loser.position.clone();
            const color = this.loser.color;
            this.loser.destroyForResult();
            this.spawnDeathExplosion(pos, color);
            this.addLog(`${this.loser.name} bursts apart in the arena.`);
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
