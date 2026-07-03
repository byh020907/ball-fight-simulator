// scripts/rl/train.mjs - 캐릭터/액션 조합별 PPO 학습
import * as tf from "@tensorflow/tfjs";
import fs from "fs";
import path from "path";
import { createRoster } from "../../src/roster.js";
import { applyStatAllocation, createEmptyStatAllocation } from "../../src/statAllocation.js";
import { BattleSimulation } from "../../src/simulation/battleSimulation.js";
import { AIActionController } from "../../src/simulation/aiActionController.js";
import { findActionById, getActionPool } from "../../src/clickActions.js";
import {
    createActorCriticNetworks,
    deterministicAction,
    predictValues,
    prepareTensorflowBackend,
    sampleAction,
    trainPpoEpochs
} from "./policyNetwork.js";
import { extractFeatures } from "./features.js";
import { FEATURE_DIM } from "./features.js";
import { RunningNormalizer } from "./normalizer.js";

function readNumberEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || raw === "") return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function readIdListEnv(name, fallback = ["all"]) {
    const raw = process.env[name];
    if (raw == null || raw.trim() === "") return fallback;
    return raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}

function readBooleanEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || raw.trim() === "") return fallback;
    return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

const CONFIG = {
    episodes: readNumberEnv("RL_EPISODES", 1500),
    throttleMs: readNumberEnv("RL_THROTTLE_MS", 0),
    batchThrottleMs: readNumberEnv("RL_BATCH_THROTTLE_MS", 0),
    lr: readNumberEnv("RL_LR", 3e-4),
    gamma: readNumberEnv("RL_GAMMA", 0.97),
    batchSize: readNumberEnv("RL_BATCH_SIZE", 64),
    miniBatchSize: readNumberEnv("RL_MINI_BATCH_SIZE", 128),
    ppoEpochs: readNumberEnv("RL_PPO_EPOCHS", 3),
    clipRatio: readNumberEnv("RL_CLIP_RATIO", 0.2),
    valueCoef: readNumberEnv("RL_VALUE_COEF", 0.5),
    entropyCoef: readNumberEnv("RL_ENTROPY_COEF", 0.01),
    hpWeight: readNumberEnv("RL_HP_WEIGHT", 0), // 0이면 액션별 기본값 사용
    survivalWeight: readNumberEnv("RL_SURVIVAL_WEIGHT", 0), // 0이면 액션별 기본값 사용
    actionPenalty: readNumberEnv("RL_ACTION_PENALTY", 0), // 0이면 액션별 기본값 사용
    minDecisionFrames: readNumberEnv("RL_MIN_DECISION_FRAMES", 30),
    maxEpisodeSeconds: readNumberEnv("RL_MAX_EPISODE_SECONDS", 35),
    logInterval: readNumberEnv("RL_LOG_INTERVAL", 100),
    normalizerSamples: readNumberEnv("RL_NORMALIZER_SAMPLES", 1000),
    evalEpisodes: readNumberEnv("RL_EVAL_EPISODES", 50),
    evalThreshold: readNumberEnv("RL_EVAL_THRESHOLD", 0.5),
    characterIds: readIdListEnv("RL_CHARACTERS"),
    actionIds: readIdListEnv("RL_ACTIONS"),
    maxCombos: readNumberEnv("RL_MAX_COMBOS", Number.POSITIVE_INFINITY),
    inputDim: FEATURE_DIM,
    hiddenDim: readNumberEnv("RL_HIDDEN_DIM", 16),
    opponentMode: (process.env.RL_OPPONENT_MODE ?? "random").toLowerCase(),
    fixedOpponent: process.env.RL_FIXED_OPPONENT ?? "rage",
    modelDir: process.env.RL_MODEL_DIR ?? "models",
    cpuThreads: readNumberEnv("RL_CPU_THREADS", 0), // 0=모든 코어 사용, 2=절반, 1=최저발열
    builtinAiActions: readBooleanEnv("RL_BUILTIN_AI_ACTIONS", false)
};

