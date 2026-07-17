import { Vector2 } from "../core.js";

const BACKLINE_TYPES = new Set(["healer", "shooter", "shard", "boomerang", "laser"]);

export function isEliteBackline(fighter) {
    return BACKLINE_TYPES.has(fighter?.hunting?.monsterType);
}

export function placeEliteMobFormation(player, fighters) {
    const placeRow = (row, distance) =>
        row.forEach((fighter, index) => {
            const lateral = (index - (row.length - 1) / 2) * 105;
            fighter.position.set(player.position.x + distance, player.position.y + lateral);
            fighter.hunting.eliteFormationSlot = { distance, lateral };
        });
    placeRow(
        fighters.filter((fighter) => !isEliteBackline(fighter)),
        260
    );
    placeRow(fighters.filter(isEliteBackline), 430);
}

export function getEliteFormationImpulse(owner, player, allies) {
    const slot = owner?.hunting?.eliteFormationSlot;
    if (!slot || !player) return new Vector2();
    const axis = Vector2.subtract(owner.position, player.position);
    if (axis.length() <= 0.001) return new Vector2();
    axis.normalize();
    const desired = Vector2.add(player.position, axis.scale(slot.distance)).add(
        new Vector2(-axis.y, axis.x).scale(slot.lateral)
    );
    const correction = Vector2.subtract(desired, owner.position);
    allies.forEach((ally) => {
        const offset = Vector2.subtract(owner.position, ally.position);
        const distance = offset.length();
        if (ally !== owner && distance > 0.001 && distance < owner.radius + ally.radius + 24)
            correction.add(offset.normalize().scale(55));
    });
    return correction.scale(0.008 * owner.mass);
}
