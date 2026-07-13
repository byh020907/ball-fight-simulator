/**
 * 새로 생성된 회수 대상이 즉시 자석에 끌리거나 수집되는 것을 막는다.
 *
 * 수집자의 자석과 직접 접촉 회수는 같은 update에서 이 상태를 판정해야 한다.
 */
export default function CollectionGrace(Base) {
    return class extends Base {
        initializeCollectionGrace(duration = 0) {
            this.collectionGraceRemaining = Math.max(0, Number.isFinite(duration) ? duration : 0);
        }

        tickCollectionGrace(delta) {
            if (this.collectionGraceRemaining <= 0) return false;
            this.collectionGraceRemaining = Math.max(
                0,
                this.collectionGraceRemaining - (Number.isFinite(delta) ? Math.max(0, delta) : 0)
            );
            return true;
        }

        // 기존 회수 설정과 테스트가 사용하는 이름을 유지한다.
        get magnetGraceRemaining() {
            return this.collectionGraceRemaining;
        }

        set magnetGraceRemaining(value) {
            this.collectionGraceRemaining = Math.max(0, Number.isFinite(value) ? value : 0);
        }
    };
}
