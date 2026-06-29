// scripts/rl/features.js — 속도 벡터 기반, 전 차원 [-1,1] 정규화 완료
import { Vector2 } from "../../src/core.js";
import { createRoster } from "../../src/roster.js";

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const MAX_SPEED = 1000;
const ALL_CHAR_IDS = createRoster().map(f => f.id);

export function extractFeatures(fighter, opponent, sim) {
    const hpRatio = fighter.hp / fighter.maxHp;
    const oppHpRatio = opponent.hp / opponent.maxHp;

    const toOpp = Vector2.subtract(opponent.position, fighter.position);

    let nearestDist = 999;
    let projectileToMeX = 0;
    let projectileToMeY = 0;
    let projectileVx = 0;
    let projectileVy = 0;
    let projectileCount = 0;
    for (const e of sim.entities) {
        if (e === fighter || e === opponent || e.isExpired || !e.velocity) continue;
        if (e.owner === fighter) continue;
        projectileCount++;
        const toMe = Vector2.subtract(e.position, fighter.position);
        const d = toMe.length();
        if (d < nearestDist) {
            nearestDist = d;
            projectileToMeX = toMe.x;
            projectileToMeY = toMe.y;
            projectileVx = e.velocity.x;
            projectileVy = e.velocity.y;
        }
    }

    const arenaW = sim.width ?? 960;
    const arenaH = sim.height ?? 960;

    // 캐릭터 정체성: 인덱스로 직접 전달 (NN이 ReLU로 카테고리컬 매핑 학습)
    const myCharIdx = ALL_CHAR_IDS.indexOf(fighter.id) / (ALL_CHAR_IDS.length - 1);
    const oppCharIdx = ALL_CHAR_IDS.indexOf(opponent.id) / (ALL_CHAR_IDS.length - 1);

    return [
        hpRatio,                                        // 0  [0,1]
        oppHpRatio,                                     // 1  [0,1]
        clamp(toOpp.x / arenaW, -1, 1),                 // 2  [-1,1] 상대 방향 X
        clamp(toOpp.y / arenaH, -1, 1),                 // 3  [-1,1] 상대 방향 Y
        clamp(fighter.velocity.x / MAX_SPEED, -1, 1),   // 4  [-1,1]
        clamp(fighter.velocity.y / MAX_SPEED, -1, 1),   // 5  [-1,1]
        clamp(opponent.velocity.x / MAX_SPEED, -1, 1),  // 6  [-1,1]
        clamp(opponent.velocity.y / MAX_SPEED, -1, 1),  // 7  [-1,1]
        clamp(projectileToMeX / arenaW, -1, 1),         // 8  [-1,1]
        clamp(projectileToMeY / arenaH, -1, 1),         // 9  [-1,1]
        clamp(projectileVx / MAX_SPEED, -1, 1),         // 10 [-1,1]
        clamp(projectileVy / MAX_SPEED, -1, 1),         // 11 [-1,1]
        clamp(projectileCount / 10, 0, 1),              // 12 [0,1]
        clamp((sim.elapsed ?? 0) / (sim.overtimeStartsAt ?? 26), 0, 1), // 13 [0,1]
        clamp(myCharIdx, 0, 1),                         // 14 [0,1] 내 캐릭터
        clamp(oppCharIdx, 0, 1),                        // 15 [0,1] 상대 캐릭터
    ];
}

export const FEATURE_DIM = 16;
