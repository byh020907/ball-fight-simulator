import { Vector2 } from "../core.js";
import { BURST_RESULTS, BurstSequencer } from "../physics/index.js";
import { Ability } from "./ability.js";
import { BulletProjectile, GunnerTurret } from "../entities/index.js";
import { enforceActiveEntityLimit } from "../entities/activeEntityLimit.js";
import { findGunnerTurretPlacement } from "./gunnerTurretPlacement.js";

const GUNNER_COOLDOWN = 4;
const BULLET_INTERVAL = 0.05;
const BULLET_SPEED_MULT = 2.0;
const MIN_BULLETS = 6;
const MAX_BULLETS = 12;
const MAX_FIELD_BULLETS = 20;
const KNOCKBACK_STRENGTH = 0.25;
const KNOCKBACK_DURATION = 0.15;
const FINISHER_CHARGE_DURATION = 0.16;
const TURRET_STACK_REQUIREMENT = 20;

export class GunnerAbility extends BurstSequencer(Ability) {
    constructor(owner, simulation) {
        super(owner, simulation, GUNNER_COOLDOWN);
        this.state = {
            burstBulletCount: 0,
            burstIndex: 0,
            gunHand: 0,
            spinAngle: 0,
            activeBullets: [],
            collectionStacks: 0,
            turret: null
        };
        this.turretMovementMode = "fixed";
        this.finisherCharge = null;
    }

    update(delta, target) {
        const time = performance.now() / 1000;
        this.state.spinAngle = Math.sin(time * 4) * 0.5;

        if (this.isBursting) {
            this.state.spinAngle = time * 12;
            this.tickBurst(delta, () => this._fireBurstBullet());
            return;
        }

        this.tickCooldown(delta);
        if (this.cooldownReady && target) {
            this.resetCooldown(this.cooldown);
            this._startBurst();
        }
    }

    _startBurst() {
        this.state.burstBulletCount = MIN_BULLETS + Math.floor(Math.random() * (MAX_BULLETS - MIN_BULLETS + 1));
        this.state.burstIndex = 0;
        this.state.gunHand = 0;
        this.startBurst(this.state.burstBulletCount, BULLET_INTERVAL);
        this.simulation.spawnPulse(this.owner.position.clone(), "#ffee88");
        this.simulation.addLog(
            `${this.owner.name} fires ${this.state.burstBulletCount} bullet${this.state.burstBulletCount > 1 ? "s" : ""}!`
        );
        this.simulation.playSound("shoot", 0.9);
    }

    _fireBurstBullet() {
        if (!this.isBursting) return BURST_RESULTS.CANCELLED;

        const owner = this.owner;
        const bulletCount = this.state.burstBulletCount;
        const dmgMult = 0.2 + (bulletCount / MAX_BULLETS) * 0.8;
        const isLast = this.state.burstIndex === bulletCount - 1;
        const finisherMinimum = this.getLevelUpgrade().everyBurstFinisher ? MIN_BULLETS : MAX_BULLETS;
        const isFinisher = isLast && bulletCount >= finisherMinimum;
        const finalMult = isFinisher ? dmgMult * 2 : dmgMult;
        if (isFinisher && !this.finisherCharge) {
            this._beginFinisherCharge();
            return BURST_RESULTS.PAUSED;
        }

        const hand = isFinisher ? this.finisherCharge.hand : this.state.gunHand;
        const muzzle = this._getGunPosition(hand);
        const direction = isFinisher
            ? this.finisherCharge.direction
            : Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
        if (isFinisher) this.finisherCharge = null;

        const speed = owner.stats.baseSpeed * BULLET_SPEED_MULT;
        const cdReduction = GUNNER_COOLDOWN / 2 / MAX_BULLETS;
        const bullet = new BulletProjectile(
            owner,
            muzzle,
            direction.clone().scale(speed),
            finalMult,
            isFinisher,
            cdReduction,
            this
        );
        this.state.activeBullets = this.state.activeBullets.filter((b) => !b.isExpired);
        this.state.activeBullets.push(bullet);
        this.state.activeBullets = enforceActiveEntityLimit(this.state.activeBullets, MAX_FIELD_BULLETS);
        this.simulation.entities.push(bullet);

        this.simulation.spawnSlash(
            muzzle.clone(),
            Vector2.add(muzzle, direction.clone().scale(isFinisher ? 55 : 35)),
            isFinisher ? "#ff4488" : "#ffee88"
        );
        this.simulation.spawnParticleBurst(muzzle, isFinisher ? "#ff4488" : "#ffdd44", {
            count: isFinisher ? 10 : 4,
            speed: isFinisher ? 200 : 120,
            radiusMin: 1,
            radiusMax: isFinisher ? 4 : 2,
            gravity: 0,
            life: isFinisher ? 0.3 : 0.15
        });

        this.state.burstIndex++;
        this.state.gunHand = 1 - this.state.gunHand;

        if (isFinisher) {
            this.simulation.addLog(`${owner.name} lands a full burst!`);
        }
        return BURST_RESULTS.FIRED;
    }

