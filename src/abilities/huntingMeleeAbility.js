import { steerBallToward } from "../core.js";
import { Ability } from "./ability.js";

const CHASE_TURN_RATE = 8.5;
const CONTACT_SPEED_BONUS = 1.08;

export class HuntingMeleeAbility extends Ability {
    update(delta, target) {
        if (!target || target.flags.defeated) return;
        steerBallToward(this.owner, target, delta, {
            turnRate: CHASE_TURN_RATE,
            persist: true
        });
    }

    getStatModifiers() {
        return { speed: CONTACT_SPEED_BONUS, damage: 1, defense: 1, impact: 1 };
    }

    getUiState() {
        return { label: "Chase", progress: 1 };
    }

    drawFace(ctx, rotation, ball) {
        this._sharpEye(ctx, ball, -0.22, -0.06, 0.25, 0.07);
        this._sharpEye(ctx, ball, 0.22, -0.06, -0.25, 0.07);
        this._line(ctx, ball, [
            [-0.22, 0.2],
            [0, 0.27],
            [0.22, 0.2]
        ]);
        return true;
    }
}
