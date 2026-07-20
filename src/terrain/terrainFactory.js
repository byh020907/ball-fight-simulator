import { HUNTING_MOB_COMPOSITION, HUNTING_STAGE_IDS, HUNTING_STAGES } from "../hunting/huntingConfig.js";
import {
    FOREST_TERRAIN_DEFAULTS,
    TERRAIN_DEFAULTS,
    TERRAIN_INTERACTIONS,
    TERRAIN_SHAPES,
    TERRAIN_TYPES
} from "./terrainConfig.js";

const TERRAIN_TYPE_VALUES = new Set(Object.values(TERRAIN_TYPES));
const FOREST_PROTECTED_SPAWN_ANCHORS = Object.freeze([
    Object.freeze({ x: 0.28, y: 0.5 }),
    ...Array.from(
        { length: HUNTING_MOB_COMPOSITION.MAX_COUNT - HUNTING_MOB_COMPOSITION.MIN_COUNT + 1 },
        (_, countOffset) => HUNTING_MOB_COMPOSITION.MIN_COUNT + countOffset
    ).flatMap((enemyCount) =>
        Array.from({ length: enemyCount }, (_, index) => {
            const ratio = enemyCount === 1 ? 0.5 : index / (enemyCount - 1);
            const angle = -Math.PI * 0.64 + Math.PI * 1.28 * ratio;
            return Object.freeze({
                x: 0.68 + Math.cos(angle) * 0.12,
                y: 0.5 + Math.sin(angle) * 0.31
            });
        })
    )
]);

