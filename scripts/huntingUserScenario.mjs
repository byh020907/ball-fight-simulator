/**
 * 사용자 시나리오 시뮬레이션 — 사냥터 + 장비 + 파편 순환
 *
 * 실제 유저 플레이를 모방한 시나리오:
 *   1. 사냥터 입장 (초기 스펙)
 *   2. 층별 전투 → 파편/상자 획득
 *   3. 귀환 후 보관함에서 상자 개봉 → 장비 or 파편
 *   4. 장비 장착 → 다음 사냥터 스펙 향상
 *   5. 반복
 *
 * 실행: node scripts/huntingUserScenario.mjs
 */

import { createDefaultPlayerProfile } from "../src/playerProfile.js";
import { canOpenHuntingChest, openHuntingChest } from "../src/hunting/chestRewards.js";
import { getHuntingShardDropAmount, getHuntingShardPhysicalDropCount } from "../src/hunting/huntingLoot.js";
import { createHuntingChest } from "../src/hunting/huntingRewards.js";
import {
    getEquippedStatBonuses,
    isInventoryFull,
    canExpandInventory,
    expandInventory,
    disassembleEquipment,
    fuseEquipment,
    sellEquipment,
    INVENTORY_EXPAND_COST,
    INVENTORY_EXPAND_GAIN
} from "../src/hunting/equipmentConfig.js";

// ── 시나리오 설정 ──────────────────────────────────────────────
const CONFIG = {
    RUNS: 100, // 사냥터 반복 횟수
    FLOORS_PER_RUN: 12, // 한 런당 시뮬레이션 층수 (최대 100층 중 일부)
    CHEST_DROP_CHANCE: 0.15 // 층 클리어 시 상자 드랍 확률
};

// ── 헬퍼 ───────────────────────────────────────────────────────

function formatNum(n) {
    return Math.round(n * 100) / 100;
}

function rollGuaranteedShardLoot(floor, rng = Math.random) {
    const count = getHuntingShardPhysicalDropCount(rng);
    return Array.from({ length: count }, () => getHuntingShardDropAmount(floor, rng));
}

// ── 프로필 생성 ────────────────────────────────────────────────

function createProfile() {
    const p = createDefaultPlayerProfile();
    p.hunting.shards = 0;
    return p;
}

// ── 시나리오 실행 ─────────────────────────────────────────────

