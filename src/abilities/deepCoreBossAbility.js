import { Ability } from "./ability.js";
import { Vector2 } from "../core.js";
import { CooldownBank } from "../physics/index.js";
import { createHuntingMobSpec } from "../hunting/huntingMonsters.js";
import { HUNTING_MONSTER_TYPES } from "../hunting/huntingConfig.js";

// 보스 밸런스 조정은 이 객체에서만 한다. 갑각/소환/공격 주기를 다른 로직에 숫자로 흩뜨리지 않는다.
export const DEEP_CORE_CONFIG = Object.freeze({
    armorPieceCount: 4,
    armorMaxHpRatio: 0.06,
    armorDamageReductionPerPiece: 0.12,
    wallBreakRatio: 0.5,
    wallStunDuration: 0.22,
    vulnerableDuration: 2,
    repairAbsorbDuration: 1,
    repairArrivalGap: 16,
    repairReturnImpulse: 820,
    summonInterval: Object.freeze({ normal: 8, final: 6 }),
    summonLimit: 4,
    summonBatch: 2,
    pursuitImpulse: 78,
    shockwaveRadius: 220,
    shockwaveImpulse: 320,
    shockwaveDamageRatio: 0.9,
    shockwaveCooldown: Object.freeze([5.2, 4.4, 3.8]),
    chargeCooldown: Object.freeze([6.4, 5.2, 4.2]),
    chargeSpeed: Object.freeze([500, 560, 620]),
    chargeDuration: 0.48,
    comboChargeDelay: 0.36
});

const COOLDOWN_KEYS = Object.freeze({
    summon: "summon",
    shockwave: "shockwave",
    charge: "charge",
    comboCharge: "comboCharge"
});

function getPhase(hp, maxHp) {
    const ratio = maxHp > 0 ? hp / maxHp : 0;
    return ratio <= 0.35 ? 2 : ratio <= 0.7 ? 1 : 0;
}

function getDirectionalArmorIndex(ownerPosition, sourcePosition, rotation = 0) {
    if (!sourcePosition) return 0;
    const delta = Vector2.subtract(sourcePosition, ownerPosition);
    const relativeAngle = Math.atan2(delta.y, delta.x) - rotation;
    return ((Math.round(relativeAngle / (Math.PI / 2)) % 4) + 4) % 4;
}

function getArmorRenderScale(hp, maximum) {
    return 0.55 + (Math.max(0, hp) / Math.max(1, maximum)) * 0.45;
}

