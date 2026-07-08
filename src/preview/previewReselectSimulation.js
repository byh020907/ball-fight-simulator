import { BattleBall } from "../entities/battleBall.js";
import { Vector2 } from "../core.js";
import { FighterPhysicsSimulation } from "../simulation/fighterPhysicsSimulation.js";

const PREVIEW_COLLISION_COOLDOWN = 0.15;
const PREVIEW_HEAVY_IMPACT = 10;
const PREVIEW_DURATION = 0.8;

export class PreviewReselectSimulation extends FighterPhysicsSimulation {
    constructor({ oldFighter, newFighter, center, canvasWidth, canvasHeight = canvasWidth }) {
        super({ arenaWidth: canvasWidth, arenaHeight: canvasHeight });
        this.center = center.clone();
        this.outgoing = this._createBall(oldFighter, center);
        this.incoming = this._createIncomingBall(newFighter, center, canvasWidth);
        this.fighters = [this.outgoing, this.incoming];
        this.entities = [];
        this.elapsed = 0;
        this.duration = PREVIEW_DURATION;
        this.pendingId = newFighter.id;
        this.pendingFighter = newFighter;
        this.finished = false;
        this._collisionFeedbackCooldown = 0;
    }

    _createBall(fighter, position) {
        const ball = new BattleBall(fighter, position.clone());
        ball.radius = Math.round(ball.stats.baseRadius * 1.35);
        ball.teamId = fighter.id;
        ball.simulation = this;
        ball.applyImpulse(ball.velocity.clone().scale(-1));
        return ball;
    }

    _createIncomingBall(fighter, center, canvasWidth) {
        const angle = Math.random() * Math.PI * 2;
        const spawnDist = canvasWidth * 0.55;
        const spawnPos = Vector2.add(center, Vector2.fromAngle(angle, spawnDist));
        const ball = this._createBall(fighter, spawnPos);
        const toCenter = Vector2.subtract(center, ball.position);
        const dist = toCenter.length();
        const speed = dist / 0.55;
        ball.applyImpulse(toCenter.normalize().scale(speed));
        return ball;
    }

    update(dt) {
        if (this.finished) return;

        this.elapsed += dt;
        this._collisionFeedbackCooldown = Math.max(0, this._collisionFeedbackCooldown - dt);

        this.outgoing.integrate(dt);
        this.incoming.integrate(dt);
        this.handleCollision();

        for (const entity of this.entities) {
            entity.update(dt, this);
        }
        this.entities = this.entities.filter((entity) => !entity.isExpired);
        this.updateScreenShake(dt);

        if (this.elapsed >= this.duration) {
            this.incoming.position = this.center.clone();
            this.incoming.applyImpulse(this.incoming.velocity.clone().scale(-1));
            this.finished = true;
        }
    }

    getFighterCollisionImpactOptions(context) {
        if (context.a === this.outgoing && context.b === this.incoming) {
            return { impactA: 1, impactB: PREVIEW_HEAVY_IMPACT, restitution: 0.92 };
        }
        if (context.a === this.incoming && context.b === this.outgoing) {
            return { impactA: PREVIEW_HEAVY_IMPACT, impactB: 1, restitution: 0.92 };
        }
        return super.getFighterCollisionImpactOptions(context);
    }

    shouldEmitFighterCollisionFeedback(context) {
        return context.approachSpeed < 0 && this._collisionFeedbackCooldown <= 0;
    }

    emitFighterCollisionFeedback(context) {
        this._collisionFeedbackCooldown = PREVIEW_COLLISION_COOLDOWN;
        const { a, b } = context;
        const mid = Vector2.add(a.position, b.position).scale(0.5);
        this.addSparkBurst(mid, "#ffffff");
        this.addSparkBurst(a.position.clone(), a.color);
        this.addSparkBurst(b.position.clone(), b.color);
        this.spawnPulse(mid, "#ffffff");
        this.shakeScreen(0.1, 6);
        this.playSound("crash", 0.8);
    }

    playSound() {}

    draw(ctx) {
        this.outgoing.draw(ctx);
        this.incoming.draw(ctx);

        for (const entity of this.entities) {
            entity.draw(ctx, this);
        }
    }
}
