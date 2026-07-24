export const EQUIPMENT_STAT_VALUE_RATIOS = Object.freeze({
    hp: 10,
    damage: 1,
    defense: 6,
    speed: 15,
    skill: 6,
    criticalChance: 7,
    mass: 7,
    wallBounce: 7,
    angularImpulse: 7
});

export const EQUIPMENT_TEMPLATE_TIERS = Object.freeze(["basic", "intermediate", "completed"]);
export const EQUIPMENT_MAX_STACK = 100;

const basicDefinitions = [
    ["attack_sword", "금 간 장검", "damage", 2, 200],
    ["attack_greatsword", "무거운 대검", "damage", 4, 450],
    ["health_crystal", "생명 수정", "hp", 20, 200],
    ["health_belt", "맥동 허리띠", "hp", 40, 450],
    ["defense_leather", "가죽 갑옷", "defense", 12, 200],
    ["defense_chain", "쇠사슬 조끼", "defense", 24, 450],
    ["speed_boots", "가벼운 장화", "speed", 30, 200],
    ["speed_wing", "날개깃", "speed", 60, 450],
    ["haste_mote", "마력 구슬", "skill", 12, 200],
    ["haste_kindlegem", "점화석", "skill", 24, 450],
    ["crit_cloak", "행운 망토", "criticalChance", 14, 200],
    ["crit_twin_blades", "쌍날 부적", "criticalChance", 28, 450],
    ["mass_weight", "무쇠 추", "mass", 14, 300],
    ["wall_spring", "압축 스프링", "wallBounce", 14, 300],
    ["collision_gyro", "충격 자이로", "angularImpulse", 14, 300]
];

const intermediateDefinitions = [
    ["intermediate_attack_crit", "정밀 보강검", ["attack_sword", "crit_cloak"], "criticalChance"],
    ["intermediate_attack_haste", "마력 동력검", ["attack_greatsword", "haste_mote"], "damage"],
    ["intermediate_attack_speed", "경량 날개검", ["attack_sword", "speed_boots"], "speed"],
    ["intermediate_attack_health", "생명 수정 절단구", ["attack_greatsword", "health_crystal"], "damage"],
    ["intermediate_health_defense", "수정 가죽흉갑", ["health_crystal", "defense_leather"], "defense"],
    ["intermediate_health_haste", "열맥동 허리장치", ["health_belt", "haste_kindlegem"], "hp"],
    ["intermediate_defense_wall", "스프링 완충판", ["defense_leather", "wall_spring"], "wallBounce"],
    ["intermediate_defense_mass", "중량 사슬조끼", ["defense_chain", "mass_weight"], "mass"],
    ["intermediate_speed_wall", "스프링 도약화", ["speed_boots", "wall_spring"], "speed"],
    ["intermediate_speed_angular", "날개 자이로 안정기", ["speed_wing", "collision_gyro"], "angularImpulse"],
    ["intermediate_haste_angular", "점화 자이로 코어", ["haste_kindlegem", "collision_gyro"], "skill"],
    ["intermediate_crit_mass", "쌍날 충격두", ["crit_twin_blades", "mass_weight"], "mass"]
];

const completedDefinitions = [
    [
        "completed_ability_crit",
        "별을 꿰는 서약",
        ["intermediate_attack_crit", "intermediate_attack_haste"],
        "criticalChance",
        "ability_crit"
    ],
    [
        "completed_pursuit_flurry",
        "쌍익의 질풍",
        ["intermediate_attack_speed", "intermediate_attack_speed", "speed_wing"],
        "speed",
        "pursuit_flurry"
    ],
    [
        "completed_mass_execution",
        "종언의 추락",
        ["intermediate_attack_crit", "intermediate_crit_mass", "attack_greatsword"],
        "mass",
        "mass_execution"
    ],
    [
        "completed_vital_heat",
        "홍련의 맥동",
        ["intermediate_attack_health", "intermediate_health_haste", "haste_kindlegem"],
        "hp",
        "vital_heat"
    ],
    [
        "completed_defense_conversion",
        "철혈의 송곳니",
        ["intermediate_health_defense", "attack_sword"],
        "defense",
        "defense_conversion"
    ],
    [
        "completed_mass_shockwave",
        "낙성의 파문",
        ["intermediate_defense_mass", "intermediate_crit_mass", "mass_weight"],
        "mass",
        "mass_shockwave"
    ],
    [
        "completed_wall_ricochet",
        "되튀는 초승달",
        ["intermediate_defense_wall", "intermediate_speed_wall"],
        "wallBounce",
        "wall_ricochet"
    ],
    [
        "completed_wall_heat",
        "화염심장 성채",
        ["intermediate_health_haste", "intermediate_defense_wall", "haste_kindlegem"],
        "wallBounce",
        "wall_heat"
    ],
    [
        "completed_speed_angular",
        "천공의 나선",
        ["intermediate_attack_speed", "intermediate_speed_angular"],
        "angularImpulse",
        "speed_angular"
    ],
    [
        "completed_ability_echo",
        "쌍성의 메아리",
        ["intermediate_attack_haste", "intermediate_haste_angular", "haste_mote"],
        "skill",
        "ability_echo"
    ],
    [
        "completed_vortex_charge",
        "폭풍의 윤환",
        ["intermediate_speed_angular", "intermediate_haste_angular"],
        "angularImpulse",
        "vortex_charge"
    ],
    [
        "completed_vital_overwhelm",
        "적룡의 심갑",
        ["intermediate_attack_health", "intermediate_health_defense", "health_crystal"],
        "hp",
        "vital_overwhelm"
    ]
];

