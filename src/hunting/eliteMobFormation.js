import { Vector2 } from "../core.js";

const BACKLINE_TYPES = new Set(["healer", "shooter", "shard", "boomerang", "laser"]);

export const DEFAULT_ELITE_MOB_FORMATION_CONFIG = Object.freeze({
    frontRowDistance: 260,
    backRowDistance: 430,
    rowSpacing: 105,
    separationPadding: 24,
    separationStrength: 55,
    correctionStrength: 0.02,
    referenceFramesPerSecond: 60
});

export function createEliteMobFormationConfig(overrides = {}) {
    return { ...DEFAULT_ELITE_MOB_FORMATION_CONFIG, ...overrides };
}

export function isEliteBackline(fighter) {
    return BACKLINE_TYPES.has(fighter?.hunting?.monsterType);
}

export function placeEliteMobFormation(player, fighters, config = DEFAULT_ELITE_MOB_FORMATION_CONFIG) {
    const placeRow = (row, distance) =>
        row.forEach((fighter, index) => {
            const lateral = (index - (row.length - 1) / 2) * config.rowSpacing;
            fighter.position = new Vector2(player.position.x + distance, player.position.y + lateral);
            fighter.hunting.eliteFormationSlot = { distance, lateral };
        });
    placeRow(
        fighters.filter((fighter) => !isEliteBackline(fighter)),
        config.frontRowDistance
    );
    placeRow(fighters.filter(isEliteBackline), config.backRowDistance);
}

function hasEliteFormationSlot(fighter) {
    const slot = fighter?.hunting?.eliteFormationSlot;
    return Number.isFinite(slot?.distance) && Number.isFinite(slot?.lateral);
}

function isActiveEliteFormationMember(fighter) {
    return Boolean(
        fighter?.hunting?.eliteFormation &&
        hasEliteFormationSlot(fighter) &&
        !fighter.flags?.defeated &&
        !fighter.flags?.destroyed &&
        !fighter.state?.swallowed
    );
}

export function getEliteFormationMembers(allies) {
    return allies.filter(isActiveEliteFormationMember);
}

export function getEliteFormationFrame(player, members) {
    if (!player || members.length === 0) return null;
    const center = members
        .reduce((total, member) => total.add(member.position), new Vector2())
        .scale(1 / members.length);
    const candidateAxis = Vector2.subtract(center, player.position);
    const axis = candidateAxis.length() <= 0.001 ? new Vector2(1, 0) : candidateAxis.normalize();
    return { axis, perpendicular: new Vector2(-axis.y, axis.x) };
}

export function getEliteFormationTarget(player, owner, frame, arenaWidth, arenaHeight) {
    const slot = owner?.hunting?.eliteFormationSlot;
    if (!player || !slot || !frame) return null;
    const target = Vector2.add(player.position, frame.axis.clone().scale(slot.distance)).add(
        frame.perpendicular.clone().scale(slot.lateral)
    );
    const radius = owner.radius;
    const boundaryCorrection = new Vector2(
        Math.min(Math.max(target.x, radius), arenaWidth - radius) - target.x,
        Math.min(Math.max(target.y, radius), arenaHeight - radius) - target.y
    );
    return Vector2.add(target, boundaryCorrection);
}

export function getEliteFormationSteering(
    owner,
    player,
    allies,
    arenaWidth,
    arenaHeight,
    config = DEFAULT_ELITE_MOB_FORMATION_CONFIG
) {
    const members = getEliteFormationMembers(allies);
    if (!members.includes(owner)) return null;
    const frame = getEliteFormationFrame(player, members);
    const target = getEliteFormationTarget(player, owner, frame, arenaWidth, arenaHeight);
    if (!target) return null;
    const impulse = Vector2.subtract(target, owner.position);
    members.forEach((ally) => {
        const offset = Vector2.subtract(owner.position, ally.position);
        const distance = offset.length();
        if (ally !== owner && distance > 0.001 && distance < owner.radius + ally.radius + config.separationPadding)
            impulse.add(offset.normalize().scale(config.separationStrength));
    });
    return {
        target,
        impulse: impulse.scale(config.correctionStrength * owner.mass)
    };
}