    _getGunPosition(hand) {
        const gunAngle = this.state.spinAngle + (hand === 0 ? 0 : Math.PI);
        return new Vector2(
            this.owner.position.x + Math.cos(gunAngle) * (this.owner.radius + 10),
            this.owner.position.y + Math.sin(gunAngle) * (this.owner.radius + 10)
        );
    }

    _beginFinisherCharge() {
        const hand = this.state.gunHand;
        const direction = Vector2.fromAngle(Math.random() * Math.PI * 2, 1);
        const muzzle = this._getGunPosition(hand);
        this.finisherCharge = { hand, direction };
        this._burstTimer = FINISHER_CHARGE_DURATION;
        this.simulation.spawnPulse(muzzle, "#ff4488");
        this.simulation.spawnParticleBurst(muzzle, "#ff4488", {
            count: 8,
            speed: 80,
            radiusMin: 1,
            radiusMax: 3,
            gravity: 0,
            life: FINISHER_CHARGE_DURATION
        });
    }

    onBulletCollected(bullet, simulation) {
        if (!bullet.canStack || bullet.isRefire) return;
        const upgrade = this.getLevelUpgrade();
        if (upgrade.refireOnCollect) this._spawnRefire(bullet, simulation);
        if (!upgrade.collectionTurret) return;
        this.state.collectionStacks += 1;
        if (this.state.collectionStacks < TURRET_STACK_REQUIREMENT) return;
        this.state.collectionStacks = 0;
        this._deployTurret(simulation);
    }

    _spawnRefire(sourceBullet, simulation) {
        const target = simulation.getNearestEnemy(this.owner);
        if (!target) return;
        const direction = Vector2.subtract(target.position, this.owner.position);
        if (direction.length() <= 0.001) return;
        direction.normalize();
        const start = Vector2.add(this.owner.position, direction.clone().scale(this.owner.radius + 10));
        const bullet = new BulletProjectile(
            this.owner,
            start,
            direction.clone().scale(sourceBullet.velocity.length()),
            sourceBullet.damageMult,
            false,
            0,
            this,
            {
                canBounce: true,
                canCollect: false,
                canRefire: false,
                canStack: false,
                isRefire: true,
                retargetAfterBounce: Boolean(this.getLevelUpgrade().ricochetReload)
            }
        );
        this.state.activeBullets.push(bullet);
        simulation.entities.push(bullet);
        simulation.spawnPulse(this.owner.position.clone(), "#66f2e2");
        simulation.playSound("shoot", 0.65);
    }

    _deployTurret(simulation) {
        if (this.state.turret && !this.state.turret.isExpired) {
            this.state.turret.dismiss(simulation);
        }
        const target = simulation.getNearestEnemy(this.owner);
        const direction = target
            ? Vector2.subtract(target.position, this.owner.position).normalize()
            : Vector2.fromAngle(this.owner.angle ?? 0, 1);
        const position = this._findTurretPlacement(direction, simulation);
        const turret = new GunnerTurret(this.owner, position, {
            movementMode: this.turretMovementMode,
            onDismiss: (dismissedTurret) => {
                if (this.state.turret === dismissedTurret) this.state.turret = null;
            }
        });
        this.state.turret = turret;
        simulation.entities.push(turret);
        simulation.spawnPulse(position, "#66f2e2");
    }

