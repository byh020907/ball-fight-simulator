import assert from "node:assert/strict";
import { DragCombatRenderer } from "../src/combat-drag/dragCombatRenderer.js";

class Context {
    constructor() {
        this.commands = [];
    }
    save() {
        this.commands.push("save");
    }
    restore() {
        this.commands.push("restore");
    }
    beginPath() {
        this.commands.push("begin");
    }
    arc(...args) {
        this.commands.push(["arc", ...args]);
    }
    moveTo(...args) {
        this.commands.push(["move", ...args]);
    }
    lineTo(...args) {
        this.commands.push(["line", ...args]);
    }
    closePath() {
        this.commands.push("close");
    }
    stroke() {
        this.commands.push("stroke");
    }
    fill() {
        this.commands.push("fill");
    }
    fillRect(...args) {
        this.commands.push(["rect", ...args]);
    }
    translate() {
        this.commands.push("translate");
    }
    rotate() {
        this.commands.push("rotate");
    }
    setLineDash() {
        this.commands.push("dash");
    }
    strokeText() {
        this.commands.push("strokeText");
    }
    fillText(text, x, y) {
        this.commands.push(["text", text, x, y]);
    }
    measureText(text) {
        return { width: text.length * 8 };
    }
    rect() {
        this.commands.push("pathRect");
    }
    set lineWidth(value) {
        this.commands.push(["lineWidth", value]);
    }
    set strokeStyle(value) {
        this.commands.push(["strokeStyle", value]);
    }
    set globalAlpha(value) {
        this.commands.push(["globalAlpha", value]);
    }
    set shadowColor(value) {
        this.commands.push(["shadowColor", value]);
    }
    set shadowBlur(value) {
        this.commands.push(["shadowBlur", value]);
    }
}

const canvas = { width: 390, height: 844, getBoundingClientRect: () => ({ width: 390, height: 844 }) };
const player = { id: "player", teamId: "a", radius: 20, position: { x: 100, y: 100 }, stats: { baseSpeed: 150 } };
const enemy = { id: "enemy", teamId: "b", radius: 20, position: { x: 260, y: 100 }, stats: { baseSpeed: 150 } };
const simulation = {
    width: 360,
    height: 700,
    playerBall: player,
    fighters: [player, enemy],
    terrain: [],
    finished: false
};
const idle = {
    enabled: true,
    launch: { minSpeedRatio: 1.65, maxSpeedRatio: 4.8, releaseSpeedMultiplier: 1 },
    drag: {
        state: "idle",
        inputLockRemaining: 0,
        aimElapsed: 0,
        maxAimSeconds: 1.2
    },
    playerShot: {
        active: false,
        flightRemaining: 0,
        flightDuration: 2.4,
        endProgress: 1,
        shieldRemaining: 0,
        shieldDuration: 0.8,
        shields: []
    },
    enemyQueue: { phase: "idle" }
};
const renderer = new DragCombatRenderer(canvas);
const idleContext = new Context();
assert.equal(renderer.renderWorld(idleContext, simulation, idle), 0);
assert.equal(idleContext.commands.length, 0);
assert.equal(renderer.renderWorld(new Context(), { ...simulation, playerBall: null }, idle), 0);
assert.equal(renderer.renderWorld(new Context(), { ...simulation, finished: true }, idle), 0);
const aim = {
    ...idle,
    drag: {
        state: "aiming",
        aimElapsed: 0.4,
        chargeRatio: 1 / 3,
        maxAimSeconds: 1.2,
        inputLockRemaining: 0,
        vector: { active: true, strength: 1, vector: { x: 1, y: 0 } }
    },
    enemyQueue: {
        phase: "windup",
        attackerId: "enemy",
        windupDirection: { x: -1, y: 0 },
        elapsed: 0.5,
        windupDuration: 1,
        displayProgress: 0.5,
        accelerating: false,
        flightDuration: 1.8
    },
    lastEvent: { type: "bounce", bounceCount: 2, sequence: 1 }
};
const aimContext = new Context();
assert.equal(renderer.renderWorld(aimContext, simulation, aim, 0.016) > 0, true);
assert.equal(
    aimContext.commands.filter((command) => command === "save").length,
    aimContext.commands.filter((command) => command === "restore").length
);
const playerChargeSnapshot = (chargeRatio) => ({
    ...idle,
    drag: { ...aim.drag, chargeRatio },
    enemyQueue: { phase: "idle" }
});
const earlyChargeContext = new Context();
const lateChargeContext = new Context();
renderer.renderWorld(earlyChargeContext, simulation, playerChargeSnapshot(0.1));
renderer.renderWorld(lateChargeContext, simulation, playerChargeSnapshot(0.8));
const playerChargeArc = (context) =>
    context.commands.find(
        (command) =>
            Array.isArray(command) &&
            command[0] === "arc" &&
            command[1] === player.position.x &&
            command[2] === player.position.y
    );
