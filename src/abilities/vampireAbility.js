import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { BatProjectile } from "../entities/index.js";
import { applyRotationalContactDamage } from "../physics/contactDamage.js";
import { Ability } from "./ability.js";

const LIFESTEAL_RATE_NORMAL = 0.35;
const LIFESTEAL_RATE_LOW_HP = 0.5;
const BAT_DAMAGE_LIFESTEAL_RATE = 0.7;
const LOW_HP_THRESHOLD = 0.3;
const BAT_COOLDOWN = 4.0;
const BAT_COUNT = 7;
const BAT_SPEED_MULT = 0.5;
const BAT_SPREAD_DEG = 40;
const BAT_LIFE_MIN = 3.25;
const BAT_LIFE_MAX = 4.75;
const BLOOD_PULL_COOLDOWN = 1;
const BLOOD_PULL_SPEED = 180;
const BLOOD_MARK_DURATION = 0.6;
const BLOOD_RUPTURE_DAMAGE_MULTIPLIER = 0.15;

class BloodTetherEffect extends CombatEntity {
    constructor(contactPoint, owner) {
        super(contactPoint.clone(), new Vector2(), 0);
        this.owner = owner;
        this.life = 0.18;
        this.maxLife = this.life;
    }

    static renderLayer = RENDER_LAYERS.FOREGROUND;

    update(delta) {
        if (this.owner.flags.destroyed || !this.tickLife(delta)) this.isExpired = true;
    }

