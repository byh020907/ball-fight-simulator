import { shuffled } from "./random.js";
import { Vector2 } from "./core.js";

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

    /**
     * AI가 이 액션을 사용할 조건. sim, fighter, opponent 객체를 전달받아
     * 실제로 이득을 볼 수 있는 상황인지 판단합니다.
     * 각 Action이 자신의 발동 조건을 직접 소유합니다.
     */
    canAIUse(sim, fighter, opponent, hpRatio, distance) {
        return false;
    }
}

// ── Concrete Actions ────────────────────────────────────────────
// 각 Action이 자신의 파라미터를 static DEFAULT + 인스턴스 변수로 소유

class TimeWarpAction extends ClickAction {
    static DEFAULT_DURATION = 0.5;
    static DEFAULT_HP_COST = 0.5;

    constructor() {
        super();
        this.duration = TimeWarpAction.DEFAULT_DURATION;
        this._hpCostPercent = TimeWarpAction.DEFAULT_HP_COST;
    }

    get id() {
        return "time_warp";
    }
    get name() {
        return "시간 왜곡";
    }
    get description() {
        return `${this.duration}초간 상대만 슬로우`;
    }
    get hpCostPercent() {
        return this._hpCostPercent;
    }

    apply(sim, playerBall) {
        const current = sim.getTimeSlowRemaining();
        sim.setTimeSlowRemaining(Math.max(current, this.duration));
        sim._clickActionContext.timeSlowExempt.add(playerBall);
    }

    canAIUse(sim, fighter, opponent, hpRatio, distance) {
        const toOpponent = Vector2.subtract(opponent.position, fighter.position);
        const dist = toOpponent.length();
        if (dist < 20) return false;
        const toDir = toOpponent.normalize();
        const opponentApproachSpeed = opponent.velocity.dot(toDir.scale(-1));

        if (fighter.meta?.isRanged) {
            // 원거리: 상대가 빠르게 접근 중
            return opponentApproachSpeed > 80 && dist < 350;
        }
        // 근접: 상대가 도망 중
        return opponentApproachSpeed < -40 && dist < 300;
    }
}

class RushAction extends ClickAction {
    static DEFAULT_DURATION = 1;
    static DEFAULT_SPEED_BONUS = 0.5;
    static DEFAULT_HP_COST = 1.0;

    constructor() {
        super();
        this.duration = RushAction.DEFAULT_DURATION;
        this.speedBonus = RushAction.DEFAULT_SPEED_BONUS;
        this._hpCostPercent = RushAction.DEFAULT_HP_COST;
    }

    get id() {
        return "rush";
    }
    get name() {
        return "돌진";
    }
    get description() {
        return `${this.duration}초간 속도 +${this.speedBonus * 100}%`;
    }
    get hpCostPercent() {
        return this._hpCostPercent;
    }

    apply(sim, playerBall) {
        const current = playerBall.actionContext.getEffect(this.id)?.remaining ?? 0;
        playerBall.actionContext.setEffect(this.id, {
            remaining: current > 0 ? current + this.duration : this.duration,
            getSpeedMultiplier: () => 1 + this.speedBonus
        });
        this._applyBurstImpulse(sim, playerBall);
    }

    _applyBurstImpulse(sim, playerBall) {
        const currentSpeed = playerBall.velocity.length();
        const direction = this._getRushDirection(sim, playerBall, currentSpeed);
        const targetSpeed = Math.max(
            currentSpeed,
            playerBall.baseSpeed * playerBall.getStatModifiers().speed * sim.getSpeedMultiplier(playerBall)
        );
        playerBall.applyImpulse(direction.scale(targetSpeed).subtract(playerBall.velocity));
    }

    _getRushDirection(sim, playerBall, currentSpeed) {
        if (currentSpeed > 5) {
            return playerBall.velocity.clone().normalize();
        }
        const opponent = sim.getOpponent(playerBall);
        if (opponent) {
            return Vector2.subtract(opponent.position, playerBall.position).normalize();
        }
        return Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
    }

    canAIUse(sim, fighter, opponent, hpRatio, distance) {
        // 근접 캐릭터만: 상대가 멀고 접근 중이 아닐 때 돌진
        if (fighter.meta?.isRanged) return false;
        const toOpp = Vector2.subtract(opponent.position, fighter.position).normalize();
        const oppApproach = opponent.velocity.dot(toOpp.scale(-1));
        return distance > 300 && oppApproach < 30;
    }
}

class CounterAction extends ClickAction {
    static DEFAULT_WINDOW_SECONDS = 0.2;
    static DEFAULT_REFLECT_RATE = 1.0;
    static DEFAULT_HP_COST = 1.5;

