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
            stats: { hp: 110, damage: 10, speed: 320, radius: 46, mass: 1.02, defense: 1 }
        },
        {
            id: FIGHTER_IDS.GRENADE,
            name: "Grenade Ball",
            title: "Blast Arc",
            description:
                "상대 방향 120° 범위에서 2~4개의 수류탄을 순차 발사합니다. 첫발 0.6초~마지막 2.0초로 지연 폭발하며 벽에 최대 4회 튕깁니다.",
            color: "#ff7676",
            face: "grenade",
            ability: "grenade",
            stats: { hp: 108, damage: 11, speed: 290, radius: 49, mass: 1.18, defense: 2 }
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
            stats: { hp: 110, damage: 10, speed: 294, radius: 49, mass: 1.16, defense: 1 }
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
            stats: { hp: 118, damage: 10, speed: 268, radius: 52, mass: 1.34, defense: 2 }
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
        },
        {
            id: FIGHTER_IDS.VAMPIRE,
            name: "Vampire Ball",
            title: "Blood Leech",
            description:
                "모든 피해의 일부를 HP로 흡수합니다. HP가 낮을수록 흡혈률이 증가합니다. 쿨타임마다 박쥐 떼를 발사합니다.",
            color: "#cc3355",
            face: "vampire",
            ability: "vampire",
            stats: { hp: 100, damage: 11, speed: 282, radius: 47, mass: 1.05, defense: 1 }
        },
        {
            id: FIGHTER_IDS.GUNNER,
            name: "Gunner Ball",
            title: "Roulette Shot",
            description:
                "쿨타임마다 1~6발의 총알을 360도 랜덤 방향으로 연사합니다. 발수가 많을수록 발당 데미지가 증가합니다.",
            color: "#8877cc",
            face: "gunner",
            ability: "gunner",
            stats: { hp: 100, damage: 11, speed: 278, radius: 48, mass: 1.1, defense: 1 }
        },
        {
            id: FIGHTER_IDS.PHANTOM,
            name: "Phantom Ball",
            title: "Shadow Strike",
            description: "충돌 시 사라졌다가 상대 뒤에서 나타나 돌진합니다. 쿨타임 동안 충돌은 일반 충돌로 처리됩니다.",
            color: "#55bbdd",
            face: "phantom",
            ability: "phantom",
            stats: { hp: 110, damage: 10, speed: 305, radius: 47, mass: 1.0, defense: 1 }
        },
        {
            id: FIGHTER_IDS.HERO,
            name: "Hero Ball",
            title: "Hero Orb",
            description:
                "쿨타임마다 랜덤 스탯 오브를 던집니다. 본인이 먹으면 해당 스탯이 영구 증가합니다. 상대가 먹으면 아무 효과 없이 사라집니다.",
            color: "#ffcc00",
            face: "hero",
            ability: "hero",
            stats: { hp: 108, damage: 10, speed: 286, radius: 49, mass: 1.2, defense: 1 }
        }
    ];
}
