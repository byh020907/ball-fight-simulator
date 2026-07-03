// src/ai/rlPolicy.js — 학습된 RL 모델을 게임에서 로드 & 추론
import { extractFeatures } from "../../scripts/rl/features.js";

// 브라우저: window.tf (index.html <script> 태그), Node.js: import 해야 함
let _tf;
function getTf() {
    if (_tf) return _tf;
    if (typeof window !== "undefined" && window.tf) {
        _tf = window.tf;
    }
    // Node.js 환경이면 호출 전에 setTf()로 주입해야 함
    if (!_tf) throw new Error("TF.js not available. Call setTf(tf) before using RLPolicy.");
    return _tf;
}

/** Node.js 환경에서 tf 모듈 주입 (브라우저는 window.tf 자동 감지) */
export function setTf(tfModule) {
    _tf = tfModule;
}

/** base64 문자열 → ArrayBuffer (Node.js + 브라우저 호환) */
function base64ToArrayBuffer(base64) {
    // Node.js: Buffer가 더 관대함 (개행 문자 등 처리)
    if (typeof Buffer !== "undefined") {
        return new Uint8Array(Buffer.from(base64, "base64")).buffer;
    }
    // 브라우저: atob 사용 (개행 제거 후)
    const binary = atob(base64.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * 학습 완료된 mean/std로 정규화만 수행 (online update 없음).
 *
 * [왜 필요한가]
 * extractFeatures의 출력은 [-1,1] 범위지만 피처별 분포가 불균등하다.
 * 예: hpRatio는 평균 0.65, velocity.y는 평균 0.01 근처에서만 논다.
 * 그냥 넣으면 NN이 변화폭 큰 hpRatio만 보고 학습하고, 작은 피처는 무시한다.
 * 정규화로 모든 피처를 평균 0±std 1 로 맞춰야 동등한 비중으로 학습된다.
 *
 * [왜 학습한 mean/std를 저장해야 하는가]
 * NN은 학습 당시의 mean/std에 맞춰 가중치를 튜닝했다.
 * 추론 시 다른 mean/std로 정규화하면 완전히 왜곡된 입력이 되어 엉뚱한 확률이 나온다.
 * → 모델 저장 시 normalizer.mean / normalizer.std 도 함께 저장하고,
 *   게임에서는 이 클래스로 읽기 전용 복원하여 사용한다.
 */
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
        const tf = getTf();
        // base64 → ArrayBuffer 복원 (TF.js 표준 형식)
        const weightData = base64ToArrayBuffer(modelJson.weightData);
        const artifacts = {
            modelTopology: modelJson.modelTopology,
            weightSpecs: modelJson.weightSpecs,
            weightData
        };
        const actor = await tf.loadLayersModel(tf.io.fromMemory(artifacts));
        const norm = new StaticNormalizer(modelJson.normalizer.mean, modelJson.normalizer.std);
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
        const tf = getTf();
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
