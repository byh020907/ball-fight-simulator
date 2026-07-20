export const TERRAIN_SHAPES = Object.freeze({
    CIRCLE: "circle",
    POLYGON: "polygon"
});

export const TERRAIN_TYPES = Object.freeze({
    ROCK: "rock",
    ROOT: "root",
    BOUNCE_MUSHROOM: "bounce_mushroom"
});

export const TERRAIN_INTERACTIONS = Object.freeze({
    CENTER_BOUNCE: "center_bounce"
});

export const TERRAIN_DEFAULTS = Object.freeze({
    MIN_RADIUS: 38,
    MAX_RADIUS: 64,
    COLLISION_COLOR: "#5a5250",
    BORDER_COLOR: "#3d3836"
});

export const FOREST_TERRAIN_DEFAULTS = Object.freeze({
    BASE_WIDTH: 1280,
    BASE_HEIGHT: 1280,
    BASE_ROOT_COUNT: 3,
    BASE_MUSHROOM_COUNT: 1,
    MAX_AREA_MULTIPLIER: 2,
    ROOT_LENGTH: Object.freeze({ min: 150, max: 220 }),
    ROOT_WIDTH: Object.freeze({ min: 34, max: 52 }),
    MUSHROOM_RADIUS: Object.freeze({ min: 38, max: 48 }),
    NORMALIZED_MARGIN: 0.14,
    NORMALIZED_MIN_DISTANCE: 0.16,
    NORMALIZED_SPAWN_CLEARANCE: 0.14,
    ANCHOR_ATTEMPTS_PER_ITEM: 240,
    CENTER_BOUNCE_MIN_SPEED: 520,
    CENTER_BOUNCE_SPEED_MULTIPLIER: 1.15,
    CENTER_BOUNCE_CLEARANCE: 2
});
