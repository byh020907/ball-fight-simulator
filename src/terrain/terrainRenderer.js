import { TERRAIN_SHAPES } from "./terrainConfig.js";
import { getWorldPolygonPoints } from "../physics/CollisionShape.js";

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

export function drawTerrain(ctx, terrainList) {
    if (!terrainList || terrainList.length === 0) return;

    for (const terrain of terrainList) {
        if (!terrain || !terrain.blocking) continue;
        if (terrain.shape === TERRAIN_SHAPES.CIRCLE) {
            drawCircleTerrain(ctx, terrain);
        } else if (terrain.shape === TERRAIN_SHAPES.POLYGON) {
            drawPolygonTerrain(ctx, terrain);
        }
    }
}
