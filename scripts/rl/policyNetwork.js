// scripts/rl/policyNetwork.js - TensorFlow.js PPO Actor-Critic utilities
import * as tf from "@tensorflow/tfjs";

const EPSILON = 1e-7;

export async function prepareTensorflowBackend(backend = "cpu") {
    await tf.setBackend(backend);
    await tf.ready();
}

export function createActorNetwork(inputDim = 16, hiddenDim = 48) {
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: hiddenDim, inputShape: [inputDim], activation: "relu" }));
    model.add(tf.layers.dense({ units: hiddenDim, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
    return model;
}

export function createCriticNetwork(inputDim = 16, hiddenDim = 48) {
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: hiddenDim, inputShape: [inputDim], activation: "relu" }));
    model.add(tf.layers.dense({ units: hiddenDim, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1 }));
    return model;
}

export function createActorCriticNetworks(inputDim = 16, hiddenDim = 48) {
    return {
        actor: createActorNetwork(inputDim, hiddenDim),
        critic: createCriticNetwork(inputDim, hiddenDim)
    };
}

export function bernoulliLogProb(action, probability) {
    const p = Math.min(1 - EPSILON, Math.max(EPSILON, probability));
    return action === 1 ? Math.log(p) : Math.log(1 - p);
}

export function sampleAction(actor, obs, rng = Math.random) {
    const input = tf.tensor2d([obs]);
    const output = actor.predict(input);
    const probability = output.dataSync()[0];
    input.dispose();
    output.dispose();

    const action = rng() < probability ? 1 : 0;
    return {
        action,
        probability,
        logProb: bernoulliLogProb(action, probability)
    };
}

export function predictValues(critic, obsBatch) {
    if (obsBatch.length === 0) return [];
    const input = tf.tensor2d(obsBatch);
    const output = critic.predict(input);
    const values = Array.from(output.dataSync());
    input.dispose();
    output.dispose();
    return values;
}

function tensor2dColumn(values) {
    return tf.tensor2d(values, [values.length, 1]);
}

function createBatchTensors(batch) {
    return {
        obs: tf.tensor2d(batch.obs),
        actions: tensor2dColumn(batch.actions),
        oldLogProbs: tensor2dColumn(batch.oldLogProbs),
        returns: tensor2dColumn(batch.returns),
        advantages: tensor2dColumn(batch.advantages),
        weights: tensor2dColumn(batch.weights)
    };
}

function disposeBatchTensors(tensors) {
    for (const tensor of Object.values(tensors)) {
        tensor.dispose();
    }
}

function binaryLogProbTensor(actions, probabilities) {
    const probs = tf.clipByValue(probabilities, EPSILON, 1 - EPSILON);
    return tf.add(tf.mul(actions, tf.log(probs)), tf.mul(tf.sub(1, actions), tf.log(tf.sub(1, probs))));
}

function ppoLoss(actor, critic, tensors, config) {
    const probabilities = actor.apply(tensors.obs, { training: true });
    const values = critic.apply(tensors.obs, { training: true });
    const newLogProbs = binaryLogProbTensor(tensors.actions, probabilities);
    const ratios = tf.exp(tf.sub(newLogProbs, tensors.oldLogProbs));
    const weightedAdvantages = tf.mul(tensors.advantages, tensors.weights);
    const unclipped = tf.mul(ratios, weightedAdvantages);
    const clippedRatios = tf.clipByValue(ratios, 1 - config.clipRatio, 1 + config.clipRatio);
    const clipped = tf.mul(clippedRatios, weightedAdvantages);
    const actorLoss = tf.neg(tf.mean(tf.minimum(unclipped, clipped)));

    const valueLoss = tf.mean(tf.square(tf.sub(tensors.returns, values)));
    const entropy = tf.neg(
        tf.mean(
            tf.add(
                tf.mul(probabilities, tf.log(tf.clipByValue(probabilities, EPSILON, 1 - EPSILON))),
                tf.mul(tf.sub(1, probabilities), tf.log(tf.clipByValue(tf.sub(1, probabilities), EPSILON, 1)))
            )
        )
    );

    return tf.sub(tf.add(actorLoss, tf.mul(config.valueCoef, valueLoss)), tf.mul(config.entropyCoef, entropy));
}

export function trainPpoEpochs(actor, critic, optimizer, batch, options = {}) {
    if (batch.obs.length === 0) {
        return { loss: 0, samples: 0 };
    }

    const config = {
        epochs: options.epochs ?? 3,
        clipRatio: options.clipRatio ?? 0.2,
        valueCoef: options.valueCoef ?? 0.5,
        entropyCoef: options.entropyCoef ?? 0.01
    };
    const tensors = createBatchTensors(batch);
    let loss = 0;

    for (let i = 0; i < config.epochs; i++) {
        const cost = optimizer.minimize(() => ppoLoss(actor, critic, tensors, config), true);
        loss = cost.dataSync()[0];
        cost.dispose();
    }

    disposeBatchTensors(tensors);
    return { loss, samples: batch.obs.length };
}
