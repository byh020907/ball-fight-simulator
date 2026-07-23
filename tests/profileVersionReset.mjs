import assert from "node:assert/strict";
import {
    beginDebugProfileSession,
    createDefaultPlayerProfile,
    endDebugProfileSession,
    isDebugProfileSessionActive,
    loadPlayerProfile,
    migratePlayerProfile,
    PLAYER_PROFILE_STORAGE_KEY,
    PROFILE_VERSION,
    resetStaleSessionStorage,
    savePlayerProfile,
    SESSION_STORAGE_VERSION_KEY
} from "../src/playerProfile.js";
import { grantAchievementReward } from "../src/collection/achievementRewards.js";
import { ACHIEVEMENT_DEFINITIONS } from "../src/collection/achievementDefinitions.js";
import { openHuntingChest } from "../src/hunting/chestRewards.js";
import { EQUIPMENT_SPECIAL_OPTION_SUFFIXES } from "../src/hunting/equipmentConfig.js";
import { getLevelRequirement } from "../src/experience/experienceConfig.js";
import { getCharacterExperienceSummary } from "../src/experience/experienceService.js";
import { setDeveloperCharacterToMaxLevel, setDeveloperRebirthCount } from "../src/developer/developerTools.js";
import { setDeveloperHiddenCharacterUnlocked } from "../src/developer/developerTools.js";
import { createRebirthStatReward, getRebirthPresentation } from "../src/rebirth/index.js";
import {
    createDefaultRebirthArea,
    migrateRebirthArea,
    REBIRTH_SCHEMA_VERSION
} from "../src/rebirth/rebirthMigrations.js";

function createSessionStorage(values = {}) {
    const data = new Map(Object.entries(values));
    return {
        get length() {
            return data.size;
        },
        getItem(key) {
            return data.get(key) ?? null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        removeItem(key) {
            data.delete(key);
        },
        key(index) {
            return [...data.keys()][index] ?? null;
        }
    };
}

const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const profileStorage = createSessionStorage();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: profileStorage });

const persistentProfile = createDefaultPlayerProfile();
persistentProfile.hunting.shards = 120;
assert.equal(savePlayerProfile(persistentProfile), true);
const persistedBeforeDebug = profileStorage.getItem(PLAYER_PROFILE_STORAGE_KEY);
const debugProfile = beginDebugProfileSession(persistentProfile);
assert.equal(isDebugProfileSessionActive(), true);
assert.notEqual(debugProfile, persistentProfile, "Debug mode should work on a cloned profile");
debugProfile.hunting.shards = 999;
assert.equal(setDeveloperHiddenCharacterUnlocked(debugProfile, "elementalist", true).unlocked, true);
assert.equal(savePlayerProfile(debugProfile), true);
assert.equal(
    profileStorage.getItem(PLAYER_PROFILE_STORAGE_KEY),
    persistedBeforeDebug,
    "Debug profile saves must not write to localStorage"
);
assert.equal(loadPlayerProfile().hunting.shards, 999, "Debug reads should stay in the memory-only profile");
assert.deepEqual(loadPlayerProfile().unlockedCharacterIds, ["elementalist"]);
const restoredProfile = endDebugProfileSession();
assert.equal(isDebugProfileSessionActive(), false);
assert.equal(restoredProfile.hunting.shards, 120, "Ending debug mode should restore the persistent profile snapshot");
assert.deepEqual(
    restoredProfile.unlockedCharacterIds,
    [],
    "Debug hidden unlock must not escape the memory-only session"
);
assert.equal(
    loadPlayerProfile().hunting.shards,
    120,
    "Persistent localStorage should remain untouched after debug mode"
);

