import { calculateInterceptPoint, Vector2, evadeTarget } from "../core.js";
import { Ability } from "./ability.js";

const WINDUP = 0.4;
const EVADE_RANGE = 320;
const EVADE_STRENGTH = 0.7;
const ARROW_SPEED_MULT = 2;
const MAX_MISS_STREAK = 5;
const BURST_SHOT_COUNT = 3;
const BURST_SHOT_INTERVAL = 0.12;
const ARROW_START_OFFSET = 24;

export class ArcherAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, 3);
        this.state = {
            windUp: 0,
            missStreak: 0,
            lastAimDir: new Vector2(1, 0),
            aimPoint: null,
            burstShotsRemaining: 0,
            burstShotTimer: 0
        };
        this.arrowSpeedMult = ARROW_SPEED_MULT;
    }

    update(delta, target) {
        this._evade(target);
        if (this._updateBurst(delta, target)) return;
        if (this._updateWindUp(delta, target)) return;

        this._updateCooldown(delta, target);
    }

    _updateBurst(delta, target) {
        if (this.state.burstShotsRemaining <= 0) return false;
        if (!target || target.flags.defeated) {
            this._endBurst();
            return false;
        }

        this.state.burstShotTimer = Math.max(0, this.state.burstShotTimer - delta);
        if (this.state.burstShotTimer > 0) return true;

        this._fireBurstShot(target);
        return this.state.burstShotsRemaining > 0;
    }

    _updateWindUp(delta, target) {
        if (this.state.windUp <= 0) return false;
        if (!target || target.flags.defeated) {
            this.state.windUp = 0;
            this.state.aimPoint = null;
            return false;
        }

        this._updateAim(target);
        this.state.windUp = Math.max(0, this.state.windUp - delta);
        if (this.state.windUp <= 0) {
            this.release(target);
        }
        return true;
    }

    _updateCooldown(delta, target) {
        this.timer -= delta;
        if (this.timer <= 0 && target) {
            this.timer = this.cooldown * (0.7 + Math.random() * 0.6);
            this._updateAim(target);
            this.state.windUp = WINDUP;
        }
    }

    _updateAim(target) {
        const aimPoint = calculateInterceptPoint(
            this.owner.position,
            target.position,
            target.velocity,
            this._getArrowSpeed()
        );
        this.state.aimPoint = aimPoint;
        this.state.lastAimDir = Vector2.subtract(aimPoint, this.owner.position).normalize();
    }

    _getArrowSpeed() {
        return this.owner.stats.baseSpeed * this.arrowSpeedMult;
    }

    /** Fire after wind-up. Consecutive misses convert the next shot into a finite burst. */
    release(target) {
        if (this.state.missStreak >= 2) {
            this._startBurst(target);
            return;
        }

        this._firePredictedArrow(target, true);
        this.simulation.playSound("shoot");
    }

    _startBurst(target) {
        this.state.missStreak = 0;
        this.state.burstShotsRemaining = BURST_SHOT_COUNT;
        this.state.burstShotTimer = 0;
        this._fireBurstShot(target);
        this.simulation.playSound("shoot");
        this.simulation.addLog(`${this.owner.name} begins a predictive three-shot volley.`);
    }

    _fireBurstShot(target) {
        this._firePredictedArrow(target, false);
        this.state.burstShotsRemaining = Math.max(0, this.state.burstShotsRemaining - 1);
        this.state.burstShotTimer = this.state.burstShotsRemaining > 0 ? BURST_SHOT_INTERVAL : 0;
        if (this.state.burstShotsRemaining === 0) {
            this._endBurst();
        }
    }

    _endBurst() {
        this.state.burstShotsRemaining = 0;
        this.state.burstShotTimer = 0;
    }

    _firePredictedArrow(target, countsForMissStreak) {
        this._updateAim(target);
        const direction = this.state.lastAimDir.clone();
        const start = Vector2.add(this.owner.position, direction.clone().scale(this.owner.radius + ARROW_START_OFFSET));
        this._fireOne(start, direction, countsForMissStreak);
    }

    /** Spawn a single arrow with a shot-local result callback. */
    _fireOne(start, direction, countsForMissStreak) {
        this.simulation.spawnArrow(this.owner, start, direction.clone().scale(this._getArrowSpeed()), {
            onResult: (hit) => this.onArrowResult(hit, countsForMissStreak)
        });
        this.simulation.spawnSlash(this.owner.position.clone(), start.clone(), this.owner.color);
    }

    /** Called by arrow when it hits or expires. */
    onArrowResult(hit, countsForMissStreak = true) {
        if (!countsForMissStreak) return;
        if (hit) {
            this.state.missStreak = 0;
        } else {
            this.state.missStreak = Math.min(MAX_MISS_STREAK, this.state.missStreak + 1);
        }
    }

    /**
     * 패시브 회피 — 상대가 접근하면 옆으로 자동 회피합니다.
     */
    _evade(target) {
        evadeTarget(this.owner, target, 320, 0.7);
    }

    getStatModifiers() {
        return { speed: 0.95, damage: 1, defense: 1, impact: 1 };
    }

    draw(ctx) {
        if (this.state.windUp <= 0) return;

        const progress = 1 - this.state.windUp / WINDUP; // 0→1 during wind-up
        const dir = this.state.lastAimDir;
        const pos = this.owner.position;
        const r = this.owner.radius;

        // Pull distance increases with progress
        const pull = 10 + progress * 30;
        const perp = new Vector2(-dir.y, dir.x);

        // Bow center (in front of the ball)
        const bowCenter = Vector2.add(pos, dir.clone().scale(r + 20));

        // Bow ends (top and bottom of the bow arc)
        const bowLen = 36;
        const bowTop = Vector2.add(bowCenter, perp.clone().scale(-bowLen));
        const bowBot = Vector2.add(bowCenter, perp.clone().scale(bowLen));

        ctx.save();
        ctx.strokeStyle = this.owner.color;
        ctx.lineWidth = 4;

        // Bow arc — bends backward as string is pulled
        ctx.beginPath();
        ctx.moveTo(bowTop.x, bowTop.y);
        ctx.quadraticCurveTo(bowCenter.x + dir.x * pull, bowCenter.y + dir.y * pull, bowBot.x, bowBot.y);
        ctx.stroke();

        // Bow string — pulled back toward archer
        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bowTop.x, bowTop.y);
        ctx.lineTo(bowCenter.x - dir.x * pull, bowCenter.y - dir.y * pull);
        ctx.lineTo(bowBot.x, bowBot.y);
        ctx.stroke();

        ctx.restore();
        this._drawPredictionMarker(ctx, progress);
    }

    _drawPredictionMarker(ctx, progress) {
        const point = this.state.aimPoint;
        if (!point) return;

        ctx.save();
        ctx.globalAlpha = 0.35 + progress * 0.35;
        ctx.strokeStyle = this.owner.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6 + progress * 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    drawFace(ctx, rotation, ball) {
        this._line(ctx, ball, [
            [-0.34, -0.2],
            [-0.12, -0.12]
        ]);
        this._line(ctx, ball, [
            [0.34, -0.2],
            [0.12, -0.12]
        ]);
        this._sharpEye(ctx, ball, -0.23, -0.02, 1, 0.095);
        this._sharpEye(ctx, ball, 0.23, -0.02, -1, 0.095);
        this._line(ctx, ball, [
            [-0.18, 0.28],
            [0.2, 0.2]
        ]);
        return true;
    }

    getUiState() {
        if (this.state.burstShotsRemaining > 0) {
            const fired = BURST_SHOT_COUNT - this.state.burstShotsRemaining;
            return { label: `Burst ${fired}/${BURST_SHOT_COUNT}`, progress: fired / BURST_SHOT_COUNT };
        }
        if (this.state.windUp > 0) {
            return { label: "Draw", progress: 1 - this.state.windUp / WINDUP };
        }
        const label = this.state.missStreak >= 2 ? "Volley Ready" : "Arrow";
        return {
            label,
            progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }
}
