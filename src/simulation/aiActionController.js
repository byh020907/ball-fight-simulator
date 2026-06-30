import { pickRandomActions } from "../clickActions.js";
import { RLPolicy } from "../ai/rlPolicy.js";

const AI_MIN_INTERVAL = 1.0; // 연속 사용 방지용 최소 간격
const RL_MODEL_BASE = "/models";  // 서버에서 모델 디렉토리 경로

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

    /**
     * 학습된 RL 모델을 로드하여 이 컨트롤러에 연결.
     * 모델이 없거나 로드 실패 시 조용히 넘어감 (액션 미사용).
     * @param {string} charId - 캐릭터 ID (예: "dash")
     */
    async loadRlPolicy(charId) {
        if (!this._chosenAction) {
            console.warn("[RL] loadRlPolicy: _chosenAction is null");
            return;
        }
        const url = `${RL_MODEL_BASE}/${this._chosenAction.id}/${charId}.json`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.warn(`[RL] 모델 없음 (${res.status}): ${url}`);
                return;
            }
            const modelJson = await res.json();
            this.rlPolicy = await RLPolicy.fromJson(modelJson);
            console.log(`[RL] 로드 OK: ${charId}×${this._chosenAction.id} win=${(modelJson.trainWinRate*100).toFixed(0)}%`);
        } catch (e) {
            console.warn(`[RL] 로드 실패: ${url}`, e.message);
        }
    }

    evaluate(sim, fighter, delta) {
        if (this._nextAvailableAt > 0) {
            this._nextAvailableAt -= delta;
            return null;
        }

        const action = this._chosenAction;
        if (!action) return null;

        if (action.getFailureReason?.(sim, fighter)) return null;

        const opponent = sim.getOpponent(fighter);
        if (!opponent) return null;

        if (!this.rlPolicy) {
            if (!this._loggedNoPolicy) {
                console.warn(`[RL] ${fighter.id}: rlPolicy 없음 (모델 로드 안 됨?)`);
                this._loggedNoPolicy = true;
            }
            return null;
        }

        const prob = this.rlPolicy.getProbability(fighter, opponent, sim);
        if (prob < 0.5) return null;

        const cost = Math.ceil((fighter.maxHp * action.hpCostPercent) / 100);
        const paidCost = fighter.actionContext.spendHpForAction(fighter, cost);
        if (paidCost <= 0) return null;

        // 첫 액션 발동 시 로그
        if (!this._loggedActivation) {
            console.log(`[RL] ${fighter.id} 첫 액션 발동: ${action.name} (prob=${prob.toFixed(3)})`);
            this._loggedActivation = true;
        }

        this._nextAvailableAt = AI_MIN_INTERVAL;
        this.usageCount[action.id] = (this.usageCount[action.id] ?? 0) + 1;
        return { action, fighter, paidCost };
    }
}
