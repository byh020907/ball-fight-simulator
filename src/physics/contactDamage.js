/**
 * 접촉점 속도 기반 회전 손상 계산 헬퍼
 *
 * 공식 (2D 강체):
 *   r = contactPoint - body.position
 *   v_contact = body.velocity + angularVelocity × r
 *   2D cross:  ω × r = (-ω · r.y,  ω · r.x)
 */

/**
 * 접촉점의 절대 속도 벡터를 반환합니다.
 * @param {{ position: {x:number,y:number}, velocity: {x:number,y:number}, angularVelocity: number }} body
 * @param {{ x:number, y:number }} contactPoint
 * @returns {{ x:number, y:number }}
 */
export function getContactPointVelocity(body, contactPoint) {
    const velocity = body?.velocity ?? { x: 0, y: 0 };
    if (!body?.position || !contactPoint) {
        return { x: velocity.x ?? 0, y: velocity.y ?? 0 };
    }
    const rx = contactPoint.x - body.position.x;
    const ry = contactPoint.y - body.position.y;
    const av = Number.isFinite(body.angularVelocity) ? body.angularVelocity : 0;
    return {
        x: velocity.x - av * ry,
        y: velocity.y + av * rx
    };
}

/**
 * 충돌 피해에 사용할 물리 속도 구성값을 반환합니다.
 *
 * 선형 속도와 회전으로 생기는 접점 속도를 같은 px/s 차원으로 환산해
 * 합칩니다. 호출자는 damageSpeed를 기존 선형 속도처럼 피해식에 사용하고,
 * linearSpeed는 충돌 방향 판정에 그대로 사용할 수 있습니다.
 *
 * @param {{ position: {x:number,y:number}, velocity: {x:number,y:number}, angularVelocity: number }} body
 * @param {{ x:number, y:number }|null} contactPoint
 * @returns {{ linearSpeed: number, rotationalSpeed: number, damageSpeed: number }}
 */
export function getContactDamageSpeed(body, contactPoint) {
    const velocity = body?.velocity ?? { x: 0, y: 0 };
    const linearSpeed = Math.hypot(velocity.x ?? 0, velocity.y ?? 0);
    if (!contactPoint || !body?.position) {
        return { linearSpeed, rotationalSpeed: 0, damageSpeed: linearSpeed };
    }

    const contactVelocity = getContactPointVelocity(body, contactPoint);
    const rotationalSpeed = Math.hypot(contactVelocity.x - (velocity.x ?? 0), contactVelocity.y - (velocity.y ?? 0));
    return { linearSpeed, rotationalSpeed, damageSpeed: linearSpeed + rotationalSpeed };
}

/**
 * 접촉점 속도를 이용한 회전 손상 보너스 계수 (0 ~ 0.6) 를 반환합니다.
 *
 * 보너스 = clamp( (|v_contact| - |v_center|) / baseSpeed, 0, 0.6 )
 *
 * @param {{ position: {x:number,y:number}, velocity: {x:number,y:number}, angularVelocity: number, stats?: {baseSpeed?:number} }} body
 * @param {{ x:number, y:number }} contactPoint
 * @param {{ baseSpeed?: number }} [options]
 * @returns {number} 0 이상 0.6 이하 보너스 계수
 */
export function calculateRotationalContactDamageBonus(body, contactPoint, options = {}) {
    const velocity = body?.velocity ?? { x: 0, y: 0 };
    const speed = Math.sqrt((velocity.x ?? 0) ** 2 + (velocity.y ?? 0) ** 2);
    const cpv = getContactPointVelocity(body, contactPoint);
    const contactSpeed = Math.sqrt(cpv.x ** 2 + cpv.y ** 2);
    const extra = Math.max(0, contactSpeed - speed);

    const baseSpeed = (body?.stats && body.stats.baseSpeed > 0 ? body.stats.baseSpeed : options.baseSpeed) || 1;
    const bonus = Math.min(extra / baseSpeed, 0.6);
    return bonus;
}

/**
 * 기본 대미지에 회전 접촉점 속도 보너스를 적용합니다.
 * baseDamage <= 0 이면 변경 없이 반환합니다.
 *
 * @param {number} baseDamage
 * @param {{ position: {x:number,y:number}, velocity: {x:number,y:number}, angularVelocity: number, stats?: {baseSpeed?:number} }} body
 * @param {{ x:number, y:number }} contactPoint
 * @param {{ baseSpeed?: number }} [options]
 * @returns {number}
 */
export function applyRotationalContactDamage(baseDamage, body, contactPoint, options = {}) {
    if (baseDamage <= 0) return baseDamage;
    const bonus = calculateRotationalContactDamageBonus(body, contactPoint, options);
    return Math.round(baseDamage * (1 + bonus));
}
