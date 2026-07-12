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
            { id: "level-2-hp", effect: { type: "stat", stat: "hp", value: 2 } },
            { id: "level-3-damage", effect: { type: "stat", stat: "damage", value: 1 } },
            { id: "level-4-skill", effect: { type: "stat", stat: "skill", value: 2 } },
            { id: "level-5-speed", effect: { type: "stat", stat: "speed", value: 2 } },
            { id: "level-6-hp", effect: { type: "stat", stat: "hp", value: 2 } },
            { id: "level-7-damage", effect: { type: "stat", stat: "damage", value: 1 } },
            { id: "level-8-defense", effect: { type: "stat", stat: "defense", value: 1 } },
            { id: "level-9-skill", effect: { type: "stat", stat: "skill", value: 2 } },
            { id: "level-10-speed", effect: { type: "stat", stat: "speed", value: 2 } }
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
        // 장비 공통 가치 포인트 1당 고정 전투 수치 환산값.
        statValueRatios: { hp: 10, damage: 1, defense: 1, speed: 5 },
        specialChances: { common: 0, uncommon: 0, rare: 0.25, epic: 0.5, legendary: 0.8 },
        specialRanges: {
            crashDamage: { min: 5, max: 15 },
            cooldown: { min: 3, max: 10 },
            hpSteal: { min: 2, max: 8 },
            mass: { min: 5, max: 15 },
            wallBounce: { min: 5, max: 15 },
            angularImpulse: { min: 5, max: 15 }
        },
        hpStealCooldown: 2.5
    },
    progression: {
        achievementRewards: {
            firstTournamentWin: { type: "SHARDS", amount: 30 },
            flawlessTournament: {
                type: "EQUIPMENT",
                rarity: "rare",
                equipment: {
                    slot: "armor",
                    name: "무결점의 수정 방패",
                    description: "흠집 하나 없이 승리한 자에게 주어지는 희귀 방어구.",
                    stats: [
                        { type: "defense", value: 2 },
                        { type: "hp", value: 20 }
                    ],
                    specialOptions: [{ type: "wallBounce", value: 15 }]
                }
            },
            comebackMatchWin: { type: "CHEST", rarity: "uncommon" },
            counterExpert: { type: "CHEST", rarity: "uncommon" },
            allActionsUsed: { type: "CHEST", rarity: "common" },
            rosterChampion: {
                type: "EQUIPMENT",
                rarity: "epic",
                equipment: {
                    slot: "accessory",
                    name: "개척자의 룬 귀걸이",
                    description: "모든 캐릭터의 우승을 증명하는 에픽 장신구.",
                    stats: [
                        { type: "damage", value: 3 },
                        { type: "speed", value: 15 }
                    ],
                    specialOptions: [
                        { type: "cooldown", value: 10 },
                        { type: "hpSteal", value: 8 }
                    ]
                }
            },
            masteryComplete: {
                type: "EQUIPMENT",
                rarity: "legendary",
                equipment: {
                    slot: "armor",
                    name: "도감 완성의 영원한 망토",
                    description: "모든 숙련을 모아 완성한 전설 방어구.",
                    stats: [
                        { type: "hp", value: 40 },
                        { type: "defense", value: 4 }
                    ],
                    specialOptions: [{ type: "angularImpulse", value: 15 }]
                }
            },
            marathon50: { type: "CHEST", rarity: "common" },
            singleHitMonster: {
                type: "EQUIPMENT",
                rarity: "rare",
                equipment: {
                    slot: "weapon",
                    name: "단죄의 수정 단검",
                    description: "한 번의 압도적인 일격을 기록한 자의 희귀 무기.",
                    stats: [
                        { type: "damage", value: 3 },
                        { type: "speed", value: 10 }
                    ],
                    specialOptions: [{ type: "crashDamage", value: 15 }]
                }
            },
            tournamentStreak3: { type: "CHEST", rarity: "uncommon" }
        },
        masteryTiers: {
            damage: [0, 0.02, 0.04, 0.06],
            incomingCollisionDamageReduce: [0, 0.02, 0.04, 0.06],
            outgoingCollisionDamageBonus: [0, 0.02, 0.04, 0.06],
            velocityRecoveryBonus: [0, 0.03, 0.06, 0.1],
            rageCollisionDamage: [0, 0.03, 0.06, 0.09],
            hp: [0, 0.02, 0.04, 0.06],
            actionHpCostReduction: [0, 0.0003, 0.0006, 0.001],
            abilityCooldownPercent: [0, 0.02, 0.04, 0.06],
            vampireHpSteal: [0, 0.04, 0.08, 0.12]
        },
        masteryCaps: {
            hp: 0.08,
            damage: 0.08,
            defense: 0.08,
            incomingCollisionDamageReduce: 0.1,
            outgoingCollisionDamageBonus: 0.08,
            velocityRecoveryBonus: 0.1,
            hpCostPercentReduction: 0.001,
            cooldownPercent: 0.08,
            minHpCostPercent: 0.001
        }
    }
});
