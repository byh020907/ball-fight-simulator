import { DashAbility } from "../../abilities/dashAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "DASH",
    id: "dash",
    name: "Dash Ball",
    title: "Cooldown Dash",
    description:
        "적을 추적하는 대시를 사용합니다. 적중 시 쿨타임이 50%씩 줄어듭니다(최대 2회). 벽에 부딪히면 초기화됩니다.",
    color: "#8ee8d7",
    abilityDisplayName: "Dash",
    abilityClass: DashAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "대시 적중 레이저 · 0.35초 조준 ×0.60"
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
            gameText: "레이저 벽 1회 반사 · 구간별 ×0.60"
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
            gameText: "첫 레이저 적중 즉시 점화 · 1초 10틱 ×0.10"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [
            {},
            {
                laserStrike: true
            },
            {
                laserWallBounces: 1
            },
            {
                laserIgnition: true
            }
        ]
    },
    stats: { hp: 165, damage: 15, speed: 294, radius: 49, mass: 1.16, defense: 1.5 },
    mastery: {
        id: "dash_propulsion",
        name: "추진력",
        kind: "stat_modifier",
        description: "이동 속도가 {value} 증가합니다.",
        tierKey: "speed",
        target: "statModifiers",
        modifierKey: "speed",
        format: "percent"
    }
});
