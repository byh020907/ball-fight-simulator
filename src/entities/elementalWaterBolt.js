import { Projectile } from "../core.js";

export class ElementalWaterBolt extends Projectile {
    constructor(owner, position, velocity, ability) {
        super(owner, position, velocity, 8);
        this.life = 1.7;
        this.ability = ability;
    }

    update(delta, simulation) {
        this.updateProjectile(delta, simulation);
    }

    _getHitDamage() {
        return Math.round(this.owner.stats.baseDamage * (this.owner.getStatModifiers?.().damage ?? 1) * 0.15);
    }

    _getHitLabel() {
        return "Water Energy";
    }

    _onHitEffects(target, simulation) {
        this.ability.onWaterBoltHit(target, this.position.clone());
        simulation.spawnPulse(this.position.clone(), "#77dfff");
        simulation.playSound("hit", 0.45);
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = "#77dfff";
        ctx.strokeStyle = "#e8fbff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}
