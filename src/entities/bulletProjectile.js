import { Projectile, Vector2 } from "../core.js";

export class BulletProjectile extends Projectile {
    constructor(
        owner,
        position,
        velocity,
        damageMult = 0.5,
        isFinisher = false,
        cdReduction = 0,
        sourceAbility = null,
        options = {}
    ) {
        super(owner, position, velocity, 4);
        this.life = 3.0;
        this.angle = Math.atan2(velocity.y, velocity.x);
        this.damageMult = damageMult;
        this.isFinisher = isFinisher;
        this.cdReduction = cdReduction;
        this.sourceAbility = sourceAbility;
        this.canBounce = options.canBounce ?? true;
        this.canCollect = options.canCollect ?? true;
        this.canRefire = options.canRefire ?? true;
        this.canStack = options.canStack ?? true;
        this.retargetAfterBounce = options.retargetAfterBounce ?? false;
        this.retargetConsumed = false;
        this.isRefire = options.isRefire ?? false;
        this.turretShot = options.turretShot ?? false;
        this.age = 0;
        this._trail = [];
        this._bounceCount = 0;
        if (isFinisher) this.radius = 7;
    }

    update(delta, simulation) {
        this.age += delta;
        this.integrate(delta);
        const unclamped = this.position.clone();
        simulation.keepEntityInsideArena(this);
        const bounced = this.position.x !== unclamped.x || this.position.y !== unclamped.y;
        if (bounced) {
            this._bounceCount++;
            if (!this.canBounce) {
                this.isExpired = true;
                return;
            }
            if (this.retargetAfterBounce && !this.retargetConsumed) {
                this._retargetAfterRicochet(simulation);
            }
            simulation.addSparkBurst(this.position.clone(), this.isRefire ? "#66f2e2" : "#ffdd44");
            simulation.playSound("hit", 0.3);
        }
        this._trail.push(this.position.clone());
        if (this._trail.length > 8) this._trail.shift();
        if (!this._lifecycleCheck(delta, simulation)) return;
        this.angle = Math.atan2(this.velocity.y, this.velocity.x);
        this._hitCheck(simulation);
        if (!this.isExpired && this.age >= 0.08) this._ownerCollectCheck(simulation);
    }

    _retargetAfterRicochet(simulation) {
        const target = simulation.getEnemiesOf(this.owner).reduce((nearest, candidate) => {
            if (!nearest) return candidate;
            const candidateDistance = Vector2.subtract(candidate.position, this.position).length();
            const nearestDistance = Vector2.subtract(nearest.position, this.position).length();
            return candidateDistance < nearestDistance ? candidate : nearest;
        }, null);
        this.retargetConsumed = true;
        this.canBounce = false;
        if (!target) return;
        const direction = Vector2.subtract(target.position, this.position);
        if (direction.length() <= 0.001) return;
        const desiredVelocity = direction.normalize().scale(this.velocity.length());
        this.applyImpulse(Vector2.subtract(desiredVelocity, this.velocity));
        const trailDirection = direction.clone().normalize();
        simulation.spawnSlash(this.position.clone(), Vector2.add(this.position, trailDirection.scale(48)), "#66f2e2");
    }

    _ownerCollectCheck(simulation) {
        const dist = Vector2.subtract(this.position, this.owner.position).length();
        if (dist > this.owner.radius + this.radius) return;
        if (!this.canCollect) {
            this.isExpired = true;
            return;
        }
        const ability = this.sourceAbility;
        if (ability && typeof ability.timer === "number") {
            ability.timer = Math.max(0, ability.timer - this.cdReduction);
            simulation.spawnActionText(this.owner.position.clone(), `CD -${this.cdReduction.toFixed(3)}s`, "#44ddff");
            simulation.addSparkBurst(this.position.clone(), "#44ddff");
            simulation.playSound("shoot", 0.4);
        }
        ability?.onBulletCollected?.(this, simulation);
        this.isExpired = true;
    }

    _getHitDamage() {
        return Math.round(this.owner.stats.baseDamage * this.damageMult);
    }

    _getHitLabel() {
        if (this.turretShot) return "Turret Shot";
        if (this.isRefire) return "Ricochet Reload";
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
            const trailColor = this.isRefire ? "#66f2e2" : this.isFinisher ? "#ff4488" : "#ffdd44";
            for (let index = 0; index < this._trail.length - 1; index++) {
                const alpha = (index / this._trail.length) * (this.isFinisher ? 0.6 : 0.4);
                ctx.fillStyle = `rgba(${this.isRefire ? "102, 242, 226" : this.isFinisher ? "255, 68, 136" : "255, 220, 68"}, ${alpha})`;
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

        ctx.fillStyle = this.isRefire ? "#66f2e2" : this.isFinisher ? "#ff4488" : "#ffdd44";
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
