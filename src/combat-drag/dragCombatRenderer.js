import { createDragTrajectoryScene } from "./trajectoryScene.js";

const TIER_COLORS = ["#5ce1e6", "#ffd166", "#ff8c42", "#ff4db8"];
const DANGER_COLOR = "#ff5a36";
const FRONT_COLOR = "#ff4d5a";
const TAU = Math.PI * 2;

function finitePoint(point) {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function fighterById(simulation, id) {
    return simulation?.fighters?.find((fighter) => fighter.id === id) ?? null;
}

function tierColor(tier) {
    return TIER_COLORS[Math.max(0, Math.min(3, tier ?? 0))];
}

function getDeviceScale(canvas) {
    const rect = canvas?.getBoundingClientRect?.();
    return rect?.width > 0 ? canvas.width / rect.width : 1;
}

export class DragCombatRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.eventSequence = 0;
        this.eventElapsed = Infinity;
        this.event = null;
        this.simulation = null;
    }

    renderWorld(ctx, simulation, runtimeSnapshot, delta = 0) {
        if (!simulation?.playerBall || simulation.finished || !runtimeSnapshot?.enabled) return 0;
        if (this.simulation !== simulation) this.#resetForSimulation(simulation);
        this.#consumeEvent(runtimeSnapshot, delta);
        const scene = createDragTrajectoryScene({ simulation, runtimeSnapshot });
        let commands = 0;
        if (runtimeSnapshot.drag.state === "aiming") commands += this.#drawAim(ctx, simulation, runtimeSnapshot, scene);
        commands += this.#drawFixedShields(ctx, simulation, runtimeSnapshot);
        commands += this.#drawEnemyTelegraph(ctx, simulation, runtimeSnapshot);
        commands += this.#drawEvent(ctx, simulation);
        return commands;
    }

    renderScreen(ctx, simulation, runtimeSnapshot) {
        if (!simulation?.playerBall || simulation.finished || !runtimeSnapshot?.enabled) return 0;
        const scale = getDeviceScale(this.canvas);
        const text = this.#hudText(runtimeSnapshot);
        ctx.save();
        try {
            if (runtimeSnapshot.drag.state === "aiming") {
                const edge = Math.max(20 * scale, Math.min(this.canvas.width, this.canvas.height) * 0.05);
                ctx.fillStyle = "rgba(92, 225, 230, 0.10)";
                ctx.fillRect(0, 0, this.canvas.width, edge);
                ctx.fillRect(0, this.canvas.height - edge, this.canvas.width, edge);
                ctx.fillRect(0, 0, edge, this.canvas.height);
                ctx.fillRect(this.canvas.width - edge, 0, edge, this.canvas.height);
            }
            const padding = 10 * scale;
            const fontSize = 13 * scale;
            ctx.font = `800 ${fontSize}px Bahnschrift, Segoe UI, sans-serif`;
            const width = ctx.measureText(text).width + padding * 2;
            const height = 30 * scale;
            const x = (this.canvas.width - width) / 2;
            const y = this.canvas.height - height - 12 * scale;
            ctx.fillStyle = "rgba(7, 17, 27, 0.88)";
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, y, width, height, height / 2);
            else ctx.rect(x, y, width, height);
            ctx.fill();
            ctx.fillStyle = "#f7fbff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, this.canvas.width / 2, y + height / 2);
            if (runtimeSnapshot.drag.state === "aiming") this.#drawRewardLegend(ctx, scale);
        } finally {
            ctx.restore();
        }
        return 1;
    }

    #drawAim(ctx, simulation, snapshot, scene) {
        const player = simulation.playerBall;
        let commands = 0;
        ctx.save();
        try {
            ctx.strokeStyle = "rgba(92, 225, 230, 0.72)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(player.position.x, player.position.y, player.radius + 12, 0, TAU);
            ctx.stroke();
            if (scene.segments.length === 0) {
                this.#drawLabel(
                    ctx,
                    "더 당겨 조준",
                    player.position.x,
                    player.position.y - player.radius - 28,
                    "#d7ffff"
                );
                return 1;
            }
            for (const segment of scene.segments) {
                ctx.save();
                ctx.strokeStyle = tierColor(segment.rewardTier);
                ctx.lineWidth = 5;
                ctx.setLineDash([10, 7]);
                ctx.lineDashOffset = -segment.index * 4;
                ctx.beginPath();
                ctx.moveTo(segment.origin.x, segment.origin.y);
                ctx.lineTo(segment.end.x, segment.end.y);
                ctx.stroke();
                ctx.restore();
                commands += 1;
            }
            for (const bounce of scene.bounces) {
                ctx.fillStyle = tierColor(bounce.tier);
                ctx.beginPath();
                ctx.arc(bounce.point.x, bounce.point.y, 10, 0, TAU);
                ctx.fill();
                this.#drawLabel(ctx, `${bounce.tier}`, bounce.point.x, bounce.point.y + 0.5, "#07111b", 11);
                commands += 1;
            }
            if (scene.terminal?.fighterId) {
                const target = fighterById(simulation, scene.terminal.fighterId);
                if (target) {
                    const label =
                        scene.terminal.shieldResult === "front-counter"
                            ? "정면 반격"
                            : scene.terminal.shieldResult === "rear-hit"
                              ? `후면 ${Math.max(1, scene.bounces.length)} 반사`
                              : "예상 적중";
                    const color =
                        scene.terminal.shieldResult === "front-counter" ? FRONT_COLOR : tierColor(scene.bounces.length);
                    this.#drawTerminal(ctx, target, scene.terminal.point, label, color);
                    commands += 1;
                }
            }
        } finally {
            ctx.restore();
        }
        return commands;
    }

    #drawFixedShields(ctx, simulation, snapshot) {
        if (!snapshot.playerShot?.active) return 0;
        let commands = 0;
        for (const shield of snapshot.playerShot.shields ?? []) {
            const fighter = fighterById(simulation, shield.fighterId);
            if (!fighter || !finitePoint(shield.forward)) continue;
            const angle = Math.atan2(shield.forward.y, shield.forward.x);
            ctx.save();
            ctx.translate(fighter.position.x, fighter.position.y);
            ctx.rotate(angle);
            ctx.fillStyle = "rgba(255, 90, 54, 0.16)";
            ctx.strokeStyle = "#ffb05a";
            ctx.lineWidth = 11;
            ctx.beginPath();
            ctx.arc(0, 0, fighter.radius + 24, -Math.PI / 2, Math.PI / 2);
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
            commands += 1;
        }
        return commands;
    }

    #drawEnemyTelegraph(ctx, simulation, snapshot) {
        const queue = snapshot.enemyQueue;
        if (!queue || (queue.phase !== "windup" && queue.phase !== "flight")) return 0;
        const attacker = fighterById(simulation, queue.attackerId);
        if (!attacker || !finitePoint(queue.fixedWindupDirection)) return 0;
        const angle = Math.atan2(queue.fixedWindupDirection.y, queue.fixedWindupDirection.x);
        ctx.save();
        try {
            ctx.translate(attacker.position.x, attacker.position.y);
            ctx.rotate(angle);
            const progress = Math.max(0, Math.min(1, queue.elapsed / 1));
            const flight = queue.phase === "flight";
            const length = flight ? 190 : 170;
            const nearWidth = flight ? 34 : 28;
            const farWidth = flight ? 18 : 12;
            ctx.globalAlpha = flight ? 0.42 : 0.2 + progress * 0.2;
            ctx.fillStyle = flight ? "#ff3d2e" : DANGER_COLOR;
            ctx.beginPath();
            ctx.moveTo(attacker.radius + 12, -nearWidth);
            ctx.lineTo(attacker.radius + length, -farWidth);
            ctx.lineTo(attacker.radius + length, farWidth);
            ctx.lineTo(attacker.radius + 12, nearWidth);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = flight ? 1 : 0.78 + progress * 0.22;
            ctx.strokeStyle = flight ? "#ff2720" : "#ff6b45";
            ctx.lineWidth = flight ? 8 : 6;
            ctx.beginPath();
            ctx.moveTo(attacker.radius + 14, 0);
            ctx.lineTo(attacker.radius + length, 0);
            ctx.stroke();
            ctx.strokeStyle = "#fff0d6";
            ctx.lineWidth = flight ? 5 : 4;
            ctx.beginPath();
            ctx.moveTo(attacker.radius + length, 0);
            ctx.lineTo(attacker.radius + length - 18, -12);
            ctx.moveTo(attacker.radius + length, 0);
            ctx.lineTo(attacker.radius + length - 18, 12);
            ctx.stroke();
            ctx.strokeStyle = flight ? "#ff2720" : DANGER_COLOR;
            ctx.lineWidth = flight ? 7 : 5;
            ctx.beginPath();
            ctx.arc(0, 0, attacker.radius + 18, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
            ctx.stroke();
        } finally {
            ctx.restore();
        }
        this.#drawLabel(
            ctx,
            queue.phase === "flight" ? "돌진" : "돌진 예고",
            attacker.position.x,
            attacker.position.y - attacker.radius - 26,
            "#9b1d16"
        );
        return 1;
    }

    #drawEvent(ctx, simulation) {
        if (!this.event || this.eventElapsed > 0.45) return 0;
        const player = simulation.playerBall;
        const ratio = 1 - this.eventElapsed / 0.45;
        const tier = Math.max(1, Math.min(3, this.event.bounceCount ?? 1));
        const feedback = {
            bounce: { label: `${tier} 반사`, color: tierColor(tier) },
            "rear-hit": { label: `후면 ${tier} 반사`, color: tierColor(tier) },
            "shield-counter": { label: "정면 반격", color: FRONT_COLOR },
            "plain-hit": { label: "직선 충돌", color: FRONT_COLOR }
        }[this.event.type];
        if (!feedback) return 0;
        ctx.save();
        try {
            ctx.globalAlpha = 1 - ratio;
            ctx.strokeStyle = feedback.color;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(player.position.x, player.position.y, player.radius + 12 + ratio * 22, 0, TAU);
            ctx.stroke();
        } finally {
            ctx.restore();
        }
        this.#drawLabel(ctx, feedback.label, player.position.x, player.position.y - player.radius - 34, feedback.color);
        return 1;
    }

    #drawTerminal(ctx, target, point, label, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(target.position.x, target.position.y, target.radius + 9, 0, TAU);
        ctx.stroke();
        if (finitePoint(point)) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, TAU);
            ctx.fill();
        }
        this.#drawLabel(ctx, label, target.position.x, target.position.y - target.radius - 28, color);
    }

    #drawLabel(ctx, text, x, y, color, size = 13) {
        ctx.save();
        ctx.font = `800 ${size}px Bahnschrift, Segoe UI, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(7, 17, 27, 0.78)";
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    #drawRewardLegend(ctx, scale) {
        const height = 24 * scale;
        const width = 132 * scale;
        const x = Math.max(12 * scale, (this.canvas.width - width) / 2);
        const y = 12 * scale;
        ctx.save();
        try {
            ctx.fillStyle = "rgba(7, 17, 27, 0.76)";
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, y, width, height, height / 2);
            else ctx.rect(x, y, width, height);
            ctx.fill();
            ctx.font = `800 ${11 * scale}px Bahnschrift, Segoe UI, sans-serif`;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#f7fbff";
            ctx.fillText("반사 보상", x + 10 * scale, y + height / 2);
            [1, 2, 3].forEach((tier, index) => {
                ctx.fillStyle = tierColor(tier);
                ctx.fillText(`${tier}`, x + (78 + index * 16) * scale, y + height / 2);
            });
        } finally {
            ctx.restore();
        }
    }

    #consumeEvent(snapshot, delta) {
        if (!snapshot.lastEvent) {
            this.event = null;
            this.eventElapsed = Infinity;
            return;
        }
        this.eventElapsed += Math.max(0, delta);
        const event = snapshot.lastEvent;
        if (!event || !Number.isFinite(event.sequence) || event.sequence <= this.eventSequence) return;
        this.eventSequence = event.sequence;
        this.eventElapsed = 0;
        this.event = event;
    }

    #hudText(snapshot) {
        if (snapshot.drag.inputLockRemaining > 0) return `반격 경직 · ${snapshot.drag.inputLockRemaining.toFixed(1)}초`;
        if (snapshot.drag.cooldownRemaining > 0) return `재사용 · ${snapshot.drag.cooldownRemaining.toFixed(1)}초`;
        if (snapshot.drag.state === "aiming") {
            const remaining = Math.max(0, snapshot.drag.maxAimSeconds - snapshot.drag.aimElapsed);
            return `놓아 발사 · ${remaining.toFixed(1)}초`;
        }
        return "드래그 준비";
    }

    #resetForSimulation(simulation) {
        this.simulation = simulation;
        this.eventSequence = 0;
        this.eventElapsed = Infinity;
        this.event = null;
    }
}
