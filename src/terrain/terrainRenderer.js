import { TERRAIN_SHAPES, TERRAIN_TYPES } from "./terrainConfig.js";
import { getWorldPolygonPoints } from "../physics/CollisionShape.js";

const FOREST_TERRAIN_VISUALS = Object.freeze({
    rootFill: "#76512f",
    rootBorder: "#4e3724",
    rootMoss: "#668d45",
    mushroomFill: "#d96f52",
    mushroomBorder: "#5b382b",
    mushroomSpot: "#ffe4ad",
    leafColors: Object.freeze(["#557d3d", "#7f963f", "#b07b35"]),
    leafCount: 5,
    sporeCount: 7
});

function tracePolygon(ctx, points, offsetX = 0, offsetY = 0) {
    ctx.beginPath();
    ctx.moveTo(points[0].x + offsetX, points[0].y + offsetY);
    for (const point of points.slice(1)) ctx.lineTo(point.x + offsetX, point.y + offsetY);
    ctx.closePath();
}

function drawCircleTerrain(ctx, terrain) {
    if (!Number.isFinite(terrain.x) || !Number.isFinite(terrain.y) || !Number.isFinite(terrain.radius)) return;

    ctx.save();
    try {
        ctx.beginPath();
        ctx.arc(terrain.x + 3, terrain.y + 3, terrain.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(terrain.x, terrain.y, terrain.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#6b615b";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(terrain.x, terrain.y, terrain.radius, 0, Math.PI * 2);
        ctx.strokeStyle = "#4a423d";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(terrain.x, terrain.y, terrain.radius * 0.55, Math.PI * 0.2, Math.PI * 1.4);
        ctx.strokeStyle = "#5a524b";
        ctx.lineWidth = 1.2;
        ctx.stroke();
    } finally {
        ctx.restore();
    }
}

function drawPolygonTerrain(ctx, terrain) {
    const worldPoints = getWorldPolygonPoints(terrain);
    if (worldPoints.length < 3) return;

    ctx.save();
    try {
        // 그림자
        ctx.beginPath();
        ctx.moveTo(worldPoints[0].x + 3, worldPoints[0].y + 3);
        for (const p of worldPoints) {
            ctx.lineTo(p.x + 3, p.y + 3);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fill();

        // 암벽 본체
        ctx.beginPath();
        ctx.moveTo(worldPoints[0].x, worldPoints[0].y);
        for (const p of worldPoints) {
            ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fillStyle = "#6b615b";
        ctx.fill();

        // 외곽선
        ctx.beginPath();
        ctx.moveTo(worldPoints[0].x, worldPoints[0].y);
        for (const p of worldPoints) {
            ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.strokeStyle = "#4a423d";
        ctx.lineWidth = 2.5;
        ctx.stroke();
    } finally {
        ctx.restore();
    }
}

function drawRootTerrain(ctx, terrain, elapsed) {
    const worldPoints = getWorldPolygonPoints(terrain);
    if (worldPoints.length < 3) return;
    const visuals = FOREST_TERRAIN_VISUALS;
    ctx.save();
    try {
        tracePolygon(ctx, worldPoints, 4, 5);
        ctx.fillStyle = "rgba(38, 49, 27, 0.2)";
        ctx.fill();
        tracePolygon(ctx, worldPoints);
        ctx.fillStyle = visuals.rootFill;
        ctx.fill();
        ctx.strokeStyle = visuals.rootBorder;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(worldPoints[0].x, worldPoints[0].y);
        ctx.lineTo(worldPoints[2].x, worldPoints[2].y);
        ctx.strokeStyle = visuals.rootMoss;
        ctx.lineWidth = 5;
        ctx.stroke();
        for (const index of Array.from({ length: visuals.leafCount }, (_, value) => value)) {
            const phase = terrain.visualSeed * 0.013 + index * 1.73;
            const orbit = 0.65 + (index % 3) * 0.22;
            const x = terrain.x + Math.cos(phase) * 80 * orbit + Math.sin(elapsed * 0.8 + phase) * 3;
            const y = terrain.y + Math.sin(phase) * 55 * orbit;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(phase + Math.sin(elapsed + phase) * 0.12);
            ctx.beginPath();
            ctx.ellipse(0, 0, 7, 3.2, 0, 0, Math.PI * 2);
            ctx.fillStyle = visuals.leafColors[index % visuals.leafColors.length];
            ctx.fill();
            ctx.restore();
        }
    } finally {
        ctx.restore();
    }
}

function drawBounceMushroomTerrain(ctx, terrain, elapsed) {
    const worldPoints = getWorldPolygonPoints(terrain);
    if (worldPoints.length < 3) return;
    const visuals = FOREST_TERRAIN_VISUALS;
    ctx.save();
    try {
        tracePolygon(ctx, worldPoints, 4, 5);
        ctx.fillStyle = "rgba(38, 49, 27, 0.2)";
        ctx.fill();
        tracePolygon(ctx, worldPoints);
        ctx.fillStyle = visuals.mushroomFill;
        ctx.fill();
        ctx.strokeStyle = visuals.mushroomBorder;
        ctx.lineWidth = 3;
        ctx.stroke();
        for (const index of [0, 1, 2]) {
            const angle = terrain.angle + index * ((Math.PI * 2) / 3);
            ctx.beginPath();
            ctx.arc(terrain.x + Math.cos(angle) * 18, terrain.y + Math.sin(angle) * 18, 5, 0, Math.PI * 2);
            ctx.fillStyle = visuals.mushroomSpot;
            ctx.fill();
        }
        for (const index of Array.from({ length: visuals.sporeCount }, (_, value) => value)) {
            const phase = terrain.visualSeed * 0.009 + index * 1.17;
            const progress = (elapsed * 0.42 + index / visuals.sporeCount) % 1;
            const radius = 32 + progress * 38;
            ctx.globalAlpha = 0.72 * (1 - progress);
            ctx.beginPath();
            ctx.arc(
                terrain.x + Math.cos(phase + elapsed * 0.25) * radius,
                terrain.y + Math.sin(phase) * radius - progress * 12,
                2.5 + (index % 2),
                0,
                Math.PI * 2
            );
            ctx.fillStyle = visuals.mushroomSpot;
            ctx.fill();
        }
    } finally {
        ctx.restore();
    }
}

function drawTournamentAngledBounceRamp(ctx, terrain) {
    const worldPoints = getWorldPolygonPoints(terrain);
    if (worldPoints.length < 3) return;

    ctx.save();
    try {
        ctx.beginPath();
        ctx.moveTo(worldPoints[0].x, worldPoints[0].y);
        for (const point of worldPoints) {
            ctx.lineTo(point.x, point.y);
        }
        ctx.closePath();
        ctx.fillStyle = "#e6ae35";
        ctx.fill();
        ctx.strokeStyle = "#2f2922";
        ctx.lineWidth = 2.5;
        ctx.stroke();
    } finally {
        ctx.restore();
    }
}

export function drawTerrain(ctx, terrainList, elapsed = 0) {
    if (!terrainList || terrainList.length === 0) return;

    for (const terrain of terrainList) {
        if (!terrain || !terrain.blocking) continue;
        if (terrain.shape === TERRAIN_SHAPES.CIRCLE) {
            drawCircleTerrain(ctx, terrain);
        } else if (terrain.shape === TERRAIN_SHAPES.POLYGON) {
            if (terrain.temporaryKind === "tournament-angled-ramp") {
                drawTournamentAngledBounceRamp(ctx, terrain);
            } else if (terrain.type === TERRAIN_TYPES.ROOT) {
                drawRootTerrain(ctx, terrain, elapsed);
            } else if (terrain.type === TERRAIN_TYPES.BOUNCE_MUSHROOM) {
                drawBounceMushroomTerrain(ctx, terrain, elapsed);
            } else {
                drawPolygonTerrain(ctx, terrain);
            }
        }
    }
}