function runScenario(config) {
    const profile = createProfile();
    const log = [];

    function addLog(msg) {
        log.push(msg);
    }

    // 통계
    const stats = {
        runsCompleted: 0,
        totalShardsEarned: 0,
        totalShardItemsCollected: 0,
        totalChestOpenShardsSpent: 0,
        totalFusionShardsSpent: 0,
        totalChestsOpened: 0,
        totalEquipmentObtained: 0,
        totalChestDrops: 0,
        floorsCleared: 0,
        expansions: 0,
        disassembled: 0,
        fused: 0,
        sold: 0,
        totalStonesEarned: 0,
        totalFusionStonesSpent: 0,
        totalShardsFromSales: 0,
        equipmentByRarity: {},
        statBonusesOverTime: [],
        shardsOverTime: [],
        shardSource: { enemy: 0, chest: 0 }
    };

    function findFusionSources() {
        const byRarity = new Map();
        for (const item of profile.equipment.inventory) {
            if (item.rarity === "legendary") continue;
            const items = byRarity.get(item.rarity) ?? [];
            items.push(item);
            byRarity.set(item.rarity, items);
        }
        return [...byRarity.values()].find((items) => items.length >= 3)?.slice(0, 3) ?? null;
    }

    for (let run = 0; run < config.RUNS; run++) {
        // ── 런 시작 ──
        const runShardsStart = profile.hunting.shards;

        // equip stats before run
        const bonuses = getEquippedStatBonuses(profile);

        addLog(
            `[Run ${run + 1}] 시작 | 보유파편:${runShardsStart} | 장비스탯:${formatNum(bonuses.hp)}HP ${formatNum(bonuses.damage)}DMG ${formatNum(bonuses.defense)}DEF ${formatNum(bonuses.speed)}SPD`
        );

        // ── 층 전투 ──
        let clearedFloors = 0;
        let runShards = 0;
        let runChests = [];

        for (let floor = 1; floor <= config.FLOORS_PER_RUN; floor++) {
            // enemy type (3층마다 elite)
            const isElite = floor % 3 === 0;
            const shardDrops = rollGuaranteedShardLoot(floor);
            const floorShards = shardDrops.reduce((sum, amount) => sum + amount, 0);
            runShards += floorShards;
            stats.totalShardsEarned += floorShards;
            stats.totalShardItemsCollected += shardDrops.length;
            stats.shardSource.enemy += floorShards;
            clearedFloors++;
            stats.floorsCleared++;

            // chest drop
            if (Math.random() < config.CHEST_DROP_CHANCE) {
                const chestRarity = rollChestRarity(floor);
                const chest = createHuntingChest({ rarity: chestRarity });
                runChests.push(chest);
                stats.totalChestDrops++;
                addLog(
                    `  [층${floor}] ${isElite ? "정예" : "일반"}전 승리 | 파편+${floorShards} (${shardDrops.length}개) | 상자(${chestRarity}) 획득`
                );
            } else {
                addLog(
                    `  [층${floor}] ${isElite ? "정예" : "일반"}전 승리 | 파편+${floorShards} (${shardDrops.length}개)`
                );
            }
        }

        // ── 귀환 처리 ──
        profile.hunting.shards += runShards;
        for (const chest of runChests) {
            profile.hunting.chests.push(chest);
        }

        addLog(`  [귀환] 파편+${runShards} | 상자 ${runChests.length}개 보관`);

        // ── 상자 개봉 + 인벤토리 관리 ──
        while (true) {
            // 인벤토리 부족 시 확장, 합성, 판매/분해 순으로 정리
            while (isInventoryFull(profile)) {
                if (canExpandInventory(profile)) {
                    expandInventory(profile);
                    stats.expansions++;
                    addLog(`  [관리] 인벤토리 확장 (+${INVENTORY_EXPAND_GAIN}칸, -${INVENTORY_EXPAND_COST}파편)`);
                } else if (findFusionSources()) {
                    const sources = findFusionSources();
                    const fResult = fuseEquipment(
                        profile,
                        sources.map((item) => item.instanceId)
                    );
                    if (fResult?.item) {
                        stats.fused++;
                        stats.totalFusionShardsSpent += fResult.cost.shards;
                        stats.totalFusionStonesSpent += fResult.cost.stones;
                        addLog(
                            `  [관리] ${sources[0].rarity} 장비 3개 합성 (-${fResult.cost.stones}강화석, -${fResult.cost.shards}파편) → ${fResult.item.rarity}`
                        );
                        continue;
                    }
                }

                // 유료 합성이 막힌 경우에도 인벤토리 정리가 계속되어야 상자 개봉이 멈추지 않는다.
                const worst = [...profile.equipment.inventory].sort((a, b) => {
                    const sumA = (a.stats ?? []).reduce((s, st) => s + st.value, 0);
                    const sumB = (b.stats ?? []).reduce((s, st) => s + st.value, 0);
                    return sumA - sumB;
                })[0];
                if (worst) {
                    if ((profile.hunting.shards ?? 0) < INVENTORY_EXPAND_COST) {
                        const sold = sellEquipment(profile, worst.instanceId);
                        if (sold) {
                            stats.sold++;
                            stats.totalShardsFromSales += sold.shards;
                            addLog(`  [관리] ${sold.item.name} 판매 → 파편+${sold.shards}`);
                        } else {
                            break;
                        }
                    } else {
                        const dResult = disassembleEquipment(profile, worst.instanceId);
                        if (dResult) {
                            stats.disassembled++;
                            stats.totalStonesEarned += dResult.stones;
                            addLog(`  [관리] ${dResult.item.name} 분해 → 강화석+${dResult.stones}`);
                        } else {
                            break;
                        }
                    }
                } else {
                    break;
                }
            }

            const openable = profile.hunting.chests
                .map((c, i) => ({ chest: c, index: i }))
                .filter(({ chest }) => canOpenHuntingChest(profile, chest));

            if (openable.length === 0) break;

            // 가장 높은 등급 우선 개봉 (전략적 선택)
            openable.sort((a, b) => rarityWeight(b.chest.rarity) - rarityWeight(a.chest.rarity));
            const target = openable[0];

            const result = openHuntingChest(profile, target.chest.id, { rng: Math.random });
            if (!result.opened) break;

            stats.totalChestsOpened++;
            stats.totalChestOpenShardsSpent += result.cost;

            if (result.applied.equipment) {
                const eq = result.applied.equipment;
                stats.totalEquipmentObtained++;
                stats.equipmentByRarity[eq.rarity] = (stats.equipmentByRarity[eq.rarity] ?? 0) + 1;
                addLog(
                    `  [개봉] ${eq.rarity}상자 → ★ ${eq.name}(${eq.slot}) [${eq.stats.map((s) => `${s.type}+${s.value}`).join(", ")}]`
                );
            } else if (result.applied.shards > 0) {
                stats.shardSource.chest += result.applied.shards;
                addLog(`  [개봉] 상자 → 파편+${result.applied.shards}`);
            }
        }

        // ── 장비 장착 (최적 장비 선택) ──
        autoEquipBest(profile);
        const endBonuses = getEquippedStatBonuses(profile);

        stats.statBonusesOverTime.push({
            run: run + 1,
            hp: endBonuses.hp,
            damage: endBonuses.damage,
            defense: endBonuses.defense,
            speed: endBonuses.speed,
            total: endBonuses.hp + endBonuses.damage + endBonuses.defense + endBonuses.speed
        });
        stats.shardsOverTime.push({
            run: run + 1,
            shards: profile.hunting.shards,
            inventory: profile.equipment.inventory.length
        });

        stats.runsCompleted++;
        addLog(
            `[Run ${run + 1}] 종료 | 파편:${profile.hunting.shards} | 장착보너스:HP+${endBonuses.hp} DMG+${endBonuses.damage} DEF+${endBonuses.defense} SPD+${endBonuses.speed}`
        );
        addLog("");
    }

    // ── 최종 상태에서 비장착 장비 확인 ──
    const equippedIds = new Set(Object.values(profile.equipment.equipped ?? {}).filter(Boolean));
    const totalItems = profile.equipment.inventory.length;
    const equippedCount = equippedIds.size;

    return { profile, stats, log, totalItems, equippedCount };
}

