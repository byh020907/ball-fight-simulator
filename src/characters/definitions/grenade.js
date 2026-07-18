import { GrenadeAbility } from "../../abilities/grenadeAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "GRENADE",
    id: "grenade",
    name: "Grenade Ball",
    title: "Blast Arc",
    description:
        "360도 무작위로 3~5개의 수류탄을 순차 발사합니다. 탄속은 현재 기본 속도의 1.1배이며, 첫발은 쿨다운의 20%~마지막 쿨다운 시간으로 지연 폭발하고 벽에 최대 4회 튕깁니다.",
    color: "#ff7676",
    abilityDisplayName: "Grenade",
    abilityClass: GrenadeAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "실제 접촉 수류탄 점착 · 대상당 1개"
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
            gameText: "폭발 피해 대상 화상 · 0.5초 ×0.50"
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
            gameText: "점착 표식 유도 · 0.5초 뒤 2rad/s"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [
            {},
            {
                stickyGrenade: true
            },
            {
                burningExplosion: true
            },
            {
                stickyHoming: true
            }
        ]
    },
    stats: { hp: 162, damage: 16.5, speed: 290, radius: 49, mass: 1.18, defense: 3 },
    mastery: {
        id: "grenade_heavy_impact",
        name: "중량 충격",
        kind: "combat_modifier",
        description: "충돌로 가하는 피해가 {value} 증가합니다.",
        tierKey: "outgoingCollisionDamageBonus",
        target: "combatModifiers",
        modifierKey: "outgoingCollisionDamageBonus",
        format: "percent"
    }
});