const developerProfile = createDefaultPlayerProfile();
const developerCharacterId = "rage";
const maxLevelResult = setDeveloperCharacterToMaxLevel(developerProfile, developerCharacterId);
assert.equal(maxLevelResult.ok, true);
assert.equal(getCharacterExperienceSummary(developerProfile, developerCharacterId).level, 10);
assert.equal(developerProfile.experience.currentXp, getLevelRequirement(10));
const rebirthResult = setDeveloperRebirthCount(developerProfile, developerCharacterId, 1_200);
assert.equal(rebirthResult.rebirthCount, 999, "Debug rebirth input should keep a finite upper boundary");
assert.deepEqual(developerProfile.rebirth.byCharacter[developerCharacterId].equippedCardIds, []);
assert.equal(setDeveloperRebirthCount(developerProfile, "unknown", 2).error, "unknown_character");
assert.equal(setDeveloperHiddenCharacterUnlocked(developerProfile, "elementalist", true).unlocked, true);
assert.deepEqual(developerProfile.unlockedCharacterIds, ["elementalist"]);
assert.equal(setDeveloperHiddenCharacterUnlocked(developerProfile, "elementalist", false).unlocked, false);
assert.deepEqual(developerProfile.unlockedCharacterIds, []);

if (originalLocalStorage) Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
else delete globalThis.localStorage;

const staleStorage = createSessionStorage({
    "bfs:old-overlay": "stale",
    unrelated: "preserve"
});
assert.equal(resetStaleSessionStorage(staleStorage), true);
assert.equal(staleStorage.getItem("bfs:old-overlay"), null);
assert.equal(staleStorage.getItem("unrelated"), "preserve");
assert.equal(staleStorage.getItem(SESSION_STORAGE_VERSION_KEY), String(PROFILE_VERSION));
assert.equal(resetStaleSessionStorage(staleStorage), false);

const staleProfile = { ...createDefaultPlayerProfile(), version: PROFILE_VERSION - 1 };
assert.equal(migratePlayerProfile(staleProfile).version, PROFILE_VERSION);
assert.deepEqual(migratePlayerProfile(staleProfile).equipment.inventory, []);

const currentHiddenProfile = createDefaultPlayerProfile();
currentHiddenProfile.unlockedCharacterIds = ["elementalist", "elementalist", "unknown-hidden"];
currentHiddenProfile.hunting.shards = 321;
currentHiddenProfile.characterMastery.levels.archer = 2;
const sanitizedHiddenProfile = migratePlayerProfile(currentHiddenProfile);
assert.deepEqual(sanitizedHiddenProfile.unlockedCharacterIds, ["elementalist"]);
assert.equal(
    sanitizedHiddenProfile.hunting.shards,
    321,
    "v10 hidden unlock normalization must preserve hunting progress"
);
assert.equal(
    sanitizedHiddenProfile.characterMastery.levels.archer,
    2,
    "v10 hidden unlock normalization must preserve mastery progress"
);

const companionPreferenceProfile = createDefaultPlayerProfile();
companionPreferenceProfile.hunting.lastCompanionIds = ["hero", "hero", "unknown", "eater", "dash"];
assert.deepEqual(
    migratePlayerProfile(companionPreferenceProfile).hunting.lastCompanionIds,
    ["hero", "eater"],
    "Saved companion preferences should keep at most two unique known characters"
);

