import { VampireAbility } from "../../abilities/vampireAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "VAMPIRE",
    id: "vampire",
    name: "Vampire Ball",
    title: "Blood Leech",
    description:
        "모든 피해의 일부를 HP로 흡수합니다. HP가 낮을수록 흡혈률이 증가합니다. 쿨타임마다 박쥐 떼를 발사합니다.",
    color: "#cc3355",
    abilityDisplayName: "Vampire",
    abilityClass: VampireAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "반복 물기 ×0.05 · 반동 재돌입"
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
            gameText: "수명 종료 폭발 65px · ×0.05"
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
            gameText: "피의 견인 180px/s · 혈액 파열 ×0.15"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [
            {},
            {
                repeatBite: true
            },
            {
                lifeBurst: true
            },
            {
                bloodPull: true
            }
        ]
    },
    stats: { hp: 150, damage: 16.5, speed: 282, radius: 47, mass: 1.05, defense: 1.5 },
    mastery: {
        id: "vampire_blood_thirst",
        name: "갈증",
        kind: "combat_passive",
        description: "4초마다 다음 충돌에서 준 피해의 {value}를 회복합니다. 잃은 HP에 따라 최대 2배가 됩니다.",
        tierKey: "vampireHpSteal",
        runtime: "vampire",
        format: "percent"
    }
});
