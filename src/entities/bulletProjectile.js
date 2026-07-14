import { Projectile, Vector2 } from "../core.js";

export class BulletProjectile extends Projectile {
    constructor(
        owner,
        position,
        velocity,
        damageMult = 0.5,
        isFinisher = false,
        cdReduction = 0,
        sourceAbility = null
    ) {
        super(owner, position, velocity, 4);
        this.life = 3.0;
        this.angle = Math.atan2(velocity.y, velocity.x);
        this.damageMult = damageMult;
        this.isFinisher = isFinisher;
        this.cdReduction = cdReduction;
        this.sourceAbility = sourceAbility;
        this._trail = [];
        this._bounceCount = 0;
        if (isFinisher) this.radius = 6;
    }

    update(delta, simulation) {
        this._integrateAndClamp(delta, simulation);
        const px = this.position.x;
        const py = this.position.y;
        // re-check arena after clamp for bounce detection (integrate+clamp already called)
        if (this.position.x !== px || this.position.y !== py) {
            this._bounceCount++;
            simulation.addSparkBurst(this.position.clone(), "#ffdd44");
            simulation.playSound("hit", 0.3);
        }
        this._trail.push(this.position.clone());
        if (this._trail.length > 8) this._trail.shift();
        if (!this._lifecycleCheck(delta, simulation)) return;
        this.angle = Math.atan2(this.velocity.y, this.velocity.x);
        this._hitCheck(simulation);
        if (!this.isExpired) this._ownerCollectCheck(simulation);
    }

    _ownerCollectCheck(simulation) {
        const dist = Vector2.subtract(this.position, this.owner.position).length();
        if (dist > this.owner.radius + this.radius) return;
        const ability = this.sourceAbility;
        if (ability && typeof ability.timer === "number") {
            ability.timer = Math.max(0, ability.timer - this.cdReduction);
            simulation.spawnActionText(this.owner.position.clone(), `CD -${this.cdReduction.toFixed(3)}s`, "#44ddff");
            simulation.addSparkBurst(this.position.clone(), "#44ddff");
            simulation.playSound("shoot", 0.4);
        }
        this.isExpired = true;
    }

    _getHitDamage() {
        return Math.round(this.owner.stats.baseDamage * this.damageMult);
    }

    _getHitLabel() {
        return this.isFinisher ? "Finisher" : "Bullet";
    }

    _onHitEffects(target, simulation) {
        simulation.spawnSlash(
            this.position.clone(),
            Vector2.add(
                this.position,
                this.velocity
                    .clone()
                    .normalize()
                    .scale(this.isFinisher ? 60 : 30)
            ),
            this.isFinisher ? "#ff4488" : "#ffee88"
        );
        if (this.isFinisher) {
            simulation.spawnExplosion(this.position.clone(), "#ff4488");
            simulation.spawnPulse(this.position.clone(), "#ff4488");
            simulation.shakeScreen(0.15, 8);
        } else {
            simulation.spawnExplosion(this.position.clone(), "#ffdd44");
        }
        simulation.playSound("hit", this.isFinisher ? 0.9 : 0.5);
    }

    draw(ctx) {
        if (this._trail.length > 1) {
            const trailColor = this.isFinisher ? "#ff4488" : "#ffdd44";
            for (let index = 0; index < this._trail.length - 1; index++) {
                const alpha = (index / this._trail.length) * (this.isFinisher ? 0.6 : 0.4);
                ctx.fillStyle = `rgba(${this.isFinisher ? "255, 68, 136" : "255, 220, 68"}, ${alpha})`;
                ctx.beginPath();
                ctx.arc(this._trail[index].x, this._trail[index].y, this.radius * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);

        // Outer glow for finisher
        if (this.isFinisher) {
            ctx.fillStyle = "rgba(255, 68, 136, 0.25)";
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = this.isFinisher ? "#ff4488" : "#ffdd44";
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(-1, -1, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
