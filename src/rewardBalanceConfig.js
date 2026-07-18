function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
}

// The single source of truth for player-facing reward and progression numbers.
export const REWARD_BALANCE = deepFreeze({
    rebirth: {
        offerSize: 3,
        maxEquippedCards: 3,
        maxCardRank: 10,
        candidateWeights: { stat: 72, action: 18, passive: 10 },
        passiveCardRanks: {
            globalCooldown: {
                baseReductionPercent: 30,
                perRankReductionPercent: 2,
                maximumReductionPercent: 48
            }
        },
        subAbilityRankModifiers: {
            archer: { key: "arrowSpeedMultiplier", base: 1, perRank: 0.08 },
            orbit: { key: "rechargeSpeedMultiplier", base: 1, perRank: 0.08 },
            trickster: { key: "seedSpeedMultiplier", base: 1, perRank: 0.08 },
            grenade: { key: "damageMultiplier", base: 1, perRank: 0.08 },
            dash: { key: "dashMultiplier", base: 1, perRank: 0.05 },
            rage: { key: "maxImpactMultiplier", base: 1, perRank: 0.06 },
            spin: { key: "chargeRetentionRatio", base: 0, perRank: 0.08 },
            eater: { key: "spitAngularVelocityMultiplier", base: 1, perRank: 0.08 },
            bat_ball: { key: "arcRangeMultiplier", base: 1, perRank: 0.08 },
            vampire: { key: "batSpeedMultiplier", base: 1, perRank: 0.08 },
            gunner: { key: "bulletSpeedMultiplier", base: 1, perRank: 0.08 },
            phantom: { key: "bonusDamage", base: 18, perRank: 3 },
            hero: { key: "magnetRadiusMultiplier", base: 1, perRank: 0.2 }
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
        levelCost: { first: 100, multiplier: 1.35 },
        characterLevelProgressions: {
            archer: [
                { level: 2 },
                { level: 3, abilityTier: 1, gameText: "예측 화살 + 속도 15%" },
                { level: 4 },
                { level: 5 },
                { level: 6, abilityTier: 2, gameText: "조준 -20% · 70% 단발 30% 2발" },
                { level: 7 },
                { level: 8 },
                { level: 9, abilityTier: 3, gameText: "50% 확률로 크리티컬 ×2" },
                { level: 10 }
            ],
            orbit: [
                { level: 2 },
                { level: 3, abilityTier: 1, gameText: "첫 적중점 동기화 협공 · 직접 ×0.80/×1.00" },
                { level: 4 },
                { level: 5 },
                { level: 6, abilityTier: 2, gameText: "수명 2.4초 · 협공 폭발 70px ×0.25" },
                { level: 7 },
                { level: 8 },
                { level: 9, abilityTier: 3, gameText: "미적중 탄 본체 캐치 · 원래 위성 회수" },
                { level: 10 }
            ],
            trickster: [
                { level: 2 },
                { level: 3, abilityTier: 1, gameText: "덩굴 감속 0.5초 · 5틱 ×0.10" },
                { level: 4 },
                { level: 5 },
                { level: 6, abilityTier: 2, gameText: "씨앗 표식 1.8초 · 돌진 폭발 ×1.20" },
                { level: 7 },
                { level: 8 },
                { level: 9, abilityTier: 3, gameText: "폭발 접점 후속 씨앗 · 활성 유예 0.5초" },
                { level: 10 }
            ],
            grenade: [
                { level: 2 },
                { level: 3, abilityTier: 1, gameText: "실제 접촉 수류탄 점착 · 대상당 1개" },
                { level: 4 },
                { level: 5 },
                { level: 6, abilityTier: 2, gameText: "폭발 피해 대상 화상 · 0.5초 ×0.50" },
                { level: 7 },
                { level: 8 },
                { level: 9, abilityTier: 3, gameText: "점착 표식 유도 · 0.5초 뒤 2rad/s" },
                { level: 10 }
            ],
            dash: [
                { level: 2 },
                { level: 3, abilityTier: 1, gameText: "대시 적중 레이저 · 0.35초 조준 ×0.60" },
                { level: 4 },
                { level: 5 },
                { level: 6, abilityTier: 2, gameText: "레이저 벽 1회 반사 · 구간별 ×0.60" },
                { level: 7 },
                { level: 8 },
                {
                    level: 9,
                    abilityTier: 3,
                    gameText: "첫 레이저 적중 즉시 점화 · 1초 10틱 ×0.10"
                },
                { level: 10 }
            ],
            rage: [
                { level: 2 },
                { level: 3, abilityTier: 1, gameText: "35%+ 점화 (5틱 ×0.10)" },
                { level: 4 },
                { level: 5 },
                { level: 6, abilityTier: 2, gameText: "70%+ 폭발 ×1.50 120px" },
                { level: 7 },
                { level: 8 },
                { level: 9, abilityTier: 3, gameText: "100% 여진 ×2.25 180px" },
                { level: 10 }
            ],
            spin: [
                { level: 2 },
                { level: 3, abilityTier: 1, gameText: "만충 Crash 유지 · 표면 절단 0.60초 · 12틱 ×0.15" },
                { level: 4 },
                { level: 5 },
                { level: 6, abilityTier: 2, gameText: "가속 절삭 ×0.10→×0.30 · 합계 ×2.40" },
                { level: 7 },
                { level: 8 },
                { level: 9, abilityTier: 3, gameText: "340px 관통 유체장 · 절단 방어 무시" },
                { level: 10 }
            ],
            eater: [
                { level: 2 },
                { level: 3, abilityTier: 1, gameText: "삼킨 중 소화 6틱 ×0.12 · 실제 피해만큼 회복" },
                { level: 4 },
                { level: 5 },
                { level: 6, abilityTier: 2, gameText: "뱉기 ×1.0 피해 · 속도 ×3 · 반동" },
                { level: 7 },
                { level: 8 },
                { level: 9, abilityTier: 3, gameText: "첫 벽 충돌 파열 ×1.5+주변 ×0.75" },
                { level: 10 }
            ],
            bat_ball: [
                { level: 2 },
                { level: 3, abilityTier: 1, gameText: "회전 타구 · 기본 Wall Slam 각충격 ×1.5 추가" },
                { level: 4 },
                { level: 5 },
                { level: 6, abilityTier: 2, gameText: "첫 Wall Slam 비거리 HOME RUN ×1.00~×2.00" },
                { level: 7 },
                { level: 8 },
                { level: 9, abilityTier: 3, gameText: "유효 Wall Slam 스킬 초기화 · 재발동 0.50초" },
                { level: 10 }
            ],
            vampire: [
                { level: 2 },
                { level: 3, abilityTier: 1, gameText: "반복 물기 ×0.05 · 반동 재돌입" },
                { level: 4 },
                { level: 5 },
                { level: 6, abilityTier: 2, gameText: "수명 종료 폭발 65px · ×0.05" },
                { level: 7 },
                { level: 8 },
                { level: 9, abilityTier: 3, gameText: "피의 견인 180px/s · 혈액 파열 ×0.15" },
                { level: 10 }
            ],
            gunner: [
                { level: 2 },
                { level: 3, abilityTier: 1, gameText: "모든 6~12발 연사 마무리 탄 ×2" },
                { level: 4 },
                { level: 5 },
                { level: 6, abilityTier: 2, gameText: "일반 탄 회수 즉시 재사격 · 첫 반사 재조준" },
                { level: 7 },
                { level: 8 },
                { level: 9, abilityTier: 3, gameText: "일반 탄 20회 회수 · 8초 자동 포탑" },
                { level: 10 }
            ],
            phantom: [
                { level: 2 },
                {
                    level: 3,
                    abilityTier: 1,
                    gameText: "표식 대상 자연 충돌 시 메아리 돌진"
                },
                { level: 4 },
                { level: 5 },
                {
                    level: 6,
                    abilityTier: 2,
                    gameText: "표식 대상 벽·지형 충돌에도 메아리 돌진"
                },
                { level: 7 },
                { level: 8 },
                { level: 9, abilityTier: 3, gameText: "메아리 적중 시 종결 돌진 1회" },
                { level: 10 }
            ],
            hero: [
                { level: 2 },
                { level: 3, abilityTier: 1, gameText: "성장 코어 근거리 자석 회수" },
                { level: 4 },
                { level: 5 },
                { level: 6, abilityTier: 2, gameText: "회수 코어 공명 조각 · 순차 ×0.20" },
                { level: 7 },
                { level: 8 },
                { level: 9, abilityTier: 3, gameText: "조각 5개 Heroic Burst · 90px ×0.75" },
                { level: 10 }
            ],
            elementalist: [
                { level: 2 },
                { level: 3, abilityTier: 1, gameText: "젖음 2.5초 · 원 피격자 우선 원소 반응" },
                { level: 4 },
                { level: 5 },
                { level: 6, abilityTier: 2, gameText: "30% 확률로 서로 다른 원소 오브 2개" },
                { level: 7 },
                { level: 8 },
                { level: 9, abilityTier: 3, gameText: "같은 시전자 오브 자성 · 10종 원소 융합" },
                { level: 10 }
            ]
        },
        abilityUpgrades: {
            archer: {
                tiers: [{}, { arrowSpeedMultiplier: 1.15 }, { windupMultiplier: 0.8 }, {}]
            },
            orbit: {
                tiers: [{}, { synchronizedVolley: true }, { explosiveVolley: true }, { bodyCatch: true }]
            },
            trickster: {
                tiers: [{}, { vineSnare: true }, { seedMarkBurst: true }, { followupSeed: true }]
            },
            grenade: {
                tiers: [{}, { stickyGrenade: true }, { burningExplosion: true }, { stickyHoming: true }]
            },
            dash: {
                tiers: [{}, { laserStrike: true }, { laserWallBounces: 1 }, { laserIgnition: true }]
            },
            rage: {
                tiers: [{}, {}, {}, {}]
            },
            spin: {
                tiers: [{}, { surfaceCut: true }, { acceleratingCut: true }, { piercingVortex: true }]
            },
            eater: {
                tiers: [{}, {}, {}, {}]
            },
            bat_ball: {
                tiers: [{}, { rotatingHit: true }, { homeRun: true }, { wallReset: true }]
            },
            vampire: {
                tiers: [{}, { repeatBite: true }, { lifeBurst: true }, { bloodPull: true }]
            },
            gunner: {
                tiers: [
                    {},
                    { everyBurstFinisher: true },
                    { refireOnCollect: true, ricochetReload: true },
                    { collectionTurret: true }
                ]
            },
            phantom: {
                base: {
                    speedMultiplier: 1.15,
                    damageMultiplier: 1.1,
                    defenseMultiplier: 1.5,
                    impactMultiplier: 1.15,
                    bonusDamageMultiplier: 1.5,
                    markDuration: 2.5
                },
                tiers: [{}, { echoOnNaturalCollision: true }, { echoOnStaticCollision: true }, { terminalDash: true }]
            },
            hero: {
                tiers: [{}, { magneticCoreCollection: true }, { resonanceFragments: true }, { heroicBurst: true }]
            },
            elementalist: {
                tiers: [{}, { wetDuration: 2.5 }, { dualOrbChance: 0.3 }, { orbitalFusion: true }]
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
                    { id: "common-equipment", weight: 45, type: "equipment", text: "common 장비" }
                ],
                uncommon: [{ id: "uncommon-equipment", weight: 100, type: "equipment", text: "uncommon 장비" }],
                rare: [{ id: "rare-equipment", weight: 100, type: "equipment", text: "rare 장비" }],
                epic: [{ id: "epic-equipment", weight: 100, type: "equipment", text: "epic 장비" }],
                legendary: [{ id: "legendary-equipment", weight: 100, type: "equipment", text: "legendary 장비" }]
            }
        },
        shards: {
            defeatPreserve: { shards: 0.5 }
        },
        loot: {
            baseDropChance: 0.15,
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
            normalWeights: { small_heal_pack: { minimum: 20, maximum: 40 }, chest: 10 },
            rarityRewards: {
                common: { shard_bundle: 0, high_chest: 0 },
                uncommon: { shard_bundle: 15, high_chest: 5 },
                rare: { shard_bundle: 30, high_chest: 10 },
                epic: { shard_bundle: 45, high_chest: 20 }
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
            },
            highChest: {
                rarities: {
                    uncommon: [{ rarity: "uncommon", weight: 100 }],
                    rare: [
                        { rarity: "uncommon", weight: 70 },
                        { rarity: "rare", weight: 30 }
                    ],
                    epic: [
                        { rarity: "rare", weight: 70 },
                        { rarity: "epic", weight: 30 }
                    ]
                }
            }
        },
        events: {
            boon: { baseShards: 8, baseShardVariance: 2, maxMultiplier: 5, maxMultiplierFloor: 100 },
            merchant: {
                discount: { default: 0.1, deepFloor: 70, deepFloorValue: 0.15 },
                repair: { cost: 50, recoveryRatio: 0.35 },
                commonChestCost: 40,
                secureTransportCost: 30
            },
            mishap: { defaultDamageRatio: 0.05, deepFloor: 70, deepFloorDamageRatio: 0.1 },
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
        fusion: {
            sourceItemCount: 3,
            costMultiplier: 10
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
                    description: "모든 숙련을 모아 완성한 legendary 방어구.",
                    stats: [
                        { type: "hp", value: 40 },
                        { type: "defense", value: 4 }
                    ],
                    specialOptions: [{ type: "angularImpulse", value: 15 }]
                }
            },
            marathon50: { type: "CHEST", rarity: "common" },
            huntingDepth30: { type: "CHEST", rarity: "common" },
            huntingCriticalHpWin: { type: "CHEST", rarity: "uncommon" },
            huntingPortalRetreat40: { type: "CHEST", rarity: "uncommon" },
            huntingChampionVictory: { type: "CHEST", rarity: "common" },
            huntingSecuredChests: {
                type: "EQUIPMENT",
                rarity: "uncommon",
                equipment: {
                    slot: "armor",
                    name: "귀환자의 완충 갑옷",
                    description: "전리품을 지키고 돌아온 탐사자에게 주어지는 실용적인 방어구.",
                    stats: [
                        { type: "hp", value: 20 },
                        { type: "defense", value: 1 }
                    ],
                    specialOptions: []
                }
            },
            huntingAllStagesClear: { type: "CHEST", rarity: "epic" },
            huntingMonsterCodexComplete: { type: "CHEST", rarity: "rare" },
            huntingMonsterSlayer: { type: "CHEST", rarity: "common" },
            huntingRareMonsterSlayer: { type: "CHEST", rarity: "uncommon" },
            huntingUniqueMonsterSlayer: { type: "CHEST", rarity: "rare" },
            huntingEpicMonsterSlayer: { type: "CHEST", rarity: "epic" },
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
            tournamentStreak3: { type: "CHEST", rarity: "uncommon" }
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
