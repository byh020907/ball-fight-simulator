export class AudioEngine {
    constructor() {
        this.context = null;
        this.enabled = true;
        this.lastPlayed = new Map();
    }

    unlock() {
        if (!this.enabled) {
            return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            this.enabled = false;
            return;
        }

        if (!this.context) {
            this.context = new AudioContextClass();
        }

        if (this.context.state === "suspended") {
            this.context.resume();
        }
    }

    play(type, intensity = 1) {
        if (!this.enabled) {
            return;
        }

        this.unlock();
        if (!this.context) {
            return;
        }

        const now = this.context.currentTime;
        const throttleKey = type;
        const last = this.lastPlayed.get(throttleKey) ?? -1;
        const throttle = type === "hit" || type === "crash" ? 0.055 : 0.025;
        if (now - last < throttle) {
            return;
        }
        this.lastPlayed.set(throttleKey, now);

        const safeIntensity = Number.isFinite(intensity) ? Math.max(0.45, Math.min(1.8, intensity)) : 0.45;
        const voices = {
            crash: () => this.playThud(96, 0.16, 0.13 * safeIntensity),
            hit: () => this.playZap(420, 0.08, 0.055 * safeIntensity),
            orbit: () => this.playZap(760, 0.12, 0.05 * safeIntensity),
            charge: () => this.playSweep(320, 920, 0.2, 0.04 * safeIntensity),
            chomp: () => {
                this.playThud(130, 0.12, 0.12 * safeIntensity);
                this.playZap(180, 0.07, 0.045 * safeIntensity);
            },
            dash: () => this.playSweep(180, 620, 0.15, 0.045 * safeIntensity),
            spit: () => this.playSweep(120, 520, 0.18, 0.055 * safeIntensity),
            shoot: () => this.playZap(520, 0.1, 0.052 * safeIntensity),
            seed: () => {
                this.playZap(360, 0.075, 0.035 * safeIntensity);
                this.playZap(520, 0.09, 0.025 * safeIntensity);
            },
            toss: () => this.playSweep(240, 120, 0.18, 0.04 * safeIntensity),
            rage: () => {
                this.playThud(72, 0.22, 0.1 * safeIntensity);
                this.playNoiseBurst(0.18, 0.055 * safeIntensity);
            },
            wall: () => this.playThud(116, 0.1, 0.08 * safeIntensity),
            explosion: () => this.playNoiseBurst(0.38, 0.16 * safeIntensity),
            ko: () => {
                this.playNoiseBurst(0.58, 0.22 * safeIntensity);
                this.playThud(58, 0.34, 0.18 * safeIntensity);
            },
            start: () => this.playSweep(260, 760, 0.22, 0.045),
            overtime: () => this.playSweep(620, 180, 0.28, 0.055),
            arrow: () => this.playZap(640, 0.08, 0.05 * safeIntensity),
            counter: () => this.playZap(880, 0.1, 0.07 * safeIntensity),
            projectile_guard: () => this.playZap(1100, 0.12, 0.06 * safeIntensity),
            guard: () => this.playThud(320, 0.08, 0.05 * safeIntensity),
            whiff: () => this.playThud(180, 0.04, 0.025 * safeIntensity),
            shop_reroll: () => this.playShopReroll(safeIntensity)
        };

        voices[type]?.();
    }

    createGain(volume, duration) {
        const safeVol = Number.isFinite(volume) ? Math.max(0.0001, volume) : 0.0001;
        const gain = this.context.createGain();
        const now = this.context.currentTime;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(safeVol, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        gain.connect(this.context.destination);
        return gain;
    }

    playThud(frequency, duration, volume) {
        const oscillator = this.context.createOscillator();
        const gain = this.createGain(volume, duration);
        const now = this.context.currentTime;
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(28, frequency * 0.46), now + duration);
        oscillator.connect(gain);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
    }

    playZap(frequency, duration, volume) {
        const oscillator = this.context.createOscillator();
        const gain = this.createGain(volume, duration);
        const now = this.context.currentTime;
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.8, now + duration);
        oscillator.connect(gain);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
    }

    playSweep(from, to, duration, volume) {
        const oscillator = this.context.createOscillator();
        const gain = this.createGain(volume, duration);
        const now = this.context.currentTime;
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(from, now);
        oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
        oscillator.connect(gain);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
    }

    playNoiseBurst(duration, volume) {
        const sampleRate = this.context.sampleRate;
        const buffer = this.context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
        const data = buffer.getChannelData(0);
        for (let index = 0; index < data.length; index += 1) {
            const fade = 1 - index / data.length;
            data[index] = (Math.random() * 2 - 1) * fade * fade;
        }

        const source = this.context.createBufferSource();
        const gain = this.createGain(volume, duration);
        source.buffer = buffer;
        source.connect(gain);
        source.start(this.context.currentTime);
    }

    playShopReroll(intensity) {
        const now = this.context.currentTime;
        const notes = [
            { frequency: 420, startOffset: 0, duration: 0.1 },
            { frequency: 580, startOffset: 0.11, duration: 0.1 },
            { frequency: 820, startOffset: 0.23, duration: 0.16 }
        ];

        for (const note of notes) {
            const oscillator = this.context.createOscillator();
            const gain = this.context.createGain();
            const startAt = now + note.startOffset;
            const volume = 0.045 * intensity;
            gain.gain.setValueAtTime(0.0001, startAt);
            gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, startAt + note.duration);
            oscillator.type = "triangle";
            oscillator.frequency.setValueAtTime(note.frequency, startAt);
            oscillator.frequency.exponentialRampToValueAtTime(note.frequency * 1.2, startAt + note.duration);
            oscillator.connect(gain);
            gain.connect(this.context.destination);
            oscillator.start(startAt);
            oscillator.stop(startAt + note.duration + 0.02);
        }
    }
}
