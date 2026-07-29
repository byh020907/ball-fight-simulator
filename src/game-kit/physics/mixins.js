/**
 * 믹스인 합성 유틸리티.
 * 여러 mixin 함수를 합성하여 하나의 Base 클래스를 만듭니다.
 *
 * 사용법:
 *   class MyClass extends mixins([MixinA, MixinB]) { ... }
 *
 * 각 mixin은 (Base) => class extends Base { ... } 형태의 함수입니다.
 */
export function mixins(mixinFns) {
    return mixinFns.reduce((Base, mixin) => mixin(Base), class {});
}
