export class StickyGrenadeRegistry {
    constructor() {
        this.markersByTarget = new Map();
    }

    register(target, ownerId, grenade) {
        const marker = this.get(target, ownerId);
        if (marker) return false;

        const markersByOwner = this.markersByTarget.get(target) ?? new Map();
        markersByOwner.set(ownerId, grenade);
        this.markersByTarget.set(target, markersByOwner);
        return true;
    }

    get(target, ownerId) {
        const markersByOwner = this.markersByTarget.get(target);
        const marker = markersByOwner?.get(ownerId) ?? null;
        if (!marker || !marker.isExpired) return marker;

        markersByOwner.delete(ownerId);
        if (markersByOwner.size === 0) this.markersByTarget.delete(target);
        return null;
    }

    release(target, ownerId, grenade) {
        const markersByOwner = this.markersByTarget.get(target);
        if (!markersByOwner || markersByOwner.get(ownerId) !== grenade) return false;

        markersByOwner.delete(ownerId);
        if (markersByOwner.size === 0) this.markersByTarget.delete(target);
        return true;
    }

    get activeCount() {
        let count = 0;
        for (const [target, markersByOwner] of this.markersByTarget) {
            for (const [ownerId, marker] of markersByOwner) {
                if (marker?.isExpired) {
                    markersByOwner.delete(ownerId);
                } else {
                    count++;
                }
            }
            if (markersByOwner.size === 0) this.markersByTarget.delete(target);
        }
        return count;
    }
}
