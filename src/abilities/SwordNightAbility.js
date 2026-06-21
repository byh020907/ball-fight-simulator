import { Vector2 } from "../core.js";
import { Ability } from "./Ability.js";

const ARC_ANGLE = (Math.PI * 2) / 3; // 120도
const ARC_RANGE = 200;
const SWEEP_SPEED = 2.5;
const SLASH_DURATION = 0.3;
const SWORD_LENGTH = 52;
const HAND_OFFSET = 24;
const SWORD_HANDLE = 12;

function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

export class SwordNightAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation);
        this._baseCooldown = 2.2;
        this.timer = 0;
        this.arcAngle = 0;
        this.slashTimer = 0;
        this.slashStartAngle = 0;
        this.slashEndAngle = 0;
    }

    update(delta, target) {
        this.timer -= delta;

        // Slash 애니메이션 타이머
        if (this.slashTimer > 0) {
            this.slashTimer -= delta;
            if (this.slashTimer < 0) this.slashTimer = 0;
        }

        // 시야 범위가 좌우로 자유롭게 스윕
        const time = performance.now() / 1000;
        const facingAngle =
            this.owner.velocity.length() > 0 ? Math.atan2(this.owner.velocity.y, this.owner.velocity.x) : 0;
        const sweepOffset = Math.sin(time * SWEEP_SPEED) * (Math.PI * 0.45); // ±81°
        this.arcAngle = facingAngle + sweepOffset;

        if (!target || this.timer > 0) return;

        const toTarget = Vector2.subtract(target.position, this.owner.position);
        const dist = toTarget.length();
        if (dist > ARC_RANGE) return;

        const targetAngle = Math.atan2(toTarget.y, toTarget.x);
        const diff = Math.abs(normalizeAngle(targetAngle - this.arcAngle));
        if (diff > ARC_ANGLE / 2) return;

        // 범위 안에 들어왔다 — 베기!
        this.performSlash(target);
        this.timer = this.cooldown;
    }

    performSlash(target) {
        const damage = Math.round(this.owner.baseDamage * 1.6);
        target.takeDamage(damage, this.owner, "Slash");

        const kbDir = Vector2.subtract(target.position, this.owner.position).normalize();
        target.applyKnockback(kbDir.scale(380), 0.3);

        // Slash 애니메이션 설정 — arcAngle 기준으로 ±60도 휘두르기
        this.slashTimer = SLASH_DURATION;
        this.slashStartAngle = this.arcAngle - ARC_ANGLE / 2;
        this.slashEndAngle = this.arcAngle + ARC_ANGLE / 2;

        // 시각 효과 — 베기 궤적
        const slashEnd = Vector2.add(this.owner.position, kbDir.clone().scale(ARC_RANGE));
        this.simulation.spawnSlash(this.owner.position.clone(), slashEnd, this.owner.color);
        this.simulation.spawnSlash(this.owner.position.clone(), target.position.clone(), "#ffffff");
        this.simulation.playSound("dash", 1.0);
        this.simulation.addLog(`${this.owner.name} slashes ${target.name}!`);
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

        // ── 검 ──
        this._drawSword(ctx, time);
    }

    /** Slash 베기 궤적 애니메이션 */
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
        ctx.arc(pos.x, pos.y, ARC_RANGE * 0.55, this.slashStartAngle, currentEnd);
        ctx.stroke();

        // 메인 베기 선
        ctx.strokeStyle = this.owner.color;
        ctx.lineWidth = 5 - progress * 3;
        ctx.globalAlpha = glowAlpha * 0.9;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ARC_RANGE * 0.55, this.slashStartAngle, currentEnd);
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
            ctx.arc(pos.x, pos.y, ARC_RANGE * 0.55 - i * 8, this.slashStartAngle, trailEnd);
            ctx.stroke();
        }

        ctx.restore();
    }

    /** 120도 시야 범위 표시 */
    _drawVisionArc(ctx, pos) {
        const arcStart = this.arcAngle - ARC_ANGLE / 2;
        const arcEnd = this.arcAngle + ARC_ANGLE / 2;

        // 평소에는 흐리게, slash 중에는 더 흐리게
        ctx.save();
        ctx.strokeStyle = this.owner.color;
        ctx.globalAlpha = this.slashTimer > 0 ? 0.08 : 0.25;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ARC_RANGE, arcStart, arcEnd);
        ctx.stroke();
        ctx.setLineDash([]);

        // arc 양 끝 선
        ctx.globalAlpha = this.slashTimer > 0 ? 0.05 : 0.15;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + Math.cos(arcStart) * ARC_RANGE, pos.y + Math.sin(arcStart) * ARC_RANGE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + Math.cos(arcEnd) * ARC_RANGE, pos.y + Math.sin(arcEnd) * ARC_RANGE);
        ctx.stroke();
        ctx.restore();
    }

    /** 검을 항상 들고 있는 모습 */
    _drawSword(ctx, time) {
        const pos = this.owner.position;
        const r = this.owner.radius;

        // 검 방향 — arcAngle 기준
        // slash 중에는 휘두르는 방향으로 회전
        let swordAngle = this.arcAngle;
        if (this.slashTimer > 0) {
            const progress = 1 - this.slashTimer / SLASH_DURATION;
            swordAngle = this.slashStartAngle + (this.slashEndAngle - this.slashStartAngle) * progress;
        } else {
            // Idle — 검을 약간 떨림 (호흡)
            const idleBob = Math.sin(time * 3) * 0.04;
            swordAngle += idleBob;
        }

        // 검 시작점 (공 표면에서 나가는 위치)
        const hx = pos.x + Math.cos(swordAngle) * (r + HAND_OFFSET);
        const hy = pos.y + Math.sin(swordAngle) * (r + HAND_OFFSET);

        // 검 끝점
        const sx = hx + Math.cos(swordAngle) * SWORD_LENGTH;
        const sy = hy + Math.sin(swordAngle) * SWORD_LENGTH;

        // 손잡이 끝
        const handleEndX = hx - Math.cos(swordAngle) * SWORD_HANDLE;
        const handleEndY = hy - Math.sin(swordAngle) * SWORD_HANDLE;

        ctx.save();

        // 검날 — 메인 블레이드
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        // 검날 하이라이트 (중앙 흰선)
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        // 가드 (검과 손잡이 사이 십자가)
        ctx.strokeStyle = "#cc9900";
        ctx.lineWidth = 4;
        ctx.lineCap = "butt";
        const guardPerp = new Vector2(-Math.sin(swordAngle), Math.cos(swordAngle));
        ctx.beginPath();
        ctx.moveTo(hx + guardPerp.x * 8, hy + guardPerp.y * 8);
        ctx.lineTo(hx - guardPerp.x * 8, hy - guardPerp.y * 8);
        ctx.stroke();

        // 손잡이
        ctx.strokeStyle = "#8b4513";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(handleEndX, handleEndY);
        ctx.stroke();

        // 손잡이 마감 (pommel)
        ctx.fillStyle = "#cc9900";
        ctx.beginPath();
        ctx.arc(handleEndX, handleEndY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /** 기합띠를 맨 검사 얼굴 */
    drawFace(ctx, rotation, ball) {
        const { r } = this._faceContext(ball);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // 눈썹 (강인한 인상)
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = Math.max(2.5, r * 0.06);
        this._line(ctx, ball, [
            [-0.32, -0.2],
            [-0.14, -0.16]
        ]);
        this._line(ctx, ball, [
            [0.32, -0.2],
            [0.14, -0.16]
        ]);

        // 날카로운 눈 (사선)
        ctx.lineWidth = Math.max(3, r * 0.075);
        this._line(ctx, ball, [
            [-0.28, -0.08],
            [-0.12, -0.02]
        ]);
        this._line(ctx, ball, [
            [0.28, -0.08],
            [0.12, -0.02]
        ]);

        // 입 (약간 비웃는 표정)
        ctx.beginPath();
        ctx.moveTo(-0.12 * r, 0.22 * r);
        ctx.quadraticCurveTo(0, 0.32 * r, 0.14 * r, 0.2 * r);
        ctx.stroke();

        // 기합띠 (headband) — 이마를 가로지르는 띠
        ctx.strokeStyle = "#ff4444";
        ctx.lineWidth = Math.max(4, r * 0.1);
        this._line(ctx, ball, [
            [-0.52, -0.28],
            [0.52, -0.28]
        ]);

        // 기합띠 끝 — 오른쪽에서 늘어뜨리기
        ctx.lineWidth = Math.max(2.5, r * 0.06);
        this._line(ctx, ball, [
            [0.52, -0.28],
            [0.62, -0.08],
            [0.56, 0.02]
        ]);

        return true;
    }

    getUiState() {
        return {
            label: this.timer > 0 ? "Slash" : "Ready",
            progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }
}
