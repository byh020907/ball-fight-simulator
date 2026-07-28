import { DRAG_COMBAT_CONFIG, getDragLaunchSpeed } from "./config.js";
import { getRicochetDamageMultiplier, isShieldFront } from "./vectorMath.js";

const EPSILON = 0.001;
const finite = (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y);
const copy = (point) => ({ x: point.x, y: point.y });
const length = (point) => Math.hypot(point.x, point.y);
const normalize = (point) => {
    const size = length(point);
    return size > EPSILON ? { x: point.x / size, y: point.y / size } : null;
};
const dot = (a, b) => a.x * b.x + a.y * b.y;
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

function terrainKey(terrain) {
    if (terrain?.id != null) return `terrain:${terrain.id}`;
    const points = Array.isArray(terrain?.points)
        ? terrain.points.map((point) => `${point.x}:${point.y}`).join("|")
        : "";
    return `terrain:${terrain?.shape}:${terrain?.x}:${terrain?.y}:${terrain?.radius ?? ""}:${points}`;
}

function rayCircle(origin, direction, limit, center, radius, base = {}) {
    const offset = subtract(origin, center);
    const projected = dot(offset, direction);
    const discriminant = projected * projected - (dot(offset, offset) - radius * radius);
    if (discriminant < 0) return null;
    const root = Math.sqrt(discriminant);
    const distance = [-projected - root, -projected + root].find((value) => value > EPSILON && value <= limit);
    if (!Number.isFinite(distance)) return null;
    const point = { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance };
    return {
        ...base,
        distance,
        point,
        normal: normalize(subtract(point, center)) ?? { x: -direction.x, y: -direction.y }
    };
}

function raySegmentCapsule(origin, direction, limit, a, b, radius, base) {
    const edge = subtract(b, a);
    const edgeLength = length(edge);
    const candidates = [
        rayCircle(origin, direction, limit, a, radius, base),
        rayCircle(origin, direction, limit, b, radius, base)
    ];
    if (edgeLength > EPSILON) {
        const tangent = { x: edge.x / edgeLength, y: edge.y / edgeLength };
        const normal = { x: -tangent.y, y: tangent.x };
        const relative = subtract(origin, a);
        const denominator = dot(direction, normal);
        for (const side of [-radius, radius]) {
            if (Math.abs(denominator) <= EPSILON) continue;
            const distance = (side - dot(relative, normal)) / denominator;
            if (distance <= EPSILON || distance > limit) continue;
            const point = { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance };
            const projection = dot(subtract(point, a), tangent);
            if (projection >= 0 && projection <= edgeLength) {
                candidates.push({
                    ...base,
                    distance,
                    point,
                    normal: { x: normal.x * Math.sign(side), y: normal.y * Math.sign(side) }
                });
            }
        }
    }
    return candidates.filter(Boolean).sort((left, right) => left.distance - right.distance)[0] ?? null;
}

function polygonPoints(terrain) {
    const angle = terrain.angle ?? 0;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return (terrain.points ?? []).map((point) => ({
        x: terrain.x + point.x * cosine - point.y * sine,
        y: terrain.y + point.x * sine + point.y * cosine
    }));
}

function castStatic(origin, direction, limit, simulation, radius) {
    const hits = [];
    const width = simulation?.width;
    const height = simulation?.height;
    if (Number.isFinite(width) && Number.isFinite(height) && width > radius * 2 && height > radius * 2) {
        const walls = [
            ["wall:left", radius, "x", { x: 1, y: 0 }],
            ["wall:right", width - radius, "x", { x: -1, y: 0 }],
            ["wall:top", radius, "y", { x: 0, y: 1 }],
            ["wall:bottom", height - radius, "y", { x: 0, y: -1 }]
        ];
        for (const [surfaceKey, value, axis, normal] of walls) {
            const component = direction[axis];
            const distance = component ? (value - origin[axis]) / component : Infinity;
            if (distance > EPSILON && distance <= limit) {
                const point = { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance };
                if (
                    point.x >= radius - EPSILON &&
                    point.x <= width - radius + EPSILON &&
                    point.y >= radius - EPSILON &&
                    point.y <= height - radius + EPSILON
                )
                    hits.push({ type: "static", surfaceKey, distance, point, normal });
            }
        }
    }
    for (const terrain of simulation?.terrain ?? []) {
        if (!terrain?.blocking || !finite(terrain)) continue;
        const base = { type: "static", surfaceKey: terrainKey(terrain) };
        if (terrain.shape === "circle" && Number.isFinite(terrain.radius)) {
            hits.push(rayCircle(origin, direction, limit, terrain, Math.max(0, terrain.radius) + radius, base));
        } else if (terrain.shape === "polygon") {
            const points = polygonPoints(terrain);
            points.forEach((point, index) =>
                hits.push(
                    raySegmentCapsule(
                        origin,
                        direction,
                        limit,
                        point,
                        points[(index + 1) % points.length],
                        radius,
                        base
                    )
                )
            );
        }
    }
    return hits.filter(Boolean);
}

