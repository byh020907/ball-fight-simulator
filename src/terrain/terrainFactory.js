import { HUNTING_STAGE_IDS, HUNTING_STAGES } from "../hunting/huntingConfig.js";
import { TERRAIN_SHAPES, TERRAIN_TYPES, TERRAIN_DEFAULTS } from "./terrainConfig.js";

function sanitizeTerrain(obstacle) {
    if (!obstacle || typeof obstacle !== "object") return null;
    const x = Number.isFinite(obstacle.x) ? obstacle.x : 0;
    const y = Number.isFinite(obstacle.y) ? obstacle.y : 0;
    const shape = obstacle.shape === TERRAIN_SHAPES.CIRCLE ? TERRAIN_SHAPES.CIRCLE : TERRAIN_SHAPES.POLYGON;

    const base = {
        id: obstacle.id ?? `terrain-${x}-${y}`,
        type: TERRAIN_TYPES.ROCK,
        shape,
        x,
        y,
        blocking: true,
        theme: obstacle.theme ?? null,
        angle: Number.isFinite(obstacle.angle) ? obstacle.angle : 0
    };

    if (shape === TERRAIN_SHAPES.POLYGON) {
        const points =
            Array.isArray(obstacle.points) && obstacle.points.length >= 3
                ? obstacle.points.filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
                : null;
        if (!points || points.length < 3) return null;
        return { ...base, points };
    }

    const radius = Number.isFinite(obstacle.radius) ? obstacle.radius : TERRAIN_DEFAULTS.MIN_RADIUS;
    return { ...base, radius };
}

function deterministicSeed(stageId, floor, width, height) {
    let hash = 0;
    const str = `${stageId}-${floor}-${width}-${height}`;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) & 0x7fffffff;
    }
    return hash;
}

function pseudoRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

function clampToArena(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function isTooCloseToSpawnEdge(x, y, width, height, buffer = 80) {
    return x < buffer || x > width - buffer || y < buffer || y > height - buffer;
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function boundingRadius(obstacle) {
    if (obstacle.shape === TERRAIN_SHAPES.CIRCLE) return obstacle.radius ?? 0;
    if (obstacle.shape === TERRAIN_SHAPES.POLYGON && Array.isArray(obstacle.points)) {
        let maxSq = 0;
        for (const p of obstacle.points) {
            const sq = p.x * p.x + p.y * p.y;
            if (sq > maxSq) maxSq = sq;
        }
        return Math.sqrt(maxSq);
    }
    return 0;
}

function createPolygonPoints(rng) {
    const vertexCount = 4 + Math.floor(rng() * 3);
    const baseRadius = 45 + rng() * 25;
    const points = [];
    for (let i = 0; i < vertexCount; i++) {
        const angle = (Math.PI * 2 * i) / vertexCount + (rng() - 0.5) * 0.4;
        const r = baseRadius * (0.75 + rng() * 0.25);
        points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return points;
}

export function createHuntingTerrain({ stageId, floor = 1, width = 960, height = 960 } = {}) {
    if (!stageId) return [];
    const stage = HUNTING_STAGES.find((s) => s.id === stageId);
    if (!stage) return [];

    if (stageId === HUNTING_STAGE_IDS.CAVE) {
        return createCaveTerrain({ floor, width, height });
    }

    return [];
}

function createCaveTerrain({ floor = 1, width = 960, height = 960 }) {
    const seed = deterministicSeed(HUNTING_STAGE_IDS.CAVE, floor, width, height);
    const rng = pseudoRandom(seed);

    const totalCount = 3 + (floor % 3);

    const obstacles = [];
    const buffer = 90;
    const minDist = 110;
    const attempts = totalCount * 10;

    function createPolygonObstacle(idx) {
        const points = createPolygonPoints(rng);
        const br = Math.max(...points.map((p) => Math.sqrt(p.x * p.x + p.y * p.y)));
        const x = clampToArena(buffer + rng() * (width - buffer * 2), buffer + br, width - buffer - br);
        const y = clampToArena(buffer + rng() * (height - buffer * 2), buffer + br, height - buffer - br);
        return {
            id: `cave-rock-${idx}`,
            type: TERRAIN_TYPES.ROCK,
            shape: TERRAIN_SHAPES.POLYGON,
            x,
            y,
            points,
            angle: rng() * Math.PI * 2,
            blocking: true,
            theme: HUNTING_STAGE_IDS.CAVE
        };
    }

    for (let attempt = 0; attempt < attempts && obstacles.length < totalCount; attempt++) {
        const candidate = createPolygonObstacle(obstacles.length);

        if (isTooCloseToSpawnEdge(candidate.x, candidate.y, width, height, buffer)) continue;

        const candidateRadius = boundingRadius(candidate);
        const tooClose = obstacles.some(
            (obs) => distance(candidate.x, candidate.y, obs.x, obs.y) < minDist + candidateRadius + boundingRadius(obs)
        );
        if (tooClose) continue;

        obstacles.push(candidate);
    }

    return obstacles.map(sanitizeTerrain).filter(Boolean);
}