/**
 * 액션별 보상 가중치.
 * env로 RL_HP_WEIGHT 등이 설정되면 전체 override, 아니면 이 맵에서 액션ID로 조회.
 * 빠진 액션은 DEFAULT_ACTION_WEIGHTS 사용.
 */
const DEFAULT_ACTION_WEIGHTS = { hp: 0.3, survival: 0.15, penalty: 0.02 };
const ACTION_WEIGHT_MAP = {
    // 공격형 — HP 피해 위주
    shockwave: { hp: 0.5, survival: 0.1, penalty: 0.02 },
    // 방어형 — 생존 위주
    evade: { hp: 0.1, survival: 0.5, penalty: 0.01 },
    counter: { hp: 0.2, survival: 0.4, penalty: 0.01 },
    projectile_guard: { hp: 0.1, survival: 0.5, penalty: 0.01 },
    // 유틸리티 — 균형
    rush: { hp: 0.15, survival: 0.15, penalty: 0.02 },
    time_warp: { hp: 0.2, survival: 0.2, penalty: 0.15 },
    // 회복/생존
    life_steal: { hp: 0.3, survival: 0.2, penalty: 0.02 },
    endure: { hp: 0.1, survival: 0.35, penalty: 0.02 }
};

/** 액션 ID에 해당하는 (hp, survival, penalty) 반환 */
function getActionWeights(actionId) {
    const fromEnv = CONFIG.hpWeight > 0 || CONFIG.survivalWeight > 0 || CONFIG.actionPenalty > 0;
    if (fromEnv) {
        // env override: 직접 지정값 사용
        return {
            hp: CONFIG.hpWeight || DEFAULT_ACTION_WEIGHTS.hp,
            survival: CONFIG.survivalWeight || DEFAULT_ACTION_WEIGHTS.survival,
            penalty: CONFIG.actionPenalty || DEFAULT_ACTION_WEIGHTS.penalty
        };
    }
    return ACTION_WEIGHT_MAP[actionId] ?? DEFAULT_ACTION_WEIGHTS;
}

function pickRandom(roster, excludeId) {
    const others = roster.filter((f) => f.id !== excludeId);
    return others[Math.floor(Math.random() * others.length)];
}

function createTrainingSimulation(rlSpec, opponentSpec) {
    const fighterSpec = applyStatAllocation(rlSpec, createEmptyStatAllocation(), false);
    const enemySpec = applyStatAllocation(opponentSpec, createEmptyStatAllocation(), false);
    return new BattleSimulation([fighterSpec, enemySpec], { onLog() {} }, null, { assignActions: false });
}

function initNormalizer(normalizer, roster) {
    for (let i = 0; i < CONFIG.normalizerSamples; i++) {
        const a = roster[Math.floor(Math.random() * roster.length)];
        const b = pickRandom(roster, a.id);
        const sim = createTrainingSimulation(a, b);
        if (CONFIG.builtinAiActions) {
            sim.fighters[0].aiController = new AIActionController();
            sim.fighters[0].aiController.selectAction(sim, sim.fighters[0]);
        }
        for (let j = 0; j < 30; j++) {
            sim.update(1 / 60, 1 / 60);
            if (sim.fighters.length >= 2) {
                normalizer.update(extractFeatures(sim.fighters[0], sim.fighters[1], sim));
            }
        }
    }
}

function selectIds(requestedIds, availableIds, label) {
    if (requestedIds.length === 0 || requestedIds.includes("all")) return availableIds;
    const available = new Set(availableIds);
    const unknown = requestedIds.filter((id) => !available.has(id));
    if (unknown.length > 0) {
        throw new Error(`${label} ID를 찾을 수 없습니다: ${unknown.join(", ")}`);
    }
    return requestedIds;
}

function buildTrainingCombos(roster, actions) {
    const characterIds = selectIds(
        CONFIG.characterIds,
        roster.map((fighter) => fighter.id),
        "캐릭터"
    );
    const actionIds = selectIds(
        CONFIG.actionIds,
        actions.map((action) => action.id),
        "액션"
    );
    const combos = characterIds.flatMap((charId) => actionIds.map((actionId) => ({ charId, actionId })));
    return combos.slice(0, Math.min(CONFIG.maxCombos, combos.length));
}

