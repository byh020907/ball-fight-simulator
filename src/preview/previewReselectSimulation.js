import { BattleBall } from "../entities/battleBall.js";
import { Vector2 } from "../core.js";
import { applyDynamicCollisionResponse } from "../physics/collisionResponse.js";
import { VisualBurst } from "../effects/visualBurst.js";
import { GravityParticle } from "../effects/gravityParticle.js";

const PREVIEW_COLLISION_COOLDOWN = 0.15;
const PREVIEW_HEAVY_IMPACT = 10;
const PREVIEW_DURATION = 0.8;

export class PreviewReselectSimulation {
    constructor({ oldFighter, newFighter, center, canvasWidth }) {
        this.width = canvasWidth;
        this.height = canvasWidth;
        this.outgoing = this._createBall(oldFighter, center);
        this.outgoing.applyImpulse(this.outgoing.velocity.clone().scale(-1));
        this.outgoing.position = center.clone();

        const angle = Math.random() * Math.PI * 2;
        const spawnDist = canvasWidth * 0.55;
        const spawnPos = Vector2.add(center, Vector2.fromAngle(angle, spawnDist));

        this.incoming = this._createBall(newFighter, spawnPos);
        const toCenter = Vector2.subtract(center, this.incoming.position);
        const dist = toCenter.length();
        const speed = dist / 0.55;
        this.incoming.applyImpulse(toCenter.normalize().scale(speed));

        this._entities = [];
        this._elapsed = 0;
        this._duration = PREVIEW_DURATION;
        this._pendingId = newFighter.id;
        this._pendingFighter = newFighter;
        this._finished = false;
        this._collisionCooldown = 0;
        this._screenShake = null;
        this._center = center.clone();
    }

    get finished() {
        return this._finished;
    }

    get duration() {
        return this._duration;
    }

    get pendingId() {
        return this._pendingId;
    }

    get pendingFighter() {
        return this._pendingFighter;
    }

    get entities() {
        return this._entities;
    }

    get screenShake() {
        return this._screenShake;
    }

    get center() {
        return this._center;
    }

    _createBall(fighter, position) {
        const ball = new BattleBall(fighter, position);
        ball.radius = Math.round(ball.stats.baseRadius * 1.35);
        return ball;
    }

    update(dt) {
        if (this._finished) return;

        this._elapsed += dt;
        this._collisionCooldown = Math.max(0, this._collisionCooldown - dt);

        this.outgoing.integrate(dt);
        this.incoming.integrate(dt);

        const diff = Vector2.subtract(this.incoming.position, this.outgoing.position);
        const dist = diff.length();
        const minDist = this.outgoing.radius + this.incoming.radius;

        if (dist < minDist && dist > 0.001) {
            const normal = diff.clone().normalize();
            const overlap = minDist - dist;

            const relVel = Vector2.subtract(this.incoming.velocity, this.outgoing.velocity);
            const approach = relVel.dot(normal);

            if (this._collisionCooldown <= 0 && approach < 0) {
                this._collisionCooldown = PREVIEW_COLLISION_COOLDOWN;
                const contactPoint = Vector2.add(this.outgoing.position, normal.clone().scale(this.outgoing.radius));

                applyDynamicCollisionResponse(this.outgoing, this.incoming, normal, contactPoint, approach, {
                    impactA: PREVIEW_HEAVY_IMPACT,
                    impactB: 1,
                    restitution: 0.92
                });

                const mid = Vector2.add(this.outgoing.position, this.incoming.position).scale(0.5);
                this._spawnCollisionEffects(mid, this.outgoing.color, this.incoming.color);
            }

            if (this._collisionCooldown <= 0) {
                const correction = normal.clone().scale(overlap * 0.5);
                this.outgoing.position.subtract(correction);
                this.incoming.position.add(correction);
            }
        }

        this._entities = this._entities.filter((e) => !e.isExpired);
        for (const e of this._entities) {
            e.update(dt, this);
        }

        this._updateScreenShake(dt);

        if (this._elapsed >= this._duration) {
            this.incoming.position = this._center.clone();
            this.incoming.applyImpulse(this.incoming.velocity.clone().scale(-1));
            this._finished = true;
        }
    }

    _spawnCollisionEffects(position, colorA, colorB) {
        this._entities.push(new VisualBurst(position, "#ffffff", 120, 0.22));
        this._entities.push(new VisualBurst(position, colorA, 90, 0.18));
        this._entities.push(new VisualBurst(position, colorB, 90, 0.18));

        this._spawnPreviewParticleBurst(position, colorA, {
            count: 6,
            speed: 120,
            radiusMin: 2,
            radiusMax: 3
        });
        this._spawnPreviewParticleBurst(position, colorB, {
            count: 6,
            speed: 120,
            radiusMin: 2,
            radiusMax: 3
        });
        this._spawnPreviewParticleBurst(position, "#ffffff", {
            count: 4,
            speed: 80,
            radiusMin: 1,
            radiusMax: 2
        });

        this._triggerScreenShake(0.1, 6);
    }

    _spawnPreviewParticleBurst(position, color, options = {}) {
        const count = options.count ?? 8;
        for (let index = 0; index < count; index += 1) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (options.speed ?? 100) * (0.5 + Math.random() * 0.8);
            const velocity = new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);
            this._entities.push(
                new GravityParticle(position.clone(), velocity, {
                    color,
                    gravity: 800,
                    radius:
                        (options.radiusMin ?? 2) +
                        Math.random() * ((options.radiusMax ?? 4) - (options.radiusMin ?? 2)),
                    life: 0.5 + Math.random() * 0.3,
                    bounce: 0.1,
                    floorFriction: 0.9,
                    settleDelay: 0.3
                })
            );
        }
    }

    _triggerScreenShake(duration = 0.1, strength = 6) {
        this._screenShake = { duration, remaining: duration, strength };
    }

    _updateScreenShake(delta) {
        if (!this._screenShake) return;
        this._screenShake.remaining -= delta;
        if (this._screenShake.remaining <= 0) this._screenShake = null;
    }

    draw(ctx) {
        this.outgoing.draw(ctx);
        this.incoming.draw(ctx);

        for (const e of this._entities) {
            e.draw(ctx);
        }
    }
}