const legacyRebirthProfile = createDefaultPlayerProfile();
delete legacyRebirthProfile.rebirth.schemaVersion;
legacyRebirthProfile.hunting.shards = 417;
legacyRebirthProfile.characterMastery.levels.rage = 2;
legacyRebirthProfile.experience.byCharacter.archer = { currentXp: getLevelRequirement(10) };
legacyRebirthProfile.experience.currentXp = getLevelRequirement(10);
legacyRebirthProfile.rebirth.byCharacter.archer = {
    rebirthCount: 7,
    statBonuses: { hp: 40, damage: 3, speed: 2, defense: 1 },
    cardRanks: {
        "ability:rage": 9,
        "ability:elementalist": 3,
        "passive:global-cooldown": 8
    },
    equippedCardIds: ["ability:rage", "ability:elementalist", "passive:global-cooldown"],
    pendingOfferCardIds: ["ability:rage"]
};
const migratedLegacyRebirthProfile = migratePlayerProfile(legacyRebirthProfile);
const migratedLegacyRebirth = migratedLegacyRebirthProfile.rebirth.byCharacter.archer;
assert.equal(migratedLegacyRebirthProfile.rebirth.schemaVersion, REBIRTH_SCHEMA_VERSION);
assert.deepEqual(migratedLegacyRebirth.cardRanks, {
    "ability:rage": 4,
    "ability:elementalist": 3,
    "passive:global-cooldown": 3
});
assert.equal(migratedLegacyRebirth.rebirthCount, 7);
assert.deepEqual(migratedLegacyRebirth.statBonuses, { hp: 40, damage: 3, speed: 2, defense: 1 });
assert.deepEqual(migratedLegacyRebirth.equippedCardIds, [
    "ability:rage",
    "ability:elementalist",
    "passive:global-cooldown"
]);
assert.equal(migratedLegacyRebirth.pendingOfferNeedsRegeneration, true);
assert.deepEqual(migratedLegacyRebirth.pendingOfferCards, []);
assert.equal(migratedLegacyRebirthProfile.hunting.shards, 417);
assert.equal(migratedLegacyRebirthProfile.characterMastery.levels.rage, 2);
const regeneratedPresentation = getRebirthPresentation(migratedLegacyRebirthProfile, "archer", () => 0);
assert.equal(regeneratedPresentation.pendingOfferCards.length, 3);
assert.equal(migratedLegacyRebirthProfile.rebirth.byCharacter.archer.pendingOfferNeedsRegeneration, false);

const expectedLegacyCooldownRanks = [1, 1, 2, 2, 2, 3, 3, 3, 4, 4];
for (const [index, expectedRank] of expectedLegacyCooldownRanks.entries()) {
    const migratedArea = migrateRebirthArea({
        byCharacter: {
            archer: {
                cardRanks: { "passive:global-cooldown": index + 1 }
            }
        }
    });
    assert.equal(migratedArea.byCharacter.archer.cardRanks["passive:global-cooldown"], expectedRank);
}

const futureRebirthProfile = createDefaultPlayerProfile();
futureRebirthProfile.hunting.shards = 812;
futureRebirthProfile.rebirth = {
    schemaVersion: REBIRTH_SCHEMA_VERSION + 1,
    byCharacter: { archer: { rebirthCount: 99 } }
};
const migratedFutureRebirthProfile = migratePlayerProfile(futureRebirthProfile);
assert.deepEqual(migratedFutureRebirthProfile.rebirth, createDefaultRebirthArea());
assert.equal(
    migratedFutureRebirthProfile.hunting.shards,
    812,
    "A future rebirth schema must reset only the rebirth region"
);
assert.deepEqual(
    migrateRebirthArea({ schemaVersion: 0, byCharacter: { archer: { rebirthCount: 3 } } }, new Map()),
    createDefaultRebirthArea(),
    "Removing a required migration step must reset only that region through the common runner"
);

const versionEightProfile = createDefaultPlayerProfile();
const persistedRebirthOffer = createRebirthStatReward(0, () => 0);
versionEightProfile.version = 8;
versionEightProfile.equipment.inventory = [{ instanceId: "preserved-version-eight-equipment", name: "보존 장비" }];
versionEightProfile.rebirth.byCharacter.archer = {
    rebirthCount: 2,
    statBonuses: { hp: 40, damage: 4, speed: 0, defense: 0 },
    cardRanks: {},
    equippedCardIds: [],
    pendingOfferCards: [
        {
            id: persistedRebirthOffer.id,
            type: persistedRebirthOffer.type,
            offerSlot: persistedRebirthOffer.offerSlot,
            stats: { ...persistedRebirthOffer.stats }
        }
    ]
};
const migratedVersionEightProfile = migratePlayerProfile(versionEightProfile);
assert.equal(migratedVersionEightProfile.version, PROFILE_VERSION);
assert.equal(migratedVersionEightProfile.equipment.inventory[0].instanceId, "preserved-version-eight-equipment");
assert.deepEqual(
    migratedVersionEightProfile.rebirth.byCharacter.archer.pendingOfferCards,
    versionEightProfile.rebirth.byCharacter.archer.pendingOfferCards,
    "Profile migration must preserve a pending rebirth reward's exact material"
);

