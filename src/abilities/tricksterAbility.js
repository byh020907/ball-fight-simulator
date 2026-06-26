import { Vector2 } from "../core.js";
import { computeOwnerCombatSpeed } from "./heroAbility.js";
import { Ability } from "./ability.js";

const SEED_COUNT = 3;
const SPAWN_OFFSET = 20;
const SEED_SPEED_MIN_MULTIPLIER = 1.2;
const SEED_SPEED_MAX_MULTIPLIER = 1.5;

export class TricksterAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, 7.0);
    }

    update(delta, target) {
        this.timer -= delta;
        if (this.timer > 0 || !target) {
            return;
        }

        this.timer = this.cooldown;
        const seedLife = this.cooldown * 2;
        const baseAngle = Math.random() * Math.PI * 2;
        const ownerSpeed = computeOwnerCombatSpeed(this.owner);
        for (let index = 0; index < SEED_COUNT; index += 1) {
            const angle = baseAngle + (Math.PI * 2 * index) / SEED_COUNT;
            const direction = Vector2.fromAngle(angle, 1);
            const start = Vector2.add(this.owner.position, direction.clone().scale(this.owner.radius + SPAWN_OFFSET));
            const speedMult =
                SEED_SPEED_MIN_MULTIPLIER + Math.random() * (SEED_SPEED_MAX_MULTIPLIER - SEED_SPEED_MIN_MULTIPLIER);
            this.simulation.spawnSeedOrb(this.owner, start, direction.scale(ownerSpeed * speedMult), seedLife);
        }
        this.simulation.playSound("seed");
        this.simulation.addLog(`${this.owner.name} launches three dash seeds.`);
    }

    drawFace(ctx, rotation, ball) {
        this._dotEye(ctx, ball, -0.25, -0.08, 0.047);
        this._eye(ctx, ball, 0.25, -0.08, 0.07);
        this._arc(ctx, ball, -0.1, 0.18, 0.16, 0.15, Math.PI - 0.15);
        this._arc(ctx, ball, 0.18, 0.18, 0.16, 0.15, Math.PI - 0.15);
        return true;
    }

    getUiState() {
        return { label: "Seeds", progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown)) };
    }
}
