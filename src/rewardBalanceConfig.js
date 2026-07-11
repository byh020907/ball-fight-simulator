function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
}

// The single source of truth for player-facing reward and progression numbers.
export const REWARD_BALANCE = deepFreeze({
    experience: {
        xpScale: 20,
        stageMultipliers: { round1: 1, round2: 1.2, final: 2.5, winBonus: 1 },
        comebackThreshold: 0.3,
        comebackWeight: 0.5,
        maxDealRatio: 2,
        maxLevel: 10,
        levelCost: { first: 100, multiplier: 1.35 },
        levelRewards: [
            null,
            null,
            { hp: 2 },
            { damage: 1 },
            { abilityCooldownPercent: -2 },
            { signatureBonusPercent: 3 },
            { hp: 2 },
            { damage: 1 },
            { actionHpCostPercent: -2 },
            { abilityCooldownPercent: -2 },
            { title: true }
        ]
    },
    hunting: {
        chest: {
            openCosts: { common: 20, uncommon: 50, rare: 120, epic: 250, legendary: 500 },
            breakWeights: { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 },
            rewardTableVersion: 1,
            rewardTables: {
                common: [
                    { id: "common-key-shards", weight: 55, type: "SHARDS", amount: 18, text: "파편 +18" },
                    { id: "common-equipment", weight: 45, type: "equipment", text: "일반 장비" }
                ],
                uncommon: [{ id: "uncommon-equipment", weight: 100, type: "equipment", text: "고급 장비" }],
                rare: [{ id: "rare-equipment", weight: 100, type: "equipment", text: "희귀 장비" }],
                epic: [{ id: "epic-equipment", weight: 100, type: "equipment", text: "에픽 장비" }],
                legendary: [{ id: "legendary-equipment", weight: 100, type: "equipment", text: "전설 장비" }]
            }
        },
        shards: {
            combatRanges: {
                normal: { min: 5, max: 8 },
                elite: { min: 15, max: 25 },
                champion: { min: 40, max: 40 }
            },
            clearBonus: 10,
            rewardPerFloor: 0.15,
            deepFloorBonus: 0.1,
            combatChestDropChance: 0.15,
            defeatPreserve: { shards: 0.5, xp: 0.7 },
            combatMultipliers: { finalBoss: 2, eliteFloor: 1.25, championIntrusion: 1.5 }
        },
        events: {
            boon: { baseShards: 8, shardsPerTenFloors: 3 },
            merchant: {
                discount: { default: 0.1, deepFloor: 70, deepFloorValue: 0.15 },
                repair: { cost: 50, recoveryRatio: 0.35 },
                commonChestCost: 40,
                secureTransportCost: 30
            },
            mishap: { defaultDamageRatio: 0.1, deepFloor: 70, deepFloorDamageRatio: 0.14 },
            restRecoveryRatio: 0.25,
            chestRoom: {
                legendary: { minimumFloor: 5, chance: 0.03 },
                epic: { minimumFloor: 4, chance: 0.12 },
                rare: { minimumFloor: 3, chance: 0.3 },
                uncommonChance: 0.55
            },
            cursedAltar: {
                maxDurationFloors: 3,
                durationFloorDivisor: 3,
                trades: [
                    { gainStat: "damage", loseStat: "defense", gainMultiplier: 1.18, loseMultiplier: 0.9 },
                    { gainStat: "defense", loseStat: "speed", gainMultiplier: 1.18, loseMultiplier: 0.92 },
                    { gainStat: "speed", loseStat: "damage", gainMultiplier: 1.16, loseMultiplier: 0.92 },
                    { gainStat: "skill", loseStat: "hp", gainMultiplier: 1.14, loseMultiplier: 0.94 }
                ]
            }
        }
    },
    equipment: {
        levelRequirements: { common: 1, uncommon: 3, rare: 5, epic: 8, legendary: 10 },
        inventory: { defaultSlots: 5, expandCost: 100, expandGain: 3, maxSlots: 100 },
        enhance: {
            maxLevel: 5,
            maxFailureRate: 0.8,
            statBonusPerLevel: 0.2,
            costs: [
                { stones: 2, shards: 10 },
                { stones: 4, shards: 15 },
                { stones: 8, shards: 25 },
                { stones: 15, shards: 40 },
                { stones: 25, shards: 60 }
            ]
        },
        disassembleRewards: { common: 1, uncommon: 3, rare: 8, epic: 20, legendary: 50 },
        sellRewards: { common: 5, uncommon: 12, rare: 30, epic: 80, legendary: 200 },
        fusionCosts: {
            common: { stones: 2, shards: 20 },
            uncommon: { stones: 5, shards: 40 },
            rare: { stones: 12, shards: 80 },
            epic: { stones: 25, shards: 150 }
        },
        statRanges: {
            common: { min: 1, max: 3, statCount: { min: 1, max: 1 } },
            uncommon: { min: 2, max: 5, statCount: { min: 1, max: 1 } },
            rare: { min: 4, max: 8, statCount: { min: 1, max: 2 } },
            epic: { min: 6, max: 12, statCount: { min: 1, max: 2 } },
            legendary: { min: 10, max: 18, statCount: { min: 1, max: 2 } }
        },
        statValueUnits: { hp: 10, damage: 1, defense: 1, speed: 5 },
        specialChances: { common: 0, uncommon: 0, rare: 0.25, epic: 0.5, legendary: 0.8 },
        specialRanges: {
            crashDamage: { min: 5, max: 15 },
            cooldown: { min: 3, max: 10 },
            hpSteal: { min: 2, max: 8 }
        },
        hpStealCooldown: 2.5
    },
    progression: {
        masteryThresholds: [1, 5, 15],
        bonusCaps: { extraStatPoints: 40, balanceTolerance: 10, perStatCapBonus: 50 },
        achievementRewards: {
            firstTournamentWin: 5,
            flawlessTournament: 15,
            comebackMatchWin: 5,
            counterExpert: 5,
            allActionsUsed: 10,
            rosterChampion: 15,
            masteryComplete: 20,
            marathon50: 15,
            singleHitMonster: 15,
            tournamentStreak3: 10
        },
        masteryTiers: {
            damage: [0, 0.03, 0.07, 0.12],
            incomingKnockbackReduce: [0, 0.04, 0.09, 0.15],
            balanceTolerance: [0, 1, 2, 3],
            outgoingImpactBonus: [0, 0.03, 0.06, 0.1],
            velocityRecoveryBonus: [0, 0.03, 0.06, 0.1],
            rageCollisionDamage: [0, 0.04, 0.08, 0.12],
            hp: [0, 0.03, 0.07, 0.12],
            actionHpCostReduction: [0, 0.003, 0.006, 0.01],
            extraStatPoints: [0, 3, 6, 10],
            vampireHpSteal: [0, 0.05, 0.1, 0.15]
        }
    }
});
