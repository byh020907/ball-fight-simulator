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

const equipmentReward = grantAchievementReward(
    rewardProfile,
    {
        id: "flawless_tournament",
        grant(handler) {
            return handler.equipment("rare");
        }
    },
    { rng: () => 0.5 }
);
assert.equal(equipmentReward.equipment.rarity, "rare");
assert.equal(rewardProfile.equipment.inventory.length, 1);

rewardProfile.equipment.inventory = Array.from({ length: rewardProfile.equipment.maxInventorySlots }, (_, index) => ({
    instanceId: `full-${index}`
}));
const overflowReward = grantAchievementReward(rewardProfile, {
    id: "roster_champion",
    grant(handler) {
        return handler.equipment("epic");
    }
});
assert.equal(overflowReward.convertedToChest, true);
assert.equal(overflowReward.chest.rarity, "epic");

assert.ok(ACHIEVEMENT_DEFINITIONS.every((achievement) => typeof achievement.grant === "function"));

console.log("[profile-version-reset] ok");
