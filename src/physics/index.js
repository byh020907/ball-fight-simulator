export { mixins } from "./mixins.js";
export { default as PhysicsBody } from "./PhysicsBody.js";
export { default as LifeSpan } from "./LifeSpan.js";
export { default as CollectionGrace } from "./CollectionGrace.js";
export { default as Cooldown } from "./Cooldown.js";
export { default as BurstSequencer, BURST_RESULTS } from "./BurstSequencer.js";
export { default as EntityAttachment } from "./EntityAttachment.js";
export { default as RotationalBody } from "./RotationalBody.js";
export { default as PhysicsMaterialBody } from "./PhysicsMaterialBody.js";
export { applyMagneticAttraction, getCombatMovementSpeed } from "./magneticAttraction.js";
export { PhysicsDebugRingBuffer, snapshotPhysicsState, validatePhysicsState } from "./PhysicsDebugRingBuffer.js";
export {
    getWorldPolygonPoints,
    polygonBoundingRadius,
    resolvePolygonTerrainCollision,
    computeRegularPolygonLocalPoints,
    getFighterCollisionShape,
    resolveFighterShapeCollision
} from "./CollisionShape.js";
export { applyCollisionResponse, applyDynamicCollisionResponse } from "./collisionResponse.js";
export { PHYSICS_MATERIALS, resolvePhysicsMaterial, combinePhysicsMaterials } from "./PhysicsMaterial.js";
export { createSteeringRebaseState } from "./steeringRebase.js";
export { steerProjectileVelocityToward } from "./projectileSteering.js";
export { tickTimedMap } from "./timedMap.js";
export {
    getContactPointVelocity,
    getContactDamageSpeed,
    calculateRotationalContactDamageBonus,
    applyRotationalContactDamage
} from "./contactDamage.js";
