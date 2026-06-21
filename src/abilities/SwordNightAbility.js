import { Vector2 } from "../core.js";
import { Ability } from "./Ability.js";

const ARC_ANGLE = (Math.PI * 2) / 3; // 120도
const ARC_RANGE = 200;
const SWEEP_SPEED = 2.5;

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
    }

    update(delta, target) {
        this.timer -= delta;

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
        // 시야 범위(arc) 표시
        const pos = this.owner.position;
        const r = this.owner.radius;
        const arcStart = this.arcAngle - ARC_ANGLE / 2;
        const arcEnd = this.arcAngle + ARC_ANGLE / 2;

        ctx.save();
        ctx.strokeStyle = this.owner.color;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ARC_RANGE, arcStart, arcEnd);
        ctx.stroke();
        ctx.setLineDash([]);

        // arc 양 끝 선
        ctx.globalAlpha = 0.15;
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

    /** 기합띠를 맨 검사 얼굴 */
    drawFace(ctx, rotation, ball) {
        const { r } = this._faceContext(ball);

        // 날카로운 눈 (사선)
        ctx.lineWidth = Math.max(3, r * 0.075);

        // 왼쪽 눈
        ctx.beginPath();
        ctx.moveTo(-0.28 * r, -0.08 * r);
        ctx.lineTo(-0.12 * r, -0.02 * r);
        ctx.stroke();

        // 오른쪽 눈
        ctx.beginPath();
        ctx.moveTo(0.28 * r, -0.08 * r);
        ctx.lineTo(0.12 * r, -0.02 * r);
        ctx.stroke();

        // 입 (약간 비웃는 표정)
        ctx.beginPath();
        ctx.moveTo(-0.12 * r, 0.22 * r);
        ctx.quadraticCurveTo(0, 0.32 * r, 0.14 * r, 0.2 * r);
        ctx.stroke();

        // 기합띠 (headband) — 이마를 가로지르는 띠
        ctx.strokeStyle = "#ff4444";
        ctx.lineWidth = Math.max(4, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(-0.52 * r, -0.28 * r);
        ctx.lineTo(0.52 * r, -0.28 * r);
        ctx.stroke();

        // 기합띠 끝 — 오른쪽에서 늘어뜨리기
        ctx.strokeStyle = "#ff4444";
        ctx.lineWidth = Math.max(2.5, r * 0.06);
        ctx.beginPath();
        ctx.moveTo(0.52 * r, -0.28 * r);
        ctx.lineTo(0.62 * r, -0.08 * r);
        ctx.lineTo(0.56 * r, 0.02 * r);
        ctx.stroke();

        // 눈썹 (강인한 인상)
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = Math.max(2.5, r * 0.06);
        ctx.beginPath();
        ctx.moveTo(-0.32 * r, -0.2 * r);
        ctx.lineTo(-0.14 * r, -0.16 * r);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0.32 * r, -0.2 * r);
        ctx.lineTo(0.14 * r, -0.16 * r);
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
