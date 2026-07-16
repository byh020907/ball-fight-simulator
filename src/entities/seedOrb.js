import { CombatEntity, Vector2 } from "../core.js";

export class SeedOrb extends CombatEntity {
    constructor(owner, position, velocity, life, options = {}) {
        super(position, velocity, 14);
        this.owner = owner;
        this.ownerId = owner.id;
        this.life = life;
        this.maxLife = life;
        this.collisionGraceRemaining = Math.max(0, options.collisionGrace ?? 0);
        this.collisionGraceDuration = this.collisionGraceRemaining;
    }

    update(delta, simulation) {
        if (this.tickLife(delta)) this.integrate(delta);
        simulation.keepEntityInsideArena(this);
        if (this.life <= 0) {
            this.isExpired = true;
        }

        this.collisionGraceRemaining = Math.max(0, this.collisionGraceRemaining - delta);
        if (this.collisionGraceRemaining > 1e-9) return;
        this.collisionGraceRemaining = 0;

        for (const fighter of simulation.fighters) {
            if (fighter.flags.defeated) continue;
            if (fighter !== this.owner && !simulation.isHostile(this.owner, fighter)) continue;
            const distance = Vector2.subtract(this.position, fighter.position).length();
            if (distance > this.radius + fighter.radius) continue;
            this._onHitEffects(fighter, simulation);
            this.isExpired = true;
            break;
        }
    }

    _onHitEffects(target, simulation) {
        const hostileTarget = simulation.isHostile(this.owner, target) ? target : null;
        const opponent = hostileTarget ?? simulation.getOpponent(this.owner);
        if (hostileTarget) {
            this.owner.ability?.onEnemySeedContact?.(hostileTarget);
        }
        const dashDirection = opponent
            ? Vector2.subtract(opponent.position, this.owner.position).normalize()
            : this.velocity.clone().normalize();
        this.owner.initiateDash(dashDirection, {
            duration: 1.55,
            multiplier: 2.05,
            collisionDamage: Math.round(this.owner.stats.baseDamage * 0.9),
            collisionLabel: "Seed Dash"
        });
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
        const graceProgress =
            this.collisionGraceDuration > 0 ? 1 - this.collisionGraceRemaining / this.collisionGraceDuration : 1;
        const drawRadius = this.radius * (0.55 + graceProgress * 0.45);
        ctx.save();
        ctx.globalAlpha = 0.35 + graceProgress * 0.65;
        ctx.fillStyle = this.owner.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, drawRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2 + graceProgress;
        ctx.stroke();
        if (this.collisionGraceDuration > 0) {
            ctx.strokeStyle = "#8dff6a";
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(this.position.x, this.position.y - drawRadius * 0.3);
                ctx.lineTo(this.position.x + side * drawRadius * graceProgress, this.position.y - drawRadius * 1.3);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}