    constructor() {
        super();
        this.windowSeconds = CounterAction.DEFAULT_WINDOW_SECONDS;
        this.reflectRate = CounterAction.DEFAULT_REFLECT_RATE;
        this._hpCostPercent = CounterAction.DEFAULT_HP_COST;
    }

    get id() {
        return "counter";
    }
    get name() {
        return "카운터";
    }
    get description() {
        return `${this.windowSeconds.toFixed(2)}초 안에 충돌 시 받는 충돌 데미지 반사`;
    }
    get hpCostPercent() {
        return this._hpCostPercent;
    }

    apply(sim, playerBall) {
        sim.spawnActionWindow(playerBall, this.id, this.windowSeconds);
        sim.playSound("counter");
        const effect = {
            remaining: this.windowSeconds,
            onFighterCollision: (owner, opponent, outgoingDamage, incomingDamage, simulation) => {
                const reflectedDamage = Math.round(incomingDamage * this.reflectRate);
                if (reflectedDamage > 0) {
                    opponent.takeDamage(reflectedDamage, owner, "Counter");
                    simulation.spawnActionText(opponent.position.clone(), "카운터!", "#ff8844");
                    simulation.spawnActionSuccess(opponent.position.clone(), "counter");
                    simulation.playSound("counter");
                }
                effect.isExpired = true;
                return { incomingDamage: 0 };
            }
        };

        playerBall.actionContext.setEffect(this.id, effect);
    }

    canAIUse(sim, fighter, opponent, hpRatio, distance) {
        // 충돌 0.6초 이내 예상 + 상대가 빠르게 접근 중
        if (distance > 200 || distance < 10) return false;
        const toMe = Vector2.subtract(fighter.position, opponent.position).normalize();
        const approach = opponent.velocity.dot(toMe);
        // 인간 수준 분산: 완벽 타이밍이 아닌 55% 확률로만 활성화
        return approach > 50 && distance / Math.max(1, approach) < 0.6 && Math.random() < 0.55;
    }
}

class ProjectileGuardAction extends ClickAction {
    static DEFAULT_WINDOW_SECONDS = 0.3;
    static DEFAULT_DAMAGE_MULTIPLIER = 0.25;
    static DEFAULT_HP_COST = 1.0;

    constructor() {
        super();
        this.windowSeconds = ProjectileGuardAction.DEFAULT_WINDOW_SECONDS;
        this.damageMultiplier = ProjectileGuardAction.DEFAULT_DAMAGE_MULTIPLIER;
        this._hpCostPercent = ProjectileGuardAction.DEFAULT_HP_COST;
    }

    get id() {
        return "projectile_guard";
    }
    get name() {
        return "투사체 방어";
    }
    get description() {
        return `${this.windowSeconds}초 안에 맞는 투사체 데미지 ${(1 - this.damageMultiplier) * 100}% 경감`;
    }
    get hpCostPercent() {
        return this._hpCostPercent;
    }

    apply(sim, playerBall, paidCost = 0) {
        sim.spawnActionWindow(playerBall, this.id, this.windowSeconds);
        sim.playSound("projectile_guard");
        const effect = {
            remaining: this.windowSeconds,
            onProjectileDamage: (amount, projectile, source, label, simulation, target) => {
                effect.isExpired = true;
                target.actionContext.refundHpForAction(target, paidCost);
                simulation.spawnActionText(target.position.clone(), "투사체 방어!", "#44ddff");
                simulation.spawnActionSuccess(target.position.clone(), "projectile_guard");
                simulation.playSound("projectile_guard");
                return Math.round(amount * this.damageMultiplier);
            }
        };

        playerBall.actionContext.setEffect(this.id, effect);
    }

    canAIUse(sim, fighter, opponent, hpRatio, distance) {
        // 투사체가 250px 이내에서 접근 중 + 도달 0.6초 이내
        return sim.entities.some((e) => {
            if (e === fighter || e === opponent || e.isExpired || !e.velocity) return false;
            const toMe = Vector2.subtract(fighter.position, e.position);
            const d = toMe.length();
            if (d > 250) return false;
            const approach = e.velocity.dot(toMe.normalize());
            return approach > 30 && d / Math.max(1, approach) < 0.6;
        });
    }
}

class EndureAction extends ClickAction {
    static DEFAULT_DURATION = 0.2;
    static DEFAULT_DAMAGE_MULTIPLIER = 0.2;
    static DEFAULT_HP_COST = 1.0;

    constructor() {
        super();
        this.duration = EndureAction.DEFAULT_DURATION;
        this.damageMultiplier = EndureAction.DEFAULT_DAMAGE_MULTIPLIER;
        this._hpCostPercent = EndureAction.DEFAULT_HP_COST;
    }