function rollChestRarity(floor) {
    const r = Math.random();
    if (floor <= 2) {
        return r < 0.6 ? "common" : "uncommon";
    } else if (floor <= 4) {
        return r < 0.3 ? "common" : r < 0.65 ? "uncommon" : "rare";
    } else {
        return r < 0.2 ? "common" : r < 0.5 ? "uncommon" : r < 0.8 ? "rare" : "epic";
    }
}

function rarityWeight(rarity) {
    const w = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
    return w[rarity] ?? 0;
}

function autoEquipBest(profile) {
    const eq = profile.equipment;
    if (!eq || !Array.isArray(eq.inventory)) return;

    const slotPriority = { weapon: 0, armor: 0, accessory: 0 };

    for (const item of eq.inventory) {
        const statSum = (item.stats ?? []).reduce((s, st) => s + st.value, 0);
        if (statSum > (slotPriority[item.slot] ?? 0)) {
            slotPriority[item.slot] = statSum;
        }
    }

    // 각 슬롯별 최고 장비 장착
    for (const slot of ["weapon", "armor"]) {
        const best = eq.inventory
            .filter((i) => i.slot === slot)
            .sort((a, b) => {
                const sumA = (a.stats ?? []).reduce((s, st) => s + st.value, 0);
                const sumB = (b.stats ?? []).reduce((s, st) => s + st.value, 0);
                return sumB - sumA;
            })[0];

        if (best) {
            eq.equipped[slot] = best.instanceId;
        }
    }

    // accessory: 2슬롯
    const accessories = eq.inventory
        .filter((i) => i.slot === "accessory")
        .sort((a, b) => {
            const sumA = (a.stats ?? []).reduce((s, st) => s + st.value, 0);
            const sumB = (b.stats ?? []).reduce((s, st) => s + st.value, 0);
            return sumB - sumA;
        });

    if (accessories.length >= 1) eq.equipped.accessory1 = accessories[0].instanceId;
    if (accessories.length >= 2) eq.equipped.accessory2 = accessories[1].instanceId;
}

// ── 결과 출력 ─────────────────────────────────────────────────

