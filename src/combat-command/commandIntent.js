function copyPoint(point) {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y) ? { x: point.x, y: point.y } : null;
}

function copyPoints(points) {
    return Array.isArray(points) ? points.map(copyPoint).filter(Boolean) : [];
}

export function createCommandIntent({
    sequence,
    direction,
    chargeRatio,
    pathSegments = [],
    bouncePoints = [],
    predictedTerminal,
    createdAt
}) {
    return {
        sequence,
        direction: copyPoint(direction) ?? { x: 0, y: 0 },
        chargeRatio: Math.max(0, Math.min(1, Number(chargeRatio) || 0)),
        pathSegments: copyPoints(pathSegments),
        bouncePoints: copyPoints(bouncePoints),
        predictedTerminal: copyPoint(predictedTerminal),
        createdAt: Math.max(0, Number(createdAt) || 0)
    };
}

export function copyCommandIntent(intent) {
    if (!intent) return null;
    return {
        ...intent,
        direction: copyPoint(intent.direction) ?? { x: 0, y: 0 },
        pathSegments: copyPoints(intent.pathSegments),
        bouncePoints: copyPoints(intent.bouncePoints),
        predictedTerminal: copyPoint(intent.predictedTerminal)
    };
}
