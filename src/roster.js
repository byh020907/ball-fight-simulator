import { FIGHTER_IDS } from "./core.js";

export const BASE_SPEED_MULTIPLIER = 1.5;

function getFighterBaseSpeed(speed) {
    return speed * BASE_SPEED_MULTIPLIER;
}

export function createRoster() {
    return [
        {
            id: FIGHTER_IDS.ARCHER,
            name: "Archer Ball",
            title: "Piercing Arrow",
            description:
                "이동을 예측해 화살을 발사합니다. 두 번 연속 빗나가면 예측 화살을 세 발 연속 발사합니다. 적이 접근하면 옆으로 자동 회피합니다.",
            color: "#f7b34d",
            face: "archer",
            ability: "archer",
            stats: { hp: 112, damage: 10, speed: getFighterBaseSpeed(270), radius: 50, mass: 1.2, defense: 1 }
        },
        {
            id: FIGHTER_IDS.ORBIT,
            name: "Orbit Ball",
            title: "Visible Halo",
            description:
                "위성 5개가 가까운 적을 긁고, 완충되면 일제 발사됩니다. 성장하면 첫 적중점 협공·적중 폭발·본체 캐치로 진화합니다.",
            color: "#6fe3ff",
            face: "orbit",
            ability: "orbit",
            stats: { hp: 102, damage: 10, speed: getFighterBaseSpeed(308), radius: 48, mass: 1.1, defense: 1 }
        },
        {
            id: FIGHTER_IDS.TRICKSTER,
            name: "Trickster Ball",
            title: "Seed Gamble",
            description: "분신 씨앗 3개를 퍼뜨려 상대를 압박합니다. 씨앗을 집은 캐릭터는 즉시 대시를 발동합니다.",
            color: "#d99cff",
            face: "trickster",
            ability: "trickster",
            stats: { hp: 110, damage: 10, speed: getFighterBaseSpeed(320), radius: 46, mass: 1.02, defense: 1 }
        },
        {
            id: FIGHTER_IDS.GRENADE,
            name: "Grenade Ball",
            title: "Blast Arc",
            description:
                "360도 무작위로 3~5개의 수류탄을 순차 발사합니다. 탄속은 현재 기본 속도의 1.1배이며, 첫발은 쿨다운의 20%~마지막 쿨다운 시간으로 지연 폭발하고 벽에 최대 4회 튕깁니다.",
            color: "#ff7676",
            face: "grenade",
            ability: "grenade",
            stats: { hp: 108, damage: 11, speed: getFighterBaseSpeed(290), radius: 49, mass: 1.18, defense: 2 }
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
            stats: { hp: 110, damage: 10, speed: getFighterBaseSpeed(294), radius: 49, mass: 1.16, defense: 1 }
        },
        {
            id: FIGHTER_IDS.RAGE,
            name: "Rage Ball",
            title: "Visible Rage",
            description: "충돌 없이 오래 있을수록 속도와 공격력이 최대 5배까지 상승합니다. 충돌 시 초기화됩니다.",
            color: "#ffae6e",
            face: "rage",
            ability: "rage",
            stats: { hp: 124, damage: 10, speed: getFighterBaseSpeed(238), radius: 51, mass: 1.28, defense: 2 }
        },
        {
            id: FIGHTER_IDS.SPIN,
            name: "Spin Ball",
            title: "Gyro Drive",
            description:
                "충돌 없이 회전력을 충전해 접점 피해를 키웁니다. 성장하면 만충 표면 절단·가속 절삭·관통 유체장으로 진화합니다.",
            color: "#d95f2f",
            face: "spin",
            ability: "spin",
            physicsMaterial: "spinGrip",
            stats: { hp: 116, damage: 10, speed: getFighterBaseSpeed(276), radius: 50, mass: 1.22, defense: 1 }
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
            stats: { hp: 118, damage: 10, speed: getFighterBaseSpeed(268), radius: 52, mass: 1.34, defense: 2 }
        },
        {
            id: FIGHTER_IDS.BAT_BALL,
            name: "Bat Ball",
            title: "Bat Swing",
            description: "120도의 시야 범위가 좌우로 스캔하며, 적이 범위 안에 들어오면 방망이를 휘둘러 넉백을 줍니다.",
            color: "#66ccff",
            face: "bat_ball",
            ability: "bat_ball",
            stats: { hp: 106, damage: 10, speed: getFighterBaseSpeed(280), radius: 48, mass: 1.14, defense: 1 }
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
            stats: { hp: 100, damage: 11, speed: getFighterBaseSpeed(282), radius: 47, mass: 1.05, defense: 1 }
        },
        {
            id: FIGHTER_IDS.GUNNER,
            name: "Gunner Ball",
            title: "Roulette Shot",
            description:
                "쿨타임마다 6~12발의 총알을 360도 랜덤 방향으로 연사합니다. 발수가 많을수록 발당 데미지가 증가하고, 회수한 탄은 다음 연계를 만듭니다.",
            color: "#8877cc",
            face: "gunner",
            ability: "gunner",
            stats: { hp: 100, damage: 11, speed: getFighterBaseSpeed(278), radius: 48, mass: 1.1, defense: 1 }
        },
        {
            id: FIGHTER_IDS.PHANTOM,
            name: "Phantom Ball",
            title: "Shadow Strike",
            description:
                "충돌 시 사라졌다가 상대 뒤에서 나타나 총공격력에 비례한 추가 피해와 함께 돌진합니다. 쿨타임 동안 충돌은 일반 충돌로 처리됩니다.",
            color: "#55bbdd",
            face: "phantom",
            ability: "phantom",
            stats: { hp: 110, damage: 10, speed: getFighterBaseSpeed(305), radius: 47, mass: 1.0, defense: 1 }
        },
        {
            id: FIGHTER_IDS.HERO,
            name: "Hero Ball",
            title: "Hero Orb",
            description:
                "성장 스택을 충전하고 적과 충돌할 때 같은 수의 성장 코어를 방출합니다. 직접 회수하면 무작위 스탯이 증가합니다.",
            color: "#ffcc00",
            face: "hero",
            ability: "hero",
            stats: { hp: 108, damage: 10, speed: getFighterBaseSpeed(286), radius: 49, mass: 1.2, defense: 1 }
        }
    ];
}
