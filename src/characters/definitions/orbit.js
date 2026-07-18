import { OrbitAbility } from "../../abilities/orbitAbility.js";
import { createCharacterDefinition } from "./definitionFactory.js";

export default createCharacterDefinition({
    key: "ORBIT",
    id: "orbit",
    name: "Orbit Ball",
    title: "Visible Halo",
    description:
        "위성 5개가 가까운 적을 긁고, 완충되면 일제 발사됩니다. 성장하면 첫 적중점 협공·적중 폭발·본체 캐치로 진화합니다.",
    color: "#6fe3ff",
    abilityDisplayName: "Orbit",
    abilityClass: OrbitAbility,
    levelRewards: [
        {
            level: 2
        },
        {
            level: 3,
            abilityTier: 1,
            gameText: "첫 적중점 동기화 협공 · 직접 ×0.80/×1.00"
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
            gameText: "수명 2.4초 · 협공 폭발 70px ×0.25"
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
            gameText: "미적중 탄 본체 캐치 · 원래 위성 회수"
        },
        {
            level: 10
        }
    ],
    abilityUpgrade: {
        tiers: [
            {},
            {
                synchronizedVolley: true
            },
            {
                explosiveVolley: true
            },
            {
                bodyCatch: true
            }
        ]
    },
    stats: { hp: 153, damage: 15, speed: 308, radius: 48, mass: 1.1, defense: 1.5 },
    mastery: {
        id: "orbit_reflective_orbit",
        name: "반사 궤도",
        kind: "physics_modifier",
        description: "벽 충돌 시 반사 속도가 {value} 증가합니다.",
        tierKey: "wallBounce",
        target: "physicsModifiers",
        modifierKey: "wallBounce",
        format: "percent"
    }
});
