import { Vector2 } from "../core.js";
import { TricksterSeedBurstEffect, TricksterSeedMarkEffect, VineSnareVisualEffect } from "../effects/index.js";
import { computeOwnerCombatSpeed } from "./heroAbility.js";
import { Ability } from "./ability.js";

const SEED_COUNT = 3;
const SPAWN_OFFSET = 20;
const SEED_SPEED_MIN_MULTIPLIER = 1.2;
const SEED_SPEED_MAX_MULTIPLIER = 1.5;
const SEED_LIFE = 14;
const MARK_DURATION = 1.8;
const FOLLOWUP_COLLISION_GRACE = 0.5;
const COMMAND_WINDOW_DURATION = 0.8;
const COMMAND_FAN_ANGLE = (24 * Math.PI) / 180;

export class TricksterAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, 5.5);
        this.state = {
            marks: new Map(),
            markEffects: new Map(),
            commandWindow: null,
            preparedCommand: null,
            commandCycles: new Map()
        };
    }

    update(delta, target) {
        this._updateMarks(delta);
        this.tickCooldown(delta);
        this._finalizeCommandCycles();
        if (!this.cooldownReady || !target || target.flags.defeated) {
            return;
        }

        if (this.state.commandWindow) {
            const aiming = this.simulation.dragCombat?.input?.state === "aiming";
            if (aiming) this.state.commandWindow.wasAiming = true;
            if (!aiming) this.state.commandWindow.remaining = Math.max(0, this.state.commandWindow.remaining - delta);
            if (aiming || this.state.commandWindow.remaining > 0) return;
            const window = this.state.commandWindow;
            this.state.commandWindow = null;
            this._launchAutomaticSeeds(window.target);
            return;
        }

        if (this._canAcceptPlayerCommand()) {
            this.state.commandWindow = { target, remaining: COMMAND_WINDOW_DURATION, wasAiming: false };
            return;
        }

        this._launchAutomaticSeeds(target);
    }

    _launchAutomaticSeeds() {
        this.resetCooldown(this.cooldown);
        const upgrade = this.getLevelUpgrade();
        const baseAngle = Math.random() * Math.PI * 2;
        for (const index of Array.from({ length: SEED_COUNT }, (_, value) => value)) {
            const angle = baseAngle + (Math.PI * 2 * index) / SEED_COUNT;
            this._spawnSeed(this.owner.position, Vector2.fromAngle(angle, 1), upgrade);
        }
        this.simulation.playSound("seed");
        this.simulation.addLog(`${this.owner.name} launches ${SEED_COUNT} dash seeds.`);
    }

    _spawnSeed(origin, direction, upgrade, options = {}) {
        const start = options.atContact
            ? origin.clone()
            : Vector2.add(origin, direction.clone().scale(this.owner.radius + SPAWN_OFFSET));
        const speedMultiplier =
            (SEED_SPEED_MIN_MULTIPLIER + Math.random() * (SEED_SPEED_MAX_MULTIPLIER - SEED_SPEED_MIN_MULTIPLIER)) *
            (upgrade.seedSpeedMultiplier ?? 1);
        return this.simulation.spawnSeedOrb(
            this.owner,
            start,
            direction.clone().scale(computeOwnerCombatSpeed(this.owner) * speedMultiplier),
            SEED_LIFE,
            {
                collisionGrace: options.collisionGrace ?? 0,
                commandSequence: options.commandSequence,
                tracksCommandCycle: options.tracksCommandCycle,
                onSettled: options.onSettled
            }
        );
    }

    _canAcceptPlayerCommand() {
        return Boolean(
            this.simulation.abilityCommandEnabled &&
            this.simulation.playerBall === this.owner &&
            this.simulation.dragCombat &&
            !this.simulation.dragCombat.automated &&
            this.simulation.commandResource?.canSpend?.()
        );
    }

    getCommandState() {
        if (!this._canAcceptPlayerCommand()) return { available: false, reserveResource: false };
        return { available: Boolean(this.state.commandWindow), reserveResource: !this.state.commandWindow };
    }

    prepareCommand(intent) {
        const window = this.state.commandWindow;
        if (!window || !this._canLaunchCommand(window.target)) return intent;
        this.state.preparedCommand = {
            ...intent,
            direction: { ...intent.direction },
            pathSegments: intent.pathSegments?.map((point) => ({ ...point })) ?? [],
            bouncePoints: intent.bouncePoints?.map((point) => ({ ...point })) ?? [],
            target: window.target
        };
        this.state.commandWindow = null;
        return this.state.preparedCommand;
    }

    resolveCommandLaunch(intent) {
        const command = this.state.preparedCommand;
        if (!command || command.sequence !== intent?.sequence || !this._canLaunchCommand(command.target)) {
            if (command?.sequence === intent?.sequence) this.state.preparedCommand = null;
            return { mode: "default-shot" };
        }
        const directions = this._getCommandDirections(command);
        if (!directions.length) return { mode: "default-shot" };
        this.resetCooldown(this.cooldown);
        const cycle = {
            commandSequence: command.sequence,
            tier: this.abilityTier,
            launched: 0,
            settledSeeds: 0,
            plannedSegments: command.pathSegments.length,
            plannedBounces: command.bouncePoints.length,
            enemySeedContacts: 0,
            ownerSeedTriggers: 0,
            seedBursts: 0,
            followupSeeds: 0,
            createdAt: command.createdAt ?? this.simulation.elapsed,
            finalized: false
        };
        this.state.commandCycles.set(command.sequence, cycle);
        const upgrade = this.getLevelUpgrade();
        for (const direction of directions) {
            cycle.launched += 1;
            this._spawnSeed(this.owner.position, direction, upgrade, {
                commandSequence: command.sequence,
                onSettled: () => {
                    cycle.settledSeeds += 1;
                }
            });
        }
        this.state.preparedCommand = null;
        this.simulation.playSound("seed");
        this.simulation.addLog(`${this.owner.name} launches a commanded seed route.`);
        return { mode: "payload-only" };
    }

    _canLaunchCommand(target) {
        return Boolean(
            target &&
            !target.flags.defeated &&
            this.cooldownReady &&
            this.simulation.abilityCommandEnabled &&
            this.simulation.playerBall === this.owner &&
            !this.simulation.dragCombat?.automated
        );
    }

    _getCommandDirections(intent) {
        const points = intent.pathSegments ?? [];
        const directions = [];
        let previous = this.owner.position;
        for (const point of points) {
            const direction = new Vector2(point.x - previous.x, point.y - previous.y);
            previous = point;
            if (direction.length() <= 0.001) continue;
            direction.normalize();
            if (!directions.some((candidate) => candidate.x * direction.x + candidate.y * direction.y > 0.999)) {
                directions.push(direction);
            }
            if (directions.length === SEED_COUNT) break;
        }
        if (!directions.length) {
            const direction = new Vector2(intent.direction?.x ?? 1, intent.direction?.y ?? 0);
            if (direction.length() <= 0.001) direction.x = 1;
            directions.push(direction.normalize());
        }
        if (directions.length === 1)
            return [-1, 0, 1].map((offset) => this._rotate(directions[0], offset * COMMAND_FAN_ANGLE));
        if (directions.length === 2) {
            const candidates = [-1, 1].map((offset) => this._rotate(directions[0], offset * COMMAND_FAN_ANGLE));
            return [
                ...directions,
                candidates.find(
                    (candidate) => !directions.some((base) => base.x * candidate.x + base.y * candidate.y > 0.999)
                )
            ];
        }
        return directions.slice(0, SEED_COUNT);
    }

    _rotate(direction, angle) {
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        return new Vector2(direction.x * cosine - direction.y * sine, direction.x * sine + direction.y * cosine);
    }

    onSeedContact(target, seed) {
        const cycle = this.state.commandCycles.get(seed.commandSequence);
        const hostileTarget = this.simulation.isHostile(this.owner, target);
        if (cycle) {
            if (hostileTarget) cycle.enemySeedContacts += 1;
            else if (target === this.owner) cycle.ownerSeedTriggers += 1;
        }
        if (!hostileTarget) return;
        const upgrade = this.getLevelUpgrade();
        if (upgrade.vineSnare) {
            target.applySlow(0.5, 0.8);
            const periodicEffect = this.simulation.createPeriodicDamageEffect({
                duration: 0.5,
                interval: 0.1,
                ticks: 5,
                damage: this.owner.stats.baseDamage * 0.1,
                source: this.owner,
                label: "Vine Snare",
                color: "#55d66b"
            });
            periodicEffect.renderInFighter = false;
            target.addPeriodicDamageEffect(periodicEffect);
            this.simulation.entities.push(new VineSnareVisualEffect(target, periodicEffect));
        }
        if (upgrade.seedMarkBurst) {
            this.state.marks.set(target, MARK_DURATION);
            const currentEffect = this.state.markEffects.get(target);
            if (currentEffect && !currentEffect.isExpired) {
                currentEffect.refresh();
            } else {
                const markEffect = new TricksterSeedMarkEffect(target, this.owner.color, MARK_DURATION);
                this.state.markEffects.set(target, markEffect);
                this.simulation.entities.push(markEffect);
            }
        }
    }

    onDashHit(target, effect, context = {}) {
        if (effect.collisionLabel !== "Seed Dash" || !this.state.marks.has(target)) return;
        const upgrade = this.getLevelUpgrade();
        if (!upgrade.seedMarkBurst) return;

        this.state.marks.delete(target);
        const markEffect = this.state.markEffects.get(target);
        if (markEffect) markEffect.isExpired = true;
        this.state.markEffects.delete(target);
        const contactPoint = context.contactPoint?.clone?.() ?? target.position.clone();
        target.takeDamage(this.owner.stats.baseDamage * 1.2, this.owner, "Seed Burst");
        this.simulation.entities.push(new TricksterSeedBurstEffect(contactPoint, this.owner.color));
        const cycle = this.state.commandCycles.get(effect.commandSequence);
        if (cycle) cycle.seedBursts += 1;

        if (upgrade.followupSeed) {
            const direction = Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
            this._spawnSeed(contactPoint, direction, upgrade, {
                atContact: true,
                collisionGrace: FOLLOWUP_COLLISION_GRACE,
                commandSequence: effect.commandSequence,
                tracksCommandCycle: false
            });
            if (cycle) cycle.followupSeeds += 1;
        }
    }

    _finalizeCommandCycles() {
        for (const [sequence, cycle] of this.state.commandCycles) {
            const activeSeed = this.simulation.entities.some(
                (entity) =>
                    entity.constructor?.name === "SeedOrb" &&
                    entity.commandSequence === sequence &&
                    entity.tracksCommandCycle &&
                    !entity.isExpired
            );
            const activeDash =
                this.owner.state.movement?.commandSequence === sequence && !this.owner.state.movement.expired;
            if (cycle.settledSeeds < cycle.launched || activeSeed || activeDash) continue;
            this._finalizeCommandCycle(sequence);
        }
    }

    _finalizeCommandCycle(sequence) {
        const cycle = this.state.commandCycles.get(sequence);
        if (!cycle || cycle.finalized) return;
        cycle.finalized = true;
        this.recordAbilityResult({
            commandSequence: sequence,
            resultType: "trickster-command-route",
            success:
                cycle.tier >= 2 ? cycle.seedBursts > 0 : cycle.enemySeedContacts > 0 || cycle.ownerSeedTriggers > 0,
            value: {
                tier: cycle.tier,
                launched: cycle.launched,
                plannedSegments: cycle.plannedSegments,
                plannedBounces: cycle.plannedBounces,
                enemySeedContacts: cycle.enemySeedContacts,
                ownerSeedTriggers: cycle.ownerSeedTriggers,
                seedBursts: cycle.seedBursts,
                followupSeeds: cycle.followupSeeds,
                elapsed: Math.max(0, this.simulation.elapsed - cycle.createdAt)
            }
        });
        this.state.commandCycles.delete(sequence);
    }

    onBattleEnded() {
        this.state.commandWindow = null;
        this.state.preparedCommand = null;
        for (const sequence of [...this.state.commandCycles.keys()]) this._finalizeCommandCycle(sequence);
    }

    _updateMarks(delta) {
        for (const [target, remaining] of this.state.marks) {
            const next = remaining - delta;
            if (next <= 0 || target.flags.defeated) {
                this.state.marks.delete(target);
                const markEffect = this.state.markEffects.get(target);
                if (markEffect) markEffect.isExpired = true;
                this.state.markEffects.delete(target);
            } else this.state.marks.set(target, next);
        }
    }

    draw() {}

    drawFace(ctx, rotation, ball) {
        this._dotEye(ctx, ball, -0.25, -0.08, 0.047);
        this._eye(ctx, ball, 0.25, -0.08, 0.07);
        this._arc(ctx, ball, -0.1, 0.18, 0.16, 0.15, Math.PI - 0.15);
        this._arc(ctx, ball, 0.18, 0.18, 0.16, 0.15, Math.PI - 0.15);
        return true;
    }

    getUiState() {
        return { label: "Seeds", progress: this.cooldownProgress };
    }
}
