import { Vector2 } from "../core.js";
import { createCombatEquipmentSet } from "../hunting/equipmentRuntime.js";
import { getEquipmentTemplate } from "../hunting/equipmentTemplates.js";

const PREVIEW_CONFIG = Object.freeze({
    width: 640,
    height: 360,
    owner: Object.freeze({ x: 250, y: 180, radius: 28 }),
    target: Object.freeze({ x: 390, y: 180, radius: 30 }),
    maximumPixelRatio: 2,
    maximumFrameDelta: 1 / 20,
    triggerDelay: 0.28,
    repeatAfter: 1.9
});

const PREVIEW_IDS = Object.freeze([
    "completed_ability_crit",
    "completed_pursuit_flurry",
    "completed_mass_execution",
    "completed_vital_heat",
    "completed_defense_conversion",
    "completed_mass_shockwave",
    "completed_wall_ricochet",
    "completed_wall_heat",
    "completed_speed_angular",
    "completed_ability_echo",
    "completed_vortex_charge",
    "completed_vital_overwhelm"
]);

const DESCRIPTIONS = Object.freeze({
    completed_ability_crit: "능력 사용 뒤 충돌한 지점에서 금빛 예고와 흰 중심 폭발을 재생합니다.",
    completed_pursuit_flurry: "첫 충돌 뒤 재충돌한 지점에서 좌우 초승달이 시간차로 교차합니다.",
    completed_mass_execution: "저체력 대상의 치명 충돌 지점에 수직 참격과 지면 파동을 재생합니다.",
    completed_vital_heat: "소유자 중심에서 실제 4틱 열기 맥동을 0.8초 동안 재생합니다.",
    completed_defense_conversion: "직접 충돌 순간 진행 방향으로 작은 붉은 쌍 송곳니가 번뜩입니다.",
    completed_mass_shockwave: "치명 충돌 지점에서 황갈색 충격파와 먼지가 반경 180으로 퍼집니다.",
    completed_wall_ricochet: "벽 반사 충전을 소비한 충돌 지점에 진행 방향 초승달을 재생합니다.",
    completed_wall_heat: "벽 열기를 소비해 소유자 중심에서 반경 260 단발 열기 링을 재생합니다.",
    completed_speed_angular: "직접 충돌 지점에 작고 낮은 밀도의 청록 나선 참격을 재생합니다.",
    completed_ability_echo: "능력 충전 소비 0.12초 뒤 대상 위치에 반투명 이중 파동을 재생합니다.",
    completed_vortex_charge: "이동 거리 1,200px 충전 뒤 충돌 지점에 큰 회전 링과 바람 입자를 재생합니다.",
    completed_vital_overwhelm: "현재 생명력 비율을 밝기와 크기에 반영한 적룡 뿔과 충격파를 재생합니다."
});

export const EQUIPMENT_PASSIVE_VFX_PREVIEW_OPTIONS = Object.freeze(
    PREVIEW_IDS.map((id) => {
        const template = getEquipmentTemplate(id);
        return Object.freeze({ id, label: template.name, description: DESCRIPTIONS[id] });
    })
);

function getPreviewOption(previewId) {
    return (
        EQUIPMENT_PASSIVE_VFX_PREVIEW_OPTIONS.find((option) => option.id === previewId) ??
        EQUIPMENT_PASSIVE_VFX_PREVIEW_OPTIONS[0]
    );
}

function createOwner() {
    const owner = {
        id: "equipment-preview-owner",
        position: new Vector2(PREVIEW_CONFIG.owner.x, PREVIEW_CONFIG.owner.y),
        velocity: new Vector2(180, -35),
        radius: PREVIEW_CONFIG.owner.radius,
        hp: 900,
        maxHp: 1000,
        flags: { defeated: false },
        state: {},
        getTotalAttackDamage: () => 100,
        getEquipmentCombatStats: () => ({
            hp: 400,
            defense: 96,
            criticalChance: 45.5,
            speed: { increaseRatio: 0.5 },
            mass: { effectiveBonus: 0.35 },
            wallBounce: { effectiveBonus: 0.35 },
            angularImpulse: { effectiveBonus: 0.35 }
        })
    };
    return owner;
}

function createTarget() {
    return {
        id: "equipment-preview-target",
        position: new Vector2(PREVIEW_CONFIG.target.x, PREVIEW_CONFIG.target.y),
        velocity: new Vector2(),
        radius: PREVIEW_CONFIG.target.radius,
        hp: 1000,
        maxHp: 1000,
        flags: { defeated: false, destroyed: false },
        state: {},
        takeDamage(amount) {
            return { actualDamage: Math.max(1, Number(amount) || 0), absorbedDamage: 0, isCritical: false };
        }
    };
}

function drawFighter(ctx, fighter, fill, label) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = "#202020";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(fighter.position.x, fighter.position.y, fighter.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#202020";
    ctx.font = "700 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, fighter.position.x, fighter.position.y + fighter.radius + 22);
    ctx.restore();
}

export class EquipmentPassiveVfxPreviewScene {
    constructor(previewId = PREVIEW_IDS[0]) {
        this.setPreview(previewId);
    }

    setPreview(previewId) {
        this.option = getPreviewOption(previewId);
        this.replay();
    }

    replay() {
        this.elapsed = 0;
        this.triggered = false;
        this.owner = createOwner();
        this.target = createTarget();
        this.simulation = {
            elapsed: 0,
            entities: [],
            getEnemiesOf: () => [this.target],
            isHostile: (owner, target) => owner === this.owner && target === this.target
        };
        this.owner.combatEquipment = createCombatEquipmentSet(this.owner, [this.option.id]);
        return true;
    }