function validTarget(fighter, player, standby) {
    return (
        fighter &&
        fighter !== player &&
        !standby.includes(fighter) &&
        !fighter.flags?.defeated &&
        !fighter.flags?.destroyed &&
        !fighter.state?.swallowed &&
        fighter.participation?.canBeTargeted !== false &&
        finite(fighter.position) &&
        Number.isFinite(fighter.radius)
    );
}

function shieldResult(target, player, point, bounces, runtimeSnapshot) {
    const relation = player?.teamId === target?.teamId ? "ally" : "enemy";
    if (relation !== "enemy") return { relation, shieldResult: "plain" };
    const fixed = runtimeSnapshot?.playerShot?.shields?.find((shield) => shield.fighterId === target.id)?.forward;
    const forward = fixed ?? normalize(subtract(player.position, target.position));
    const front = isShieldFront(forward, normalize(subtract(point, target.position)) ?? { x: 0, y: 0 });
    return { relation, shieldResult: front ? "front-counter" : bounces > 0 ? "rear-hit" : "plain" };
}

export function createDragTrajectoryScene({ simulation, runtimeSnapshot } = {}) {
    const drag = runtimeSnapshot?.drag;
    const player = simulation?.playerBall;
    const vector = drag?.vector;
    if (drag?.state !== "aiming" || !vector?.active || !finite(vector?.vector) || !finite(player?.position))
        return {
            active: false,
            origin: null,
            launchVelocity: null,
            strength: 0,
            segments: [],
            bounces: [],
            terminal: null
        };
    const direction = normalize(vector.vector);
    const strength = Math.max(0, Math.min(1, vector.strength));
    if (!direction)
        return {
            active: false,
            origin: null,
            launchVelocity: null,
            strength: 0,
            segments: [],
            bounces: [],
            terminal: null
        };
    const shotConfig = runtimeSnapshot?.launch ?? DRAG_COMBAT_CONFIG.shot;
    const impulseSpeed = getDragLaunchSpeed(player.stats?.baseSpeed, strength, shotConfig);
    const currentVelocity = finite(player.velocity) ? player.velocity : { x: 0, y: 0 };
    const launchVelocity = {
        x: currentVelocity.x + direction.x * impulseSpeed,
        y: currentVelocity.y + direction.y * impulseSpeed
    };
    let heading = normalize(launchVelocity);
    if (!heading)
        return {
            active: true,
            origin: copy(player.position),
            launchVelocity,
            strength,
            segments: [],
            bounces: [],
            terminal: null
        };
    const radius = Math.max(0, player.radius ?? player.stats?.baseRadius ?? 0);
    let current = copy(player.position);
    const shotMaxSeconds = Number.isFinite(shotConfig.shotMaxSeconds)
        ? Math.max(0, shotConfig.shotMaxSeconds)
        : DRAG_COMBAT_CONFIG.shot.shotMaxSeconds;
    let remaining = Math.max(0, length(launchVelocity) * shotMaxSeconds);
    const segments = [];
    const bounces = [];
    let terminal = null;
    while (remaining > EPSILON && segments.length < 4) {
        const statics = castStatic(current, heading, remaining, simulation, radius);
        const fighters = (simulation?.fighters ?? [])
            .filter((fighter) => validTarget(fighter, player, simulation?.standbyFighters ?? []))
            .map((fighter) =>
                rayCircle(current, heading, remaining, fighter.position, radius + fighter.radius, {
                    type: "fighter",
                    fighter,
                    fighterId: fighter.id
                })
            );
        const hit = [...statics, ...fighters].filter(Boolean).sort((left, right) => left.distance - right.distance)[0];
        if (!hit) {
            segments.push({
                index: segments.length,
                rewardTier: Math.min(3, bounces.length),
                origin: copy(current),
                end: { x: current.x + heading.x * remaining, y: current.y + heading.y * remaining },
                collision: null
            });
            break;
        }
        const collision = {
            type: hit.type,
            point: copy(hit.point),
            normal: copy(hit.normal),
            surfaceKey: hit.surfaceKey ?? null,
            fighterId: hit.fighterId ?? null
        };
        segments.push({
            index: segments.length,
            rewardTier: Math.min(3, bounces.length),
            origin: copy(current),
            end: copy(hit.point),
            collision
        });
        if (hit.type === "fighter") {
            terminal = {
                ...collision,
                ...shieldResult(hit.fighter, player, hit.point, bounces.length, runtimeSnapshot)
            };
            break;
        }
        if (bounces.length >= 3) {
            terminal = collision;
            break;
        }
        bounces.push({ point: copy(hit.point), surfaceKey: hit.surfaceKey, tier: Math.min(3, bounces.length + 1) });
        const reflected = normalize({
            x: heading.x - 2 * dot(heading, hit.normal) * hit.normal.x,
            y: heading.y - 2 * dot(heading, hit.normal) * hit.normal.y
        });
        if (!reflected) {
            terminal = collision;
            break;
        }
        heading = reflected;
        current = { x: hit.point.x + heading.x * EPSILON, y: hit.point.y + heading.y * EPSILON };
        remaining -= hit.distance + EPSILON;
    }
    return { active: true, origin: copy(player.position), launchVelocity, strength, segments, bounces, terminal };
}
