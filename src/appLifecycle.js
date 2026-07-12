export const APP_LIFECYCLE_STATES = Object.freeze({
    SETUP: "setup",
    PLAYING: "playing",
    RESULT_CONFIRMATION: "result_confirmation"
});

const ALLOWED_TRANSITIONS = Object.freeze({
    [APP_LIFECYCLE_STATES.SETUP]: Object.freeze([APP_LIFECYCLE_STATES.PLAYING]),
    [APP_LIFECYCLE_STATES.PLAYING]: Object.freeze([
        APP_LIFECYCLE_STATES.SETUP,
        APP_LIFECYCLE_STATES.RESULT_CONFIRMATION
    ]),
    [APP_LIFECYCLE_STATES.RESULT_CONFIRMATION]: Object.freeze([APP_LIFECYCLE_STATES.SETUP])
});

export class AppLifecycle {
    constructor() {
        this._state = APP_LIFECYCLE_STATES.SETUP;
        this._revision = 0;
    }

    get state() {
        return this._state;
    }

    get revision() {
        return this._revision;
    }

    get isSetup() {
        return this._state === APP_LIFECYCLE_STATES.SETUP;
    }

    get isGameplayActive() {
        return this._state === APP_LIFECYCLE_STATES.PLAYING;
    }

    get isAwaitingResultConfirmation() {
        return this._state === APP_LIFECYCLE_STATES.RESULT_CONFIRMATION;
    }

    get isSetupInteractionLocked() {
        return !this.isSetup;
    }

    isCurrentRevision(revision) {
        return this._revision === revision;
    }

    beginGameplay() {
        this._transitionTo(APP_LIFECYCLE_STATES.PLAYING);
    }

    awaitResultConfirmation() {
        this._transitionTo(APP_LIFECYCLE_STATES.RESULT_CONFIRMATION);
    }

    returnToSetup() {
        if (this.isSetup) {
            this._revision += 1;
            return;
        }
        this._transitionTo(APP_LIFECYCLE_STATES.SETUP);
    }

    _transitionTo(nextState) {
        if (this._state === nextState) return;
        const allowed = ALLOWED_TRANSITIONS[this._state] ?? [];
        if (!allowed.includes(nextState)) {
            throw new Error(`Invalid app lifecycle transition: ${this._state} -> ${nextState}`);
        }
        this._state = nextState;
        this._revision += 1;
    }
}