const legacyFixedStatOfferProfile = createDefaultPlayerProfile();
legacyFixedStatOfferProfile.version = 8;
legacyFixedStatOfferProfile.rebirth.byCharacter.archer = {
    rebirthCount: 1,
    statBonuses: { hp: 0, damage: 0, speed: 0, defense: 0 },
    cardRanks: {},
    equippedCardIds: [],
    pendingOfferCardIds: ["rebirth-stat:archer:balanced"]
};
assert.deepEqual(
    migratePlayerProfile(legacyFixedStatOfferProfile).rebirth.byCharacter.archer.pendingOfferCards,
    [],
    "Legacy fixed-stat offers must be discarded instead of applying stale values"
);

const versionSevenProfile = createDefaultPlayerProfile();
versionSevenProfile.version = 7;
versionSevenProfile.experience.byCharacter.archer = { currentXp: getLevelRequirement(10) };
versionSevenProfile.experience.currentXp = getLevelRequirement(10);
versionSevenProfile.characterMastery.levels.rage = 2;
versionSevenProfile.equipment.inventory = [{ instanceId: "preserved-equipment", name: "보존 장비" }];
versionSevenProfile.collection.characters.archer = {
    tournamentsCompleted: 4,
    tournamentWins: 2,
    matchWins: 8,
    bestPlacement: 1,
    totalDamageDealt: 100,
    comebackMatchWins: 1,
    firstTournamentAt: 1,
    lastTournamentAt: 2
};
const migratedVersionSevenProfile = migratePlayerProfile(versionSevenProfile);
assert.equal(migratedVersionSevenProfile.version, PROFILE_VERSION);
assert.equal(migratedVersionSevenProfile.experience.byCharacter.archer.currentXp, getLevelRequirement(10));
assert.equal(migratedVersionSevenProfile.characterMastery.levels.rage, 2);
assert.equal(migratedVersionSevenProfile.equipment.inventory[0].instanceId, "preserved-equipment");
assert.equal(migratedVersionSevenProfile.collection.characters.archer.tournamentWins, 2);
assert.deepEqual(migratedVersionSevenProfile.rebirth, { schemaVersion: 1, byCharacter: {} });

const rewardProfile = createDefaultPlayerProfile();
const shardReward = grantAchievementReward(rewardProfile, {
    id: "first_tournament_win",
    grant(handler) {
        return handler.shards(30);
    }
});
assert.equal(shardReward.shards, 30);
assert.equal(rewardProfile.hunting.shards, 30);

const chestReward = grantAchievementReward(rewardProfile, {
    id: "comeback_match_win",
    grant(handler) {
        return handler.chest("uncommon");
    }
});
assert.equal(chestReward.chest.rarity, "uncommon");
assert.equal(rewardProfile.hunting.chests.length, 1);

const flawlessAchievement = ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === "flawless_tournament");
const equipmentReward = grantAchievementReward(rewardProfile, flawlessAchievement);
assert.equal(equipmentReward.equipment.rarity, "rare");
assert.equal(equipmentReward.equipment.name, `무결점의 수정 방패 • ${EQUIPMENT_SPECIAL_OPTION_SUFFIXES.wallBounce}`);
assert.deepEqual(equipmentReward.equipment.stats, [
    { type: "defense", value: 2, min: 2, max: 2 },
    { type: "hp", value: 20, min: 20, max: 20 }
]);
assert.deepEqual(equipmentReward.equipment.specialOptions, [{ type: "wallBounce", value: 15 }]);
assert.equal(rewardProfile.equipment.inventory.length, 1);

rewardProfile.equipment.inventory = Array.from({ length: rewardProfile.equipment.maxInventorySlots }, (_, index) => ({
    instanceId: `full-${index}`
}));
const rosterChampion = ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === "roster_champion");
const overflowReward = grantAchievementReward(rewardProfile, rosterChampion);
assert.equal(overflowReward.convertedToChest, true);
assert.equal(overflowReward.chest.rarity, "epic");
assert.equal(overflowReward.chest.openCost, 0);
assert.equal(
    overflowReward.chest.guaranteedEquipment.name,
    `개척자의 룬 귀걸이 • ${EQUIPMENT_SPECIAL_OPTION_SUFFIXES.cooldown}`
);
assert.deepEqual(overflowReward.chest.guaranteedEquipment.specialOptions, [
    { type: "cooldown", value: 10 },
    { type: "hpSteal", value: 8 }
]);

