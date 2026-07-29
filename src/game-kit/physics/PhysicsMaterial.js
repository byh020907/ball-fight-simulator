/**
 * 물리 재질 시스템 — body/surface가 소유하는 재질 기반 마찰/반발 계수.
 *
 * 재질은 catalog(PHYSICS_MATERIALS)에 등록된 문자열 또는
 * { restitution, friction } 객체로 표현한다.
 *
 * 조합 규칙:
 *   restitution = max(a.restitution, b.restitution)
 *   friction    = sqrt(a.friction * b.friction)
 *
 * max 규칙을 선택한 이유:
 *   - restitution max: 게임 특성상 튀는 동작을 유지.
 *     wall(restitution=1)과 ball(0.92) 충돌 시 1.0으로 완전 반사.
 *   - friction sqrt: 두 재질 중 낮은 마찰 표면도 의미를 갖게 하면서,
 *     rubberBall/wood/wall처럼 같은 0.20 재질끼리는 현재 나무 수준 마찰을 유지.
 */

export const PHYSICS_MATERIALS = {
    rubberBall: { restitution: 0.92, friction: 0.2 },
    spinGrip: { restitution: 0.92, friction: 16 },
    wall: { restitution: 1.0, friction: 0.2 },
    wood: { restitution: 0.92, friction: 0.2 },
    stone: { restitution: 0.5, friction: 0.35 },
    ice: { restitution: 0.95, friction: 0.03 },
    metal: { restitution: 0.6, friction: 0.15 }
};

const DEFAULT_MATERIAL = PHYSICS_MATERIALS.wood;

/**
 * 인자를 PhysicsMaterial 객체로 정규화한다.
 * @param {string|{restitution:number,friction:number}|null|undefined} value
 * @returns {{restitution:number,friction:number}}
 */
export function resolvePhysicsMaterial(value) {
    if (value == null) return { ...DEFAULT_MATERIAL };
    if (typeof value === "string") {
        const found = PHYSICS_MATERIALS[value];
        if (found) return { ...found };
        return { ...DEFAULT_MATERIAL };
    }
    if (typeof value.restitution === "number" && typeof value.friction === "number") {
        return { restitution: value.restitution, friction: value.friction };
    }
    return { ...DEFAULT_MATERIAL };
}

/**
 * 두 재질을 조합하여 충돌 응답에 사용할 단일 restitution/friction을 반환한다.
 * 조합 규칙: restitution = max, friction = sqrt(a * b).
 * @param {{restitution:number,friction:number}} a
 * @param {{restitution:number,friction:number}} b
 * @returns {{restitution:number,friction:number}}
 */
export function combinePhysicsMaterials(a, b) {
    const ra = a ? a.restitution : DEFAULT_MATERIAL.restitution;
    const rb = b ? b.restitution : DEFAULT_MATERIAL.restitution;
    const fa = a ? a.friction : DEFAULT_MATERIAL.friction;
    const fb = b ? b.friction : DEFAULT_MATERIAL.friction;
    return {
        restitution: Math.max(ra, rb),
        friction: Math.sqrt(fa * fb)
    };
}
