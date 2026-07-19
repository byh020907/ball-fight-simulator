import { applyCollisionImpulse, CombatEntity, RENDER_LAYERS, Vector2 } from "../core.js";
import { CollectionGrace } from "../physics/index.js";
import { drawElementalOrb } from "../effects/elementalistEffects.js";

const ORB_RADIUS = 13;
const ORB_LIFETIME = 6;
const ORB_COLLECTION_GRACE = 0.42;
let nextOrbSerial = 1;

export class ElementalOrb extends CollectionGrace(CombatEntity) {
    static renderLayer = RENDER_LAYERS.FOREGROUND;

    constructor({
        owner,
        element,
        position,
        velocity = new Vector2(),
        targetMemory = null,
        ability,
        expiresAt = null
    }) {
        super(position, velocity, ORB_RADIUS);
        this.owner = owner;
        this.serial = nextOrbSerial++;
        this.ownerId = owner.id;
        this.sourceCaster = owner;
        this.element = element;
        this.elements = [element];
        this.targetMemory = targetMemory;
        this.ability = ability;
        this.createdAt = ability.simulation.elapsed;
        this.expiresAt = expiresAt ?? this.createdAt + ORB_LIFETIME;
        this.life = Math.max(0, this.expiresAt - this.createdAt);
        this.maxLife = this.life;
        this.isComposite = false;
        this.recipe = null;
        this.materialMemories = [{ target: targetMemory, createdAt: this.createdAt }];
        this.mass = 0.28;
        this.initializeCollectionGrace(ORB_COLLECTION_GRACE);
    }

    update(delta, simulation) {
        const graceActive = this.tickCollectionGrace(delta);
        this.life = Math.max(0, this.expiresAt - simulation.elapsed);
        if (this.life <= 0 || this.owner.flags.defeated || simulation.finished) {
            this.expire();
            return;
        }

        this.ability.applyOwnerMagnet(this, delta, graceActive);
        this.integrate(delta);
        simulation.keepEntityInsideArena(this);
        this._resolveForeignOrbContacts(simulation);
        this._resolveFighterContacts(simulation, graceActive);
    }

    _resolveForeignOrbContacts(simulation) {
        for (const other of simulation.entities) {
            if (!(other instanceof ElementalOrb) || other === this || other.isExpired || this.serial > other.serial) {
                continue;
            }
            const sameCasterNormalPair =
                this.sourceCaster === other.sourceCaster && !this.isComposite && !other.isComposite;
            if (sameCasterNormalPair) continue;
            const separation = Vector2.subtract(other.position, this.position);
            const distance = separation.length();
            const overlap = this.radius + other.radius - distance;
            if (overlap <= 0) continue;
            const normal = distance > 0 ? separation.normalize() : new Vector2(1, 0);
            this.applyPositionCorrection(normal.clone().scale(-overlap * 0.5));
            other.applyPositionCorrection(normal.clone().scale(overlap * 0.5));
            applyCollisionImpulse(this, other, normal, 0.65, { minApproachSpeed: 60 });
        }
    }

    _resolveFighterContacts(simulation, graceActive) {
        for (const fighter of simulation.fighters) {
            if (fighter.flags.defeated) continue;
            const separation = Vector2.subtract(this.position, fighter.position);
            const distance = separation.length();
            const overlap = this.radius + fighter.radius - distance;
            if (overlap <= 0) continue;
            const normal = distance > 0 ? separation.normalize() : new Vector2(1, 0);

            if (graceActive) continue;

            if (fighter === this.owner) {
                this.ability.consumeOrbByOwner(this);
                return;
            }

            this.applyPositionCorrection(normal.clone().scale(overlap + 0.6));
            applyCollisionImpulse(this, fighter, normal, 0.42, { impactA: 0, minApproachSpeed: 60 });
            simulation.playSound("bounce", 0.25);
            return;
        }
    }

    makeComposite(other, recipe, position, velocity, expiresAt) {
        const composite = new ElementalOrb({
            owner: this.owner,
            element: recipe.elements[0],
            position,
            velocity,
            targetMemory: null,
            ability: this.ability,
            expiresAt
        });
        composite.elements = [...recipe.elements];
        composite.isComposite = true;
        composite.recipe = recipe;
        composite.materialMemories = [...this.materialMemories, ...other.materialMemories].sort(
            (left, right) => left.createdAt - right.createdAt
        );
        composite.targetMemory = this.ability.selectCompositeMemoryTarget(composite.materialMemories);
        return composite;
    }

    expire() {
        if (this.isExpired) return;
        this.isExpired = true;
        this.ability.onOrbExpired(this);
    }

    draw(ctx) {
        drawElementalOrb(ctx, this, this.ability.simulation.elapsed);
    }
}

export const ELEMENTAL_ORB_CONFIG = Object.freeze({
    radius: ORB_RADIUS,
    lifetime: ORB_LIFETIME,
    collectionGrace: ORB_COLLECTION_GRACE,
    maximumActivePerCaster: 4
});
