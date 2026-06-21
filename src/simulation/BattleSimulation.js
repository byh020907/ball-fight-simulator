import { Vector2 } from "../core.js";
import {
    ArcherAbility,
    EaterAbility,
    GrenadeAbility,
    OrbitAbility,
    RageAbility,
    TricksterAbility,
    DashAbility,
    BatBallAbility
} from "../abilities/index.js";
import { BattleBall } from "../entities.js";
import { GravityParticle } from "../effects.js";
import { Simulation } from "./Simulation.js";

export class BattleSimulation extends Simulation {
    constructor(fighterSpecs, hooks) {
        super();
        this.hooks = hooks;
        const spawnPoints = this.createSpawnPoints(fighterSpecs.length);
        this.fighters = fighterSpecs.map((spec, index) => new BattleBall(spec, spawnPoints[index]));
        this.fighters[0].simulation = this;
        this.fighters[1].simulation = this;
        this.fighters[0].bindAbility(this.createAbility(fighterSpecs[0].ability, this.fighters[0]));
        this.fighters[1].bindAbility(this.createAbility(fighterSpecs[1].ability, this.fighters[1]));
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
        const table = {
            archer: ArcherAbility,
            orbit: OrbitAbility,
            trickster: TricksterAbility,
            grenade: GrenadeAbility,
            dash: DashAbility,
            rage: RageAbility,
            eater: EaterAbility,
            bat_ball: BatBallAbility
        };
        return new table[type](owner, this);
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
    getSpeedMultiplier() {
        return this.isOvertime() ? Math.min(1.58, 1.12 + this.getOvertimeProgress() * 0.026) : 1;
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

        this.handleCollision();

        for (const entity of this.entities) {
            entity.update(delta, this);
        }
        this.entities = this.entities.filter((entity) => !entity.isExpired);

        this.checkResult();
    }

    handleCollision() {
        const [a, b] = this.fighters;
        if (a.isDefeated || b.isDefeated || a.swallowedState || b.swallowedState) return;

        const difference = Vector2.subtract(b.position, a.position);
        const distance = difference.length();
        const overlap = a.radius + b.radius - distance;
        if (overlap <= 0) return;

        const normal = difference.normalize();
        a.position.add(normal.clone().scale(-overlap / 2));
        b.position.add(normal.clone().scale(overlap / 2));

        const aModifiers = a.getStatModifiers();
        const bModifiers = b.getStatModifiers();
        const damageFromAToB = this.calculateCollisionDamage(a, b, normal) * aModifiers.damage;
        const damageFromBToA = this.calculateCollisionDamage(b, a, normal.clone().scale(-1)) * bModifiers.damage;

        a.takeDamage(damageFromBToA, b, "Crash");
        b.takeDamage(damageFromAToB, a, "Crash");

        const tangent = new Vector2(-normal.y, normal.x);
        const aNormal = a.velocity.x * normal.x + a.velocity.y * normal.y;
        const bNormal = b.velocity.x * normal.x + b.velocity.y * normal.y;
        const aTangent = a.velocity.x * tangent.x + a.velocity.y * tangent.y;
        const bTangent = b.velocity.x * tangent.x + b.velocity.y * tangent.y;

        const nextANormal = (aNormal * (a.mass - b.mass) + 2 * b.mass * bNormal) / (a.mass + b.mass);
        const nextBNormal = (bNormal * (b.mass - a.mass) + 2 * a.mass * aNormal) / (a.mass + b.mass);

        a.velocity = tangent
            .clone()
            .scale(aTangent)
            .add(normal.clone().scale(nextANormal * bModifiers.impact));
        b.velocity = tangent
            .clone()
            .scale(bTangent)
            .add(normal.clone().scale(nextBNormal * aModifiers.impact));

        if (a.dashState) {
            if (a.dashState.collisionDamage) {
                b.takeDamage(a.dashState.collisionDamage, a, a.dashState.collisionLabel);
                if (a.dashState.collisionSlow)
                    b.applySlow(a.dashState.collisionSlow.duration, a.dashState.collisionSlow.amount);
            }
            a.ability?.onDashHit?.(b, a.dashState);
        }
        if (b.dashState) {
            if (b.dashState.collisionDamage) {
                a.takeDamage(b.dashState.collisionDamage, b, b.dashState.collisionLabel);
                if (b.dashState.collisionSlow)
                    a.applySlow(b.dashState.collisionSlow.duration, b.dashState.collisionSlow.amount);
            }
            b.ability?.onDashHit?.(a, b.dashState);
        }
        if (a.dashState?.untilImpact) a.clearDash();
        if (b.dashState?.untilImpact) b.clearDash();

        a.ability?.onCollision(b);
        b.ability?.onCollision(a);

        this.playSound("crash", Math.min(1.8, 0.8 + Math.abs(damageFromAToB + damageFromBToA) / 24));
        this.addSparkBurst(Vector2.add(a.position, b.position).scale(0.5), "#ffffff");
        this.addSparkBurst(a.position.clone(), a.color);
        this.addSparkBurst(b.position.clone(), b.color);
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
