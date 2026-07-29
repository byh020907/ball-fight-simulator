import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Vector2 as CoreVector2 } from "../src/core.js";
import { Vector2 as PhysicsVector2 } from "../src/physics/index.js";
import {
    createElectricArcPath,
    drawProjectileSlashVisual,
    getVisibleLineWidth,
    ScreenWakeLock,
    shuffled,
    StaticCanvasImageCache,
    Vector2
} from "../src/game-kit/index.js";

const gameKitDirectory = new URL("../src/game-kit/", import.meta.url);

function collectJavaScriptFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
        if (entry.isDirectory()) return collectJavaScriptFiles(child);
        return entry.name.endsWith(".js") ? [child] : [];
    });
}

assert.equal(Vector2, CoreVector2);
assert.equal(Vector2, PhysicsVector2);
assert.deepEqual(
    shuffled([1, 2, 3, 4], () => 0),
    [2, 3, 4, 1]
);

const released = [];
const cache = new StaticCanvasImageCache({ pixelBudget: 4 });
cache.set("first", { close: () => released.push("first") }, 2, 2);
cache.set("second", { close: () => released.push("second") }, 2, 2);
assert.deepEqual(released, ["first"]);

const visibilityContext = {
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1 }),
    canvas: {
        width: 100,
        height: 100,
        getBoundingClientRect: () => ({ width: 100, height: 100 })
    }
};
assert.equal(getVisibleLineWidth(visibilityContext, "standard", 1), 2);

const from = new Vector2(0, 0);
const to = new Vector2(200, 40);
const arc = createElectricArcPath(from, to, { time: 0.25 });
assert.deepEqual(arc[0], from);
assert.deepEqual(arc.at(-1), to);
assert.ok(arc.length > 4);
assert.equal(typeof drawProjectileSlashVisual, "function");
assert.equal(typeof ScreenWakeLock, "function");

const gameKitPath = fileURLToPath(gameKitDirectory);
for (const file of collectJavaScriptFiles(gameKitDirectory)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)) {
        const specifier = match[1];
        if (!specifier.startsWith(".")) continue;
        const dependency = new URL(specifier, file);
        assert.ok(fileURLToPath(dependency).startsWith(gameKitPath), `${specifier} escapes the game-kit boundary`);
        assert.equal(existsSync(dependency), true, `${specifier} must resolve inside game-kit`);
    }
}

console.log("[game-kit] ok");
