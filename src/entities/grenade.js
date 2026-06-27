import { Projectile, Vector2 } from "../core.js";

const SENSOR_RANGE = 140;
const PROXIMITY_DELAY = 0.2;

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
        this._proximityTriggered = false;
        this._proximityTimer = 0;
    }

    update(delta, simulation) {
        this.position.add(this.velocity.clone().scale(delta));

        if (this.bounces < this.maxBounces) {
            const bx = this.position.x,
                by = this.position.y;
            simulation.keepEntityInsideArena(this);
            if (this.position.x !== bx || this.position.y !== by) {
                this.bounces++;
                simulation.playSound("bounce", 0.5);
            }
        }

        if (this._proximityTriggered) {
            this._proximityTimer -= delta;
            if (this._proximityTimer <= 0) {
                this._detonate(simulation);
                return;
            }
        } else {
            this.timer -= delta;
            const target = simulation.getOpponent(this.owner);
            if (target && !target.isDefeated) {
                const distance = Vector2.subtract(this.position, target.position).length();
                if (distance <= SENSOR_RANGE && !this._proximityTriggered) {
                    this._proximityTriggered = true;
                    this._proximityTimer = PROXIMITY_DELAY;
                }
            }
        }

        if (this.timer > 0 || this._proximityTriggered) {
            return;
        }

        this._detonate(simulation);
    }

    _detonate(simulation) {
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
                const raw = Math.round(this.owner.baseDamage * (2.0 - edgeProgress));
                this.dealDamageToTarget(target, raw, this.owner, "Grenade", simulation);
                const kbDir = Vector2.subtract(target.position, this.position).normalize();
                target.applyKnockback(kbDir.scale(600), 0.5);
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
