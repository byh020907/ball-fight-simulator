import { WallSlamEffect } from "../combat-effects.js";
import { Vector2 } from "../core.js";
import { Ability } from "./Ability.js";

const ARC_ANGLE = (Math.PI * 2) / 3; // 120도
const ARC_RANGE = 200;
const SWEEP_SPEED = 2.5;
const SLASH_DURATION = 0.3;
const BAT_LENGTH = 54;
const HAND_OFFSET = 22;
const BAT_HANDLE = 14;

function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

const SLASH_DAMAGE_MULT = 1.6;
const WALL_SLAM_DAMAGE_MULT = 1.2;
const KNOCKBACK_FORCE = 550;
const KNOCKBACK_DURATION = 0.85;
const WALL_SLAM_EFFECT_DURATION = 1.0;
const FACING_SMOOTH_RATE = 8;
const SWEEP_AMPLITUDE = 0.45;
const VISION_ARC_RADIUS_SCALE = 0.55;

export class BatBallAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation);
        this._baseCooldown = 2.2;
        this.timer = 0;
        this.arcAngle = 0;
        this.slashTimer = 0;
        this.slashStartAngle = 0;
        this.slashEndAngle = 0;
        this._facingAngle = 0;
    }

    update(delta, target) {
        this.timer -= delta;

        // Slash 애니메이션 타이머
        if (this.slashTimer > 0) {
            this.slashTimer -= delta;
            if (this.slashTimer < 0) this.slashTimer = 0;
        }

        // 시야 범위가 좌우로 자유롭게 스윕 (벽 반동 시 부드럽게 회전)
        const time = performance.now() / 1000;
        const velAngle =
            this.owner.velocity.length() > 0
                ? Math.atan2(this.owner.velocity.y, this.owner.velocity.x)
                : this._facingAngle;
        let angleDiff = velAngle - this._facingAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this._facingAngle += angleDiff * Math.min(1, FACING_SMOOTH_RATE * delta);
        const sweepOffset = Math.sin(time * SWEEP_SPEED) * (Math.PI * SWEEP_AMPLITUDE);
        this.arcAngle = this._facingAngle + sweepOffset;

        if (!target || this.timer > 0) return;

        const toTarget = Vector2.subtract(target.position, this.owner.position);
        const dist = toTarget.length();
        // 시야 거리는 공 표면 기준: 중심거리 - 내 반지름 > ARC_RANGE 이면 범위 밖
        if (dist - this.owner.radius > ARC_RANGE) return;

        const targetAngle = Math.atan2(toTarget.y, toTarget.x);
        const diff = Math.abs(normalizeAngle(targetAngle - this.arcAngle));
        if (diff > ARC_ANGLE / 2) return;

        // 범위 안에 들어왔다 — 휘두르기!
        this.performSlash(target);
        this.timer = this.cooldown;
    }

    performSlash(target) {
        const damage = Math.round(this.owner.baseDamage * SLASH_DAMAGE_MULT);
        target.takeDamage(damage, this.owner, "Slash");

        // 강한 넉백 + 벽 충돌 시 추가 데미지
        const kbDir = Vector2.subtract(target.position, this.owner.position).normalize();
        target.applyKnockback(kbDir.scale(KNOCKBACK_FORCE), KNOCKBACK_DURATION);
        target.wallSlamState = new WallSlamEffect({
            source: this.owner,
            damage: Math.round(this.owner.baseDamage * WALL_SLAM_DAMAGE_MULT),
            duration: WALL_SLAM_EFFECT_DURATION
        });

        // Slash 애니메이션 설정 — arcAngle 기준으로 ±60도 휘두르기
        this.slashTimer = SLASH_DURATION;
        this.slashStartAngle = this.arcAngle - ARC_ANGLE / 2;
        this.slashEndAngle = this.arcAngle + ARC_ANGLE / 2;

        // 시각 효과 — 스윙 아크 + 충돌 스파크
        this.simulation.addSparkBurst(this.owner.position.clone(), this.owner.color);
        this.simulation.addSparkBurst(target.position.clone(), "#ffffff");
        this.simulation.playSound("dash", 1.0);
        this.simulation.addLog(`${this.owner.name} swings the bat at ${target.name}!`);
    }

    getStatModifiers() {
        return { speed: 0.95, damage: 1, defense: 1, impact: 1 };
    }

    draw(ctx) {
        const pos = this.owner.position;
        const time = performance.now() / 1000;

        // ── Slash 애니메이션 ──
        this._drawSlashEffect(ctx, pos);

        // ── 시야 범위 ──
        this._drawVisionArc(ctx, pos);

        // ── 방망이 ──
        this._drawBat(ctx, time);
    }

    /** 스윙 아크 애니메이션 */
    _drawSlashEffect(ctx, pos) {
        if (this.slashTimer <= 0) return;

        const progress = 1 - this.slashTimer / SLASH_DURATION; // 0→1
        const currentEnd = this.slashStartAngle + (this.slashEndAngle - this.slashStartAngle) * progress;
        const glowAlpha = 0.5 * (1 - progress);

        ctx.save();

        // 바깥 글로우
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 10 - progress * 6;
        ctx.globalAlpha = glowAlpha * 0.6;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ARC_RANGE * VISION_ARC_RADIUS_SCALE, this.slashStartAngle, currentEnd);
        ctx.stroke();

        // 메인 스윙 선
        ctx.strokeStyle = this.owner.color;
        ctx.lineWidth = 5 - progress * 3;
        ctx.globalAlpha = glowAlpha * 0.9;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ARC_RANGE * VISION_ARC_RADIUS_SCALE, this.slashStartAngle, currentEnd);
        ctx.stroke();

        // 잔상 (trail) — 여러 겹
        for (let i = 1; i <= 3; i++) {
            const trailProgress = Math.max(0, progress - i * 0.08);
            if (trailProgress <= 0) continue;
            const trailEnd = this.slashStartAngle + (this.slashEndAngle - this.slashStartAngle) * trailProgress;
            ctx.strokeStyle = this.owner.color;
            ctx.lineWidth = 3 - i * 0.6;
            ctx.globalAlpha = glowAlpha * 0.3 * (1 - i * 0.25);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, ARC_RANGE * VISION_ARC_RADIUS_SCALE - i * 8, this.slashStartAngle, trailEnd);
            ctx.stroke();
        }

        ctx.restore();
    }

    /** 120도 시야 범위 표시 (공 표면 기준 거리) */
    _drawVisionArc(ctx, pos) {
        const arcStart = this.arcAngle - ARC_ANGLE / 2;
        const arcEnd = this.arcAngle + ARC_ANGLE / 2;
        const range = ARC_RANGE + this.owner.radius;

        // 평소에는 진하게, slash 중에는 약간 흐리게
        ctx.save();
        ctx.strokeStyle = this.owner.color;
        ctx.globalAlpha = this.slashTimer > 0 ? 0.18 : 0.45;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, range, arcStart, arcEnd);
        ctx.stroke();
        ctx.setLineDash([]);

        // arc 양 끝 경계선
        ctx.globalAlpha = this.slashTimer > 0 ? 0.12 : 0.3;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + Math.cos(arcStart) * range, pos.y + Math.sin(arcStart) * range);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + Math.cos(arcEnd) * range, pos.y + Math.sin(arcEnd) * range);
        ctx.stroke();
        ctx.restore();
    }

    /** 방망이를 항상 들고 있는 모습 */
    _drawBat(ctx, time) {
        const pos = this.owner.position;
        const r = this.owner.radius;

        // 방망이 방향 — arcAngle 기준
        let batAngle = this.arcAngle;
        if (this.slashTimer > 0) {
            const progress = 1 - this.slashTimer / SLASH_DURATION;
            batAngle = this.slashStartAngle + (this.slashEndAngle - this.slashStartAngle) * progress;
        } else {
            const idleBob = Math.sin(time * 3) * 0.04;
            batAngle += idleBob;
        }

        // 방망이 시작점 (공 표면)
        const hx = pos.x + Math.cos(batAngle) * (r + HAND_OFFSET);
        const hy = pos.y + Math.sin(batAngle) * (r + HAND_OFFSET);

        // 방망이 끝 (배럴)
        const bx = hx + Math.cos(batAngle) * BAT_LENGTH;
        const by = hy + Math.sin(batAngle) * BAT_LENGTH;

        // 손잡이 끝
        const handleEndX = hx - Math.cos(batAngle) * BAT_HANDLE;
        const handleEndY = hy - Math.sin(batAngle) * BAT_HANDLE;

        ctx.save();
        this._drawBarrel(ctx, hx, hy, bx, by);
        this._drawHandle(ctx, hx, hy, handleEndX, handleEndY, batAngle);
        ctx.restore();
    }

    /** 배럴 (두꺼운 부분) + 하이라이트 */
    _drawBarrel(ctx, hx, hy, bx, by) {
        ctx.strokeStyle = "#c4773a";
        ctx.lineWidth = 9;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(bx, by);
        ctx.stroke();

        ctx.strokeStyle = "#e8a86a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(bx, by);
        ctx.stroke();
    }

    /** 손잡이 + 그립 테이프 + 마감 */
    _drawHandle(ctx, hx, hy, handleEndX, handleEndY, batAngle) {
        ctx.strokeStyle = "#222222";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(handleEndX, handleEndY);
        ctx.stroke();

        ctx.strokeStyle = "#444444";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
            const t = 0.15 + i * 0.22;
            const tx = hx - Math.cos(batAngle) * BAT_HANDLE * t;
            const ty = hy - Math.sin(batAngle) * BAT_HANDLE * t;
            const perp = new Vector2(-Math.sin(batAngle), Math.cos(batAngle));
            ctx.beginPath();
            ctx.moveTo(tx + perp.x * 3, ty + perp.y * 3);
            ctx.lineTo(tx - perp.x * 3, ty - perp.y * 3);
            ctx.stroke();
        }

        ctx.fillStyle = "#111111";
        ctx.beginPath();
        ctx.arc(handleEndX, handleEndY, 3.5, 0, Math.PI * 2);
        ctx.fill();
    }

    /** 캡 모자를 쓴 타자 얼굴 */
    drawFace(ctx, rotation, ball) {
        const { r } = this._faceContext(ball);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // ── 캡 모자 몸통 (크라운) ──
        // 윗부분을 채우는 반원 형태 (더 크게, 눈과 간격 확보)
        ctx.fillStyle = "#2244aa";
        ctx.beginPath();
        ctx.arc(0, -0.1 * r, r * 0.55, Math.PI * 1.08, Math.PI * 1.92);
        ctx.fill();
        ctx.strokeStyle = "#1a3388";
        ctx.lineWidth = Math.max(2, r * 0.04);
        ctx.stroke();

        // ── 캡 모자 챙 (앞으로 튀어나온 부분) ──
        ctx.strokeStyle = "#1a3388";
        ctx.lineWidth = Math.max(5, r * 0.12);
        ctx.beginPath();
        ctx.moveTo(-0.34 * r, -0.34 * r);
        ctx.lineTo(0, -0.48 * r);
        ctx.lineTo(0.34 * r, -0.34 * r);
        ctx.stroke();

        // 챙 아랫면 (곡선 두께감)
        ctx.strokeStyle = "#2244aa";
        ctx.lineWidth = Math.max(3, r * 0.07);
        ctx.beginPath();
        ctx.moveTo(-0.32 * r, -0.32 * r);
        ctx.quadraticCurveTo(0, -0.44 * r, 0.32 * r, -0.32 * r);
        ctx.stroke();

        // ── 상단 단추 ──
        ctx.fillStyle = "#1a3388";
        ctx.beginPath();
        ctx.arc(0, -0.58 * r, Math.max(2.5, r * 0.045), 0, Math.PI * 2);
        ctx.fill();

        // ── 눈 (집중하는 타자 표정, 모자와 간격 둠) ──
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = Math.max(3, r * 0.075);
        // 왼쪽 눈
        ctx.beginPath();
        ctx.moveTo(-0.28 * r, 0.02 * r);
        ctx.lineTo(-0.1 * r, 0.08 * r);
        ctx.stroke();
        // 오른쪽 눈
        ctx.beginPath();
        ctx.moveTo(0.28 * r, 0.02 * r);
        ctx.lineTo(0.1 * r, 0.08 * r);
        ctx.stroke();

        // ── 입 (다짐한 표정) ──
        ctx.beginPath();
        ctx.moveTo(-0.1 * r, 0.28 * r);
        ctx.lineTo(0.12 * r, 0.24 * r);
        ctx.stroke();

        return true;
    }

    getUiState() {
        return {
            label: this.timer > 0 ? "Slash" : "Ready",
            progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }
}