    get id() {
        return "endure";
    }
    get name() {
        return "버티기";
    }
    get description() {
        return `${this.duration}초간 받는 모든 데미지 ${(1 - this.damageMultiplier) * 100}% 경감`;
    }
    get hpCostPercent() {
        return this._hpCostPercent;
    }

    apply(sim, playerBall) {
        sim.spawnActionWindow(playerBall, this.id, this.duration);
        sim.playSound("guard");
        playerBall.actionContext.setEffect(this.id, {
            remaining: this.duration,
            onDamageTaken: (amount, source, label) => {
                source?.simulation?.spawnActionText?.(playerBall.position.clone(), "버팀!", "#44ff44");
                source?.simulation?.spawnActionSuccess?.(playerBall.position.clone(), "endure");
                source?.simulation?.playSound?.("guard");
                return Math.round(amount * this.damageMultiplier);
            }
        });
    }

    canAIUse(sim, fighter, opponent, hpRatio, distance) {
        if (distance > 250) return false;
        const toMe = Vector2.subtract(fighter.position, opponent.position).normalize();
        const approach = opponent.velocity.dot(toMe);
        return approach > 50 && distance / Math.max(1, approach) < 0.4 && Math.random() < 0.5;
    }
}

class LifeStealAction extends ClickAction {
    static DEFAULT_DURATION = 2.0;
    static DEFAULT_LIFESTEAL_RATE = 0.5;
    static DEFAULT_HP_COST = 1.0;

    constructor() {
        super();
        this.duration = LifeStealAction.DEFAULT_DURATION;
        this.lifestealRate = LifeStealAction.DEFAULT_LIFESTEAL_RATE;
        this._hpCostPercent = LifeStealAction.DEFAULT_HP_COST;
    }

    get id() {
        return "life_steal";
    }
    get name() {
        return "흡혈";
    }
    get description() {
        return `${this.duration}초간 다음 충돌 피해의 ${this.lifestealRate * 100}% HP 회복`;
    }
    get hpCostPercent() {
        return this._hpCostPercent;
    }

    apply(sim, playerBall) {
        let consumed = false;
        playerBall.actionContext.setEffect(this.id, {
            remaining: this.duration,
            onFighterCollision: (owner, opponent, outgoingDamage, incomingDamage, simulation) => {
                if (consumed || outgoingDamage <= 0) return;
                consumed = true;
                const heal = Math.round(outgoingDamage * this.lifestealRate);
                const actual = owner.actionContext.refundHpForAction(owner, heal);
                if (actual > 0) {
                    simulation.spawnActionText(owner.position.clone(), `흡혈 +${actual}`, "#ff6666");
                    simulation.spawnActionSuccess(owner.position.clone(), "life_steal");
                }
            }
        });
    }

    canAIUse(sim, fighter, opponent, hpRatio, distance) {
        return hpRatio <= 0.5 && distance < 200;
    }
}

class ShockwaveAction extends ClickAction {
    static DEFAULT_RADIUS = 150;
    static DEFAULT_PUSH_FORCE = 400;
    static DEFAULT_HP_COST = 1.2;

    constructor() {
        super();
        this.radius = ShockwaveAction.DEFAULT_RADIUS;
        this.pushForce = ShockwaveAction.DEFAULT_PUSH_FORCE;
        this._hpCostPercent = ShockwaveAction.DEFAULT_HP_COST;
    }

    get id() {
        return "shockwave";
    }
    get name() {
        return "충격파";
    }
    get description() {
        return `반경 ${this.radius}px 내 대상을 밀쳐냄`;
    }
    get hpCostPercent() {
        return this._hpCostPercent;
    }

    apply(sim, playerBall) {
        for (const fighter of sim.fighters) {
            if (fighter === playerBall || fighter.flags.defeated) continue;
            const toFighter = Vector2.subtract(fighter.position, playerBall.position);
            const dist = toFighter.length();
            if (dist > this.radius || dist === 0) continue;
            const force = this.pushForce * (1 - dist / this.radius);
            fighter.applyImpulse(toFighter.normalize().scale(force));
        }
        for (const entity of sim.entities) {
            if (entity === playerBall || entity.isExpired || typeof entity.applyImpulse !== "function") continue;
            const toEntity = Vector2.subtract(entity.position, playerBall.position);
            const dist = toEntity.length();
            if (dist > this.radius || dist === 0) continue;
            const force = this.pushForce * 0.5 * (1 - dist / this.radius);
            entity.applyImpulse(toEntity.normalize().scale(force));
        }
        sim.spawnPulse(playerBall.position.clone(), "#88aaff");
    }

