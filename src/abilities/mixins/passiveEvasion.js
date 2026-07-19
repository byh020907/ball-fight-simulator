import { Vector2 } from "../../core.js";

export const PASSIVE_EVASION_DEFAULTS = Object.freeze({
    minimumDistance: 5,
    movementThreshold: 5,
    impulseResponse: 0.72,
    headingDuration: 0.35
});

export const PassiveEvasion = (Base) =>
    class extends Base {
        tryPassiveEvasion(target) {
            const config = this.getPassiveEvasionConfig?.();
            if (!config || !this._canAttemptPassiveEvasion(target)) return false;

            const toTarget = Vector2.subtract(target.position, this.owner.position);
            const distance = toTarget.length();
            const range = Math.max(0, Number(config.range) || 0);
            const strength = Math.min(1, Math.max(0, Number(config.strength) || 0));
            if (range <= 0 || strength <= 0) return false;
            const minimumDistance = config.minimumDistance ?? PASSIVE_EVASION_DEFAULTS.minimumDistance;
            if (distance >= range || distance <= minimumDistance) return false;

            const movementThreshold = config.movementThreshold ?? PASSIVE_EVASION_DEFAULTS.movementThreshold;
            const towardOpponent = toTarget.normalize();
            const ownerDirection =
                this.owner.velocity.length() > movementThreshold ? this.owner.velocity.clone().normalize() : null;
            const movingToward = ownerDirection ? ownerDirection.dot(towardOpponent) > 0 : true;
            if (!movingToward) return false;

            const targetDirection =
                target.velocity.length() > movementThreshold
                    ? target.velocity.clone().normalize()
                    : towardOpponent.clone().scale(-1);
            const dodgeDirection = this._getPassiveEvasionDirection(target, targetDirection);
            const intensity = (1 - distance / range) * strength;
            const blendedDirection = (ownerDirection ?? dodgeDirection)
                .add(dodgeDirection.scale(intensity))
                .normalize();

            this._applyPassiveEvasion(blendedDirection, intensity, config);
            return true;
        }

        _canAttemptPassiveEvasion(target) {
            return Boolean(
                target && !target.flags.defeated && !this.owner.state.swallowed && !this.owner.state.wallSlam
            );
        }

        _getPassiveEvasionDirection(target, targetDirection) {
            const relativeX = this.owner.position.x - target.position.x;
            const relativeY = this.owner.position.y - target.position.y;
            const side = targetDirection.x * relativeY - targetDirection.y * relativeX;
            return side > 0
                ? new Vector2(-targetDirection.y, targetDirection.x)
                : new Vector2(targetDirection.y, -targetDirection.x);
        }

        _applyPassiveEvasion(direction, intensity, config) {
            const desiredSpeed = Math.max(
                this.owner.velocity.length(),
                this.owner.stats.baseSpeed * this.owner.getStatModifiers().speed
            );
            const desiredVelocity = direction.clone().scale(desiredSpeed);
            const impulseResponse = config.impulseResponse ?? PASSIVE_EVASION_DEFAULTS.impulseResponse;
            this.owner.applyImpulse(
                Vector2.subtract(desiredVelocity, this.owner.velocity).scale(impulseResponse * intensity)
            );

            if (this.owner.state.forcedHeading) {
                this.owner.state.forcedHeading.direction = direction;
                this.owner.state.forcedHeading.effect.elapsed = 0;
                return;
            }
            this.owner.forceHeading(direction, config.headingDuration ?? PASSIVE_EVASION_DEFAULTS.headingDuration);
        }
    };
