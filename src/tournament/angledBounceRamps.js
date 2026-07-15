import { polygonBoundingRadius } from "../physics/CollisionShape.js";
import { TERRAIN_SHAPES, TERRAIN_TYPES } from "../terrain/terrainConfig.js";

const EPSILON = 0.0001;
const RAMP_KIND = "tournament-angled-ramp";

export const TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS = Object.freeze({
    incidenceThresholdDegrees: 25,
    leadTime: 0.25,
    lifetime: 0.7,
    cooldown: 1.2,
    length: 120,
    thickness: 16,
    wallInset: 55,
    minimumSlopeDegrees: 25,
    maximumSlopeDegrees: 45
});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
}

function hashSeed(seed) {
    const text = String(seed ?? "tournament-angled-bounce-ramp");
    let hash = 2166136261;
    for (const char of text) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function createSeededRandom(seed) {
    let state = hashSeed(seed);
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function normalizeNumber(value, fallback, minimum = 0) {
    return Number.isFinite(value) ? Math.max(minimum, value) : fallback;
}

function createWallCandidate({ wall, time, impactPoint, normal }) {
    if (!Number.isFinite(time) || time < 0) return null;
    return { wall, time, impactPoint, normal };
}

function getTerrainBoundingRadius(terrain) {
    if (terrain.shape === TERRAIN_SHAPES.CIRCLE) return terrain.radius ?? 0;
    if (terrain.shape === TERRAIN_SHAPES.POLYGON) return polygonBoundingRadius(terrain.points);
    return 0;
}

function getDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function getRampBoundingRadius(policy) {
    return Math.hypot(policy.length / 2, policy.thickness / 2);
}

function getRampCenter(prediction, policy) {
    return {
        x: prediction.impactPoint.x + prediction.normal.x * policy.wallInset,
        y: prediction.impactPoint.y + prediction.normal.y * policy.wallInset
    };
}

function isActiveFighter(fighter) {
    return fighter && !fighter.flags?.defeated && !fighter.state?.swallowed;
}

function isClearOfCorner(simulation, prediction, fighter, policy) {
    const cornerMargin = policy.length / 2 + fighter.radius;
    const coordinate =
        prediction.wall === "left" || prediction.wall === "right" ? prediction.impactPoint.y : prediction.impactPoint.x;
    const edgeLength = prediction.wall === "left" || prediction.wall === "right" ? simulation.height : simulation.width;
    return coordinate >= cornerMargin && coordinate <= edgeLength - cornerMargin;
}

function hasClearRampPlacement(simulation, candidate, policy) {
    const center = getRampCenter(candidate.prediction, policy);
    const rampRadius = getRampBoundingRadius(policy);
    const fighterOverlap = simulation.fighters.some(
        (fighter) =>
            isActiveFighter(fighter) &&
            getDistance(center, fighter.position) < rampRadius + Math.max(0, fighter.radius ?? 0)
    );
    if (fighterOverlap) return false;

    return !simulation.terrain.some((terrain) => {
        if (!terrain?.blocking || !Number.isFinite(terrain.x) || !Number.isFinite(terrain.y)) return false;
        return getDistance(center, terrain) < rampRadius + getTerrainBoundingRadius(terrain);
    });
}

function createRampTerrain(prediction, policy, random, serial) {
    const center = getRampCenter(prediction, policy);
    const slopeDegrees =
        policy.minimumSlopeDegrees + random() * (policy.maximumSlopeDegrees - policy.minimumSlopeDegrees);
    const slopeSign = random() < 0.5 ? -1 : 1;
    const angle = Math.atan2(prediction.normal.y, prediction.normal.x) + slopeSign * degreesToRadians(slopeDegrees);
    const halfLength = policy.length / 2;
    const halfThickness = policy.thickness / 2;

    return {
        id: `tournament-angled-ramp-${serial}`,
        type: TERRAIN_TYPES.ROCK,
        shape: TERRAIN_SHAPES.POLYGON,
        x: center.x,
        y: center.y,
        angle,
        points: [
            { x: -halfLength, y: -halfThickness },
            { x: halfLength, y: -halfThickness },
            { x: halfLength, y: halfThickness },
            { x: -halfLength, y: halfThickness }
        ],
        blocking: true,
        physicsMaterial: "wood",
        temporaryKind: RAMP_KIND
    };
}

export function createTournamentAngledBounceRampPolicy(options = {}) {
    if (options !== true && options?.enabled !== true) return null;

    const source = options === true ? {} : options;
    const minimumSlopeDegrees = normalizeNumber(
        source.minimumSlopeDegrees,
        TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.minimumSlopeDegrees
    );
    const maximumSlopeDegrees = Math.max(
        minimumSlopeDegrees,
        normalizeNumber(source.maximumSlopeDegrees, TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.maximumSlopeDegrees)
    );

    return {
        enabled: true,
        incidenceThresholdDegrees: normalizeNumber(
            source.incidenceThresholdDegrees,
            TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.incidenceThresholdDegrees
        ),
        leadTime: normalizeNumber(source.leadTime, TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.leadTime),
        lifetime: normalizeNumber(source.lifetime, TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.lifetime),
        cooldown: normalizeNumber(source.cooldown, TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.cooldown),
        length: normalizeNumber(source.length, TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.length, 1),
        thickness: normalizeNumber(source.thickness, TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.thickness, 1),
        wallInset: normalizeNumber(source.wallInset, TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.wallInset),
        minimumSlopeDegrees,
        maximumSlopeDegrees,
        seed: source.seed
    };
}

export function predictNextWallCollision(simulation, fighter) {
    if (!simulation || !fighter || !fighter.position || !fighter.velocity) return null;

    const { position, velocity } = fighter;
    const radius = Math.max(0, fighter.radius ?? 0);
    const speed = Math.hypot(velocity.x, velocity.y);
    if (!Number.isFinite(speed) || speed <= EPSILON) return null;

    const candidates = [
        velocity.x > EPSILON
            ? createWallCandidate({
                  wall: "right",
                  time: (simulation.width - radius - position.x) / velocity.x,
                  impactPoint: {
                      x: simulation.width,
                      y: position.y + velocity.y * ((simulation.width - radius - position.x) / velocity.x)
                  },
                  normal: { x: -1, y: 0 }
              })
            : null,
        velocity.x < -EPSILON
            ? createWallCandidate({
                  wall: "left",
                  time: (radius - position.x) / velocity.x,
                  impactPoint: {
                      x: 0,
                      y: position.y + velocity.y * ((radius - position.x) / velocity.x)
                  },
                  normal: { x: 1, y: 0 }
              })
            : null,
        velocity.y > EPSILON
            ? createWallCandidate({
                  wall: "bottom",
                  time: (simulation.height - radius - position.y) / velocity.y,
                  impactPoint: {
                      x: position.x + velocity.x * ((simulation.height - radius - position.y) / velocity.y),
                      y: simulation.height
                  },
                  normal: { x: 0, y: -1 }
              })
            : null,
        velocity.y < -EPSILON
            ? createWallCandidate({
                  wall: "top",
                  time: (radius - position.y) / velocity.y,
                  impactPoint: {
                      x: position.x + velocity.x * ((radius - position.y) / velocity.y),
                      y: 0
                  },
                  normal: { x: 0, y: 1 }
              })
            : null
    ]
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);
    const next = candidates[0] ?? null;
    if (!next) return null;

    const normalApproach = -(velocity.x / speed) * next.normal.x - (velocity.y / speed) * next.normal.y;
    const incidenceDegrees = (Math.acos(clamp(normalApproach, -1, 1)) * 180) / Math.PI;

    return { ...next, speed, incidenceDegrees };
}

export class TournamentAngledBounceRampSystem {
    constructor(simulation, policy) {
        this.simulation = simulation;
        this.policy = policy;
        this.activeRamp = null;
        this.events = [];
        this._serial = 0;
        this._cooldownByFighterId = new Map();
        this._random = createSeededRandom(policy.seed);
    }

    update(delta) {
        this._updateCooldowns(delta);
        this._expireRamp(delta);
        if (this.activeRamp) return;

        const candidate = this._findEligibleCandidate();
        if (candidate) this._createRamp(candidate);
    }

    _updateCooldowns(delta) {
        for (const [fighterId, remaining] of this._cooldownByFighterId) {
            const nextRemaining = remaining - delta;
            if (nextRemaining <= 0) {
                this._cooldownByFighterId.delete(fighterId);
            } else {
                this._cooldownByFighterId.set(fighterId, nextRemaining);
            }
        }
    }

    _expireRamp(delta) {
        if (!this.activeRamp) return;
        this.activeRamp.remaining -= delta;
        if (this.activeRamp.remaining <= 0) this._removeActiveRamp("expired");
    }

    _findEligibleCandidate() {
        const candidates = this.simulation.fighters
            .filter(isActiveFighter)
            .map((fighter) => ({ fighter, prediction: predictNextWallCollision(this.simulation, fighter) }))
            .filter(({ fighter, prediction }) => this._isEligiblePrediction(fighter, prediction))
            .sort((a, b) => a.prediction.time - b.prediction.time || a.fighter.id.localeCompare(b.fighter.id));

        return candidates.find((candidate) => hasClearRampPlacement(this.simulation, candidate, this.policy)) ?? null;
    }

    _isEligiblePrediction(fighter, prediction) {
        if (!prediction || prediction.time > this.policy.leadTime) return false;
        if (prediction.incidenceDegrees > this.policy.incidenceThresholdDegrees) return false;
        if (!isClearOfCorner(this.simulation, prediction, fighter, this.policy)) return false;
        return (this._cooldownByFighterId.get(fighter.id) ?? 0) <= 0;
    }

    _createRamp(candidate) {
        const terrain = createRampTerrain(candidate.prediction, this.policy, this._random, this._serial);
        this._serial += 1;
        terrain.onTerrainCollision = (fighter) => this._removeActiveRamp("collision", fighter);
        this.simulation.terrain.push(terrain);
        this.activeRamp = {
            terrain,
            ownerId: candidate.fighter.id,
            prediction: candidate.prediction,
            remaining: this.policy.lifetime
        };
        this._cooldownByFighterId.set(candidate.fighter.id, this.policy.cooldown);
        this.events.push({ type: "created", fighterId: candidate.fighter.id, wall: candidate.prediction.wall });
    }

    _removeActiveRamp(reason, fighter = null) {
        const activeRamp = this.activeRamp;
        if (!activeRamp) return;

        const terrainIndex = this.simulation.terrain.indexOf(activeRamp.terrain);
        if (terrainIndex >= 0) this.simulation.terrain.splice(terrainIndex, 1);
        this.events.push({
            type: reason,
            fighterId: fighter?.id ?? activeRamp.ownerId,
            wall: activeRamp.prediction.wall
        });
        this.activeRamp = null;
    }
}
