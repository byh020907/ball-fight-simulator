import { Vector2 } from "../core.js";
import { Ability } from "./ability.js";
import { BulletProjectile } from "../entities/index.js";

const GUNNER_COOLDOWN = 5;
const BULLET_INTERVAL = 0.05;
const BULLET_SPEED_MULT = 2.0;
const MIN_BULLETS = 6;
const MAX_BULLETS = 12;
const MAX_FIELD_BULLETS = 20;
const KNOCKBACK_STRENGTH = 0.25;
const KNOCKBACK_DURATION = 0.15;

export class GunnerAbility extends Ability {
    constructor(owner, simulation) {
        super(owner, simulation, GUNNER_COOLDOWN);
        this.state = {
            burstRemaining: 0,
            burstTimer: 0,
            burstBulletCount: 0,
            burstIndex: 0,
            gunHand: 0,
            spinAngle: 0,
            activeBullets: []
        };
    }

    update(delta, target) {
        const time = performance.now() / 1000;
        this.state.spinAngle = Math.sin(time * 4) * 0.5;

        if (this.state.burstRemaining > 0) {
            this.state.spinAngle = time * 12;
            this.state.burstTimer -= delta;
            if (this.state.burstTimer <= 0) {
                this._fireBurstBullet();
            }
            return;
        }

        this.timer -= delta;
        if (this.timer <= 0 && target) {
            this.timer = this.cooldown;
            this._startBurst();
        }
    }

    _startBurst() {
        this.state.burstBulletCount = MIN_BULLETS + Math.floor(Math.random() * (MAX_BULLETS - MIN_BULLETS + 1));
        this.state.burstRemaining = this.state.burstBulletCount;
        this.state.burstIndex = 0;
        this.state.burstTimer = 0;
        this.state.gunHand = 0;
        this.simulation.spawnPulse(this.owner.position.clone(), "#ffee88");
        this.simulation.addLog(
            `${this.owner.name} fires ${this.state.burstBulletCount} bullet${this.state.burstBulletCount > 1 ? "s" : ""}!`
        );
        this.simulation.playSound("shoot", 0.9);
    }

    _fireBurstBullet() {
        if (this.state.burstRemaining <= 0) return;

        const owner = this.owner;
        const gunAngle = this.state.spinAngle + (this.state.gunHand === 0 ? 0 : Math.PI);
        const gx = owner.position.x + Math.cos(gunAngle) * (owner.radius + 10);
        const gy = owner.position.y + Math.sin(gunAngle) * (owner.radius + 10);

        const bulletAngle = Math.random() * Math.PI * 2;
        const dir = new Vector2(Math.cos(bulletAngle), Math.sin(bulletAngle));

        const bulletCount = this.state.burstBulletCount;
        const dmgMult = 0.2 + (bulletCount / MAX_BULLETS) * 0.8;
        const isLast = this.state.burstIndex === bulletCount - 1;
        const isFinisher = isLast && bulletCount === MAX_BULLETS;
        const finalMult = isFinisher ? dmgMult * 2 : dmgMult;

        const speed = owner.stats.baseSpeed * BULLET_SPEED_MULT;
        const cdReduction = GUNNER_COOLDOWN / 2 / MAX_BULLETS;
        const bullet = new BulletProjectile(
            owner,
            new Vector2(gx, gy),
            dir.clone().scale(speed),
            finalMult,
            isFinisher,
            cdReduction
        );
        this.state.activeBullets = this.state.activeBullets.filter((b) => !b.isExpired);
        this.state.activeBullets.push(bullet);
        while (this.state.activeBullets.length > MAX_FIELD_BULLETS) {
            const oldest = this.state.activeBullets.shift();
            oldest.isExpired = true;
        }
        this.simulation.entities.push(bullet);

        this.simulation.spawnSlash(
            new Vector2(gx, gy),
            Vector2.add(new Vector2(gx, gy), dir.clone().scale(isFinisher ? 55 : 35)),
            isFinisher ? "#ff4488" : "#ffee88"
        );
        this.simulation.spawnParticleBurst(new Vector2(gx, gy), isFinisher ? "#ff4488" : "#ffdd44", {
            count: isFinisher ? 10 : 4,
            speed: isFinisher ? 200 : 120,
            radiusMin: 1,
            radiusMax: isFinisher ? 4 : 2,
            gravity: 0,
            life: isFinisher ? 0.3 : 0.15
        });

        this.state.burstRemaining--;
        this.state.burstIndex++;
        this.state.burstTimer = BULLET_INTERVAL;
        this.state.gunHand = 1 - this.state.gunHand;

        if (isLast && bulletCount === MAX_BULLETS) {
            this.simulation.addLog(`${owner.name} lands a full burst!`);
        }
    }

    getStatModifiers() {
        return { speed: 0.98, damage: 1, defense: 1, impact: 1 };
    }

    draw(ctx) {
        const owner = this.owner;
        const time = performance.now() / 1000;

        ctx.save();
        if (this.state.burstRemaining > 0) {
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
            ctx.strokeStyle = this.state.burstRemaining > 0 ? "#666666" : "#444444";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.lineTo(gx + Math.cos(gunAngle) * 14, gy + Math.sin(gunAngle) * 14);
            ctx.stroke();
            ctx.fillStyle = this.state.burstRemaining > 0 ? "#888888" : "#666666";
            ctx.beginPath();
            ctx.arc(gx + Math.cos(gunAngle) * 14, gy + Math.sin(gunAngle) * 14, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawFace(ctx, rotation, ball) {
        this._sharpEye(ctx, ball, -0.22, -0.04, 0.5, 0.07);
        this._dotEye(ctx, ball, 0.2, -0.06, 0.04);
        this._arc(ctx, ball, 0.02, 0.26, 0.14, 0.15, Math.PI - 0.15);
        return true;
    }

    getUiState() {
        if (this.state.burstRemaining > 0) {
            return {
                label: `${this.state.burstBulletCount}B x${this.state.burstBulletCount - this.state.burstIndex}`,
                progress: 1 - (this.state.burstIndex % this.state.burstBulletCount) / this.state.burstBulletCount
            };
        }
        return {
            label: "RNG",
            progress: Math.max(0, Math.min(1, 1 - this.timer / this.cooldown))
        };
    }
}
