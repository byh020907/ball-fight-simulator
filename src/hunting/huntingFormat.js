import { getRarityLabel } from "./rarityPresentation.js";

export function formatChestRarityCounts(chests) {
    if (!chests || chests.length === 0) return "";
    const counts = {};
    for (const chest of chests) {
        const r = chest.rarity ?? "common";
        counts[r] = (counts[r] ?? 0) + 1;
    }
    const parts = Object.entries(counts)
        .sort((a, b) => {
            const order = ["common", "uncommon", "rare", "epic", "legendary"];
            return order.indexOf(a[0]) - order.indexOf(b[0]);
        })
        .map(([rarity, count]) => `${getRarityLabel(rarity)} ${count}개`);
    return parts.join(", ");
}

export function formatPendingLootSummary(pendingLoot) {
    if (!pendingLoot) return "";
    const shards = pendingLoot.shards ?? 0;
    const enhancementStones = pendingLoot.enhancementStones ?? 0;
    const chests = pendingLoot.chests ?? [];
    if (shards <= 0 && enhancementStones <= 0 && chests.length === 0) return "";
    let text = `보유 파편 ${shards}`;
    if (enhancementStones > 0) {
        text += ` · 강화석 ${enhancementStones}`;
    }
    if (chests.length > 0) {
        text += ` · 미확보 상자 ${chests.length}개`;
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
    const chestText = formatChestRarityCounts(defeatLosses.chests);
    if (chestText) {
        parts.push(`${chestText} 파괴`);
    }
    return parts.join(" · ");
}
