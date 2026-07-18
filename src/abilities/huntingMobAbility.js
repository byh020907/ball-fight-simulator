import { steerBallToward, Vector2 } from "../core.js";
import { createEliteMobFormationConfig, getEliteFormationSteering } from "../hunting/eliteMobFormation.js";
import {
    advanceEliteFormationSortie,
    createEliteFormationSortieConfig,
    createEliteFormationSortieState,
    finishEliteFormationSortie
} from "../hunting/eliteMobFormationSortie.js";
import { ArrowProjectile } from "../entities/arrowProjectile.js";
import { drawElectricArc } from "../effects/electricArc.js";
import {
    circleIntersectsLaserSegment,
    drawLaserSegments,
    getArenaWallRay,
    traceArenaLaserSegments
} from "../effects/laserBeamEffect.js";
import {
    createLaserCasterVisualState,
    drawLaserCasterVisual,
    LASER_CASTER_PALETTE,
    LASER_CASTER_PHASES
} from "../effects/laserCasterVisual.js";
import { Ability } from "./ability.js";

const BARRIER_DURATION = 1.5;
const BARRIER_SWAP_EFFECT_DURATION = 0.36;
const ELECTRIC_CHANNEL_DURATION = 0.5;
const ELECTRIC_COOLDOWN_DURATION = 3;
const ELECTRIC_RANGE = 330;
const ELECTRIC_DAMAGE_PER_TICK = 8;
const ELECTRIC_COLOR = "#a8e6ff";
const ELECTRIC_TIMING_EPSILON = 1e-9;
const LINK_TIMING_EPSILON = 1e-9;
export const HUNTING_LINK_CHANNEL_CONFIG = Object.freeze({
    chain: Object.freeze({
        activeDuration: 0.5,
        cooldownDuration: 1,
        range: 290,
        color: "#e85d75"
    }),
    siphon: Object.freeze({
        activeDuration: 1,
        cooldownDuration: 2,
        range: 230,
        color: "#9f6bcb"
    })
});
export const LASER_CHARGE_TURN_RATE = 4;
const HUNTING_LASER_CHARGE_DURATION = 0.75;
const HUNTING_LASER_FIRE_DURATION = 0.55;
const HUNTING_LASER_CASTER_SCALE = 0.92;
const HUNTING_LASER_MATERIALIZE_PROGRESS = 0.18;

export const HUNTING_LASER_CASTER_RENDERER = drawLaserCasterVisual;
const SPLIT_FRAGMENT_CONFIG = Object.freeze({
    radiusMultiplier: 0.54,
    damageMultiplier: 0.65,
    speedMultiplier: 1.08,
    massMultiplier: 0.25,
    burstSpeed: 360
});
const BOOMERANG_CONFIG = Object.freeze({
    radius: 14,
    outboundSpeed: 720,
    returnSpeed: 820,
    maximumOutboundDistance: 680,
    wallPadding: 20,
    returnTurnRate: 5.4,
    rotationSpeed: 18
});
const JUMP_CONFIG = Object.freeze({
    duration: 0.55,
    dashDuration: 0.42,
    dashSpeed: 680,
    maximumRadiusScale: 1.34,
    apexStart: 0.35,
    apexEnd: 0.65
});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function easeOutCubic(progress) {
    return 1 - (1 - progress) ** 3;
}

function easeInCubic(progress) {
    return progress ** 3;
}

function getJumpHeightProgress(elapsed) {
    const progress = clamp(elapsed / JUMP_CONFIG.duration, 0, 1);
    if (progress < JUMP_CONFIG.apexStart) {
        return easeOutCubic(progress / JUMP_CONFIG.apexStart);
    }
    if (progress <= JUMP_CONFIG.apexEnd) return 1;
    return 1 - easeInCubic((progress - JUMP_CONFIG.apexEnd) / (1 - JUMP_CONFIG.apexEnd));
}

