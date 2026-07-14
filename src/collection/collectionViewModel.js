// ── 컬렉션 허브 ViewModel ───────────────────────────────────────────────────
//
// profile + roster + mastery/achievement definitions → UI 전용 데이터 생성.
// Alpine 템플릿과 UIController는 이 ViewModel을 통해 데이터를 표시한다.
// ─────────────────────────────────────────────────────────────────────────────

import { formatAchievementReward } from "./achievementRewards.js";
import { getCharacterMasteryLevel } from "../character-mastery/index.js";
import { getCharacterExperienceSummary } from "../experience/experienceService.js";
import { getCharacterLevelRewards } from "../experience/characterLevelProgression.js";
import { canOpenHuntingChest, getDailyShop, previewHuntingChest } from "../hunting/index.js";
import { getConsumableShopItems, getHuntingConsumableUseLimitUpgrade } from "../consumables.js";
import { getRarityLabel } from "../hunting/rarityPresentation.js";
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
    EQUIPMENT_RARITIES,
    FUSION_SOURCE_ITEM_COUNT,
    canCharacterEquipItem,
    getCharacterEquipmentLevel,
    getEquipmentRequiredLevel,
    getEquipmentSpecialOptionLabel,
    calculateEnhanceCost,
    calculateEnhanceFailureRate,
    ENHANCE_MAX_LEVEL
} from "../hunting/equipmentConfig.js";

export const COLLECTION_HUB_TABS = Object.freeze([
    { id: "roster", label: "도감" },
    { id: "mastery", label: "숙련도" },
    { id: "achievements", label: "업적" },
    { id: "storage", label: "보관함" },
    { id: "equipment", label: "장비" }
]);

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
    const characters = profile?.collection?.characters ?? {};
    const careerStats = profile?.collection?.careerStats ?? {};
    const hunting = profile?.hunting ?? {};

    // 도감 항목
    const rosterItems = roster.map((fighter) => {
        const record = characters[fighter.id] || {};
        const tournamentWins = record.tournamentWins ?? 0;
        const hasRecord = record.tournamentsCompleted > 0;
        const masteryLevel = getCharacterMasteryLevel(profile, fighter.id);
        const masteryUnlocked = masteryLevel > 0;
        const masteryActive = masteryUnlocked && fighter.id !== currentPlayerFighterId;
        const isCurrent = fighter.id === currentPlayerFighterId;
        const experience = getCharacterExperienceSummary(profile, fighter.id);
        const levelRewards = getCharacterLevelRewards(fighter.id).map((reward) => ({
            id: reward.id,
            level: reward.level,
            text: reward.text,
            earned: reward.level <= experience.level,
            statusLabel: reward.level <= experience.level ? "획득" : "예정"
        }));

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
            experienceNextRewardText: experience.nextRewardText,
            levelRewards
        };
    });

    // 숙련도 항목
    const masteryItems = masteryDefinitions.map((def) => {
        const level = getCharacterMasteryLevel(profile, def.sourceFighterId);
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
            level,
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
        const progress = typeof def.getProgress === "function" ? def.getProgress({ profile, roster }) : null;
        const progressText =
            progress && Number.isFinite(progress.target)
                ? `${Math.min(progress.current ?? 0, progress.target)} / ${progress.target}`
                : "";
        return {
            id: def.id,
            name: def.name,
            description: def.description,
            tier: def.tier || "bronze",
            unlocked,
            unlockedAt: state?.unlockedAt ?? null,
            reward: def.reward ?? null,
            rewardText: rewardDesc,
            progressText
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
            rarityLabel: getRarityLabel(item.rarity),
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
            canEnhance: level < ENHANCE_MAX_LEVEL && stones >= cost.stones && shards >= cost.shards,
            enhanceCost: cost,
            enhanceFailureRate: calculateEnhanceFailureRate(level)
        };
    });
    const fusionRecipes = EQUIPMENT_RARITIES.flatMap((rarity) => {
        const nextRarity = getNextEquipmentRarity(rarity);
        const cost = getFusionCost(rarity);
        if (!nextRarity || !cost) return [];

        return [
            {
                rarity,
                rarityLabel: getRarityLabel(rarity),
                nextRarity,
                nextRarityLabel: getRarityLabel(nextRarity),
                cost,
                items: equipmentItems.filter((item) => item.rarity === rarity)
            }
        ];
    });

    const storageItems = (hunting.chests ?? []).map((chest) => {
        const preview = previewHuntingChest(chest);
        return {
            id: chest.id,
            rarity: preview.rarity,
            rarityLabel: getRarityLabel(preview.rarity),
            acquiredAt: chest.acquiredAt ?? null,
            openCost: preview.cost,
            rewardText: preview.rewardText,
            canOpen: canOpenHuntingChest(profile, chest)
        };
    });
    const consumableShopItems = getConsumableShopItems(profile);
    const huntingConsumableUseLimitUpgrade = getHuntingConsumableUseLimitUpgrade(profile);

    // 요약
    const playedCharacters = rosterItems.filter((item) => item.hasRecord).length;
    const cumulativeLevels = rosterItems.reduce((sum, item) => sum + item.masteryLevel, 0);
    const maxLevels = rosterItems.length * 3;
    const unlockedMastery = masteryItems.filter((item) => item.unlocked).length;
    const unlockedAchievements = achievementItems.filter((item) => item.unlocked).length;
    const masteryTotal = cumulativeLevels;

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
            fusion: {
                sourceItemCount: FUSION_SOURCE_ITEM_COUNT,
                recipes: fusionRecipes
            },
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
            dailyShop: getDailyShop(profile),
            consumables: consumableShopItems,
            huntingConsumableUseLimitUpgrade,
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