rewardProfile.equipment.inventory = [];
const openedGuaranteedChest = openHuntingChest(rewardProfile, overflowReward.chest.id);
assert.equal(openedGuaranteedChest.opened, true);
assert.equal(openedGuaranteedChest.cost, 0);
assert.equal(
    openedGuaranteedChest.applied.equipment.name,
    `개척자의 룬 귀걸이 • ${EQUIPMENT_SPECIAL_OPTION_SUFFIXES.cooldown}`
);
assert.deepEqual(openedGuaranteedChest.applied.equipment.specialOptions, [
    { type: "cooldown", value: 10 },
    { type: "hpSteal", value: 8 }
]);

const guaranteedEquipmentExpectations = [
    {
        achievementId: "flawless_tournament",
        name: "무결점의 수정 방패",
        stats: [
            { type: "defense", value: 2, min: 2, max: 2 },
            { type: "hp", value: 20, min: 20, max: 20 }
        ],
        specialOptions: [{ type: "wallBounce", value: 15 }]
    },
    {
        achievementId: "roster_champion",
        name: "개척자의 룬 귀걸이",
        stats: [
            { type: "damage", value: 3, min: 3, max: 3 },
            { type: "speed", value: 15, min: 15, max: 15 }
        ],
        specialOptions: [
            { type: "cooldown", value: 10 },
            { type: "hpSteal", value: 8 }
        ]
    },
    {
        achievementId: "mastery_complete",
        name: "도감 완성의 영원한 망토",
        stats: [
            { type: "hp", value: 40, min: 40, max: 40 },
            { type: "defense", value: 4, min: 4, max: 4 }
        ],
        specialOptions: [{ type: "angularImpulse", value: 15 }]
    },
    {
        achievementId: "single_hit_monster",
        name: "단죄의 수정 단검",
        stats: [
            { type: "damage", value: 3, min: 3, max: 3 },
            { type: "speed", value: 10, min: 10, max: 10 }
        ],
        specialOptions: [{ type: "crashDamage", value: 15 }]
    }
];

for (const expectation of guaranteedEquipmentExpectations) {
    const profile = createDefaultPlayerProfile();
    const achievement = ACHIEVEMENT_DEFINITIONS.find(({ id }) => id === expectation.achievementId);
    const granted = grantAchievementReward(profile, achievement);
    assert.equal(
        granted.equipment.name,
        `${expectation.name} • ${EQUIPMENT_SPECIAL_OPTION_SUFFIXES[expectation.specialOptions[0].type]}`
    );
    assert.deepEqual(granted.equipment.stats, expectation.stats);
    assert.deepEqual(granted.equipment.specialOptions, expectation.specialOptions);
}

const legacySpecialEquipmentProfile = migratePlayerProfile({
    ...createDefaultPlayerProfile(),
    equipment: {
        inventory: [
            {
                instanceId: "legacy-special-name",
                rarity: "rare",
                slot: "weapon",
                name: "질풍의 철검 반향",
                baseName: "철검",
                description: "테스트 장비",
                stats: [{ type: "speed", value: 10, min: 10, max: 10 }],
                specialOptions: [{ type: "wallBounce", value: 15 }]
            }
        ],
        equipped: { weapon: null, armor: null, accessory1: null, accessory2: null },
        enhancementStones: 0,
        maxInventorySlots: 5
    }
});
assert.equal(
    legacySpecialEquipmentProfile.equipment.inventory[0].name,
    "질풍의 철검 • 반향",
    "Existing special equipment should normalize its legacy name during profile migration"
);

assert.ok(ACHIEVEMENT_DEFINITIONS.every((achievement) => typeof achievement.grant === "function"));

console.log("[profile-version-reset] ok");
