export class ScreenWakeLock {
    constructor({ navigatorRef = globalThis.navigator, documentRef = globalThis.document } = {}) {
        this._navigator = navigatorRef;
        this._document = documentRef;
        this._active = false;
        this._sentinel = null;
        this._requestPromise = null;
        this._onVisibilityChange = this._handleVisibilityChange.bind(this);

        if (typeof this._document?.addEventListener === "function") {
            this._document.addEventListener("visibilitychange", this._onVisibilityChange);
        }
    }

    activate() {
        this._active = true;
        return this._request();
    }

    async deactivate() {
        this._active = false;
        const sentinel = this._sentinel;
        this._sentinel = null;
        await this._release(sentinel);
    }

    _request() {
        if (!this._active || this._sentinel || this._requestPromise || !this._canRequest()) return this._requestPromise;

        const wakeLock = this._navigator.wakeLock;
        let requestPromise;
        try {
            requestPromise = wakeLock.request("screen");
        } catch {
            return null;
        }

        const pendingRequest = Promise.resolve(requestPromise)
            .then(async (sentinel) => {
                if (!this._active) {
                    await this._release(sentinel);
                    return;
                }
                this._sentinel = sentinel;
                this._bindRelease(sentinel);
            })
            .catch(() => {})
            .finally(() => {
                if (this._requestPromise === pendingRequest) this._requestPromise = null;
            });
        this._requestPromise = pendingRequest;
        return pendingRequest;
    }

    _canRequest() {
        return Boolean(this._navigator?.wakeLock?.request) && this._visibilityState() !== "hidden";
    }

    _bindRelease(sentinel) {
        if (typeof sentinel?.addEventListener !== "function") return;
        sentinel.addEventListener("release", () => {
            if (this._sentinel !== sentinel) return;
            this._sentinel = null;
            this._request();
        });
    }

    async _release(sentinel) {
        if (!sentinel || sentinel.released || typeof sentinel.release !== "function") return;
        try {
            await sentinel.release();
        } catch {
            // 화면 깨우기 잠금 해제 실패는 게임 진행에 영향을 주지 않는다.
        }
    }

    _handleVisibilityChange() {
        if (this._visibilityState() === "visible") this._request();
    }

    _visibilityState() {
        return this._document?.visibilityState ?? "visible";
    }
}
