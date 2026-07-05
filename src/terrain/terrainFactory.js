import { HUNTING_STAGE_IDS, HUNTING_STAGES } from "../hunting/huntingConfig.js";
import { TERRAIN_SHAPES, TERRAIN_TYPES, TERRAIN_DEFAULTS } from "./terrainConfig.js";

function sanitizeTerrain(obstacle) {
    if (!obstacle || typeof obstacle !== "object") return null;
    const radius = Number.isFinite(obstacle.radius) ? obstacle.radius : TERRAIN_DEFAULTS.MIN_RADIUS;
    const x = Number.isFinite(obstacle.x) ? obstacle.x : 0;
    const y = Number.isFinite(obstacle.y) ? obstacle.y : 0;
    return {
        id: obstacle.id ?? `terrain-${x}-${y}`,
        type: TERRAIN_TYPES.ROCK,
        shape: TERRAIN_SHAPES.CIRCLE,
        x,
        y,
        radius,
        blocking: true,
        theme: obstacle.theme ?? null
    };
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

/**
 * terrain을 피해야 할 spawn 영역 (arena 가장자리)
 */
function isTooCloseToSpawnEdge(x, y, width, height, buffer = 80) {
    if (x < buffer || x > width - buffer) return true;
    if (y < buffer || y > height - buffer) return true;
    return false;
}

/**
 * 두 점 사이 거리 계산
 */
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

/**
 * 특정 stage/floor에 대한 지형 장애물 목록 생성.
 * forest/desert는 1차 구현에서 terrain 없음.
 */
export function createHuntingTerrain({ stageId, floor = 1, width = 960, height = 960 } = {}) {
    if (!stageId) return [];
    const stage = HUNTING_STAGES.find((s) => s.id === stageId);
    if (!stage) return [];

    if (stageId === HUNTING_STAGE_IDS.CAVE) {
        return createCaveTerrain({ floor, width, height });
    }

    // forest/desert: terrain 확장 가능하도록 빈 배열 반환
    return [];
}

function createCaveTerrain({ floor = 1, width = 960, height = 960 }) {
    const seed = deterministicSeed(HUNTING_STAGE_IDS.CAVE, floor, width, height);
    const rng = pseudoRandom(seed);

    const count = 3 + (floor % 3); // 3~5개
    const obstacles = [];
    const buffer = 90; // spawn 영역 피하기
    const minDist = 110; // 장애물 간 최소 거리
    const attempts = count * 8;

    for (let attempt = 0; attempt < attempts && obstacles.length < count; attempt++) {
        const radius =
            TERRAIN_DEFAULTS.MIN_RADIUS + rng() * (TERRAIN_DEFAULTS.MAX_RADIUS - TERRAIN_DEFAULTS.MIN_RADIUS);
        const x = clampToArena(buffer + rng() * (width - buffer * 2), buffer + radius, width - buffer - radius);
        const y = clampToArena(buffer + rng() * (height - buffer * 2), buffer + radius, height - buffer - radius);

        // spawn 영역 가장자리 피하기
        if (isTooCloseToSpawnEdge(x, y, width, height, buffer)) continue;

        // 기존 장애물과 충분한 거리 확인
        const tooClose = obstacles.some((obs) => distance(x, y, obs.x, obs.y) < minDist + radius + obs.radius);
        if (tooClose) continue;

        obstacles.push({
            id: `cave-rock-${obstacles.length}`,
            type: TERRAIN_TYPES.ROCK,
            shape: TERRAIN_SHAPES.CIRCLE,
            x,
            y,
            radius,
            blocking: true,
            theme: HUNTING_STAGE_IDS.CAVE
        });
    }

    return obstacles.map(sanitizeTerrain);
}
