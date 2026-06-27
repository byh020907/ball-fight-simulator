import { Projectile, Vector2 } from "../core.js";

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
        return Math.round(this.owner.stats.baseDamage * 1.6);
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
