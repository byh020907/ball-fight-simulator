import { Vector2 } from "../core.js";
import { pickRandomActions } from "../clickActions.js";
import { mixins, Cooldown } from "../physics/index.js";

const AI_ACTION_COOLDOWN = 15;
const AI_MIN_HP_RATIO = 0.5;
const AI_MIN_HP_AFTER_COST = 0.2;

export class AIActionController extends mixins([Cooldown]) {
    constructor(rng = Math.random) {
        super();
        this.actions = pickRandomActions(3);
        this._cooldownDuration = AI_ACTION_COOLDOWN;
        this._cooldownRemaining = 2 + rng() * 2;
        this._chosenAction = null;
        this.usageCount = {};
        for (const a of this.actions) {
            this.usageCount[a.id] = 0;
        }
    }

    /** 즉시 액션 선택 (겜 시작 시점에 UI 표시용) */
    selectAction(sim, fighter) {
        if (this._chosenAction) return;
        this._chosenAction = this._pickAction(sim, fighter);
        if (this._chosenAction && fighter) {
            fighter.clickActionName = this._chosenAction.name;
        }
    }

    evaluate(sim, fighter, delta) {
        this.tickCooldown(delta);
        if (!this.cooldownReady) return null;

        // 첫 평가 시 하나의 액션을 선택하여 고정 (사람처럼)
        if (!this._chosenAction) {
            this._chosenAction = this._pickAction(sim, fighter);
            if (!this._chosenAction) {
                this._cooldownRemaining = 2;
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

        this._cooldownRemaining = AI_ACTION_COOLDOWN + (Math.random() - 0.5) * 2;
        this.usageCount[action.id] = (this.usageCount[action.id] ?? 0) + 1;
        return { action, fighter, paidCost };
    }

    _pickAction(sim, fighter) {
        const opponent = sim.getOpponent(fighter);
        if (!opponent) return null;

        const isRanged = fighter.meta?.isRanged ?? false;
        const hpRatio = fighter.hp / fighter.maxHp;
        const dist = Vector2.subtract(opponent.position, fighter.position).length();

        // 후보 필터링
        const viable = this.actions.filter((a) => {
            if (!a.canAIUse(sim, fighter, opponent, hpRatio, dist)) return false;
            if (a.getFailureReason?.(sim, fighter)) return false;
            const cost = Math.ceil((fighter.maxHp * a.hpCostPercent) / 100);
            if (fighter.hp - cost < fighter.maxHp * AI_MIN_HP_AFTER_COST) return false;
            return true;
        });

        if (viable.length === 0) return null;

        // 가중치 계산 (캐릭터 유형 + HP 상황 + 코스트)
        const weighted = viable.map((a) => {
            let w = 1;
            // 원거리: 투사체방어/시간왜곡 선호, 돌진 안 함
            if (isRanged) {
                if (a.id === "projectile_guard") w += 2;
                if (a.id === "time_warp") w += 1;
                if (a.id === "rush") w = 0;
            } else {
                // 근접: 돌진/카운터/충격파 선호
                if (a.id === "rush") w += 2;
                if (a.id === "counter") w += 1;
                if (a.id === "shockwave") w += 1;
            }
            // HP 상황
            if (hpRatio < 0.5 && a.id === "life_steal") w += 2;
            if (hpRatio < 0.5 && a.id === "evade") w += 1;
            // 저코스트 선호
            w += Math.max(0, 1 - a.hpCostPercent);
            return { action: a, weight: Math.max(1, w) };
        });

        // 가중치 기반 랜덤 선택
        const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const { action, weight } of weighted) {
            roll -= weight;
            if (roll <= 0) return action;
        }
        return weighted[weighted.length - 1].action;
    }
}
