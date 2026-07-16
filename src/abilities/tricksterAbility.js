import { Vector2 } from "../core.js";
import { computeOwnerCombatSpeed } from "./heroAbility.js";
import { Ability } from "./ability.js";

const SEED_COUNT = 3;
const SPAWN_OFFSET = 20;
const SEED_SPEED_MIN_MULTIPLIER = 1.2;
const SEED_SPEED_MAX_MULTIPLIER = 1.5;
const SEED_LIFE = 14;
const MARK_DURATION = 1.8;
const FOLLOWUP_COLLISION_GRACE = 0.5;

export class TricksterAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, 7.0);
        this.state = {
            marks: new Map()
        };
    }

    update(delta, target) {
        this._updateMarks(delta);
        this.timer -= delta;
        if (this.timer > 0 || !target) {
            return;
        }

        this.timer = this.cooldown;
        const upgrade = this.getLevelUpgrade();
        const seedCount = SEED_COUNT;
        const baseAngle = Math.random() * Math.PI * 2;
        for (const index of Array.from({ length: seedCount }, (_, value) => value)) {
            const angle = baseAngle + (Math.PI * 2 * index) / seedCount;
            this._spawnSeed(this.owner.position, Vector2.fromAngle(angle, 1), upgrade);
        }
        this.simulation.playSound("seed");
        this.simulation.addLog(`${this.owner.name} launches ${seedCount} dash seeds.`);
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
            { collisionGrace: options.collisionGrace ?? 0 }
        );
    }

    onEnemySeedContact(target) {
        const upgrade = this.getLevelUpgrade();
        if (upgrade.vineSnare) {
            target.applySlow(0.5, 0.8);
            target.addPeriodicDamageEffect(
                this.simulation.createPeriodicDamageEffect({
                    duration: 0.5,
                    interval: 0.1,
                    ticks: 5,
                    damage: this.owner.stats.baseDamage * 0.1,
                    source: this.owner,
                    label: "Vine Snare",
                    color: "#55d66b"
                })
            );
        }
        if (upgrade.seedMarkBurst) {
            this.state.marks.set(target, MARK_DURATION);
        }
    }

    onDashHit(target, effect, context = {}) {
        if (effect.collisionLabel !== "Seed Dash" || !this.state.marks.has(target)) return;
        const upgrade = this.getLevelUpgrade();
        if (!upgrade.seedMarkBurst) return;

        this.state.marks.delete(target);
        const contactPoint = context.contactPoint?.clone?.() ?? target.position.clone();
        target.takeDamage(this.owner.stats.baseDamage * 1.2, this.owner, "Seed Burst");
        this.simulation.spawnPulse(contactPoint.clone(), "#b7ff76");
        this.simulation.spawnParticleBurst(contactPoint.clone(), this.owner.color, {
            count: 24,
            speed: 260,
            radiusMin: 2,
            radiusMax: 5,
            upBias: 20
        });

        if (upgrade.followupSeed) {
            const direction = Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
            this._spawnSeed(contactPoint, direction, upgrade, {
                atContact: true,
                collisionGrace: FOLLOWUP_COLLISION_GRACE
            });
        }
    }

    _updateMarks(delta) {
        for (const [target, remaining] of this.state.marks) {
            const next = remaining - delta;
            if (next <= 0 || target.flags.defeated) this.state.marks.delete(target);
            else this.state.marks.set(target, next);
        }
    }

    draw(ctx) {
        for (const [target, remaining] of this.state.marks) {
            const pulse = 1 + Math.sin((MARK_DURATION - remaining) * 14) * 0.12;
            ctx.save();
            ctx.translate(target.position.x, target.position.y);
            ctx.scale(pulse, pulse);
            ctx.strokeStyle = "#8ef06a";
            ctx.fillStyle = "rgba(142, 240, 106, 0.2)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (const index of Array.from({ length: 6 }, (_, value) => value)) {
                const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 6;
                const point = Vector2.fromAngle(angle, target.radius + 8);
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
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
