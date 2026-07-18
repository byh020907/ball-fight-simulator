import { EaterAbility } from "../../abilities/eaterAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "EATER",
    id: "eater",
    name: "Eater Ball",
    title: "Feast Bounce",
    description:
        "피스트 모드로 상대를 추적해 삼킨 뒤, 벽으로 내뱉어 충돌 피해를 줍니다. 뱉은 후 쿨타임이 초기화됩니다.",
    color: "#a6ff4d",
    abilityDisplayName: "Eater",
    abilityClass: EaterAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "삼킨 중 소화 6틱 ×0.12 · 실제 피해만큼 회복"
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
            gameText: "뱉기 ×1.0 피해 · 속도 ×3 · 반동"
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
            gameText: "첫 벽 충돌 파열 ×1.5+주변 ×0.75"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [{}, {}, {}, {}]
    },
    stats: { hp: 177, damage: 15, speed: 268, radius: 52, mass: 1.34, defense: 3 },
    mastery: {
        id: "eater_robust_digestion",
        name: "강한 소화력",
        kind: "stat_modifier",
        description: "최대 체력이 {value} 증가합니다.",
        tierKey: "hp",
        target: "statModifiers",
        modifierKey: "hp",
        format: "percent"
    }
});