    draw(ctx) {
        const progress = this.lifeProgress;
        const alpha = Math.max(0, 1 - progress);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#d81f4d";
        ctx.lineWidth = 2.5 - progress;
        ctx.beginPath();
        ctx.moveTo(this.position.x, this.position.y);
        ctx.lineTo(this.owner.position.x, this.owner.position.y);
        ctx.stroke();
        for (const offset of [0.25, 0.5, 0.75]) {
            const travel = Math.min(1, offset + progress * 0.7);
            const x = this.position.x + (this.owner.position.x - this.position.x) * travel;
            const y = this.position.y + (this.owner.position.y - this.position.y) * travel;
            ctx.fillStyle = "#ff426d";
            ctx.beginPath();
            ctx.arc(x, y, 2.4 * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class BloodMarkEffect extends CombatEntity {
    constructor(target) {
        super(target.position.clone(), new Vector2(), target.radius + 7);
        this.target = target;
        this.life = BLOOD_MARK_DURATION;
        this.maxLife = this.life;
    }

    static renderLayer = RENDER_LAYERS.FOREGROUND;

    update(delta) {
        if (this.target.flags.destroyed || !this.tickLife(delta)) {
            this.isExpired = true;
            return;
        }
        this.position = this.target.position.clone();
    }

    draw(ctx) {
        const pulse = 1 + Math.sin(this.lifeProgress * Math.PI * 6) * 0.08;
        const radius = (this.target.radius + 7) * pulse;
        ctx.save();
        ctx.translate(this.target.position.x, this.target.position.y);
        ctx.strokeStyle = `rgba(210, 24, 67, ${0.45 + (1 - this.lifeProgress) * 0.4})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, radius, -1.05, 1.05);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(radius * 0.55, -radius * 0.72);
        ctx.lineTo(radius * 0.2, -radius * 0.18);
        ctx.lineTo(radius * 0.48, radius * 0.08);
        ctx.lineTo(radius * 0.12, radius * 0.65);
        ctx.stroke();
        ctx.restore();
    }
}

class BloodRuptureEffect extends CombatEntity {
    constructor(position) {
        super(position.clone(), new Vector2(), 18);
        this.life = 0.32;
        this.maxLife = this.life;
    }

    static renderLayer = RENDER_LAYERS.FOREGROUND;

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = this.lifeProgress;
        const radius = progress < 0.35 ? 24 * (1 - progress / 0.35) : 10 + (progress - 0.35) * 44;
        const alpha = Math.max(0, 1 - progress);
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#ff315f";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        for (const angle of [-1.2, -0.45, 0.2, 0.9, 1.65, 2.4]) {
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * 4, Math.sin(angle) * 4);
            ctx.lineTo(Math.cos(angle) * radius * 1.35, Math.sin(angle) * radius * 1.35);
            ctx.stroke();
        }
        ctx.restore();
    }
}

export class VampireAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, BAT_COOLDOWN);
        this._bloodPullCooldowns = new Map();
        this._bloodMarks = new Map();
    }

    update(delta, target) {
        this._tickRewardState(delta);
        this.timer -= delta;
        if (this.timer <= 0 && target) {
            this.timer = this.cooldown;
            this._spawnBats(target);
        }
    }

    _tickRewardState(delta) {
        for (const [target, remaining] of this._bloodPullCooldowns) {
            const next = remaining - delta;
            if (next <= 0 || target.flags.defeated) this._bloodPullCooldowns.delete(target);
            else this._bloodPullCooldowns.set(target, next);
        }
        for (const [target, mark] of this._bloodMarks) {
            mark.remaining -= delta;
            if (mark.remaining <= 0 || target.flags.defeated) {
                mark.effect.isExpired = true;
                this._bloodMarks.delete(target);
            }
        }
    }

    _spawnBats(target) {
        const owner = this.owner;
        const upgrade = this.getLevelUpgrade();
        const baseAngle = Math.atan2(target.position.y - owner.position.y, target.position.x - owner.position.x);
        const spreadRad = (BAT_SPREAD_DEG * Math.PI) / 180;
        const speed = owner.stats.baseSpeed * BAT_SPEED_MULT * (upgrade.batSpeedMultiplier ?? 1);
        const bats = [];

        for (const index of Array.from({ length: BAT_COUNT }, (_, batIndex) => batIndex)) {
            const t = BAT_COUNT > 1 ? index / (BAT_COUNT - 1) - 0.5 : 0;
            const angle = baseAngle + t * spreadRad;
            const dir = new Vector2(Math.cos(angle), Math.sin(angle));
            const start = Vector2.add(owner.position, dir.clone().scale(owner.radius + 16));
            const life = BAT_LIFE_MIN + Math.random() * (BAT_LIFE_MAX - BAT_LIFE_MIN);
            const bat = new BatProjectile(owner, start, dir.clone().scale(speed), bats, {
                ability: this,
                life,
                repeatBite: Boolean(upgrade.repeatBite),
                lifeBurst: Boolean(upgrade.lifeBurst)
            });
            bats.push(bat);
            this.simulation.entities.push(bat);
        }
        for (const bat of bats) bat._flock = bats;
        this.simulation.spawnParticleBurst(owner.position.clone(), "#442233", {
            count: 10,
            speed: 160,
            radiusMin: 2,
            radiusMax: 4,
            gravity: 300
        });
        this.simulation.spawnPulse(owner.position.clone(), "#cc3355");
        this.simulation.playSound("shoot", 0.8);
        this.simulation.addLog(`${owner.name} releases a swarm of bats!`);
    }

    dealVampireDamage(target, rawDamage, label, { projectile = null } = {}) {
        if (rawDamage <= 0 || target.flags.defeated || !this.simulation.isHostile(this.owner, target)) {
            return { actualDamage: 0, healedAmount: 0 };
        }
        const finalDamage = projectile
            ? (target.actionContext?.onProjectileDamage?.(
                  rawDamage,
                  projectile,
                  this.owner,
                  label,
                  this.simulation,
                  target
              ) ?? rawDamage)
            : rawDamage;
        const { actualDamage } = target.takeDamage(finalDamage, this.owner, label);
        const healedAmount = actualDamage > 0 ? this.owner.heal(actualDamage * BAT_DAMAGE_LIFESTEAL_RATE) : 0;
        if (healedAmount > 0) {
            this.simulation.spawnActionText(this.owner.position.clone(), `+${healedAmount} HP`, "#ff426d");
        }
        return { actualDamage, healedAmount };
    }

    onBatBite(target, contactPoint) {
        if (!this.getLevelUpgrade().bloodPull || target.flags.defeated) return false;
        if ((this._bloodPullCooldowns.get(target) ?? 0) > 0) return false;

        const pullDirection = Vector2.subtract(this.owner.position, target.position);
        if (pullDirection.length() > 0) {
            target.applyImpulse(pullDirection.normalize().scale(BLOOD_PULL_SPEED));
        }
        this._bloodPullCooldowns.set(target, BLOOD_PULL_COOLDOWN);
        this._setBloodMark(target);
        this.simulation.entities.push(new BloodTetherEffect(contactPoint, this.owner));
        return true;
    }

    _setBloodMark(target) {
        const previous = this._bloodMarks.get(target);
        if (previous) previous.effect.isExpired = true;
        const effect = new BloodMarkEffect(target);
        this._bloodMarks.set(target, { remaining: BLOOD_MARK_DURATION, effect });
        this.simulation.entities.push(effect);
    }

    getBloodMarkRemaining(target) {
        return Math.max(0, this._bloodMarks.get(target)?.remaining ?? 0);
    }

    onCollision(target, context) {
        this._applyBodyCollisionLifesteal(target, context?.contactPoint);
        this._consumeBloodMark(target, context?.contactPoint);
    }

    _applyBodyCollisionLifesteal(target, contactPoint) {
        const owner = this.owner;
        const damage = this._getCollisionDamage(owner, target, contactPoint);
        if (damage <= 0) return;
        const hpRatio = owner.hp / owner.maxHp;
        const rate = hpRatio < LOW_HP_THRESHOLD ? LIFESTEAL_RATE_LOW_HP : LIFESTEAL_RATE_NORMAL;
        const healAmount = Math.max(1, Math.round(damage * rate));
        owner.heal(healAmount);
        this.simulation.spawnActionText(owner.position.clone(), `+${healAmount} HP`, "#ff4466");
    }

    _consumeBloodMark(target, contactPoint) {
        const mark = this._bloodMarks.get(target);
        if (!mark || mark.remaining <= 0 || !this._isDirectContact(target)) return;
        this._bloodMarks.delete(target);
        mark.effect.isExpired = true;
        const position = contactPoint?.clone?.() ?? Vector2.add(this.owner.position, target.position).scale(0.5);
        this.dealVampireDamage(target, this.owner.stats.baseDamage * BLOOD_RUPTURE_DAMAGE_MULTIPLIER, "Blood Rupture");
        this.simulation.entities.push(new BloodRuptureEffect(position));
        this.simulation.spawnParticleBurst(position, "#b5123f", {
            count: 12,
            speed: 190,
            radiusMin: 1,
            radiusMax: 4,
            gravity: 260
        });
    }

    _isDirectContact(target) {
        return (
            Vector2.subtract(target.position, this.owner.position).length() <= this.owner.radius + target.radius + 10
        );
    }

    _getCollisionDamage(owner, target, contactPoint) {
        const dist = Vector2.subtract(target.position, owner.position).length();
        if (dist > owner.radius + target.radius + 10) return 0;
        const relativeSpeed = Vector2.subtract(target.velocity, owner.velocity).length();
        const baseDamage = Math.round(
            owner.stats.baseDamage * 0.5 * Math.min(3, relativeSpeed / owner.stats.baseSpeed)
        );
        if (!contactPoint || baseDamage <= 0) return baseDamage;
        return applyRotationalContactDamage(baseDamage, owner, contactPoint);
    }

    getStatModifiers() {
        return { speed: 1, damage: 1, defense: 1, impact: 1.15 };
    }

    draw(ctx) {
        const owner = this.owner;
        const hpRatio = owner.hp / owner.maxHp;
        if (hpRatio >= LOW_HP_THRESHOLD) return;
        ctx.save();
        ctx.strokeStyle = "#ff4466";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3 + (1 - hpRatio / LOW_HP_THRESHOLD) * 0.4;
        ctx.beginPath();
        ctx.arc(owner.position.x, owner.position.y, owner.radius + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    drawFace(ctx, rotation, ball) {
        this._dotEye(ctx, ball, -0.2, -0.06, 0.055);
        this._dotEye(ctx, ball, 0.2, -0.06, 0.055);
        this._arc(ctx, ball, 0, 0.22, 0.18, 0.2, Math.PI - 0.2);
        this._line(ctx, ball, [
            [-0.15, 0.18],
            [-0.08, 0.28]
        ]);
        this._line(ctx, ball, [
            [0.08, 0.28],
            [0.15, 0.18]
        ]);
        return true;
    }

    getUiState() {
        return {
            label: "Bats",
            progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }
}
