// ── 컬렉션 허브 ViewModel ───────────────────────────────────────────────────
//
// profile + roster + mastery/achievement definitions → UI 전용 데이터 생성.
// Alpine 템플릿과 UIController는 이 ViewModel을 통해 데이터를 표시한다.
// ─────────────────────────────────────────────────────────────────────────────

import { formatAchievementReward } from "./achievementRewards.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";
import { getCharacterExperienceSummary } from "../experience/experienceService.js";
import { canOpenHuntingChest, previewHuntingChest } from "../hunting/index.js";
import {
    getInventorySlots,
    getInventoryUsed,
    canExpandInventory,
    INVENTORY_EXPAND_COST,
    INVENTORY_EXPAND_GAIN,
    getDisassembleReward,
    getSellReward,
    getFusionCost,
    getNextEquipmentRarity,
    canFuseEquipment,
    canCharacterEquipItem,
    getCharacterEquipmentLevel,
    getEquipmentRequiredLevel,
    getEquipmentSpecialOptionLabel,
    calculateEnhanceCost,
    calculateEnhanceFailureRate,
    ENHANCE_MAX_LEVEL
} from "../hunting/equipmentConfig.js";

export const MASTERY_THRESHOLDS = REWARD_BALANCE.progression.masteryThresholds;
export const COLLECTION_HUB_TABS = Object.freeze([
    { id: "roster", label: "도감" },
    { id: "mastery", label: "숙련도" },
    { id: "achievements", label: "업적" },
    { id: "storage", label: "보관함" },
    { id: "equipment", label: "장비" }
]);

/** 숙련도 계산 */
export function getMasteryLevel(tournamentWins) {
    if (tournamentWins >= MASTERY_THRESHOLDS[2]) return 3;
    if (tournamentWins >= MASTERY_THRESHOLDS[1]) return 2;
    if (tournamentWins >= MASTERY_THRESHOLDS[0]) return 1;
    return 0;
}

export function getNextMasteryThreshold(currentLevel) {
    if (currentLevel >= 3) return null;
    return MASTERY_THRESHOLDS[currentLevel];
}

export function getMasteryProgress(tournamentWins) {
    const level = getMasteryLevel(tournamentWins);
    if (level >= 3) return 1;
    const nextThreshold = MASTERY_THRESHOLDS[level];
    if (level === 0) return Math.min(1, tournamentWins / nextThreshold);
    const prevThreshold = MASTERY_THRESHOLDS[level - 1];
    return (tournamentWins - prevThreshold) / (nextThreshold - prevThreshold);
}

/**
 * 컬렉션 허브 ViewModel 생성.
 * profile, roster, masteryDefinitions, achievementDefinitions, currentPlayerFighterId를 입력받는다.
 */
