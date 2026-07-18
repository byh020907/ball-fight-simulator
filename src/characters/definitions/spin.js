import { SpinAbility } from "../../abilities/spinAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "SPIN",
    id: "spin",
    name: "Spin Ball",
    title: "Gyro Drive",
    description:
        "충돌 없이 회전력을 충전해 접점 피해를 키웁니다. 성장하면 만충 표면 절단·가속 절삭·관통 유체장으로 진화합니다.",
    color: "#d95f2f",
    abilityDisplayName: "Spin",
    abilityClass: SpinAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "만충 Crash 유지 · 표면 절단 0.60초 · 12틱 ×0.15"
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
            gameText: "가속 절삭 ×0.10→×0.30 · 합계 ×2.40"
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
            gameText: "340px 관통 유체장 · 절단 방어 무시"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [
            {},
            {
                surfaceCut: true
            },
            {
                acceleratingCut: true
            },
            {
                piercingVortex: true
            }
        ]
    },
    physicsMaterial: "spinGrip",
    stats: { hp: 174, damage: 15, speed: 276, radius: 50, mass: 1.22, defense: 1.5 },
    mastery: {
        id: "spin_gyroscopic_transfer",
        name: "자이로 전달",
        kind: "physics_modifier",
        description: "충돌 각충격이 {value} 증가합니다.",
        tierKey: "angularImpulse",
        target: "physicsModifiers",
        modifierKey: "collisionAngularImpulse",
        format: "percent"
    }
});
