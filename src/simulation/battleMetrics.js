function finite(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function nonNegative(value) {
    return Math.max(0, finite(Number(value)));
}

function increment(record, key, amount = 1) {
    record[key] = nonNegative(record[key]) + amount;
}

function median(sortedValues) {
    if (!sortedValues.length) return 0;
    const middle = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 ? sortedValues[middle] : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

function percentile(sortedValues, percentileValue) {
    if (!sortedValues.length) return 0;
    const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * percentileValue) - 1));
    return sortedValues[index];
}

function originRecord() {
    return { damage: 0, hits: 0, absorbed: 0 };
}

function createFighterRecord() {
    return { dealt: 0, taken: 0 };
}

function getRecord(map, key, factory) {
    const normalizedKey = key ?? "unknown";
    map[normalizedKey] ??= factory();
    return map[normalizedKey];
}

function ensureOriginMap(map, fighterId) {
    const normalizedKey = fighterId ?? "unknown";
    map[normalizedKey] ??= {};
    return map[normalizedKey];
}

export class BattleMetricsRecorder {
    constructor() {
        this.fighters = {};
        this.damageByLabel = {};
        this.damageByOrigin = {};
        this.equipment = {};
        this.abilities = [];
        this.dragEvents = [];
        this._dealtByOrigin = {};
        this._takenByOrigin = {};
    }

    trackEquipment(templateId, ownerId = null) {
        if (!templateId) return;
        const equipment = getRecord(this.equipment, templateId, () => ({
            directDamage: 0,
            hits: 0,
            triggers: 0,
            ownerId: null
        }));
        equipment.ownerId ??= ownerId;
    }

    recordDamage(event = {}) {
        const actualDamage = nonNegative(event.actualDamage);
        const absorbedDamage = nonNegative(event.absorbedDamage);
        const source = getRecord(this.fighters, event.sourceId, createFighterRecord);
        const target = getRecord(this.fighters, event.targetId, createFighterRecord);
        increment(source, "dealt", actualDamage);
        increment(target, "taken", actualDamage);
        increment(
            getRecord(this.damageByLabel, event.label, () => ({ damage: 0, hits: 0, absorbed: 0 })),
            "damage",
            actualDamage
        );
        increment(
            getRecord(this.damageByLabel, event.label, () => ({ damage: 0, hits: 0, absorbed: 0 })),
            "absorbed",
            absorbedDamage
        );
        if (actualDamage > 0)
            increment(
                getRecord(this.damageByLabel, event.label, () => ({ damage: 0, hits: 0, absorbed: 0 })),
                "hits"
            );
        const origin = event.origin ?? "combat";
        increment(getRecord(this.damageByOrigin, origin, originRecord), "damage", actualDamage);
        increment(getRecord(this.damageByOrigin, origin, originRecord), "absorbed", absorbedDamage);
        if (actualDamage > 0) increment(getRecord(this.damageByOrigin, origin, originRecord), "hits");
        const dealtOrigin = getRecord(ensureOriginMap(this._dealtByOrigin, event.sourceId), origin, originRecord);
        increment(dealtOrigin, "damage", actualDamage);
        increment(dealtOrigin, "absorbed", absorbedDamage);
        if (actualDamage > 0) increment(dealtOrigin, "hits");
        const takenOrigin = getRecord(ensureOriginMap(this._takenByOrigin, event.targetId), origin, originRecord);
        increment(takenOrigin, "damage", actualDamage);
        increment(takenOrigin, "absorbed", absorbedDamage);
        if (actualDamage > 0) increment(takenOrigin, "hits");
        if (event.sourceTemplateId) {
            this.trackEquipment(event.sourceTemplateId, event.sourceId);
            const equipment = this.equipment[event.sourceTemplateId];
            increment(equipment, "directDamage", actualDamage);
            if (actualDamage > 0) increment(equipment, "hits");
        }
    }

    recordEquipmentPassiveTrigger(event = {}) {
        if (!event.templateId) return;
        this.trackEquipment(event.templateId, event.ownerId);
        increment(this.equipment[event.templateId], "triggers");
    }

    recordAbilityUsed(event = {}) {
        if (!event.ownerId || !event.abilityId) return;
        this.abilities.push({
            ownerId: event.ownerId,
            abilityId: event.abilityId,
            instanceKey: event.instanceKey ?? null,
            role: event.role ?? "primary",
            elapsed: nonNegative(event.elapsed)
        });
    }

