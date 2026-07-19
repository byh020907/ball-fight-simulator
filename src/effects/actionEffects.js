import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { EntityAttachment } from "../physics/index.js";

export class ActionWindowEffect extends EntityAttachment(CombatEntity) {
    static COLORS = {
        counter: "#ff8844",
        projectile_guard: "#44ddff",
        endure: "#44ff44",
        time_warp: "#aa44ff",
        rush: "#4488ff"
    };

    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(ball, actionId, duration) {
        super(ball.position.clone(), new Vector2(), 0);
        this.ball = ball;
        this.attachToEntity(ball);
        this.color = ActionWindowEffect.COLORS[actionId] ?? "#ffffff";
        this.life = duration;
        this.maxLife = this.life;
    }

    update(delta) {
        this.syncAttachedPosition();
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = 1 - Math.max(0, this.life / this.maxLife);
        const alpha = 0.5 * (1 - progress * 0.6);
        const r = this.ball.radius + 22 + progress * 14;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
}

export class ActionSuccessEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(position, actionId) {
        super(position.clone(), new Vector2(), 0);
        this.color = ActionWindowEffect.COLORS[actionId] ?? "#ffffff";
        this.life = 0.3;
        this.maxLife = this.life;
    }

    update(delta) {
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = 1 - Math.max(0, this.life / this.maxLife);
        const alpha = 1 - progress;
        const size = 20 + progress * 40;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";

        ctx.beginPath();
        ctx.moveTo(this.position.x - size, this.position.y);
        ctx.lineTo(this.position.x + size, this.position.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.position.x, this.position.y - size);
        ctx.lineTo(this.position.x, this.position.y + size);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, size * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

export class ActionWhiffEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(position) {
        super(position.clone(), new Vector2(0, -30), 0);
        this.life = 0.4;
        this.maxLife = this.life;
    }

    update(delta) {
        this.integrate(delta);
        this.tickLife(delta);
    }

    draw(ctx) {
        const progress = 1 - Math.max(0, this.life / this.maxLife);
        const alpha = 1 - progress;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#888888";
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.arc(this.position.x + i * 10, this.position.y + i * 4, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
