import { FIGHTER_IDS } from "./core.js";

export function createRoster() {
    return [
        {
            id: FIGHTER_IDS.ARCHER,
            name: "Archer Ball",
            title: "Piercing Arrow",
            description:
                "잠시 조준 후 화살을 발사합니다. 두 번 연속 빗나가면 세 발을 한 번에 쏩니다. 적이 접근하면 옆으로 자동 회피합니다.",
            color: "#f7b34d",
            face: "archer",
            ability: "archer",
            stats: { hp: 112, damage: 10, speed: 270, radius: 50, mass: 1.2, defense: 1 }
        },
        {
            id: FIGHTER_IDS.ORBIT,
            name: "Orbit Ball",
            title: "Visible Halo",
            description:
                "몸 주위를 도는 위성 3개가 가까운 적을 계속 긁어내며 피해를 줍니다. 위성은 하나씩 재충전됩니다.",
            color: "#6fe3ff",
            face: "orbit",
            ability: "orbit",
            stats: { hp: 102, damage: 10, speed: 308, radius: 48, mass: 1.1, defense: 1 }
        },
        {
            id: FIGHTER_IDS.TRICKSTER,
            name: "Trickster Ball",
            title: "Seed Gamble",
            description: "분신 씨앗 3개를 퍼뜨려 상대를 압박합니다. 씨앗을 집은 캐릭터는 즉시 대시를 발동합니다.",
            color: "#d99cff",
            face: "trickster",
            ability: "trickster",
            stats: { hp: 98, damage: 10, speed: 320, radius: 46, mass: 1.02, defense: 1 }
        },
        {
            id: FIGHTER_IDS.GRENADE,
            name: "Grenade Ball",
            title: "Blast Arc",
            description: "상대 예상 위치로 수류탄을 던져 지연 폭발시킵니다. 빗나갈수록 퓨즈가 짧아져 더 빨리 터집니다.",
            color: "#ff7676",
            face: "grenade",
            ability: "grenade",
            stats: { hp: 108, damage: 11, speed: 278, radius: 49, mass: 1.18, defense: 2 }
        },
        {
            id: FIGHTER_IDS.DASH,
            name: "Dash Ball",
            title: "Cooldown Dash",
            description:
                "적을 추적하는 대시를 사용합니다. 적중 시 쿨타임이 50%씩 줄어듭니다(최대 2회). 벽에 부딪히면 초기화됩니다.",
            color: "#8ee8d7",
            face: "dash",
            ability: "dash",
            stats: { hp: 110, damage: 9, speed: 294, radius: 49, mass: 1.16, defense: 1 }
        },
        {
            id: FIGHTER_IDS.RAGE,
            name: "Rage Ball",
            title: "Visible Rage",
            description: "충돌 없이 오래 있을수록 속도와 공격력이 최대 5배까지 상승합니다. 충돌 시 초기화됩니다.",
            color: "#ffae6e",
            face: "rage",
            ability: "rage",
            stats: { hp: 124, damage: 10, speed: 238, radius: 51, mass: 1.28, defense: 2 }
        },
        {
            id: FIGHTER_IDS.EATER,
            name: "Eater Ball",
            title: "Feast Bounce",
            description:
                "피스트 모드로 상대를 추적해 삼킨 뒤, 벽으로 내뱉어 충돌 피해를 줍니다. 뱉은 후 쿨타임이 초기화됩니다.",
            color: "#a6ff4d",
            face: "eater",
            ability: "eater",
            stats: { hp: 118, damage: 10, speed: 268, radius: 52, mass: 1.34, defense: 4 }
        },
        {
            id: FIGHTER_IDS.BAT_BALL,
            name: "Bat Ball",
            title: "Bat Swing",
            description: "120도의 시야 범위가 좌우로 스캔하며, 적이 범위 안에 들어오면 방망이를 휘둘러 넉백을 줍니다.",
            color: "#66ccff",
            face: "bat_ball",
            ability: "bat_ball",
            stats: { hp: 106, damage: 10, speed: 280, radius: 48, mass: 1.14, defense: 1 }
        }
    ];
}
