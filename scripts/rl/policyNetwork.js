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

function shuffledIndices(size) {
    const indices = Array.from({ length: size }, (_, index) => index);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
}

function sliceBatch(batch, indices) {
    return {
        obs: indices.map((index) => batch.obs[index]),
        actions: indices.map((index) => batch.actions[index]),
        oldLogProbs: indices.map((index) => batch.oldLogProbs[index]),
        returns: indices.map((index) => batch.returns[index]),
        advantages: indices.map((index) => batch.advantages[index]),
        weights: indices.map((index) => batch.weights[index])
    };
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
        entropyCoef: options.entropyCoef ?? 0.01,
        miniBatchSize: Math.max(1, Math.floor(options.miniBatchSize ?? batch.obs.length))
    };
    let lossTotal = 0;
    let updateCount = 0;

    for (let i = 0; i < config.epochs; i++) {
        const indices = shuffledIndices(batch.obs.length);
        for (let start = 0; start < indices.length; start += config.miniBatchSize) {
            const miniBatch = sliceBatch(batch, indices.slice(start, start + config.miniBatchSize));
            const tensors = createBatchTensors(miniBatch);
            const cost = optimizer.minimize(() => ppoLoss(actor, critic, tensors, config), true);
            lossTotal += cost.dataSync()[0];
            updateCount++;
            cost.dispose();
            disposeBatchTensors(tensors);
        }
    }

    return { loss: updateCount > 0 ? lossTotal / updateCount : 0, samples: batch.obs.length };
}
