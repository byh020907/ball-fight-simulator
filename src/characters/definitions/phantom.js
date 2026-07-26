import { PhantomAbility } from "../../abilities/phantomAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "PHANTOM",
    id: "phantom",
    name: "Phantom Ball",
    title: "그림자 돌진",
    description:
        "충돌 시 사라졌다가 상대 뒤에서 나타나 총공격력에 비례한 추가 피해와 함께 그림자 돌진합니다. 쿨타임 동안 충돌은 일반 충돌로 처리됩니다.",
    color: "#55bbdd",
    abilityDisplayName: "그림자 돌진",
    abilityClass: PhantomAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "쿨타임 중 자연 충돌 그림자 돌진 1회"
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
            gameText: "그림자 돌진으로 밀어 벽·지형 충돌 시 즉시 재돌진 1회"
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
            gameText: "후속 그림자 돌진 적중 시 종결 그림자 돌진 1회 추가"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        base: {
            speedMultiplier: 1.15,
            damageMultiplier: 1.1,
            defenseMultiplier: 1.5,
            impactMultiplier: 1.15,
            bonusDamageMultiplier: 1.5
        },
        tiers: [
            {},
            {
                shadowPursuitOnNaturalCollision: true
            },
            {
                shadowReboundOnStaticCollision: true
            },
            {
                shadowFinish: true
            }
        ]
    },
    stats: { hp: 165, damage: 15, speed: 305, radius: 47, mass: 1, defense: 10 },
    mastery: {
        id: "phantom_shadow_weave",
        name: "그림자 직조",
        kind: "combat_modifier",
        description: "받는 충돌 피해가 {value} 감소합니다.",
        tierKey: "incomingCollisionDamageReduce",
        target: "combatModifiers",
        modifierKey: "incomingCollisionDamageReduce",
        format: "percent"
    }
});
