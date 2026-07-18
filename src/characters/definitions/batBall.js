import { BatBallAbility } from "../../abilities/batBallAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "BAT_BALL",
    id: "bat_ball",
    name: "Bat Ball",
    title: "Bat Swing",
    description: "120도의 시야 범위가 좌우로 스캔하며, 적이 범위 안에 들어오면 방망이를 휘둘러 넉백을 줍니다.",
    color: "#66ccff",
    abilityDisplayName: "Bat Ball",
    abilityClass: BatBallAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "회전 타구 · 기본 Wall Slam 각충격 ×1.5 추가"
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
            gameText: "첫 Wall Slam 비거리 HOME RUN ×1.00~×2.00"
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
            gameText: "유효 Wall Slam 스킬 초기화 · 재발동 0.50초"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [
            {},
            {
                rotatingHit: true
            },
            {
                homeRun: true
            },
            {
                wallReset: true
            }
        ]
    },
    stats: { hp: 159, damage: 15, speed: 280, radius: 48, mass: 1.14, defense: 1.5 },
    mastery: {
        id: "bat_ball_frugal_swing",
        name: "아껴 휘두르기",
        kind: "action_modifier",
        description: "클릭 액션 HP 비용이 {value} 감소합니다.",
        tierKey: "actionHpCostReduction",
        target: "actionModifiers",
        modifierKey: "hpCostPercentReduction",
        format: "percentPoint2"
    }
});
