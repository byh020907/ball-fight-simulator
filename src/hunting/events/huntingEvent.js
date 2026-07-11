import { safeFloor } from "./eventHelpers.js";

export const HUNTING_EVENT_TRANSITIONS = Object.freeze({
    CONTINUE: "continue",
    CHOICE: "choice",
    MERCHANT: "merchant",
    CHEST: "chest",
    BATTLE: "battle"
});

export class HuntingEvent {
    constructor(type) {
        this.type = type;
    }

    createPayload(floor) {
        return { type: this.type, floor: safeFloor(floor) };
    }

    resolve() {
        throw new Error(`${this.type} must implement resolve()`);
    }

    prepareAdvance(run) {
        return run;
    }

    static get(type) {
        return HuntingEvent.REGISTRY.get(type) ?? null;
    }

    static createPayload(type, floor, rng = Math.random) {
        const event = HuntingEvent.get(type);
        return event ? event.createPayload(floor, rng) : { type, floor: safeFloor(floor) };
    }

    static resolve(payload, context) {
        const event = HuntingEvent.get(payload?.type);
        if (!event) throw new Error(`Unsupported hunting event: ${payload?.type ?? "missing"}`);
        return event.resolve(payload, context);
    }

    static prepareNextAdvance(run) {
        const event = HuntingEvent.get(run?.lastEvent?.type);
        return event ? event.prepareAdvance(run) : run;
    }
}
