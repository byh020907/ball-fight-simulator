import { Vector2 } from "../../core.js";
import {
    drawEnergyShieldField,
    ENERGY_SHIELD_VISUAL_CONFIG,
    EnergyShieldHitEffect
} from "../../effects/energyShieldEffects.js";

export const EnergyShieldVisual = (Base) =>
    class extends Base {
        drawEnergyShield(ctx) {
            const { current, maximum } = this.getShieldState();
            drawEnergyShieldField(ctx, this.owner, current / Math.max(1, maximum));
        }

        showEnergyShieldHit(absorbedDamage, source) {
            const impactDirection = source?.position
                ? Vector2.subtract(source.position, this.owner.position)
                : new Vector2(1, 0);
            if (impactDirection.length() <= 0.001) impactDirection.x = 1;
            impactDirection.normalize();
            const impactPosition = Vector2.add(
                this.owner.position,
                impactDirection.clone().scale(this.owner.radius + ENERGY_SHIELD_VISUAL_CONFIG.shellPadding)
            );

            this.simulation.entities.push(new EnergyShieldHitEffect(this.owner, impactDirection, absorbedDamage));
            this.simulation.spawnActionText(
                this.owner.position.clone(),
                `방어 ${Math.round(absorbedDamage)}`,
                ENERGY_SHIELD_VISUAL_CONFIG.shellColor
            );
            this.simulation.spawnParticleBurst(impactPosition, ENERGY_SHIELD_VISUAL_CONFIG.shellHighlightColor, {
                count: 10,
                speed: 130,
                radiusMin: 2,
                radiusMax: 4
            });
            this.simulation.playSound("bounce", 0.78);
        }
    };
