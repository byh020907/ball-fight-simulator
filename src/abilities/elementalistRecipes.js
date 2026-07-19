export const ELEMENTAL_TYPES = Object.freeze(["fire", "electric", "frost", "wind", "earth"]);

export const ELEMENTAL_PALETTE = Object.freeze({
    water: "#77dfff",
    fire: "#ff7043",
    electric: "#ffe066",
    frost: "#6f9fff",
    wind: "#57d985",
    earth: "#c59b61"
});

const recipe = (id, name, elements, options) => Object.freeze({ id, name, elements, ...options });

export const ELEMENTAL_COMPOSITE_RECIPES = Object.freeze({
    "electric:fire": recipe("plasma_drill", "플라즈마 송곳", ["fire", "electric"], {
        damageMultiplier: 2.4,
        shape: "drill",
        motion: "spin",
        path: "focus",
        marker: "pierce",
        finish: "pierce"
    }),
    "fire:frost": recipe("thermal_fracture", "열충격 파쇄", ["fire", "frost"], {
        damageMultiplier: 2.2,
        shape: "crack",
        motion: "alternate",
        path: "fracture",
        marker: "thermal",
        finish: "shatter",
        slow: { duration: 0.7, amount: 0.65 }
    }),
    "fire:wind": recipe("flame_spiral", "화염 나선", ["fire", "wind"], {
        damageMultiplier: 2.1,
        shape: "ember",
        motion: "spiral",
        path: "spiral",
        marker: "burn",
        finish: "burst",
        pushImpulse: 0.2
    }),
    "earth:fire": recipe("lava_shards", "용암 파편", ["fire", "earth"], {
        damageMultiplier: 2.3,
        shape: "shard",
        motion: "volley",
        path: "lob",
        marker: "magma",
        finish: "burst"
    }),
    "electric:frost": recipe("polar_ice_crystals", "극성 빙정", ["electric", "frost"], {
        damageMultiplier: 2.2,
        shape: "crystal",
        motion: "converge",
        path: "arc",
        marker: "polarity",
        finish: "shatter",
        slow: { duration: 0.8, amount: 0.6 }
    }),
    "electric:wind": recipe("thunder_pursuit", "천둥 추적", ["electric", "wind"], {
        damageMultiplier: 2,
        shape: "spark",
        motion: "orbit",
        path: "tangent",
        marker: "travel",
        finish: "shock",
        finishBurst: true,
        pushImpulse: 0.2
    }),
    "earth:electric": recipe("magnetic_railgun", "자력 레일포", ["electric", "earth"], {
        damageMultiplier: 2.4,
        shape: "rock",
        motion: "rail",
        path: "line",
        marker: "charge",
        finish: "pierce"
    }),
    "frost:wind": recipe("ice_blade_flurry", "빙인 난무", ["frost", "wind"], {
        damageMultiplier: 2.1,
        shape: "blade",
        motion: "orbit",
        path: "tangent",
        marker: "cut",
        finish: "converge",
        slow: { duration: 0.65, amount: 0.7 }
    }),
    "earth:frost": recipe("glacial_crush", "빙하 압쇄", ["frost", "earth"], {
        damageMultiplier: 2.45,
        shape: "boulder",
        motion: "pinch",
        path: "line",
        marker: "crack",
        finish: "crush",
        slow: { duration: 0.55, amount: 0.65 }
    }),
    "earth:wind": recipe("sandstone_cutting", "사암 절삭", ["wind", "earth"], {
        damageMultiplier: 2.2,
        shape: "sand",
        motion: "flow",
        path: "wave",
        marker: "erosion",
        finish: "crush"
    })
});

export function getElementalCompositeRecipe(first, second) {
    if (!first || !second || first === second) return null;
    return ELEMENTAL_COMPOSITE_RECIPES[[first, second].sort().join(":")] ?? null;
}

export function chooseElement(rng, excluded = []) {
    const blocked = new Set(Array.isArray(excluded) ? excluded : [excluded]);
    const candidates = ELEMENTAL_TYPES.filter((element) => !blocked.has(element));
    return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
}
