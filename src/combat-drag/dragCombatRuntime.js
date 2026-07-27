import { DragInputState } from "./dragInputState.js";
import { PlayerShotState } from "./playerShotState.js";
import { DRAG_COMBAT_CONFIG } from "./config.js";
import { Vector2 } from "../core.js";

function copyPoint(point) {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y) ? { x: point.x, y: point.y } : null;
}
function copyValue(value) {
    if (value == null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(copyValue);
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copyValue(entry)]));
}

export class DragCombatRuntime {
    constructor(simulation, { onEvent, config = DRAG_COMBAT_CONFIG } = {}) {
        this.simulation = simulation;
        this.onEvent = onEvent;
        this.config = config;
        this.input = new DragInputState(config.input);
        this.shot = new PlayerShotState(config);
        this.lastEvent = null;
        this.aimCaster = null;
        this.pendingWarpRemoval = false;
    }

    begin(pointerId, cssPoint) {
        if (!this.#canAct()) return null;
        const result = this.input.begin(pointerId, cssPoint);
        if (result) {
            this.aimCaster = this.#player();
            this.simulation.addTimeWarp(this.aimCaster, Infinity);
        }
        return result;
    }

    move(pointerId, cssPoint) {
        if (!this.#canAct()) return null;
        return this.input.move(pointerId, cssPoint);
    }

    release(pointerId) {
        return this.#resolveInputResult(this.input.release(pointerId));
    }

    cancel(pointerId) {
        return this.#resolveInputResult(this.input.cancel(pointerId));
    }

    tickInput(realDelta) {
        if (!this.#canAct()) {
            this.reset();
            return;
        }
        this.#resolveInputResult(this.input.tick(realDelta));
    }

    flushInputFrame() {
        if (!this.pendingWarpRemoval) return;
        this.#removeAimWarp();
        this.pendingWarpRemoval = false;
    }

    tickShot(realDelta) {
        if (!this.shot.active) return;
        const player = this.#player();
        if (!this.#canAct()) return this.reset();
        const event = this.shot.tick(realDelta, player?.velocity?.length?.());
        if (event) this.#record(event);
    }

    onStaticCollision(fighter, context) {
        if (!this.shot.active || fighter !== this.#player()) return;
        const key = context.surfaceKey;
        if (this.shot.bounce(key, this.shot.elapsed)) this.#record({ type: "bounce", surfaceKey: key });
    }

    resolveFighterCollision(context, damage = null) {
        if (!this.shot.active) return null;
        const player = this.#player();
        if (!player || (context.a !== player && context.b !== player)) return null;
        const other = context.a === player ? context.b : context.a;
        const relation = this.simulation.isHostile(player, other) ? "enemy" : "ally";
        const targetToContact = Vector2.subtract(context.contactPoint, other.position).normalize();
        const result = this.shot.collide({ fighterId: other.id, relation, targetToContact });
        if (!result) return null;
        if (damage) this.#applyCollisionResult(context, player, other, result, damage);
        this.#record(result);
        return result;
    }

    applyResolvedFighterCollision(context, result, damage) {
        if (!result || !damage) return;
        const player = this.#player();
        const other = context.a === player ? context.b : context.a;
        this.#applyCollisionResult(context, player, other, result, damage);
    }

    reset() {
        const player = this.#player();
        this.#removeAimWarp();
        this.input.reset();
        this.shot.reset();
        this.lastEvent = null;
    }

    getSnapshot() {
        return {
            enabled: true,
            drag: {
                state: this.input.state,
                pointerId: this.input.pointerId,
                start: copyPoint(this.input.start),
                current: copyPoint(this.input.current),
                vector: copyValue(this.input.lastSnapshot),
                cooldownRemaining: this.input.cooldownRemaining,
                inputLockRemaining: this.input.inputLockRemaining
            },
            playerShot: {
                active: this.shot.active,
                bounceCount: this.shot.bounceCount,
                shields: Array.from(this.shot.shieldForwards, ([fighterId, forward]) => ({
                    fighterId,
                    forward: copyPoint(forward)
                })),
                recentSurface: this.shot.recentSurface ? { ...this.shot.recentSurface } : null
            },
            lastEvent: copyValue(this.lastEvent)
        };
    }

    #resolveInputResult(result) {
        if (!result) return null;
        if (result.type === "launch") {
            const player = this.#player();
            if (!this.#canAct() || !player) return this.#cancelLaunch();
            const direction = new Vector2(result.snapshot.vector.x, result.snapshot.vector.y);
            const speed =
                player.stats.baseSpeed *
                (this.config.shot.minSpeedRatio +
                    (this.config.shot.maxSpeedRatio - this.config.shot.minSpeedRatio) * result.snapshot.strength);
            player.applyImpulse(direction.scale(speed));
            const shields = new Map(
                this.simulation
                    .getEnemiesOf(player)
                    .filter((fighter) => !fighter.flags.defeated && !fighter.flags.destroyed)
                    .map((fighter) => [fighter.id, Vector2.subtract(player.position, fighter.position).normalize()])
            );
            this.shot.begin(player.id, shields);
        }
        if (result.type === "launch" || result.type === "cancel") {
            if (result.source === "auto-launch") this.pendingWarpRemoval = true;
            else this.#removeAimWarp();
        }
        this.#record(result);
        return result;
    }

    #cancelLaunch() {
        this.#removeAimWarp();
        return { type: "cancel" };
    }

    #applyCollisionResult(context, player, other, result, damage) {
        if (result.type === "ally-stop") return;
        if (result.type === "shield-counter") {
            if (context.a === player) {
                context.damageFromAToB = 0;
                context.damageFromBToA = damage.damageFromBToA * result.incomingMultiplier;
            } else {
                context.damageFromBToA = 0;
                context.damageFromAToB = damage.damageFromAToB * result.incomingMultiplier;
            }
            const recoil = Vector2.subtract(player.position, other.position)
                .normalize()
                .scale(player.stats.baseSpeed * result.recoilSpeedRatio);
            player.applyImpulse(recoil);
            this.input.lock(result.inputLockSeconds);
            return;
        }
        if (result.type === "rear-hit") {
            if (context.a === player) context.damageFromAToB = damage.damageFromAToB * result.damageMultiplier;
            else context.damageFromBToA = damage.damageFromBToA * result.damageMultiplier;
            if (result.staggerSeconds > 0) other.applySlow(result.staggerSeconds, 0);
        }
    }

    #canAct() {
        const player = this.#player();
        return Boolean(
            player &&
            !this.simulation.finished &&
            this.simulation.revivePauseRemaining <= 0 &&
            !player.flags.defeated &&
            !player.flags.destroyed &&
            !player.state.swallowed &&
            player.participation?.canAct !== false
        );
    }

    #player() {
        return this.simulation.playerBall;
    }

    #record(event) {
        this.lastEvent = copyValue(event);
        this.onEvent?.(this.getSnapshot());
    }

    #removeAimWarp() {
        if (this.aimCaster) this.simulation.removeTimeWarp(this.aimCaster);
        this.aimCaster = null;
    }
}
