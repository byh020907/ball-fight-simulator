import { shuffled } from "./random.js";

// ── Trigger Strategy ─────────────────────────────────────────────
// 발동 방식을 캡슐화. ctx = { action, sim, player, fireAction(), 상태 }

class TriggerStrategy {
    get type() {
        return "tap";
    }
    onPointerDown(ctx) {}
    onPointerUp(ctx) {}
    onTick(ctx) {}
}

class TapTrigger extends TriggerStrategy {
    get type() {
        return "tap";
    }
    onPointerDown(ctx) {
        ctx.fireAction();
    }
}

class ReleaseTrigger extends TriggerStrategy {
    get type() {
        return "release";
    }
    onPointerDown(ctx) {
        ctx._holdStarted = true;
    }
    onPointerUp(ctx) {
        if (ctx._holdStarted) ctx.fireAction();
        ctx._holdStarted = false;
    }
}

class HoldTrigger extends TriggerStrategy {
    get type() {
        return "hold";
    }
    onPointerDown(ctx) {
        ctx._holding = true;
    }
    onPointerUp(ctx) {
        if (ctx._holding && ctx._consumed) {
            ctx.action.onRelease?.(ctx.sim, ctx.player);
        }
        ctx._holding = false;
        ctx._consumed = false;
    }
    onTick(ctx) {
        if (!ctx._holding) return;
        if (!ctx.action.canHoldContinue?.(ctx.sim, ctx.player)) return;
        ctx.fireAction();
        ctx._consumed = true;
    }
}

// ── Action Base ──────────────────────────────────────────────────

class ClickAction {
    constructor(trigger = new TapTrigger()) {
        this.trigger = trigger;
    }

    get id() {
        throw new Error("override");
    }
    get name() {
        throw new Error("override");
    }
    get description() {
        throw new Error("override");
    }

    /** maxHP 대비 소모율 (%) */
    get hpCostPercent() {
        return 0.2;
    }

    /**
     * 조건 불충족 시 실패 이유 문자열 반환. null이면 조건 만족.
     */
    getFailureReason(sim, playerBall) {
        return null;
    }

    /** 액션 효과 적용. Action이 로직의 주체, domain의 getter/setter 사용 */
    apply(sim, playerBall) {
        throw new Error("override");
    }

    /** HoldTrigger 전용 */
    onRelease(sim, playerBall) {}
    canHoldContinue(sim, playerBall) {
        return true;
    }
}

// ── Concrete Actions ────────────────────────────────────────────
// 모두 TapTrigger 기본값 사용
// 모든 값은 모듈 상수로 관리 — description과 apply가 같은 값을 사용

const TIME_WARP_DURATION = 0.5;
const TIME_WARP_COST = 0.5;

const RUSH_DURATION = 0.5;
const RUSH_SPEED_BONUS = 0.25;
const RUSH_COST = 0.5;

const COUNTER_WINDOW_SECONDS = 0.2;
const COUNTER_BONUS_RATE = 0.1;
const COUNTER_COST = 1.5;

const PARRY_WINDOW_SECONDS = 0.3;
const PARRY_DAMAGE_MULTIPLIER = 0.5;
const PARRY_COST = 1.0;

const ENDURE_DURATION = 0.1;
const ENDURE_DAMAGE_MULTIPLIER = 0.5;
const ENDURE_COST = 1.0;

class TimeWarpAction extends ClickAction {
    get id() {
        return "time_warp";
    }
    get name() {
        return "시간 왜곡";
    }
    get description() {
        return `${TIME_WARP_DURATION}초간 상대만 슬로우`;
    }
    get hpCostPercent() {
        return TIME_WARP_COST;
    }

    apply(sim, playerBall) {
        const current = sim.getTimeSlowRemaining();
        sim.setTimeSlowRemaining(Math.max(current, TIME_WARP_DURATION));
    }
}

class RushAction extends ClickAction {
    get id() {
        return "rush";
    }
    get name() {
        return "돌진";
    }
    get description() {
        return `${RUSH_DURATION}초간 속도 +${RUSH_SPEED_BONUS * 100}%`;
    }
    get hpCostPercent() {
        return RUSH_COST;
    }

    apply(sim, playerBall) {
        const current = playerBall.actionContext.getEffect(this.id)?.remaining ?? 0;
        playerBall.actionContext.setEffect(this.id, {
            remaining: current > 0 ? current + RUSH_DURATION : RUSH_DURATION,
            getSpeedMultiplier: () => 1 + RUSH_SPEED_BONUS
        });
    }
}

class CounterAction extends ClickAction {
    get id() {
        return "counter";
    }
    get name() {
        return "카운터";
    }
    get description() {
        return `${COUNTER_WINDOW_SECONDS.toFixed(2)}초 안에 충돌 시 데미지 +${COUNTER_BONUS_RATE * 100}%`;
    }
    get hpCostPercent() {
        return COUNTER_COST;
    }

    apply(sim, playerBall) {
        const effect = {
            remaining: COUNTER_WINDOW_SECONDS,
            onFighterCollision: (owner, opponent, outgoingDamage, incomingDamage, simulation) => {
                const bonus = Math.round(outgoingDamage * COUNTER_BONUS_RATE);
                if (bonus > 0) {
                    opponent.takeDamage(bonus, owner, "Counter");
                    simulation.spawnActionText(opponent.position.clone(), "카운터!", "#ff8844");
                }
                effect.isExpired = true;
            }
        };

        playerBall.actionContext.setEffect(this.id, effect);
    }
}

