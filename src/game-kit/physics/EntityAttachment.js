/** 전장 엔티티가 다른 엔티티의 위치를 따라가는 capability를 제공합니다. */
export default function EntityAttachment(Base) {
    return class extends Base {
        constructor(...args) {
            super(...args);
            this._attachedEntity = null;
        }

        attachToEntity(entity) {
            this._attachedEntity = entity ?? null;
            this.syncAttachedPosition();
            return this._attachedEntity;
        }

        hasAttachedEntity() {
            return Boolean(this._attachedEntity?.position);
        }

        syncAttachedPosition() {
            if (!this.hasAttachedEntity()) return false;
            this.position = this._attachedEntity.position.clone();
            return true;
        }
    };
}