function pickOpponentSpec(roster, rlSpec) {
    if (CONFIG.opponentMode === "random") {
        return pickRandom(roster, rlSpec.id);
    }

    const fixed = roster.find((fighter) => fighter.id === CONFIG.fixedOpponent);
    if (fixed && fixed.id !== rlSpec.id) {
        return fixed;
    }
    return pickRandom(roster, rlSpec.id);
}

function canConsiderAction(sim, fighter, action, lastDecisionFrame) {
    const frame = Math.floor((sim.elapsed ?? 0) * 60);
    if (frame - lastDecisionFrame < CONFIG.minDecisionFrames) return false;
    if (action.getFailureReason?.(sim, fighter) != null) return false;

    const cost = Math.ceil((fighter.maxHp * action.hpCostPercent) / 100);
    const hpAfterCost = (fighter.hp - cost) / fighter.maxHp;
    return hpAfterCost >= 0.3;
}

function decideAction(actor, obs, deterministic) {
    return deterministic ? deterministicAction(actor, obs, CONFIG.evalThreshold) : sampleAction(actor, obs);
}

function runEpisode({ actor, normalizer, rlSpec, opponentSpec, fixedAction, deterministic = false }) {
    const sim = createTrainingSimulation(rlSpec, opponentSpec);
    const fighter = sim.fighters[0];
    if (CONFIG.builtinAiActions) {
        fighter.aiController = new AIActionController();
        fighter.aiController._chosenAction = fixedAction;
    }
    fighter.clickActionName = fixedAction.name;

    const trajectory = [];
    let actionUseCount = 0;
    let probabilitySum = 0;
    let lastDecisionFrame = -CONFIG.minDecisionFrames;
    // 액션 직전 HP 추적 → 액션으로 인한 피해/방어 효과 측정
    let lastActionOppHp = 0;
    let lastActionMyHp = 0;
    let actionDamageDealt = 0; // 액션 후 상대가 잃은 HP
    let actionDamageTaken = 0; // 액션 후 내가 잃은 HP

    while (!sim.finished && sim.elapsed < CONFIG.maxEpisodeSeconds) {
        sim.update(1 / 60, 1 / 60);
        const opponent = sim.getOpponent(fighter);
        if (!opponent) break;

        // 이전 액션의 효과 정산
        if (lastActionOppHp > 0) {
            if (opponent.hp < lastActionOppHp) actionDamageDealt += lastActionOppHp - opponent.hp;
            if (fighter.hp < lastActionMyHp) actionDamageTaken += lastActionMyHp - fighter.hp;
        }
        lastActionOppHp = 0;
        lastActionMyHp = 0;

        if (!canConsiderAction(sim, fighter, fixedAction, lastDecisionFrame)) continue;

        const rawObs = extractFeatures(fighter, opponent, sim);
        if (!deterministic) {
            normalizer.update(rawObs);
        }
        const obs = normalizer.normalize(rawObs);
        const decision = decideAction(actor, obs, deterministic);
        trajectory.push({
            obs,
            action: decision.action,
            oldLogProb: decision.logProb,
            probability: decision.probability
        });
        probabilitySum += decision.probability;

        lastDecisionFrame = Math.floor((sim.elapsed ?? 0) * 60);
        if (decision.action === 1) {
            actionUseCount++;
            lastActionOppHp = opponent.hp;
            lastActionMyHp = fighter.hp;
            const cost = Math.ceil((fighter.maxHp * fixedAction.hpCostPercent) / 100);
            const paid = fighter.actionContext.spendHpForAction(fighter, cost);
            if (paid > 0) sim.scheduleAction(fixedAction, fighter, paid);
        }
    }

    // 마지막 액션 효과 정산
    const opponent = sim.getOpponent(fighter);
    if (lastActionOppHp > 0 && opponent) {
        if (opponent.hp < lastActionOppHp) actionDamageDealt += lastActionOppHp - opponent.hp;
        if (fighter.hp < lastActionMyHp) actionDamageTaken += lastActionMyHp - fighter.hp;
    }

    const won = sim.winner && sim.winner.id === fighter.id;
    const oppMaxHp = opponent ? opponent.maxHp : 1;
    const myMaxHp = fighter.maxHp;
    const w = getActionWeights(fixedAction.id);

    const dealRatio = Math.min(1, actionDamageDealt / oppMaxHp);
    const takeRatio = Math.min(1, actionDamageTaken / myMaxHp);

    const reward = (won ? 1.0 : -1.0) + dealRatio * w.hp - takeRatio * w.survival - actionUseCount * w.penalty;
    return {
        trajectory,
        reward,
        won,
        actionUseRate: trajectory.length > 0 ? actionUseCount / trajectory.length : 0,
        actionProbability: trajectory.length > 0 ? probabilitySum / trajectory.length : 0
    };
}

