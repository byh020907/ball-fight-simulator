/**
 * 정적 충돌면 (벽/terrain) angular impulse 공통 헬퍼.
 *
 * 마찰 없는 정적면과의 충돌은 법선 impulse torque가 0인 경우가 대부분
 * (contact vector가 법선과 평행), 따라서 접선 마찰 성분으로 회전을 생성합니다.
 *
 * 사용 예:
 *   applyStaticAngularImpulse(entity, normal, contactPoint, preVelocity, {
 *       restitution: 0.92,
 *       angularFactor: 0.15,
 *       tangentialFriction: 0.03,
 *   });
 *
 * @param {object} entity - 회전 가능한 엔티티 (applyAngularImpulse 메서드 필요)
 * @param {{x:number, y:number}} normal - 표면 법선 (entity 방향)
 * @param {{x:number, y:number}} contactPoint - 접점 (월드 좌표)
 * @param {{x:number, y:number}} preCollisionVelocity - 충돌 직전 선형 속도
 * @param {object} [options]
 * @param {number} [options.restitution=0.92] - 반발 계수
 * @param {number} [options.angularFactor=0.15] - 법선 impulse 회전 전달 계수
 * @param {number} [options.tangentialFriction=0.03] - 접선 마찰 계수
 */
export function applyStaticAngularImpulse(entity, normal, contactPoint, preCollisionVelocity, options = {}) {
    if (typeof entity.applyAngularImpulse !== "function") return;

    const restitution = options.restitution ?? 0.92;
    const angularFactor = options.angularFactor ?? 0.15;
    const tangentialFriction = options.tangentialFriction ?? 0.03;

    // 접근 속도 (법선 방향, 충돌 표면 → entity)
    const approachSpeed = preCollisionVelocity.x * normal.x + preCollisionVelocity.y * normal.y;
    if (approachSpeed >= 0) return; // 이미 멀어지는 중

    // 법선 impulse 크기: J = |v_rel| * (1 + e)
    const normalImpulseMag = Math.abs(approachSpeed) * (1 + restitution);

    // 접선 (normal의 90° CW 회전)
    const tangent = { x: -normal.y, y: normal.x };
    const tangentialSpeed = preCollisionVelocity.x * tangent.x + preCollisionVelocity.y * tangent.y;

    // contact vector: entity 중심 → 접점
    const r = {
        x: contactPoint.x - entity.position.x,
        y: contactPoint.y - entity.position.y
    };

    // torque arm 길이가 0에 가까우면 접선 속도만으로 spin 생성
    const torqueArmLen = Math.sqrt(r.x * r.x + r.y * r.y);
    if (torqueArmLen < 0.001) {
        const spinImpulse = tangentialSpeed * tangentialFriction;
        entity.applyAngularImpulse(spinImpulse);
        return;
    }

    // 1) 법선 impulse torque: τ_n = (r × N̂) * |J_n| * factor
    //    2D cross = r.x * normal.y - r.y * normal.x
    const rxn = r.x * normal.y - r.y * normal.x;
    const normalTorque = rxn * normalImpulseMag * angularFactor;

    // 2) 접선 마찰 torque: τ_t = (r × T̂) * v_t * friction
    const rxt = r.x * tangent.y - r.y * tangent.x;
    const frictionTorque = rxt * tangentialSpeed * tangentialFriction;

    entity.applyAngularImpulse(normalTorque + frictionTorque);
}
