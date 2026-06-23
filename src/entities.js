import { CombatEntity, Projectile, RENDER_LAYERS, TimedEffect, Vector2 } from "./core.js";
import { ActionContext } from "./click-actions.js";
import { DashEffect } from "./combat-effects.js";
import { computeOwnerCombatSpeed } from "./abilities/HeroAbility.js";

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

        // hit 체크 — 모든 파이터(본인 포함)에 대해 검사
        for (const fighter of simulation.fighters) {
            if (fighter.isDefeated) continue;
            const distance = Vector2.subtract(this.position, fighter.position).length();
            if (distance > this.radius + fighter.radius) continue;
            this._onHitEffects(fighter, simulation);
            this.isExpired = true;
            break;
        }
    }

    _onHitEffects(target, simulation) {
        const opponent = simulation.getOpponent(this.owner);
        const dashDirection = opponent
            ? Vector2.subtract(opponent.position, this.owner.position).normalize()
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

// ── Hero Orb effect registry ────────────────────────────────────────────────
// 확장 가능: 새 effect type을 HERO_ORB_EFFECTS에 추가하기만 하면 됨.
// 각 effect는 { color, apply(owner, context) } 형태.
// context: { orb, simulation, effectType }

/**
 * Hero Orb 스탯 성장 상한.
 * -1이면 무한 성장. 0 이상이면 Hero Orb로 얻은 해당 스탯 보너스가 그 값에 도달했을 때 더 이상 증가하지 않음.
 * cap에 걸린 경우에도 orb는 먹은 것으로 처리되어 제거됨.
 */
export let HERO_ORB_STAT_CAP = -1;
export function setHeroOrbStatCap(value) {
    HERO_ORB_STAT_CAP = value;
}

const HERO_ORB_STAT_GAIN_MIN = 1;
const HERO_ORB_STAT_GAIN_MAX = 5;

/** 1~5 랜덤 stat gain roll. rng 제어 가능. */
export function rollHeroOrbStatGain(rng = Math.random) {
    return HERO_ORB_STAT_GAIN_MIN + Math.floor(rng() * (HERO_ORB_STAT_GAIN_MAX - HERO_ORB_STAT_GAIN_MIN + 1));
}

/**
 * Cap clamp: 현재 bonus + roll amount가 cap을 넘지 않도록 amount 조정.
 * bonus가 이미 cap 이상이면 applied=false.
 */
function clampStatGain(bonusValue, rollAmount, cap) {
    if (cap >= 0 && bonusValue >= cap) return { applied: false, amount: 0 };
    if (cap >= 0) {
        const maxAdd = cap - bonusValue;
        const actual = Math.min(rollAmount, maxAdd);
        if (actual <= 0) return { applied: false, amount: 0 };
        return { applied: true, amount: actual };
    }
    return { applied: true, amount: rollAmount };
}

export const HERO_ORB_EFFECTS = {
    hp: {
        color: "#44dd44",
        label: "체력",
        /** HP +5×amount 증가, 현재 HP도 같은 값만큼 증가 */
        apply(owner, ctx) {
            const rollAmount = rollHeroOrbStatGain();
            const clamped = clampStatGain(owner.heroOrbBonuses.hp, rollAmount, HERO_ORB_STAT_CAP);
            if (!clamped.applied) return { applied: false };
            const amount = clamped.amount;
            owner.heroOrbBonuses.hp += amount;
            owner.maxHp += 5 * amount;
            owner.hp = Math.min(owner.hp + 5 * amount, owner.maxHp);
            return { applied: true, amount };
        }
    },
    damage: {
        color: "#ff4444",
        label: "힘",
        /** 대미지 +2%×amount 증가 (baseDamage 곱) */
        apply(owner, ctx) {
            const rollAmount = rollHeroOrbStatGain();
            const clamped = clampStatGain(owner.heroOrbBonuses.damage, rollAmount, HERO_ORB_STAT_CAP);
            if (!clamped.applied) return { applied: false };
            const amount = clamped.amount;
            owner.heroOrbBonuses.damage += amount;
            owner.baseDamage = Number((owner.baseDamage * Math.pow(1.02, amount)).toFixed(1));
            return { applied: true, amount };
        }
    },
    speed: {
        color: "#4488ff",
        label: "속도",
        /** 속도 +4×amount 증가 (baseSpeed flat) */
        apply(owner, ctx) {
            const rollAmount = rollHeroOrbStatGain();
            const clamped = clampStatGain(owner.heroOrbBonuses.speed, rollAmount, HERO_ORB_STAT_CAP);
            if (!clamped.applied) return { applied: false };
            const amount = clamped.amount;
            owner.heroOrbBonuses.speed += amount;
            owner.baseSpeed = Math.round(owner.baseSpeed + 4 * amount);
            return { applied: true, amount };
        }
    },
    defense: {
        color: "#dddd44",
        label: "방어",
        /** 방어력 +0.33×amount 증가 (baseDefense flat, takeDamage에서 반올림) */
        apply(owner, ctx) {
            const rollAmount = rollHeroOrbStatGain();
            const clamped = clampStatGain(owner.heroOrbBonuses.defense, rollAmount, HERO_ORB_STAT_CAP);
            if (!clamped.applied) return { applied: false };
            const amount = clamped.amount;
            owner.heroOrbBonuses.defense += amount;
            owner.baseDefense = Number((owner.baseDefense + 0.33 * amount).toFixed(2));
            return { applied: true, amount };
        }
    },
    skill: {
        color: "#bb66ff",
        label: "쿨타임",
        /** 쿨타임 +amount 증가 (statAllocation.skill과 동일한 효과, Ability.cooldown getter에서 사용) */
        apply(owner, ctx) {
            const rollAmount = rollHeroOrbStatGain();
            const clamped = clampStatGain(owner.heroOrbBonuses.skill, rollAmount, HERO_ORB_STAT_CAP);
            if (!clamped.applied) return { applied: false };
            const amount = clamped.amount;
            owner.heroOrbBonuses.skill += amount;
            return { applied: true, amount };
        }
    },
    // ── 특수 Hero Orb ───────────────────────────────────────────────
    // 스탯 UI 누적치(heroOrbBonuses)에 포함되지 않음.
    // formatHeroStatParts/formatHeroStatLine에서 제외됨.
    dash: {
        color: "#ff8833",
        label: "대시",
        /** 상대를 향해 돌진. DashEffect 재사용. */
        apply(owner, ctx) {
            const target = ctx.simulation.getOpponent(owner);
            if (!target || target.isDefeated) return { applied: false };
            const direction = Vector2.subtract(target.position, owner.position);
            if (direction.length() < 0.01) return { applied: false };
            direction.normalize();
            const speed = computeOwnerCombatSpeed(owner) * 1.5;
            owner.setMovementEffect(
                new DashEffect({
                    duration: 1.55,
                    multiplier: 1,
                    speedOverride: speed,
                    color: "#ff8833",
                    showRing: true,
                    collisionDamage: 0,
                    untilImpact: true,
                    untilWall: true
                })
            );
            owner.forceHeading(direction, 1.55);
            owner.velocity = direction.clone().scale(speed);
            ctx.simulation.spawnSlash(
                owner.position.clone(),
                Vector2.add(owner.position, direction.clone().scale(150)),
                owner.color
            );
            ctx.simulation.spawnPulse(ctx.orb.position.clone(), "#ff8833");
            ctx.simulation.playSound("dash", 0.8);
            ctx.simulation.addLog(`${owner.name} dashes toward ${target.name}!`);
            return { applied: true, amount: 1 };
        }
    },
    arrow: {
        color: "#ff6666",
        label: "화살",
        /** 상대를 향해 화살 발사. ArrowProjectile/spawnArrow 재사용. */
        apply(owner, ctx) {
            const target = ctx.simulation.getOpponent(owner);
            if (!target || target.isDefeated) return { applied: false };
            const direction = Vector2.subtract(target.position, owner.position);
            if (direction.length() < 0.01) return { applied: false };
            direction.normalize();
            const speed = computeOwnerCombatSpeed(owner) * 2.0;
            const start = Vector2.add(owner.position, direction.clone().scale(owner.radius + 12));
            ctx.simulation.spawnArrow(owner, start, direction.scale(speed));
            ctx.simulation.playSound("arrow", 0.8);
            ctx.simulation.addLog(`${owner.name} fires an arrow at ${target.name}!`);
            return { applied: true, amount: 1 };
        }
    },
    cooldown_burst: {
        color: "#66ddff",
        label: "쿨타임 버스트",
        /** 1초간 HeroAbility 쿨타임 25%로 단축. */
        apply(owner, ctx) {
            if (!owner.ability || owner.ability.constructor?.name !== "HeroAbility") {
                return { applied: false };
            }
            owner.ability.applyCooldownBurst(1.0, 0.1);
            ctx.simulation.spawnPulse(ctx.orb.position.clone(), "#66ddff");
            ctx.simulation.playSound("powerup", 1.1);
            ctx.simulation.addLog(`${owner.name} activates cooldown burst!`);
            return { applied: true, amount: 1 };
        }
    }
};

/**
 * Hero Ball 전용 스탯 줄 포맷.
 * 예: "체력 +30%(+3) · 힘 +20%(+1) · 속도 +10%"
 */
export function formatHeroStatLine(allocation = {}, bonuses = {}) {
    return formatHeroStatParts(allocation, bonuses)
        .map((part) => `${part.baseText}${part.bonusText}`)
        .join(" · ");
}

/** 스탯 orb만 UI 표시 대상 (특수 orb 제외) */
export const STAT_ORB_KEYS = ["hp", "damage", "speed", "skill", "defense"];

/** 두 bonus 객체를 합산 (carryover + currentMatch) */
export function mergeOrbBonuses(current = {}, carry = {}) {
    const result = {};
    for (const key of STAT_ORB_KEYS) {
        result[key] = (current[key] ?? 0) + (carry[key] ?? 0);
    }
    return result;
}

export function formatHeroStatParts(allocation = {}, bonuses = {}) {
    return STAT_ORB_KEYS.map((key) => {
        const effect = HERO_ORB_EFFECTS[key];
        const label = effect?.label ?? key;
        const base = allocation[key] ?? 0;
        const bonus = bonuses[key] ?? 0;
        return {
            key,
            baseText: `${label} +${base}%`,
            bonusText: bonus > 0 ? `(+${bonus})` : "",
            color: effect?.color ?? "#ffffff"
        };
    });
}

/**
/**
 * Hero Orb 스탯 1점당 효과를 owner에 적용. 랜덤 roll/text 피드백 없음.
 * carryover 적용 등에서 호출.
 */
export function applyHeroOrbStatAmount(owner, statKey, amount, opts = {}) {
    const { countAsCurrentMatch = true } = opts;
    if (amount <= 0) return;
    // 일반 스탯 orb 5종만 처리 (특수 orb 키 무시)
    if (!STAT_ORB_KEYS.includes(statKey)) return;
    if (countAsCurrentMatch && owner.heroOrbBonuses) {
        owner.heroOrbBonuses[statKey] = (owner.heroOrbBonuses[statKey] ?? 0) + amount;
    }
    switch (statKey) {
        case "hp":
            owner.maxHp += 5 * amount;
            owner.hp = Math.min(owner.hp + 5 * amount, owner.maxHp);
            break;
        case "damage":
            owner.baseDamage = Number((owner.baseDamage * Math.pow(1.02, amount)).toFixed(1));
            break;
        case "speed":
            owner.baseSpeed = Math.round(owner.baseSpeed + 4 * amount);
            break;
        case "defense":
            owner.baseDefense = Number((owner.baseDefense + 0.33 * amount).toFixed(2));
            break;
        case "skill":
            if (owner.statAllocation) {
                owner.statAllocation.skill = (owner.statAllocation.skill ?? 0) + amount;
            }
            break;
    }
}

// ── Hero Ball 승리 시 스탯 계승 (Carryover) ──────────────────────────────────

/** 계승 비율: 이번 경기 획득량 × CARRYOVER_RATE를 floor 처리 */
export const HERO_ORB_CARRYOVER_RATE = 0.5;

/** runtime heroOrbBonuses에서 carryover 계산 */
export function computeHeroOrbCarryover(gained = {}, rate = HERO_ORB_CARRYOVER_RATE) {
    const result = {};
    for (const key of STAT_ORB_KEYS) {
        const carry = Math.floor((gained[key] ?? 0) * rate);
        if (carry > 0) result[key] = carry;
    }
    return result;
}

/** winnerSpec.heroOrbCarryover에 새 carryover 누적 */
export function mergeHeroOrbCarryover(spec, gained = {}, rate = HERO_ORB_CARRYOVER_RATE) {
    const carryover = computeHeroOrbCarryover(gained, rate);
    if (Object.keys(carryover).length === 0) return carryover;
    spec.heroOrbCarryover = spec.heroOrbCarryover || { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0 };
    for (const key of Object.keys(carryover)) {
        spec.heroOrbCarryover[key] = (spec.heroOrbCarryover[key] ?? 0) + carryover[key];
    }
    return carryover;
}

/** BattleBall에 carryover 적용 (다음 매치 시작 시) */
export function applyHeroOrbCarryoverToBattleBall(ball, carryover) {
    if (!carryover) return;
    for (const key of STAT_ORB_KEYS) {
        const amount = carryover[key] ?? 0;
        if (amount <= 0) continue;
        applyHeroOrbStatAmount(ball, key, amount, { countAsCurrentMatch: false });
        ball.heroOrbCarryover[key] = (ball.heroOrbCarryover[key] ?? 0) + amount;
    }
}

/**
 * Hero Orb — Hero Ball이 던지는 스탯 공.
 * Projectile이 아닌 CombatEntity 직접 확장 (데미지 처리 흐름 타지 않음).
 */
export class HeroOrb extends CombatEntity {
    constructor(owner, position, velocity, effectType, life) {
        super(position, velocity, 12);
        this.owner = owner;
        this.ownerId = owner.id;
        this.effectType = effectType;
        this.life = life ?? Infinity;
    }

    get renderLayer() {
        return RENDER_LAYERS.FOREGROUND;
    }

    update(delta, simulation) {
        if (Number.isFinite(this.life)) this.life -= delta;
        this.position.add(this.velocity.clone().scale(delta));
        simulation.keepEntityInsideArena(this);
        if (Number.isFinite(this.life) && this.life <= 0) {
            this.isExpired = true;
            return;
        }

        // 충돌 체크 — 모든 파이터에 대해 검사
        for (const fighter of simulation.fighters) {
            if (fighter.isDefeated) continue;
            const dist = Vector2.subtract(this.position, fighter.position).length();
            if (dist > this.radius + fighter.radius) continue;

            if (fighter.id === this.ownerId) {
                // Owner collects → apply effect
                const effectDef = HERO_ORB_EFFECTS[this.effectType];
                if (effectDef) {
                    const result = effectDef.apply(fighter, {
                        orb: this,
                        simulation,
                        effectType: this.effectType
                    });
                    simulation.spawnPulse(this.position.clone(), effectDef.color);
                    if (result?.applied) {
                        simulation.spawnActionText(
                            this.position.clone(),
                            `${effectDef.label} +${result.amount}`,
                            effectDef.color
                        );
                        simulation.playSound("powerup", 0.9);
                        simulation.addLog(`${fighter.name} collects a ${effectDef.label} orb!`);
                    }
                }
            } else {
                // Opponent collects → no bonus, just remove
                simulation.playSound("bounce", 0.4);
                simulation.addLog(`${fighter.name} picks up ${this.owner.name}'s orb (no effect).`);
            }

            this.isExpired = true;
            return;
        }
    }

    /** 특수 orb인지 여부 */
    get _isSpecial() {
        return ["dash", "arrow", "cooldown_burst"].includes(this.effectType);
    }

    draw(ctx) {
        const effectDef = HERO_ORB_EFFECTS[this.effectType];
        const color = effectDef?.color ?? "#ffffff";
        const pulse = Math.sin(performance.now() / 150) * 0.15 + 1;
        const r = this.radius * pulse;

        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = this._isSpecial ? 3 : 2;
        ctx.stroke();

        // 특수 orb: 내부 기호 표시
        if (this._isSpecial) {
            ctx.fillStyle = "#ffffff";
            ctx.font = `900 ${Math.round(r * 1.1)}px Bahnschrift, "Segoe UI", sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const icon = this.effectType === "dash" ? "≫" : this.effectType === "arrow" ? "↑" : "⚡";
            ctx.fillText(icon, this.position.x, this.position.y + 1);
        }

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

        // ── Hero Orb 스탯 보너스 (전투 중 누적) ──
        this.heroOrbBonuses = { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0 };
        this.heroOrbCarryover = { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0 };

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
        if (this.bounced) this.forcedHeading = null;
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
            if (this.movementEffect.expired) {
                this.movementEffect = null;
                if (this.forcedHeading) this.forcedHeading = null;
            }
        }

        if (this.wallSlamState) {
            if (this.wallSlamState.tick(this, delta)) {
                this.wallSlamState = null;
            }
        }

        this.actionContext.tickTimers(this, delta);
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
