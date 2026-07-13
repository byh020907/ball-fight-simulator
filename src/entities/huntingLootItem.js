import { CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { applyMagneticAttraction, getCombatMovementSpeed } from "../physics/magneticAttraction.js";

const DEFAULT_LIFE = 18;
const DEFAULT_MAGNET_RESPONSE_RATE = 5;
const DEFAULT_MAGNET_SPEED_MULTIPLIER = 1.35;

export class HuntingLootItem extends CombatEntity {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor({
        position,
        velocity,
        collectorId,
        radius = 14,
        life = DEFAULT_LIFE,
        magnetRadiusMultiplier = 4,
        magnetResponseRate = DEFAULT_MAGNET_RESPONSE_RATE,
        magnetSpeedMultiplier = DEFAULT_MAGNET_SPEED_MULTIPLIER,
        onCollected = null
    } = {}) {
        super(position?.clone?.() ?? new Vector2(), velocity?.clone?.() ?? new Vector2(), radius);
        this.collectorId = collectorId;
        this.life = Math.max(0.1, life);
        this.maxLife = this.life;
        this.mass = 0.4;
        this.magnetRadiusMultiplier = Math.max(1, magnetRadiusMultiplier);
        this.magnetResponseRate = Math.max(0, magnetResponseRate);
        this.magnetSpeedMultiplier = Math.max(0, magnetSpeedMultiplier);
        this.onCollected = onCollected;
        this.victoryCollectionRemaining = 0;
        this.victoryCollectionResponseRate = 0;
    }

    update(delta, simulation) {
        if (!this.tickLife(delta)) return;

        const collector = this._findCollector(simulation);
        const canCollect = collector && this.canCollect(collector, simulation);
        if (canCollect) {
            if (this.victoryCollectionRemaining > 0) {
                this._applyVictoryCollectionMagnet(collector, delta, simulation);
            } else {
                this._applyCollectorMagnet(collector, delta);
            }
        }

        this.integrate(delta);
        simulation.keepEntityInsideArena(this);

        if (canCollect) this._tryCollect(collector, simulation);
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
        if (distance > collector.radius + this.radius) return;

        const reward = this.collectReward(collector, simulation);
        if (!reward) return;

        this.onCollected?.(reward, this, collector, simulation);
        simulation.spawnPulse(this.position.clone(), reward.color);
        simulation.spawnActionText(this.position.clone(), reward.label, reward.color);
        simulation.playSound(reward.sound ?? "powerup", reward.soundIntensity ?? 0.8);
        if (reward.logMessage) simulation.addLog(reward.logMessage);
        this.isExpired = true;
    }
}