    canAIUse(sim, fighter, opponent, hpRatio, distance) {
        return distance < 200 && hpRatio < 0.7;
    }
}

class EvadeAction extends ClickAction {
    static DEFAULT_DASH_SPEED = 800;
    static DEFAULT_SPEED_BOOST = 0.3;
    static DEFAULT_SPEED_BOOST_DURATION = 0.4;
    static DEFAULT_HP_COST = 0.8;

    constructor() {
        super();
        this.dashSpeed = EvadeAction.DEFAULT_DASH_SPEED;
        this.speedBoost = EvadeAction.DEFAULT_SPEED_BOOST;
        this.speedBoostDuration = EvadeAction.DEFAULT_SPEED_BOOST_DURATION;
        this._hpCostPercent = EvadeAction.DEFAULT_HP_COST;
    }

    get id() {
        return "evade";
    }
    get name() {
        return "회피";
    }
    get description() {
        return `진행 방향에서 좌/우 90도로 꺾어 회피, ${this.speedBoostDuration}초간 속도 +${this.speedBoost * 100}%`;
    }
    get hpCostPercent() {
        return this._hpCostPercent;
    }

    apply(sim, playerBall) {
        const currentDir =
            playerBall.velocity.length() > 10
                ? playerBall.velocity.clone().normalize()
                : Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
        // 좌/우 랜덤 90도 회전
        const angle = ((Math.random() < 0.5 ? -1 : 1) * Math.PI) / 2;
        const evadeDir = new Vector2(
            currentDir.x * Math.cos(angle) - currentDir.y * Math.sin(angle),
            currentDir.x * Math.sin(angle) + currentDir.y * Math.cos(angle)
        );
        playerBall.applyImpulse(evadeDir.scale(this.dashSpeed));
        playerBall.actionContext.setEffect("evade_speed", {
            remaining: this.speedBoostDuration,
            getSpeedMultiplier: () => 1 + this.speedBoost
        });
        sim.spawnActionText(playerBall.position.clone(), "회피!", "#44ddff");
        sim.spawnActionSuccess(playerBall.position.clone(), "evade");
        sim.playSound("dash");
    }

    canAIUse(sim, fighter, opponent, hpRatio, distance) {
        // 상대가 빠르게 접근 중일 때 회피
        if (distance > 220 || distance < 15) return false;
        const toMe = Vector2.subtract(fighter.position, opponent.position).normalize();
        const approach = opponent.velocity.dot(toMe);
        return approach > 40 && Math.random() < 0.5;
    }
}

// ── 레지스트리 ──────────────────────────────────────────────────

const ACTION_POOL = Object.freeze([
    new TimeWarpAction(),
    new RushAction(),
    new CounterAction(),
    new ProjectileGuardAction(),
    new EndureAction(),
    new LifeStealAction(),
    new ShockwaveAction(),
    new EvadeAction()
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
        let result = { outgoingDamage, incomingDamage };
        for (const effect of this._effects.values()) {
            if (effect.isExpired) continue;
            const next = effect.onFighterCollision?.(
                owner,
                opponent,
                result.outgoingDamage,
                result.incomingDamage,
                simulation
            );
            if (next) {
                result = {
                    outgoingDamage: next.outgoingDamage ?? result.outgoingDamage,
                    incomingDamage: next.incomingDamage ?? result.incomingDamage
                };
            }
        }
        return result;
    }

    // ── 프레임 갱신 ──

    /** app.js에서 HP 소모. BattleBall.actionContext 통해 호출. */
    spendHpForAction(ball, amount) {
        if (ball.hp <= 1) return 0;
        const cost = Math.min(amount, ball.hp - 1);
        ball.hp -= cost;
        return cost;
    }

    refundHpForAction(ball, amount) {
        if (amount <= 0) return 0;
        const refund = Math.min(amount, ball.maxHp - ball.hp);
        ball.hp += refund;
        return refund;
    }

    /** BattleBall._tickTimers()에서 호출 */
    tickTimers(ball, delta) {
        for (const [id, effect] of this._effects) {
            if (typeof effect.remaining === "number") {
                effect.remaining -= delta;
            }
            effect.tick?.(delta);
            if (effect.isExpired || effect.remaining <= 0) {
                if (!effect.isExpired && ball?.simulation) {
                    // window 만료 — whiff 효과 (방어/회피 액션만)
                    if (id === "counter" || id === "projectile_guard" || id === "endure") {
                        ball.simulation.spawnActionWhiff(ball.position.clone());
                        ball.simulation.playSound("whiff");
                    }
                }
                this._effects.delete(id);
            }
        }
    }
}
