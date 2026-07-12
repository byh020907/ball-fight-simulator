import assert from "node:assert/strict";
import {
    createDefaultPlayerProfile,
    migratePlayerProfile,
    PROFILE_VERSION,
    resetStaleSessionStorage,
    SESSION_STORAGE_VERSION_KEY
} from "../src/playerProfile.js";
import { grantAchievementReward } from "../src/collection/achievementRewards.js";
import { ACHIEVEMENT_DEFINITIONS } from "../src/collection/achievementDefinitions.js";
import { openHuntingChest } from "../src/hunting/chestRewards.js";

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
assert.equal(equipmentReward.equipment.name, "무결점의 수정 방패");
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
assert.equal(overflowReward.chest.guaranteedEquipment.name, "개척자의 룬 귀걸이");
assert.deepEqual(overflowReward.chest.guaranteedEquipment.specialOptions, [
    { type: "cooldown", value: 10 },
    { type: "hpSteal", value: 8 }
]);

rewardProfile.equipment.inventory = [];
const openedGuaranteedChest = openHuntingChest(rewardProfile, overflowReward.chest.id);
assert.equal(openedGuaranteedChest.opened, true);
assert.equal(openedGuaranteedChest.cost, 0);
assert.equal(openedGuaranteedChest.applied.equipment.name, "개척자의 룬 귀걸이");
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
    assert.equal(granted.equipment.name, expectation.name);
    assert.deepEqual(granted.equipment.stats, expectation.stats);
    assert.deepEqual(granted.equipment.specialOptions, expectation.specialOptions);
}

assert.ok(ACHIEVEMENT_DEFINITIONS.every((achievement) => typeof achievement.grant === "function"));

console.log("[profile-version-reset] ok");