function summarizeEpisodes(episodes) {
    const total = Math.max(1, episodes.length);
    return {
        winRate: episodes.filter((episode) => episode.won).length / total,
        reward: episodes.reduce((sum, episode) => sum + episode.reward, 0) / total,
        actionUseRate: episodes.reduce((sum, episode) => sum + episode.actionUseRate, 0) / total,
        actionProbability: episodes.reduce((sum, episode) => sum + episode.actionProbability, 0) / total
    };
}

function formatPercent(value) {
    return `${(value * 100).toFixed(1)}%`;
}

// ── 모델 저장 ──

/** ArrayBuffer → base64 (Node.js Buffer 사용) */
function bufferToBase64(buffer) {
    return Buffer.from(buffer).toString("base64");
}

/**
 * 학습된 actor + normalizer + 메타데이터를 단일 JSON 파일로 저장.
 * 포맷: models/{actionId}/{charId}.json
 *
 * 파일 구조:
 *   modelTopology  — tf.LayersModel.toJSON() 토폴로지
 *   weightSpecs    — 가중치 메타 (name, shape, dtype)
 *   weightData     — 가중치 값을 base64 인코딩한 문자열
 *   normalizer     — { mean: number[], std: number[] }
 *   charId, actionId, trainWinRate, ...
 *
 * 게임에서 로드:
 *   RLPolicy.fromJson(fetch("models/rush/dash.json").then(r => r.json()))
 */