export class DeepCoreBossAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, 0);
        const armorHp = Math.round(owner.maxHp * DEEP_CORE_CONFIG.armorMaxHpRatio);
        this.state = {
            armor: Array.from({ length: DEEP_CORE_CONFIG.armorPieceCount }, () => armorHp),
            armorHp,
            vulnerableRemaining: 0,
            wallStunRemaining: 0,
            phase: 0,
            repair: null,
            queuedComboCharges: 0
        };
        this.cooldowns = new CooldownBank({
            [COOLDOWN_KEYS.summon]: DEEP_CORE_CONFIG.summonInterval.normal,
            [COOLDOWN_KEYS.shockwave]: DEEP_CORE_CONFIG.shockwaveCooldown[0],
            [COOLDOWN_KEYS.charge]: DEEP_CORE_CONFIG.chargeCooldown[0],
            [COOLDOWN_KEYS.comboCharge]: DEEP_CORE_CONFIG.comboChargeDelay
        });
        this.cooldowns.reset(COOLDOWN_KEYS.summon);
        this.cooldowns.reset(COOLDOWN_KEYS.shockwave);
        this.cooldowns.reset(COOLDOWN_KEYS.charge);
        this.cooldowns.clear(COOLDOWN_KEYS.comboCharge);
        this._summonSerial = 0;
        this._repairParticleRemaining = 0;
    }

    update(delta, target) {
        this.state.phase = getPhase(this.owner.hp, this.owner.maxHp);
        this.cooldowns.tick(delta);
        if (this._updateWallStun(delta)) return;
        if (this._updateVulnerability(delta)) return;
        if (this.state.repair) this._updateRepair(delta);
        else this._tryBeginRepair();
        this._trySummon();
        if (!target) return;
        this._moveToward(target, delta);
        this._updateAttacks(target);
    }

    absorbIncomingDamage(damage, source) {
        if (this.state.vulnerableRemaining > 0) return { remainingDamage: damage, absorbedDamage: 0 };
        const armorIndex = getDirectionalArmorIndex(this.owner.position, source?.position, this._getArmorRotation());
        const activeArmorCount = this.state.armor.filter((hp) => hp > 0).length;
        const absorbedDamage = damage * DEEP_CORE_CONFIG.armorDamageReductionPerPiece * activeArmorCount;
        if (this.state.armor[armorIndex] > 0) this._damageArmor(armorIndex, damage);
        return { remainingDamage: damage - absorbedDamage, absorbedDamage };
    }

    onFighterStaticCollision(owner, context) {
        if (owner !== this.owner || !context?.wall) return;
        const armorIndex = getDirectionalArmorIndex(
            this.owner.position,
            context.contactPoint,
            this._getArmorRotation()
        );
        this._damageArmor(armorIndex, this.state.armorHp * DEEP_CORE_CONFIG.wallBreakRatio);
        if (this.state.wallStunRemaining <= 0) {
            this.state.wallStunRemaining = DEEP_CORE_CONFIG.wallStunDuration;
            this.owner.applyImpulse(this.owner.velocity.clone().scale(-1));
            this.owner.clearDash();
        }
    }

    onOwnerDefeated() {
        for (const hp of this.state.armor) {
            if (hp <= 0) continue;
            this.simulation.spawnParticleBurst(this.owner.position.clone(), "#73533d", {
                count: 8,
                speed: 230,
                radiusMin: 3,
                radiusMax: 7,
                gravity: 920
            });
        }
        for (const summon of [...this.simulation.fighters]) {
            if (summon.hunting?.isDeepCoreSummon) this.simulation.despawnFighter(summon);
        }
        this.state.armor.fill(0);
        this.state.repair = null;
        return false;
    }

    _damageArmor(index, damage) {
        this.state.armor[index] = Math.max(0, this.state.armor[index] - damage);
        if (this.state.armor.every((hp) => hp <= 0)) {
            this.state.vulnerableRemaining = DEEP_CORE_CONFIG.vulnerableDuration;
            this.state.repair = null;
            this.simulation.spawnParticleBurst(this.owner.position.clone(), "#f4c36b", {
                count: 24,
                speed: 260,
                radiusMin: 3,
                radiusMax: 7,
                gravity: 860
            });
            this.simulation.spawnPulse(this.owner.position.clone(), "#fff0a5");
        }
    }

    _updateVulnerability(delta) {
        if (this.state.vulnerableRemaining <= 0) return false;
        this.state.vulnerableRemaining = Math.max(0, this.state.vulnerableRemaining - delta);
        if (this.state.vulnerableRemaining === 0) this._restoreOneArmor();
        return true;
    }

    _updateWallStun(delta) {
        if (this.state.wallStunRemaining <= 0) return false;
        this.state.wallStunRemaining = Math.max(0, this.state.wallStunRemaining - delta);
        return this.state.wallStunRemaining > 0;
    }

    _restoreOneArmor() {
        const armorIndex = this.state.armor.findIndex((hp) => hp <= 0);
        if (armorIndex < 0) return;
        this.state.armor[armorIndex] = this.state.armorHp;
        this.simulation.spawnPulse(this.owner.position.clone(), "#9b6a48");
    }

    _tryBeginRepair() {
        const armorIndex = this.state.armor.findIndex((hp) => hp <= 0);
        const summon = this.simulation.fighters.find(
            (fighter) => fighter.hunting?.isDeepCoreSummon && !fighter.flags.defeated && !fighter.hunting.isReturning
        );
        if (armorIndex < 0 || !summon) return;
        summon.hunting.isReturning = true;
        this.state.repair = {
            summon,
            armorIndex,
            phase: "returning",
            absorbRemaining: DEEP_CORE_CONFIG.repairAbsorbDuration
        };
    }

    _updateRepair(delta) {
        const repair = this.state.repair;
        if (!repair || repair.summon.flags.defeated || repair.summon.isExpired) {
            this.state.repair = null;
            return;
        }
        const offset = Vector2.subtract(this.owner.position, repair.summon.position);
        const arrivalDistance = this.owner.radius + repair.summon.radius + DEEP_CORE_CONFIG.repairArrivalGap;
        if (repair.phase === "returning") {
            if (offset.length() > arrivalDistance) {
                repair.summon.applyImpulse(offset.normalize().scale(DEEP_CORE_CONFIG.repairReturnImpulse * delta));
                return;
            }
            repair.phase = "absorbing";
            repair.summon.freezeForResult();
        }
        repair.absorbRemaining = Math.max(0, repair.absorbRemaining - delta);
        const progress = 1 - repair.absorbRemaining / DEEP_CORE_CONFIG.repairAbsorbDuration;
        repair.summon.display.scale = Math.max(0.15, 1 - progress);
        this._emitRepairParticles(delta, repair.summon.position, progress);
        if (repair.absorbRemaining > 0) return;
        this.state.armor[repair.armorIndex] = this.state.armorHp;
        this.simulation.despawnFighter(repair.summon);
        this.simulation.spawnPulse(this.owner.position.clone(), "#73533d");
        this.state.repair = null;
    }

    _emitRepairParticles(delta, summonPosition, progress) {
        this._repairParticleRemaining -= delta;
        if (this._repairParticleRemaining > 0) return;
        this._repairParticleRemaining = 0.08;
        const towardCore = Vector2.subtract(this.owner.position, summonPosition);
        const position = summonPosition.clone().add(towardCore.scale(progress));
        this.simulation.spawnParticleBurst(position, "#b77b53", {
            count: 2,
            speed: 45,
            radiusMin: 2,
            radiusMax: 4,
            gravity: 0,
            life: 0.45,
            upBias: 0
        });
    }

    _trySummon() {
        if (!this.cooldowns.isReady(COOLDOWN_KEYS.summon)) return;
        const interval =
            this.state.phase === 2 ? DEEP_CORE_CONFIG.summonInterval.final : DEEP_CORE_CONFIG.summonInterval.normal;
        this.cooldowns.reset(COOLDOWN_KEYS.summon, interval);
        const alive = this.simulation.fighters.filter(
            (fighter) => fighter.hunting?.isDeepCoreSummon && !fighter.flags.defeated
        ).length;
        const count = Math.max(0, Math.min(DEEP_CORE_CONFIG.summonBatch, DEEP_CORE_CONFIG.summonLimit - alive));
        for (let index = 0; index < count; index += 1) this._summonPursuer(index, count);
    }

    _summonPursuer(index, count) {
        const serial = this._summonSerial++;
        const spec = createHuntingMobSpec({
            type: HUNTING_MONSTER_TYPES.PURSUER,
            floor: 100,
            index: serial,
            stageId: "cave"
        });
        spec.id = `deep-core-summon-${this.owner.id}-${serial}`;
        spec.hunting = {
            ...spec.hunting,
            isDeepCoreSummon: true,
            suppressLootDrop: true,
            lootMultiplier: 0
        };
        const angle = (Math.PI * 2 * index) / Math.max(1, count) + serial * 0.73;
        const position = Vector2.add(
            this.owner.position,
            Vector2.fromAngle(angle, this.owner.radius + spec.stats.radius + 45)
        );
        this.simulation.spawnFighter(spec, position);
        this.simulation.spawnParticleBurst(position, "#8a6148", {
            count: 12,
            speed: 150,
            radiusMin: 2,
            radiusMax: 5,
            gravity: 720
        });
    }

    _moveToward(target, delta) {
        if (this.owner.state.movement) return;
        const direction = Vector2.subtract(target.position, this.owner.position);
        if (direction.length() > 0.001)
            this.owner.applyImpulse(direction.normalize().scale(DEEP_CORE_CONFIG.pursuitImpulse * delta));
    }

    _updateAttacks(target) {
        if (this.state.queuedComboCharges > 0 && this.cooldowns.isReady(COOLDOWN_KEYS.comboCharge)) {
            this._charge(target);
            this.state.queuedComboCharges -= 1;
            if (this.state.queuedComboCharges > 0) this.cooldowns.reset(COOLDOWN_KEYS.comboCharge);
        }
        if (this.cooldowns.isReady(COOLDOWN_KEYS.shockwave)) {
            this.cooldowns.reset(COOLDOWN_KEYS.shockwave, DEEP_CORE_CONFIG.shockwaveCooldown[this.state.phase]);
            this._shockwave();
            if (this.state.phase >= 1) {
                this.state.queuedComboCharges = this.state.phase === 2 ? 2 : 1;
                this.cooldowns.reset(COOLDOWN_KEYS.comboCharge);
            }
        }
        if (this.cooldowns.isReady(COOLDOWN_KEYS.charge) && !this.owner.state.movement) {
            this.cooldowns.reset(COOLDOWN_KEYS.charge, DEEP_CORE_CONFIG.chargeCooldown[this.state.phase]);
            this._charge(target);
        }
    }

    _charge(target) {
        const direction = Vector2.subtract(target.position, this.owner.position);
        if (direction.length() <= 0.001) return;
        this.owner.initiateDash(direction.normalize(), {
            speedOverride: DEEP_CORE_CONFIG.chargeSpeed[this.state.phase],
            duration: DEEP_CORE_CONFIG.chargeDuration,
            color: "#c8733e",
            collisionDamage: 1.25,
            collisionLabel: "Deep Core Charge"
        });
        this.simulation.spawnPulse(this.owner.position.clone(), "#d88b4b");
    }

    _shockwave() {
        this.simulation.spawnPulse(this.owner.position.clone(), "#c8905e");
        this.simulation.spawnParticleBurst(this.owner.position.clone(), "#8a6148", {
            count: 18,
            speed: 230,
            radiusMin: 3,
            radiusMax: 7,
            gravity: 880
        });
        for (const target of this.simulation.getEnemiesOf(this.owner)) {
            const offset = Vector2.subtract(target.position, this.owner.position);
            if (offset.length() > DEEP_CORE_CONFIG.shockwaveRadius) continue;
            target.takeDamage(
                this.owner.stats.baseDamage * DEEP_CORE_CONFIG.shockwaveDamageRatio,
                this.owner,
                "Shockwave"
            );
            target.applyKnockback(offset.normalize().scale(DEEP_CORE_CONFIG.shockwaveImpulse), 0.18);
        }
    }

    draw(ctx) {
        const { position, radius } = this.owner;
        ctx.save();
        if (this.state.vulnerableRemaining > 0) this._drawVulnerability(ctx, position, radius);
        for (const [index, hp] of this.state.armor.entries()) {
            const repairProgress =
                this.state.repair?.phase === "absorbing" && this.state.repair.armorIndex === index
                    ? 1 - this.state.repair.absorbRemaining / DEEP_CORE_CONFIG.repairAbsorbDuration
                    : 0;
            const displayHp = Math.max(hp, this.state.armorHp * repairProgress);
            if (displayHp <= 0) continue;
            this._drawArmorPiece(ctx, index, displayHp);
        }
        ctx.restore();
    }

    _drawVulnerability(ctx, position, radius) {
        const pulse = 0.5 + Math.sin(this.simulation.elapsed * 16) * 0.5;
        ctx.strokeStyle = `rgba(255, 231, 144, ${0.45 + pulse * 0.4})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(position.x, position.y, radius * (1.12 + pulse * 0.08), 0, Math.PI * 2);
        ctx.stroke();
    }

    _drawArmorPiece(ctx, index, hp) {
        const { position, radius } = this.owner;
        const angle = (index * Math.PI) / 2 + this._getArmorRotation();
        const center = Vector2.add(position, Vector2.fromAngle(angle, radius * 1.55));
        const size = radius * 0.42 * getArmorRenderScale(hp, this.state.armorHp);
        ctx.fillStyle = "#73533d";
        ctx.strokeStyle = "#34251c";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let vertex = 0; vertex < 6; vertex += 1) {
            const vertexAngle = angle + (vertex * Math.PI * 2) / 6;
            const irregularity = vertex % 2 === 0 ? 1 : 0.78;
            const point = Vector2.add(center, Vector2.fromAngle(vertexAngle, size * irregularity));
            if (vertex === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    _getArmorRotation() {
        return this.simulation.elapsed * (0.35 + this.state.phase * 0.12);
    }
}