    recordDragEvent(event = {}) {
        if (!Number.isFinite(event.sequence) || this.dragEvents.some((entry) => entry.sequence === event.sequence))
            return;
        const chargeRatio = nonNegative(event.chargeRatio ?? event.snapshot?.chargeRatio);
        this.dragEvents.push({
            type: event.type ?? "unknown",
            sequence: event.sequence,
            chargeRatio,
            bounceCount: nonNegative(event.bounceCount),
            elapsed: nonNegative(event.elapsed)
        });
    }

    snapshot({
        elapsed = 0,
        winner = null,
        loser = null,
        fighters = [],
        timedOut = false,
        focalFighterId = null,
        focalAbilityIds = []
    } = {}) {
        const fighterSnapshots = Object.fromEntries(
            fighters.map((fighter) => [
                fighter.id,
                {
                    hpRatio: fighter.maxHp > 0 ? nonNegative(fighter.hp) / fighter.maxHp : 0,
                    dealt: nonNegative(this.fighters[fighter.id]?.dealt),
                    taken: nonNegative(this.fighters[fighter.id]?.taken)
                }
            ])
        );
        const focalDealtByOrigin = focalFighterId ? structuredClone(this._dealtByOrigin[focalFighterId] ?? {}) : {};
        const focalTakenByOrigin = focalFighterId ? structuredClone(this._takenByOrigin[focalFighterId] ?? {}) : {};
        return {
            elapsed: nonNegative(elapsed),
            winnerId: winner?.id ?? null,
            loserId: loser?.id ?? null,
            timedOut: Boolean(timedOut),
            fighters: fighterSnapshots,
            damageByLabel: structuredClone(this.damageByLabel),
            damageByOrigin: structuredClone(this.damageByOrigin),
            focalDealtByOrigin,
            focalTakenByOrigin,
            equipment: Object.fromEntries(
                Object.entries(this.equipment).map(([templateId, entry]) => [
                    templateId,
                    { ...entry, ownerDamage: nonNegative(this.fighters[entry.ownerId]?.dealt) }
                ])
            ),
            abilities: structuredClone(this.abilities),
            dragEvents: structuredClone(this.dragEvents),
            focalFighterId,
            focalAbilityIds: [...focalAbilityIds]
        };
    }
}

function aggregateOriginMap(originMap) {
    const totalDamage = Object.values(originMap).reduce((sum, entry) => sum + nonNegative(entry.damage), 0);
    const totals = {};
    for (const origin of Object.keys(originMap)) {
        const entry = originMap[origin];
        totals[origin] = {
            damage: nonNegative(entry.damage),
            hits: nonNegative(entry.hits),
            absorbed: nonNegative(entry.absorbed),
            damagePerMatch: 0,
            hitsPerMatch: 0,
            ratio: totalDamage ? nonNegative(entry.damage) / totalDamage : 0
        };
    }
    return totals;
}

function summarizeOriginMap(originMap, sampleCount) {
    const summary = aggregateOriginMap(originMap);
    for (const entry of Object.values(summary)) {
        entry.damagePerMatch = sampleCount ? entry.damage / sampleCount : 0;
        entry.hitsPerMatch = sampleCount ? entry.hits / sampleCount : 0;
    }
    return summary;
}

function mergeOriginRecord(target, entry) {
    target.damage += nonNegative(entry.damage);
    target.hits += nonNegative(entry.hits);
    target.absorbed += nonNegative(entry.absorbed);
}

function averageDragChargeRatio(launchChargeRatios) {
    const valid = launchChargeRatios.filter((v) => Number.isFinite(v));
    return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;
}

function extractDragLaunchCharge(events) {
    return events.filter((e) => e.type === "launch" && Number.isFinite(e.chargeRatio)).map((e) => e.chargeRatio);
}

