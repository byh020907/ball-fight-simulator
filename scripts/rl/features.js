// scripts/rl/features.js — 사람 관측 기준 16차원
// "isSlowed?" ❌ → "지금 속도가 얼마지?" ✅
import { Vector2 } from "../../src/core.js";

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

export function extractFeatures(fighter, opponent, sim) {
    const hpRatio = fighter.hp / fighter.maxHp;
    const oppHpRatio = opponent.hp / opponent.maxHp;
    const maxHp = Math.max(fighter.maxHp, opponent.maxHp);
    const hpAdvantage = maxHp > 0 ? (fighter.hp - opponent.hp) / maxHp : 0;

    const toOpp = Vector2.subtract(opponent.position, fighter.position);
    const dist = toOpp.length();
    const approachSpeed = dist > 0 ? opponent.velocity.dot(toOpp.normalize().scale(-1)) : 0;

    const mySpeed = fighter.velocity.length();
    const oppSpeed = opponent.velocity.length();
    const speedRatio = oppSpeed > 0 ? mySpeed / oppSpeed : 999;

    const closingSpeed = approachSpeed;
    // 충돌까지 예상 시간 (원시값, "임박" 판단은 RL 몫)
    const estCollisionTime = approachSpeed > 10 ? dist / approachSpeed : 999;
    // 가장 가까운 투사체 거리 (원시값, "근접" 판단은 RL 몫)
    let nearestProjectileDist = 999;
    for (const e of sim.entities) {
        if (e === fighter || e === opponent || e.isExpired || !e.velocity) continue;
        if (e.owner === fighter) continue; // 내 투사체는 나를 해치지 않음
        const d = Vector2.subtract(fighter.position, e.position).length();
        if (d < nearestProjectileDist) nearestProjectileDist = d;
    }
    const elapsed = sim.elapsed ?? 0;

    return [
        hpRatio, // 0  내 HP 바
        oppHpRatio, // 1  상대 HP 바
        hpAdvantage, // 2  HP 우위
        dist, // 3  거리
        clamp(dist / 960, 0, 1), // 4  거리(정규화)
        approachSpeed, // 5  접근 속도
        clamp(approachSpeed / 400, -1, 1), // 6  접근속도(정규화)
        mySpeed, // 7  내 속도
        clamp(mySpeed / 500, 0, 1), // 8  내 속도(정규화)
        oppSpeed, // 9  상대 속도
        clamp(oppSpeed / 500, 0, 1), // 10 상대 속도(정규화)
        clamp(speedRatio / 3, 0, 1), // 11 속도비
        clamp(closingSpeed / 400, -1, 1), // 12 거리변화율
        clamp(estCollisionTime / 5, 0, 1), // 13 충돌 예상시간 (0=곧, 1=5초↑)
        clamp(nearestProjectileDist / 960, 0, 1), // 14 최근접 투사체 거리
        clamp(elapsed / 30, 0, 1) // 15 경과 시간
    ];
}

export const FEATURE_DIM = 16;
