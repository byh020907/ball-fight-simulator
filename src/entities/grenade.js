import { Projectile, Vector2 } from "../core.js";

export class Grenade extends Projectile {
    constructor(owner, targetPosition, fuseTime = 1.08) {
        const start = owner.position.clone();
        const safeFuse = Math.max(0.32, fuseTime);
        const drift = Vector2.subtract(targetPosition, start).scale(1 / safeFuse);
        super(owner, start, drift, 12);
        this.timer = safeFuse;
        this.maxTimer = this.timer;
        this.explosionRadius = 150;
        this.innerRadius = 62;
        this.bounces = 0;
        this.maxBounces = 4;
    }

    update(delta, simulation) {
        this.position.add(this.velocity.clone().scale(delta));

        if (this.bounces < this.maxBounces) {
            const bx = this.position.x,
                by = this.position.y;
            simulation.keepEntityInsideArena(this);
            if (this.position.x !== bx || this.position.y !== by) {
                this.bounces++;
                simulation.playSound("bounce", 0.5);
            }
        }

        // 상대가 폭발 범위 내에 들어오면 남은 퓨즈 시간 2배 단축 (1회)
        if (!this._proximityTriggered) {
            const target = simulation.getOpponent(this.owner);
            if (target && !target.flags.defeated) {
                const dist = Vector2.subtract(this.position, target.position).length();
                if (dist <= this.explosionRadius) {
                    this.timer *= 0.6;
                    this._proximityTriggered = true;
                }
            }
        }

        this.timer -= delta;
        if (this.timer > 0) {
            return;
        }

        this._detonate(simulation);
    }

    _detonate(simulation) {
        const target = simulation.getOpponent(this.owner);
        if (target && !target.flags.defeated) {
            const distance = Vector2.subtract(this.position, target.position).length();
            if (distance <= this.explosionRadius) {
                const edgeProgress = Math.max(
                    0,
                    Math.min(1, (distance - this.innerRadius) / (this.explosionRadius - this.innerRadius))
                );
                const raw = Math.round(this.owner.stats.baseDamage * (2.5 - edgeProgress * 1.0));
                this.dealDamageToTarget(target, raw, this.owner, "Grenade", simulation);
                const kbDir = Vector2.subtract(target.position, this.position).normalize();
                target.applyKnockback(kbDir.scale(900), 1.3);
            }
        }

        simulation.spawnExplosion(this.position.clone(), this.owner.color);
        simulation.playSound("explosion");
        simulation.addLog(`${this.owner.name}'s grenade explodes.`);
        this.isExpired = true;
    }

    draw(ctx) {
        const charge = 1 - Math.max(0, this.timer / this.maxTimer);
        ctx.save();

        // 시계 링 — 남은 시간만큼 채워진 원호가 회전
        // 폭발 범위 외곽선
        ctx.strokeStyle = this.owner.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.globalAlpha = 0.08 + charge * 0.7;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.explosionRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // 시계 링 — 남은 시간만큼 채워진 원호가 회전
        const ringR = this.radius + 8;
        const startAngle = -Math.PI / 2 + charge * Math.PI * 2;
        const remaining = Math.max(0.02, 1 - charge);
        const endAngle = startAngle + Math.PI * 2 * remaining;
        const hue = 30 + (1 - charge) * 120;
        ctx.strokeStyle = this._proximityTriggered
            ? `rgba(255, 68, 68, ${0.4 + charge * 0.6})`
            : `hsl(${hue}, 100%, ${50 + charge * 20}%)`;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, ringR, startAngle, endAngle);
        ctx.stroke();
        ctx.lineCap = "butt";

        // 수류탄 본체
        ctx.fillStyle = this.owner.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }
}
