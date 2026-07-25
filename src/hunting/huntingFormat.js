export function formatPendingLootSummary(pendingLoot) {
    if (!pendingLoot) return "";
    const shards = pendingLoot.shards ?? 0;
    const enhancementStones = pendingLoot.enhancementStones ?? 0;
    const equipmentEntries = Object.entries(pendingLoot.equipment ?? {});
    const equipmentCount = equipmentEntries.reduce((sum, [, count]) => sum + count, 0);
    if (shards <= 0 && enhancementStones <= 0 && equipmentCount === 0) return "";
    let text = `보유 파편 ${shards}`;
    if (enhancementStones > 0) {
        text += ` · 강화석 ${enhancementStones}`;
    }
    if (equipmentCount > 0) {
        text += ` · 장비 ${equipmentCount}개`;
    }
    return text;
}

export function formatDefeatLossText(defeatLosses) {
    if (!defeatLosses) return "";
    const parts = [];
    const shards = defeatLosses.shards ?? 0;
    const enhancementStones = defeatLosses.enhancementStones ?? 0;
    if (shards > 0) {
        parts.push(`파편 ${shards} 손실`);
    }
    if (enhancementStones > 0) {
        parts.push(`강화석 ${enhancementStones} 손실`);
    }
    return parts.join(" · ");
}
