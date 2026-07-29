/**
 * PhysicsMaterialBody 믹스인 — body가 물리 재질을 소유하게 합니다.
 *
 * 제공 속성:
 *   this.physicsMaterial — 재질 식별자 (string | {restitution, friction})
 *
 * 제공 메서드:
 *   setPhysicsMaterial(material)   — 재질 설정
 *   getResolvedPhysicsMaterial()   — resolvePhysicsMaterial() 결과 반환
 */
import { resolvePhysicsMaterial } from "./PhysicsMaterial.js";

export default function PhysicsMaterialBody(Base) {
    return class extends Base {
        constructor() {
            super();
            this.physicsMaterial = "wood";
        }

        setPhysicsMaterial(material) {
            if (material != null) {
                this.physicsMaterial = material;
            }
        }

        getResolvedPhysicsMaterial() {
            return resolvePhysicsMaterial(this.physicsMaterial);
        }
    };
}