export function createCollectionHubViewModel({
    profile,
    roster,
    masteryDefinitions = [],
    achievementDefinitions = [],
    currentPlayerFighterId = null
} = {}) {
    const rosterSize = roster.length;
    const masteryLevels = profile?.characterMastery?.levels ?? {};
    const characters = profile?.collection?.characters ?? {};
    const careerStats = profile?.collection?.careerStats ?? {};
    const hunting = profile?.hunting ?? {};

    // 도감 항목
    const rosterItems = roster.map((fighter) => {
        const record = characters[fighter.id] || {};
        const tournamentWins = record.tournamentWins ?? 0;
        const mastery = getMasteryLevel(tournamentWins);
        const hasRecord = record.tournamentsCompleted > 0;
        const masteryLevel = masteryLevels[fighter.id] ?? 0;
        const masteryUnlocked = masteryLevel > 0;
        const masteryActive = masteryUnlocked && fighter.id !== currentPlayerFighterId;
        const isCurrent = fighter.id === currentPlayerFighterId;
        const experience = getCharacterExperienceSummary(profile, fighter.id);

        return {
            id: fighter.id,
            name: fighter.name,
            color: fighter.color,
            ability: fighter.ability,
            hasRecord,
            tournamentsCompleted: record.tournamentsCompleted ?? 0,
            tournamentWins,
            matchWins: record.matchWins ?? 0,
            bestPlacement: record.bestPlacement ?? null,
            totalDamageDealt: record.totalDamageDealt ?? 0,
            comebackMatchWins: record.comebackMatchWins ?? 0,
            firstTournamentAt: record.firstTournamentAt ?? null,
            lastTournamentAt: record.lastTournamentAt ?? null,
            mastery,
            masteryProgress: getMasteryProgress(tournamentWins),
            nextMasteryThreshold: getNextMasteryThreshold(mastery),
            isCurrent,
            masteryLevel,
            masteryUnlocked,
            masteryActive,
            experience,
            experienceLevel: experience.level,
            experienceLevelLabel: experience.levelLabel,
            experienceTotalXp: experience.totalXp,
            experienceProgressPct: experience.progressPct,
            experienceProgressText: experience.progressText,
            experienceNextText: experience.nextText,
            experienceNextRewardText: experience.nextRewardText
        };
    });

    // 숙련도 항목
    const masteryItems = masteryDefinitions.map((def) => {
        const level = masteryLevels[def.sourceFighterId] ?? 0;
        const unlocked = level > 0;
        const isSelf = def.sourceFighterId === currentPlayerFighterId;
        const active = unlocked && !isSelf;
        const sourceName = roster.find((f) => f.id === def.sourceFighterId)?.name ?? def.sourceFighterId;
        const unlockCondition = `${sourceName}으로 토너먼트 우승`;
        return {
            id: def.id,
            sourceFighterId: def.sourceFighterId,
            name: def.name,
            kind: def.kind,
            description: def.description,
            tierValues: def.tierValues,
            formatValue: def.formatValue,
            level: masteryLevels[def.sourceFighterId] ?? 0,
            unlocked,
            isSelf,
            active,
            sourceName,
            unlockCondition
        };
    });

    // 업적 항목
    const achievementItems = achievementDefinitions.map((def) => {
        const state = profile?.collection?.achievements?.[def.id];
        const unlocked = !!state?.unlockedAt;
        const rewardDesc = formatAchievementReward(def.reward);
        return {
            id: def.id,
            name: def.name,
            description: def.description,
            tier: def.tier || "bronze",
            unlocked,
            unlockedAt: state?.unlockedAt ?? null,
            reward: def.reward ?? null,
            rewardText: rewardDesc
        };
    });

    const equipment = profile?.equipment ?? {};
    const inventory = equipment.inventory ?? [];
    const equipped = equipment.equipped ?? {};
    const equippedIdSet = new Set(Object.values(equipped).filter(Boolean));
    const currentEquipmentLevel = getCharacterEquipmentLevel(profile, currentPlayerFighterId);

    const equipmentItems = inventory.map((item) => {
        const level = item.enhanceLevel ?? 0;
        const cost = calculateEnhanceCost(level);
        const stones = equipment.enhancementStones ?? 0;
        const shards = profile.hunting?.shards ?? 0;
        const requiredLevel = getEquipmentRequiredLevel(item);
        const canEquip = canCharacterEquipItem(profile, item, currentPlayerFighterId);
        return {
            instanceId: item.instanceId,
            rarity: item.rarity,
            slot: item.slot,
            name: item.name,
            description: item.description,
            stats: item.stats ?? [],
            specialOptions: (item.specialOptions ?? []).map((option) => ({
                ...option,
                label: getEquipmentSpecialOptionLabel(option.type)
            })),
            enhanceLevel: level,
            isEquipped: equippedIdSet.has(item.instanceId),
            requiredLevel,
            characterLevel: currentEquipmentLevel,
            levelLocked: !canEquip,
            canEquip,
            disassembleReward: getDisassembleReward(item.rarity),
            sellReward: getSellReward(item.rarity),
            fusionCost: getFusionCost(item.rarity),
            nextRarity: getNextEquipmentRarity(item.rarity),
            fusionPartnerCount: inventory.filter(
                (candidate) => candidate.instanceId !== item.instanceId && candidate.rarity === item.rarity
            ).length,
            canFuse: canFuseEquipment(profile, item.instanceId),
            canEnhance: level < ENHANCE_MAX_LEVEL && stones >= cost.stones && shards >= cost.shards,
            enhanceCost: cost,
            enhanceFailureRate: calculateEnhanceFailureRate(level)
        };
    });

    const storageItems = (hunting.chests ?? []).map((chest) => {
        const preview = previewHuntingChest(chest);
        return {
            id: chest.id,
            rarity: preview.rarity,
            acquiredAt: chest.acquiredAt ?? null,
            openCost: preview.cost,
            rewardText: preview.rewardText,
            canOpen: canOpenHuntingChest(profile, chest)
        };
    });

    // 요약
    const playedCharacters = rosterItems.filter((item) => item.hasRecord).length;
    const cumulativeLevels = rosterItems.reduce((sum, item) => sum + item.masteryLevel, 0);
    const maxLevels = rosterItems.length * 3;
    const unlockedMastery = masteryItems.filter((item) => item.unlocked).length;
    const unlockedAchievements = achievementItems.filter((item) => item.unlocked).length;
    const masteryTotal = rosterItems.reduce((sum, item) => sum + item.mastery, 0);

    return {
        rosterSize,
        rosterItems,
        masteryItems,
        achievementItems,
        summary: {
            cumulativeLevels,
            maxLevels,
            playedCharacters,
            rosterSize,
            unlockedMastery,
            totalMastery: masteryDefinitions.length,
            unlockedAchievements,
            totalAchievements: achievementDefinitions.length,
            masteryTotal,
            shards: hunting.shards ?? 0,
            storageChestCount: storageItems.length
        },
        equipment: {
            items: equipmentItems,
            enhancementStones: equipment.enhancementStones ?? 0,
            inventoryUsed: getInventoryUsed(profile),
            inventorySlots: getInventorySlots(profile),
            canExpand: canExpandInventory(profile),
            expandCost: INVENTORY_EXPAND_COST,
            expandGain: INVENTORY_EXPAND_GAIN,
            equippedSlots: {
                weapon: equipped.weapon ? (inventory.find((i) => i.instanceId === equipped.weapon)?.name ?? "—") : "—",
                armor: equipped.armor ? (inventory.find((i) => i.instanceId === equipped.armor)?.name ?? "—") : "—",
                accessory1: equipped.accessory1
                    ? (inventory.find((i) => i.instanceId === equipped.accessory1)?.name ?? "—")
                    : "—",
                accessory2: equipped.accessory2
                    ? (inventory.find((i) => i.instanceId === equipped.accessory2)?.name ?? "—")
                    : "—"
            }
        },
        storage: {
            shards: hunting.shards ?? 0,
            chests: storageItems,
            stats: {
                runsStarted: hunting.stats?.runsStarted ?? 0,
                runsRetreated: hunting.stats?.runsRetreated ?? 0,
                runsDefeated: hunting.stats?.runsDefeated ?? 0,
                deepestFloor: hunting.stats?.deepestFloor ?? 0
            }
        }
    };
}
