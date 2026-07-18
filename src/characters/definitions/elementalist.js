import { ElementalistAbility } from "../../abilities/elementalistAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "ELEMENTALIST",
    id: "elementalist",
    name: "Elementalist Ball",
    title: "Elemental Confluence",
    description:
        "물 에너지 볼이 적중한 자리에서 원소 오브를 방출합니다. 회수한 오브의 원소와 젖음 상태에 따라 단일 대상 주문을 완성합니다.",
    color: "#34425f",
    abilityDisplayName: "Elementalist",
    abilityClass: ElementalistAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "젖음 2.5초 · 원 피격자 우선 원소 반응"
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
            gameText: "30% 확률로 서로 다른 원소 오브 2개"
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
            gameText: "같은 시전자 오브 자성 · 10종 원소 융합"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [
            {},
            {
                wetDuration: 2.5
            },
            {
                dualOrbChance: 0.3
            },
            {
                orbitalFusion: true
            }
        ]
    },
    stats: { hp: 165, damage: 15, speed: 295, radius: 50, mass: 1.1, defense: 2 },
    mastery: {
        id: "elementalist_elemental_blessing",
        name: "원소 가호",
        kind: "stat_modifier",
        description: "방어력이 {value} 증가합니다.",
        tierKey: "defense",
        target: "statModifiers",
        modifierKey: "defense",
        format: "percent"
    },
    availability: { unlockType: "huntingChampion" },
    rebirth: { actionEligible: true, subAction: { automatic: true, cooldownSeconds: 1.5, reusePrimaryLoop: true } }
});