    update(delta) {
        const elapsed = Math.min(PREVIEW_CONFIG.maximumFrameDelta, Math.max(0, Number(delta) || 0));
        this.elapsed += elapsed;
        this.simulation.elapsed += elapsed;
        if (!this.triggered && this.elapsed >= PREVIEW_CONFIG.triggerDelay) {
            this.triggered = true;
            this._triggerRuntime();
        }
        this.owner.combatEquipment.update(elapsed, { simulation: this.simulation });
        for (const entity of this.simulation.entities) entity.update?.(elapsed, this.simulation);
        this.simulation.entities = this.simulation.entities.filter((entity) => !entity.isExpired);
        if (this.elapsed >= PREVIEW_CONFIG.repeatAfter) this.replay();
    }

    _collision(overrides = {}) {
        this.owner.combatEquipment.enemyCollisionResolved({
            target: this.target,
            contactPoint: this.target.position.clone(),
            simulation: this.simulation,
            actualDamage: 25,
            targetHpRatioBefore: 0.3,
            isCritical: false,
            damage: { origin: "collision" },
            ...overrides
        });
    }

    _triggerRuntime() {
        const equipment = this.owner.combatEquipment;
        if (this.option.id === "completed_ability_crit") {
            equipment.abilityUsed({ simulation: this.simulation });
            this._collision();
        } else if (this.option.id === "completed_pursuit_flurry") {
            this._collision();
            this._collision();
        } else if (this.option.id === "completed_mass_execution") {
            this._collision({ isCritical: true, targetHpRatioBefore: 0.3 });
        } else if (this.option.id === "completed_defense_conversion") {
            this._collision();
        } else if (this.option.id === "completed_mass_shockwave") {
            this._collision({ isCritical: true });
        } else if (this.option.id === "completed_wall_ricochet") {
            equipment.staticBounce({ simulation: this.simulation });
            this._collision();
        } else if (this.option.id === "completed_wall_heat") {
            equipment.staticBounce({ simulation: this.simulation });
        } else if (this.option.id === "completed_speed_angular") {
            this._collision();
        } else if (this.option.id === "completed_ability_echo") {
            equipment.abilityUsed({ simulation: this.simulation });
            this._collision();
        } else if (this.option.id === "completed_vortex_charge") {
            equipment.validMovement({ distance: 1200, source: "physics", simulation: this.simulation });
            this._collision();
        } else if (this.option.id === "completed_vital_overwhelm") {
            this._collision();
        }
    }

    draw(ctx) {
        ctx.fillStyle = "#e6e4df";
        ctx.fillRect(0, 0, PREVIEW_CONFIG.width, PREVIEW_CONFIG.height);
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, PREVIEW_CONFIG.width - 4, PREVIEW_CONFIG.height - 4);
        drawFighter(ctx, this.owner, "#72c8d6", "장착자");
        drawFighter(ctx, this.target, "#db846f", "대상");
        for (const entity of this.simulation.entities) entity.draw?.(ctx);
    }
}

export class EquipmentPassiveVfxPreviewController {
    constructor({
        requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
        cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
        ResizeObserverClass = globalThis.ResizeObserver
    } = {}) {
        this.requestFrame = requestFrame;
        this.cancelFrame = cancelFrame;
        this.ResizeObserverClass = ResizeObserverClass;
    }

    start(canvas, previewId) {
        if (!canvas?.getContext || !this.requestFrame) return { ok: false, error: "preview_unavailable" };
        this.stop();
        this.canvas = canvas;
        this.scene = new EquipmentPassiveVfxPreviewScene(previewId);
        this.resizeObserver = this.ResizeObserverClass ? new this.ResizeObserverClass(() => this._resize()) : null;
        this.resizeObserver?.observe(canvas);
        this._resize();
        this.frameId = this.requestFrame((time) => this._renderFrame(time));
        return { ok: true };
    }

    replay() {
        if (!this.scene) return { ok: false, error: "preview_unavailable" };
        this.scene.replay();
        return { ok: true };
    }

    stop() {
        if (this.frameId !== undefined && this.frameId !== null) this.cancelFrame?.(this.frameId);
        this.resizeObserver?.disconnect();
        this.frameId = null;
        this.lastFrameTime = null;
        this.canvas = null;
        this.scene = null;
        this.resizeObserver = null;
        return { ok: true };
    }

    _resize() {
        if (!this.canvas) return;
        const bounds = this.canvas.getBoundingClientRect();
        const pixelRatio = Math.min(PREVIEW_CONFIG.maximumPixelRatio, globalThis.devicePixelRatio || 1);
        const width = Math.max(1, Math.round(bounds.width * pixelRatio));
        const height = Math.max(1, Math.round(bounds.height * pixelRatio));
        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;
    }

    _renderFrame(time) {
        if (!this.canvas || !this.scene) return;
        const delta = this.lastFrameTime === null ? 0 : (time - this.lastFrameTime) / 1000;
        this.lastFrameTime = time;
        this.scene.update(delta);
        const context = this.canvas.getContext("2d");
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const scale = Math.min(this.canvas.width / PREVIEW_CONFIG.width, this.canvas.height / PREVIEW_CONFIG.height);
        const offsetX = (this.canvas.width - PREVIEW_CONFIG.width * scale) / 2;
        const offsetY = (this.canvas.height - PREVIEW_CONFIG.height * scale) / 2;
        context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
        this.scene.draw(context);
        this.frameId = this.requestFrame((nextTime) => this._renderFrame(nextTime));
    }
}

export function getEquipmentPassiveVfxPreviewOptions() {
    return EQUIPMENT_PASSIVE_VFX_PREVIEW_OPTIONS.map(({ id, label, description }) => ({ id, label, description }));
}
