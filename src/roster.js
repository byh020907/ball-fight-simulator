import { FIGHTER_IDS } from "./core.js";

export function createRoster() {
    return [
        {
            id: FIGHTER_IDS.ARCHER,
            name: "Archer Ball",
            title: "Piercing Arrow",
            description: "잠시 자세를 고정해 피해를 버티고, 충돌 순간 강한 앵커 충격파를 되돌려줍니다.",
            color: "#f7b34d",
            face: "archer",
            ability: "archer",
            stats: { hp: 112, damage: 10, speed: 270, radius: 50, mass: 1.2 }
        },
        {
            id: FIGHTER_IDS.ORBIT,
            name: "Orbit Ball",
            title: "Visible Halo",
            description: "몸 주위를 도는 위성이 가까운 적을 계속 긁어내며 체력을 깎습니다.",
            color: "#6fe3ff",
            face: "orbit",
            ability: "orbit",
            stats: { hp: 102, damage: 10, speed: 308, radius: 48, mass: 1.1 }
        },
        {
            id: FIGHTER_IDS.TRICKSTER,
            name: "Trickster Ball",
            title: "Seed Gamble",
            description: "분신을 전방으로 쏘아 상대를 압박하는 속임수형 전투 공입니다.",
            color: "#d99cff",
            face: "trickster",
            ability: "trickster",
            stats: { hp: 98, damage: 10, speed: 320, radius: 46, mass: 1.02 }
        },
        {
            id: FIGHTER_IDS.GRENADE,
            name: "Grenade Ball",
            title: "Blast Arc",
            description: "상대 예상 위치로 수류탄을 던져 지연 폭발을 노리는 폭격형 공입니다.",
            color: "#ff7676",
            face: "grenade",
            ability: "grenade",
            stats: { hp: 108, damage: 11, speed: 278, radius: 49, mass: 1.18 }
        },
        {
            id: FIGHTER_IDS.DASH,
            name: "Dash Ball",
            title: "Cooldown Dash",
            description: "벽에 닿기 전까지 직선 대시를 유지하고, 적중하면 남은 쿨타임이 절반으로 줄어듭니다.",
            color: "#8ee8d7",
            face: "dash",
            ability: "dash",
            stats: { hp: 110, damage: 9, speed: 294, radius: 49, mass: 1.16 }
        },
        {
            id: FIGHTER_IDS.RAGE,
            name: "Rage Ball",
            title: "Visible Rage",
            description: "체력이 낮아질수록 속도와 충돌 화력이 폭발적으로 올라갑니다.",
            color: "#ffae6e",
            face: "rage",
            ability: "rage",
            stats: { hp: 124, damage: 10, speed: 238, radius: 51, mass: 1.28 }
        },
        {
            id: FIGHTER_IDS.EATER,
            name: "Eater Ball",
            title: "Feast Bounce",
            description: "Enters feast mode, swallows on impact, then spits the enemy into wall-damaging speed.",
            color: "#a6ff4d",
            face: "eater",
            ability: "eater",
            stats: { hp: 118, damage: 10, speed: 268, radius: 52, mass: 1.34 }
        }
    ];
}
