import { DragInputState } from "./dragInputState.js";
import { PlayerShotState } from "./playerShotState.js";
import { EnemyAttackQueue } from "./enemyAttackQueue.js";
import { DRAG_COMBAT_CONFIG, getDragLaunchSpeed } from "./config.js";
import { Vector2 } from "../core.js";
import {
    advanceEnemyChargePlan,
    getChargeRatio,
    getEnemyChargePlan,
    getEnemyRequiredChargeRatio
} from "./chargeMath.js";

function copyPoint(point) {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y) ? { x: point.x, y: point.y } : null;
}
function copyValue(value) {
    if (value == null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(copyValue);
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copyValue(entry)]));
}

export class DragCombatRuntime {
    constructor(simulation, { onEvent, config = DRAG_COMBAT_CONFIG, automated = false } = {}) {
        this.simulation = simulation;
        this.onEvent = onEvent;
        this.config = config;
        this.automated = automated === true;
        this.input = new DragInputState(config.input);
        this.shot = new PlayerShotState(config);
        this.enemyQueue = new EnemyAttackQueue(config.enemy);
        this.enemyDirections = new Map();
        this.enemyTargets = new Map();
        this.enemySlowElapsed = 0;
        this.lastEvent = null;
        this.eventSequence = 0;
        this.aimOwner = null;
        this.aimCaster = null;
        this.pendingWarpRemoval = false;
        this.playerWarpReleased = false;
        this.enemyChargePlan = null;
        this.enemyChargeElapsed = 0;
    }

