export const EQUIPMENT = Object.freeze({
    SLOTS: Object.freeze({
        WEAPON: Object.freeze({ id: "weapon", label: "무기", max: 1 }),
        ARMOR: Object.freeze({ id: "armor", label: "방어구", max: 1 }),
        ACCESSORY: Object.freeze({ id: "accessory", label: "장신구", max: 2 })
    }),
    RARITIES: Object.freeze(["common", "uncommon", "rare", "epic", "legendary"]),
    LEVEL_REQUIREMENTS: Object.freeze({
        COMMON: 1,
        UNCOMMON: 3,
        RARE: 5,
        EPIC: 8,
        LEGENDARY: 10
    }),
    INVENTORY: Object.freeze({
        DEFAULT_SLOTS: 5,
        EXPAND_COST: 100,
        EXPAND_GAIN: 3,
        MAX_SLOTS: 100
    }),
    ENHANCE: Object.freeze({
        MAX_LEVEL: 5,
        MAX_FAILURE_RATE: 0.8,
        STAT_BONUS_PER_LEVEL: 0.2,
        COST: Object.freeze([
            Object.freeze({ stones: 2, shards: 10 }),
            Object.freeze({ stones: 4, shards: 15 }),
            Object.freeze({ stones: 8, shards: 25 }),
            Object.freeze({ stones: 15, shards: 40 }),
            Object.freeze({ stones: 25, shards: 60 })
        ])
    }),
    DISASSEMBLE: Object.freeze({
        COMMON: 1,
        UNCOMMON: 3,
        RARE: 8,
        EPIC: 20,
        LEGENDARY: 50
    }),
    SELL: Object.freeze({
        COMMON: 5,
        UNCOMMON: 12,
        RARE: 30,
        EPIC: 80,
        LEGENDARY: 200
    }),
    FUSION: Object.freeze({
        COST: Object.freeze({
            COMMON: Object.freeze({ stones: 2, shards: 20 }),
            UNCOMMON: Object.freeze({ stones: 5, shards: 40 }),
            RARE: Object.freeze({ stones: 12, shards: 80 }),
            EPIC: Object.freeze({ stones: 25, shards: 150 })
        })
    }),
    DRAW: Object.freeze({
        WEAPON: "weapon",
        ARMOR: "armor",
        ACCESSORY: "accessory"
    }),
    STAT_RANGES: Object.freeze({
        COMMON: Object.freeze({ min: 1, max: 3, statCount: Object.freeze({ min: 1, max: 1 }) }),
        UNCOMMON: Object.freeze({ min: 2, max: 5, statCount: Object.freeze({ min: 1, max: 1 }) }),
        RARE: Object.freeze({ min: 4, max: 8, statCount: Object.freeze({ min: 1, max: 2 }) }),
        EPIC: Object.freeze({ min: 6, max: 12, statCount: Object.freeze({ min: 1, max: 2 }) }),
        LEGENDARY: Object.freeze({ min: 10, max: 18, statCount: Object.freeze({ min: 1, max: 2 }) })
    }),
    SPECIALS: Object.freeze({
        CHANCES: Object.freeze({
            COMMON: 0,
            UNCOMMON: 0,
            RARE: 0.25,
            EPIC: 0.5,
            LEGENDARY: 0.8
        }),
        POOL: Object.freeze([
            Object.freeze({ type: "crashDamage", label: "충돌 피해", min: 5, max: 15, suffix: "%" }),
            Object.freeze({ type: "cooldown", label: "쿨다운", min: 3, max: 10, suffix: "%" }),
            Object.freeze({ type: "hpSteal", label: "HP 흡혈", min: 2, max: 8, suffix: "%" })
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
