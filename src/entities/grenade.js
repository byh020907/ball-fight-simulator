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
            if (target && !target.isDefeated) {
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
        if (target && !target.isDefeated) {
            const distance = Vector2.subtract(this.position, target.position).length();
            if (distance <= this.explosionRadius) {
                const edgeProgress = Math.max(
                    0,
                    Math.min(1, (distance - this.innerRadius) / (this.explosionRadius - this.innerRadius))
                );
                const raw = Math.round(this.owner.baseDamage * (2.5 - edgeProgress * 1.0));
                this.dealDamageToTarget(target, raw, this.owner, "Grenade", simulation);
                const kbDir = Vector2.subtract(target.position, this.position).normalize();
                target.applyKnockback(kbDir.scale(650), 0.55);
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

        // 폭발 예고 링 — 타이머가 줄수록 빠르게 커짐
        ctx.strokeStyle = this._proximityTriggered ? "#ff4444" : this.owner.color;
        ctx.lineWidth = 5;
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.explosionRadius * (0.72 + charge * 0.28), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 근접 가속 발동 시 붉은 섬광 링
        if (this._proximityTriggered) {
            ctx.strokeStyle = `rgba(255, 68, 68, ${0.3 + charge * 0.4})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.explosionRadius * 1.05, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 수류탄 본체
        ctx.fillStyle = this.owner.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // 남은 퓨즈 시간 텍스트
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 14px Bahnschrift, Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.timer.toFixed(1) + "s", this.position.x, this.position.y);

        ctx.restore();
    }
}
