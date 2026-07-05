import { TERRAIN_SHAPES } from "./terrainConfig.js";

/**
 * 지형 장애물 목록을 Canvas 2D로 렌더링.
 * camera.apply() 이후 world 좌표계에서 호출되어야 함.
 */
export function drawTerrain(ctx, terrainList) {
    if (!terrainList || terrainList.length === 0) return;

    for (const terrain of terrainList) {
        if (!terrain || !terrain.blocking) continue;
        if (terrain.shape !== TERRAIN_SHAPES.CIRCLE) continue;
        if (!Number.isFinite(terrain.x) || !Number.isFinite(terrain.y) || !Number.isFinite(terrain.radius)) continue;

        // 그림자
        ctx.beginPath();
        ctx.arc(terrain.x + 3, terrain.y + 3, terrain.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fill();

        // 암벽 본체
        ctx.beginPath();
        ctx.arc(terrain.x, terrain.y, terrain.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#6b615b";
        ctx.fill();

        // 외곽선
        ctx.beginPath();
        ctx.arc(terrain.x, terrain.y, terrain.radius, 0, Math.PI * 2);
        ctx.strokeStyle = "#4a423d";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 내부 크랙 장식
        ctx.beginPath();
        ctx.arc(terrain.x, terrain.y, terrain.radius * 0.55, Math.PI * 0.2, Math.PI * 1.4);
        ctx.strokeStyle = "#5a524b";
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }
}
