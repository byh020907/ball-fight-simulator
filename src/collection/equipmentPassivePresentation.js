const PASSIVES = Object.freeze({
    ability_crit: ["별빛 폭발", "능력 뒤 다음 충돌에 치명 폭발을 일으킵니다."],
    pursuit_flurry: ["쌍익 연타", "연속 충돌을 좌우 참격으로 보상합니다."],
    mass_execution: ["종언 처형", "저체력 적 크리티컬 충돌을 강화합니다."],
    vital_heat: ["홍련 열기", "저장한 열기를 근접한 적에게 순차 방출합니다."],
    defense_conversion: ["철혈 전환", "장비 방어 일부를 공격력으로 바꿉니다."],
    mass_shockwave: ["낙성 파문", "크리티컬 충돌에 질량 충격파를 더합니다."],
    wall_ricochet: ["초승달 도탄", "벽 반사 뒤 다음 충돌에 참격합니다."],
    wall_heat: ["성채 열기", "벽 반사 열기를 적 접근 시 파동으로 씁니다."],
    speed_angular: ["천공 나선", "장비가 높인 속도를 충돌 추가타로 바꿉니다."],
    ability_echo: ["쌍성 메아리", "능력 사용 뒤 다음 충돌에 메아리를 남깁니다."],
    vortex_charge: ["폭풍 충전", "이동 거리를 모아 다음 충돌에 회전 공격합니다."],
    vital_overwhelm: ["적룡 압도", "높은 장비 HP를 충돌 추가 피해로 바꿉니다."]
});

export function getEquipmentPassivePresentation(passiveId) {
    const [name, description] = PASSIVES[passiveId] ?? [];
    return name ? { name, description } : null;
}