export function aggregateBattleMetrics(snapshots = []) {
    const validSnapshots = snapshots.filter((snapshot) => snapshot && typeof snapshot === "object");
    const durations = validSnapshots
        .map((snapshot) => nonNegative(snapshot.elapsed))
        .sort((left, right) => left - right);
    const totals = {
        wins: 0,
        losses: 0,
        draws: 0,
        timeouts: 0,
        damage: 0,
        equipmentDamage: 0,
        equipment: {},
        abilities: {},
        drag: {}
    };
    const focalDealtOriginTotals = {};
    const focalTakenOriginTotals = {};
    const originTotals = {};
    const dragLaunchCharges = [];
    const dragBounceCounts = [];
    const maxBounceTiers = {};
    const allFocalAbilityIds = new Set();
    for (const snapshot of validSnapshots) {
        if (snapshot.timedOut) totals.timeouts += 1;
        const focalId = snapshot.focalFighterId;
        if (focalId && snapshot.focalAbilityIds?.length) {
            for (const aid of snapshot.focalAbilityIds) allFocalAbilityIds.add(aid);
        }
        if (snapshot.winnerId && (!focalId || snapshot.winnerId === focalId)) totals.wins += 1;
        else if (snapshot.loserId && (!focalId || snapshot.loserId === focalId)) totals.losses += 1;
        else totals.draws += 1;
        for (const [origin, entry] of Object.entries(snapshot.damageByOrigin ?? {})) {
            totals.damage += nonNegative(entry.damage);
            mergeOriginRecord(getRecord(originTotals, origin, originRecord), entry);
        }
        const focalAbilities = focalId
            ? (snapshot.abilities ?? []).filter((a) => a.ownerId === focalId)
            : (snapshot.abilities ?? []);
        const abilitiesById = new Map();
        for (const ability of focalAbilities) {
            const entries = abilitiesById.get(ability.abilityId) ?? [];
            entries.push(ability);
            abilitiesById.set(ability.abilityId, entries);
        }
        const expectedAbilityIds = new Set([...(snapshot.focalAbilityIds ?? []), ...abilitiesById.keys()]);
        for (const abilityId of expectedAbilityIds) {
            const record = getRecord(totals.abilities, abilityId, () => ({
                uses: 0,
                firstElapsedSamples: [],
                matchesWithUse: 0
            }));
            const events = abilitiesById.get(abilityId) ?? [];
            increment(record, "uses", events.length);
            if (events.length) {
                record.matchesWithUse += 1;
                record.firstElapsedSamples.push(Math.min(...events.map((event) => nonNegative(event.elapsed))));
            }
        }
        for (const [templateId, entry] of Object.entries(snapshot.equipment ?? {})) {
            const equipment = getRecord(totals.equipment, templateId, () => ({
                triggers: 0,
                directDamage: 0,
                hits: 0,
                ownerDamage: 0
            }));
            increment(equipment, "triggers", nonNegative(entry.triggers));
            increment(equipment, "directDamage", nonNegative(entry.directDamage));
            increment(equipment, "hits", nonNegative(entry.hits));
            increment(equipment, "ownerDamage", nonNegative(entry.ownerDamage));
            totals.equipmentDamage += nonNegative(entry.directDamage);
        }
        for (const [origin, entry] of Object.entries(snapshot.focalDealtByOrigin ?? {})) {
            mergeOriginRecord(getRecord(focalDealtOriginTotals, origin, originRecord), entry);
        }
        for (const [origin, entry] of Object.entries(snapshot.focalTakenByOrigin ?? {})) {
            mergeOriginRecord(getRecord(focalTakenOriginTotals, origin, originRecord), entry);
        }
        const dragEvents = snapshot.dragEvents ?? [];
        for (const event of dragEvents) increment(totals.drag, event.type);
        const matchLaunchCharges = extractDragLaunchCharge(dragEvents);
        for (const cr of matchLaunchCharges) dragLaunchCharges.push(cr);
        const matchBounces = dragEvents.filter((e) => e.type === "bounce");
        dragBounceCounts.push(matchBounces.length);
        const matchMaxBounce = dragEvents.reduce((max, e) => Math.max(max, nonNegative(e.bounceCount)), 0);
        const tier = matchMaxBounce >= 4 ? "4+" : String(matchMaxBounce);
        increment(maxBounceTiers, tier);
    }
    const sampleCount = validSnapshots.length;
    const equipment = Object.fromEntries(
        Object.entries(totals.equipment).map(([templateId, entry]) => [
            templateId,
            {
                triggersPerMatch: sampleCount ? entry.triggers / sampleCount : 0,
                directDamagePerMatch: sampleCount ? entry.directDamage / sampleCount : 0,
                hitsPerMatch: sampleCount ? entry.hits / sampleCount : 0,
                directDamageRatio: entry.ownerDamage ? entry.directDamage / entry.ownerDamage : 0
            }
        ])
    );
    const abilityEntries = {};
    for (const [id, entry] of Object.entries(totals.abilities)) {
        const firstElapsedSamples = entry.firstElapsedSamples.sort((left, right) => left - right);
        abilityEntries[id] = {
            usesPerMatch: sampleCount ? entry.uses / sampleCount : 0,
            firstElapsed: firstElapsedSamples.length
                ? firstElapsedSamples.reduce((sum, elapsed) => sum + elapsed, 0) / firstElapsedSamples.length
                : 0,
            firstElapsedMedian: median(firstElapsedSamples),
            noUseRate: sampleCount ? 1 - entry.matchesWithUse / sampleCount : 1
        };
    }
    if (allFocalAbilityIds.size) {
        for (const abilityId of allFocalAbilityIds) {
            if (!abilityEntries[abilityId]) {
                abilityEntries[abilityId] = {
                    usesPerMatch: 0,
                    firstElapsed: 0,
                    firstElapsedMedian: 0,
                    noUseRate: 1
                };
            }
        }
    }
    const sortedChargeRatios = [...dragLaunchCharges].sort((a, b) => a - b);
    const dragDetail = {
        launchesPerMatch: sampleCount ? (totals.drag.launch ?? 0) / sampleCount : 0,
        averageLaunchChargeRatio: averageDragChargeRatio(dragLaunchCharges),
        medianLaunchChargeRatio: median(sortedChargeRatios),
        bouncesPerMatch: sampleCount ? dragBounceCounts.reduce((s, v) => s + v, 0) / sampleCount : 0,
        maxBounceTierDistribution: maxBounceTiers,
        hitTypes: {},
        endReasons: {}
    };
    for (const hitType of ["plain-hit", "rear-hit", "shield-counter"]) {
        dragDetail.hitTypes[hitType] = {
            count: totals.drag[hitType] ?? 0,
            perMatch: sampleCount ? (totals.drag[hitType] ?? 0) / sampleCount : 0
        };
    }
    for (const endReason of ["slow-stop", "timeout", "ally-stop"]) {
        dragDetail.endReasons[endReason] = {
            count: totals.drag[endReason] ?? 0,
            perMatch: sampleCount ? (totals.drag[endReason] ?? 0) / sampleCount : 0
        };
    }
    const focalDealtTotal = Object.values(focalDealtOriginTotals).reduce((s, o) => s + o.damage, 0);
    const focalTakenTotal = Object.values(focalTakenOriginTotals).reduce((s, o) => s + o.damage, 0);
    return {
        sampleCount,
        wins: totals.wins,
        losses: totals.losses,
        draws: totals.draws,
        timeouts: totals.timeouts,
        winRate: sampleCount ? totals.wins / sampleCount : 0,
        duration: {
            average: sampleCount ? durations.reduce((sum, value) => sum + value, 0) / sampleCount : 0,
            median: median(durations),
            p10: percentile(durations, 0.1),
            p90: percentile(durations, 0.9)
        },
        equipment,
        abilities: abilityEntries,
        drag: Object.fromEntries(
            Object.entries(totals.drag).map(([type, count]) => [
                type,
                { count, perMatch: sampleCount ? count / sampleCount : 0 }
            ])
        ),
        dragDetail,
        damageByOrigin: summarizeOriginMap(originTotals, sampleCount),
        focalDealtByOrigin: summarizeOriginMap(focalDealtOriginTotals, sampleCount),
        focalTakenByOrigin: summarizeOriginMap(focalTakenOriginTotals, sampleCount),
        focalDealtDragRatio: focalDealtTotal ? (focalDealtOriginTotals.drag?.damage ?? 0) / focalDealtTotal : 0,
        focalDealtDragCounterRatio: focalDealtTotal
            ? (focalDealtOriginTotals["drag-counter"]?.damage ?? 0) / focalDealtTotal
            : 0,
        focalTakenDragCounterRatio: focalTakenTotal
            ? (focalTakenOriginTotals["drag-counter"]?.damage ?? 0) / focalTakenTotal
            : 0,
        equipmentDirectDamageRatio: totals.damage ? totals.equipmentDamage / totals.damage : 0
    };
}