assert.ok(playerChargeArc(earlyChargeContext)[3] > playerChargeArc(lateChargeContext)[3]);
assert.ok(
    earlyChargeContext.commands.find((command) => Array.isArray(command) && command[0] === "globalAlpha")[1] <
        lateChargeContext.commands.find((command) => Array.isArray(command) && command[0] === "globalAlpha")[1]
);
assert.equal(
    lateChargeContext.commands.some(
        (command) => Array.isArray(command) && command[0] === "strokeStyle" && command[1] === "#5ce1e6"
    ),
    true
);
const playerDashSnapshot = (endProgress) => ({
    ...idle,
    playerShot: {
        ...idle.playerShot,
        active: true,
        flightRemaining: (1 - endProgress) * idle.playerShot.flightDuration,
        endProgress
    }
});
const earlyDashContext = new Context();
const lateDashContext = new Context();
renderer.renderWorld(earlyDashContext, simulation, playerDashSnapshot(0.1));
renderer.renderWorld(lateDashContext, simulation, playerDashSnapshot(0.9));
const playerDashArc = (context) =>
    context.commands.find(
        (command) =>
            Array.isArray(command) &&
            command[0] === "arc" &&
            command[1] === player.position.x &&
            command[2] === player.position.y
    );
assert.ok(playerDashArc(earlyDashContext)[3] > playerDashArc(lateDashContext)[3]);
assert.ok(playerDashArc(lateDashContext)[3] > player.radius);
assert.ok(
    earlyDashContext.commands.find((command) => Array.isArray(command) && command[0] === "globalAlpha")[1] <
        lateDashContext.commands.find((command) => Array.isArray(command) && command[0] === "globalAlpha")[1]
);
assert.equal(
    earlyDashContext.commands.some((command) => Array.isArray(command) && command[0] === "text"),
    false,
    "player dash-end feedback should stay attached to the fighter without a moving label"
);
const automatedContext = new Context();
const automatedSnapshot = {
    ...idle,
    automated: true,
    enemyQueue: {
        phase: "windup",
        attackerId: "player",
        targetId: "enemy",
        windupDirection: { x: 1, y: 0 },
        elapsed: 0.5,
        windupDuration: 1,
        flightDuration: 1.8
    }
};
const automatedRenderer = new DragCombatRenderer(canvas);
assert.equal(
    automatedRenderer.renderWorld(automatedContext, { ...simulation, playerBall: null }, automatedSnapshot, 0.016) > 0,
    true,
    "automated character matches should still render their charge telegraph"
);
assert.equal(
    automatedRenderer.renderScreen(new Context(), { ...simulation, playerBall: null }, automatedSnapshot),
    0,
    "spectated automated matches should not render manual drag HUD"
);
const shieldContext = new Context();
renderer.renderWorld(
    shieldContext,
    simulation,
    {
        ...idle,
        playerShot: {
            active: true,
            flightRemaining: 1.8,
            flightDuration: 2.4,
            endProgress: 0.25,
            shieldRemaining: 0.6,
            shieldDuration: 0.8,
            shields: [{ fighterId: "enemy", forward: { x: -1, y: 0 } }]
        }
    },
    0
);
assert.equal(
    shieldContext.commands.some(
        (command) => Array.isArray(command) && command[0] === "arc" && command[3] === enemy.radius + 20
    ),
    true
);
assert.equal(
    shieldContext.commands.some(
        (command) => Array.isArray(command) && command[0] === "strokeStyle" && command[1] === "#5ce1e6"
    ),
    true
);
assert.equal(shieldContext.commands.includes("fill"), false, "shield stays an open energy visor without a solid wedge");
const expiringShieldContext = new Context();
renderer.renderWorld(
    expiringShieldContext,
    simulation,
    {
        ...idle,
        playerShot: {
            active: true,
            flightRemaining: 0.3,
            flightDuration: 2.4,
            endProgress: 0.875,
            shieldRemaining: 0.1,
            shieldDuration: 0.8,
            shields: [{ fighterId: "enemy", forward: { x: -1, y: 0 } }]
        }
    },
    0
);
const activeShieldArc = shieldContext.commands.find(
    (command) => Array.isArray(command) && command[0] === "arc" && command[3] === enemy.radius + 20
);
const expiringShieldArc = expiringShieldContext.commands.find(
    (command) => Array.isArray(command) && command[0] === "arc" && command[3] === enemy.radius + 20
);
assert.equal(expiringShieldArc[5] - expiringShieldArc[4] < activeShieldArc[5] - activeShieldArc[4], true);
const readyContext = new Context();
renderer.renderScreen(readyContext, simulation, idle);
assert.equal(
    readyContext.commands.some(
        (command) => Array.isArray(command) && command[0] === "text" && command[1] === "드래그 준비"
    ),
    true
);
const hudContext = new Context();
renderer.renderScreen(hudContext, simulation, {
    ...idle,
    playerShot: { ...idle.playerShot, active: true, flightRemaining: 1.4 }
});
const hudLabels = hudContext.commands
    .filter((command) => Array.isArray(command) && command[0] === "text")
    .map((command) => command[1]);
