import { Vector2 } from "../core.js";
import { resolveFighterShapeCollision } from "../physics/CollisionShape.js";
import { applyDynamicCollisionResponse } from "../physics/collisionResponse.js";
import { Simulation } from "./simulation.js";

const COLLISION_SEPARATION_PADDING = 0.6;
const DEFAULT_ARENA_SIZE = 960;

function normalizeArenaSize(value) {
    if (!Number.isFinite(value)) return DEFAULT_ARENA_SIZE;
    return Math.max(DEFAULT_ARENA_SIZE, Math.round(value));
}

export class FighterPhysicsSimulation extends Simulation {
    constructor(options = {}) {
        super();
        this.width = normalizeArenaSize(options.arenaWidth ?? options.width);
        this.height = normalizeArenaSize(options.arenaHeight ?? options.height);
        this.arenaTheme = options.arenaTheme ?? null;
        this.terrain = Array.isArray(options.terrain) ? options.terrain : [];
    }

    createSpawnPoints(count) {
        if (count <= 0) return [];

        const points = [];
        const margin = 120;
        const center = new Vector2(this.width / 2, this.height / 2);

        if (count === 1) return [center];
        if (count === 2) {
            return [
                new Vector2(this.width * 0.32, this.height * 0.5),
                new Vector2(this.width * 0.68, this.height * 0.5)
            ];
        }

        points.push(new Vector2(this.width * 0.28, this.height * 0.5));
        const enemyCount = count - 1;
        const arcStart = -Math.PI * 0.64;
        const arcEnd = Math.PI * 0.64;

        for (let index = 0; index < enemyCount; index += 1) {
            const ratio = enemyCount === 1 ? 0.5 : index / (enemyCount - 1);
            const angle = arcStart + (arcEnd - arcStart) * ratio;
            const candidate = new Vector2(
                this.width * 0.68 + Math.cos(angle) * this.width * 0.12,
                this.height * 0.5 + Math.sin(angle) * this.height * 0.31
            );
            candidate.x = Math.max(margin, Math.min(this.width - margin, candidate.x));
            candidate.y = Math.max(margin, Math.min(this.height - margin, candidate.y));
            points.push(candidate);
        }

        return points;
    }

    getFighterPairs() {
        return this.fighters.flatMap((fighter, index) =>
            this.fighters.slice(index + 1).map((opponent) => [fighter, opponent])
        );
    }

    handleCollision() {
        for (const [a, b] of this.getFighterPairs()) {
            this.handleFighterCollision(a, b);
        }
    }

    handleFighterCollision(a, b) {
        if (this.shouldSkipFighterCollision(a, b)) return null;

        const result = resolveFighterShapeCollision(a, b);
        if (!result || !result.normal || result.overlap <= 0) return null;

        this.resolveFighterOverlap(a, b, result);

        const context = this.createFighterCollisionContext(a, b, result);
        this.beforeFighterPhysicsCollision(context);

        if (!context.skipPhysics) {
            this.applyFighterRigidBodyCollision(context);
        }

        this.afterFighterPhysicsCollision(context);

        if (this.shouldEmitFighterCollisionFeedback(context)) {
            this.emitFighterCollisionFeedback(context);
        }

        return context;
    }

    shouldSkipFighterCollision(a, b) {
        return a.flags.defeated || b.flags.defeated || a.state.swallowed || b.state.swallowed;
    }

    createFighterCollisionContext(a, b, result) {
        const normal = result.normal;
        const preCollisionVel = Vector2.subtract(b.velocity, a.velocity);
        return {
            a,
            b,
            result,
            normal,
            contactPoint: result.contactPoint,
            preCollisionVel,
            approachSpeed: preCollisionVel.dot(normal),
            hostile: this.isHostile(a, b),
            aModifiers: a.getStatModifiers?.() ?? {},
            bModifiers: b.getStatModifiers?.() ?? {},
            skipPhysics: false
        };
    }

    resolveFighterOverlap(a, b, result) {
        if (result.separationVec) {
            const pad = COLLISION_SEPARATION_PADDING;
            const totalX = result.separationVec.x + (result.separationVec.x > 0 ? pad : -pad);
            const totalY = result.separationVec.y + (result.separationVec.y > 0 ? pad : -pad);
            a.position.add(new Vector2(-totalX / 2, -totalY / 2));
            b.position.add(new Vector2(totalX / 2, totalY / 2));
            return;
        }

        const separationOverlap = result.separationOverlap ?? result.overlap;
        this.resolveCircularFighterOverlap(a, b, result.normal, separationOverlap);
    }

    resolveCircularFighterOverlap(a, b, normal, overlap) {
        const separation = overlap + COLLISION_SEPARATION_PADDING;
        a.position.add(normal.clone().scale(-separation / 2));
        b.position.add(normal.clone().scale(separation / 2));
    }

    beforeFighterPhysicsCollision(_context) {}

    afterFighterPhysicsCollision(_context) {}

    getFighterCollisionImpactOptions(_context) {
        return { impactA: 1, impactB: 1 };
    }

    applyFighterRigidBodyCollision(context) {
        const { a, b, normal, contactPoint, approachSpeed } = context;
        applyDynamicCollisionResponse(a, b, normal, contactPoint, approachSpeed, {
            ...this.getFighterCollisionImpactOptions(context)
        });
    }

    shouldEmitFighterCollisionFeedback(context) {
        return context.approachSpeed < 0;
    }

    emitFighterCollisionFeedback(context) {
        const { a, b } = context;
        this.playSound("crash", 1);
        this.addSparkBurst(Vector2.add(a.position, b.position).scale(0.5), "#ffffff");
        this.addSparkBurst(a.position.clone(), a.color);
        this.addSparkBurst(b.position.clone(), b.color);
    }
}
