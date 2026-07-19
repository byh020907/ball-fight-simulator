import { HeroAbility } from "../../abilities/heroAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "HERO",
    id: "hero",
    name: "Hero Ball",
    title: "Hero Orb",
    description: "성장 스택을 충전해 적에게 접근하고, 충돌에서 방출한 성장 코어로 스탯과 방어 능력을 강화합니다.",
    color: "#ffcc00",
    abilityDisplayName: "Hero Orb",
    abilityClass: HeroAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "코어 자성 강화 · 코어당 최대 체력 5% 보호막"
        },
        {
            level: 4
        },
        {
            level: 5
        },
        {
            level: 6,
            abilityTier: 2,
            gameText: "코어당 체력 1% 회복 · 보호막 피격 직선 반격"
        },
        {
            level: 7
        },
        {
            level: 8
        },
        {
            level: 9,
            abilityTier: 3,
            gameText: "보호막 파괴 시 금빛 충격파"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [
            {},
            {
                fortifiedCoreMagnet: true,
                heroArmor: true
            },
            {
                coreRecovery: true,
                shieldCounter: true
            },
            {
                shieldBreakShockwave: true
            }
        ]
    },
    stats: { hp: 162, damage: 15, speed: 286, radius: 49, mass: 1.2, defense: 1.5 },
    mastery: {
        id: "hero_inspiring_presence",
        name: "고무적인 존재감",
        kind: "action_modifier",
        description: "스킬 쿨다운이 {value} 감소합니다.",
        tierKey: "abilityCooldownPercent",
        target: "actionModifiers",
        modifierKey: "cooldownPercent",
        format: "percent"
    }
});