async function saveModel(actor, normalizer, metadata) {
    // TF.js 모델 아티팩트 추출
    const artifacts = await new Promise((resolve) => {
        actor.save(
            tf.io.withSaveHandler(async (artifacts) => {
                resolve(artifacts);
                return { modelArtifactsInfo: {} };
            })
        );
    });

    // RunningNormalizer의 Welford state → std 계산
    const std = normalizer.M2.map((m2, i) => (normalizer.n > 1 ? Math.sqrt(m2 / (normalizer.n - 1)) : 1));

    const modelJson = {
        // ── TF.js 표준 필드 (tf.io.fromMemory 로 복원) ──
        modelTopology: artifacts.modelTopology,
        weightSpecs: artifacts.weightSpecs,
        weightData: bufferToBase64(artifacts.weightData),

        // ── 커스텀 메타 ──
        format: "ball-fight-rl-v1",
        ...metadata,
        normalizer: {
            mean: [...normalizer.mean],
            std
        },
        trainedAt: new Date().toISOString(),
        config: {
            hiddenDim: CONFIG.hiddenDim,
            episodes: CONFIG.episodes,
            lr: CONFIG.lr,
            gamma: CONFIG.gamma,
            opponentMode: CONFIG.opponentMode,
            weights: getActionWeights(metadata.actionId)
        }
    };

    const outDir = path.resolve(CONFIG.modelDir, metadata.actionId);
    await fs.promises.mkdir(outDir, { recursive: true });
    const filePath = path.join(outDir, `${metadata.charId}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(modelJson, null, 2), "utf-8");
    console.log(`  모델 저장: ${filePath}`);
}

// ── eval 유틸 ──

function formatEval(label, evalResult) {
    if (!evalResult) return `${label}: skipped`;
    return (
        `${label}: win=${formatPercent(evalResult.winRate)} ` +
        `reward=${evalResult.reward.toFixed(3)} ` +
        `use=${formatPercent(evalResult.actionUseRate)} ` +
        `prob=${formatPercent(evalResult.actionProbability)}`
    );
}

function evaluateCombo(actor, normalizer, roster, rlSpec, fixedAction) {
    if (CONFIG.evalEpisodes <= 0) return null;
    const evalNormalizer = normalizer.clone();
    const episodes = [];
    for (let i = 0; i < CONFIG.evalEpisodes; i++) {
        episodes.push(
            runEpisode({
                actor,
                normalizer: evalNormalizer,
                rlSpec,
                opponentSpec: pickOpponentSpec(roster, rlSpec),
                fixedAction,
                deterministic: true
            })
        );
    }
    return summarizeEpisodes(episodes);
}

function normalize(values) {
    if (values.length === 0) return [];
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance) || 1;
    return values.map((value) => (value - mean) / std);
}

function buildPpoBatch(critic, trajectories) {
    const obs = [];
    const actions = [];
    const oldLogProbs = [];
    const returns = [];
    const weights = [];

    for (const { trajectory, reward } of trajectories) {
        let runningReturn = 0;
        const episodeReturns = new Array(trajectory.length);
        for (let i = trajectory.length - 1; i >= 0; i--) {
            const immediateReward = i === trajectory.length - 1 ? reward : 0;
            runningReturn = immediateReward + CONFIG.gamma * runningReturn;
            episodeReturns[i] = runningReturn;
        }

        for (let i = 0; i < trajectory.length; i++) {
            obs.push(trajectory[i].obs);
            actions.push(trajectory[i].action);
            oldLogProbs.push(trajectory[i].oldLogProb);
            returns.push(episodeReturns[i]);
            weights.push(Math.pow(CONFIG.gamma, trajectory.length - 1 - i));
        }
    }

    const values = predictValues(critic, obs);
    const advantages = normalize(returns.map((value, index) => value - values[index]));
    return { obs, actions, oldLogProbs, returns, advantages, weights };
}

async function trainCombo(roster, combo, baseNormalizer, index, total) {
    const { actor, critic } = createActorCriticNetworks(CONFIG.inputDim, CONFIG.hiddenDim);
    const optimizer = tf.train.adam(CONFIG.lr);
    const normalizer = baseNormalizer.clone();
    let evalWin = 0;
    let evalTotal = 0;
    let lastLoss = 0;
    const rewardWindow = [];
    const winWindow = [];
    const useWindow = [];
    const probabilityWindow = [];

    const rlSpec = roster.find((f) => f.id === combo.charId);
    const fixedAction = findActionById(combo.actionId);
    if (!rlSpec || !fixedAction) {
        throw new Error(`학습 조합을 찾을 수 없습니다: ${combo.charId} × ${combo.actionId}`);
    }

    const fixedOpponentSpec = roster.find((fighter) => fighter.id === CONFIG.fixedOpponent);
    const opponentLabel =
        CONFIG.opponentMode === "random"
            ? "Random"
            : fixedOpponentSpec?.id === rlSpec.id
              ? `Random (fixed self fallback: ${fixedOpponentSpec.name})`
              : (fixedOpponentSpec?.name ?? CONFIG.fixedOpponent);
    console.log(`\n=== [${index}/${total}] ${rlSpec.name} × ${fixedAction.name} vs ${opponentLabel} ===`);

    const preEval = evaluateCombo(actor, normalizer, roster, rlSpec, fixedAction);
    console.log(`  ${formatEval("eval before", preEval)}`);

    const batch = [];
    for (let ep = 0; ep < CONFIG.episodes; ep++) {
        const opponentSpec = pickOpponentSpec(roster, rlSpec);
        const episode = runEpisode({ actor, normalizer, rlSpec, opponentSpec, fixedAction });
        batch.push(episode);
        evalTotal++;
        if (episode.won) evalWin++;
        rewardWindow.push(episode.reward);
        winWindow.push(episode.won ? 1 : 0);
        useWindow.push(episode.actionUseRate);
        probabilityWindow.push(episode.actionProbability);
        if (rewardWindow.length > CONFIG.logInterval) rewardWindow.shift();
        if (winWindow.length > CONFIG.logInterval) winWindow.shift();
        if (useWindow.length > CONFIG.logInterval) useWindow.shift();
        if (probabilityWindow.length > CONFIG.logInterval) probabilityWindow.shift();

        if (batch.length >= CONFIG.batchSize || ep === CONFIG.episodes - 1) {
            const ppoBatch = buildPpoBatch(critic, batch);
            if (CONFIG.batchThrottleMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, CONFIG.batchThrottleMs));
            }
            const result = trainPpoEpochs(actor, critic, optimizer, ppoBatch, {
                epochs: CONFIG.ppoEpochs,
                clipRatio: CONFIG.clipRatio,
                valueCoef: CONFIG.valueCoef,
                entropyCoef: CONFIG.entropyCoef,
                miniBatchSize: CONFIG.miniBatchSize
            });
            lastLoss = result.loss;
            batch.length = 0;
        }

        if (CONFIG.throttleMs > 0 && ep < CONFIG.episodes - 1) {
            await new Promise((resolve) => setTimeout(resolve, CONFIG.throttleMs));
        }

        if (ep % CONFIG.logInterval === 0) {
            const winRate = evalWin / Math.max(1, evalTotal);
            const windowWinRate = winWindow.reduce((sum, value) => sum + value, 0) / Math.max(1, winWindow.length);
            const windowReward = rewardWindow.reduce((sum, value) => sum + value, 0) / Math.max(1, rewardWindow.length);
            const windowUseRate = useWindow.reduce((sum, value) => sum + value, 0) / Math.max(1, useWindow.length);
            const windowProbability =
                probabilityWindow.reduce((sum, value) => sum + value, 0) / Math.max(1, probabilityWindow.length);
            console.log(
                `  Ep ${ep}: wr=${(winRate * 100).toFixed(1)}% ` +
                    `win${CONFIG.logInterval}=${(windowWinRate * 100).toFixed(1)}% ` +
                    `reward${CONFIG.logInterval}=${windowReward.toFixed(3)} ` +
                    `use${CONFIG.logInterval}=${(windowUseRate * 100).toFixed(1)}% ` +
                    `prob${CONFIG.logInterval}=${(windowProbability * 100).toFixed(1)}% ` +
                    `loss=${lastLoss.toFixed(4)} ` +
                    `tensors=${tf.memory().numTensors}`
            );
        }
    }

    const winRate = evalWin / evalTotal;
    const postEval = evaluateCombo(actor, normalizer, roster, rlSpec, fixedAction);
    const evalDelta = preEval && postEval ? postEval.winRate - preEval.winRate : null;
    console.log(`  ${formatEval("eval after", postEval)}`);
    if (evalDelta != null) {
        console.log(`  eval delta: ${formatPercent(evalDelta)}`);
    }
    console.log(`  -> train win ${(winRate * 100).toFixed(1)}%, loss ${lastLoss.toFixed(4)}`);

    // ── 모델 저장 ──
    const charName = rlSpec.name ?? combo.charId;
    await saveModel(actor, normalizer, {
        charId: combo.charId,
        charName,
        actionId: combo.actionId,
        actionName: fixedAction.name,
        trainWinRate: winRate
    });

    actor.dispose();
    critic.dispose();
    optimizer.dispose?.();
    return {
        charId: combo.charId,
        actionId: combo.actionId,
        winRate,
        loss: lastLoss,
        preEvalWinRate: preEval?.winRate ?? null,
        postEvalWinRate: postEval?.winRate ?? null,
        evalDelta
    };
}

async function main() {
    // CPU 코어 제한 (Eigen 백엔드가 초기화 전에 읽어야 함)
    if (CONFIG.cpuThreads > 0) {
        process.env.OMP_NUM_THREADS = String(CONFIG.cpuThreads);
        console.log(`CPU 쓰레드 제한: ${CONFIG.cpuThreads}개`);
    }
    await prepareTensorflowBackend();
    const roster = createRoster();
    const actions = getActionPool();
    const combos = buildTrainingCombos(roster, actions);
    const baseNormalizer = new RunningNormalizer(CONFIG.inputDim);
    const results = [];

    console.log(
        `학습 조합 ${combos.length}개: 캐릭터 ${new Set(combos.map((combo) => combo.charId)).size}개 × ` +
            `액션 ${new Set(combos.map((combo) => combo.actionId)).size}개, opponentMode=${CONFIG.opponentMode}`
    );
    initNormalizer(baseNormalizer, roster);

    for (let i = 0; i < combos.length; i++) {
        results.push(await trainCombo(roster, combos[i], baseNormalizer, i + 1, combos.length));
    }

    // ── 리포트 저장 ──
    const report = {
        startedAt: new Date().toISOString(),
        config: {
            episodes: CONFIG.episodes,
            lr: CONFIG.lr,
            gamma: CONFIG.gamma,
            hiddenDim: CONFIG.hiddenDim,
            opponentMode: CONFIG.opponentMode
        },
        summary: {
            totalCombos: results.length,
            avgWinRate: results.reduce((s, r) => s + r.winRate, 0) / Math.max(1, results.length)
        },
        combos: results.map((r) => ({
            charId: r.charId,
            actionId: r.actionId,
            trainWinRate: r.winRate,
            evalDelta: r.evalDelta
        }))
    };
    const reportPath = `scripts/rl/report_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
    console.log(`\n리포트 저장: ${reportPath}`);
}

const HELP = `
PPO 학습 실행기
===============
node scripts/rl/train.mjs [--help]

환경변수:
  RL_CHARACTERS=id1,...    캐릭터 (기본: all)
  RL_ACTIONS=id1,...       액션 (기본: all)
  RL_EPISODES=1500         조합당 에피소드
  RL_OPPONENT_MODE=random  상대 모드
  RL_HIDDEN_DIM=16         은닉층 크기
  RL_BATCH_SIZE=64         배치 크기
  RL_LR=0.0003             학습률
  RL_THROTTLE_MS=0         에피소드 간 대기 (ms)
  RL_BATCH_THROTTLE_MS=0   배치 학습 간 대기 (ms, 소음↓)
  RL_CPU_THREADS=0         CPU 코어 제한 (1~4, 0=전체, 발열↓)
  RL_BUILTIN_AI_ACTIONS=0  기존 AIActionController 호출 여부 (기본: 0)
  RL_ACTION_PENALTY=0      스팸 패널티 (0=액션별 자동)
  RL_HP_WEIGHT=0           공격 가중치 (0=액션별 자동)
  RL_SURVIVAL_WEIGHT=0     방어 가중치 (0=액션별 자동)

액션별 기본값:
  공격형(shockwave):        hp=0.5 surv=0.1 pen=0.02
  방어형(evade/counter):    hp=0.1 surv=0.5 pen=0.01
  유틸(rush/time_warp):     hp=0.2 surv=0.2 pen=0.02

예시:
  # 액션별 자동 가중치 (권장)
  node scripts/rl/train.mjs

  # 전체 override
  $env:RL_HP_WEIGHT=0.5; $env:RL_SURVIVAL_WEIGHT=0.1; node scripts/rl/train.mjs

  # 방어형 (회피/카운터 특화)
  $env:RL_HP_WEIGHT=0.1; $env:RL_SURVIVAL_WEIGHT=0.4; node scripts/rl/train.mjs

  # 균형
  node scripts/rl/train.mjs
`;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(HELP);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
