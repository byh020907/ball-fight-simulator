import { applyCollisionImpulse, CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { computeOwnerCombatSpeed } from "../abilities/heroAbility.js";
import CollectionGrace from "../physics/CollectionGrace.js";
import { applyMagneticAttraction } from "../physics/magneticAttraction.js";

// ── Hero Orb stat cap ────────────────────────────────────────────────────────

export let HERO_ORB_STAT_CAP = -1;
export function setHeroOrbStatCap(value) {
    HERO_ORB_STAT_CAP = value;
}

const HERO_ORB_STAT_GAIN_MIN = 2;
const HERO_ORB_STAT_GAIN_MAX = 6;
export const HERO_ORB_HP_PER_POINT = 5;

export function rollHeroOrbStatGain(rng = Math.random) {
    return HERO_ORB_STAT_GAIN_MIN + Math.floor(rng() * (HERO_ORB_STAT_GAIN_MAX - HERO_ORB_STAT_GAIN_MIN + 1));
}

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

// ── Hero Orb effect registry ────────────────────────────────────────────────

export const HERO_ORB_EFFECTS = {
    hp: {
        color: "#44dd44",
        label: "체력",
        apply(owner, ctx) {
            const rollAmount = rollHeroOrbStatGain();
            const clamped = clampStatGain(owner.hero.bonuses.hp, rollAmount, HERO_ORB_STAT_CAP);
            if (!clamped.applied) return { applied: false };
            const amount = clamped.amount;
            owner.hero.bonuses.hp += amount;
            owner.maxHp += HERO_ORB_HP_PER_POINT * amount;
            owner.hp = Math.min(owner.hp + HERO_ORB_HP_PER_POINT * amount, owner.maxHp);
            return { applied: true, amount };
        }
    },
    damage: {
        color: "#ff4444",
        label: "힘",
        apply(owner, ctx) {
            const rollAmount = rollHeroOrbStatGain();
            const clamped = clampStatGain(owner.hero.bonuses.damage, rollAmount, HERO_ORB_STAT_CAP);
            if (!clamped.applied) return { applied: false };
            const amount = clamped.amount;
            owner.hero.bonuses.damage += amount;
            owner.stats.baseDamage = Number((owner.stats.baseDamage * Math.pow(1.02, amount)).toFixed(1));
            return { applied: true, amount };
        }
    },
    speed: {
        color: "#4488ff",
        label: "속도",
        apply(owner, ctx) {
            const rollAmount = rollHeroOrbStatGain();
            const clamped = clampStatGain(owner.hero.bonuses.speed, rollAmount, HERO_ORB_STAT_CAP);
            if (!clamped.applied) return { applied: false };
            const amount = clamped.amount;
            owner.hero.bonuses.speed += amount;
            owner.stats.baseSpeed = Math.round(owner.stats.baseSpeed + 4 * amount);
            return { applied: true, amount };
        }
    },
    defense: {
        color: "#dddd44",
        label: "방어",
        apply(owner, ctx) {
            const rollAmount = rollHeroOrbStatGain();
            const clamped = clampStatGain(owner.hero.bonuses.defense, rollAmount, HERO_ORB_STAT_CAP);
            if (!clamped.applied) return { applied: false };
            const amount = clamped.amount;
            owner.hero.bonuses.defense += amount;
            owner.stats.baseDefense = Number((owner.stats.baseDefense + 0.33 * amount).toFixed(2));
            return { applied: true, amount };
        }
    },
    skill: {
        color: "#bb66ff",
        label: "쿨타임",
        apply(owner, ctx) {
            const rollAmount = rollHeroOrbStatGain();
            const clamped = clampStatGain(owner.hero.bonuses.skill, rollAmount, HERO_ORB_STAT_CAP);
            if (!clamped.applied) return { applied: false };
            const amount = clamped.amount;
            owner.hero.bonuses.skill += amount;
            return { applied: true, amount };
        }
    },
    critical: {
        color: "#ff7bd5",
        label: "치명타",
        apply(owner) {
            const rollAmount = rollHeroOrbStatGain();
            const available = Math.max(0, 100 - owner.getCriticalChance());
            const amount = Math.min(rollAmount, available);
            if (amount <= 0) return { applied: false, amount: 0 };
            owner.hero.bonuses.critical = (owner.hero.bonuses.critical ?? 0) + amount;
            owner.stats.criticalChance = Math.min(100, owner.stats.criticalChance + amount);
            return { applied: true, amount };
        }
    }
};

// ── Formatting helpers ───────────────────────────────────────────────────────

export function formatHeroStatLine(allocation = {}, bonuses = {}) {
    return formatHeroStatParts(allocation, bonuses)
        .map((part) => `${part.baseText}${part.bonusText}`)
        .join(" · ");
}

export const STAT_ORB_KEYS = ["hp", "damage", "speed", "skill", "defense", "critical"];

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

export function applyHeroOrbStatAmount(owner, statKey, amount, opts = {}) {
    const { countAsCurrentMatch = true } = opts;
    if (amount <= 0) return;
    if (!STAT_ORB_KEYS.includes(statKey)) return;
    if (countAsCurrentMatch && owner.hero.bonuses) {
        owner.hero.bonuses[statKey] = (owner.hero.bonuses[statKey] ?? 0) + amount;
    }
    switch (statKey) {
        case "hp":
            owner.maxHp += HERO_ORB_HP_PER_POINT * amount;
            owner.hp = Math.min(owner.hp + HERO_ORB_HP_PER_POINT * amount, owner.maxHp);
            break;
        case "damage":
            owner.stats.baseDamage = Number((owner.stats.baseDamage * Math.pow(1.02, amount)).toFixed(1));
            break;
        case "speed":
            owner.stats.baseSpeed = Math.round(owner.stats.baseSpeed + 4 * amount);
            break;
        case "defense":
            owner.stats.baseDefense = Number((owner.stats.baseDefense + 0.33 * amount).toFixed(2));
            break;
        case "skill":
            if (owner.stats?.allocation) {
                owner.stats.allocation.skill = (owner.stats.allocation.skill ?? 0) + amount;
            }
            break;
        case "critical":
            owner.stats.criticalChance = Math.min(100, owner.stats.criticalChance + amount);
            break;
    }
}

// ── Carryover ────────────────────────────────────────────────────────────────

export const HERO_ORB_CARRYOVER_RATE = 0.5;

export function computeHeroOrbCarryover(gained = {}, rate = HERO_ORB_CARRYOVER_RATE) {
    const result = {};
    for (const key of STAT_ORB_KEYS) {
        const carry = Math.floor((gained[key] ?? 0) * rate);
        if (carry > 0) result[key] = carry;
    }
    return result;
}

export function mergeHeroOrbCarryover(spec, gained = {}, rate = HERO_ORB_CARRYOVER_RATE) {
    const carryover = computeHeroOrbCarryover(gained, rate);
    if (Object.keys(carryover).length === 0) return carryover;
    spec.hero = spec.hero || {};
    spec.hero.carryover = spec.hero.carryover || { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0, critical: 0 };
    for (const key of Object.keys(carryover)) {
        spec.hero.carryover[key] = (spec.hero.carryover[key] ?? 0) + carryover[key];
    }
    return carryover;
}

export function applyHeroOrbCarryoverToBattleBall(ball, carryover) {
    if (!carryover) return;
    for (const key of STAT_ORB_KEYS) {
        const amount = carryover[key] ?? 0;
        if (amount <= 0) continue;
        applyHeroOrbStatAmount(ball, key, amount, { countAsCurrentMatch: false });
        ball.hero.carryover[key] = (ball.hero.carryover[key] ?? 0) + amount;
    }
}

// ── Hero Orb entity ──────────────────────────────────────────────────────────

export class HeroOrb extends CollectionGrace(CombatEntity) {
    constructor(
        owner,
        position,
        velocity,
        effectType,
        life,
        { collectionGraceDuration = 0, sourceAbility = null } = {}
    ) {
        super(position, velocity, 12);
        this.owner = owner;
        this.ownerId = owner.id;
        this.effectType = effectType;
        this.sourceAbility = sourceAbility;
        this.life = life ?? Infinity;
        this.mass = 2;
        this.color = HERO_ORB_EFFECTS[effectType]?.color ?? "#ffffff";
        this.initializeCollectionGrace(collectionGraceDuration);
    }

    get renderLayer() {
        return RENDER_LAYERS.FOREGROUND;
    }

    update(delta, simulation) {
        this.tickLife(delta);
        const isCollectionGraceActive = this.tickCollectionGrace(delta);
        if (!isCollectionGraceActive) this._applyOwnerMagnet(delta);
        this.integrate(delta);
        simulation.keepEntityInsideArena(this);
        if (Number.isFinite(this.life) && this.life <= 0) {
            this.isExpired = true;
            return;
        }

        for (const fighter of simulation.fighters) {
            if (fighter.flags.defeated) continue;
            const difference = Vector2.subtract(this.position, fighter.position);
            const dist = difference.length();
            const overlap = this.radius + fighter.radius - dist;
            if (overlap <= 0) continue;

            const normal = dist > 0 ? difference.normalize() : new Vector2(1, 0);

            if (fighter.id === this.ownerId) {
                if (isCollectionGraceActive) continue;
                const effectDef = HERO_ORB_EFFECTS[this.effectType];
                if (effectDef) {
                    const sourceAbility = this._resolveSourceAbility();
                    const result = effectDef.apply(fighter, {
                        orb: this,
                        simulation,
                        effectType: this.effectType,
                        sourceAbility
                    });
                    simulation.spawnPulse(this.position.clone(), effectDef.color);
                    if (result?.applied) {
                        sourceAbility?.onOrbCollected?.(this, result);
                        simulation.spawnActionText(
                            this.position.clone(),
                            `${effectDef.label} +${result.amount}`,
                            effectDef.color
                        );
                        simulation.playSound("powerup", 0.9);
                        simulation.addLog(`${fighter.name} collects a ${effectDef.label} orb!`);
                    }
                }
                this.isExpired = true;
                return;
            }

            // 상대와 충돌: orb만 튕겨나감 (fighter는 밀리지 않음)
            this.position.add(normal.clone().scale(overlap + 0.6));
            applyCollisionImpulse(this, fighter, normal, 0.4, { impactA: 0, minApproachSpeed: 60 });
            simulation.playSound("bounce", 0.3);
            return;
        }
    }

    _applyOwnerMagnet(delta) {
        const attraction = this._resolveSourceAbility()?.getOrbAttraction?.(this);
        if (!attraction || this.owner.flags.defeated) return;

        applyMagneticAttraction(this, this.owner, delta, {
            radius: attraction.radius,
            responseRate: attraction.responseRate,
            attractionSpeed: computeOwnerCombatSpeed(this.owner) * 1.35
        });
    }

    _resolveSourceAbility() {
        return this.sourceAbility ?? this.owner.abilities?.getByAbilityId("hero") ?? null;
    }

    draw(ctx) {
        const effectDef = HERO_ORB_EFFECTS[this.effectType];
        const color = effectDef?.color ?? "#ffffff";
        const pulse = Math.sin(performance.now() / 150) * 0.15 + 1;
        const r = this.radius * pulse;

        ctx.save();
        ctx.strokeStyle = "#ffe89a";
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let side = 0; side < 6; side += 1) {
            const angle = -Math.PI / 2 + (Math.PI * 2 * side) / 6;
            const x = this.position.x + Math.cos(angle) * (r + 3);
            const y = this.position.y + Math.sin(angle) * (r + 3);
            if (side === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, r * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 232, 154, 0.68)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.position.x, this.position.y);
        ctx.lineTo(this.owner.position.x, this.owner.position.y);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = `900 ${Math.round(r * 0.9)}px Bahnschrift, "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const icons = { hp: "+", damage: "◆", speed: "›", defense: "■", skill: "↻", critical: "★" };
        ctx.fillText(icons[this.effectType] ?? "•", this.position.x, this.position.y + 1);

        ctx.restore();
    }
}
