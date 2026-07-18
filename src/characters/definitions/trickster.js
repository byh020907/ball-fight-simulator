import { TricksterAbility } from "../../abilities/tricksterAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "TRICKSTER",
    id: "trickster",
    name: "Trickster Ball",
    title: "Seed Gamble",
    description: "분신 씨앗 3개를 퍼뜨려 상대를 압박합니다. 씨앗을 집은 캐릭터는 즉시 대시를 발동합니다.",
    color: "#d99cff",
    abilityDisplayName: "Trickster",
    abilityClass: TricksterAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "덩굴 감속 0.5초 · 5틱 ×0.10"
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
            gameText: "씨앗 표식 1.8초 · 돌진 폭발 ×1.20"
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
            gameText: "폭발 접점 후속 씨앗 · 활성 유예 0.5초"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [
            {},
            {
                vineSnare: true
            },
            {
                seedMarkBurst: true
            },
            {
                followupSeed: true
            }
        ]
    },
    stats: { hp: 165, damage: 15, speed: 320, radius: 46, mass: 1.02, defense: 1.5 },
    mastery: {
        id: "trickster_versatility",
        name: "다재다능",
        kind: "physics_modifier",
        description: "기본 속도 복원률이 {value} 증가합니다.",
        tierKey: "velocityRecoveryBonus",
        target: "physicsModifiers",
        modifierKey: "velocityRecoveryBonus",
        format: "percent"
    }
});
