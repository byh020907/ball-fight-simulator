import { Vector2 } from "../core.js";

export const ELEMENTALIST_RECALL_ROUTE_CONFIG = Object.freeze({ corridorRadius: 28, targetRange: 600 });

function segmentDistance(point, start, end) {
    const vector = Vector2.subtract(end, start);
    const lengthSquared = vector.x * vector.x + vector.y * vector.y;
    if (lengthSquared <= 0.000001) return { distance: Vector2.subtract(point, start).length(), progress: 0 };
    const offset = Vector2.subtract(point, start);
    const progress = Math.max(0, Math.min(1, (offset.x * vector.x + offset.y * vector.y) / lengthSquared));
    const closest = new Vector2(start.x + vector.x * progress, start.y + vector.y * progress);
    return { distance: Vector2.subtract(point, closest).length(), progress };
}

export function getRecallRouteCandidates({ ownerPosition, pathSegments = [], orbs = [], corridorRadius }) {
    const radius = corridorRadius ?? ELEMENTALIST_RECALL_ROUTE_CONFIG.corridorRadius;
    let start = ownerPosition;
    let travelled = 0;
    const candidates = [];
    for (const end of pathSegments) {
        const length = Vector2.subtract(end, start).length();
        for (const orb of orbs) {
            const hit = segmentDistance(orb.position, start, end);
            if (hit.distance <= radius) candidates.push({ orb, distance: travelled + length * hit.progress });
        }
        travelled += length;
        start = end;
    }
    return candidates
        .sort((left, right) => left.distance - right.distance || left.orb.createdAt - right.orb.createdAt)
        .filter((entry, index, all) => all.findIndex((candidate) => candidate.orb === entry.orb) === index);
}

export function selectRecallRoute({ ownerPosition, pathSegments, orbs, tier }) {
    const candidates = getRecallRouteCandidates({ ownerPosition, pathSegments, orbs });
    const first = candidates[0]?.orb ?? null;
    if (!first) return { candidates, selectedOrbs: [], recipeBuilt: false };
    if (first.isComposite || tier < 3) return { candidates, selectedOrbs: [first], recipeBuilt: false };
    const second =
        candidates.find(({ orb }) => !orb.isComposite && orb !== first && orb.element !== first.element)?.orb ?? null;
    return { candidates, selectedOrbs: second ? [first, second] : [first], recipeBuilt: Boolean(second) };
}

export function selectRecallTerminalTarget({ owner, simulation, predictedTerminal }) {
    if (!predictedTerminal) return null;
    return (
        simulation
            .getEnemiesOf(owner)
            .filter((target) => !target.flags.defeated && !target.flags.destroyed)
            .filter(
                (target) =>
                    Vector2.subtract(target.position, owner.position).length() <=
                    ELEMENTALIST_RECALL_ROUTE_CONFIG.targetRange
            )
            .filter(
                (target) =>
                    Vector2.subtract(target.position, predictedTerminal).length() <= owner.radius + target.radius + 8
            )
            .sort(
                (left, right) =>
                    Vector2.subtract(left.position, predictedTerminal).length() -
                    Vector2.subtract(right.position, predictedTerminal).length()
            )[0] ?? null
    );
}