function printReport(config, result) {
    const { stats, totalItems, equippedCount } = result;
    const expansionCost = stats.expansions * INVENTORY_EXPAND_COST;
    const totalShardSpending = stats.totalChestOpenShardsSpent + stats.totalFusionShardsSpent + expansionCost;
    const totalShardIncome = stats.totalShardsEarned + stats.shardSource.chest + stats.totalShardsFromSales;

    console.log("");
    console.log("  ╔══════════════════════════════════════════════════╗");
    console.log("  ║        사냥터 사용자 시나리오 리포트            ║");
    console.log("  ╚══════════════════════════════════════════════════╝");
    console.log("");
    console.log(`  실행 설정: ${config.RUNS}회 사냥 · ${config.FLOORS_PER_RUN}층/런`);
    console.log("");

    // ── 기본 통계 ──
    console.log("  ─── 기본 통계 ───");
    console.log(`  완료 런:        ${stats.runsCompleted}`);
    console.log(
        `  클리어 층:      ${stats.floorsCleared} (평균 ${(stats.floorsCleared / stats.runsCompleted).toFixed(1)}층/런)`
    );
    console.log(
        `  상자 드랍:      ${stats.totalChestDrops} (${(stats.totalChestDrops / stats.runsCompleted).toFixed(1)}개/런)`
    );
    console.log(`  상자 개봉:      ${stats.totalChestsOpened}`);
    console.log(`  장비 획득:      ${stats.totalEquipmentObtained}`);
    console.log(`  보유 장비: ${totalItems} (장착 ${equippedCount}/${totalItems})`);
    console.log(`  인벤토리 확장: ${stats.expansions}회 (총 +${stats.expansions * INVENTORY_EXPAND_GAIN}칸)`);
    console.log(`  장비 합성:     ${stats.fused}회`);
    console.log(`  장비 판매:     ${stats.sold}회 (파편 +${stats.totalShardsFromSales})`);
    console.log(`  장비 분해:     ${stats.disassembled}회 (강화석 +${stats.totalStonesEarned})`);
    console.log("");

    // ── 파편 순환 ──
    console.log("  ─── 파편 순환 ───");
    console.log(`  전투 파편 아이템: ${stats.totalShardItemsCollected}개`);
    console.log(`  총 수입:        ${totalShardIncome}`);
    console.log(`    - 전투:       ${stats.shardSource.enemy}`);
    console.log(`    - 상자:       ${stats.shardSource.chest}`);
    console.log(`    - 판매:       ${stats.totalShardsFromSales}`);
    console.log(`  총 소비:        ${totalShardSpending}`);
    console.log(`    - 상자 개봉:  ${stats.totalChestOpenShardsSpent}`);
    console.log(`    - 장비 합성:  ${stats.totalFusionShardsSpent}`);
    console.log(`    - 인벤토리 확장: ${expansionCost} (${stats.expansions}회)`);
    console.log(`  최종 잔여:      ${result.profile.hunting.shards}`);
    console.log(
        `  개봉당 평균:    ${stats.totalChestsOpened > 0 ? Math.round(stats.totalChestOpenShardsSpent / stats.totalChestsOpened) : 0} 파편`
    );
    console.log("");

    // ── 장비 등급 분포 ──
    console.log("  ─── 장비 등급 분포 ───");
    const rarityOrder = ["common", "uncommon", "rare", "epic", "legendary"];
    for (const r of rarityOrder) {
        const count = stats.equipmentByRarity[r] ?? 0;
        const pct =
            stats.totalEquipmentObtained > 0 ? ((count / stats.totalEquipmentObtained) * 100).toFixed(1) : "0.0";
        console.log(`  ${r.padEnd(12)} ${String(count).padStart(4)} (${pct}%)`);
    }
    console.log("");

    // ── 스탯 보너스 성장 ──
    const bonusSnapshots = stats.statBonusesOverTime;
    const first = bonusSnapshots[0];
    const mid = bonusSnapshots[Math.floor(bonusSnapshots.length / 2)];
    const last = bonusSnapshots[bonusSnapshots.length - 1];

    console.log("  ─── 장착 스탯 보너스 성장 ───");
    console.log(
        `  ${"".padEnd(10)} ${"HP".padStart(5)} ${"DMG".padStart(6)} ${"DEF".padStart(6)} ${"SPD".padStart(6)} ${"합계".padStart(6)}`
    );
    console.log("  " + "─".repeat(40));
    if (first)
        console.log(
            `  시작     ${String(first.hp).padStart(5)} ${String(first.damage).padStart(6)} ${String(first.defense).padStart(6)} ${String(first.speed).padStart(6)} ${String(first.total).padStart(6)}`
        );
    if (mid)
        console.log(
            `  중간     ${String(mid.hp).padStart(5)} ${String(mid.damage).padStart(6)} ${String(mid.defense).padStart(6)} ${String(mid.speed).padStart(6)} ${String(mid.total).padStart(6)}`
        );
    if (last)
        console.log(
            `  최종     ${String(last.hp).padStart(5)} ${String(last.damage).padStart(6)} ${String(last.defense).padStart(6)} ${String(last.speed).padStart(6)} ${String(last.total).padStart(6)}`
        );

    // ── 구간별 추이 ──
    if (bonusSnapshots.length >= 10) {
        console.log("");
        console.log("  ─── 10런 단위 평균 스탯 보너스 ───");
        const bucketSize = Math.max(1, Math.floor(bonusSnapshots.length / 10));
        for (let i = 0; i < bonusSnapshots.length; i += bucketSize) {
            const bucket = bonusSnapshots.slice(i, i + bucketSize);
            const avg = (key) => String(formatNum(bucket.reduce((s, x) => s + x[key], 0) / bucket.length));
            const runStart = bucket[0].run;
            const runEnd = bucket[bucket.length - 1].run;
            console.log(
                `  ${String(runStart).padStart(3)}~${String(runEnd).padEnd(3)}런  HP+${avg("hp").padStart(6)} DMG+${avg("damage").padStart(5)} DEF+${avg("defense").padStart(5)} SPD+${avg("speed").padStart(5)} 합=${avg("total").padStart(5)}`
            );
        }
    }

    // ── 파편 추이 ──
    if (stats.shardsOverTime.length >= 10) {
        console.log("");
        console.log("  ─── 10런 단위 평균 잔여 파편/인벤토리 ───");
        const bucketSize = Math.max(1, Math.floor(stats.shardsOverTime.length / 10));
        for (let i = 0; i < stats.shardsOverTime.length; i += bucketSize) {
            const bucket = stats.shardsOverTime.slice(i, i + bucketSize);
            const avgShards = String(Math.round(bucket.reduce((s, x) => s + x.shards, 0) / bucket.length));
            const avgInv = String(formatNum(bucket.reduce((s, x) => s + x.inventory, 0) / bucket.length));
            const runStart = bucket[0].run;
            const runEnd = bucket[bucket.length - 1].run;
            console.log(
                `  ${String(runStart).padStart(3)}~${String(runEnd).padEnd(3)}런  파편:${String(avgShards).padStart(6)}  장비:${String(avgInv).padStart(4)}`
            );
        }
    }

    // ── 인벤토리 상태 ──
    console.log("");
    console.log("  ─── 인벤토리 ───");
    console.log(`  보유 장비: ${totalItems} (최대 ${result.profile.equipment.maxInventorySlots})`);
    if (totalItems > result.profile.equipment.maxInventorySlots) {
        console.log(`  ⚠ 인벤토리 초과! ${totalItems - result.profile.equipment.maxInventorySlots}개 초과`);
    }
    if (totalItems >= result.profile.equipment.maxInventorySlots) {
        console.log(`  ⚠ 인벤토리 가득 참 (분해/확장 필요)`);
    }
    console.log(
        `  강화석:   ${result.profile.equipment.enhancementStones} (획득 +${stats.totalStonesEarned}, 합성 -${stats.totalFusionStonesSpent})`
    );
    console.log("");

    // ── 이상 징후 ──
    const warnings = [];
    if (totalShardSpending > totalShardIncome) {
        warnings.push("파편 지출이 수입을 초과했습니다 (비정상)");
    }
    if (result.profile.hunting.shards !== totalShardIncome - totalShardSpending) {
        warnings.push("파편 수입·지출 회계가 최종 잔여와 일치하지 않습니다");
    }
    if (stats.totalChestDrops > 0 && stats.totalChestsOpened === 0) {
        warnings.push("상자를 전혀 열지 못했습니다 (파편 부족)");
    }
    if (totalItems === 0 && stats.runsCompleted > 10) {
        warnings.push("장비를 하나도 획득하지 못했습니다 (드롭률 이상)");
    }

    if (warnings.length > 0) {
        console.log("  ─── 이상 징후 ───");
        for (const w of warnings) {
            console.log(`  ⚠ ${w}`);
        }
        console.log("");
    } else {
        console.log("  ✅ 이상 징후 없음 — 장비/파편 순환 정상\n");
    }
}

// ── 메인 ───────────────────────────────────────────────────────

const result = runScenario(CONFIG);
printReport(CONFIG, result);
