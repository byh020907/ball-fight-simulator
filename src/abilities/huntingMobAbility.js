import { steerBallToward, Vector2 } from "../core.js";
import { ArrowProjectile } from "../entities/arrowProjectile.js";
import { drawElectricArc } from "../effects/electricArc.js";
import { Ability } from "./ability.js";

const BEHAVIOR_CONFIG = Object.freeze({
    pursuer: { cooldown: 0, face: "angry" },
    charger: { cooldown: 3.2, face: "dash" },
    shooter: { cooldown: 2.2, face: "cyclops" },
    electric: { cooldown: 0, face: "ooo" },
    healer: { cooldown: 0, face: "happy" },
    chain: { cooldown: 0, face: "angry" },
    shockwave: { cooldown: 3.4, face: "ooo" },
    barrier: { cooldown: 4, face: "default" },
    siphon: { cooldown: 0, face: "xeye" },
    shard: { cooldown: 3, face: "cyclops" },
    boomerang: { cooldown: 3.1, face: "happy" },
    splitter: { cooldown: 3.8, face: "ooo" },
    jumper: { cooldown: 3.3, face: "dash" },
    laser: { cooldown: 4.2, face: "cyclops" }
});

export function getArenaWallRay(origin, angle, width, height) {
    const direction = Vector2.fromAngle(angle, 1);
    const distances = [];
    if (direction.x > 0) distances.push((width - origin.x) / direction.x);
    if (direction.x < 0) distances.push(-origin.x / direction.x);
    if (direction.y > 0) distances.push((height - origin.y) / direction.y);
    if (direction.y < 0) distances.push(-origin.y / direction.y);
    const length = Math.max(0, Math.min(...distances));
    return {
        length,
        end: Vector2.add(origin, direction.scale(length))
    };
}

export class HuntingMobAbility extends Ability {
    constructor(owner, simulation) {
        const behavior = owner.hunting?.behavior ?? "pursuer";
        super(owner, simulation, BEHAVIOR_CONFIG[behavior]?.cooldown ?? 0);
        this.behavior = behavior;
        this.state = {
            timer: 0,
            link: null,
            linkTime: 0,
            ring: 0,
            barrier: 0,
            laser: null,
            boomerang: null,
            jump: 0
        };
    }

    update(delta, target) {
        if (!target || target.flags.defeated) return;
        this.state.timer += delta;
        this.state.linkTime += delta;
        this.state.ring = Math.max(0, this.state.ring - delta);
        this.state.barrier = Math.max(0, this.state.barrier - delta);
        this.state.jump = Math.max(0, this.state.jump - delta);
        this._steer(delta, target);
        this._tickNaturalHeal(delta);
        this._tickBehavior(delta, target);
    }

    _steer(delta, target) {
        if (this.behavior === "healer") return;
        steerBallToward(this.owner, target, delta, {
            turnRate: this.behavior === "shooter" ? 3.2 : 7.4,
            persist: true
        });
    }

    _tickNaturalHeal(delta) {
        if (this.behavior === "healer") this.owner.heal((this.owner.maxHp / 20) * delta);
    }

    _tickBehavior(delta, target) {
        if (this.behavior === "electric") return this._tickLinkDamage(delta, target, 330, 8, "#a8e6ff");
        if (this.behavior === "healer") return this._tickHeal(delta);
        if (this.behavior === "chain") return this._tickChain(delta, target);
        if (this.behavior === "siphon") return this._tickSiphon(delta, target);
        if (this.behavior === "laser") return this._tickLaser(delta, target);
        if (this.behavior === "boomerang") return this._tickBoomerang(delta, target);
        if (this.state.timer < this.cooldown) return;
        this.state.timer = 0;
        if (this.behavior === "charger") this._charge(target);
        else if (this.behavior === "shooter") this._shoot(target);
        else if (this.behavior === "shockwave") this._shockwave();
        else if (this.behavior === "barrier") this.state.barrier = 1.5;
        else if (this.behavior === "shard") this._shardVolley(target);
        else if (this.behavior === "splitter") this._splitBurst(target);
        else if (this.behavior === "jumper") this._jump(target);
    }

    _tickLinkDamage(delta, target, range, dps, color) {
        const distance = Vector2.subtract(target.position, this.owner.position).length();
        this.state.link = distance <= range ? { target, color, style: "electric" } : null;
        if (this.state.link) target.takeDamage(dps * delta, this.owner, "Electric Arc");
    }

