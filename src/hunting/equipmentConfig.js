export const EQUIPMENT_SLOTS = Object.freeze([
    { id: "weapon", label: "무기", max: 1 },
    { id: "armor", label: "방어구", max: 1 },
    { id: "accessory", label: "장신구", max: 2 }
]);

export const EQUIPMENT_RARITIES = Object.freeze(["common", "uncommon", "rare", "epic", "legendary"]);

export const EQUIPMENT_STAT_RANGES = Object.freeze({
    common: Object.freeze({ min: 1, max: 3, statCount: { min: 1, max: 1 } }),
    uncommon: Object.freeze({ min: 2, max: 5, statCount: { min: 1, max: 1 } }),
    rare: Object.freeze({ min: 4, max: 8, statCount: { min: 1, max: 2 } }),
    epic: Object.freeze({ min: 6, max: 12, statCount: { min: 1, max: 2 } }),
    legendary: Object.freeze({ min: 10, max: 18, statCount: { min: 1, max: 2 } })
});

export const SPECIAL_OPTION_CHANCES = Object.freeze({
    common: 0,
    uncommon: 0,
    rare: 0.25,
    epic: 0.5,
    legendary: 0.8
});

export const SPECIAL_OPTION_POOL = Object.freeze([
    { type: "crashDamage", label: "충돌 피해", min: 5, max: 15, suffix: "%" },
    { type: "cooldown", label: "쿨다운", min: 3, max: 10, suffix: "%" },
    { type: "hpSteal", label: "HP 흡혈", min: 2, max: 8, suffix: "%" }
]);

export const STAT_TYPES = Object.freeze(["hp", "damage", "defense", "speed"]);

export const EQUIPMENT_NAMES = Object.freeze({
    weapon: Object.freeze({
        common: Object.freeze(["녹슨 검", "나무 방망이", "돌 도끼", "뼈 단검"]),
        uncommon: Object.freeze(["철검", "강철 도끼", "전투망치", "장궁"]),
        rare: Object.freeze(["강화된 장검", "마법 지팡이", "무쇠 도끼", "수정 단검"]),
        epic: Object.freeze(["어둠의 검", "번개 창", "룬 대검", "정령의 활"]),
        legendary: Object.freeze(["종말의 검", "신성한 창", "혼돈의 도끼", "시간의 수정"])
    }),
    armor: Object.freeze({
        common: Object.freeze(["천 갑옷", "가죽 조끼", "헝겊 망토", "나무 방패"]),
        uncommon: Object.freeze(["사슬 갑옷", "가죽 갑옷", "철 방패", "강화 망토"]),
        rare: Object.freeze(["강철 갑옷", "마법 로브", "미늘 갑옷", "수정 방패"]),
        epic: Object.freeze(["어둠의 갑옷", "용 비늘 갑옷", "정령 로브", "룬 방패"]),
        legendary: Object.freeze(["신성한 갑옷", "혼돈의 로브", "전설의 방패", "영원의 망토"])
    }),
    accessory: Object.freeze({
        common: Object.freeze(["낡은 반지", "나무 목걸이", "돌 팔찌", "천 벨트"]),
        uncommon: Object.freeze(["은 반지", "철 목걸이", "가죽 팔찌", "구리 귀걸이"]),
        rare: Object.freeze(["마법 반지", "수정 목걸이", "룬 팔찌", "진주 귀걸이"]),
        epic: Object.freeze(["어둠의 반지", "정령 목걸이", "마나 팔찌", "룬 귀걸이"]),
        legendary: Object.freeze(["신성한 반지", "혼돈의 목걸이", "영원의 팔찌", "전설 귀걸이"])
    })
});

export const EQUIPMENT_DESCRIPTIONS = Object.freeze({
    weapon: Object.freeze({
        common: "기본적인 무기",
        uncommon: "견고한 무기",
        rare: "희귀한 무기",
        epic: "강력한 전설 무기",
        legendary: "신화 속 무기"
    }),
    armor: Object.freeze({
        common: "기본적인 방어구",
        uncommon: "견고한 방어구",
        rare: "희귀한 방어구",
        epic: "강력한 전설 방어구",
        legendary: "신화 속 방어구"
    }),
    accessory: Object.freeze({
        common: "평범한 장신구",
        uncommon: "세련된 장신구",
        rare: "희귀한 장신구",
        epic: "강력한 전설 장신구",
        legendary: "신화 속 장신구"
    })
});

function defaultRng() {
    return Math.random();
}

function pickRandom(arr, rng = defaultRng) {
    return arr[Math.floor(rng() * arr.length)];
}

function rollInt(min, max, rng = defaultRng) {
    return Math.floor(min + rng() * (max - min + 1));
}

export function createEquipmentInstance({ rarity = "common", slot = null, rng = defaultRng } = {}) {
    const safeRarity = EQUIPMENT_RARITIES.includes(rarity) ? rarity : "common";
    const range = EQUIPMENT_STAT_RANGES[safeRarity];

    const assignedSlot =
        slot && EQUIPMENT_SLOTS.some((s) => s.id === slot) ? slot : pickRandom(EQUIPMENT_SLOTS, rng).id;

    const name = pickRandom(EQUIPMENT_NAMES[assignedSlot][safeRarity], rng);
    const description = EQUIPMENT_DESCRIPTIONS[assignedSlot][safeRarity];

    const statCount = rollInt(range.statCount.min, range.statCount.max, rng);
    const availableStats = [...STAT_TYPES];
    const stats = [];
    for (let i = 0; i < statCount && availableStats.length > 0; i++) {
        const statIndex = Math.floor(rng() * availableStats.length);
        const statType = availableStats.splice(statIndex, 1)[0];
        const value = rollInt(range.min, range.max, rng);
        stats.push({ type: statType, value, min: range.min, max: range.max });
    }

    let specialOptions = null;
    const specialChance = SPECIAL_OPTION_CHANCES[safeRarity];
    if (specialChance > 0 && rng() < specialChance && SPECIAL_OPTION_POOL.length > 0) {
        const option = pickRandom(SPECIAL_OPTION_POOL, rng);
        const value = rollInt(option.min, option.max, rng);
        specialOptions = [{ type: option.type, value }];
    }

    return {
        instanceId: `eq-${Date.now()}-${Math.floor(rng() * 1_000_000)}`,
        rarity: safeRarity,
        slot: assignedSlot,
        name,
        description,
        stats,
        specialOptions,
        enhanceLevel: 0
    };
}

export function generateEquipmentFromRarity(rarity, rng = defaultRng) {
    return createEquipmentInstance({ rarity, rng });
}

export function getEquippedStatBonuses(profile) {
    const bonuses = { hp: 0, damage: 0, defense: 0, speed: 0 };
    const equipment = profile?.equipment;
    if (!equipment || !Array.isArray(equipment.inventory)) return bonuses;

    const equippedIds = Object.values(equipment.equipped ?? {}).filter(Boolean);
    if (equippedIds.length === 0) return bonuses;

    for (const item of equipment.inventory) {
        if (!equippedIds.includes(item.instanceId)) continue;
        if (!Array.isArray(item.stats)) continue;
        for (const stat of item.stats) {
            if (stat.type in bonuses) {
                bonuses[stat.type] += stat.value;
            }
        }
    }
    return bonuses;
}

export function applyEquipmentStats(spec, profile) {
    const bonuses = getEquippedStatBonuses(profile);
    const stats = { ...spec.stats };
    for (const [key, value] of Object.entries(bonuses)) {
        if (value !== 0 && key in stats) {
            stats[key] = Number((stats[key] + value).toFixed(3));
        }
    }
    return { ...spec, stats };
}
