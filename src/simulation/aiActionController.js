import { pickRandomActions } from "../clickActions.js";
import { RLPolicy } from "../ai/rlPolicy.js";
import { Cooldown } from "../physics/index.js";

const AI_MIN_INTERVAL = 0.5; // 액션 사용 후 최소 대기 (훈련 기준 30프레임과 동일)
const AI_ACTION_THRESHOLD = 0.5; // 이 확률 이상이면 액션 사용 (모델이 전략적으로 학습되었으므로 0.5로 충분)
const AI_CONSECUTIVE_REQUIRED = 3; // 연속 몇 프레임 확신해야 실제 발동 (노이즈 필터)
const RL_MODEL_BASE = "/models"; // 서버에서 모델 디렉토리 경로

export class AIActionController extends Cooldown(class {}) {
    constructor(rng = Math.random) {
        super();
        this.actions = pickRandomActions(3);
        this.resetCooldown(2 + rng() * 2);
        this._chosenAction = null;
        this._consecutiveYes = 0; // 연속 "써" 카운터
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
        if (!this._chosenAction) return;
        const url = `${RL_MODEL_BASE}/${this._chosenAction.id}/${charId}.json`;
        try {
            const res = await fetch(url);
            if (!res.ok) return; // 모델 없음 → 폴백
            const modelJson = await res.json();
            this.rlPolicy = await RLPolicy.fromJson(modelJson);
            // 첫 추론 시 JIT 컴파일 렉 방지용 웜업
            this.rlPolicy.actor.predict(window.tf.tensor2d([new Array(16).fill(0)]));
            const w = modelJson.config?.weights ?? {};
            console.log(
                `[RL] ${charId}×${this._chosenAction.id}: hpW=${w.hp} survW=${w.survival} pen=${w.penalty} | trainWR=${(modelJson.trainWinRate * 100).toFixed(0)}%`
            );
        } catch {
            // 네트워크 오류 등 → 조용히 무시
        }
    }

    evaluate(sim, fighter, delta) {
        // 쿨다운 감소 (액션 사용 후 대기)
        this.tickCooldown(delta);

        const action = this._chosenAction;
        if (!action) return null;

        // 이미 발동 중이면 건너뜀
        if (action.getFailureReason?.(sim, fighter)) return null;

        const opponent = sim.getOpponent(fighter);
        if (!opponent) return null;

        if (!this.rlPolicy) return null;

        // 매 틱 모델 호출 — 타이밍 맞는 순간을 놓치지 않음
        const prob = this.rlPolicy.getProbability(fighter, opponent, sim);
        const canAct = this.cooldownReady;

        // 쿨다운 중이면 카운터 초기화 (쿨다운 끝나자마자 발동 방지)
        if (!canAct) {
            this._consecutiveYes = 0;
        }

        const rawYes = prob >= AI_ACTION_THRESHOLD;

        // 연속 확신 필터: canAct 상태에서만 카운트
        if (canAct && rawYes) {
            this._consecutiveYes++;
        } else if (canAct) {
            this._consecutiveYes = 0;
        }
        const decided = canAct && this._consecutiveYes >= AI_CONSECUTIVE_REQUIRED;

        // 매 초 로그
        const now = sim.elapsed ?? 0;
        if (!this._lastLogTime || now - this._lastLogTime >= 1.0) {
            this._lastLogTime = now;
            const mark = canAct
                ? decided
                    ? "O"
                    : rawYes
                      ? `${this._consecutiveYes}/${AI_CONSECUTIVE_REQUIRED}`
                      : "X"
                : "⏳";
            sim.addLog(`${fighter.name}: ${action.name} ${mark} (${(prob * 100).toFixed(0)}%)`);
        }

        if (!decided) return null;

        const cost = Math.ceil((fighter.maxHp * action.hpCostPercent) / 100);
        const paidCost = fighter.actionContext.spendHpForAction(fighter, cost);
        if (paidCost <= 0) {
            this._consecutiveYes = 0;
            return null;
        }

        this.resetCooldown(AI_MIN_INTERVAL);
        this._consecutiveYes = 0; // 발동 후 리셋
        this.usageCount[action.id] = (this.usageCount[action.id] ?? 0) + 1;
        return { action, fighter, paidCost };
    }
}
