import { calculateInterceptPoint, Vector2, evadeTarget } from "../core.js";
import { Ability } from "./ability.js";

const WINDUP = 0.4;
const EVADE_RANGE = 320;
const EVADE_STRENGTH = 0.7;
const ARROW_SPEED_MULT = 2;
const ARROW_START_OFFSET = 24;
const DOUBLE_SHOT_DELAY = 0.12;
const CRIT_BOOST_CHANCE = 0.5;
const CRIT_BOOST_MULT = 2;

export class ArcherAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, 3);
        this.state = {
            windUp: 0,
            lastAimDir: new Vector2(1, 0),
            aimPoint: null,
            pendingSecondShot: false,
            secondShotTimer: 0,
            secondShotTargetCache: null
        };
        this.arrowSpeedMult = ARROW_SPEED_MULT;
    }

    update(delta, target) {
        this._evade(target);
        if (this._updateSecondShot(delta)) return;
        if (this._updateWindUp(delta, target)) return;
        this._updateCooldown(delta, target);
    }

    _updateSecondShot(delta) {
        if (!this.state.pendingSecondShot) return false;
        this.state.secondShotTimer -= delta;
        if (this.state.secondShotTimer > 0) return true;
        const cached = this.state.secondShotTargetCache;
        if (cached && !cached.flags.defeated) {
            this._updateAim(cached);
            this._fireArrowWithCrit(cached, true);
        }
        this.state.pendingSecondShot = false;
        this.state.secondShotTargetCache = null;
        return false;
    }

    _updateWindUp(delta, target) {
        if (this.state.windUp <= 0) return false;
        if (!target || target.flags.defeated) {
            this.state.windUp = 0;
            this.state.aimPoint = null;
            return false;
        }

        if (this.abilityTier >= 1) {
            this._updateAim(target);
        }
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
            if (this.abilityTier >= 1) {
                this._updateAim(target);
            } else {
                this.state.lastAimDir = Vector2.subtract(target.position, this.owner.position).normalize();
                this.state.aimPoint = target.position.clone();
            }
            this.state.windUp = this._getWindupDuration();
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
        return this.owner.stats.baseSpeed * this.arrowSpeedMult * (this.getLevelUpgrade().arrowSpeedMultiplier ?? 1);
    }

    _getWindupDuration() {
        return WINDUP * (this.getLevelUpgrade().windupMultiplier ?? 1);
    }

    release(target) {
        this._fireArrowWithCrit(target, true);
        this.simulation.playSound("shoot");
        if (this.abilityTier >= 2) {
            const roll = Math.random();
            if (roll >= 0.7) {
                this.state.pendingSecondShot = true;
                this.state.secondShotTimer = DOUBLE_SHOT_DELAY;
                this.state.secondShotTargetCache = target;
            }
        }
    }

    _fireArrowWithCrit(target, countsForResult) {
        const direction = this.state.lastAimDir.clone();
        const start = Vector2.add(this.owner.position, direction.clone().scale(this.owner.radius + ARROW_START_OFFSET));
        const critBoosted = this.abilityTier >= 3 && Math.random() < CRIT_BOOST_CHANCE;
        this.simulation.spawnArrow(this.owner, start, direction.clone().scale(this._getArrowSpeed()), {
            onResult: (hit) => {
                if (countsForResult && !hit) {
                }
            },
            critBoostOverride: critBoosted ? CRIT_BOOST_MULT : null
        });
        this.simulation.spawnSlash(this.owner.position.clone(), start.clone(), this.owner.color);
    }

    _evade(target) {
        evadeTarget(this.owner, target, EVADE_RANGE, EVADE_STRENGTH);
    }

    getStatModifiers() {
        return { speed: 0.95, damage: 1, defense: 1, impact: 1 };
    }

    draw(ctx) {
        if (this.state.windUp <= 0) return;

        const progress = 1 - this.state.windUp / this._getWindupDuration();
        const dir = this.state.lastAimDir;
        const pos = this.owner.position;
        const r = this.owner.radius;

        const pull = 10 + progress * 30;
        const perp = new Vector2(-dir.y, dir.x);

        const bowCenter = Vector2.add(pos, dir.clone().scale(r + 20));

        const bowLen = 36;
        const bowTop = Vector2.add(bowCenter, perp.clone().scale(-bowLen));
        const bowBot = Vector2.add(bowCenter, perp.clone().scale(bowLen));

        ctx.save();
        ctx.strokeStyle = this.owner.color;
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.moveTo(bowTop.x, bowTop.y);
        ctx.quadraticCurveTo(bowCenter.x + dir.x * pull, bowCenter.y + dir.y * pull, bowBot.x, bowBot.y);
        ctx.stroke();

        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bowTop.x, bowTop.y);
        ctx.lineTo(bowCenter.x - dir.x * pull, bowCenter.y - dir.y * pull);
        ctx.lineTo(bowBot.x, bowBot.y);
        ctx.stroke();

        ctx.restore();
        if (this.abilityTier >= 1) {
            this._drawPredictionMarker(ctx, progress);
        }
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
        if (this.state.pendingSecondShot) {
            return { label: "Second Shot", progress: 1 - this.state.secondShotTimer / DOUBLE_SHOT_DELAY };
        }
        if (this.state.windUp > 0) {
            return { label: "Draw", progress: 1 - this.state.windUp / this._getWindupDuration() };
        }
        return {
            label: "Arrow",
            progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }
}
