/**
 * 사냥터 장비 드롭 + 스탯 시뮬레이터
 *
 * 사용법:
 *   node scripts/huntingSim.mjs
 *
 * 상단 OVERRIDES 블록에서 equipmentData.js 값을 변경한 뒤
 * 재실행하면 수치 변화를 확인할 수 있습니다.
 */

import { createDefaultPlayerProfile } from "../src/playerProfile.js";
import {
    createEquipmentInstance,
    getEquippedStatBonuses,
    EQUIPMENT_SLOTS,
    EQUIPMENT_RARITIES,
    EQUIPMENT_STAT_RANGES,
    SPECIAL_OPTION_CHANCES
} from "../src/hunting/equipmentConfig.js";
import { openHuntingChest } from "../src/hunting/chestRewards.js";
import { createHuntingChest } from "../src/hunting/huntingRewards.js";

// ── 오버라이드 ─────────────────────────────────────────────────
// equipmentData.js 값을 여기서 변경 후 재실행
const OVERRIDES = {
    // EQUIPMENT.STAT_RANGES.RARE.min = 6,
    // EQUIPMENT.SPECIALS.CHANCES.LEGENDARY = 1.0,
};

// ── 설정 ───────────────────────────────────────────────────────
const CHEST_COUNT = 2000;
const EQUIP_ITERATIONS = 500;

// ── 시뮬레이션 ─────────────────────────────────────────────────

function makeProfile() {
    const p = createDefaultPlayerProfile();
    p.hunting.shards = 999999;
    return p;
}

function runChestSim(count) {
    const results = [];
    const rarityCounts = {};
    const slotCounts = {};
    const statBuckets = {};
    const specialCounts = {};
    let totalShards = 0;

    for (let i = 0; i < count; i++) {
        const rarity = EQUIPMENT_RARITIES[Math.floor(Math.random() * EQUIPMENT_RARITIES.length)];
        const chest = createHuntingChest({ id: `sim-${i}`, rarity, acquiredAt: Date.now() });
        const profile = makeProfile();
        profile.hunting.chests = [chest];

        const result = openHuntingChest(profile, chest.id, { rng: Math.random });
        if (!result.opened) continue;

        if (result.applied.shards > 0) {
            totalShards += result.applied.shards;
        }

        if (result.applied.equipment) {
            const eq = result.applied.equipment;

            rarityCounts[eq.rarity] = (rarityCounts[eq.rarity] ?? 0) + 1;
            slotCounts[eq.slot] = (slotCounts[eq.slot] ?? 0) + 1;

            if (!statBuckets[eq.rarity]) statBuckets[eq.rarity] = [];
            for (const s of eq.stats) {
                statBuckets[eq.rarity].push(s.value);
            }

            if (eq.specialOptions) {
                for (const opt of eq.specialOptions) {
                    specialCounts[opt.type] = (specialCounts[opt.type] ?? 0) + 1;
                }
            }

            results.push(eq);
        }
    }

    return { results, rarityCounts, slotCounts, statBuckets, specialCounts, totalShards };
}

function runEquipSim(count) {
    // 여러 장비를 모아서 장착했을 때 총 stat 보너스 분포
    const totalBonusDist = { hp: [], damage: [], defense: [], speed: [] };

    for (let iter = 0; iter < count; iter++) {
        const profile = makeProfile();
        const eq = profile.equipment;

        // 4슬롯을 채울 때까지 장비 생성
        const slotsToFill = ["weapon", "armor", "accessory", "accessory"];
        for (const slot of slotsToFill) {
            const rarity = EQUIPMENT_RARITIES[Math.floor(Math.random() * EQUIPMENT_RARITIES.length)];
            const item = createEquipmentInstance({ rarity, slot, rng: Math.random });
            eq.inventory.push(item);

            if (slot === "accessory") {
                if (!eq.equipped.accessory1) eq.equipped.accessory1 = item.instanceId;
                else if (!eq.equipped.accessory2) eq.equipped.accessory2 = item.instanceId;
            } else {
                eq.equipped[slot] = item.instanceId;
            }
        }

        const bonuses = getEquippedStatBonuses(profile);
        for (const [key, value] of Object.entries(bonuses)) {
            if (totalBonusDist[key]) totalBonusDist[key].push(value);
        }
    }

    return totalBonusDist;
}

function computeStats(arr) {
    if (arr.length === 0) return { min: 0, max: 0, avg: 0, median: 0, p10: 0, p90: 0, n: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
        min: sorted[0],
        max: sorted[n - 1],
        avg: Math.round((sum / n) * 100) / 100,
        median: sorted[Math.floor(n / 2)],
        p10: sorted[Math.floor(n * 0.1)],
        p90: sorted[Math.floor(n * 0.9)],
        n
    };
}

// ── 출력 ───────────────────────────────────────────────────────

function pad(s, len = 14) {
    return String(s).padStart(len);
}

