import { GunnerAbility } from "../../abilities/gunnerAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "GUNNER",
    id: "gunner",
    name: "Gunner Ball",
    title: "Roulette Shot",
    description:
        "쿨타임마다 6~12발의 총알을 360도 랜덤 방향으로 연사합니다. 발수가 많을수록 발당 데미지가 증가하고, 회수한 탄은 다음 연계를 만듭니다.",
    color: "#8877cc",
    abilityDisplayName: "Gunner",
    abilityClass: GunnerAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "모든 6~12발 연사 마무리 탄 ×2"
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
            gameText: "일반 탄 회수 즉시 재사격 · 첫 반사 재조준"
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
            gameText: "일반 탄 20회 회수 · 8초 자동 포탑"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [
            {},
            {
                everyBurstFinisher: true
            },
            {
                refireOnCollect: true,
                ricochetReload: true
            },
            {
                collectionTurret: true
            }
        ]
    },
    stats: { hp: 150, damage: 16.5, speed: 278, radius: 48, mass: 1.1, defense: 10 },
    mastery: {
        id: "gunner_mass_loading",
        name: "중량 장전",
        kind: "stat_modifier",
        description: "질량이 {value} 증가합니다.",
        tierKey: "mass",
        target: "statModifiers",
        modifierKey: "mass",
        format: "percent"
    }
});
