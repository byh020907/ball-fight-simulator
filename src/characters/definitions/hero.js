import { HeroAbility } from "../../abilities/heroAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "HERO",
    id: "hero",
    name: "Hero Ball",
    title: "Hero Orb",
    description:
        "성장 스택을 충전하고 적과 충돌할 때 같은 수의 성장 코어를 방출합니다. 직접 회수하면 무작위 스탯이 증가합니다.",
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
            gameText: "성장 코어 근거리 자석 회수"
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
            gameText: "회수 코어 공명 조각 · 순차 ×0.20"
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
            gameText: "조각 5개 Heroic Burst · 90px ×0.75"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [
            {},
            {
                magneticCoreCollection: true
            },
            {
                resonanceFragments: true
            },
            {
                heroicBurst: true
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