function sanitizeTerrain(obstacle) {
    if (!obstacle || typeof obstacle !== "object") return null;
    const x = Number.isFinite(obstacle.x) ? obstacle.x : 0;
    const y = Number.isFinite(obstacle.y) ? obstacle.y : 0;
    const shape = obstacle.shape === TERRAIN_SHAPES.CIRCLE ? TERRAIN_SHAPES.CIRCLE : TERRAIN_SHAPES.POLYGON;

    const base = {
        id: obstacle.id ?? `terrain-${x}-${y}`,
        type: TERRAIN_TYPE_VALUES.has(obstacle.type) ? obstacle.type : TERRAIN_TYPES.ROCK,
        shape,
        x,
        y,
        blocking: true,
        theme: obstacle.theme ?? null,
        angle: Number.isFinite(obstacle.angle) ? obstacle.angle : 0,
        visualSeed: Number.isFinite(obstacle.visualSeed) ? obstacle.visualSeed : 0,
        interaction: obstacle.interaction ?? null
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

function createRootPoints(length, width) {
    return [
        { x: -length * 0.5, y: -width * 0.28 },
        { x: -length * 0.36, y: -width * 0.5 },
        { x: length * 0.5, y: -width * 0.2 },
        { x: length * 0.5, y: width * 0.2 },
        { x: -length * 0.36, y: width * 0.5 },
        { x: -length * 0.5, y: width * 0.28 }
    ];
}

function createMushroomPoints(radius) {
    return Array.from({ length: 8 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 8;
        const widthScale = index % 2 === 0 ? 1 : 0.9;
        return { x: Math.cos(angle) * radius * widthScale, y: Math.sin(angle) * radius * widthScale };
    });
}

function isProtectedForestAnchor(anchor) {
    return FOREST_PROTECTED_SPAWN_ANCHORS.some(
        (spawn) => distance(anchor.x, anchor.y, spawn.x, spawn.y) < FOREST_TERRAIN_DEFAULTS.NORMALIZED_SPAWN_CLEARANCE
    );
}

function createForestAnchors(rng, count) {
    const config = FOREST_TERRAIN_DEFAULTS;
    const anchors = [];
    const span = 1 - config.NORMALIZED_MARGIN * 2;
    for (let attempt = 0; attempt < count * config.ANCHOR_ATTEMPTS_PER_ITEM && anchors.length < count; attempt += 1) {
        const candidate = {
            x: config.NORMALIZED_MARGIN + rng() * span,
            y: config.NORMALIZED_MARGIN + rng() * span
        };
        if (isProtectedForestAnchor(candidate)) continue;
        if (
            anchors.some(
                (anchor) => distance(candidate.x, candidate.y, anchor.x, anchor.y) < config.NORMALIZED_MIN_DISTANCE
            )
        ) {
            continue;
        }
        anchors.push(candidate);
    }
    return anchors;
}

function createForestPattern(floor) {
    const config = FOREST_TERRAIN_DEFAULTS;
    const maximumRootCount = Math.round(config.BASE_ROOT_COUNT * config.MAX_AREA_MULTIPLIER);
    const maximumMushroomCount = Math.round(config.BASE_MUSHROOM_COUNT * config.MAX_AREA_MULTIPLIER);
    const rng = pseudoRandom(deterministicSeed(HUNTING_STAGE_IDS.FOREST, floor, 0, 0));
    const anchors = createForestAnchors(rng, maximumRootCount + maximumMushroomCount);
    const roots = Array.from({ length: maximumRootCount }, (_, index) => {
        const length = config.ROOT_LENGTH.min + rng() * (config.ROOT_LENGTH.max - config.ROOT_LENGTH.min);
        const width = config.ROOT_WIDTH.min + rng() * (config.ROOT_WIDTH.max - config.ROOT_WIDTH.min);
        return {
            id: `forest-root-${index}`,
            anchor: anchors[index],
            points: createRootPoints(length, width),
            angle: rng() * Math.PI * 2,
            visualSeed: Math.floor(rng() * 100000)
        };
    });
    const mushrooms = Array.from({ length: maximumMushroomCount }, (_, index) => {
        const radius = config.MUSHROOM_RADIUS.min + rng() * (config.MUSHROOM_RADIUS.max - config.MUSHROOM_RADIUS.min);
        return {
            id: `forest-mushroom-${index}`,
            anchor: anchors[maximumRootCount + index],
            points: createMushroomPoints(radius),
            angle: rng() * Math.PI * 2,
            visualSeed: Math.floor(rng() * 100000)
        };
    });
    return { roots, mushrooms };
}

function createForestTerrain({ floor = 1, width = 1280, height = 1280 }) {
    const config = FOREST_TERRAIN_DEFAULTS;
    const baseArea = config.BASE_WIDTH * config.BASE_HEIGHT;
    const areaMultiplier = Math.min(config.MAX_AREA_MULTIPLIER, Math.max(1, (width * height) / baseArea));
    const rootCount = Math.round(config.BASE_ROOT_COUNT * areaMultiplier);
    const mushroomCount = Math.round(config.BASE_MUSHROOM_COUNT * areaMultiplier);
    const pattern = createForestPattern(floor);
    const toTerrain = (descriptor, type, interaction = null) => ({
        id: descriptor.id,
        type,
        shape: TERRAIN_SHAPES.POLYGON,
        x: descriptor.anchor.x * width,
        y: descriptor.anchor.y * height,
        points: descriptor.points,
        angle: descriptor.angle,
        blocking: true,
        theme: HUNTING_STAGE_IDS.FOREST,
        visualSeed: descriptor.visualSeed,
        interaction
    });
    const roots = pattern.roots.slice(0, rootCount).map((descriptor) => toTerrain(descriptor, TERRAIN_TYPES.ROOT));
    const mushrooms = pattern.mushrooms.slice(0, mushroomCount).map((descriptor) =>
        toTerrain(descriptor, TERRAIN_TYPES.BOUNCE_MUSHROOM, {
            type: TERRAIN_INTERACTIONS.CENTER_BOUNCE,
            centerX: width / 2,
            centerY: height / 2
        })
    );
    return [...roots, ...mushrooms].map(sanitizeTerrain).filter(Boolean);
}

export function createHuntingTerrain({ stageId, floor = 1, width = 960, height = 960 } = {}) {
    if (!stageId) return [];
    const stage = HUNTING_STAGES.find((s) => s.id === stageId);
    if (!stage) return [];

    if (stageId === HUNTING_STAGE_IDS.CAVE) {
        return createCaveTerrain({ floor, width, height });
    }

    if (stageId === HUNTING_STAGE_IDS.FOREST) {
        return createForestTerrain({ floor, width, height });
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
