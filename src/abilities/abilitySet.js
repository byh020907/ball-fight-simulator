const DEFAULT_STAT_MODIFIERS = Object.freeze({
    speed: 1,
    damage: 1,
    defense: 1,
    impact: 1
});

function clampProgress(value) {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function fallbackDisplayName(ability) {
    return ability.abilityId ?? ability.constructor?.name?.replace(/Ability$/, "") ?? "Ability";
}

/**
 * Owns one fighter's primary ability and ordered sub abilities.
 * Physical fighter properties remain primary-only; rendering and ability hooks run in registration order.
 */
export class AbilitySet {
    constructor(owner, { primary = null, subAbilities = [] } = {}) {
        this.owner = owner;
        this._primary = null;
        this._subAbilities = [];

        if (primary) {
            this.setPrimary(primary);
        }
        subAbilities.forEach((ability) => this.addSubAbility(ability));
    }

    get primary() {
        return this._primary;
    }

    get all() {
        return [this._primary, ...this._subAbilities].filter(Boolean);
    }

    get meta() {
        return this._primary?.meta ?? { isRanged: false };
    }

    setPrimary(ability) {
        this._bindAbility(ability, "primary");
        this._primary = ability;
        return ability;
    }

    addSubAbility(ability) {
        this._bindAbility(ability, "sub");
        if (this.all.some((registeredAbility) => registeredAbility.instanceKey === ability.instanceKey)) {
            throw new Error(`Duplicate ability instance key: ${ability.instanceKey}`);
        }

        this._subAbilities.push(ability);
        return ability;
    }

    getByAbilityId(abilityId) {
        return this.all.find((ability) => ability.abilityId === abilityId) ?? null;
    }

    getByInstanceKey(instanceKey) {
        return this.all.find((ability) => ability.instanceKey === instanceKey) ?? null;
    }

    update(delta, target) {
        this._forEach("update", delta, target);
    }

    draw(ctx) {
        this._forEach("draw", ctx);
    }

    drawFace(ctx, rotation, ball) {
        return this._primary?.drawFace?.(ctx, rotation, ball);
    }

    getRadiusScale() {
        return this._primary?.getRadiusScale?.() ?? 1;
    }

    getStatModifiers() {
        return this._primary?.getStatModifiers?.() ?? DEFAULT_STAT_MODIFIERS;
    }

    getPrimaryUiState() {
        return this._primary?.getUiState?.() ?? { label: "Passive", progress: 1 };
    }

    getUiStates() {
        return this.all.map((ability) => {
            const state = ability.getUiState?.() ?? {};
            const progress = clampProgress(state.progress ?? 1);
            const cooldownRemaining = Math.max(0, Number(ability.timer) || 0);
            const cooldownDuration = Math.max(0, Number(ability.cooldown) || 0);
            const status = state.status ?? (progress >= 1 ? "ready" : "charging");

            return {
                key: ability.instanceKey,
                abilityId: ability.abilityId,
                displayName: ability.displayName ?? fallbackDisplayName(ability),
                role: ability.role,
                label: state.label ?? ability.displayName ?? fallbackDisplayName(ability),
                progress,
                status,
                cooldownRemaining,
                cooldownDuration,
                text: state.text ?? null
            };
        });
    }

    modifyOutgoingFighterCollisionDamage(damage, target, context) {
        return this._primary?.modifyOutgoingFighterCollisionDamage?.(damage, target, context) ?? damage;
    }

    absorbIncomingDamage(damage, source, label, options) {
        return this.all.reduce(
            (result, ability) => {
                const next = ability.absorbIncomingDamage?.(result.remainingDamage, source, label, options);
                if (!next) return result;
                return {
                    remainingDamage: next.remainingDamage ?? result.remainingDamage,
                    absorbedDamage: result.absorbedDamage + (next.absorbedDamage ?? 0)
                };
            },
            { remainingDamage: damage, absorbedDamage: 0 }
        );
    }

    beforeFighterCollision(target, context) {
        return this._primary?.beforeFighterCollision?.(target, context) ?? null;
    }

    shouldSkipFighterCollision(target) {
        return this.all.some((ability) => ability.shouldSkipFighterCollision?.(target) === true);
    }

    onDashHit(target, effect, context) {
        this._primary?.onDashHit?.(target, effect, context);
    }

    onDashWall() {
        this._primary?.onDashWall?.();
    }

    onOwnerDefeated(context) {
        return this._forEach("onOwnerDefeated", context).some(Boolean);
    }

    onBattleEnded(context) {
        this._forEach("onBattleEnded", context);
    }

    onAllyCollision(other, context) {
        this._forEach("onAllyCollision", other, context);
    }

    onFighterCollisionDamageResolved(target, damage, context) {
        this._forEach("onFighterCollisionDamageResolved", target, damage, context);
    }

    onCollision(other, context) {
        this._forEach("onCollision", other, context);
    }

    onFighterStaticCollision(other, context) {
        this._forEach("onFighterStaticCollision", other, context);
    }

    _bindAbility(ability, role) {
        if (!ability) {
            throw new Error("An ability instance is required");
        }
        if (ability.owner !== this.owner) {
            throw new Error("Ability owner must match its AbilitySet owner");
        }

        ability.setContext?.({ role });
    }

    _forEach(method, ...args) {
        return this.all.map((ability) => ability[method]?.(...args));
    }
}
