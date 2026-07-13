import { applyCollisionImpulse, CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { applyMagneticAttraction, getCombatMovementSpeed } from "../physics/magneticAttraction.js";

const DEFAULT_LIFE = 18;
const DEFAULT_MAGNET_RESPONSE_RATE = 5;
const DEFAULT_MAGNET_SPEED_MULTIPLIER = 1.35;
const DEFAULT_MAGNET_GRACE_DURATION = 1;

export class HuntingLootItem extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor({
        position,
        velocity,
        collectorId,
        radius = 16,
        life = DEFAULT_LIFE,
        magnetRadiusMultiplier = 4,
        magnetResponseRate = DEFAULT_MAGNET_RESPONSE_RATE,
        magnetSpeedMultiplier = DEFAULT_MAGNET_SPEED_MULTIPLIER,
        magnetGraceDuration = DEFAULT_MAGNET_GRACE_DURATION,
        onCollected = null
    } = {}) {
        super(position?.clone?.() ?? new Vector2(), velocity?.clone?.() ?? new Vector2(), radius);
        this.collectorId = collectorId;
        this.life = Math.max(0.1, life);
        this.maxLife = this.life;
        this.mass = 2;
        this.magnetRadiusMultiplier = Math.max(1, magnetRadiusMultiplier);
        this.magnetResponseRate = Math.max(0, magnetResponseRate);
        this.magnetSpeedMultiplier = Math.max(0, magnetSpeedMultiplier);
        this.magnetGraceRemaining = Math.max(0, magnetGraceDuration);
        this.onCollected = onCollected;
        this.victoryCollectionRemaining = 0;
        this.victoryCollectionResponseRate = 0;
    }

    update(delta, simulation) {
        if (!this.tickLife(delta)) return;

        const collector = this._findCollector(simulation);
        const canCollect = collector && this.canCollect(collector, simulation);
        const isMagnetGraceActive = this._tickMagnetGrace(delta);
        if (canCollect) {
            if (this.victoryCollectionRemaining > 0) {
                this._applyVictoryCollectionMagnet(collector, delta, simulation);
            } else if (!isMagnetGraceActive) {
                this._applyCollectorMagnet(collector, delta);
            }
        }

        this.integrate(delta);
        simulation.keepEntityInsideArena(this, { resolveTerrain: true });

        const canCollectNow = canCollect && (this.victoryCollectionRemaining > 0 || !isMagnetGraceActive);
        if (canCollectNow && this._tryCollect(collector, simulation)) return;
        this._resolveFighterCollision(simulation, collector?.id);
        this.victoryCollectionRemaining = Math.max(0, this.victoryCollectionRemaining - delta);
    }

    canCollect() {
        return true;
    }

    collectReward() {
        return null;
    }

    draw(ctx) {
        ctx.save();
        this.drawItem(ctx);
        ctx.restore();
    }

    drawItem() {}

    beginVictoryCollection({ duration = 1, responseRate = 180 } = {}) {
        this.victoryCollectionRemaining = Math.max(this.victoryCollectionRemaining, duration);
        this.victoryCollectionResponseRate = Math.max(0, responseRate);
    }

    _findCollector(simulation) {
        return simulation.fighters.find(
            (fighter) => fighter.id === this.collectorId && !fighter.flags.defeated && !fighter.state.swallowed
        );
    }

    _applyCollectorMagnet(collector, delta) {
        applyMagneticAttraction(this, collector, delta, {
            radius: collector.radius * this.magnetRadiusMultiplier + this.radius,
            responseRate: this.magnetResponseRate,
            attractionSpeed: getCombatMovementSpeed(collector) * this.magnetSpeedMultiplier
        });
    }

    _tickMagnetGrace(delta) {
        if (this.magnetGraceRemaining <= 0) return false;
        this.magnetGraceRemaining = Math.max(0, this.magnetGraceRemaining - delta);
        return true;
    }

    _applyVictoryCollectionMagnet(collector, delta, simulation) {
        const toCollector = Vector2.subtract(collector.position, this.position);
        const remaining = Math.max(this.victoryCollectionRemaining, delta);
        const arenaRadius = Math.hypot(simulation.width, simulation.height) + collector.radius + this.radius;
        applyMagneticAttraction(this, collector, delta, {
            radius: arenaRadius,
            responseRate: this.victoryCollectionResponseRate,
            attractionSpeed: Math.max(
                getCombatMovementSpeed(collector) * this.magnetSpeedMultiplier,
                toCollector.length() / remaining
            )
        });
    }

    _tryCollect(collector, simulation) {
        const distance = Vector2.subtract(this.position, collector.position).length();
        if (distance > collector.radius + this.radius) return false;

        const reward = this.collectReward(collector, simulation);
        if (!reward) return false;

        this.onCollected?.(reward, this, collector, simulation);
        simulation.spawnLootCollection(this.position.clone(), reward.color, reward.label);
        simulation.playSound(reward.sound ?? "loot", reward.soundIntensity ?? 1);
        if (reward.logMessage) simulation.addLog(reward.logMessage);
        this.isExpired = true;
        return true;
    }

    _resolveFighterCollision(simulation, collectorId) {
        for (const fighter of simulation.fighters) {
            if (fighter.id === collectorId || fighter.flags.defeated || fighter.state.swallowed) continue;

            const difference = Vector2.subtract(this.position, fighter.position);
            const distance = difference.length();
            const overlap = this.radius + fighter.radius - distance;
            if (overlap <= 0) continue;

            const normal = distance > 0 ? difference.normalize() : new Vector2(1, 0);
            this.position.add(normal.clone().scale(overlap + 0.6));
            applyCollisionImpulse(this, fighter, normal, 0.4, { impactA: 0, minApproachSpeed: 60 });
            simulation.playSound("bounce", 0.3);
            return true;
        }
        return false;
    }
}
