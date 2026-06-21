import { CombatEntity, Vector2 } from "./core.js";

export class VisualBurst extends CombatEntity {
    constructor(position, color, radiusGrowth, life) {
        super(position, new Vector2(), 10);
        this.color = color;
        this.radiusGrowth = radiusGrowth;
        this.life = life;
        this.maxLife = life;
    }

    update(delta) {
        this.life -= delta;
        this.radius += this.radiusGrowth * delta;
        if (this.life <= 0) {
            this.isExpired = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

export class OrbitHitEffect extends CombatEntity {
    constructor(shardPosition, targetPosition, color) {
        super(targetPosition, new Vector2(), 0);
        this.shardPosition = shardPosition;
        this.targetPosition = targetPosition;
        this.color = color;
        this.life = 0.24;
        this.maxLife = this.life;
    }

    update(delta) {
        this.life -= delta;
        if (this.life <= 0) {
            this.isExpired = true;
        }
    }

    draw(ctx) {
        const progress = 1 - Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(this.shardPosition.x, this.shardPosition.y);
        ctx.lineTo(this.targetPosition.x, this.targetPosition.y);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.targetPosition.x, this.targetPosition.y, 18 + progress * 48, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = this.color;
        for (let index = 0; index < 6; index += 1) {
            const angle = (Math.PI * 2 * index) / 6;
            const distance = 22 + progress * 36;
            ctx.save();
            ctx.translate(
                this.targetPosition.x + Math.cos(angle) * distance,
                this.targetPosition.y + Math.sin(angle) * distance
            );
            ctx.rotate(angle);
            ctx.fillRect(-7, -3, 14, 6);
            ctx.restore();
        }
        ctx.restore();
    }
}

export class DeathBurstEffect extends CombatEntity {
    constructor(position, color) {
        super(position, new Vector2(), 0);
        this.color = color;
        this.life = 0.78;
        this.maxLife = this.life;
    }

    update(delta) {
        this.life -= delta;
        if (this.life <= 0) {
            this.isExpired = true;
        }
    }

    draw(ctx) {
        const progress = 1 - Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 26 + progress * 110, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 10 + progress * 72, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        for (let index = 0; index < 10; index += 1) {
            const angle = (Math.PI * 2 * index) / 10 + progress * 0.7;
            const distance = 34 + progress * 82;
            ctx.save();
            ctx.translate(this.position.x + Math.cos(angle) * distance, this.position.y + Math.sin(angle) * distance);
            ctx.rotate(angle + progress * Math.PI);
            ctx.fillRect(-10, -4, 20, 8);
            ctx.restore();
        }
        ctx.restore();
    }
}

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

        this.velocity.y += this.gravity * delta;
        this.velocity.x *= this.drag;
        this.rotation += this.spin * delta;
        this.position.add(this.velocity.clone().scale(delta));

        const left = 24 + this.radius;
        const right = simulation.width - 24 - this.radius;
        const floor = simulation.height - 24 - this.radius;

        if (this.position.x <= left) {
            this.position.x = left;
            this.velocity.x = Math.abs(this.velocity.x) * 0.72;
        } else if (this.position.x >= right) {
            this.position.x = right;
            this.velocity.x = -Math.abs(this.velocity.x) * 0.72;
        }

        if (this.position.y >= floor) {
            this.position.y = floor;
            if (Math.abs(this.velocity.y) > 42) {
                this.velocity.y = -Math.abs(this.velocity.y) * this.bounce;
                this.velocity.x *= this.floorFriction;
            } else {
                this.velocity.x *= 0.35;
                this.velocity.y = 0;
                this.settled = true;
            }
        }
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

export class SlashTrail extends CombatEntity {
    constructor(from, to, color) {
        super(from, new Vector2(), 0);
        this.from = from;
        this.to = to;
        this.color = color;
        this.life = 0.18;
    }

    update(delta) {
        this.life -= delta;
        if (this.life <= 0) {
            this.isExpired = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(this.from.x, this.from.y);
        ctx.lineTo(this.to.x, this.to.y);
        ctx.stroke();
        ctx.restore();
    }
}

/** Floating damage number that rises and fades. */
export class DamageNumber extends CombatEntity {
    static renderLayer = 2;

    constructor(position, amount, color = "#ff3333") {
        super(position.clone(), new Vector2(0, -70), 0);
        this.amount = amount;
        this.color = color;
        this.life = 0.9;
        this.maxLife = this.life;
        this.fontSize = Math.min(52, 20 + Math.floor(amount / 10) * 4);
    }

    update(delta) {
        this.life -= delta;
        this.position.add(this.velocity.clone().scale(delta));
        if (this.life <= 0) this.isExpired = true;
    }

    draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = "900 " + this.fontSize + 'px Bahnschrift, "Segoe UI", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(3, this.fontSize * 0.1);
        ctx.strokeText(String(this.amount), this.position.x, this.position.y);
        ctx.fillStyle = this.color;
        ctx.fillText(String(this.amount), this.position.x, this.position.y);
        ctx.restore();
    }
}