function printSeparator() {
    console.log("─".repeat(70));
}

function printHeader(title) {
    printSeparator();
    console.log(`  ${title}`);
    printSeparator();
}

// ── 메인 ───────────────────────────────────────────────────────

console.log("");
console.log("  사냥터 장비 시뮬레이션");
console.log(`  상자 개봉: ${CHEST_COUNT}회 | 장착 시뮬레이션: ${EQUIP_ITERATIONS}회`);
console.log(`  오버라이드: ${Object.keys(OVERRIDES).length > 0 ? JSON.stringify(OVERRIDES) : "없음"}`);
console.log("");

// ── 1. 상자 개봉 시뮬레이션 ─────────────────────────────────────

printHeader("1. 상자 개봉 — 보상 분포");

const chestSim = runChestSim(CHEST_COUNT);
const total = chestSim.results.length;
const shardChests = CHEST_COUNT - total;

console.log(`  전체 시도: ${CHEST_COUNT}`);
console.log(`  장비 획득: ${total} (${Math.round((total / CHEST_COUNT) * 100)}%)`);
console.log(`  파편 획득: ${shardChests} (${Math.round((shardChests / CHEST_COUNT) * 100)}%)`);
console.log(
    `  총 파편:   ${chestSim.totalShards} (평균 ${Math.round(chestSim.totalShards / Math.max(1, shardChests))}/회)`
);
console.log("");

// 등급별 분포
console.log(`  ${pad("등급")} ${pad("개수")} ${pad("비율")} ${pad("평균스탯")} ${pad("최소")} ${pad("최대")}`);
printSeparator();
for (const r of EQUIPMENT_RARITIES) {
    const count = chestSim.rarityCounts[r] ?? 0;
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0%";
    const stats = statStats(chestSim.statBuckets[r] ?? []);
    console.log(`  ${pad(r)} ${pad(count)} ${pad(pct)} ${pad(stats.avg)} ${pad(stats.min)} ${pad(stats.max)}`);
}
console.log("");

// 슬롯별 분포
printHeader("2. 슬롯 분포");
for (const s of EQUIPMENT_SLOTS) {
    const count = chestSim.slotCounts[s.id] ?? 0;
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0%";
    console.log(`  ${s.label} (${s.id}): ${count} (${pct})`);
}

// 특수 옵션
printHeader("3. 특수 옵션");
if (Object.keys(chestSim.specialCounts).length > 0) {
    for (const [type, count] of Object.entries(chestSim.specialCounts)) {
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0%";
        console.log(`  ${type}: ${count} (${pct})`);
    }
} else {
    console.log("  (획득 없음)");
}

// ── 2. 등급별 스탯 범위 ────────────────────────────────────────

printHeader("4. 등급별 스탯 분포 (설정값 vs 실제)");
console.log(
    `  ${pad("등급")} ${pad("설정(min)")} ${pad("설정(max)")} ${pad("실제(avg)")} ${pad("실제(min)")} ${pad("실제(max)")}`
);
printSeparator();
for (const r of EQUIPMENT_RARITIES) {
    const range = EQUIPMENT_STAT_RANGES[r];
    const stats = statStats(chestSim.statBuckets[r] ?? []);
    console.log(
        `  ${pad(r)} ${pad(range.min)} ${pad(range.max)} ${pad(stats.avg)} ${pad(stats.min)} ${pad(stats.max)}`
    );
}

function statStats(arr) {
    if (arr.length === 0) return { avg: "-", min: "-", max: "-", n: 0 };
    const s = computeStats(arr);
    return { avg: s.avg, min: s.min, max: s.max, n: s.n };
}

// ── 3. 장착 시뮬레이션 ─────────────────────────────────────────

printHeader("5. 4슬롯 장착 — 총 stat 보너스 분포");

const bonusDist = runEquipSim(EQUIP_ITERATIONS);

for (const statKey of ["hp", "damage", "defense", "speed"]) {
    const stats = computeStats(bonusDist[statKey]);
    console.log(
        `  ${pad(statKey)}  평균 ${pad(stats.avg)}  중앙 ${pad(stats.median)}  최소 ${pad(stats.min)}  최대 ${pad(stats.max)}  p10 ${pad(stats.p10)}  p90 ${pad(stats.p90)}`
    );
}

// 종합
printHeader("6. 종합 — 4슬롯 총합");
if (bonusDist.hp.length > 0) {
    const totals = bonusDist.hp.map((_, i) =>
        ["hp", "damage", "defense", "speed"].reduce((s, k) => s + (bonusDist[k][i] ?? 0), 0)
    );
    const t = computeStats(totals);
    console.log(`  총합 평균 ${t.avg}  중앙 ${t.median}  최소 ${t.min}  최대 ${t.max}  p10 ${t.p10}  p90 ${t.p90}`);
}

console.log("");