    _findTurretPlacement(direction, simulation) {
        return findGunnerTurretPlacement({
            ownerPosition: this.owner.position,
            owner: this.owner,
            direction,
            arena: simulation,
            entities: simulation.entities,
            terrain: simulation.terrain
        });
    }

    getStatModifiers() {
        return { speed: 0.98, damage: 1, defense: 1, impact: 1 };
    }

    draw(ctx) {
        const owner = this.owner;
        const time = performance.now() / 1000;

        ctx.save();
        if (this.isBursting) {
            const flash = Math.sin(time * 40) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255, 238, 136, ${flash * 0.15})`;
            ctx.beginPath();
            ctx.arc(owner.position.x, owner.position.y, owner.radius + 20, 0, Math.PI * 2);
            ctx.fill();
        }

        const r = owner.radius;
        for (const handOffset of [0, Math.PI]) {
            const gunAngle = this.state.spinAngle + handOffset;
            const gx = owner.position.x + Math.cos(gunAngle) * (r + 8);
            const gy = owner.position.y + Math.sin(gunAngle) * (r + 8);
            ctx.strokeStyle = this._burstRemaining > 0 ? "#666666" : "#444444";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.lineTo(gx + Math.cos(gunAngle) * 14, gy + Math.sin(gunAngle) * 14);
            ctx.stroke();
            ctx.fillStyle = this._burstRemaining > 0 ? "#888888" : "#666666";
            ctx.beginPath();
            ctx.arc(gx + Math.cos(gunAngle) * 14, gy + Math.sin(gunAngle) * 14, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        this._drawFinisherCharge(ctx);

        if (this.getLevelUpgrade().collectionTurret) this._drawCollectionStacks(ctx);
    }

    _drawFinisherCharge(ctx) {
        if (!this.finisherCharge) return;
        const muzzle = this._getGunPosition(this.finisherCharge.hand);
        const progress = 1 - Math.max(0, this._burstTimer) / FINISHER_CHARGE_DURATION;
        ctx.save();
        ctx.fillStyle = "rgba(255, 68, 136, 0.36)";
        ctx.strokeStyle = "#ff4488";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(muzzle.x, muzzle.y, 7 + progress * 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    _drawCollectionStacks(ctx) {
        const stacks = this.state.collectionStacks;
        const radius = this.owner.radius + 16;
        ctx.save();
        ctx.strokeStyle = "#66f2e2";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
            this.owner.position.x,
            this.owner.position.y,
            radius,
            -Math.PI / 2,
            -Math.PI / 2 + (Math.PI * 2 * stacks) / TURRET_STACK_REQUIREMENT
        );
        ctx.stroke();
        ctx.fillStyle = "#163d40";
        ctx.font = "800 11px Bahnschrift, Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
            `${stacks}/${TURRET_STACK_REQUIREMENT}`,
            this.owner.position.x,
            this.owner.position.y - radius - 5
        );
        ctx.restore();
    }

    drawFace(ctx, rotation, ball) {
        this._sharpEye(ctx, ball, -0.22, -0.04, 0.5, 0.07);
        this._dotEye(ctx, ball, 0.2, -0.06, 0.04);
        this._arc(ctx, ball, 0.02, 0.26, 0.14, 0.15, Math.PI - 0.15);
        return true;
    }

    getUiState() {
        if (this.isBursting) {
            return {
                label: `${this.state.burstBulletCount}B x${this.state.burstBulletCount - this.state.burstIndex}`,
                progress: 1 - (this.state.burstIndex % this.state.burstBulletCount) / this.state.burstBulletCount
            };
        }
        return {
            label: this.getLevelUpgrade().collectionTurret ? `${this.state.collectionStacks}/20` : "RNG",
            progress: this.cooldownProgress
        };
    }
}