    begin(pointerId, cssPoint) {
        if (this.automated || this.shot.active || !this.#canAct()) return null;
        const result = this.input.begin(pointerId, cssPoint);
        if (result) {
            this.aimOwner = this.#player();
            this.playerWarpReleased = false;
        }
        return result;
    }

    move(pointerId, cssPoint) {
        if (this.automated || !this.#canAct()) return null;
        const result = this.input.move(pointerId, cssPoint);
        if (result?.active && !this.playerWarpReleased && !this.aimCaster) {
            this.aimCaster = this.#player();
            this.simulation.addTimeWarp(this.aimCaster, Infinity);
        }
        return result;
    }

    release(pointerId) {
        if (this.automated) return null;
        if (this.input.state === "aiming" && this.aimOwner !== this.#player()) {
            return this.#resolveInputResult(this.input.cancel(pointerId));
        }
        return this.#resolveInputResult(this.input.release(pointerId));
    }

    cancel(pointerId) {
        if (this.automated) return null;
        return this.#resolveInputResult(this.input.cancel(pointerId));
    }

    tickInput(realDelta) {
        if (this.automated) return;
        if (!this.#canAct()) {
            this.reset();
            return;
        }
        this.#resolveInputResult(this.input.tick(realDelta));
        if (
            this.aimCaster &&
            !this.playerWarpReleased &&
            getChargeRatio(this.input.aimElapsed, this.config.input.maxAimSeconds) >= 0.5
        ) {
            this.#removeAimWarp();
            this.playerWarpReleased = true;
        }
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
        const event = this.shot.tick(
            realDelta,
            player?.velocity?.length?.(),
            player?.stats?.baseSpeed ?? player?.stats?.speed
        );
        if (event) this.#record(event);
    }

    tickEnemy(combatDelta) {
        if (!this.#canRunEnemyQueue()) return this.#resetEnemy();
        const eligible = this.#eligibleAttackers();
        if (!eligible.length) return this.#resetEnemy();
        const effectiveDelta = combatDelta * (!this.automated && this.input.state === "aiming" ? 0.35 : 1);
        if (this.enemyQueue.state === "flight") {
            const attacker = this.#fighterById(this.enemyQueue.attackerId);
            if (!attacker || !eligible.includes(attacker.id)) {
                this.#resolveEnemyFlight("invalid", eligible);
                return;
            }
            if (this.enemyQueue.elapsed + effectiveDelta >= this.config.enemy.flightMaxSeconds) {
                this.#resolveEnemyFlight("timeout", eligible);
                return;
            }
            const referenceSpeed =
                attacker?.stats?.baseSpeed ?? attacker?.stats?.speed ?? this.config.shot.shotSlowSpeed;
            const speedThreshold = this.config.shot.shotSlowBaseSpeedRatio * Number(referenceSpeed);
            const enemySlowThreshold =
                Number.isFinite(speedThreshold) && speedThreshold > 0 ? speedThreshold : this.config.shot.shotSlowSpeed;
            this.enemySlowElapsed =
                attacker.velocity.length() <= enemySlowThreshold ? this.enemySlowElapsed + effectiveDelta : 0;
            if (this.enemySlowElapsed >= this.config.shot.shotSlowSeconds) {
                this.#resolveEnemyFlight("slow-stop", eligible);
                return;
            }
        }
        if (this.enemyQueue.state === "windup" && this.enemyQueue.attackerId) {
            const attacker = this.#fighterById(this.enemyQueue.attackerId);
            const target = this.#targetForAttacker(attacker);
            if (attacker && target) {
                const direction = Vector2.subtract(target.position, attacker.position).normalize();
                this.enemyDirections.set(this.enemyQueue.attackerId, copyPoint(direction) ?? { x: 0, y: 0 });
                this.enemyChargeElapsed += effectiveDelta;
                const relative = Vector2.subtract(target.velocity ?? new Vector2(), attacker.velocity ?? new Vector2());
                const lateral = relative.x * -direction.y + relative.y * direction.x;
                const required = getEnemyRequiredChargeRatio(
                    Vector2.subtract(target.position, attacker.position).length(),
                    lateral,
                    target.stats?.baseSpeed ?? target.stats?.speed
                );
                this.enemyChargePlan = advanceEnemyChargePlan(this.enemyChargePlan, {
                    now: this.enemyChargeElapsed,
                    requiredChargeRatio: required,
                    maxAimSeconds: this.config.input.maxAimSeconds
                });
                this.enemyQueue.setWindupDuration(this.enemyChargePlan.plannedEndAt);
            }
        }
        const event = this.enemyQueue.tick(effectiveDelta, eligible);
        if (event) this.#handleEnemyEvent(event);
    }

    onStaticCollision(fighter, context) {
        if (fighter === this.#fighterById(this.enemyQueue.attackerId) && this.enemyQueue.state === "flight") {
            this.enemySlowElapsed = 0;
        }
        if (!this.shot.active || fighter !== this.#player()) return;
        const key = context.surfaceKey;
        if (this.shot.bounce(key, this.shot.elapsed))
            this.#record({ type: "bounce", surfaceKey: key, bounceCount: this.shot.bounceCount });
    }

    resolveFighterCollision(context, damage = null) {
        const enemyFlight = this.#resolveEnemyCharacterCollision(context);
        if (!this.shot.active) return enemyFlight ? { enemyFlight } : null;
        const player = this.#player();
        if (!player || (context.a !== player && context.b !== player)) return null;
        const other = context.a === player ? context.b : context.a;
        const relation = this.simulation.isHostile(player, other) ? "enemy" : "ally";
        const contactPoint = copyPoint(context.contactPoint) ?? copyPoint(player.position) ?? { x: 0, y: 0 };
        const targetToContact = Vector2.subtract(contactPoint, other.position).normalize();
        const result = this.shot.collide({ fighterId: other.id, relation, targetToContact });
        if (!result) return enemyFlight ? { enemyFlight } : null;
        if (damage) this.#applyCollisionResult(context, player, other, result, damage);
        this.#record(result);
        return { playerShot: result, enemyFlight };
    }

    applyResolvedFighterCollision(context, result, damage) {
        if (!result || !damage) return;
        if (result.playerShot) {
            const player = this.#player();
            const other = context.a === player ? context.b : context.a;
            this.#applyCollisionResult(context, player, other, result.playerShot, damage);
        }
        if (result.enemyFlight && !context.collisionReplaced) {
            const { attacker } = result.enemyFlight;
            if (context.a === attacker)
                context.damageFromAToB = damage.damageFromAToB * this.config.enemy.attackDamageMultiplier;
            else if (context.b === attacker)
                context.damageFromBToA = damage.damageFromBToA * this.config.enemy.attackDamageMultiplier;
        }
    }

    reset() {
        this.#removeAimWarp();
        this.pendingWarpRemoval = false;
        this.aimOwner = null;
        this.playerWarpReleased = false;
        this.input.reset();
        this.shot.reset();
        this.#resetEnemy();
        this.lastEvent = null;
    }

    getSnapshot() {
        return {
            enabled: true,
            automated: this.automated,
            drag: {
                state: this.input.state,
                pointerId: this.input.pointerId,
                start: copyPoint(this.input.start),
                current: copyPoint(this.input.current),
                vector: copyValue(this.input.lastSnapshot),
                aimElapsed: this.input.aimElapsed,
                chargeRatio: getChargeRatio(this.input.aimElapsed, this.config.input.maxAimSeconds),
                maxAimSeconds: this.config.input.maxAimSeconds,
                inputLockRemaining: this.input.inputLockRemaining
            },
            playerShot: {
                active: this.shot.active,
                bounceCount: this.shot.bounceCount,
                flightElapsed: this.shot.elapsed,
                flightRemaining: this.shot.active
                    ? Math.max(0, this.config.shot.shotMaxSeconds - this.shot.elapsed)
                    : 0,
                flightDuration: this.config.shot.shotMaxSeconds,
                shieldRemaining: this.shot.active
                    ? Math.max(0, this.config.shield.durationSeconds - this.shot.elapsed)
                    : 0,
                shieldDuration: this.config.shield.durationSeconds,
                shields: Array.from(this.shot.shieldForwards, ([fighterId, forward]) => ({
                    fighterId,
                    forward: copyPoint(forward)
                })),
                recentSurface: this.shot.recentSurface ? { ...this.shot.recentSurface } : null
            },
            enemyQueue: {
                phase: this.enemyQueue.state,
                attackerId: this.enemyQueue.attackerId,
                targetId: this.enemyTargets.get(this.enemyQueue.attackerId) ?? null,
                windupDirection: copyPoint(this.enemyDirections.get(this.enemyQueue.attackerId)),
                elapsed: this.enemyQueue.elapsed,
                windupDuration: this.enemyQueue.windupDuration,
                chargeRatio: this.enemyChargePlan?.naturalRatio ?? 0,
                displayProgress: this.enemyChargePlan?.displayProgress ?? 0,
                accelerating: this.enemyChargePlan?.accelerating === true,
                plannedEndAt: this.enemyChargePlan?.plannedEndAt ?? null,
                flightDuration: this.config.enemy.flightMaxSeconds,
                lastResolution: copyValue(this.enemyQueue.lastResult)
            },
            launch: {
                minSpeedRatio: this.config.shot.minSpeedRatio,
                maxSpeedRatio: this.config.shot.maxSpeedRatio,
                releaseSpeedMultiplier: this.config.shot.releaseSpeedMultiplier,
                shotMaxSeconds: this.config.shot.shotMaxSeconds
            },
            lastEvent: copyValue(this.lastEvent),
            eventSequence: this.eventSequence
        };
    }

    #resolveInputResult(result) {
        if (!result) return null;
        if (result.type === "launch") {
            const player = this.#player();
            if (!this.#canAct() || !player) return this.#cancelLaunch();
            const direction = new Vector2(result.snapshot.vector.x, result.snapshot.vector.y);
            const speed = getDragLaunchSpeed(player.stats.baseSpeed, result.snapshot.chargeRatio, this.config.shot);
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
            this.#removeAimWarp();
            this.pendingWarpRemoval = false;
            this.aimOwner = null;
            this.playerWarpReleased = false;
        }
        this.#record(result);
        return result;
    }

    #cancelLaunch() {
        this.#removeAimWarp();
        this.aimOwner = null;
        this.playerWarpReleased = false;
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
        if (this.automated) return false;
        const player = this.#player();
        return Boolean(
            player &&
            (this.input.state !== "aiming" || this.aimOwner === player) &&
            !this.simulation.finished &&
            this.simulation.revivePauseRemaining <= 0 &&
            !player.flags.defeated &&
            !player.flags.destroyed &&
            !player.state.swallowed &&
            player.participation?.canAct !== false
        );
    }

    #canRunEnemyQueue() {
        if (this.simulation.finished || this.simulation.revivePauseRemaining > 0) return false;
        return this.automated || this.#canAct();
    }

    #eligibleAttackers() {
        const player = this.#player();
        return this.simulation.fighters
            .filter(
                (fighter) =>
                    (this.automated || (fighter !== player && this.simulation.isHostile(player, fighter))) &&
                    fighter.participation?.canAct !== false &&
                    !fighter.flags.defeated &&
                    !fighter.flags.destroyed &&
                    !fighter.state.swallowed &&
                    !fighter.state.movement &&
                    (!this.automated || this.#findAutomatedTarget(fighter))
            )
            .map((fighter) => fighter.id);
    }

    #fighterById(id) {
        return this.simulation.fighters.find((fighter) => fighter.id === id) ?? null;
    }

    #handleEnemyEvent(event) {
        if (event.type === "windup") {
            const attacker = this.#fighterById(event.attackerId);
            const target = this.#targetForAttacker(attacker);
            const direction =
                attacker && target ? Vector2.subtract(target.position, attacker.position).normalize() : null;
            this.enemyDirections.clear();
            this.enemyTargets.clear();
            if (target) this.enemyTargets.set(event.attackerId, target.id);
            if (direction) this.enemyDirections.set(event.attackerId, copyPoint(direction) ?? { x: 0, y: 0 });
            this.enemySlowElapsed = 0;
            const relative =
                direction && attacker && target
                    ? Vector2.subtract(target.velocity ?? new Vector2(), attacker.velocity ?? new Vector2())
                    : null;
            const lateral = direction && relative ? relative.x * -direction.y + relative.y * direction.x : 0;
            const required =
                direction && attacker && target
                    ? getEnemyRequiredChargeRatio(
                          Vector2.subtract(target.position, attacker.position).length(),
                          lateral,
                          target.stats?.baseSpeed ?? target.stats?.speed
                      )
                    : 0.35;
            this.enemyChargeElapsed = 0;
            this.enemyChargePlan = getEnemyChargePlan({
                requiredChargeRatio: required,
                maxAimSeconds: this.config.input.maxAimSeconds
            });
            this.enemyQueue.setWindupDuration(this.enemyChargePlan.plannedEndAt);
        }
        if (event.type === "launch") {
            const attacker = this.#fighterById(event.attackerId);
            const direction = this.enemyDirections.get(event.attackerId);
            if (!attacker || !direction) return this.#resolveEnemyFlight("invalid", this.#eligibleAttackers());
            const releaseChargeRatio = this.enemyChargePlan
                ? getChargeRatio(
                      this.enemyChargePlan.plannedEndAt - this.enemyChargePlan.startTime,
                      this.config.input.maxAimSeconds
                  )
                : 0;
            this.enemyChargePlan = this.enemyChargePlan
                ? { ...this.enemyChargePlan, naturalRatio: releaseChargeRatio, displayProgress: 1 }
                : null;
            const speed = getDragLaunchSpeed(attacker.stats.baseSpeed, releaseChargeRatio, this.config.shot);
            attacker.applyImpulse(new Vector2(direction.x, direction.y).scale(speed));
            this.enemySlowElapsed = 0;
        }
        this.#record({ ...copyValue(event), type: `enemy-${event.type}` });
    }

