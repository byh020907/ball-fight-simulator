import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { getVisibleLineWidth } from "./effectVisibility.js";

export class HeroResonanceEffect extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor(source, target, fragments, { heroicBurst = false } = {}) {
        super(source.position.clone(), new Vector2(), 0);
        this.source = source;
        this.target = target;
        this.fragments = fragments;
        this.heroicBurst = heroicBurst;
        this.hitCount = 0;
        this.timer = 0.1;
        this.flightProgress = 0;
        this.life = fragments.length * 0.1 + 0.4;
        this.starLife = 0;
        this.starAnchors = [];
    }

    update(delta, simulation) {
        if (this.target.flags.defeated) {
            this.isExpired = true;
            return;
        }
        this.flightProgress = Math.min(1, this.flightProgress + delta / 0.1);
        this.timer -= delta;
        while (this.timer <= 1e-9 && this.hitCount < this.fragments.length) {
            this.timer += 0.1;
            const fragmentIndex = this.hitCount;
            const anchor = this._createImpactAnchor(fragmentIndex);
            this.starAnchors.push(anchor);
            this.hitCount += 1;
            this.flightProgress = 0;
            this.target.takeDamage(this.source.stats.baseDamage * 0.2, this.source, "Hero Resonance");
            simulation.addSparkBurst(this.getStarAnchorPosition(fragmentIndex), this.fragments[fragmentIndex].color);
            if (this.heroicBurst && this.hitCount === 5) this._triggerHeroicBurst(simulation);
        }
        this.starLife = Math.max(0, this.starLife - delta);
        this.life -= delta;
        if (this.life <= 0) this.isExpired = true;
    }

    _triggerHeroicBurst(simulation) {
        const center = this.target.position.clone();
        for (const enemy of simulation.getEnemiesOf(this.source)) {
            if (Vector2.subtract(enemy.position, center).length() > 90) continue;
            const { actualDamage } = enemy.takeDamage(this.source.stats.baseDamage * 0.75, this.source, "Heroic Burst");
            if (actualDamage <= 0) continue;
            const direction = Vector2.subtract(enemy.position, center);
            if (direction.length() <= 0.001) direction.x = 1;
            enemy.applyKnockback(direction.normalize().scale(540), 0.35);
        }
        this.starLife = 0.36;
        simulation.spawnPulse(center, "#fff4c4");
        simulation.spawnParticleBurst(center, "#ffd84d", {
            count: 24,
            speed: 240,
            radiusMin: 2,
            radiusMax: 5,
            gravity: 180
        });
        simulation.playSound("explosion", 0.85);
    }

    draw(ctx) {
        const pending = this.fragments[this.hitCount];
        if (pending && !this.target.flags.defeated) {
            const { start, control, end } = this._getFlightPath(this.hitCount);
            const t = this.flightProgress;
            const oneMinus = 1 - t;
            const point = new Vector2(
                oneMinus * oneMinus * start.x + 2 * oneMinus * t * control.x + t * t * end.x,
                oneMinus * oneMinus * start.y + 2 * oneMinus * t * control.y + t * t * end.y
            );
            ctx.save();
            ctx.strokeStyle = pending.color;
            ctx.lineWidth = getVisibleLineWidth(ctx, "standard", 3);
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.quadraticCurveTo(control.x, control.y, point.x, point.y);
            ctx.stroke();
            ctx.fillStyle = pending.color;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        this._drawStarMarks(ctx);
    }

    _getPlannedLocalOffset(index) {
        const angle = -Math.PI / 2 + (Math.PI * 4 * index) / 5;
        return Vector2.fromAngle(angle, this.target.radius);
    }

    _rotateLocalOffset(localOffset) {
        const angle = this.target.angle ?? 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vector2(localOffset.x * cos - localOffset.y * sin, localOffset.x * sin + localOffset.y * cos);
    }

    _getFlightPath(index) {
        const startAngle = (Math.PI * 2 * index) / Math.max(1, this.fragments.length);
        const start = Vector2.add(this.source.position, Vector2.fromAngle(startAngle, this.source.radius + 24));
        const end = Vector2.add(this.target.position, this._rotateLocalOffset(this._getPlannedLocalOffset(index)));
        const mid = Vector2.add(start, end).scale(0.5);
        const perpendicular = Vector2.subtract(end, start).normalize();
        const control = new Vector2(mid.x - perpendicular.y * 32, mid.y + perpendicular.x * 32);
        return { start, control, end };
    }

    _createImpactAnchor(index) {
        const impactPoint = this._getFlightPath(index).end;
        const worldOffset = Vector2.subtract(impactPoint, this.target.position);
        const targetAngle = this.target.angle ?? 0;
        const cos = Math.cos(-targetAngle);
        const sin = Math.sin(-targetAngle);
        const localOffset = new Vector2(
            worldOffset.x * cos - worldOffset.y * sin,
            worldOffset.x * sin + worldOffset.y * cos
        );
        return {
            localOffset,
            localAngle: Math.atan2(localOffset.y, localOffset.x),
            surfaceRadius: localOffset.length()
        };
    }

    getStarAnchorPosition(index, outwardOffset = 0) {
        const anchor = this.starAnchors[index];
        if (!anchor) return this.target.position.clone();
        const worldAngle = anchor.localAngle + (this.target.angle ?? 0);
        return Vector2.add(this.target.position, Vector2.fromAngle(worldAngle, anchor.surfaceRadius + outwardOffset));
    }

    _drawStarMarks(ctx) {
        if (this.hitCount <= 0 || this.target.flags.defeated) return;
        const center = this.target.position;
        ctx.save();
        ctx.strokeStyle = this.hitCount >= 5 ? "#fff4bd" : "#ffd84d";
        ctx.lineWidth = getVisibleLineWidth(ctx, "emphasis", 4);
        ctx.beginPath();
        for (let index = 0; index < this.hitCount; index += 1) {
            const point = this.getStarAnchorPosition(index, 7);
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        }
        if (this.hitCount === 5) ctx.closePath();
        ctx.stroke();
        if (this.starLife > 0) {
            const progress = 1 - this.starLife / 0.36;
            ctx.globalAlpha = 1 - progress;
            ctx.strokeStyle = "#ffd84d";
            ctx.beginPath();
            ctx.arc(center.x, center.y, 90 * progress, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
}
