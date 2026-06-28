import { Vector2 } from "../core.js";
import { pickRandomActions } from "../clickActions.js";

const AI_MIN_HP_RATIO = 0.3;
const AI_MIN_HP_AFTER_COST = 0.3;
const AI_MAX_ACTION_DISTANCE = 400;
const AI_MIN_INTERVAL = 1.0; // 연속 사용 방지용 최소 간격 (쿨다운 아님, 타이밍 대응 가능)

export class AIActionController {
    constructor(rng = Math.random) {
        this.actions = pickRandomActions(3);
        this._nextAvailableAt = 2 + rng() * 2; // 초기 지연 (쿨다운 아님)
        this._chosenAction = null;
        this.usageCount = {};
        for (const a of this.actions) {
            this.usageCount[a.id] = 0;
        }
    }

    /** 액션 선택 (생성 시 1회 호출, 이후 고정). 3장 중 가중치 기반 랜덤 선택. */
    selectAction(sim, fighter) {
        const isRanged = fighter.meta?.isRanged ?? false;

        const weighted = this.actions.map((a) => {
            let w = 1;
            // 캐릭터 유형 가중치
            if (isRanged) {
                if (a.id === "projectile_guard") w += 2;
                if (a.id === "time_warp") w += 2;
            } else {
                if (a.id === "rush") w += 2;
                if (a.id === "counter") w += 1;
                if (a.id === "shockwave") w += 1;
            }
            // 저코스트 선호
            w += Math.max(0, 1.5 - a.hpCostPercent * 2);
            return { action: a, weight: Math.max(1, w) };
        });

        const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const { action, weight } of weighted) {
            roll -= weight;
            if (roll <= 0) {
                this._chosenAction = action;
                break;
            }
        }
        if (!this._chosenAction) {
            this._chosenAction = weighted[weighted.length - 1].action;
        }

        if (fighter) {
            fighter.clickActionName = this._chosenAction.name;
        }
    }

    evaluate(sim, fighter, delta) {
        // 최소 간격 타이머 (연속 사용 방지, 쿨다운 아님)
        if (this._nextAvailableAt > 0) {
            this._nextAvailableAt -= delta;
            return null;
        }

        const action = this._chosenAction;
        if (!action) return null;
        if (action.getFailureReason?.(sim, fighter)) return null;

        const cost = Math.ceil((fighter.maxHp * action.hpCostPercent) / 100);

        // HP 안전: 체력 80% 이상일 때만 사용
        const hpRatio = fighter.hp / fighter.maxHp;
        if (hpRatio < AI_MIN_HP_RATIO) return null;

        // HP 코스트 후에도 30% 이상 남아야 함
        const hpAfterCost = (fighter.hp - cost) / fighter.maxHp;
        if (hpAfterCost < AI_MIN_HP_AFTER_COST) return null;

        // 거리 제한: 상대가 400px 이내일 때만 사용 (원거리 낭비 방지)
        const opponent = sim.getOpponent(fighter);
        if (!opponent) return null;
        const dist = Vector2.subtract(opponent.position, fighter.position).length();
        if (dist > AI_MAX_ACTION_DISTANCE) return null;

        const paidCost = fighter.actionContext.spendHpForAction(fighter, cost);
        if (paidCost <= 0) return null;

        this._nextAvailableAt = AI_MIN_INTERVAL;
        this.usageCount[action.id] = (this.usageCount[action.id] ?? 0) + 1;
        return { action, fighter, paidCost };
    }
}
