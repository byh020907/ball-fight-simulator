// scripts/benchmark.mjs — 액션 없음 vs RL 모델 사용 승률 비교
import * as tf from "@tensorflow/tfjs";
import fs from "fs";
import path from "path";
import { createRoster } from "../src/roster.js";
import { applyStatAllocation, createEmptyStatAllocation } from "../src/statAllocation.js";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { AIActionController } from "../src/simulation/aiActionController.js";
import { findActionById, getActionPool } from "../src/clickActions.js";
import { prepareTensorflowBackend } from "./rl/policyNetwork.js";
import { RLPolicy, setTf } from "../src/ai/rlPolicy.js";
import * as tfModule from "@tensorflow/tfjs";

// Node.js 환경에서 RLPolicy가 tf를 찾을 수 있도록 주입
setTf(tfModule);

// ── Config ──

function readNumberEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || raw === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function readIdListEnv(name, fallback = ["all"]) {
    const raw = process.env[name];
    if (raw == null || raw.trim() === "") return fallback;
    return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

const CONFIG = {
    samples: readNumberEnv("RL_SAMPLES", 500),        // 캐릭터당 시합 수
    characterIds: readIdListEnv("RL_CHARACTERS"),
    actionIds: readIdListEnv("RL_ACTIONS"),
    modelDir: process.env.RL_MODEL_DIR ?? "models",
    cpuThreads: readNumberEnv("RL_CPU_THREADS", 0),
    maxEpisodeSeconds: readNumberEnv("RL_MAX_EPISODE_SECONDS", 35),
};

// ── Helpers ──

function pickRandom(roster, excludeId) {
    const others = roster.filter((f) => f.id !== excludeId);
    return others[Math.floor(Math.random() * others.length)];
}

function createSim(fighterSpec, opponentSpec) {
    const a = applyStatAllocation(fighterSpec, createEmptyStatAllocation(), false);
    const b = applyStatAllocation(opponentSpec, createEmptyStatAllocation(), false);
    return new BattleSimulation([a, b], { onLog() {} }, null, { assignActions: false });
}

/** 특정 캐릭터가 N회 싸웠을 때 승률 측정 */
function runMatches(fighterSpec, opponentPicker, actionToUse, sampleCount) {
    let wins = 0;
    for (let i = 0; i < sampleCount; i++) {
        const opponent = opponentPicker();
        const sim = createSim(fighterSpec, opponent);
        const fighter = sim.fighters[0];

        if (actionToUse) {
            fighter.aiController = new AIActionController();
            fighter.aiController._chosenAction = actionToUse;
            // RL 정책을 컨트롤러에 직접 주입 (evaluate에서 사용)
            fighter.aiController.rlPolicy = actionToUse._rlPolicy ?? null;
        }

        while (!sim.finished && sim.elapsed < CONFIG.maxEpisodeSeconds) {
            sim.update(1 / 60, 1 / 60);
            if (actionToUse && fighter.aiController) {
                const result = fighter.aiController.evaluate(sim, fighter, 1 / 60);
                if (result) {
                    sim.scheduleAction(result.action, result.fighter, result.paidCost);
                }
            }
        }
        if (sim.winner && sim.winner.id === fighter.id) wins++;
    }
    return wins / sampleCount;
}

/** 모델 로드 → RLPolicy */
async function loadPolicy(actionId, charId) {
    const filePath = path.resolve(CONFIG.modelDir, actionId, `${charId}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    // weightData는 base64 문자열 그대로 전달 (RLPolicy.fromJson이 변환)
    return await RLPolicy.fromJson(raw);
}

// ── Main ──

async function main() {
    if (CONFIG.cpuThreads > 0) {
        process.env.OMP_NUM_THREADS = String(CONFIG.cpuThreads);
    }
    await prepareTensorflowBackend();

    const roster = createRoster();
    const allActions = getActionPool();
    const characterIds = CONFIG.characterIds.includes("all")
        ? roster.map((f) => f.id)
        : CONFIG.characterIds;
    const actionIds = CONFIG.actionIds.includes("all")
        ? allActions.map((a) => a.id)
        : CONFIG.actionIds;

    console.log(`벤치마크: 캐릭터 ${characterIds.length}개 × 액션 ${actionIds.length}종 × ${CONFIG.samples}회`);
    console.log("");

    // 1. 베이스라인 (액션 없음)
    console.log("── 베이스라인 (액션 없음) ──");
    const baselines = {};
    for (const charId of characterIds) {
        const spec = roster.find((f) => f.id === charId);
        const opponentPicker = () => pickRandom(roster, charId);
        const wr = runMatches(spec, opponentPicker, null, CONFIG.samples);
        baselines[charId] = wr;
        const name = spec.name.padEnd(16);
        console.log(`  ${name} baseline=${(wr * 100).toFixed(1)}%`);
    }

    // 2. 모델 사용
    console.log("\n── RL 모델 사용 ──");
    const results = [];
    for (const charId of characterIds) {
        const spec = roster.find((f) => f.id === charId);
        const opponentPicker = () => pickRandom(roster, charId);
        const baseline = baselines[charId];

        for (const actionId of actionIds) {
            const action = findActionById(actionId);
            if (!action) continue;
            const policy = await loadPolicy(actionId, charId);
            if (!policy) continue;

            // 액션에 rlPolicy 주입 (runMatches에서 사용)
            action._rlPolicy = policy;

            const wr = runMatches(spec, opponentPicker, action, CONFIG.samples);
            const delta = wr - baseline;
            const actionName = action.name.padEnd(10);
            const name = spec.name.padEnd(16);
            const sig = delta > 0.03 ? "▲" : delta < -0.03 ? "▼" : "─";
            console.log(
                `  ${name} × ${actionName} wr=${(wr * 100).toFixed(1)}% ` +
                `(Δ${(delta >= 0 ? "+" : "")}${(delta * 100).toFixed(1)}%) ${sig}`
            );
            results.push({ charId, actionId, baseline, modelWr: wr, delta });

            policy.actor.dispose();
            delete action._rlPolicy;
        }
    }

    // 3. 요약
    if (results.length === 0) {
        console.log("\n비교할 모델이 없습니다. 먼저 학습을 실행하세요.");
        return;
    }

    results.sort((a, b) => b.delta - a.delta);
    const useful = results.filter((r) => r.delta > 0.03);
    const harmful = results.filter((r) => r.delta < -0.03);

    console.log("\n── 요약 ──");
    console.log(`총 ${results.length}개 조합 평가됨`);
    console.log(`유의미한 승률 상승 (Δ>+3%): ${useful.length}개`);
    console.log(`유의미한 승률 하락 (Δ<-3%): ${harmful.length}개`);
    console.log(`무변화 (±3% 이내): ${results.length - useful.length - harmful.length}개`);

    if (useful.length > 0) {
        console.log("\n🏆 효과 좋은 조합:");
        for (const r of useful.slice(0, 10)) {
            const name = roster.find((f) => f.id === r.charId).name;
            const action = findActionById(r.actionId);
            console.log(`  ${name} × ${action.name}: +${(r.delta * 100).toFixed(1)}% (${(r.baseline * 100).toFixed(0)}% → ${(r.modelWr * 100).toFixed(0)}%)`);
        }
    }

    if (harmful.length > 0) {
        console.log("\n💀 오히려 해로운 조합:");
        for (const r of harmful.slice(0, 10)) {
            const name = roster.find((f) => f.id === r.charId).name;
            const action = findActionById(r.actionId);
            console.log(`  ${name} × ${action.name}: ${(r.delta * 100).toFixed(1)}% (${(r.baseline * 100).toFixed(0)}% → ${(r.modelWr * 100).toFixed(0)}%)`);
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
