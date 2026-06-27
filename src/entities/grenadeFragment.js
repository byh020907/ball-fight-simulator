import { Projectile, Vector2 } from "../core.js";

const FRAGMENT_RADIUS = 6;

export class GrenadeFragment extends Projectile {
    constructor(owner, position, velocity) {
        super(owner, position, velocity, FRAGMENT_RADIUS);
        this.life = 2.0;
        this._bounceCount = 0;
    }

    update(delta, simulation) {
        this.position.add(this.velocity.clone().scale(delta));

        const px = this.position.x;
        const py = this.position.y;
        simulation.keepEntityInsideArena(this);
        if (this.position.x !== px || this.position.y !== py) {
            this._bounceCount++;
            if (this._bounceCount > 1) {
                this.isExpired = true;
                return;
            }
            simulation.addSparkBurst(this.position.clone(), "#ff9944");
            simulation.playSound("bounce", 0.4);
        }

        this.life -= delta;
        if (this.life <= 0) {
            this._onExpired(simulation);
            this.isExpired = true;
            return;
        }

        this._projectileHitCheck(simulation);
    }

    _findTarget(simulation) {
        return simulation.getOpponent(this.owner);
    }

    _getHitDamage() {
        return Math.round(this.owner.baseDamage * 1.2);
    }

    _getHitLabel() {
        return "Shrapnel";
    }

    _onHitEffects(target, simulation) {
        simulation.spawnExplosion(this.position.clone(), "#ff9944");
        simulation.spawnPulse(this.position.clone(), "#ff7676");
        simulation.playSound("explosion", 0.5);
    }

    _onExpired(simulation) {
        simulation.spawnExplosion(this.position.clone(), "#ffcc66");
        simulation.playSound("hit", 0.3);
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowColor = "#ff9944";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#ff7676";
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffcc66";
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
