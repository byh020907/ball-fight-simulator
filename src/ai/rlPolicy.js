// src/ai/rlPolicy.js — 학습된 RL 모델을 게임에서 로드 & 추론
import * as tf from "@tensorflow/tfjs";
import { extractFeatures } from "../../scripts/rl/features.js";

/** 학습 완료된 mean/std로 정규화만 수행 (online update 없음) */
class StaticNormalizer {
    constructor(mean, std) {
        this.mean = mean;
        this.std = std.map((s) => (s < 1e-6 ? 1 : s));
    }

    normalize(obs) {
        const r = new Array(obs.length);
        for (let i = 0; i < obs.length; i++) {
            r[i] = (obs[i] - this.mean[i]) / this.std[i];
        }
        return r;
    }
}

/** 단일 (캐릭터, 액션) 조합의 RL 정책 */
export class RLPolicy {
    /**
     * @param {tf.LayersModel} actor - Bernoulli 정책 네트워크
     * @param {StaticNormalizer} normalizer - 학습된 mean/std 정규화기
     * @param {object} metadata - { charId, actionId, charName, actionName, trainWinRate }
     */
    constructor(actor, normalizer, metadata) {
        this.actor = actor;
        this.normalizer = normalizer;
        this.metadata = metadata;
    }

    /**
     * 모델 JSON → RLPolicy 인스턴스
     * @param {object} modelJson - fetch("models/{action}/{char}.json").then(r => r.json())
     * @returns {Promise<RLPolicy>}
     */
    static async fromJson(modelJson) {
        const actor = await tf.loadLayersModel(tf.io.fromMemory(modelJson));
        const norm = new StaticNormalizer(
            modelJson.normalizer.mean,
            modelJson.normalizer.std
        );
        return new RLPolicy(actor, norm, {
            charId: modelJson.charId,
            charName: modelJson.charName,
            actionId: modelJson.actionId,
            actionName: modelJson.actionName,
            trainWinRate: modelJson.trainWinRate
        });
    }

    /** 현재 프레임의 액션 사용 확률 (0~1) */
    getProbability(fighter, opponent, sim) {
        const raw = extractFeatures(fighter, opponent, sim);
        const norm = this.normalizer.normalize(raw);
        return tf.tidy(() => this.actor.predict(tf.tensor2d([norm])).dataSync()[0]);
    }

    /**
     * 액션 사용 여부
     * @param {number} threshold - 이 확률 이상이면 발동 (기본 0.5)
     */
    shouldActivate(fighter, opponent, sim, threshold = 0.5) {
        return this.getProbability(fighter, opponent, sim) >= threshold;
    }
}
