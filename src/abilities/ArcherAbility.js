import { Vector2 } from "../core.js";
import { Ability } from "./Ability.js";

const WINDUP = 0.6;
const SPREAD_ANGLE = 0.22;
const EVADE_RANGE = 320;
const EVADE_STRENGTH = 0.7;

export class ArcherAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation);
        this._baseCooldown = 3.9;
        this.timer = 1.2;
        this.windUp = 0;
        this.missStreak = 0;
        this.lastAimDir = new Vector2(1, 0);
    }

    update(delta, target) {
        this._evade(target);

        // Wind-up phase — tracking target
        if (this.windUp > 0) {
            if (target) {
                this.lastAimDir = Vector2.subtract(target.position, this.owner.position).normalize();
            }
            this.windUp -= delta;
            if (this.windUp <= 0) {
                this.windUp = 0;
                this.release();
            }
            return;
        }

        this.timer -= delta;
        if (this.timer <= 0 && target) {
            this.timer = this.cooldown;
            this.lastAimDir = Vector2.subtract(target.position, this.owner.position).normalize();
            this.windUp = WINDUP;
        }
    }

    /** Fire the arrow(s) after wind-up completes. */
    release() {
        const dir = this.lastAimDir;
        const base = Vector2.add(this.owner.position, dir.clone().scale(this.owner.radius + 24));

        if (this.missStreak >= 2) {
            // Triple shot
            this.missStreak = 0;
            const angles = [-SPREAD_ANGLE, 0, SPREAD_ANGLE];
            for (const offset of angles) {
                const a = Math.atan2(dir.y, dir.x) + offset;
                const d = new Vector2(Math.cos(a), Math.sin(a));
                const start = Vector2.add(this.owner.position, d.clone().scale(this.owner.radius + 24));
                this.fireOne(start, d);
            }
            this.simulation.addLog(`${this.owner.name} fires a triple shot!`);
        } else {
            this.fireOne(base, dir);
        }

        this.simulation.playSound("shoot");
    }

    /** Spawn a single arrow with hit/miss callback. */
    fireOne(start, dir) {
        const arrow = this.simulation.spawnArrow(this.owner, start, dir.clone().scale(this.owner.baseSpeed * 2));
        arrow._abilityRef = this;
        this.simulation.spawnSlash(this.owner.position.clone(), start.clone(), this.owner.color);
    }

    /** Called by arrow when it hits or expires. */
    onArrowResult(hit) {
        if (hit) {
            this.missStreak = 0;
        } else {
            this.missStreak = Math.min(5, this.missStreak + 1);
        }
    }

    /**
     * 패시브 회피 — 상대가 일정 거리 이내로 접근하고,
     * 내가 상대를 향해 이동 중일 때 발동합니다.
     *
     * 회피 방향:
     *   상대 진행 방향(oppDir) 기준 내가 왼쪽에 있으면 → 상대의 왼쪽으로 회피
     *   오른쪽에 있으면 → 상대의 오른쪽으로 회피
     *
     * forceHeading을 사용해 Ball.update()에서 속도가 덮어써져도 유지됩니다.
     */
    _evade(target) {
        if (!target || target.isDefeated || this.owner.swallowedState || this.owner.wallSlamState) return;

        const toTarget = Vector2.subtract(target.position, this.owner.position);
        const dist = toTarget.length();
        if (dist >= EVADE_RANGE || dist <= 5) return;

        const towardOpponent = toTarget.normalize();

        // 내 이동 방향과 상대 방향의 내적으로 접근 여부 확인
        const myDir = this.owner.velocity.length() > 5 ? this.owner.velocity.clone().normalize() : null;
        const movingToward = myDir ? myDir.x * towardOpponent.x + myDir.y * towardOpponent.y > 0 : true;
        if (!movingToward) return;

        // 상대 진행 방향 (속도가 없으면 나→상대 반대 방향 사용)
        const oppDir =
            target.velocity.length() > 5 ? target.velocity.clone().normalize() : towardOpponent.clone().scale(-1);

        // 2D 외적으로 내가 상대 진행방향 기준 어느 쪽에 있는지 판단
        // 양수 = 왼쪽, 음수 = 오른쪽
        const side =
            oppDir.x * (this.owner.position.y - target.position.y) -
            oppDir.y * (this.owner.position.x - target.position.x);

        // 상대 기준 왼쪽(-oppDir.y, oppDir.x) 또는 오른쪽(oppDir.y, -oppDir.x)으로 회피
        const dodgeDir = side > 0 ? new Vector2(-oppDir.y, oppDir.x) : new Vector2(oppDir.y, -oppDir.x);

        // 거리가 가까울수록 회피 강도 증가
        const intensity = (1 - dist / EVADE_RANGE) * EVADE_STRENGTH;
        const current = myDir ?? dodgeDir;
        const blended = current.add(dodgeDir.scale(intensity)).normalize();

        // forceHeading으로 방향 유지 (Ball.update에서 덮어써지지 않음)
        if (this.owner.forcedHeading) {
            this.owner.forcedHeading.direction = blended;
            this.owner.forcedHeading.effect.elapsed = 0;
        } else {
            this.owner.forceHeading(blended, 0.35);
        }
    }

    getStatModifiers() {
        return { speed: 0.95, damage: 1, defense: 1, impact: 1 };
    }

    draw(ctx) {
        if (this.windUp <= 0) return;

        const progress = 1 - this.windUp / WINDUP; // 0→1 during wind-up
        const dir = this.lastAimDir;
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
        if (this.windUp > 0) {
            return { label: "Draw", progress: 1 - this.windUp / WINDUP };
        }
        const label = this.missStreak >= 2 ? `Triple x${this.missStreak}` : "Arrow";
        return {
            label,
            progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }
}
