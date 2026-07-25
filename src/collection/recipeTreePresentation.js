function createTreeNode(node, required, depth, isRoot, getOwnedCount, key = node.id) {
    const owned = Math.max(0, Number(getOwnedCount(node.id)) || 0);
    return {
        id: node.id,
        key,
        name: node.name,
        iconTag: node.iconTag,
        depth,
        owned,
        required,
        satisfied: isRoot || owned >= required,
        isRoot,
        hasRecipe: Array.isArray(node.recipe) && node.recipe.length > 0,
        cost: Number(node.combineCost) || 0,
        children: []
    };
}

function getIngredientCounts(recipe = []) {
    return recipe.reduce((counts, id) => {
        counts.set(id, (counts.get(id) ?? 0) + 1);
        return counts;
    }, new Map());
}

/**
 * Converts an acyclic recipe registry into display-only levels. Nodes are only
 * merged among siblings so separate parent-to-child relationships stay visible.
 */
export function createRecipeTreePresentation({ rootId, getNode, getOwnedCount = () => 0 }) {
    const rootTemplate = getNode(rootId);
    if (!rootTemplate) return null;

    const root = createTreeNode(rootTemplate, 1, 0, true, getOwnedCount);
    const levels = [[root]];
    let currentLevel = [root];

    while (currentLevel.length > 0) {
        const nextLevel = [];
        for (const parent of currentLevel) {
            const parentTemplate = getNode(parent.id);
            for (const [ingredientId, ingredientCount] of getIngredientCounts(parentTemplate?.recipe)) {
                const ingredient = getNode(ingredientId);
                if (!ingredient) continue;
                const child = createTreeNode(
                    ingredient,
                    parent.required * ingredientCount,
                    parent.depth + 1,
                    false,
                    getOwnedCount,
                    `${parent.key}>${ingredientId}`
                );
                parent.children.push(child);
                nextLevel.push(child);
            }
        }
        if (nextLevel.length === 0) break;
        levels.push(nextLevel);
        currentLevel = nextLevel;
    }

    return { root, levels };
}