    #resolveEnemyCharacterCollision(context) {
        if (this.enemyQueue.state !== "flight") return null;
        const attacker = this.#fighterById(this.enemyQueue.attackerId);
        if (!attacker || (context.a !== attacker && context.b !== attacker)) return null;
        const other = context.a === attacker ? context.b : context.a;
        const targetId = this.enemyTargets.get(attacker.id);
        const playerHit = other === this.#player();
        const targetHit = other?.id === targetId;
        this.#resolveEnemyFlight("character", this.#eligibleAttackers(), { playerHit, targetHit });
        return { attacker };
    }

    #resolveEnemyFlight(reason, eligibleIds, { playerHit = false, targetHit = false } = {}) {
        const attackerId = this.enemyQueue.attackerId;
        this.enemyDirections.delete(attackerId);
        this.enemyTargets.delete(attackerId);
        this.enemySlowElapsed = 0;
        this.enemyChargePlan = null;
        this.enemyChargeElapsed = 0;
        const next = this.enemyQueue.resolveFlight(reason, eligibleIds);
        this.#record({ type: "enemy-flight-end", reason, attackerId, playerHit, targetHit });
        if (next) this.#handleEnemyEvent(next);
    }

    #resetEnemy() {
        this.enemyQueue.reset();
        this.enemyDirections.clear();
        this.enemyTargets.clear();
        this.enemySlowElapsed = 0;
        this.enemyChargePlan = null;
        this.enemyChargeElapsed = 0;
    }

    #targetForAttacker(attacker) {
        if (!attacker) return null;
        if (!this.automated) {
            const player = this.#player();
            return this.#isValidTarget(attacker, player) ? player : null;
        }
        const current = this.#fighterById(this.enemyTargets.get(attacker.id));
        if (this.#isValidTarget(attacker, current)) return current;
        const next = this.#findAutomatedTarget(attacker);
        if (next) this.enemyTargets.set(attacker.id, next.id);
        else this.enemyTargets.delete(attacker.id);
        return next;
    }

    #findAutomatedTarget(attacker) {
        if (!attacker) return null;
        const candidates = this.simulation.fighters.filter((fighter) => this.#isValidTarget(attacker, fighter));
        if (!candidates.length) return null;
        return candidates.reduce((nearest, fighter) => {
            const nearestDistance = Vector2.subtract(nearest.position, attacker.position).length();
            const fighterDistance = Vector2.subtract(fighter.position, attacker.position).length();
            return fighterDistance < nearestDistance ? fighter : nearest;
        });
    }

    #isValidTarget(attacker, target) {
        return Boolean(
            target &&
            this.simulation.isHostile(attacker, target) &&
            target.participation?.canBeTargeted !== false &&
            !target.flags.defeated &&
            !target.flags.destroyed &&
            !target.state.swallowed
        );
    }

    #player() {
        return this.simulation.playerBall;
    }

    #record(event) {
        this.eventSequence += 1;
        this.lastEvent = { ...copyValue(event), sequence: this.eventSequence };
        this.onEvent?.(this.getSnapshot());
    }

    #removeAimWarp() {
        if (this.aimCaster) this.simulation.removeTimeWarp(this.aimCaster);
        this.aimCaster = null;
    }
}