    _tickHeal(delta) {
        const ally = this.simulation.fighters.find(
            (fighter) =>
                fighter !== this.owner &&
                !fighter.flags.defeated &&
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
        const distance = Vector2.subtract(target.position, this.owner.position).length();
        this.state.link = distance <= 290 ? { target, color: "#e85d75" } : null;
        if (!this.state.link || distance <= 0.001) return;
        target.applyKnockback(
            Vector2.subtract(this.owner.position, target.position)
                .normalize()
                .scale(58 * delta),
            0.08
        );
    }

    _tickSiphon(delta, target) {
        const distance = Vector2.subtract(target.position, this.owner.position).length();
        this.state.link = distance <= 230 ? { target, color: "#9f6bcb" } : null;
        if (!this.state.link) return;
        const before = target.hp;
        target.takeDamage(7 * delta, this.owner, "Siphon");
        this.owner.heal((before - target.hp) * 0.8);
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

    _splitBurst(target) {
        this.state.ring = 0.55;
        const direction = this._directionTo(target);
        if (!direction) return;
        [-0.42, -0.14, 0.14, 0.42].forEach((offset) => {
            const angle = Math.atan2(direction.y, direction.x) + offset;
            this.simulation.entities.push(
                new ArrowProjectile(this.owner, this.owner.position.clone(), Vector2.fromAngle(angle, 330))
            );
        });
    }

    _jump(target) {
        this.state.jump = 0.55;
        const direction = this._directionTo(target);
        if (!direction) return;
        this.owner.initiateDash(direction, {
            speedOverride: 680,
            duration: 0.42,
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
                charge: 0.75,
                fire: 0
            };
        }
        const laser = this.state.laser;
        laser.charge -= delta;
        if (laser.charge <= 0) {
            laser.fire += delta;
            const direction = Vector2.fromAngle(laser.angle, 1);
            const ray = getArenaWallRay(
                this.owner.position,
                laser.angle,
                this.simulation.width,
                this.simulation.height
            );
            const relative = Vector2.subtract(target.position, this.owner.position);
            const along = relative.dot(direction);
            const offLine = Math.abs(relative.x * direction.y - relative.y * direction.x);
            if (along > 0 && along < ray.length && offLine < target.radius + 15)
                target.takeDamage(20 * delta, this.owner, "Laser Beam");
        }
        if (laser.fire >= 0.55) this.state.laser = null;
    }

    _tickBoomerang(delta, target) {
        if (!this.state.boomerang && this.state.timer >= this.cooldown) {
            this.state.timer = 0;
            this.state.boomerang = {
                position: this.owner.position.clone(),
                velocity: Vector2.subtract(target.position, this.owner.position).normalize().scale(390),
                outbound: 0.65,
                hit: false
            };
        }
        const boom = this.state.boomerang;
        if (!boom) return;
        boom.outbound -= delta;
        if (boom.outbound <= 0)
            boom.velocity = Vector2.subtract(this.owner.position, boom.position).normalize().scale(440);
        boom.position.add(boom.velocity.clone().scale(delta));
        if (!boom.hit && Vector2.subtract(target.position, boom.position).length() < target.radius + 14) {
            target.takeDamage(this.owner.stats.baseDamage * 1.1, this.owner, "Boomerang");
            boom.hit = true;
        }
        if (
            boom.outbound <= 0 &&
            Vector2.subtract(this.owner.position, boom.position).length() < this.owner.radius + 12
        )
            this.state.boomerang = null;
    }

    getRadiusScale() {
        return this.state.jump > 0 ? 1 + Math.sin((this.state.jump / 0.55) * Math.PI) * 0.34 : 1;
    }

    getStatModifiers() {
        return { speed: 1, damage: 1, defense: this.state.barrier > 0 ? 1.6 : 1, impact: 1 };
    }

    draw(ctx) {
        const { position, radius } = this.owner;
        ctx.save();
        if (this.state.link) this._drawActiveLink(ctx, position, this.state.link);
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
        if (this.state.boomerang) {
            ctx.fillStyle = "#f7b955";
            ctx.beginPath();
            ctx.arc(this.state.boomerang.position.x, this.state.boomerang.position.y, 11, 0, Math.PI * 2);
            ctx.fill();
        }
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
        const ray = getArenaWallRay(this.owner.position, laser.angle, this.simulation.width, this.simulation.height);
        ctx.strokeStyle = laser.charge > 0 ? "rgba(255, 90, 90, 0.45)" : "#ff5656";
        ctx.lineWidth = laser.charge > 0 ? 2 : 7;
        ctx.beginPath();
        ctx.moveTo(this.owner.position.x, this.owner.position.y);
        ctx.lineTo(ray.end.x, ray.end.y);
        ctx.stroke();
    }

    _directionTo(target) {
        const offset = Vector2.subtract(target.position, this.owner.position);
        return offset.length() <= 0.001 ? null : offset.normalize();
    }
}
