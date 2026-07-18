import { ArcherAbility } from "../../abilities/archerAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "ARCHER",
    id: "archer",
    name: "Archer Ball",
    title: "Piercing Arrow",
    description:
        "이동을 예측해 화살을 발사합니다. 두 번 연속 빗나가면 예측 화살을 세 발 연속 발사합니다. 적이 접근하면 옆으로 자동 회피합니다.",
    color: "#f7b34d",
    abilityDisplayName: "Archer",
    abilityClass: ArcherAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "예측 화살 + 속도 15%"
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
            gameText: "조준 -20% · 70% 단발 30% 2발"
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
            gameText: "50% 확률로 크리티컬 ×2"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [
            {},
            {
                arrowSpeedMultiplier: 1.15
            },
            {
                windupMultiplier: 0.8
            },
            {}
        ]
    },
    stats: { hp: 168, damage: 15, speed: 270, radius: 50, mass: 1.2, defense: 1.5 },
    mastery: {
        id: "archer_precision_training",
        name: "정밀 훈련",
        kind: "stat_modifier",
        description: "공격력이 {value} 증가합니다.",
        tierKey: "damage",
        target: "statModifiers",
        modifierKey: "damage",
        format: "percent"
    }
});