assert.equal(hudLabels.includes("드래그 돌진 중"), true);
assert.equal(hudLabels.includes("돌진 종료 후 다시 조준"), true);
const queuedHudContext = new Context();
renderer.renderScreen(queuedHudContext, simulation, {
    ...idle,
    drag: { ...idle.drag, queued: true },
    playerShot: { ...idle.playerShot, active: true, flightRemaining: 1.4 }
});
assert.equal(
    queuedHudContext.commands.some(
        (command) => Array.isArray(command) && command[0] === "text" && command[1] === "입력 예약 · 종료 즉시 조준"
    ),
    true
);
assert.equal(
    hudContext.commands
        .filter((command) => Array.isArray(command) && command[0] === "text")
        .every((command) => command[3] <= canvas.height - 10),
    true
);
const legendContext = new Context();
renderer.renderScreen(legendContext, simulation, aim);
assert.deepEqual(
    legendContext.commands
        .filter((command) => Array.isArray(command) && command[0] === "text")
        .map((command) => command[1])
        .filter((text) => ["반사 보상", "1", "2", "3"].includes(text)),
    ["반사 보상", "1", "2", "3"]
);
assert.equal(aimContext.commands.includes("close"), false, "windup rail does not cover the arena with a solid cone");
assert.equal(aimContext.commands.includes("dash"), true);
assert.equal(
    aimContext.commands.some(
        (command) => Array.isArray(command) && command[0] === "strokeStyle" && command[1] === "#ff5548"
    ),
    true
);
assert.equal(
    aimContext.commands.some(
        (command) =>
            Array.isArray(command) &&
            command[0] === "arc" &&
            command[1] === enemy.position.x &&
            command[2] === enemy.position.y &&
            command[3] > enemy.radius
    ),
    true,
    "enemy windup should use the same converging charge circle as the player"
);
assert.equal(
    aimContext.commands.some(
        (command) => Array.isArray(command) && command[0] === "text" && command[1] === "돌진 조준"
    ),
    true
);
assert.equal(
    aimContext.commands.some(
        (command) => Array.isArray(command) && command[0] === "line" && command[1] - enemy.radius >= 150
    ),
    true
);
const enemyFlightContext = new Context();
const enemyFlightCommands = renderer.renderWorld(enemyFlightContext, simulation, {
    ...idle,
    enemyQueue: {
        phase: "flight",
        attackerId: "enemy",
        windupDirection: { x: -1, y: 0 },
        elapsed: 0.2,
        windupDuration: 1,
        flightDuration: 1.8,
        endProgress: 0.1
    }
});
assert.equal(enemyFlightCommands, 1, "released enemy dash shows only its end convergence ring");
assert.equal(
    enemyFlightContext.commands.some(
        (command) =>
            Array.isArray(command) &&
            command[0] === "arc" &&
            command[1] === enemy.position.x &&
            command[2] === enemy.position.y &&
            command[3] > enemy.radius
    ),
    true
);
assert.equal(
    enemyFlightContext.commands.some((command) => Array.isArray(command) && command[0] === "line"),
    false,
    "dash-end feedback does not restore the removed trail or direction tip"
);
assert.equal(
    enemyFlightContext.commands.some((command) => Array.isArray(command) && command[0] === "text"),
    false,
    "dash-end feedback stays readable without a moving label"
);
const enemyLateFlightContext = new Context();
renderer.renderWorld(enemyLateFlightContext, simulation, {
    ...idle,
    enemyQueue: {
        phase: "flight",
        attackerId: "enemy",
        elapsed: 1.62,
        flightDuration: 1.8,
        endProgress: 0.9
    }
});
const enemyFlightArc = (context) =>
    context.commands.find(
        (command) =>
            Array.isArray(command) &&
            command[0] === "arc" &&
            command[1] === enemy.position.x &&
            command[2] === enemy.position.y
    );
