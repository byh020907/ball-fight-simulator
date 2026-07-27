import { reflectDirection } from "./vectorMath.js";

const validPoint = (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y);
export function predictTrajectory({ origin, direction, maxBounces = 3, maxDistance, castRay }) {
    const segments = [];
    const bounces = [];
    let current = validPoint(origin) ? { ...origin } : { x: 0, y: 0 };
    let remaining = Math.max(0, Number.isFinite(maxDistance) ? maxDistance : 0);
    let heading = validPoint(direction) ? { ...direction } : { x: 1, y: 0 };
    const size = Math.hypot(heading.x, heading.y);
    if (!size || !remaining || typeof castRay !== "function") return { segments, bounces, terminal: null };
    heading = { x: heading.x / size, y: heading.y / size };
    let terminal = null;
    while (remaining > 0 && segments.length < maxBounces + 1) {
        const hit = castRay({ origin: { ...current }, direction: { ...heading }, remainingDistance: remaining });
        if (
            !hit ||
            !validPoint(hit.point) ||
            !Number.isFinite(hit.distance) ||
            hit.distance <= 0 ||
            hit.distance > remaining
        ) {
            const end = { x: current.x + heading.x * remaining, y: current.y + heading.y * remaining };
            segments.push({ origin: current, end });
            break;
        }
        segments.push({ origin: current, end: { ...hit.point }, collision: { ...hit } });
        remaining -= hit.distance;
        if (
            hit.type === "fighter" ||
            hit.type !== "static" ||
            !validPoint(hit.normal) ||
            bounces.length >= maxBounces
        ) {
            terminal = { ...hit };
            break;
        }
        const reflected = reflectDirection(heading, hit.normal);
        const reflectedSize = Math.hypot(reflected.x, reflected.y);
        if (!reflectedSize) {
            terminal = { ...hit };
            break;
        }
        heading = { x: reflected.x / reflectedSize, y: reflected.y / reflectedSize };
        const epsilon = 0.001;
        current = { x: hit.point.x + heading.x * epsilon, y: hit.point.y + heading.y * epsilon };
        remaining = Math.max(0, remaining - epsilon);
        bounces.push({ point: { ...hit.point }, surfaceKey: hit.surfaceKey });
    }
    return { segments, bounces, terminal };
}
