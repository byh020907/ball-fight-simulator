import { Vector2 } from "../core.js";
import { Ability } from "./ability.js";
import { BatProjectile } from "../entities/index.js";

const LIFESTEAL_RATE_NORMAL = 0.35;
const LIFESTEAL_RATE_LOW_HP = 0.5;
const LOW_HP_THRESHOLD = 0.3;
const BAT_COOLDOWN = 4.0;
const BAT_COUNT = 5;
const BAT_SPEED_MULT = 0.5;
const BAT_SPREAD_DEG = 40;

export class VampireAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, BAT_COOLDOWN);
    }

    update(delta, target) {
        this.timer -= delta;
        if (this.timer <= 0 && target) {
            this.timer = this.cooldown;
            this._spawnBats(target);
        }
    }

    _spawnBats(target) {
        const owner = this.owner;
        const baseAngle = Math.atan2(target.position.y - owner.position.y, target.position.x - owner.position.x);
        const spreadRad = (BAT_SPREAD_DEG * Math.PI) / 180;
        const speed = owner.baseSpeed * BAT_SPEED_MULT;

        const bats = [];
        const total = BAT_COUNT;
        for (let i = 0; i < total; i++) {
            const t = total > 1 ? i / (total - 1) - 0.5 : 0;
            const angle = baseAngle + t * spreadRad;
            const dir = new Vector2(Math.cos(angle), Math.sin(angle));
            const start = Vector2.add(owner.position, dir.clone().scale(owner.radius + 16));
            const bat = new BatProjectile(owner, start, dir.clone().scale(speed), bats);
            bats.push(bat);
            this.simulation.entities.push(bat);
        }
        // Link flock after all bats created
        for (const b of bats) {
            b._flock = bats;
        }
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

    onCollision(target) {
        const owner = this.owner;
        const damage = this._getCollisionDamage(owner, target);
        if (damage <= 0) return;
        const hpRatio = owner.hp / owner.maxHp;
        const rate = hpRatio < LOW_HP_THRESHOLD ? LIFESTEAL_RATE_LOW_HP : LIFESTEAL_RATE_NORMAL;
        const healAmount = Math.max(1, Math.round(damage * rate));
        owner.heal(healAmount);
        this.simulation.spawnActionText(owner.position.clone(), `+${healAmount} HP`, "#ff4466");
    }

    _getCollisionDamage(owner, target) {
        const dist = Vector2.subtract(target.position, owner.position).length();
        if (dist > owner.radius + target.radius + 10) return 0;
        const relativeSpeed = Vector2.subtract(target.velocity, owner.velocity).length();
        return Math.round(owner.baseDamage * 0.5 * Math.min(3, relativeSpeed / owner.baseSpeed));
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
