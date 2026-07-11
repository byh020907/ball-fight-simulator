import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const EQUIPMENT_BALANCE = REWARD_BALANCE.equipment;

export const EQUIPMENT = Object.freeze({
    SLOTS: Object.freeze({
        WEAPON: Object.freeze({ id: "weapon", label: "무기", max: 1 }),
        ARMOR: Object.freeze({ id: "armor", label: "방어구", max: 1 }),
        ACCESSORY: Object.freeze({ id: "accessory", label: "장신구", max: 2 })
    }),
    RARITIES: Object.freeze(["common", "uncommon", "rare", "epic", "legendary"]),
    LEVEL_REQUIREMENTS: Object.freeze({
        COMMON: EQUIPMENT_BALANCE.levelRequirements.common,
        UNCOMMON: EQUIPMENT_BALANCE.levelRequirements.uncommon,
        RARE: EQUIPMENT_BALANCE.levelRequirements.rare,
        EPIC: EQUIPMENT_BALANCE.levelRequirements.epic,
        LEGENDARY: EQUIPMENT_BALANCE.levelRequirements.legendary
    }),
    INVENTORY: Object.freeze({
        DEFAULT_SLOTS: EQUIPMENT_BALANCE.inventory.defaultSlots,
        EXPAND_COST: EQUIPMENT_BALANCE.inventory.expandCost,
        EXPAND_GAIN: EQUIPMENT_BALANCE.inventory.expandGain,
        MAX_SLOTS: EQUIPMENT_BALANCE.inventory.maxSlots
    }),
    ENHANCE: Object.freeze({
        MAX_LEVEL: EQUIPMENT_BALANCE.enhance.maxLevel,
        MAX_FAILURE_RATE: EQUIPMENT_BALANCE.enhance.maxFailureRate,
        STAT_BONUS_PER_LEVEL: EQUIPMENT_BALANCE.enhance.statBonusPerLevel,
        COST: EQUIPMENT_BALANCE.enhance.costs
    }),
    DISASSEMBLE: Object.freeze({
        COMMON: EQUIPMENT_BALANCE.disassembleRewards.common,
        UNCOMMON: EQUIPMENT_BALANCE.disassembleRewards.uncommon,
        RARE: EQUIPMENT_BALANCE.disassembleRewards.rare,
        EPIC: EQUIPMENT_BALANCE.disassembleRewards.epic,
        LEGENDARY: EQUIPMENT_BALANCE.disassembleRewards.legendary
    }),
    SELL: Object.freeze({
        COMMON: EQUIPMENT_BALANCE.sellRewards.common,
        UNCOMMON: EQUIPMENT_BALANCE.sellRewards.uncommon,
        RARE: EQUIPMENT_BALANCE.sellRewards.rare,
        EPIC: EQUIPMENT_BALANCE.sellRewards.epic,
        LEGENDARY: EQUIPMENT_BALANCE.sellRewards.legendary
    }),
    FUSION: Object.freeze({
        COST: Object.freeze({
            COMMON: EQUIPMENT_BALANCE.fusionCosts.common,
            UNCOMMON: EQUIPMENT_BALANCE.fusionCosts.uncommon,
            RARE: EQUIPMENT_BALANCE.fusionCosts.rare,
            EPIC: EQUIPMENT_BALANCE.fusionCosts.epic
        })
    }),
    DRAW: Object.freeze({
        WEAPON: "weapon",
        ARMOR: "armor",
        ACCESSORY: "accessory"
    }),
    STAT_RANGES: Object.freeze({
        COMMON: EQUIPMENT_BALANCE.statRanges.common,
        UNCOMMON: EQUIPMENT_BALANCE.statRanges.uncommon,
        RARE: EQUIPMENT_BALANCE.statRanges.rare,
        EPIC: EQUIPMENT_BALANCE.statRanges.epic,
        LEGENDARY: EQUIPMENT_BALANCE.statRanges.legendary
    }),
    STAT_VALUE_UNITS: EQUIPMENT_BALANCE.statValueUnits,
    NAME_PREFIXES: Object.freeze({
        hp: Object.freeze(["튼튼한", "활력의", "거인의"]),
        damage: Object.freeze(["맹공의", "날카로운", "파괴의"]),
        defense: Object.freeze(["수호자의", "견고한", "철벽의"]),
        speed: Object.freeze(["질풍의", "신속의", "바람의"])
    }),
    SPECIALS: Object.freeze({
        CHANCES: Object.freeze({
            COMMON: EQUIPMENT_BALANCE.specialChances.common,
            UNCOMMON: EQUIPMENT_BALANCE.specialChances.uncommon,
            RARE: EQUIPMENT_BALANCE.specialChances.rare,
            EPIC: EQUIPMENT_BALANCE.specialChances.epic,
            LEGENDARY: EQUIPMENT_BALANCE.specialChances.legendary
        }),
        POOL: Object.freeze([
            Object.freeze({
                type: "crashDamage",
                label: "파쇄",
                nameSuffix: "파쇄",
                ...EQUIPMENT_BALANCE.specialRanges.crashDamage,
                suffix: "%"
            }),
            Object.freeze({
                type: "cooldown",
                label: "순환",
                nameSuffix: "순환",
                ...EQUIPMENT_BALANCE.specialRanges.cooldown,
                suffix: "%"
            }),
            Object.freeze({
                type: "hpSteal",
                label: "갈망",
                nameSuffix: "갈망",
                ...EQUIPMENT_BALANCE.specialRanges.hpSteal,
                suffix: "%"
            })
        ])
    }),
    STAT_TYPES: Object.freeze(["hp", "damage", "defense", "speed"]),
    NAMES: Object.freeze({
        WEAPON: Object.freeze({
            COMMON: Object.freeze(["녹슨 검", "나무 방망이", "돌 도끼", "뼈 단검"]),
            UNCOMMON: Object.freeze(["철검", "강철 도끼", "전투망치", "장궁"]),
            RARE: Object.freeze(["강화된 장검", "마법 지팡이", "무쇠 도끼", "수정 단검"]),
            EPIC: Object.freeze(["어둠의 검", "번개 창", "룬 대검", "정령의 활"]),
            LEGENDARY: Object.freeze(["종말의 검", "신성한 창", "혼돈의 도끼", "시간의 수정"])
        }),
        ARMOR: Object.freeze({
            COMMON: Object.freeze(["천 갑옷", "가죽 조끼", "헝겊 망토", "나무 방패"]),
            UNCOMMON: Object.freeze(["사슬 갑옷", "가죽 갑옷", "철 방패", "강화 망토"]),
            RARE: Object.freeze(["강철 갑옷", "마법 로브", "미늘 갑옷", "수정 방패"]),
            EPIC: Object.freeze(["어둠의 갑옷", "용 비늘 갑옷", "정령 로브", "룬 방패"]),
            LEGENDARY: Object.freeze(["신성한 갑옷", "혼돈의 로브", "전설의 방패", "영원의 망토"])
        }),
        ACCESSORY: Object.freeze({
            COMMON: Object.freeze(["낡은 반지", "나무 목걸이", "돌 팔찌", "천 벨트"]),
            UNCOMMON: Object.freeze(["은 반지", "철 목걸이", "가죽 팔찌", "구리 귀걸이"]),
            RARE: Object.freeze(["마법 반지", "수정 목걸이", "룬 팔찌", "진주 귀걸이"]),
            EPIC: Object.freeze(["어둠의 반지", "정령 목걸이", "마나 팔찌", "룬 귀걸이"]),
            LEGENDARY: Object.freeze(["신성한 반지", "혼돈의 목걸이", "영원의 팔찌", "전설 귀걸이"])
        })
    }),
    DESCRIPTIONS: Object.freeze({
        WEAPON: Object.freeze({
            COMMON: "기본적인 무기",
            UNCOMMON: "견고한 무기",
            RARE: "희귀한 무기",
            EPIC: "강력한 전설 무기",
            LEGENDARY: "신화 속 무기"
        }),
        ARMOR: Object.freeze({
            COMMON: "기본적인 방어구",
            UNCOMMON: "견고한 방어구",
            RARE: "희귀한 방어구",
            EPIC: "강력한 전설 방어구",
            LEGENDARY: "신화 속 방어구"
        }),
        ACCESSORY: Object.freeze({
            COMMON: "평범한 장신구",
            UNCOMMON: "세련된 장신구",
            RARE: "희귀한 장신구",
            EPIC: "강력한 전설 장신구",
            LEGENDARY: "신화 속 장신구"
        })
    })
});
