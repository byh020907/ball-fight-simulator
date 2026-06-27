import { Vector2 } from "../core.js";
import { pickRandomActions } from "../clickActions.js";

const AI_ACTION_COOLDOWN = 15;
/** HP가 이 비율 미만이면 액션 사용하지 않음 (사람도 빈사 상태에선 HP 소모를 꺼림) */
const AI_MIN_HP_RATIO = 0.5;
/** 액션 사용 후 최소 잔여 HP 비율 */
const AI_MIN_HP_AFTER_COST = 0.2;

export class AIActionController {
    constructor(rng = Math.random) {
        this.actions = pickRandomActions(3);
        this.cooldownRemaining = 2 + rng() * 2;
        this._chosenAction = null;
        this.usageCount = {};
        for (const a of this.actions) {
            this.usageCount[a.id] = 0;
        }
    }

    evaluate(sim, fighter, delta) {
        this.cooldownRemaining -= delta;
        if (this.cooldownRemaining > 0) return null;

        // 첫 평가 시 하나의 액션을 선택하여 고정 (사람처럼)
        if (!this._chosenAction) {
            this._chosenAction = this._pickAction(sim, fighter);
            if (!this._chosenAction) {
                this.cooldownRemaining = 2;
                return null;
            }
        }

        const action = this._chosenAction;
        if (action.getFailureReason?.(sim, fighter)) return null;

        const cost = Math.ceil((fighter.maxHp * action.hpCostPercent) / 100);

        // HP 안전: 체력 너무 낮으면 사용 안 함
        const hpRatio = fighter.hp / fighter.maxHp;
        if (hpRatio < AI_MIN_HP_RATIO) return null;

        // HP 코스트 후에도 일정량 남아야 함
        const hpAfterCost = (fighter.hp - cost) / fighter.maxHp;
        if (hpAfterCost < AI_MIN_HP_AFTER_COST) return null;

        const paidCost = fighter.actionContext.spendHpForAction(fighter, cost);
        if (paidCost <= 0) return null;

        this.cooldownRemaining = AI_ACTION_COOLDOWN + (Math.random() - 0.5) * 2;
        this.usageCount[action.id] = (this.usageCount[action.id] ?? 0) + 1;
        return { action, fighter, paidCost };
    }

    _pickAction(sim, fighter) {
        const opponent = sim.getOpponent(fighter);
        if (!opponent) return null;

        const hpRatio = fighter.hp / fighter.maxHp;
        const dist = Vector2.subtract(opponent.position, fighter.position).length();

        // HP 낮으면 생존형 액션(흡혈, 회피) 우선
        const viable = this.actions.filter((a) => {
            if (!a.canAIUse(sim, fighter, opponent, hpRatio, dist)) return false;
            if (a.getFailureReason?.(sim, fighter)) return false;
            const cost = Math.ceil((fighter.maxHp * a.hpCostPercent) / 100);
            if (fighter.hp - cost < fighter.maxHp * AI_MIN_HP_AFTER_COST) return false;
            return true;
        });

        if (viable.length === 0) return null;

        // HP 낮을 땐 흡혈 > 회피 > 저코스트 순으로 가중치
        const scored = viable.map((a) => {
            let score = 0;
            if (hpRatio < 0.5 && a.id === "life_steal") score += 3;
            if (hpRatio < 0.5 && a.id === "evade") score += 2;
            score += 1 - a.hpCostPercent; // 저코스트 선호
            return { action: a, score };
        });
        scored.sort((a, b) => b.score - a.score);

        const picked = scored[0].action;
        if (fighter) fighter.clickActionName = picked.name;
        return picked;
    }
}
