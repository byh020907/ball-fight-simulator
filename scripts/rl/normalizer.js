// scripts/rl/normalizer.js — Running Mean/Std (Welford)
export class RunningNormalizer {
    constructor(shape = 24) {
        this.n = 0;
        this.mean = new Array(shape).fill(0);
        this.M2 = new Array(shape).fill(0);
    }
    update(obs) {
        this.n++;
        for (let i = 0; i < obs.length; i++) {
            const delta = obs[i] - this.mean[i];
            this.mean[i] += delta / this.n;
            this.M2[i] += delta * (obs[i] - this.mean[i]);
        }
    }
    normalize(obs) {
        const r = new Array(obs.length);
        for (let i = 0; i < obs.length; i++) {
            const std = this.n > 1 ? Math.sqrt(this.M2[i] / (this.n - 1)) : 1;
            r[i] = std > 1e-6 ? (obs[i] - this.mean[i]) / std : 0;
        }
        return r;
    }

    clone() {
        const next = new RunningNormalizer(this.mean.length);
        next.n = this.n;
        next.mean = [...this.mean];
        next.M2 = [...this.M2];
        return next;
    }
}
