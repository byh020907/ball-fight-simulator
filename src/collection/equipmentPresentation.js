import { EQUIPMENT_TEMPLATE_TIERS, EQUIPMENT_TEMPLATES } from "../hunting/equipmentTemplates.js";
import { getEquipmentCount, getEquipmentRecipePreview } from "../hunting/equipmentInventory.js";
import { getEquipmentPassivePresentation } from "./equipmentPassivePresentation.js";
import { createRecipeTreePresentation } from "./recipeTreePresentation.js";

const TIER_LABELS = Object.freeze({ basic: "기초", intermediate: "중간", completed: "완성" });
const STAT_LABELS = Object.freeze({
    hp: "HP",
    damage: "공격",
    defense: "방어",
    speed: "속도",
    skill: "스킬 가속",
    criticalChance: "치명타",
    mass: "질량",
    wallBounce: "벽 반사",
    angularImpulse: "회전 충격"
});

function presentStats(stats) {
    return Object.entries(stats).map(([id, value]) => ({ id, label: STAT_LABELS[id] ?? id, value }));
}

function presentBuildsInto(profile, template) {
    return EQUIPMENT_TEMPLATES.filter((candidate) => candidate.recipe.includes(template.id)).map((candidate) => {
        const recipe = getEquipmentRecipePreview(profile, candidate.id);
        return {
            id: candidate.id,
            name: candidate.name,
            iconTag: candidate.iconTag,
            tier: candidate.tier,
            tierLabel: TIER_LABELS[candidate.tier],
            count: getEquipmentCount(profile, candidate.id),
            canCraft: recipe?.canCraft ?? false
        };
    });
}

function presentTemplate(profile, template) {
    const recipe = getEquipmentRecipePreview(profile, template.id);
    return {
        id: template.id,
        name: template.name,
        tier: template.tier,
        tierLabel: TIER_LABELS[template.tier],
        iconTag: template.iconTag,
        count: getEquipmentCount(profile, template.id),
        buildsInto: presentBuildsInto(profile, template),
        stats: presentStats(template.stats),
        passiveId: template.passiveId,
        passive: getEquipmentPassivePresentation(template.passiveId),
        recipe: recipe
            ? {
                  cost: recipe.combineCost,
                  canCraft: recipe.canCraft,
                  missingReason: recipe.ingredients.some((ingredient) => ingredient.missingCount > 0)
                      ? "missing ingredients"
                      : recipe.missingShards > 0
                        ? "missing shards"
                        : null,
                  ingredients: recipe.ingredients.map((ingredient) => ({
                      id: ingredient.template.id,
                      name: ingredient.template.name,
                      owned: ingredient.ownedCount,
                      required: ingredient.requiredCount
                  })),
                  tree: createRecipeTreePresentation({
                      rootId: template.id,
                      getNode: (id) => EQUIPMENT_TEMPLATES.find((item) => item.id === id) ?? null,
                      getOwnedCount: (id) => getEquipmentCount(profile, id)
                  })
              }
            : null
    };
}

export function createEquipmentPresentation(profile) {
    const equipped = profile?.equipment?.equipped ?? [];
    const templates = EQUIPMENT_TEMPLATES.map((template) => presentTemplate(profile, template));
    return {
        shards: Math.floor(Number(profile?.hunting?.shards) || 0),
        slots: Array.from({ length: 6 }, (_, index) => {
            const templateId = equipped[index];
            const template = templateId ? EQUIPMENT_TEMPLATES.find((item) => item.id === templateId) : null;
            return {
                index,
                templateId,
                name: template?.name ?? null,
                iconTag: template?.iconTag ?? null,
                stats: template ? presentStats(template.stats).slice(0, 2) : []
            };
        }),
        tiers: EQUIPMENT_TEMPLATE_TIERS.map((tier) => ({
            id: tier,
            label: TIER_LABELS[tier],
            templates: templates.filter((template) => template.tier === tier)
        }))
    };
}
