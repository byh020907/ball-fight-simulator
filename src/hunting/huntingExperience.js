import { calcMatchXp } from "../experience/experienceState.js";
import { REWARD_BALANCE } from "../rewardBalanceConfig.js";

const EXPERIENCE_CONFIG = REWARD_BALANCE.hunting.loot.experienceDrops;
const EXPERIENCE_RARITIES = Object.freeze(Object.keys(EXPERIENCE_CONFIG.rarity));

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getExperienceRarity(fighter) {
    const rarityTag = fighter?.hunting?.monsterTags?.find((tag) => tag.startsWith("rarity:"));
    const rarity = rarityTag?.slice("rarity:".length);
    return EXPERIENCE_RARITIES.includes(rarity) ? rarity : "common";
}

function getEnemyType(fighter) {
    const enemyType = fighter?.hunting?.enemyType;
    return EXPERIENCE_CONFIG.enemyType[enemyType] ? enemyType : "normal";
}

function isBoss(fighter) {
    return Boolean(fighter?.hunting?.isMiniboss || fighter?.hunting?.bossKind);
}

function distributeIntegerTotal(total, weights) {
    const safeTotal = Math.max(0, Math.floor(total));
    const safeWeights = weights.map((weight) => Math.max(0, Number(weight) || 0));
    const weightTotal = safeWeights.reduce((sum, weight) => sum + weight, 0);
    if (safeTotal <= 0 || weightTotal <= 0) return safeWeights.map(() => 0);

    const amounts = safeWeights.map((weight) => Math.floor((safeTotal * weight) / weightTotal));
    let remainder = safeTotal - amounts.reduce((sum, amount) => sum + amount, 0);
    safeWeights
        .map((weight, index) => ({ index, fraction: (safeTotal * weight) / weightTotal - amounts[index] }))
        .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
        .forEach(({ index }) => {
            if (remainder <= 0) return;
            amounts[index] += 1;
            remainder -= 1;
        });
    return amounts;
}

export function getHuntingExperienceRarity(fighter) {
    return getExperienceRarity(fighter);
}

export function getHuntingExperienceWeight(fighter) {
    const rarity = EXPERIENCE_CONFIG.rarity[getExperienceRarity(fighter)];
    const enemyType = EXPERIENCE_CONFIG.enemyType[getEnemyType(fighter)];
    const bossMultiplier = isBoss(fighter) ? EXPERIENCE_CONFIG.boss.allocationMultiplier : 1;
    return rarity.allocationWeight * enemyType.allocationMultiplier * bossMultiplier;
}

export function createHuntingExperienceAllocation(fighters = []) {
    const eligible = fighters.filter(
        (fighter) => fighter?.id && (fighter?.hunting?.isMob || fighter?.hunting?.isMiniboss)
    );
    const amounts = distributeIntegerTotal(
        EXPERIENCE_CONFIG.killXpPool,
        eligible.map((fighter) => getHuntingExperienceWeight(fighter))
    );
    return new Map(eligible.map((fighter, index) => [fighter.id, amounts[index]]));
}

export function getHuntingExperienceDropCount(fighter, amount, remainingCapacity = Infinity) {
    const safeAmount = Math.max(0, Math.floor(amount));
    const safeCapacity = Math.max(0, Math.floor(remainingCapacity));
    if (safeAmount <= 0 || safeCapacity <= 0) return 0;

    const rarity = EXPERIENCE_CONFIG.rarity[getExperienceRarity(fighter)];
    const enemyType = EXPERIENCE_CONFIG.enemyType[getEnemyType(fighter)];
    const requested = isBoss(fighter)
        ? EXPERIENCE_CONFIG.boss.physicalDropCount
        : rarity.physicalDropCount + enemyType.physicalDropBonus;
    return Math.min(safeAmount, safeCapacity, requested);
}

export function splitHuntingExperienceAmount(amount, count) {
    const safeAmount = Math.max(0, Math.floor(amount));
    const safeCount = Math.min(safeAmount, Math.max(0, Math.floor(count)));
    return distributeIntegerTotal(
        safeAmount,
        Array.from({ length: safeCount }, () => 1)
    );
}

export function getHuntingCompletionExperienceDropCount(amount, remainingCapacity = Infinity) {
    const safeAmount = Math.max(0, Math.floor(amount));
    return Math.min(safeAmount, Math.max(0, Math.floor(remainingCapacity)), EXPERIENCE_CONFIG.completionDropCount);
}

export function getHuntingExperienceDropLimit() {
    return EXPERIENCE_CONFIG.maxPhysicalDropsPerBattle;
}

export function getHuntingVictoryExperienceBonus(fighters = []) {
    return fighters.reduce((highestBonus, fighter) => {
        const rarity = EXPERIENCE_CONFIG.rarity[getExperienceRarity(fighter)];
        const enemyType = EXPERIENCE_CONFIG.enemyType[getEnemyType(fighter)];
        const bonus = isBoss(fighter)
            ? Math.max(EXPERIENCE_CONFIG.boss.victoryBonus, enemyType.victoryBonus)
            : Math.max(rarity.victoryBonus, enemyType.victoryBonus);
        return Math.max(highestBonus, bonus);
    }, 0);
}

export function getHuntingCompletionExperience(matchReport, fighters = []) {
    const matchXp = calcMatchXp({
        damageDealt: matchReport?.combatDamageDealt ?? 0,
        opponentMaxHp: matchReport?.opponentMaxHp ?? 0,
        hpRemain: matchReport?.hpRemain ?? 0,
        myMaxHp: matchReport?.myMaxHp ?? 0,
        minHpRatio: matchReport?.lowestHpRatio ?? 1,
        won: true,
        stage: 1
    });
    return Math.max(0, matchXp - EXPERIENCE_CONFIG.killXpPool) + getHuntingVictoryExperienceBonus(fighters);
}

export function getHuntingExperienceDropColor() {
    return "#86d94b";
}
