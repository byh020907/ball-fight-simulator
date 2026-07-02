import { Projectile, Vector2 } from "../core.js";

export class OrbitProjectile extends Projectile {
    constructor(owner, position, direction, size) {
        super(owner, position, new Vector2(0, 0), 11);
        this.dir = direction.clone().normalize();
        this.life = 1.2;
        this.angle = Math.atan2(this.dir.y, this.dir.x);
        this.size = size;
        this.elapsed = 0;
        this.accelDuration = 1;
        this.maxSpeed = owner.stats.baseSpeed * 5;
    }

    update(delta, simulation) {
        this.elapsed += delta;
        const progress = Math.min(1, this.elapsed / this.accelDuration);
        const speed = progress * this.maxSpeed;
        this.applyImpulse(this.dir.clone().scale(speed).subtract(this.velocity));

        const bx = this.position.x,
            by = this.position.y;
        this._integrateAndClamp(delta, simulation);
        if (this.position.x !== bx || this.position.y !== by) {
            this.dir = this.velocity.clone().normalize();
            this.angle = Math.atan2(this.dir.y, this.dir.x);
        }

        if (!this._lifecycleCheck(delta, simulation)) return;
        this._hitCheck(simulation);
    }

    _getHitDamage() {
        return Math.round(this.owner.stats.baseDamage * 0.8);
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
