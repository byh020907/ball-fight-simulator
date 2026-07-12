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
        characterLevelProgressions: {
            archer: [
                { level: 2, baseStats: { speed: 2 } },
                { level: 3, baseStats: { damage: 1 }, abilityTier: 1, gameText: "예측 화살 속도 +15%" },
                { level: 4, baseStats: { skill: 2 } },
                { level: 5, baseStats: { speed: 2 } },
                { level: 6, baseStats: { damage: 1 }, abilityTier: 2, gameText: "조준 시간 -20%" },
                { level: 7, baseStats: { hp: 2 } },
                { level: 8, baseStats: { skill: 2 } },
                { level: 9, baseStats: { defense: 1 }, abilityTier: 3, gameText: "연사 화살 수 +1" },
                { level: 10, baseStats: { hp: 2 } }
            ],
            orbit: [
                { level: 2, baseStats: { speed: 2 } },
                { level: 3, baseStats: { defense: 1 }, abilityTier: 1, gameText: "위성 수 +1" },
                { level: 4, baseStats: { skill: 2 } },
                { level: 5, baseStats: { hp: 2 } },
                { level: 6, baseStats: { speed: 2 }, abilityTier: 2, gameText: "위성 충전 속도 +15%" },
                { level: 7, baseStats: { defense: 1 } },
                { level: 8, baseStats: { damage: 1 } },
                { level: 9, baseStats: { skill: 2 }, abilityTier: 3, gameText: "일제 발사 간격 -35%" },
                { level: 10, baseStats: { hp: 2 } }
            ],
            trickster: [
                { level: 2, baseStats: { speed: 2 } },
                { level: 3, baseStats: { skill: 2 }, abilityTier: 1, gameText: "씨앗 수 +1" },
                { level: 4, baseStats: { damage: 1 } },
                { level: 5, baseStats: { speed: 2 } },
                { level: 6, baseStats: { skill: 2 }, abilityTier: 2, gameText: "씨앗 수명 +35%" },
                { level: 7, baseStats: { hp: 2 } },
                { level: 8, baseStats: { defense: 1 } },
                { level: 9, baseStats: { skill: 2 }, abilityTier: 3, gameText: "씨앗 속도 +15%" },
                { level: 10, baseStats: { hp: 2 } }
            ],
            grenade: [
                { level: 2, baseStats: { damage: 1 } },
                { level: 3, baseStats: { skill: 2 }, abilityTier: 1, gameText: "연사 수 +1" },
                { level: 4, baseStats: { hp: 2 } },
                { level: 5, baseStats: { damage: 1 } },
                { level: 6, baseStats: { speed: 2 }, abilityTier: 2, gameText: "폭발 반경 +15%" },
                { level: 7, baseStats: { defense: 1 } },
                { level: 8, baseStats: { skill: 2 } },
                { level: 9, baseStats: { hp: 2 }, abilityTier: 3, gameText: "수류탄 피해 +10%" },
                { level: 10, baseStats: { speed: 2 } }
            ],
            dash: [
                { level: 2, baseStats: { speed: 2 } },
                { level: 3, baseStats: { skill: 2 }, abilityTier: 1, gameText: "대시 배율 +5%" },
                { level: 4, baseStats: { damage: 1 } },
                { level: 5, baseStats: { speed: 2 } },
                { level: 6, baseStats: { hp: 2 }, abilityTier: 2, gameText: "유도 회전 속도 +30%" },
                { level: 7, baseStats: { defense: 1 } },
                { level: 8, baseStats: { skill: 2 } },
                {
                    level: 9,
                    baseStats: { damage: 1 },
                    abilityTier: 3,
                    gameText: "벽 충돌 후 쿨다운 단계 50% 보존"
                },
                { level: 10, baseStats: { hp: 2 } }
            ],
            rage: [
                { level: 2, baseStats: { hp: 2 } },
                { level: 3, baseStats: { damage: 1 }, abilityTier: 1, gameText: "최대 충전 시간 -15%" },
                { level: 4, baseStats: { defense: 1 } },
                { level: 5, baseStats: { hp: 2 } },
                { level: 6, baseStats: { damage: 1 }, abilityTier: 2, gameText: "최대 충돌 수치 +15%" },
                { level: 7, baseStats: { speed: 2 } },
                { level: 8, baseStats: { defense: 1 } },
                { level: 9, baseStats: { skill: 2 }, abilityTier: 3, gameText: "충돌 후 충전량 20% 유지" },
                { level: 10, baseStats: { hp: 2 } }
            ],
            eater: [
                { level: 2, baseStats: { hp: 2 } },
                { level: 3, baseStats: { defense: 1 }, abilityTier: 1, gameText: "삼킨 뒤 뱉기 대기 -25%" },
                { level: 4, baseStats: { skill: 2 } },
                { level: 5, baseStats: { hp: 2 } },
                { level: 6, baseStats: { damage: 1 }, abilityTier: 2, gameText: "뱉은 대상 회전 충격 +50%" },
                { level: 7, baseStats: { defense: 1 } },
                { level: 8, baseStats: { hp: 2 } },
                { level: 9, baseStats: { speed: 2 }, abilityTier: 3, gameText: "벽 압박 시간 +15%" },
                { level: 10, baseStats: { skill: 2 } }
            ],
            bat_ball: [
                { level: 2, baseStats: { speed: 2 } },
                { level: 3, baseStats: { damage: 1 }, abilityTier: 1, gameText: "방망이 판정 거리 +15%" },
                { level: 4, baseStats: { skill: 2 } },
                { level: 5, baseStats: { speed: 2 } },
                { level: 6, baseStats: { damage: 1 }, abilityTier: 2, gameText: "시야 호 각도 +15%" },
                { level: 7, baseStats: { defense: 1 } },
                { level: 8, baseStats: { skill: 2 } },
                { level: 9, baseStats: { hp: 2 }, abilityTier: 3, gameText: "벽 압박 시간 +30%" },
                { level: 10, baseStats: { hp: 2 } }
            ],
            vampire: [
                { level: 2, baseStats: { hp: 2 } },
                { level: 3, baseStats: { damage: 1 }, abilityTier: 1, gameText: "박쥐 수 +1" },
                { level: 4, baseStats: { skill: 2 } },
                { level: 5, baseStats: { hp: 2 } },
                { level: 6, baseStats: { defense: 1 }, abilityTier: 2, gameText: "박쥐 초기 속도 +15%" },
                { level: 7, baseStats: { damage: 1 } },
                { level: 8, baseStats: { hp: 2 } },
                { level: 9, baseStats: { skill: 2 }, abilityTier: 3, gameText: "박쥐 수명 +20%" },
                { level: 10, baseStats: { speed: 2 } }
            ],
            gunner: [
                { level: 2, baseStats: { damage: 1 } },
                { level: 3, baseStats: { skill: 2 }, abilityTier: 1, gameText: "최소 탄 수 +1" },
                { level: 4, baseStats: { speed: 2 } },
                { level: 5, baseStats: { damage: 1 } },
                { level: 6, baseStats: { skill: 2 }, abilityTier: 2, gameText: "탄속 +15%" },
                { level: 7, baseStats: { speed: 2 } },
                { level: 8, baseStats: { defense: 1 } },
                { level: 9, baseStats: { hp: 2 }, abilityTier: 3, gameText: "마무리 탄 조건 11발 이상" },
                { level: 10, baseStats: { hp: 2 } }
            ],
            phantom: [
                { level: 2, baseStats: { speed: 2 } },
                {
                    level: 3,
                    baseStats: { skill: 2 },
                    abilityTier: 1,
                    gameText: "표식 대상 자연 충돌 시 메아리 돌진"
                },
                { level: 4, baseStats: { damage: 1 } },
                { level: 5, baseStats: { speed: 2 } },
                {
                    level: 6,
                    baseStats: { skill: 2 },
                    abilityTier: 2,
                    gameText: "표식 대상 벽·지형 충돌에도 메아리 돌진"
                },
                { level: 7, baseStats: { damage: 1 } },
                { level: 8, baseStats: { hp: 2 } },
                { level: 9, baseStats: { defense: 1 }, abilityTier: 3, gameText: "메아리 적중 시 종결 돌진 1회" },
                { level: 10, baseStats: { speed: 2 } }
            ],
            hero: [
                { level: 2, baseStats: { hp: 2 } },
                { level: 3, baseStats: { speed: 2 }, abilityTier: 1, gameText: "발사 1초 후 오브 귀환 자석" },
                { level: 4, baseStats: { skill: 2 } },
                { level: 5, baseStats: { damage: 1 } },
                { level: 6, baseStats: { hp: 2 }, abilityTier: 2, gameText: "오브 획득 축적 충돌 강화" },
                { level: 7, baseStats: { defense: 1 } },
                { level: 8, baseStats: { skill: 2 } },
                { level: 9, baseStats: { speed: 2 }, abilityTier: 3, gameText: "축적 소비 후 오브 방출" },
                { level: 10, baseStats: { hp: 2 } }
            ]
        },
        abilityUpgrades: {
            archer: {
                tiers: [
                    {},
                    { arrowSpeedMultiplier: 1.15 },
                    { windupMultiplier: 0.8 },
                    { burstShotCountMultiplier: 1.35 }
                ]
            },
            orbit: {
                tiers: [
                    {},
                    { shardCountMultiplier: 1.2 },
                    { rechargeSpeedMultiplier: 1.15 },
                    { volleyDelayMultiplier: 0.65 }
                ]
            },
            trickster: {
                tiers: [{}, { seedCountMultiplier: 1.35 }, { seedLifeMultiplier: 1.35 }, { seedSpeedMultiplier: 1.15 }]
            },
            grenade: {
                tiers: [
                    {},
                    { burstCountMultiplier: 1.25 },
                    { explosionRadiusMultiplier: 1.15 },
                    { damageMultiplier: 1.1 }
                ]
            },
            dash: {
                tiers: [
                    {},
                    { dashMultiplier: 1.05 },
                    { homingTurnRateMultiplier: 1.3 },
                    { wallCooldownLevelRetention: 0.5 }
                ]
            },
            rage: {
                tiers: [
                    {},
                    { maxChargeTimeMultiplier: 0.85 },
                    { maxImpactMultiplier: 1.15 },
                    { chargeRetentionRatio: 0.2 }
                ]
            },
            eater: {
                tiers: [
                    {},
                    { swallowHoldDurationMultiplier: 0.75 },
                    { spitAngularVelocityMultiplier: 1.5 },
                    { wallSlamDurationMultiplier: 1.15 }
                ]
            },
            bat_ball: {
                tiers: [
                    {},
                    { arcRangeMultiplier: 1.15 },
                    { arcAngleMultiplier: 1.15 },
                    { wallSlamDurationMultiplier: 1.3 }
                ]
            },
            vampire: {
                tiers: [{}, { batCountMultiplier: 1.15 }, { batSpeedMultiplier: 1.15 }, { batLifeMultiplier: 1.2 }]
            },
            gunner: {
                tiers: [
                    {},
                    { minBulletCountMultiplier: 1.15 },
                    { bulletSpeedMultiplier: 1.15 },
                    { finisherMinimum: 11 }
                ]
            },
            phantom: {
                base: {
                    speedMultiplier: 1.15,
                    damageMultiplier: 1.1,
                    defenseMultiplier: 1.5,
                    impactMultiplier: 1.15,
                    bonusDamage: 18,
                    markDuration: 2.5
                },
                tiers: [{}, { echoOnNaturalCollision: true }, { echoOnStaticCollision: true }, { terminalDash: true }]
            },
            hero: {
                tiers: [
                    {},
                    { magnetRadiusMultiplier: 2.5, magnetResponseRate: 5, magnetGraceDuration: 1 },
                    { stackCap: 20, damagePerStack: 0.03 },
                    { releaseStackRatio: 0.5 }
                ]
            }
        }
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
            vampireHpSteal: [0, 0.03, 0.06, 0.09],
            wallBounce: [0, 0.05, 0.1, 0.15],
            speed: [0, 0.02, 0.04, 0.06],
            mass: [0, 0.02, 0.04, 0.06]
        },
        masteryRuntime: {
            vampire: {
                cooldown: 4,
                missingHpMultiplierMax: 2
            }
        }
    }
});
