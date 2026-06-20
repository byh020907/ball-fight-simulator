export function createRoster() {
  return [
          {
            id: "archer",
            name: "Archer Ball",
            title: "Piercing Arrow",
            description: "잠시 자세를 고정해 피해를 버티고, 충돌 순간 강한 앵커 충격파를 되돌려줍니다.",
            color: "#f7b34d",
            face: "archer",
            ability: "archer",
            stats: { hp: 112, damage: 1.02, speed: 270, radius: 50, mass: 1.2 }
          },
          {
            id: "orbit",
            name: "Orbit Ball",
            title: "Visible Halo",
            description: "몸 주위를 도는 위성이 가까운 적을 계속 긁어내며 체력을 깎습니다.",
            color: "#6fe3ff",
            face: "orbit",
            ability: "orbit",
            stats: { hp: 102, damage: 1, speed: 308, radius: 48, mass: 1.1 }
          },
          {
            id: "clone",
            name: "Clone Ball",
            title: "Seed Gamble",
            description: "분신을 전방으로 쏘아 상대를 압박하는 속임수형 전투 공입니다.",
            color: "#d99cff",
            face: "clone",
            ability: "clone",
            stats: { hp: 98, damage: 1.02, speed: 320, radius: 46, mass: 1.02 }
          },
          {
            id: "grenade",
            name: "Grenade Ball",
            title: "Blast Arc",
            description: "상대 예상 위치로 수류탄을 던져 지연 폭발을 노리는 폭격형 공입니다.",
            color: "#ff7676",
            face: "grenade",
            ability: "grenade",
            stats: { hp: 108, damage: 1.08, speed: 278, radius: 49, mass: 1.18 }
          },
          {
            id: "frosty",
            name: "Frosty Sword",
            title: "Freeze Clash",
            description: "순간 대시로 적을 베고, 짧게 둔화시켜 다음 충돌을 유리하게 만듭니다.",
            color: "#8ee8d7",
            face: "frosty",
            ability: "frostySword",
            stats: { hp: 110, damage: 1.12, speed: 294, radius: 49, mass: 1.16 }
          },
          {
            id: "berserker",
            name: "Berserker",
            title: "Visible Rage",
            description: "체력이 낮아질수록 속도와 충돌 화력이 폭발적으로 올라갑니다.",
            color: "#ffae6e",
            face: "berserker",
            ability: "berserker",
            stats: { hp: 124, damage: 1.02, speed: 238, radius: 51, mass: 1.28 }
          },
          {
            id: "eater",
            name: "Eater Ball",
            title: "Feast Bounce",
            description: "Enters feast mode, swallows on impact, then spits the enemy into wall-damaging speed.",
            color: "#a6ff4d",
            face: "eater",
            ability: "eater",
            stats: { hp: 118, damage: 0.98, speed: 268, radius: 52, mass: 1.34 }
          }
        ];
}
