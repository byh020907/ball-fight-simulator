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

    /** 발동 조건 — false면 fireAction에서 skip */
    isAvailable(sim, playerBall) {
        return true;
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

class TimeWarpAction extends ClickAction {
    get id() {
        return "time_warp";
    }
    get name() {
        return "시간 왜곡";
    }
    get description() {
        return "0.25초간 상대만 슬로우 (HP 50% 이하)";
    }
    get hpCostPercent() {
        return 0.2;
    }

    isAvailable() {
        return true;
    }

    apply(sim, playerBall) {
        const current = sim.getTimeSlowRemaining();
        sim.setTimeSlowRemaining(Math.max(current, 0.25));
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
        return "0.2초간 속도 +25%";
    }
    get hpCostPercent() {
        return 0.7;
    }

    apply(sim, playerBall) {
        const current = playerBall.getRushRemaining();
        playerBall.setRush(current > 0 ? current + 0.2 : 0.2, 1.25);
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
        return "충돌 임박 시 클릭 → 데미지 +12%";
    }
    get hpCostPercent() {
        return 1.35;
    }

    isAvailable(sim, playerBall) {
        return sim.isCollisionImminent(playerBall);
    }

    apply(sim, playerBall) {
        sim.setCounterCharged(true);
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
        return "날아오는 투사체 데미지 50% 경감";
    }
    get hpCostPercent() {
        return 1.15;
    }

    isAvailable(sim, playerBall) {
        return sim.getIncomingProjectile(playerBall) !== null;
    }

    apply(sim, playerBall) {
        const proj = sim.getIncomingProjectile(playerBall);
        if (proj) proj.setParryReduction(0.5);
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
        return "0.1초간 받는 데미지 50% 경감 (HP 50% 이하)";
    }
    get hpCostPercent() {
        return 0.9;
    }

    isAvailable() {
        return true;
    }

    apply(sim, playerBall) {
        playerBall.setEndureRemaining(0.1, 0.5);
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
    const shuffled = [...ACTION_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function findActionById(id) {
    return ACTION_POOL.find((a) => a.id === id) ?? null;
}
