import { Vector2 } from "../core.js";
import { Ability } from "./Ability.js";

export class OrbitAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation);
        this.angle = Math.random() * Math.PI * 2;
        this.hitCooldown = 0;
        this.shardCount = 3;
        this.shards = Array.from({ length: this.shardCount }, () => ({
            active: true,
            refilling: false,
            refillProgress: 1
        }));
        this.orbitRadius = 44;
        this.shardRadius = 11;
        this.baseSpinSpeed = 4.2;
        this.spinBurstMultiplier = 3.15;
        this.spinBurstDuration = 0.85;
        this.spinBurst = 0;
        this.rechargeDelay = 0;
        this.rechargeDuration = 2;
        this.rechargeGap = 0.16;
        this.rechargeGapTimer = 0;
    }

    update(delta, target) {
        if (this.spinBurst > 0) {
            this.spinBurst = Math.max(0, this.spinBurst - delta);
        }

        const spinMultiplier = this.spinBurst > 0 ? this.spinBurstMultiplier : 1;
        this.angle += delta * this.baseSpinSpeed * spinMultiplier;
        this.hitCooldown = Math.max(0, this.hitCooldown - delta);
        this.updateRecharge(delta);

        if (!target) {
            return;
        }

        const hitShard = this.getActiveShardEntries().find(
            ({ position }) => Vector2.subtract(position, target.position).length() <= target.radius + this.shardRadius
        );
        if (hitShard && this.hitCooldown <= 0) {
            const repelDirection = Vector2.subtract(target.position, hitShard.position).normalize();
            target.takeDamage(Math.round(this.owner.baseDamage * 0.8), this.owner, "Orbit Shard");
            target.velocity = repelDirection.scale(Math.max(target.baseSpeed * 1.35, target.velocity.length()));
            this.consumeShard(hitShard.index);
            this.hitCooldown = 0.32;
            this.simulation.spawnOrbitHit(hitShard.position.clone(), target.position.clone(), this.owner.color);
            this.simulation.playSound("orbit");
            this.simulation.addSparkBurst(target.position.clone(), this.owner.color);
            this.simulation.spawnParticleBurst(hitShard.position.clone(), this.owner.color, {
                count: 20,
                speed: 250,
                radiusMin: 2,
                radiusMax: 5,
                upBias: 20
            });
            this.simulation.addLog(`${this.owner.name}'s orbit shard breaks after clipping ${target.name}.`);
        }
    }

    consumeShard(index) {
        const shard = this.shards[index];
        if (!shard || !shard.active) {
            return;
        }

        shard.active = false;
        shard.refilling = false;
        shard.refillProgress = 0;
        this.spinBurst = this.spinBurstDuration;
        this.rechargeDelay = this.getActiveShardCount() === 0 ? 0 : this.spinBurstDuration;
        this.rechargeGapTimer = 0;
        this.simulation.playSound("charge", 0.9);
    }

    updateRecharge(delta) {
        if (this.getMissingShardCount() === 0) {
            return;
        }

        if (this.getActiveShardCount() === 0 && !this.getRefillingShard()) {
            this.rechargeDelay = 0;
            this.rechargeGapTimer = 0;
        }

        if (this.rechargeDelay > 0) {
            this.rechargeDelay = Math.max(0, this.rechargeDelay - delta);
            return;
        }

        const refilling = this.getRefillingShard();
        if (refilling) {
            const shard = this.shards[refilling.index];
            shard.refillProgress = Math.min(1, shard.refillProgress + delta / this.rechargeDuration);
            if (shard.refillProgress >= 1) {
                shard.active = true;
                shard.refilling = false;
                this.rechargeGapTimer = this.rechargeGap;
                this.simulation.spawnPulse(this.getOrbitPosition(refilling.index), this.owner.color);
                this.simulation.playSound("seed", 0.75);
            }
            return;
        }

        if (this.rechargeGapTimer > 0) {
            this.rechargeGapTimer = Math.max(0, this.rechargeGapTimer - delta);
            return;
        }

        const nextIndex = this.shards.findIndex((shard) => !shard.active && !shard.refilling);
        if (nextIndex >= 0) {
            this.shards[nextIndex].refilling = true;
            this.shards[nextIndex].refillProgress = 0.01;
            this.simulation.spawnParticleBurst(this.owner.position.clone(), this.owner.color, {
                count: 8,
                speed: 120,
                radiusMin: 2,
                radiusMax: 4,
                upBias: 8
            });
        }
    }

    getActiveShardCount() {
        return this.shards.filter((shard) => shard.active).length;
    }

    getMissingShardCount() {
        return this.shards.filter((shard) => !shard.active).length;
    }

    getRefillingShard() {
        const index = this.shards.findIndex((shard) => shard.refilling);
        return index >= 0 ? { index, shard: this.shards[index] } : null;
    }

    getOrbitPosition(index) {
        const angle = this.angle + (Math.PI * 2 * index) / this.shardCount;
        return Vector2.add(this.owner.position, Vector2.fromAngle(angle, this.owner.radius + this.orbitRadius));
    }

    getActiveShardEntries() {
        return this.shards
            .map((shard, index) => ({ index, shard, position: this.getOrbitPosition(index) }))
            .filter(({ shard }) => shard.active);
    }

    getShardPositions() {
        return this.getActiveShardEntries().map(({ position }) => position);
    }

    getShardRenderStates() {
        return this.shards
            .map((shard, index) => {
                if (!shard.active && !shard.refilling) {
                    return null;
                }

                const orbitPosition = this.getOrbitPosition(index);
                if (shard.active) {
                    return {
                        index,
                        active: true,
                        refilling: false,
                        progress: 1,
                        position: orbitPosition
                    };
                }

                const progress = this.easeOutCubic(shard.refillProgress);
                return {
                    index,
                    active: false,
                    refilling: true,
                    progress,
                    position: Vector2.add(
                        this.owner.position.clone().scale(1 - progress),
                        orbitPosition.clone().scale(progress)
                    )
                };
            })
            .filter(Boolean);
    }

    easeOutCubic(value) {
        const clamped = Math.max(0, Math.min(1, value));
        return 1 - Math.pow(1 - clamped, 3);
    }

    draw(ctx) {
        const pos = this.owner.position;
        const r = this.owner.radius;
        const shards = this.getShardRenderStates() ?? [];
        const fastOrbit = this.spinBurst > 0;
        const missingCount = this.getMissingShardCount() ?? 0;

        ctx.save();
        ctx.strokeStyle = fastOrbit ? "#ffea00" : "#243cff";
        ctx.lineWidth = fastOrbit ? 5 : 3;
        ctx.setLineDash(fastOrbit ? [16, 7] : missingCount > 0 ? [6, 13] : [8, 9]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + (this.orbitRadius ?? 44), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        for (const shard of shards) {
            const size = shard.refilling ? 8 + shard.progress * 10 : fastOrbit ? 22 : 16;
            if (shard.refilling) {
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(shard.position.x, shard.position.y);
                ctx.stroke();
            }
            ctx.fillStyle = shard.refilling ? "#ffffff" : fastOrbit ? "#ffea00" : "#ffcf24";
            ctx.strokeStyle = "#202020";
            ctx.lineWidth = 3;
            ctx.fillRect(shard.position.x - size / 2, shard.position.y - size / 2, size, size);
            ctx.strokeRect(shard.position.x - size / 2, shard.position.y - size / 2, size, size);
        }
        ctx.restore();
    }

    drawFace(ctx, rotation, ball) {
        this._dotEye(ctx, ball, -0.23, -0.08, 0.055);
        this._dotEye(ctx, ball, 0.23, -0.08, 0.055);
        this._arc(ctx, ball, 0, 0.18, 0.12, 0.1, Math.PI - 0.1);
        return true;
    }

    getUiState() {
        if (this.spinBurst > 0) {
            return { label: "Fast Orbit", progress: Math.max(0, Math.min(1, this.spinBurst / this.spinBurstDuration)) };
        }
        if (this.getMissingShardCount() > 0) {
            return {
                label: `Refill ${this.getActiveShardCount()}/${this.shardCount}`,
                progress: this.getActiveShardCount() / this.shardCount
            };
        }
        return { label: "Orbit Ready", progress: 1 };
    }
}
