import assert from "node:assert/strict";
import { BattleApp } from "../src/app.js";

class FakeCanvas {
    constructor() {
        this.listeners = new Map();
        this.captures = new Set();
    }

    addEventListener(type, handler) {
        this.listeners.set(type, handler);
    }

    removeEventListener(type, handler) {
        if (this.listeners.get(type) === handler) this.listeners.delete(type);
    }

    getBoundingClientRect() {
        return { left: 10, top: 20, width: 300, height: 200 };
    }

    setPointerCapture(pointerId) {
        this.captures.add(pointerId);
    }

    hasPointerCapture(pointerId) {
        return this.captures.has(pointerId);
    }

    releasePointerCapture(pointerId) {
        this.captures.delete(pointerId);
    }

    emit(type, event) {
        this.listeners.get(type)?.(event);
    }
}

function pointer(pointerId, overrides = {}) {
    return {
        pointerId,
        isPrimary: true,
        pointerType: "mouse",
        button: 0,
        clientX: 110,
        clientY: 220,
        prevented: false,
        preventDefault() {
            this.prevented = true;
        },
        ...overrides
    };
}

function createApp(beginResult = {}) {
    const calls = [];
    const canvas = new FakeCanvas();
    const app = Object.create(BattleApp.prototype);
    app.elements = { canvas };
    app._activeDragPointerId = null;
    app._overlay = { visible: false, transient: false };
    app._cycleBattleSpeed = () => calls.push(["speed"]);
    app.simulation = {
        finished: false,
        playerBall: { id: "player" },
        beginDragCombat(pointerId, point) {
            calls.push(["begin", pointerId, point]);
            return beginResult;
        },
        moveDragCombat(pointerId, point) {
            calls.push(["move", pointerId, point]);
        },
        releaseDragCombat(pointerId) {
            calls.push(["release", pointerId]);
        },
        cancelDragCombat(pointerId) {
            calls.push(["cancel", pointerId]);
        }
    };
    return { app, canvas, calls };
}

{
    const { app, canvas, calls } = createApp();
    app._bindDragPointerHandler();
    const down = pointer(7);
    canvas.emit("pointerdown", down);
    canvas.emit("pointermove", pointer(7, { clientX: 130, clientY: 260 }));
    canvas.emit("pointerup", pointer(7));
    assert.deepEqual(calls, [
        ["begin", 7, { x: 100, y: 200 }],
        ["move", 7, { x: 120, y: 240 }],
        ["release", 7]
    ]);
    assert.equal(down.prevented, true);
    assert.equal(canvas.captures.size, 0);
}

{
    const { app, canvas, calls } = createApp();
    app._overlay.visible = true;
    app._bindDragPointerHandler();
    const down = pointer(9);
    canvas.emit("pointerdown", down);
    assert.deepEqual(calls, []);
    assert.equal(down.prevented, false);
    assert.equal(canvas.captures.size, 0);
}

{
    const { app, canvas, calls } = createApp(null);
    app._bindDragPointerHandler();
    const blocked = pointer(3);
    canvas.emit("pointerdown", blocked);
    canvas.emit("pointerdown", pointer(4, { isPrimary: false }));
    canvas.emit("pointerdown", pointer(5, { button: 2 }));
    assert.deepEqual(calls, [["begin", 3, { x: 100, y: 200 }]]);
    assert.equal(blocked.prevented, false);
    assert.equal(canvas.captures.size, 0);
}

{
    const { app, canvas, calls } = createApp();
    app._bindDragPointerHandler();
    canvas.emit("pointerdown", pointer(11, { pointerType: "touch" }));
    canvas.emit("pointerdown", pointer(12, { pointerType: "touch", isPrimary: false }));
    canvas.emit("pointercancel", pointer(11, { pointerType: "touch" }));
    canvas.emit("pointerdown", pointer(13, { pointerType: "pen" }));
    canvas.emit("lostpointercapture", pointer(13, { pointerType: "pen" }));
    assert.deepEqual(
        calls.map(([type, id]) => [type, id]),
        [
            ["begin", 11],
            ["cancel", 11],
            ["begin", 13],
            ["cancel", 13]
        ]
    );
}

{
    const { app, canvas, calls } = createApp();
    for (let index = 0; index < 1000; index += 1) {
        app._bindDragPointerHandler();
        app._unbindDragPointerHandler();
    }
    assert.equal(canvas.listeners.size, 0);
    assert.equal(app._activeDragPointerId, null);
    assert.equal(calls.length, 0);
}

console.log("[drag-app-input] ok");
