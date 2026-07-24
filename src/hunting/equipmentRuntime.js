import { getEquipmentTemplate } from "./equipmentTemplates.js";

function finiteNonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

export class EquipmentChargeStore {
    constructor({ maximum = 1, initial = 0 } = {}) {
        this.maximum = finiteNonNegative(maximum);
        this.current = Math.min(this.maximum, finiteNonNegative(initial));
    }

    gain(amount = 1) {
        const previous = this.current;
        this.current = Math.min(this.maximum, this.current + finiteNonNegative(amount));
        return this.current - previous;
    }

    consume(amount = 1) {
        const requested = finiteNonNegative(amount);
        if (this.current < requested) return false;
        this.current -= requested;
        return true;
    }
}

export class EquipmentCooldown {
    constructor(duration = 0) {
        this.duration = finiteNonNegative(duration);
        this.remaining = 0;
    }

    get ready() {
        return this.remaining <= 0;
    }

    tick(delta) {
        this.remaining = Math.max(0, this.remaining - finiteNonNegative(delta));
        return this.remaining;
    }

    trigger(duration = this.duration) {
        this.duration = finiteNonNegative(duration);
        this.remaining = this.duration;
        return this.remaining;
    }

    reset() {
        this.remaining = 0;
    }
}

export class EquipmentTimedWindow {
    constructor() {
        this.remaining = 0;
    }

    get active() {
        return this.remaining > 0;
    }

    open(duration) {
        this.remaining = finiteNonNegative(duration);
        return this.remaining;
    }

    tick(delta) {
        this.remaining = Math.max(0, this.remaining - finiteNonNegative(delta));
        return this.remaining;
    }

    close() {
        this.remaining = 0;
    }
}

export class EquipmentMovementDistanceTracker {
    constructor(threshold = Infinity) {
        this.threshold = finiteNonNegative(threshold);
        this.distance = 0;
    }

    add(distance, source = "physics") {
        if (source !== "physics" && source !== "dash" && source !== "knockback" && source !== "pressure") return false;
        this.distance += finiteNonNegative(distance);
        return this.distance >= this.threshold;
    }

    consumeThreshold() {
        if (this.distance < this.threshold) return false;
        this.distance = 0;
        return true;
    }

    reset() {
        this.distance = 0;
    }
}

class NullEquipmentPassive {
    update() {}
    abilityUsed() {}
    enemyCollisionResolved() {}
    staticBounce() {}
    validMovement() {}
    battleEnded() {}
}

const PASSIVE_FACTORIES = Object.freeze({});

export class EquipmentRuntime {
    constructor(slotIndex, templateId, owner) {
        this.slotIndex = slotIndex;
        this.templateId = templateId;
        this.template = getEquipmentTemplate(templateId);
        this.owner = owner;
        this.charge = new EquipmentChargeStore();
        this.cooldown = new EquipmentCooldown();
        this.window = new EquipmentTimedWindow();
        this.distance = new EquipmentMovementDistanceTracker();
        const Factory = PASSIVE_FACTORIES[this.template?.passiveId] ?? NullEquipmentPassive;
        this.passive = new Factory(this);
    }

    notify(eventName, context) {
        this.passive[eventName]?.({ ...context, runtime: this, owner: this.owner });
    }

    getCombatStats() {
        return this.owner.getEquipmentCombatStats?.() ?? null;
    }
}

export class CombatEquipmentSet {
    constructor(owner, templateIds = []) {
        this.owner = owner;
        this.runtimes = templateIds.map((templateId, slotIndex) =>
            templateId && getEquipmentTemplate(templateId) ? new EquipmentRuntime(slotIndex, templateId, owner) : null
        );
        this._handlingEquipmentDamage = false;
    }

    get activeRuntimes() {
        return this.runtimes.filter(Boolean);
    }

    getCombatStats() {
        return this.owner.getEquipmentCombatStats?.() ?? null;
    }

    notify(eventName, context = {}) {
        for (const runtime of this.activeRuntimes) runtime.notify(eventName, context);
    }

    update(delta, context) {
        this.notify("update", { delta, ...context });
    }

    abilityUsed(context) {
        this.notify("abilityUsed", context);
    }

    enemyCollisionResolved(context) {
        if (context?.damage?.origin === "equipment") return;
        this.notify("enemyCollisionResolved", context);
    }

    staticBounce(context) {
        this.notify("staticBounce", context);
    }

    validMovement(context) {
        this.notify("validMovement", context);
    }

    battleEnded(context) {
        this.notify("battleEnded", context);
    }

    dealEquipmentDamage(target, amount, label = "Equipment", options = {}) {
        if (this._handlingEquipmentDamage || !target?.takeDamage)
            return { actualDamage: 0, absorbedDamage: 0, isCritical: false };
        this._handlingEquipmentDamage = true;
        try {
            return target.takeDamage(amount, this.owner, label, {
                ...options,
                allowCritical: options.allowCritical ?? false,
                equipmentDamage: { origin: "equipment", sourceTemplateId: options.sourceTemplateId ?? null },
                suppressEquipmentEvents: true
            });
        } finally {
            this._handlingEquipmentDamage = false;
        }
    }
}

export function createCombatEquipmentSet(owner, templateIds) {
    return new CombatEquipmentSet(owner, templateIds);
}
