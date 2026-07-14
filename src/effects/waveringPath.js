import { Vector2 } from "../core.js";

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function createWaveringPath(
    from,
    to,
    {
        time = 0,
        amplitude = null,
        segmentLength = 28,
        minSegments = 4,
        maxSegments = 14,
        minAmplitude = 8,
        maxAmplitude = 26,
        amplitudeRatio = 0.085,
        offsetAt = () => 0
    } = {}
) {
    const direction = Vector2.subtract(to, from);
    const distance = direction.length();
    if (distance <= 0.001) return [new Vector2(from.x, from.y), new Vector2(to.x, to.y)];

    const segmentCount = clamp(Math.ceil(distance / segmentLength), minSegments, maxSegments);
    const perpendicular = new Vector2(-direction.y / distance, direction.x / distance);
    const resolvedAmplitude = Number.isFinite(amplitude)
        ? amplitude
        : clamp(distance * amplitudeRatio, minAmplitude, maxAmplitude);
    const intermediatePoints = Array.from({ length: segmentCount - 1 }, (_, offset) => {
        const index = offset + 1;
        const progress = index / segmentCount;
        const envelope = Math.sin(progress * Math.PI);
        const offsetDistance = offsetAt({ time, index, progress }) * resolvedAmplitude * envelope;
        return new Vector2(
            from.x + direction.x * progress + perpendicular.x * offsetDistance,
            from.y + direction.y * progress + perpendicular.y * offsetDistance
        );
    });

    return [new Vector2(from.x, from.y), ...intermediatePoints, new Vector2(to.x, to.y)];
}
