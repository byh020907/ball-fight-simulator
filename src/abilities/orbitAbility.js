import { Vector2 } from "../core.js";
import { OrbitCatchEffect } from "../effects/orbitHitEffect.js";
import { CooldownBank } from "../physics/index.js";
import { Ability } from "./ability.js";

const VOLLEY_COOLDOWN = 3.0;
const VOLLEY_DELAY = 0.18;
const VOLLEY_MIN_RANGE = 200;
const VOLLEY_MAX_RANGE = 500;
const SHARD_SIZE = 16;
export const ORBIT_COOLDOWN_KEYS = Object.freeze({ hit: "hit", volley: "volley" });

export class OrbitAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation);
        this.cooldowns = new CooldownBank({
            [ORBIT_COOLDOWN_KEYS.hit]: 0.32,
            [ORBIT_COOLDOWN_KEYS.volley]: VOLLEY_COOLDOWN
        });
        this.shardCount = 5;
        this.orbitRadius = 44;
        this.shardRadius = 11;
        this.baseSpinSpeed = 4.2;
        this.spinBurstMultiplier = 3.15;
        this.spinBurstDuration = 0.85;
        this._baseRechargeDuration = 1;
        this.rechargeGap = 0.16;
        this.state = {
            angle: Math.random() * Math.PI * 2,
            shards: Array.from({ length: this.shardCount }, () => ({
                active: true,
                refilling: false,
                refillProgress: 1
            })),
            spinBurst: 0,
            rechargeDelay: 0,
            rechargeGapTimer: 0,
            volleyIndex: 0,
            volleyActive: false,
            volleyStartTime: 0,
            volleySerial: 0,
            currentVolleyId: null,
            synchronizedVolleys: new Map()
        };
    }

    get rechargeDuration() {
        const skill = this.owner.getSkillPoints?.() ?? this.owner.stats?.allocation?.skill ?? 0;
        const factor = 100 / (100 + skill);
        return (this._baseRechargeDuration * factor) / (this.getLevelUpgrade().rechargeSpeedMultiplier ?? 1);
    }

    update(delta, target) {
        this._syncShardCount();
        this.cooldowns.tick(delta);
        if (this.state.spinBurst > 0) {
            this.state.spinBurst = Math.max(0, this.state.spinBurst - delta);
        }

        const spinMultiplier = this.state.spinBurst > 0 ? this.spinBurstMultiplier : 1;
        this.state.angle += delta * this.baseSpinSpeed * spinMultiplier;
        this.updateRecharge(delta);
        this.updateVolley(delta, target);
        this._pruneSynchronizedVolleys();

        if (!target) {
            return;
        }

        const hitShard = this.getActiveShardEntries().find(
            ({ position }) => Vector2.subtract(position, target.position).length() <= target.radius + this.shardRadius
        );
        if (hitShard && this.cooldowns.isReady(ORBIT_COOLDOWN_KEYS.hit)) {
            const repelDirection = Vector2.subtract(target.position, hitShard.position).normalize();
            target.takeDamage(Math.round(this.owner.stats.baseDamage * 0.8), this.owner, "Orbit Shard");
            target.applyKnockback(repelDirection.scale(target.stats.baseSpeed * 2.5), 0.3);
            this.consumeShard(hitShard.index);
            this.cooldowns.reset(ORBIT_COOLDOWN_KEYS.hit);
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

    _syncShardCount() {
        const nextShardCount = Math.round(5 * (this.getLevelUpgrade().shardCountMultiplier ?? 1));
        if (nextShardCount === this.shardCount) return;

        if (nextShardCount < this.state.shards.length) {
            this.state.shards = this.state.shards.slice(0, nextShardCount);
        } else {
            this.state.shards.push(
                ...Array.from({ length: nextShardCount - this.state.shards.length }, () => ({
                    active: true,
                    refilling: false,
                    refillProgress: 1
                }))
            );
        }
        this.shardCount = nextShardCount;
    }

    getVolleyDelay() {
        return VOLLEY_DELAY * (this.getLevelUpgrade().volleyDelayMultiplier ?? 1);
    }

    consumeShard(index) {
        const shard = this.state.shards[index];
        if (!shard || !shard.active) {
            return;
        }

        shard.active = false;
        shard.refilling = false;
        shard.refillProgress = 0;
        this.state.spinBurst = this.spinBurstDuration;
        this.state.rechargeDelay = this.getActiveShardCount() === 0 ? 0 : this.spinBurstDuration;
        this.state.rechargeGapTimer = 0;
        this.simulation.playSound("charge", 0.9);
    }

    updateRecharge(delta) {
        if (this.getMissingShardCount() === 0) {
            return;
        }

        if (this.getActiveShardCount() === 0 && !this.getRefillingShard()) {
            this.state.rechargeDelay = 0;
            this.state.rechargeGapTimer = 0;
        }

        if (this.state.rechargeDelay > 0) {
            this.state.rechargeDelay = Math.max(0, this.state.rechargeDelay - delta);
            return;
        }

        const refilling = this.getRefillingShard();
        if (refilling) {
            const shard = this.state.shards[refilling.index];
            shard.refillProgress = Math.min(1, shard.refillProgress + delta / this.rechargeDuration);
            if (shard.refillProgress >= 1) {
                shard.active = true;
                shard.refilling = false;
                this.state.rechargeGapTimer = this.rechargeGap;
                this.simulation.spawnPulse(this.getOrbitPosition(refilling.index), this.owner.color);
                this.simulation.playSound("seed", 0.75);
            }
            return;
        }

        if (this.state.rechargeGapTimer > 0) {
            this.state.rechargeGapTimer = Math.max(0, this.state.rechargeGapTimer - delta);
            return;
        }

        const nextIndex = this.state.shards.findIndex((shard) => !shard.active && !shard.refilling);
        if (nextIndex >= 0) {
            this.state.shards[nextIndex].refilling = true;
            this.state.shards[nextIndex].refillProgress = 0.01;
            this.simulation.spawnParticleBurst(this.owner.position.clone(), this.owner.color, {
                count: 8,
                speed: 120,
                radiusMin: 2,
                radiusMax: 4,
                upBias: 8
            });
        }
    }

    /** Launch a shard volley at the target when all shards are full. */
    updateVolley(delta, target) {
        if (this.state.volleyActive) {
            if (!target || target.flags.defeated) {
                this.state.volleyActive = false;
                this.state.volleyIndex = 0;
                this.cooldowns.reset(ORBIT_COOLDOWN_KEYS.volley);
                this.state.currentVolleyId = null;
                return;
            }
            this.state.volleyStartTime -= delta;
            if (this.state.volleyStartTime <= 0 && this.state.volleyIndex < this.shardCount) {
                this.fireShardAt(target);
                this.state.volleyIndex++;
                this.state.volleyStartTime = this.getVolleyDelay();
            }
            if (this.state.volleyIndex >= this.shardCount) {
                this.state.volleyActive = false;
                this.state.volleyIndex = 0;
                this.cooldowns.reset(ORBIT_COOLDOWN_KEYS.volley);
                this.state.currentVolleyId = null;
            }
            return;
        }

        if (
            this.cooldowns.isReady(ORBIT_COOLDOWN_KEYS.volley) &&
            target &&
            !target.flags.defeated &&
            this.getActiveShardCount() === this.shardCount
        ) {
            const dist = Vector2.subtract(target.position, this.owner.position).length();
            if (dist >= VOLLEY_MIN_RANGE && dist <= VOLLEY_MAX_RANGE) {
                this.state.volleyActive = true;
                this.state.volleyIndex = 0;
                this.state.volleyStartTime = 0;
                this.state.volleySerial += 1;
                this.state.currentVolleyId = `${this.owner.id}:orbit:${this.state.volleySerial}`;
            }
        }
    }

    /** Fire one shard as a projectile toward the target. */
    fireShardAt(target) {
        if (!target || target.flags.defeated) return;

        const activeEntries = this.getActiveShardEntries();
        if (activeEntries.length === 0) return;

        const entry = activeEntries[0];
        const dir = Vector2.subtract(target.position, entry.position).normalize();
        this.simulation.spawnOrbitShot(this.owner, entry.position.clone(), dir, SHARD_SIZE, {
            slotIndex: entry.index,
            volleyId: this.state.currentVolleyId
        });
        this.consumeShard(entry.index);
        this.simulation.playSound("shoot", 0.6);
    }

    registerProjectileHit(projectile, target, contactPoint) {
        const upgrade = this.getLevelUpgrade();
        if (!upgrade.synchronizedVolley || !projectile.volleyId) return;
        if (this.state.synchronizedVolleys.has(projectile.volleyId)) return;

        const fixedPoint = contactPoint.clone();
        this.state.synchronizedVolleys.set(projectile.volleyId, fixedPoint);
        const convergingProjectiles = [];
        for (const entity of this.simulation.entities) {
            if (
                entity === projectile ||
                entity.constructor?.name !== "OrbitProjectile" ||
                entity.owner !== this.owner ||
                entity.volleyId !== projectile.volleyId ||
                entity.isExpired ||
                entity.hasHit
            ) {
                continue;
            }
            if (entity.beginSynchronizedConvergence(fixedPoint)) convergingProjectiles.push(entity);
        }
        this.simulation.spawnOrbitHit(projectile.position.clone(), fixedPoint.clone(), this.owner.color, {
            trackedProjectiles: convergingProjectiles
        });
        this.simulation.addLog(`${this.owner.name}'s orbit volley synchronizes on ${target.name}.`);
    }

    restoreShardFromCatch(slotIndex, position) {
        const shard = this.state.shards[slotIndex];
        if (!shard || shard.active) return false;
        shard.active = true;
        shard.refilling = false;
        shard.refillProgress = 1;
        this.state.rechargeGapTimer = this.rechargeGap;
        this.simulation.entities.push(new OrbitCatchEffect(this.owner, slotIndex, position, this.owner.color));
        this.simulation.playSound("charge", 1);
        return true;
    }

    _pruneSynchronizedVolleys() {
        for (const volleyId of this.state.synchronizedVolleys.keys()) {
            const remainsInFlight = this.simulation.entities.some(
                (entity) =>
                    entity.constructor?.name === "OrbitProjectile" &&
                    entity.owner === this.owner &&
                    entity.volleyId === volleyId &&
                    !entity.isExpired
            );
            if (!remainsInFlight) this.state.synchronizedVolleys.delete(volleyId);
        }
    }

    getActiveShardCount() {
        return this.state.shards.filter((shard) => shard.active).length;
    }

    getMissingShardCount() {
        return this.state.shards.filter((shard) => !shard.active).length;
    }

    getRefillingShard() {
        const index = this.state.shards.findIndex((shard) => shard.refilling);
        return index >= 0 ? { index, shard: this.state.shards[index] } : null;
    }

    getOrbitPosition(index) {
        const angle = this.state.angle + (Math.PI * 2 * index) / this.shardCount;
        return Vector2.add(this.owner.position, Vector2.fromAngle(angle, this.owner.radius + this.orbitRadius));
    }

    getActiveShardEntries() {
        return this.state.shards
            .map((shard, index) => ({ index, shard, position: this.getOrbitPosition(index) }))
            .filter(({ shard }) => shard.active);
    }

    getShardPositions() {
        return this.getActiveShardEntries().map(({ position }) => position);
    }

    getShardRenderStates() {
        return this.state.shards
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
        const fastOrbit = this.state.spinBurst > 0;
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
            const size = shard.refilling ? 8 + shard.progress * 10 : fastOrbit ? SHARD_SIZE + 6 : SHARD_SIZE;
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
        if (this.state.spinBurst > 0) {
            return {
                label: "Fast Orbit",
                progress: Math.max(0, Math.min(1, this.state.spinBurst / this.spinBurstDuration))
            };
        }
        if (this.state.volleyActive) {
            return { label: `Volley ${this.state.volleyIndex + 1}/${this.shardCount}`, progress: 1 };
        }
        if (this.getMissingShardCount() > 0) {
            return {
                label: `Refill ${this.getActiveShardCount()}/${this.shardCount}`,
                progress: this.getActiveShardCount() / this.shardCount
            };
        }
        if (!this.cooldowns.isReady(ORBIT_COOLDOWN_KEYS.volley)) {
            return {
                label: "Orbit Ready",
                progress: Math.max(0.08, 1 - this.cooldowns.getRemaining(ORBIT_COOLDOWN_KEYS.volley) / VOLLEY_COOLDOWN)
            };
        }
        return { label: "Orbit Ready", progress: 1 };
    }
}