export function roundEquipmentStat(value) {
    return Math.round((Number(value) || 0) * 2) / 2;
}

export function calculateEquipmentValuePoints(stats = {}) {
    return Object.entries(stats).reduce(
        (total, [stat, value]) => total + (Number(value) || 0) / (EQUIPMENT_STAT_VALUE_RATIOS[stat] ?? Infinity),
        0
    );
}

export function calculateCombinationCost(ingredientTemplates) {
    const value = ingredientTemplates.reduce((sum, template) => sum + (template.cost ?? 0), 0) * 0.25;
    return Math.ceil(value / 25) * 25;
}

export function calculateCombinedStats(ingredientTemplates, representativeStat, combineCost) {
    const stats = ingredientTemplates.reduce((result, template) => {
        for (const [stat, value] of Object.entries(template.stats)) result[stat] = (result[stat] ?? 0) + value;
        return result;
    }, {});
    stats[representativeStat] = roundEquipmentStat(
        (stats[representativeStat] ?? 0) + (combineCost / 100) * EQUIPMENT_STAT_VALUE_RATIOS[representativeStat]
    );
    return Object.freeze(stats);
}

function freezeTemplate(template) {
    return Object.freeze({
        ...template,
        recipe: Object.freeze([...template.recipe]),
        stats: Object.freeze({ ...template.stats })
    });
}

function createRegistry() {
    const templates = basicDefinitions.map(([id, name, stat, value, shopCost]) =>
        freezeTemplate({
            id,
            name,
            iconTag: id,
            tier: "basic",
            stats: { [stat]: value },
            shopCost,
            cost: shopCost,
            combineCost: 0,
            recipe: [],
            passiveId: null
        })
    );
    const byId = new Map(templates.map((template) => [template.id, template]));
    const addCrafted = ([id, name, recipe, representativeStat, passiveId = null], tier) => {
        const ingredients = recipe.map((ingredientId) => byId.get(ingredientId));
        if (ingredients.some((ingredient) => !ingredient)) throw new Error(`Unknown equipment ingredient: ${id}`);
        const combineCost = calculateCombinationCost(ingredients);
        const template = freezeTemplate({
            id,
            name,
            iconTag: id,
            tier,
            stats: calculateCombinedStats(ingredients, representativeStat, combineCost),
            shopCost: null,
            cost: ingredients.reduce((sum, ingredient) => sum + ingredient.cost, 0) + combineCost,
            combineCost,
            recipe,
            passiveId
        });
        templates.push(template);
        byId.set(id, template);
    };
    intermediateDefinitions.forEach((definition) => addCrafted(definition, "intermediate"));
    completedDefinitions.forEach((definition) => addCrafted(definition, "completed"));
    return { templates, byId };
}

const registry = createRegistry();
export const EQUIPMENT_TEMPLATES = Object.freeze(registry.templates);
export const EQUIPMENT_TEMPLATE_BY_ID = Object.freeze(
    Object.fromEntries(EQUIPMENT_TEMPLATES.map((template) => [template.id, template]))
);

export function getEquipmentTemplate(templateId) {
    return EQUIPMENT_TEMPLATE_BY_ID[templateId] ?? null;
}

export function validateEquipmentTemplateRegistry(templates = EQUIPMENT_TEMPLATES) {
    const ids = new Set();
    const errors = [];
    for (const template of templates) {
        if (ids.has(template.id)) errors.push(`Duplicate equipment template: ${template.id}`);
        ids.add(template.id);
        if (!EQUIPMENT_TEMPLATE_TIERS.includes(template.tier)) errors.push(`Invalid tier: ${template.id}`);
        if (template.recipe.length > 3) errors.push(`Recipe is too large: ${template.id}`);
        for (const ingredientId of template.recipe) {
            const ingredient = getEquipmentTemplate(ingredientId);
            if (!ingredient) errors.push(`Missing ingredient: ${template.id}/${ingredientId}`);
            else if (ingredient.tier === "completed")
                errors.push(`Completed ingredient: ${template.id}/${ingredientId}`);
        }
        if (template.tier === "completed" && !template.passiveId) errors.push(`Missing passive: ${template.id}`);
    }
    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
