// scripts/rl/train.mjs - 캐릭터/액션 조합별 PPO 학습
import * as tf from "@tensorflow/tfjs";
import { createRoster } from "../../src/roster.js";
import { applyStatAllocation, createEmptyStatAllocation } from "../../src/statAllocation.js";
import { BattleSimulation } from "../../src/simulation/battleSimulation.js";
import { AIActionController } from "../../src/simulation/aiActionController.js";
import { findActionById } from "../../src/clickActions.js";
import {
    createActorCriticNetworks,
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

const CONFIG = {
    episodes: readNumberEnv("RL_EPISODES", 1500),
    lr: readNumberEnv("RL_LR", 3e-4),
    gamma: readNumberEnv("RL_GAMMA", 0.97),
    batchSize: readNumberEnv("RL_BATCH_SIZE", 64),
    miniBatchSize: readNumberEnv("RL_MINI_BATCH_SIZE", 128),
    ppoEpochs: readNumberEnv("RL_PPO_EPOCHS", 3),
    clipRatio: readNumberEnv("RL_CLIP_RATIO", 0.2),
    valueCoef: readNumberEnv("RL_VALUE_COEF", 0.5),
    entropyCoef: readNumberEnv("RL_ENTROPY_COEF", 0.01),
    minDecisionFrames: readNumberEnv("RL_MIN_DECISION_FRAMES", 30),
    maxEpisodeSeconds: readNumberEnv("RL_MAX_EPISODE_SECONDS", 35),
    logInterval: readNumberEnv("RL_LOG_INTERVAL", 100),
    inputDim: FEATURE_DIM,
    hiddenDim: readNumberEnv("RL_HIDDEN_DIM", 16),
    combos: [
        { charId: "dash", actionId: "rush" },
        { charId: "archer", actionId: "time_warp" },
        { charId: "eater", actionId: "life_steal" }
    ],
    fixedOpponent: process.env.RL_FIXED_OPPONENT ?? "rage"
};

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
    for (let i = 0; i < 1000; i++) {
        const a = roster[Math.floor(Math.random() * roster.length)];
        const b = pickRandom(roster, a.id);
        const sim = createTrainingSimulation(a, b);
        sim.fighters[0].aiController = new AIActionController();
        sim.fighters[0].aiController.selectAction(sim, sim.fighters[0]);
        for (let j = 0; j < 30; j++) {
            sim.update(1 / 60, 1 / 60);
            if (sim.fighters.length >= 2) {
                normalizer.update(extractFeatures(sim.fighters[0], sim.fighters[1], sim));
            }
        }
    }
}

function canConsiderAction(sim, fighter, action, lastDecisionFrame) {
    const frame = Math.floor((sim.elapsed ?? 0) * 60);
    if (frame - lastDecisionFrame < CONFIG.minDecisionFrames) return false;
    if (action.getFailureReason?.(sim, fighter) != null) return false;

    const cost = Math.ceil((fighter.maxHp * action.hpCostPercent) / 100);
    const hpAfterCost = (fighter.hp - cost) / fighter.maxHp;
    return hpAfterCost >= 0.3;
}

function runEpisode({ actor, normalizer, rlSpec, opponentSpec, fixedAction }) {
    const sim = createTrainingSimulation(rlSpec, opponentSpec);
    const fighter = sim.fighters[0];
    fighter.aiController = new AIActionController();
    fighter.aiController._chosenAction = fixedAction;
    fighter.clickActionName = fixedAction.name;

    const trajectory = [];
    let actionUseCount = 0;
    let probabilitySum = 0;
    let lastDecisionFrame = -CONFIG.minDecisionFrames;

    while (!sim.finished && sim.elapsed < CONFIG.maxEpisodeSeconds) {
        sim.update(1 / 60, 1 / 60);
        const opponent = sim.getOpponent(fighter);
        if (!opponent) break;
        if (!canConsiderAction(sim, fighter, fixedAction, lastDecisionFrame)) continue;

        const rawObs = extractFeatures(fighter, opponent, sim);
        normalizer.update(rawObs);
        const obs = normalizer.normalize(rawObs);
        const decision = sampleAction(actor, obs);
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
            const cost = Math.ceil((fighter.maxHp * fixedAction.hpCostPercent) / 100);
            const paid = fighter.actionContext.spendHpForAction(fighter, cost);
            if (paid > 0) sim.scheduleAction(fixedAction, fighter, paid);
        }
    }

    const won = sim.winner && sim.winner.id === fighter.id;
    const reward = won ? 1.0 : -1.0;
    return {
        trajectory,
        reward,
        won,
        actionUseRate: trajectory.length > 0 ? actionUseCount / trajectory.length : 0,
        actionProbability: trajectory.length > 0 ? probabilitySum / trajectory.length : 0
    };
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

async function trainCombo(roster, charId, actionId) {
    const { actor, critic } = createActorCriticNetworks(CONFIG.inputDim, CONFIG.hiddenDim);
    const optimizer = tf.train.adam(CONFIG.lr);
    const normalizer = new RunningNormalizer(CONFIG.inputDim);
    let evalWin = 0;
    let evalTotal = 0;
    let lastLoss = 0;
    const rewardWindow = [];
    const winWindow = [];
    const useWindow = [];
    const probabilityWindow = [];

    const rlSpec = roster.find((f) => f.id === charId);
    const fixedAction = findActionById(actionId);
    const opponentSpec = roster.find((f) => f.id === CONFIG.fixedOpponent);
    if (!rlSpec || !fixedAction || !opponentSpec) {
        throw new Error(`학습 조합을 찾을 수 없습니다: ${charId} × ${actionId}`);
    }

    console.log(`\n=== ${rlSpec.name} × ${fixedAction.name} vs ${opponentSpec.name} ===`);
    initNormalizer(normalizer, roster);

    const batch = [];
    for (let ep = 0; ep < CONFIG.episodes; ep++) {
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
    console.log(`  -> 승률 ${(winRate * 100).toFixed(1)}%, loss ${lastLoss.toFixed(4)}`);
    actor.dispose();
    critic.dispose();
    optimizer.dispose?.();
    return { charId, actionId, winRate, loss: lastLoss };
}

async function main() {
    await prepareTensorflowBackend();
    const roster = createRoster();
    const results = [];

    for (const { charId, actionId } of CONFIG.combos) {
        results.push(await trainCombo(roster, charId, actionId));
    }

    console.log("\n=== 조합별 결과 ===");
    for (const result of results) {
        const name = roster.find((f) => f.id === result.charId)?.name ?? result.charId;
        console.log(`  ${name} × ${result.actionId}: 승률 ${(result.winRate * 100).toFixed(1)}%`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
