import { CombatEntity, Vector2 } from "../core.js";

export class GravityParticle extends CombatEntity {
    constructor(position, velocity, options = {}) {
        super(position, velocity, options.radius ?? 4);
        this.color = options.color ?? "#ffffff";
        this.gravity = options.gravity ?? 820;
        this.bounce = options.bounce ?? 0.22;
        this.drag = options.drag ?? 0.986;
        this.floorFriction = options.floorFriction ?? 0.9;
        this.life = options.life ?? 1.6;
        this.maxLife = this.life;
        this.settled = false;
        this.settleDelay = options.settleDelay ?? 0.65;
        this.rotation = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 12;
        this.width = this.radius * (1.4 + Math.random() * 0.9);
        this.height = this.radius * (0.9 + Math.random() * 0.8);
    }

    update(delta, simulation) {
        this.life -= delta;
        if (this.life <= 0) {
            this.isExpired = true;
            return;
        }

        if (this.settled) {
            this.settleDelay -= delta;
            if (this.settleDelay <= 0) {
                this.life -= delta * 3.2;
            }
            return;
        }

        this.applyImpulse(new Vector2(0, this.gravity * delta));
        this._matchVelocity(new Vector2(this.velocity.x * this.drag, this.velocity.y));
        this.rotation += this.spin * delta;
        this.position.add(this.velocity.clone().scale(delta));

        const left = 24 + this.radius;
        const right = simulation.width - 24 - this.radius;
        const floor = simulation.height - 24 - this.radius;

        if (this.position.x <= left) {
            this.position.x = left;
            this._matchVelocity(new Vector2(Math.abs(this.velocity.x) * 0.72, this.velocity.y));
        } else if (this.position.x >= right) {
            this.position.x = right;
            this._matchVelocity(new Vector2(-Math.abs(this.velocity.x) * 0.72, this.velocity.y));
        }

        if (this.position.y >= floor) {
            this.position.y = floor;
            if (Math.abs(this.velocity.y) > 42) {
                this._matchVelocity(
                    new Vector2(this.velocity.x * this.floorFriction, -Math.abs(this.velocity.y) * this.bounce)
                );
            } else {
                this._matchVelocity(new Vector2(this.velocity.x * 0.35, 0));
                this.settled = true;
            }
        }
    }

    _matchVelocity(velocity) {
        this.applyImpulse(Vector2.subtract(velocity, this.velocity));
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.settled ? 0 : this.rotation);
        const width = this.settled ? this.width * 1.45 : this.width;
        const height = this.settled ? Math.max(2, this.height * 0.42) : this.height;
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-width / 2, -height / 2, width, Math.max(1, height * 0.24));
        ctx.restore();
    }
}
