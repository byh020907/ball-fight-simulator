import { createDragTrajectoryScene } from "./trajectoryScene.js";

const TIER_COLORS = ["#5ce1e6", "#ffd166", "#ff8c42", "#ff4db8"];
const FRONT_COLOR = "#ff4d5a";
const TAU = Math.PI * 2;

function launchSpeedMultiplier(snapshot, chargeRatio) {
    const launch = snapshot.launch ?? {};
    const minimum = Math.max(0, Number(launch.minSpeedRatio) || 0);
    const maximum = Math.max(minimum, Number(launch.maxSpeedRatio) || minimum);
    const tuning = Math.max(0, Number(launch.releaseSpeedMultiplier) || 1);
    return (minimum + (maximum - minimum) * chargeRatio) * tuning;
}

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
        this.visualElapsed = 0;
    }

    renderWorld(ctx, simulation, runtimeSnapshot, delta = 0) {
        if (!simulation || simulation.finished || !runtimeSnapshot?.enabled) return 0;
        const automated = runtimeSnapshot.automated === true;
        if (!simulation.playerBall && !automated) return 0;
        const hasManualPlayer = Boolean(simulation.playerBall) && !automated;
        if (this.simulation !== simulation) this.#resetForSimulation(simulation);
        this.visualElapsed += Math.max(0, Number.isFinite(delta) ? delta : 0);
        this.#consumeEvent(runtimeSnapshot, delta);
        let commands = 0;
        if (hasManualPlayer && runtimeSnapshot.drag.state === "aiming") {
            const scene = createDragTrajectoryScene({ simulation, runtimeSnapshot });
            commands += this.#drawAim(ctx, simulation, runtimeSnapshot, scene);
        }
        if (hasManualPlayer) commands += this.#drawFixedShields(ctx, simulation, runtimeSnapshot);
        commands += this.#drawEnemyTelegraph(ctx, simulation, runtimeSnapshot);
        if (hasManualPlayer) commands += this.#drawEvent(ctx, simulation);
        return commands;
    }

    renderScreen(ctx, simulation, runtimeSnapshot) {
        if (
            !simulation?.playerBall ||
            simulation.finished ||
            !runtimeSnapshot?.enabled ||
            runtimeSnapshot.automated === true
        )
            return 0;
        const scale = getDeviceScale(this.canvas);
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
            this.#drawDragStateHud(ctx, runtimeSnapshot, scale);
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
        const duration = Math.max(0.001, Number(snapshot.playerShot.shieldDuration) || 0.8);
        const remaining = Math.max(0, Number(snapshot.playerShot.shieldRemaining) || 0);
        const remainingRatio = Math.max(0, Math.min(1, remaining / duration));
        const pulse = 0.5 + 0.5 * Math.sin(this.visualElapsed * 13);
        let commands = 0;
        for (const shield of snapshot.playerShot.shields ?? []) {
            const fighter = fighterById(simulation, shield.fighterId);
            if (!fighter || !finitePoint(shield.forward)) continue;
            const angle = Math.atan2(shield.forward.y, shield.forward.x);
            ctx.save();
            try {
                ctx.translate(fighter.position.x, fighter.position.y);
                ctx.rotate(angle);
                const radius = fighter.radius + 20;
                const sweep = Math.PI * (0.25 + remainingRatio * 0.55);
                const start = -sweep / 2;
                const end = sweep / 2;
                ctx.lineCap = "round";
                ctx.globalAlpha = 0.45 + remainingRatio * 0.35;
                ctx.strokeStyle = "#102535";
                ctx.lineWidth = 13;
                ctx.beginPath();
                ctx.arc(0, 0, radius, start, end);
                ctx.stroke();

                ctx.shadowColor = "rgba(92, 225, 230, 0.72)";
                ctx.shadowBlur = 7 + pulse * 4;
                ctx.globalAlpha = 0.12 + remainingRatio * 0.18;
                ctx.strokeStyle = "#5ce1e6";
                ctx.lineWidth = 9;
                ctx.beginPath();
                ctx.arc(0, 0, radius, start, end);
                ctx.stroke();

                ctx.shadowBlur = 2;
                ctx.globalAlpha = (0.55 + pulse * 0.12) * (0.45 + remainingRatio * 0.55);
                ctx.strokeStyle = "#dcffff";
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.arc(0, 0, radius, start, end);
                ctx.stroke();

                ctx.shadowBlur = 0;
                ctx.globalAlpha = 0.24 + remainingRatio * 0.56;
                ctx.strokeStyle = "#5ce1e6";
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 5]);
                ctx.beginPath();
                ctx.arc(0, 0, radius - 8, start + 0.08, end - 0.08);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.globalAlpha = 0.48 + remainingRatio * 0.44;
                ctx.strokeStyle = "#f3ffff";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(radius + 3, -7);
                ctx.lineTo(radius + 11, 0);
                ctx.lineTo(radius + 3, 7);
                ctx.stroke();
            } finally {
                ctx.restore();
            }
            commands += 1;
        }
        return commands;
    }

    #drawDragStateHud(ctx, snapshot, scale) {
        const state = this.#dragHudState(snapshot);
        const width = 214 * scale;
        const height = 46 * scale;
        const x = (this.canvas.width - width) / 2;
        const y = this.canvas.height - height - 10 * scale;
        const iconSize = 30 * scale;
        const iconX = x + 8 * scale;
        const iconY = y + 7 * scale;
        const textX = x + 48 * scale;

        ctx.fillStyle = "rgba(7, 17, 27, 0.91)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, width, height, 13 * scale);
        else ctx.rect(x, y, width, height);
        ctx.fill();
        ctx.globalAlpha = 0.72;
        ctx.strokeStyle = state.color;
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.fillStyle = state.iconFill;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(iconX, iconY, iconSize, iconSize, 9 * scale);
        else ctx.rect(iconX, iconY, iconSize, iconSize);
        ctx.fill();
        ctx.strokeStyle = state.color;
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
        ctx.font = `900 ${15 * scale}px Bahnschrift, Segoe UI, sans-serif`;
        ctx.fillStyle = state.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(state.icon, iconX + iconSize / 2, iconY + iconSize / 2 + 0.5 * scale);

        ctx.textAlign = "left";
        ctx.font = `800 ${12 * scale}px Bahnschrift, Segoe UI, sans-serif`;
        ctx.fillStyle = "#f7fbff";
        ctx.fillText(state.label, textX, y + 15 * scale);
        ctx.font = `700 ${10 * scale}px Bahnschrift, Segoe UI, sans-serif`;
        ctx.fillStyle = "rgba(226, 239, 247, 0.78)";
        ctx.fillText(state.detail, textX, y + 30 * scale);

        const trackX = textX;
        const trackY = y + height - 6 * scale;
        const trackWidth = width - (textX - x) - 10 * scale;
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fillRect(trackX, trackY, trackWidth, 2 * scale);
        ctx.fillStyle = state.color;
        ctx.fillRect(trackX, trackY, trackWidth * state.progress, 2 * scale);
        if (snapshot.drag.state === "aiming") {
            ctx.fillStyle = "#d7ffff";
            ctx.fillRect(trackX + trackWidth / 2 - scale, trackY - scale, 2 * scale, 4 * scale);
        }
    }

    #dragHudState(snapshot) {
        const drag = snapshot.drag;
        if (drag.inputLockRemaining > 0) {
            return {
                label: "반격 경직",
                detail: `${drag.inputLockRemaining.toFixed(1)}초 뒤 조작 가능`,
                icon: "!",
                color: "#ff7b68",
                iconFill: "rgba(255, 90, 70, 0.18)",
                progress: Math.max(0, Math.min(1, 1 - drag.inputLockRemaining / 0.27))
            };
        }
        if (snapshot.playerShot?.active) {
            const duration = Math.max(0.001, Number(snapshot.playerShot.flightDuration) || 2.4);
            const remaining = Math.max(0, Number(snapshot.playerShot.flightRemaining) || 0);
            return {
                label: "드래그 돌진 중",
                detail: "돌진 종료 후 다시 조준",
                icon: "➜",
                color: "#5ce1e6",
                iconFill: "rgba(92, 225, 230, 0.14)",
                progress: Math.max(0, Math.min(1, remaining / duration))
            };
        }
        if (drag.state === "aiming") {
            const chargeRatio = Math.max(0, Math.min(1, Number(drag.chargeRatio) || 0));
            return {
                label: `차징 ${Math.round(chargeRatio * 100)}%`,
                detail: `예상 속도 ×${launchSpeedMultiplier(snapshot, chargeRatio).toFixed(2)}`,
                icon: "➜",
                color: tierColor(Math.max(0, Math.ceil(chargeRatio * 3))),
                iconFill: "rgba(92, 225, 230, 0.14)",
                progress: chargeRatio
            };
        }
        return {
            label: "드래그 준비",
            detail: "당겼다 놓아 반사 발사",
            icon: "➜",
            color: TIER_COLORS[0],
            iconFill: "rgba(92, 225, 230, 0.14)",
            progress: 1
        };
    }

    #drawEnemyTelegraph(ctx, simulation, snapshot) {
        const queue = snapshot.enemyQueue;
        if (!queue || queue.phase !== "windup") return 0;
        const attacker = fighterById(simulation, queue.attackerId);
        if (!attacker || !finitePoint(queue.windupDirection)) return 0;
        const angle = Math.atan2(queue.windupDirection.y, queue.windupDirection.x);
        const progress = Math.max(0, Math.min(1, Number(queue.displayProgress) || 0));
        const accelerating = queue.accelerating === true;
        ctx.save();
        try {
            ctx.translate(attacker.position.x, attacker.position.y);
            ctx.rotate(angle);
            this.#drawEnemyWindupRail(ctx, attacker, progress, accelerating);
        } finally {
            ctx.restore();
        }
        this.#drawLabel(
            ctx,
            accelerating ? "돌진 가속" : "돌진 조준",
            attacker.position.x,
            attacker.position.y - attacker.radius - 26,
            accelerating ? "#ffd166" : "#ff5548"
        );
        return 1;
    }

    #drawEnemyWindupRail(ctx, attacker, progress, accelerating) {
        const start = attacker.radius + 16;
        const end = start + 150;
        const pulse = 0.5 + 0.5 * Math.sin(this.visualElapsed * 12);
        const coreColor = accelerating ? "#ffd166" : "#ff5548";
        const brightColor = accelerating ? "#ffd166" : "#fff0e6";
        const dashSpeed = accelerating ? 180 : 65;
        ctx.lineCap = "round";

        ctx.globalAlpha = 0.52 + progress * 0.18;
        ctx.strokeStyle = "#2d1115";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(start, 0);
        ctx.lineTo(end - 12, 0);
        ctx.stroke();

        ctx.globalAlpha = 0.2 + progress * 0.22;
        ctx.strokeStyle = "#ff806c";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(start + 4, -8);
        ctx.lineTo(end - 18, -4);
        ctx.moveTo(start + 4, 8);
        ctx.lineTo(end - 18, 4);
        ctx.stroke();

        ctx.globalAlpha = 0.58 + progress * 0.3;
        ctx.strokeStyle = coreColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([9, 7]);
        ctx.lineDashOffset = -(this.visualElapsed * dashSpeed) % 16;
        ctx.beginPath();
        ctx.moveTo(start, 0);
        ctx.lineTo(end - 14, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.globalAlpha = 0.44 + pulse * 0.18 + progress * 0.18;
        ctx.strokeStyle = "#ffd2c3";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (const offset of [36, 76, 116]) {
            const x = start + offset;
            ctx.moveTo(x - 7, -6);
            ctx.lineTo(x, 0);
            ctx.lineTo(x - 7, 6);
        }
        ctx.stroke();

        const phase = this.visualElapsed * 2.8;
        ctx.globalAlpha = 0.64 + pulse * 0.22;
        ctx.strokeStyle = brightColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(end, 0, 10, phase, phase + Math.PI * 1.25);
        ctx.stroke();
        ctx.globalAlpha = 0.52 + progress * 0.38;
        ctx.strokeStyle = coreColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(end, 0, 5, 0, TAU);
        ctx.stroke();

        ctx.globalAlpha = 0.38;
        ctx.strokeStyle = "#2d1115";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, attacker.radius + 16, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 0.82 + pulse * 0.12;
        ctx.strokeStyle = coreColor;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, attacker.radius + 16, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
        ctx.stroke();
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

    #resetForSimulation(simulation) {
        this.simulation = simulation;
        this.eventSequence = 0;
        this.eventElapsed = Infinity;
        this.event = null;
        this.visualElapsed = 0;
    }
}
