import { Vector2 } from "../core.js";
import { pickRandomActions } from "../clickActions.js";

const AI_ACTION_COOLDOWN = 6;
const AI_ACTIVATION_CHANCE = 0.4;

export class AIActionController {
    constructor(rng = Math.random) {
        this.actions = pickRandomActions(3);
        this.cooldownRemaining = 2 + rng() * 2;
        this.lastActionId = null;
        this.usageCount = {};
        for (const a of this.actions) {
            this.usageCount[a.id] = 0;
        }
    }

    evaluate(sim, fighter, delta) {
        this.cooldownRemaining -= delta;
        if (this.cooldownRemaining > 0) return null;

        const opponent = sim.getOpponent(fighter);
        if (!opponent) return null;

        const hpRatio = fighter.hp / fighter.maxHp;
        const dist = Vector2.subtract(opponent.position, fighter.position).length();

        for (const action of this.actions) {
            if (!action.canAIUse(sim, fighter, opponent, hpRatio, dist)) continue;
            if (Math.random() > AI_ACTIVATION_CHANCE) continue;
            if (action.getFailureReason?.(sim, fighter)) continue;

            const cost = Math.ceil((fighter.maxHp * action.hpCostPercent) / 100);
            if (fighter.hp <= cost + 1) continue;

            const paidCost = fighter.actionContext.spendHpForAction(fighter, cost);
            if (paidCost <= 0) continue;

            this.cooldownRemaining = AI_ACTION_COOLDOWN + (Math.random() - 0.5) * 2;
            this.lastActionId = action.id;
            this.usageCount[action.id] = (this.usageCount[action.id] ?? 0) + 1;
            return { action, fighter, paidCost };
        }

        return null;
    }
}
