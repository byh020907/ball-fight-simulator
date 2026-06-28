import { CombatEntity, Vector2 } from "../core.js";

export class GravityParticle extends CombatEntity {
    constructor(position, velocity, options = {}) {
        super(position, velocity, options.radius ?? 4);
        this.display = {
            color: options.color ?? "#ffffff",
            rotation: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 12,
            width: (options.radius ?? 4) * (1.4 + Math.random() * 0.9),
            height: (options.radius ?? 4) * (0.9 + Math.random() * 0.8)
        };
        this.config = {
            gravity: options.gravity ?? 820,
            bounce: options.bounce ?? 0.22,
            drag: options.drag ?? 0.986,
            floorFriction: options.floorFriction ?? 0.9
        };
        this.life = options.life ?? 1.6;
        this.maxLife = this.life;
        this.state = {
            settled: false,
            settleDelay: options.settleDelay ?? 0.65
        };
    }

    update(delta, simulation) {
        if (!this.tickLife(delta)) {
            return;
        }

        if (this.state.settled) {
            this.state.settleDelay -= delta;
            if (this.state.settleDelay <= 0) {
                this.life -= delta * 3.2;
            }
            return;
        }

        this.applyImpulse(new Vector2(0, this.config.gravity * delta));
        this._matchVelocity(new Vector2(this.velocity.x * this.config.drag, this.velocity.y));
        this.display.rotation += this.display.spin * delta;
        this.integrate(delta);

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
                    new Vector2(
                        this.velocity.x * this.config.floorFriction,
                        -Math.abs(this.velocity.y) * this.config.bounce
                    )
                );
            } else {
                this._matchVelocity(new Vector2(this.velocity.x * 0.35, 0));
                this.state.settled = true;
            }
        }
    }

    _matchVelocity(velocity) {
        this.applyImpulse(Vector2.subtract(velocity, this.velocity));
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.display.color;
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.state.settled ? 0 : this.display.rotation);
        const width = this.state.settled ? this.display.width * 1.45 : this.display.width;
        const height = this.state.settled ? Math.max(2, this.display.height * 0.42) : this.display.height;
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-width / 2, -height / 2, width, Math.max(1, height * 0.24));
        ctx.restore();
    }
}