function normalizeAngle(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function getHuntingLaserCasterVisualState(owner, laser) {
    const chargeProgress = 1 - laser.charge / HUNTING_LASER_CHARGE_DURATION;
    const fireProgress = laser.fire / HUNTING_LASER_FIRE_DURATION;
    const isCharging = laser.charge > 0;
    return createLaserCasterVisualState({
        origin: owner.position,
        angle: laser.angle,
        phase: isCharging
            ? chargeProgress < HUNTING_LASER_MATERIALIZE_PROGRESS
                ? LASER_CASTER_PHASES.MATERIALIZE
                : LASER_CASTER_PHASES.CHARGE
            : LASER_CASTER_PHASES.FIRE,
        phaseProgress: isCharging ? chargeProgress : fireProgress,
        scale: HUNTING_LASER_CASTER_SCALE,
        palette: LASER_CASTER_PALETTE,
        aimLength: laser.aimLength ?? 140
    });
}

const BEHAVIOR_CONFIG = Object.freeze({
    pursuer: { cooldown: 0, face: "angry" },
    charger: { cooldown: 3.2, face: "dash" },
    shooter: { cooldown: 2.2, face: "cyclops" },
    electric: { cooldown: 0, face: "ooo" },
    healer: { cooldown: 0, face: "happy" },
    chain: { cooldown: 0, face: "angry" },
    shockwave: { cooldown: 3.4, face: "ooo", range: 190 },
    barrier: { cooldown: 4, face: "default" },
    siphon: { cooldown: 0, face: "xeye" },
    shard: { cooldown: 3, face: "cyclops" },
    boomerang: { cooldown: 3.1, face: "happy" },
    splitter: { cooldown: 0, face: "ooo" },
    jumper: { cooldown: 3.3, face: "dash" },
    laser: { cooldown: 4.2, face: "cyclops" }
});

export { getArenaWallRay };

export class HuntingMobAbility extends Ability {
    constructor(owner, simulation) {
        const behavior = owner.hunting?.behavior ?? "pursuer";
        super(owner, simulation, BEHAVIOR_CONFIG[behavior]?.cooldown ?? 0);
        this.behavior = behavior;
        this.formationConfig = createEliteMobFormationConfig(owner.hunting?.eliteFormationConfig);
        this.formationSortieConfig = createEliteFormationSortieConfig(owner.hunting?.eliteFormationSortieConfig);
        this.state = {
            timer: 0,
            link: null,
            linkTime: 0,
            ring: 0,
            barrier: 0,
            barrierSwapTarget: null,
            barrierSwapTargetIds: new Set(),
            barrierSwapTime: 0,
            laser: null,
            boomerang: null,
            electric: { channelRemaining: 0, cooldownRemaining: 0 },
            linkChannel: { activeRemaining: 0, cooldownRemaining: 0 },
            jump: 0,
            repositionCooldown: 0,
            formationSortie: createEliteFormationSortieState(this.formationSortieConfig)
        };
    }

    update(delta, target) {
        this._clearInvalidConnectionTargets();
        if (!this._isActiveConnectionTarget(target)) {
            if (this.behavior === "boomerang" && this.state.boomerang) this._tickBoomerang(delta, null);
            return;
        }
        this.state.timer += delta;
        this.state.linkTime += delta;
        this.state.ring = Math.max(0, this.state.ring - delta);
        this.state.barrier = Math.max(0, this.state.barrier - delta);
        this.state.barrierSwapTime = Math.max(0, this.state.barrierSwapTime - delta);
        if (this.state.barrierSwapTime <= 0) this.state.barrierSwapTarget = null;
        this.state.jump = Math.max(0, this.state.jump - delta);
        this.state.repositionCooldown = Math.max(0, this.state.repositionCooldown - delta);
        const formationSteering = this._getEliteFormationSteering(delta, target);
        this._steer(delta, formationSteering?.target ?? target, Boolean(formationSteering?.isFormationTarget));
        this._tickProximityReposition(target);
        this._tickNaturalHeal(delta);
        this._tickBehavior(delta, target);
    }

    _getEliteFormationSteering(delta, target) {
        if (!this.owner.hunting?.eliteFormation || this.owner.state.movement || this.owner.state.swallowed) return null;
        const formationSteering = getEliteFormationSteering(
            this.owner,
            target,
            this.simulation.getAlliesOf(this.owner),
            this.simulation.width,
            this.simulation.height,
            this.formationConfig
        );
        if (!formationSteering) return null;
        if (this._shouldContinueFormationSortie(delta, formationSteering.target)) {
            return { target, isFormationTarget: false };
        }
        this.owner.applyImpulse(formationSteering.impulse.scale(delta * this.formationConfig.referenceFramesPerSecond));
        return { target: { position: formationSteering.target }, isFormationTarget: true };
    }

    _shouldContinueFormationSortie(delta, formationTarget) {
        const transition = advanceEliteFormationSortie(
            this.state.formationSortie,
            {
                behavior: this.behavior,
                delta,
                slotDistance: Vector2.subtract(formationTarget, this.owner.position).length()
            },
            this.formationSortieConfig
        );
        this.state.formationSortie = transition.state;
        return transition.shouldAttack;
    }

    _finishFormationSortie() {
        this.state.formationSortie = finishEliteFormationSortie(this.state.formationSortie);
    }

    _steer(delta, target, isFormationTarget = false) {
        if (this.behavior === "healer" && !isFormationTarget) return;
        if (this.owner.state.movement || this.owner.state.swallowed) return;
        steerBallToward(this.owner, target, delta, {
            turnRate: this.behavior === "shooter" ? 3.2 : 7.4,
            persist: true
        });
    }

    _tickNaturalHeal(delta) {
        if (this.behavior === "healer") this.owner.heal((this.owner.maxHp / 20) * delta);
    }

    _tickProximityReposition(target) {
        const config = this.owner.hunting?.reposition;
        if (!config || this.state.repositionCooldown > 0 || this._hasRepositionBlocker()) return false;
        const directionToTarget = this._directionTo(target);
        if (!directionToTarget) return false;
        const distance = Vector2.subtract(target.position, this.owner.position).length();
        const triggerDistance = this.owner.radius + target.radius + config.proximityGap;
        if (distance > triggerDistance) return false;

        const direction = this._getAdaptiveRepositionDirection(directionToTarget, config);
        this.owner.applyImpulse(direction.scale(config.impulse));
        this.state.repositionCooldown = config.cooldown;
        this.simulation.spawnPulse(this.owner.position.clone(), this.owner.color);
        return true;
    }

    _hasRepositionBlocker() {
        return Boolean(this.owner.state.movement || this.owner.state.swallowed || this.state.laser || this.state.link);
    }

    _getAdaptiveRepositionDirection(directionToTarget, config) {
        const positiveSide = new Vector2(-directionToTarget.y, directionToTarget.x);
        const negativeSide = positiveSide.clone().scale(-1);
        const allies = this.simulation.fighters.filter(
            (fighter) =>
                fighter !== this.owner &&
                !fighter.flags.defeated &&
                !fighter.flags.destroyed &&
                !fighter.state.swallowed &&
                !this.simulation.isHostile(this.owner, fighter) &&
                Vector2.subtract(fighter.position, this.owner.position).length() <=
                    config.allyAwareness + this.owner.radius + fighter.radius
        );
        const hasPositiveSideAlly = allies.some(
            (ally) => Vector2.subtract(ally.position, this.owner.position).dot(positiveSide) > 0.001
        );
        const hasNegativeSideAlly = allies.some(
            (ally) => Vector2.subtract(ally.position, this.owner.position).dot(negativeSide) > 0.001
        );
        if (hasPositiveSideAlly && !hasNegativeSideAlly) return negativeSide;
        if (hasNegativeSideAlly && !hasPositiveSideAlly) return positiveSide;
        return directionToTarget.scale(-1);
    }

    _tickBehavior(delta, target) {
        if (this.behavior === "electric") return this._tickElectric(delta, target);
        if (this.behavior === "healer") return this._tickHeal(delta);
        if (this.behavior === "chain") return this._tickChain(delta, target);
        if (this.behavior === "siphon") return this._tickSiphon(delta, target);
        if (this.behavior === "laser") return this._tickLaser(delta, target);
        if (this.behavior === "boomerang") return this._tickBoomerang(delta, target);
        if (this.behavior === "splitter") return;
        if (this.state.timer < this.cooldown) return;
        const behaviorRange = BEHAVIOR_CONFIG[this.behavior]?.range;
        if (behaviorRange && Vector2.subtract(target.position, this.owner.position).length() > behaviorRange) return;
        this.state.timer = 0;
        if (this.behavior === "charger") this._charge(target);
        else if (this.behavior === "shooter") this._shoot(target);
        else if (this.behavior === "shockwave") this._shockwave();
        else if (this.behavior === "barrier") this._activateBarrier();
        else if (this.behavior === "shard") this._shardVolley(target);
        else if (this.behavior === "jumper") this._jump(target);
    }

    _tickElectric(delta, target) {
        const electric = this.state.electric;
        if (electric.cooldownRemaining > ELECTRIC_TIMING_EPSILON) {
            electric.cooldownRemaining = Math.max(0, electric.cooldownRemaining - delta);
            this.state.link = null;
            if (electric.cooldownRemaining > ELECTRIC_TIMING_EPSILON) return;
            electric.cooldownRemaining = 0;
        }

        const distance = Vector2.subtract(target.position, this.owner.position).length();
        if (distance > ELECTRIC_RANGE) {
            this.state.link = null;
            if (electric.channelRemaining > 0) this._startElectricCooldown();
            return;
        }

        if (electric.channelRemaining <= ELECTRIC_TIMING_EPSILON) electric.channelRemaining = ELECTRIC_CHANNEL_DURATION;
        const channelDelta = Math.min(delta, electric.channelRemaining);
        this.state.link = { target, color: ELECTRIC_COLOR, style: "electric" };
        target.takeDamage(ELECTRIC_DAMAGE_PER_TICK * channelDelta, this.owner, "Electric Arc");
        electric.channelRemaining = Math.max(0, electric.channelRemaining - channelDelta);

        if (electric.channelRemaining <= ELECTRIC_TIMING_EPSILON) this._startElectricCooldown(delta - channelDelta);
    }

    _startElectricCooldown(elapsed = 0) {
        this.state.electric.channelRemaining = 0;
        this.state.electric.cooldownRemaining = Math.max(0, ELECTRIC_COOLDOWN_DURATION - elapsed);
        this.state.link = null;
    }

    _tickHeal(delta) {
        const ally = this.simulation.fighters.find(
            (fighter) =>
                fighter !== this.owner &&
                this._isActiveConnectionTarget(fighter) &&
                !this.simulation.isHostile(this.owner, fighter) &&
                Vector2.subtract(fighter.position, this.owner.position).length() <= 260 &&
                fighter.hp < fighter.maxHp
        );
        this.state.link = ally ? { target: ally, color: "#75f0a0" } : null;
        if (!ally || this.owner.hp <= 1) return;
        const cost = Math.min(this.owner.hp - 1, 100 * delta);
        this.owner.hp -= cost;
        ally.heal(cost * 3);
    }

    _tickChain(delta, target) {
        const activeDelta = this._tickLinkChannel(delta, target, HUNTING_LINK_CHANNEL_CONFIG.chain);
        if (activeDelta <= 0) return;
        const direction = this._directionTo(target);
        if (!direction) return;
        target.applyKnockback(direction.scale(-58 * activeDelta), 0.08);
    }

    _tickSiphon(delta, target) {
        const activeDelta = this._tickLinkChannel(delta, target, HUNTING_LINK_CHANNEL_CONFIG.siphon);
        if (activeDelta <= 0) return;
        const before = target.hp;
        target.takeDamage(7 * activeDelta, this.owner, "Siphon");
        this.owner.heal((before - target.hp) * 0.8);
    }

    _tickLinkChannel(delta, target, config) {
        const channel = this.state.linkChannel;
        let remainingDelta = delta;
        if (channel.cooldownRemaining > LINK_TIMING_EPSILON) {
            const cooldownDelta = Math.min(remainingDelta, channel.cooldownRemaining);
            channel.cooldownRemaining = Math.max(0, channel.cooldownRemaining - cooldownDelta);
            remainingDelta -= cooldownDelta;
            this.state.link = null;
            if (channel.cooldownRemaining > LINK_TIMING_EPSILON || remainingDelta <= LINK_TIMING_EPSILON) return 0;
            channel.cooldownRemaining = 0;
        }

        const distance = Vector2.subtract(target.position, this.owner.position).length();
        if (distance > config.range) {
            this.state.link = null;
            if (channel.activeRemaining > LINK_TIMING_EPSILON) this._startLinkCooldown(config);
            return 0;
        }

        if (channel.activeRemaining <= LINK_TIMING_EPSILON) channel.activeRemaining = config.activeDuration;
        const activeDelta = Math.min(remainingDelta, channel.activeRemaining);
        this.state.link = { target, color: config.color };
        channel.activeRemaining = Math.max(0, channel.activeRemaining - activeDelta);

        if (channel.activeRemaining <= LINK_TIMING_EPSILON)
            this._startLinkCooldown(config, remainingDelta - activeDelta);
        return activeDelta;
    }

    _startLinkCooldown(config, elapsed = 0) {
        this.state.linkChannel.activeRemaining = 0;
        this.state.linkChannel.cooldownRemaining = Math.max(0, config.cooldownDuration - elapsed);
        this.state.link = null;
    }

    _charge(target) {
        const direction = this._directionTo(target);
        if (!direction) return;
        this.owner.initiateDash(direction, {
            speedOverride: 560,
            duration: 0.52,
            color: "#ff8a65",
            collisionDamage: 1.2
        });
        this.simulation.spawnPulse(this.owner.position.clone(), "#ff8a65");
    }

    _shoot(target) {
        const direction = this._directionTo(target);
        if (!direction) return;
        const velocity = direction.scale(470);
        this.simulation.entities.push(new ArrowProjectile(this.owner, this.owner.position.clone(), velocity));
    }

    _shockwave() {
        this.state.ring = 0.75;
        for (const target of this.simulation.getEnemiesOf(this.owner)) {
            const delta = Vector2.subtract(target.position, this.owner.position);
            if (delta.length() > 190) continue;
            target.takeDamage(this.owner.stats.baseDamage * 0.8, this.owner, "Shockwave");
            target.applyKnockback(delta.normalize().scale(280), 0.16);
        }
    }

    _activateBarrier() {
        this.state.barrier = BARRIER_DURATION;
        this.state.barrierSwapTargetIds.clear();
    }

    onFighterCollisionDamageResolved(target) {
        if (!this.simulation.isHostile(this.owner, target)) return;
        this._finishFormationSortie();
    }

    onAllyCollision(ally, context) {
        if (
            this.behavior !== "barrier" ||
            this.state.barrier <= 0 ||
            context?.allyPositionSwapped ||
            ally.flags.defeated ||
            this.simulation.isHostile(this.owner, ally) ||
            ally.hunting?.behavior === "barrier" ||
            this.state.barrierSwapTargetIds.has(ally.id)
        ) {
            return;
        }

        const target = this.simulation.getOpponent(this.owner);
        if (!target || target.flags.defeated) return;

        const ownDistance = Vector2.subtract(target.position, this.owner.position).length();
        const allyDistance = Vector2.subtract(target.position, ally.position).length();
        if (allyDistance >= ownDistance) return;

        this.owner.swapPositionWith(ally);
        this.state.barrierSwapTarget = ally;
        this.state.barrierSwapTargetIds.add(ally.id);
        this.state.barrierSwapTime = BARRIER_SWAP_EFFECT_DURATION;
        this.simulation.spawnPulse(this.owner.position.clone(), "#67c8ff");
        this.simulation.spawnPulse(ally.position.clone(), "#67c8ff");
        this.simulation.playSound("guard");
        if (context) context.allyPositionSwapped = true;
    }

    _shardVolley(target) {
        const direction = this._directionTo(target);
        if (!direction) return;
        [-0.28, 0, 0.28].forEach((offset) => {
            const angle = Math.atan2(direction.y, direction.x) + offset;
            this.simulation.entities.push(
                new ArrowProjectile(this.owner, this.owner.position.clone(), Vector2.fromAngle(angle, 410))
            );
        });
    }

    onOwnerDefeated({ source } = {}) {
        const splitLevel = this.owner.hunting?.splitLevel ?? 0;
        const splitCount = this.owner.hunting?.splitCount ?? 0;
        if (splitLevel <= 0 || splitCount <= 0) return false;

        const fragments = this._createSplitFragments({
            baseAngle: this._getSplitBaseAngle(source),
            splitLevel: splitLevel - 1,
            splitCount
        });
        const spawned = this.simulation.replaceFighter(this.owner, fragments);
        if (!spawned.length) return false;

        spawned.forEach((fragment, index) => {
            const angle = fragments[index].launchAngle;
            const launchVelocity = Vector2.add(
                this.owner.velocity,
                Vector2.fromAngle(angle, SPLIT_FRAGMENT_CONFIG.burstSpeed)
            );
            fragment.applyImpulse(launchVelocity.subtract(fragment.velocity).scale(fragment.mass));
            this.simulation.spawnPulse(fragment.position.clone(), this.owner.color);
        });
        this.simulation.playSound("crash");
        return true;
    }

    _getSplitBaseAngle(source) {
        if (source && !source.flags?.defeated) {
            const direction = Vector2.subtract(source.position, this.owner.position);
            if (direction.length() > 0.001) return Math.atan2(direction.y, direction.x);
        }
        if (this.owner.velocity.length() > 0.001) return Math.atan2(this.owner.velocity.y, this.owner.velocity.x);
        return this.owner.appearance.angle;
    }

    _createSplitFragments({ baseAngle, splitLevel, splitCount }) {
        const fragmentCount = Math.max(1, Math.floor(splitCount));
        const maxHpShares = this._splitIntegerValue(this.owner.maxHp, fragmentCount);
        return Array.from({ length: fragmentCount }, (_, index) => {
            const angle = baseAngle + (index / fragmentCount) * Math.PI * 2;
            const fragmentRadius = this._getSplitFragmentRadius();
            const position = Vector2.add(
                this.owner.position,
                Vector2.fromAngle(angle, this.owner.radius + fragmentRadius + 2)
            );
            position.x = clamp(position.x, fragmentRadius, this.simulation.width - fragmentRadius);
            position.y = clamp(position.y, fragmentRadius, this.simulation.height - fragmentRadius);
            return {
                position,
                launchAngle: angle,
                spec: this._createSplitFragmentSpec({
                    index,
                    maxHp: maxHpShares[index],
                    hp: maxHpShares[index],
                    angle,
                    splitLevel,
                    splitCount
                })
            };
        });
    }

    _splitIntegerValue(value, count) {
        const total = Math.max(0, Math.round(value));
        const base = Math.floor(total / count);
        return Array.from({ length: count }, (_, index) => base + (index < total % count ? 1 : 0));
    }

    _createSplitFragmentSpec({ index, maxHp, hp, angle, splitLevel, splitCount }) {
        const stats = this.owner.stats;
        const fragmentRadius = this._getSplitFragmentRadius();
        const splitOriginName = this.owner.hunting?.splitOriginName ?? this.owner.name;
        const carriesLoot = !this.owner.hunting?.suppressLootDrop && index === 0;
        return {
            id: `${this.owner.id}-fragment-${index + 1}`,
            name: `${splitOriginName} 파편`,
            title: `${splitOriginName} 파편`,
            description: "분열 볼에서 갈라진 작은 파편입니다.",
            color: this.owner.color,
            face: this.owner.face,
            ability: "hunting_mob",
            teamId: this.owner.teamId,
            initialHp: hp,
            stats: {
                hp: Math.max(1, maxHp),
                damage: Math.max(1, Math.round(stats.baseDamage * SPLIT_FRAGMENT_CONFIG.damageMultiplier)),
                speed: Math.round(stats.baseSpeed * SPLIT_FRAGMENT_CONFIG.speedMultiplier),
                radius: fragmentRadius,
                mass: Math.max(0.1, stats.mass * SPLIT_FRAGMENT_CONFIG.massMultiplier),
                defense: stats.baseDefense,
                skill: stats.baseSkill
            },
            appearance: {
                sides: this.owner.appearance.sides,
                face: this.owner.face,
                angle,
                angularVelocity: this.owner.angularVelocity
            },
            hunting: {
                ...(this.owner.hunting ?? {}),
                monsterType: "splitter_fragment",
                behavior: "pursuer",
                isSplitFragment: true,
                splitLevel,
                splitCount,
                splitOriginName,
                suppressLootDrop: !carriesLoot
            }
        };
    }

    _getSplitFragmentRadius() {
        return Math.max(12, Math.round(this.owner.stats.baseRadius * SPLIT_FRAGMENT_CONFIG.radiusMultiplier));
    }

    _jump(target) {
        this.state.jump = JUMP_CONFIG.duration;
        const direction = this._directionTo(target);
        if (!direction) return;
        this.owner.initiateDash(direction, {
            speedOverride: JUMP_CONFIG.dashSpeed,
            duration: JUMP_CONFIG.dashDuration,
            color: "#ffd166",
            collisionDamage: 1.1
        });
    }

    _tickLaser(delta, target) {
        if (!this.state.laser) {
            if (this.state.timer < this.cooldown) return;
            this.state.timer = 0;
            this.state.laser = {
                angle: Math.atan2(target.position.y - this.owner.position.y, target.position.x - this.owner.position.x),
                charge: HUNTING_LASER_CHARGE_DURATION,
                fire: 0,
                aimLength: Vector2.subtract(target.position, this.owner.position).length()
            };
        }
        const laser = this.state.laser;
        if (laser.charge > 0) {
            this._trackLaserCharge(laser, target, delta);
            laser.aimLength = Vector2.subtract(target.position, this.owner.position).length();
            laser.charge -= delta;
        }
        if (laser.charge <= 0) {
            laser.fire += delta;
            const segments = traceArenaLaserSegments(
                this.owner.position,
                laser.angle,
                this.simulation.width,
                this.simulation.height,
                0
            );
            for (const enemy of this.simulation.getEnemiesOf(this.owner)) {
                if (segments.some((segment) => circleIntersectsLaserSegment(enemy, segment))) {
                    enemy.takeDamage(20 * delta, this.owner, "Laser Beam");
                }
            }
        }
        if (laser.fire >= HUNTING_LASER_FIRE_DURATION) this.state.laser = null;
    }

    _trackLaserCharge(laser, target, delta) {
        const targetAngle = Math.atan2(
            target.position.y - this.owner.position.y,
            target.position.x - this.owner.position.x
        );
        const angleDifference = normalizeAngle(targetAngle - laser.angle);
        const maximumTurn = LASER_CHARGE_TURN_RATE * delta;
        laser.angle = normalizeAngle(laser.angle + clamp(angleDifference, -maximumTurn, maximumTurn));
    }

    _tickBoomerang(delta, target) {
        if (!this.state.boomerang && this.state.timer >= this.cooldown && target) {
            this.state.timer = 0;
            this.state.boomerang = this._createBoomerang(target);
        }
        const boom = this.state.boomerang;
        if (!boom) return;

        if (boom.phase === "outbound") {
            this._advanceBoomerangOutbound(boom, delta, target);
        } else {
            this._advanceBoomerangReturn(boom, delta, target);
        }
    }

    _createBoomerang(target) {
        const launchDirection = Vector2.subtract(target.position, this.owner.position);
        if (launchDirection.length() <= 0.001) return null;
        launchDirection.normalize();
        const launchAngle = Math.atan2(launchDirection.y, launchDirection.x);
        const outboundLimit = this._getBoomerangOutboundLimit(launchAngle);
        if (outboundLimit <= 0) return null;

        return {
            position: this.owner.position.clone(),
            velocity: launchDirection.clone().scale(BOOMERANG_CONFIG.outboundSpeed),
            launchDirection,
            launchPosition: this.owner.position.clone(),
            headingAngle: launchAngle,
            phase: "outbound",
            outboundDistance: 0,
            travelDistance: 0,
            outboundLimit,
            hit: false,
            rotationAngle: launchAngle,
            rotationDirection: this._getBoomerangRotationDirection(launchDirection),
            elapsed: 0
        };
    }

    _getBoomerangOutboundLimit(launchAngle) {
        const wallRay = getArenaWallRay(
            this.owner.position,
            launchAngle,
            this.simulation.width,
            this.simulation.height
        );
        return Math.max(
            0,
            Math.min(BOOMERANG_CONFIG.maximumOutboundDistance, wallRay.length - BOOMERANG_CONFIG.wallPadding)
        );
    }

    _getBoomerangRotationDirection(launchDirection) {
        const leftNormal = new Vector2(-launchDirection.y, launchDirection.x);
        const towardArenaCenter = new Vector2(
            this.simulation.width / 2 - this.owner.position.x,
            this.simulation.height / 2 - this.owner.position.y
        );
        return Math.sign(leftNormal.dot(towardArenaCenter)) || 1;
    }

    _advanceBoomerangOutbound(boom, delta, target) {
        const availableDistance = Math.max(0, boom.outboundLimit - boom.outboundDistance);
        const movedDistance = this._moveBoomerang(boom, BOOMERANG_CONFIG.outboundSpeed, delta, availableDistance);
        boom.outboundDistance += movedDistance;

        if (this._tryBoomerangHit(boom, target) || boom.outboundDistance >= boom.outboundLimit) {
            this._startBoomerangReturn(boom);
        }
    }

    _advanceBoomerangReturn(boom, delta, target) {
        if (this._hasBoomerangReachedOwner(boom)) {
            this.state.boomerang = null;
            return;
        }

        const desiredDirection = Vector2.subtract(this.owner.position, boom.position);
        if (desiredDirection.length() <= 0.001) {
            this.state.boomerang = null;
            return;
        }
        const desiredAngle = Math.atan2(desiredDirection.y, desiredDirection.x);
        boom.headingAngle = this._rotateBoomerangToward(boom, desiredAngle, delta);
        this._moveBoomerang(boom, BOOMERANG_CONFIG.returnSpeed, delta);
        this._tryBoomerangHit(boom, target);

        if (this._hasBoomerangReachedOwner(boom)) this.state.boomerang = null;
    }

    _rotateBoomerangToward(boom, desiredAngle, delta) {
        let angleDifference = normalizeAngle(desiredAngle - boom.headingAngle);
        if (Math.abs(Math.abs(angleDifference) - Math.PI) < 0.001) {
            angleDifference = Math.PI * boom.rotationDirection;
        }
        const maximumTurn = BOOMERANG_CONFIG.returnTurnRate * delta;
        if (Math.abs(angleDifference) <= maximumTurn) return desiredAngle;
        return boom.headingAngle + Math.sign(angleDifference) * maximumTurn;
    }

    _moveBoomerang(boom, speed, delta, maximumDistance = Infinity) {
        const movedDistance = Math.min(speed * delta, maximumDistance);
        boom.velocity = Vector2.fromAngle(boom.headingAngle, speed);
        boom.position.add(boom.velocity.clone().scale(movedDistance / speed));
        boom.travelDistance += movedDistance;
        boom.elapsed += delta;
        boom.rotationAngle = normalizeAngle(
            boom.rotationAngle + boom.rotationDirection * BOOMERANG_CONFIG.rotationSpeed * delta
        );
        this._keepBoomerangInsideArena(boom);
        return movedDistance;
    }

    _keepBoomerangInsideArena(boom) {
        boom.position.x = clamp(
            boom.position.x,
            BOOMERANG_CONFIG.radius,
            this.simulation.width - BOOMERANG_CONFIG.radius
        );
        boom.position.y = clamp(
            boom.position.y,
            BOOMERANG_CONFIG.radius,
            this.simulation.height - BOOMERANG_CONFIG.radius
        );
    }

    _tryBoomerangHit(boom, target) {
        if (boom.hit || !this._isActiveConnectionTarget(target)) return false;
        if (Vector2.subtract(target.position, boom.position).length() >= target.radius + BOOMERANG_CONFIG.radius)
            return false;
        target.takeDamage(this.owner.stats.baseDamage * 1.1, this.owner, "Boomerang");
        boom.hit = true;
        this._startBoomerangReturn(boom);
        return true;
    }

    _startBoomerangReturn(boom) {
        boom.phase = "return";
    }

    _hasBoomerangReachedOwner(boom) {
        return (
            Vector2.subtract(this.owner.position, boom.position).length() < this.owner.radius + BOOMERANG_CONFIG.radius
        );
    }

    isJumping() {
        return this.behavior === "jumper" && this.state.jump > 0;
    }

    getRadiusScale() {
        if (!this.isJumping()) return 1;
        const elapsed = JUMP_CONFIG.duration - this.state.jump;
        const heightProgress = getJumpHeightProgress(elapsed);
        return 1 + heightProgress * (JUMP_CONFIG.maximumRadiusScale - 1);
    }

    getStatModifiers() {
        return { speed: 1, damage: 1, defense: this.state.barrier > 0 ? 1.6 : 1, impact: 1 };
    }

    _isActiveConnectionTarget(target) {
        return Boolean(target && !target.flags.defeated && !target.flags.destroyed && !target.state.swallowed);
    }

    _clearInvalidConnectionTargets() {
        if (this.state.link && !this._isActiveConnectionTarget(this.state.link.target)) this.state.link = null;
        if (this.state.barrierSwapTarget && !this._isActiveConnectionTarget(this.state.barrierSwapTarget)) {
            this.state.barrierSwapTarget = null;
            this.state.barrierSwapTime = 0;
        }
    }

    _getActiveLink() {
        return this.state.link && this._isActiveConnectionTarget(this.state.link.target) ? this.state.link : null;
    }

    _getActiveBarrierSwapTarget() {
        return this._isActiveConnectionTarget(this.state.barrierSwapTarget) ? this.state.barrierSwapTarget : null;
    }

    draw(ctx) {
        const { position, radius } = this.owner;
        const link = this._getActiveLink();
        const barrierSwapTarget = this._getActiveBarrierSwapTarget();
        ctx.save();
        if (link) this._drawActiveLink(ctx, position, link);
        if (barrierSwapTarget) this._drawBarrierSwap(ctx, position, barrierSwapTarget.position);
        if (this.state.ring > 0) {
            ctx.strokeStyle = "#ffd166";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(position.x, position.y, radius + (1 - this.state.ring / 0.75) * 180, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (this.state.barrier > 0) {
            ctx.strokeStyle = "#67c8ff";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(position.x, position.y, radius + 12, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (this.state.laser) this._drawLaser(ctx, this.state.laser);
        if (this.state.boomerang) this._drawBoomerang(ctx, this.state.boomerang);
        ctx.restore();
    }

    _drawBoomerang(ctx, boom) {
        ctx.save();
        ctx.translate(boom.position.x, boom.position.y);
        ctx.rotate(boom.rotationAngle);
        ctx.fillStyle = boom.phase === "return" ? "#ffd36e" : "#f7b955";
        ctx.strokeStyle = "#7a3e1d";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.quadraticCurveTo(-8, -12, 4, -9);
        ctx.lineTo(14, 0);
        ctx.lineTo(4, 9);
        ctx.quadraticCurveTo(-8, 12, -14, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff4c9";
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _drawActiveLink(ctx, from, link) {
        const to = link.target.position;
        if (link.style === "electric") {
            this._drawElectricLink(ctx, from, to, link.color);
            return;
        }
        this._drawLink(ctx, from, to, link.color);
    }

    _drawElectricLink(ctx, from, to, color) {
        drawElectricArc(ctx, from, to, { time: this.state.linkTime, color });
    }

    _drawLink(ctx, from, to, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    }

    _drawLaser(ctx, laser) {
        HUNTING_LASER_CASTER_RENDERER(ctx, getHuntingLaserCasterVisualState(this.owner, laser));
        if (laser.charge > 0) return;
        const segments = traceArenaLaserSegments(
            this.owner.position,
            laser.angle,
            this.simulation.width,
            this.simulation.height,
            0
        );
        drawLaserSegments(ctx, segments, {
            alpha: 1,
            color: "#ff5656"
        });
    }

    _drawBarrierSwap(ctx, from, to) {
        const alpha = this.state.barrierSwapTime / BARRIER_SWAP_EFFECT_DURATION;
        ctx.strokeStyle = `rgba(103, 200, 255, ${Math.max(0, alpha)})`;
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    _directionTo(target) {
        const offset = Vector2.subtract(target.position, this.owner.position);
        return offset.length() <= 0.001 ? null : offset.normalize();
    }
}