class ParryAction extends ClickAction {
    get id() {
        return "parry";
    }
    get name() {
        return "받아치기";
    }
    get description() {
        return `${PARRY_WINDOW_SECONDS}초 안에 맞는 투사체 데미지 ${PARRY_DAMAGE_MULTIPLIER * 100}% 경감`;
    }
    get hpCostPercent() {
        return PARRY_COST;
    }

    apply(sim, playerBall) {
        const effect = {
            remaining: PARRY_WINDOW_SECONDS,
            onProjectileDamage: (amount, projectile, source, label, simulation, target) => {
                effect.isExpired = true;
                simulation.spawnActionText(target.position.clone(), "받아치기!", "#44ddff");
                return Math.round(amount * PARRY_DAMAGE_MULTIPLIER);
            }
        };

        playerBall.actionContext.setEffect(this.id, effect);
    }
}

class EndureAction extends ClickAction {
    get id() {
        return "endure";
    }
    get name() {
        return "버티기";
    }
    get description() {
        return `${ENDURE_DURATION}초간 받는 데미지 ${ENDURE_DAMAGE_MULTIPLIER * 100}% 경감`;
    }
    get hpCostPercent() {
        return ENDURE_COST;
    }

    apply(sim, playerBall) {
        playerBall.actionContext.setEffect(this.id, {
            remaining: ENDURE_DURATION,
            onDamageTaken: (amount, source, label) => {
                source?.simulation?.spawnActionText?.(playerBall.position.clone(), "버팀!", "#44ff44");
                return Math.round(amount * ENDURE_DAMAGE_MULTIPLIER);
            }
        });
    }
}

// ── 레지스트리 ──────────────────────────────────────────────────

const ACTION_POOL = Object.freeze([
    new TimeWarpAction(),
    new RushAction(),
    new CounterAction(),
    new ParryAction(),
    new EndureAction()
]);

export function getActionPool() {
    return ACTION_POOL;
}

export function pickRandomActions(count = 3) {
    const actions = shuffled(ACTION_POOL);
    return actions.slice(0, Math.min(count, actions.length));
}

export function findActionById(id) {
    return ACTION_POOL.find((a) => a.id === id) ?? null;
}

/**
 * 조건 불충족 시 실패 피드백을 보여주는 헬퍼.
 * app.js의 _tryFireAction에서 호출. 나중에 메시지 표시 방식 개선 시 이 함수만 수정.
 */
export function showActionFailure(action, sim, playerBall) {
    const reason = action.getFailureReason(sim, playerBall);
    if (!reason) return false;
    sim.spawnActionText(playerBall.position.clone(), reason, "#ff8888");
    return true;
}

/**
 * BattleBall이 단일 ref로 참조하는 액션 상태 컨텍스트.
 * 모든 ClickAction 관련 변수와 로직은 여기서 관리.
 */
export class ActionContext {
    constructor() {
        this._effects = new Map();
    }

    getEffect(id) {
        return this._effects.get(id) ?? null;
    }

    setEffect(id, effect) {
        this._effects.set(id, effect);
        return effect;
    }

    getSpeedMultiplier() {
        let multiplier = 1;
        for (const effect of this._effects.values()) {
            multiplier *= effect.getSpeedMultiplier?.() ?? 1;
        }
        return multiplier;
    }

    /** BattleBall.takeDamage()에서 호출 */
    onDamageTaken(amount, source, label) {
        let nextAmount = amount;
        for (const effect of this._effects.values()) {
            if (effect.isExpired) continue;
            nextAmount = effect.onDamageTaken?.(nextAmount, source, label) ?? nextAmount;
        }
        return nextAmount;
    }

    onProjectileDamage(amount, projectile, source, label, simulation, target) {
        let nextAmount = amount;
        for (const effect of this._effects.values()) {
            if (effect.isExpired) continue;
            nextAmount =
                effect.onProjectileDamage?.(nextAmount, projectile, source, label, simulation, target) ?? nextAmount;
        }
        return nextAmount;
    }

    onFighterCollision(owner, opponent, outgoingDamage, incomingDamage, simulation) {
        for (const effect of this._effects.values()) {
            if (effect.isExpired) continue;
            effect.onFighterCollision?.(owner, opponent, outgoingDamage, incomingDamage, simulation);
        }
    }

    // ── 프레임 갱신 ──

    /** app.js에서 HP 소모. BattleBall.actionContext 통해 호출. */
    spendHpForAction(ball, amount) {
        if (ball.hp <= 1) return 0;
        const cost = Math.min(amount, ball.hp - 1);
        ball.hp -= cost;
        return cost;
    }

    /** BattleBall._tickTimers()에서 호출 */
    tickTimers(delta) {
        for (const [id, effect] of this._effects) {
            if (typeof effect.remaining === "number") {
                effect.remaining -= delta;
            }
            effect.tick?.(delta);
            if (effect.isExpired || effect.remaining <= 0) {
                this._effects.delete(id);
            }
        }
    }
}
