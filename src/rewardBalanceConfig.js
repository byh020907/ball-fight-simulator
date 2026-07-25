function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
}

const REBIRTH_PASSIVE_RANK_MULTIPLIERS = Object.freeze([1, 4 / 3, 5 / 3, 2]);

// Shared source of truth for cross-character reward and progression numbers.
// Character-specific progression belongs to each static character definition.
export const REWARD_BALANCE = deepFreeze({
    combat: {
        defense: {
            ratingScale: 100,
            minimumDamage: 1
        }
    },
    rebirth: {
        offerSize: 3,
        maxEquippedCards: 3,
        maxCardRank: 4,
        candidateWeights: { stat: 72, action: 18, passive: 10 },
        passiveRankMultipliers: REBIRTH_PASSIVE_RANK_MULTIPLIERS,
        passiveCardRanks: {
            globalCooldown: {
                reductionPercents: REBIRTH_PASSIVE_RANK_MULTIPLIERS.map((multiplier) => 30 * multiplier)
            }
        },
        visualStages: [
            {
                minimumCount: 0,
                color: "#ff7b32",
                outlineWidth: 0,
                auraRadius: 0,
                flameCount: 0,
                afterimageAlpha: 0,
                flickerStrength: 0
            },
            {
                minimumCount: 1,
                color: "#ff983d",
                outlineWidth: 1,
                auraRadius: 7,
                flameCount: 2,
                afterimageAlpha: 0.1,
                flickerStrength: 0.4
            },
            {
                minimumCount: 3,
                color: "#ffc44d",
                outlineWidth: 2,
                auraRadius: 12,
                flameCount: 4,
                afterimageAlpha: 0.16,
                flickerStrength: 0.52
            },
            {
                minimumCount: 6,
                color: "#ffe17a",
                outlineWidth: 3,
                auraRadius: 18,
                flameCount: 6,
                afterimageAlpha: 0.22,
                flickerStrength: 0.64
            },
            {
                minimumCount: 10,
                color: "#fff4bd",
                outlineWidth: 4,
                auraRadius: 24,
                flameCount: 8,
                afterimageAlpha: 0.28,
                flickerStrength: 0.76
            }
        ]
    },
    experience: {
        xpScale: 20,
        stageMultipliers: { round1: 1, round2: 1.2, final: 2.5, winBonus: 1 },
        comebackThreshold: 0.3,
        comebackWeight: 0.5,
        maxDealRatio: 2,
        maxLevel: 10,
        levelStatTargetMultiplier: 1.5,
        levelCost: { first: 100, multiplier: 1.35 }
    },
    hunting: {
        shards: {
            defeatPreserve: { shards: 0.5 }
        },
        loot: {
            baseDropChance: 0.15,
            equipmentDropChance: 0.015,
            missingHpMaxMultiplier: 2,
            valueStep: 5,
            itemLife: 18,
            magnet: { radiusMultiplier: 4, responseRate: 5, speedMultiplier: 1.35, collectionGraceDuration: 1 },
            victoryCollection: { duration: 1, responseRate: 180 },
            valueRadius: {
                minScale: 0.78,
                maxScale: 1.45,
                shard: { referenceAmount: 5 },
                shard_bundle: { referenceAmount: 10 },
                small_heal_pack: { referenceAmount: 25 },
                experience: { referenceAmount: 4 }
            },
            experienceDrops: {
                killXpPool: 20,
                battleXpVariance: { minimum: -15, maximum: 15, step: 5 },
                completionDropCount: 4,
                maxPhysicalDropsPerBattle: 24,
                rarity: {
                    common: { allocationWeight: 1, physicalDropCount: 2, victoryBonus: 0 },
                    uncommon: { allocationWeight: 1.45, physicalDropCount: 4, victoryBonus: 2 },
                    rare: { allocationWeight: 1.9, physicalDropCount: 5, victoryBonus: 4 },
                    epic: { allocationWeight: 2.4, physicalDropCount: 6, victoryBonus: 6 }
                },
                enemyType: {
                    normal: { allocationMultiplier: 1, physicalDropBonus: 0, victoryBonus: 0 },
                    elite: { allocationMultiplier: 1.2, physicalDropBonus: 1, victoryBonus: 6 },
                    champion: { allocationMultiplier: 1.45, physicalDropBonus: 2, victoryBonus: 10 }
                },
                boss: { allocationMultiplier: 1.3, physicalDropCount: 8, victoryBonus: 8 }
            },
            smallHealPack: { missingHpRecoveryRatio: 0.25 },
            shard: { baseAmount: 5, floorStep: 25, maximumAmount: 20, physicalDropCount: { minimum: 3, maximum: 7 } },
            normalWeights: { small_heal_pack: { minimum: 20, maximum: 40 } },
            rarityRewards: {
                common: { shard_bundle: 0 },
                uncommon: { shard_bundle: 15 },
                rare: { shard_bundle: 30 },
                epic: { shard_bundle: 45 }
            },
            shardBundle: {
                multipliers: {
                    rare: [
                        { value: 1, weight: 25 },
                        { value: 1.5, weight: 50 },
                        { value: 2, weight: 25 }
                    ],
                    rare: [
                        { value: 1, weight: 15 },
                        { value: 1.5, weight: 35 },
                        { value: 2, weight: 35 },
                        { value: 2.5, weight: 15 }
                    ],
                    epic: [
                        { value: 1, weight: 5 },
                        { value: 1.5, weight: 15 },
                        { value: 2, weight: 30 },
                        { value: 2.5, weight: 30 },
                        { value: 3, weight: 15 },
                        { value: 3.5, weight: 5 }
                    ]
                }
            }
        },
        events: {
            boon: { baseShards: 8, baseShardVariance: 2, maxMultiplier: 5, maxMultiplierFloor: 100 },
            merchant: {
                discount: { default: 0.1, deepFloor: 70, deepFloorValue: 0.15 },
                repair: { cost: 50, recoveryRatio: 0.35 }
            },
            mishap: { defaultDamageRatio: 0.05, deepFloor: 70, deepFloorDamageRatio: 0.1 },
            restRecoveryRatio: 0.25,
            shardCache: {
                baseShards: 8,
                floorStep: 10,
                bonusPerStep: 3,
                variance: 2,
                minimum: 3
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
        speed: { maximumBaseMultiplier: 2 },
        enhance: {
            maxLevel: 5,
            maxLevelByRarity: { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 },
            maxFailureRate: 0.8,
            statMultiplierPerLevel: 2,
            costs: [{ shards: 200 }, { shards: 300 }, { shards: 500 }, { shards: 800 }, { shards: 1200 }]
        },
        sellRewards: { common: 5, uncommon: 12, rare: 30, epic: 80, legendary: 200 },
        sellEnhancementStoneRewards: {
            common: { chance: 0.05, count: 1 },
            uncommon: { chance: 0.1, count: 1 },
            rare: { chance: 0.18, count: 2 },
            epic: { chance: 0.3, count: 4 },
            legendary: { chance: 0.5, count: 8 }
        },
        fusion: {
            sourceItemCount: 3,
            costMultiplier: 0
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
                    description: "흠집 하나 없이 승리한 자에게 주어지는 rare 방어구.",
                    stats: [
                        { type: "defense", value: 2 },
                        { type: "hp", value: 20 }
                    ],
                    specialOptions: [{ type: "wallBounce", value: 15 }]
                }
            },
            comebackMatchWin: { type: "SHARDS", amount: 30 },
            counterExpert: { type: "SHARDS", amount: 30 },
            allActionsUsed: { type: "SHARDS", amount: 15 },
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
                    description: "모든 숙련을 모아 완성한 legendary 방어구.",
                    stats: [
                        { type: "hp", value: 40 },
                        { type: "defense", value: 4 }
                    ],
                    specialOptions: [{ type: "angularImpulse", value: 15 }]
                }
            },
            marathon50: { type: "SHARDS", amount: 20 },
            huntingDepth30: { type: "SHARDS", amount: 20 },
            huntingCriticalHpWin: { type: "SHARDS", amount: 30 },
            huntingPortalRetreat40: { type: "SHARDS", amount: 30 },
            huntingChampionVictory: { type: "SHARDS", amount: 15 },
            huntingAllStagesClear: { type: "SHARDS", amount: 80 },
            huntingMonsterCodexComplete: { type: "SHARDS", amount: 50 },
            huntingMonsterSlayer: { type: "SHARDS", amount: 15 },
            huntingRareMonsterSlayer: { type: "SHARDS", amount: 25 },
            huntingUniqueMonsterSlayer: { type: "SHARDS", amount: 40 },
            huntingEpicMonsterSlayer: { type: "SHARDS", amount: 60 },
            singleHitMonster: {
                type: "EQUIPMENT",
                rarity: "rare",
                equipment: {
                    slot: "weapon",
                    name: "단죄의 수정 단검",
                    description: "한 번의 압도적인 일격을 기록한 자의 rare 무기.",
                    stats: [
                        { type: "damage", value: 3 },
                        { type: "speed", value: 10 }
                    ],
                    specialOptions: [{ type: "crashDamage", value: 15 }]
                }
            },
            tournamentStreak3: { type: "SHARDS", amount: 30 }
        },
        masteryTiers: {
            defense: [0, 0.02, 0.04, 0.06],
            damage: [0, 0.02, 0.04, 0.06],
            incomingCollisionDamageReduce: [0, 0.02, 0.04, 0.06],
            outgoingCollisionDamageBonus: [0, 0.02, 0.04, 0.06],
            velocityRecoveryBonus: [0, 0.03, 0.06, 0.1],
            rageCollisionDamage: [0, 0.03, 0.06, 0.09],
            hp: [0, 0.02, 0.04, 0.06],
            actionHpCostReduction: [0, 0.0003, 0.0006, 0.001],
            abilityCooldownPercent: [0, 0.02, 0.04, 0.06],
            vampireHpSteal: [0, 0.03, 0.06, 0.09],
            wallBounce: [0, 0.05, 0.1, 0.15],
            speed: [0, 0.02, 0.04, 0.06],
            mass: [0, 0.02, 0.04, 0.06],
            angularImpulse: [0, 0.05, 0.1, 0.15]
        },
        masteryRuntime: {
            vampire: {
                cooldown: 4,
                missingHpMultiplierMax: 2
            }
        }
    }
});
