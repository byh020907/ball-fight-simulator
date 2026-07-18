import { Vector2 } from "../core.js";

const BACKLINE_TYPES = new Set(["healer", "shooter", "shard", "boomerang", "laser"]);

export function isEliteBackline(fighter) {
    return BACKLINE_TYPES.has(fighter?.hunting?.monsterType);
}

export function placeEliteMobFormation(player, fighters) {
    const placeRow = (row, distance) =>
        row.forEach((fighter, index) => {
            const lateral = (index - (row.length - 1) / 2) * 105;
            fighter.position = new Vector2(player.position.x + distance, player.position.y + lateral);
            fighter.hunting.eliteFormationSlot = { distance, lateral };
        });
    placeRow(
        fighters.filter((fighter) => !isEliteBackline(fighter)),
        260
    );
    placeRow(fighters.filter(isEliteBackline), 430);
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

export function getEliteFormationMemberTarget(owner, player, allies, arenaWidth, arenaHeight) {
    const members = getEliteFormationMembers(allies);
    if (!members.includes(owner)) return null;
    const frame = getEliteFormationFrame(player, members);
    return getEliteFormationTarget(player, owner, frame, arenaWidth, arenaHeight);
}

export function getEliteFormationImpulse(owner, player, allies, arenaWidth, arenaHeight) {
    const members = getEliteFormationMembers(allies);
    const desired = getEliteFormationMemberTarget(owner, player, members, arenaWidth, arenaHeight);
    if (!desired) return new Vector2();
    const correction = Vector2.subtract(desired, owner.position);
    members.forEach((ally) => {
        const offset = Vector2.subtract(owner.position, ally.position);
        const distance = offset.length();
        if (ally !== owner && distance > 0.001 && distance < owner.radius + ally.radius + 24)
            correction.add(offset.normalize().scale(55));
    });
    return correction.scale(0.02 * owner.mass);
}