assert.ok(enemyFlightArc(enemyFlightContext)[3] > enemyFlightArc(enemyLateFlightContext)[3]);
const countdownContext = new Context();
renderer.renderScreen(countdownContext, simulation, aim);
assert.equal(
    countdownContext.commands.some(
        (command) => Array.isArray(command) && command[0] === "text" && command[1] === "차징 33%"
    ),
    true
);
assert.equal(
    countdownContext.commands.some(
        (command) => Array.isArray(command) && command[0] === "text" && command[1] === "예상 속도 ×2.70"
    ),
    true
);
const acceleratedContext = new Context();
renderer.renderWorld(
    acceleratedContext,
    simulation,
    {
        ...idle,
        enemyQueue: {
            phase: "windup",
            attackerId: "enemy",
            windupDirection: { x: -1, y: 0 },
            elapsed: 0.6,
            windupDuration: 0.82,
            displayProgress: 0.7,
            accelerating: true
        }
    },
    0.016
);
assert.equal(
    acceleratedContext.commands.some(
        (command) => Array.isArray(command) && command[0] === "strokeStyle" && command[1] === "#ffd166"
    ),
    true
);
assert.equal(
    acceleratedContext.commands.some(
        (command) => Array.isArray(command) && command[0] === "text" && command[1] === "돌진 가속"
    ),
    true
);
const lockContext = new Context();
renderer.renderScreen(lockContext, simulation, {
    ...idle,
    drag: { ...idle.drag, inputLockRemaining: 0.2 }
});
assert.equal(
    lockContext.commands.some(
        (command) => Array.isArray(command) && command[0] === "text" && command[1] === "반격 경직"
    ),
    true
);
assert.equal(
    aimContext.commands.some((command) => Array.isArray(command) && command[1] === "2 반사"),
    true
);
const expiredContext = new Context();
renderer.renderWorld(expiredContext, simulation, aim, 0.5);
assert.equal(
    expiredContext.commands.some((command) => Array.isArray(command) && command[1] === "2 반사"),
    false
);
const newSimulation = { ...simulation, fighters: [...simulation.fighters] };
const resetSequenceContext = new Context();
renderer.renderWorld(resetSequenceContext, newSimulation, aim, 0);
assert.equal(
    resetSequenceContext.commands.some((command) => Array.isArray(command) && command[1] === "2 반사"),
    true
);
const rearPlayer = { ...player, position: { x: 100, y: 100 } };
const rearEnemy = { ...enemy, position: { x: 40, y: 100 } };
const rearSimulation = { ...simulation, width: 150, playerBall: rearPlayer, fighters: [rearPlayer, rearEnemy] };
const rearContext = new Context();
renderer.renderWorld(
    rearContext,
    rearSimulation,
    {
        ...aim,
        playerShot: { shields: [{ fighterId: "enemy", forward: { x: -1, y: 0 } }] },
        lastEvent: null
    },
    0
);
assert.equal(
    rearContext.commands.some((command) => Array.isArray(command) && command[1] === "후면 1 반사"),
    true
);
assert.equal(
    rearContext.commands.some(
        (command) =>
            Array.isArray(command) &&
            command[0] === "arc" &&
            command[1] === rearEnemy.position.x &&
            command[2] === rearEnemy.position.y &&
            command[3] === rearEnemy.radius + 9
    ),
    true
);
for (const [event, expectedLabel] of [
    [{ type: "enemy-windup", sequence: 1 }, null],
    [{ type: "enemy-launch", sequence: 1 }, null],
    [{ type: "rear-hit", bounceCount: 2, sequence: 1 }, "후면 2 반사"],
    [{ type: "plain-hit", sequence: 1 }, "직선 충돌"]
]) {
    const eventRenderer = new DragCombatRenderer(canvas);
    const eventContext = new Context();
    eventRenderer.renderWorld(eventContext, simulation, { ...aim, lastEvent: event }, 0);
    const labels = eventContext.commands.filter((command) => Array.isArray(command) && command[0] === "text");
    assert.equal(
        labels.some((command) => command[1] === "1 반사"),
        false
    );
    assert.equal(
        expectedLabel
            ? labels.some((command) => command[1] === expectedLabel)
            : labels.every((command) => !/^\d 반사$/.test(command[1])),
        true
    );
}
assert.equal(renderer.renderWorld(new Context(), simulation, { ...idle, lastEvent: null }), 0);
for (let index = 0; index < 10000; index += 1) {
    const context = new Context();
    renderer.renderWorld(context, simulation, aim, 0.016);
    assert.equal(
        context.commands.every(
            (command) =>
                !Array.isArray(command) ||
                command.slice(1).every((value) => typeof value !== "number" || Number.isFinite(value))
        ),
        true
    );
}
console.log("[drag-combat-renderer] ok");
