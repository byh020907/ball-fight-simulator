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

function createFighterRecord() {
    return { dealt: 0, taken: 0 };
}

function getRecord(map, key, factory) {
    const normalizedKey = key ?? "unknown";
    map[normalizedKey] ??= factory();
    return map[normalizedKey];
}

export class BattleMetricsRecorder {
    constructor() {
        this.fighters = {};
        this.damageByLabel = {};
        this.damageByOrigin = {};
        this.equipment = {};
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
        increment(
            getRecord(this.damageByOrigin, origin, () => ({ damage: 0, hits: 0, absorbed: 0 })),
            "damage",
            actualDamage
        );
        increment(
            getRecord(this.damageByOrigin, origin, () => ({ damage: 0, hits: 0, absorbed: 0 })),
            "absorbed",
            absorbedDamage
        );
        if (actualDamage > 0)
            increment(
                getRecord(this.damageByOrigin, origin, () => ({ damage: 0, hits: 0, absorbed: 0 })),
                "hits"
            );
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

    snapshot({
        elapsed = 0,
        winner = null,
        loser = null,
        fighters = [],
        timedOut = false,
        focalFighterId = null
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
        return {
            elapsed: nonNegative(elapsed),
            winnerId: winner?.id ?? null,
            loserId: loser?.id ?? null,
            timedOut: Boolean(timedOut),
            fighters: fighterSnapshots,
            damageByLabel: structuredClone(this.damageByLabel),
            damageByOrigin: structuredClone(this.damageByOrigin),
            equipment: Object.fromEntries(
                Object.entries(this.equipment).map(([templateId, entry]) => [
                    templateId,
                    { ...entry, ownerDamage: nonNegative(this.fighters[entry.ownerId]?.dealt) }
                ])
            ),
            focalFighterId
        };
    }
}

export function aggregateBattleMetrics(snapshots = []) {
    const validSnapshots = snapshots.filter((snapshot) => snapshot && typeof snapshot === "object");
    const durations = validSnapshots
        .map((snapshot) => nonNegative(snapshot.elapsed))
        .sort((left, right) => left - right);
    const totals = { wins: 0, losses: 0, draws: 0, timeouts: 0, damage: 0, equipmentDamage: 0, equipment: {} };
    for (const snapshot of validSnapshots) {
        if (snapshot.timedOut) totals.timeouts += 1;
        if (snapshot.winnerId && (!snapshot.focalFighterId || snapshot.winnerId === snapshot.focalFighterId))
            totals.wins += 1;
        else if (snapshot.loserId && (!snapshot.focalFighterId || snapshot.loserId === snapshot.focalFighterId))
            totals.losses += 1;
        else totals.draws += 1;
        for (const origin of Object.values(snapshot.damageByOrigin ?? {})) totals.damage += nonNegative(origin.damage);
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
        equipmentDirectDamageRatio: totals.damage ? totals.equipmentDamage / totals.damage : 0
    };
}
