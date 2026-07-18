// ── 컬렉션 허브 ViewModel ───────────────────────────────────────────────────
//
// profile + roster + mastery/achievement definitions → UI 전용 데이터 생성.
// Alpine 템플릿과 UIController는 이 ViewModel을 통해 데이터를 표시한다.
// ─────────────────────────────────────────────────────────────────────────────

import { formatAchievementReward } from "./achievementRewards.js";
import { getCharacterMasteryLevel } from "../character-mastery/index.js";
import { getCharacterExperienceSummary } from "../experience/experienceService.js";
import { getCharacterLevelRewards } from "../experience/characterLevelProgression.js";
import {
    canOpenHuntingChest,
    ELITE_MOB_COMBINATIONS,
    getDailyShop,
    HUNTING_DEBUG_ENCOUNTER_TYPES,
    getHuntingMonsterDefinitions,
    previewHuntingChest
} from "../hunting/index.js";
import { HUNTING_EVENT_TYPES, HUNTING_MAX_FLOOR, HUNTING_STAGES } from "../hunting/huntingConfig.js";
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
    getEquipmentSpecialOptionDescription,
    calculateEnhanceCost,
    calculateEnhanceFailureRate,
    ENHANCE_MAX_LEVEL
} from "../hunting/equipmentConfig.js";
import { getRebirthPresentation } from "../rebirth/rebirthService.js";

export const COLLECTION_HUB_TABS = Object.freeze([
    { id: "roster", label: "도감" },
    { id: "mastery", label: "숙련도" },
    { id: "achievements", label: "업적" },
    { id: "storage", label: "보관함" },
    { id: "equipment", label: "장비" }
]);

const MONSTER_FACE_LABELS = Object.freeze({
    default: "o",
    angry: "!",
    dash: ">",
    cyclops: "@",
    ooo: "O",
    happy: "^",
    xeye: "x"
});

const HUNTING_DEBUG_EVENT_OPTIONS = Object.freeze([
    { id: HUNTING_EVENT_TYPES.PORTAL, label: "귀환 포탈" },
    { id: HUNTING_EVENT_TYPES.WANDERING_MERCHANT, label: "방랑 상인" },
    { id: HUNTING_EVENT_TYPES.BOON, label: "축복" },
    { id: HUNTING_EVENT_TYPES.MISHAP, label: "함정" },
    { id: HUNTING_EVENT_TYPES.CHEST_ROOM, label: "상자방" },
    { id: HUNTING_EVENT_TYPES.REST_SITE, label: "휴식지" },
    { id: HUNTING_EVENT_TYPES.CURSED_ALTAR, label: "저주받은 제단" },
    { id: HUNTING_EVENT_TYPES.CHAMPION_INTRUSION, label: "챔피언 난입" },
    { id: HUNTING_EVENT_TYPES.ELITE_MOB, label: "정예 몹 습격" }
]);

const HUNTING_DEBUG_ENCOUNTER_OPTIONS = Object.freeze([
    { id: HUNTING_DEBUG_ENCOUNTER_TYPES.NORMAL, label: "일반 몬스터" },
    { id: HUNTING_DEBUG_ENCOUNTER_TYPES.MINIBOSS, label: "중간 보스" },
    { id: HUNTING_DEBUG_ENCOUNTER_TYPES.CHAMPION, label: "챔피언" },
    { id: HUNTING_DEBUG_ENCOUNTER_TYPES.ELITE, label: "정예 조합" },
    { id: HUNTING_DEBUG_ENCOUNTER_TYPES.FINAL_BOSS, label: "최종 보스" }
]);

function createHuntingDebugEliteCombinationOptions() {
    const monsterNames = new Map(getHuntingMonsterDefinitions().map((monster) => [monster.type, monster.displayName]));
    return ELITE_MOB_COMBINATIONS.map((combination) => ({
        id: combination.id,
        minimumFloor: combination.minimumFloor,
        label: `${combination.minimumFloor}층 · ${combination.monsterTypes
            .map((type) => monsterNames.get(type) ?? type)
            .join(" + ")}`
    }));
}

function getMonsterRarity(monster) {
    return monster.monsterTags.find((tag) => tag.startsWith("rarity:"))?.slice("rarity:".length) ?? "common";
}

function createMonsterCodexItems(hunting) {
    const monsterCodexByType = hunting.stats?.monsterCodexByType ?? {};
    const visitedStageIds = new Set(hunting.stats?.visitedStageIds ?? []);
    const baseDefinitions = getHuntingMonsterDefinitions();

    return baseDefinitions.map((base) => {
        const record = monsterCodexByType[base.type] ?? null;
        const rarity = getMonsterRarity(base);
        const regions = HUNTING_STAGES.filter((stage) => visitedStageIds.has(stage.id)).map((stage) => {
            const definition =
                getHuntingMonsterDefinitions(stage.id).find((monster) => monster.type === base.type) ?? base;
            const regionRecord = record?.regions?.[stage.id] ?? null;
            return {
                id: stage.id,
                name: stage.name,
                isDiscovered:
                    Number.isFinite(regionRecord?.firstEncounterFloor) && regionRecord.firstEncounterFloor > 0,
                color: definition.color,
                faceLabel: MONSTER_FACE_LABELS[definition.face] ?? "o",
                behaviorDescription: definition.behaviorDescription,
                stats: definition.stats,
                kills: regionRecord?.kills ?? 0,
                firstEncounterFloor: regionRecord?.firstEncounterFloor ?? null,
                lastEncounterFloor: regionRecord?.lastEncounterFloor ?? null
            };
        });

        return {
            id: base.type,
            type: base.type,
            name: base.displayName,
            color: base.color,
            faceLabel: MONSTER_FACE_LABELS[base.face] ?? "o",
            rarity,
            rarityLabel: getRarityLabel(rarity),
            isDiscovered: Number.isFinite(record?.firstEncounterFloor) && record.firstEncounterFloor > 0,
            kills: record?.kills ?? 0,
            firstEncounterFloor: record?.firstEncounterFloor ?? null,
            lastEncounterFloor: record?.lastEncounterFloor ?? null,
            regions
        };
    });
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
    currentPlayerFighterId = null,
    developerMode = false
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
        const rebirth = getRebirthPresentation(profile, fighter.id);

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
            levelRewards,
            rebirth
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

    const monsterCodexItems = createMonsterCodexItems(hunting);

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
                label: getEquipmentSpecialOptionLabel(option.type),
                description: getEquipmentSpecialOptionDescription(option.type)
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
    const discoveredMonsterCount = monsterCodexItems.filter((item) => item.isDiscovered).length;
    const masteryTotal = cumulativeLevels;

    return {
        rosterSize,
        rosterItems,
        monsterCodexItems,
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
            discoveredMonsterCount,
            totalMonsterCount: monsterCodexItems.length,
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
        },
        developer: {
            active: developerMode,
            currentCharacterId: currentPlayerFighterId,
            maxFloor: HUNTING_MAX_FLOOR,
            stages: HUNTING_STAGES.map((stage) => ({ id: stage.id, name: stage.name })),
            events: HUNTING_DEBUG_EVENT_OPTIONS,
            encounters: HUNTING_DEBUG_ENCOUNTER_OPTIONS,
            eliteCombinations: createHuntingDebugEliteCombinationOptions()
        }
    };
}
