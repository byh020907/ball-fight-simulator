import { RageAbility } from "../../abilities/rageAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "RAGE",
    id: "rage",
    name: "Rage Ball",
    title: "Visible Rage",
    description: "충돌 없이 오래 있을수록 속도와 공격력이 최대 5배까지 상승합니다. 충돌 시 초기화됩니다.",
    color: "#ffae6e",
    abilityDisplayName: "Rage",
    abilityClass: RageAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "35%+ 점화 (5틱 ×0.10)"
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
            gameText: "70%+ 폭발 ×1.50 120px"
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
            gameText: "100% 여진 ×2.25 180px"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [{}, {}, {}, {}]
    },
    stats: { hp: 186, damage: 15, speed: 238, radius: 51, mass: 1.28, defense: 3 },
    mastery: {
        id: "rage_bloodlust",
        name: "전투 욕구",
        kind: "combat_passive",
        description: "12초마다 다음 충돌 피해가 {value} 증가합니다.",
        tierKey: "rageCollisionDamage",
        runtime: "rage",
        format: "percent"
    }
});
