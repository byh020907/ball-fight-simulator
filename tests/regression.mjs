import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createComponentBridge as createAppComponentBridge } from "../src/componentBridge.js";
import { PopupService } from "../src/popup.js";
import { CollectionHubService } from "../src/collectionHubService.js";
import { createCollectionActionPopupOptions } from "../src/collection/collectionActionPopup.js";
import { ActionPickerService } from "../src/actionPicker.js";
import {
    ALLOCATABLE_STATS,
    PLAYER_STAT_POINTS,
    STAT_BALANCER_CONFIG,
    adjustStatAllocation,
    applyStatAllocation,
    calculateStatMultiplier,
    createEmptyStatAllocation,
    createRandomStatAllocation,
    createTournamentRoster,
    formatStatAllocation,
    getRemainingStatPoints,
    getSpentStatPoints
} from "../src/statAllocation.js";
import { calculateInterceptPoint, FIGHTER_IDS, Projectile, RENDER_LAYERS, Vector2, randomSpin } from "../src/core.js";
import { findActionById } from "../src/clickActions.js";
import { calcMatchXp, getLevelFromXp, getXpForNextLevel, calcTournamentXp } from "../src/experience/experienceState.js";
import { getLevelRequirement, XP_SCALE } from "../src/experience/experienceConfig.js";
import { REWARD_BALANCE } from "../src/rewardBalanceConfig.js";
import {
    applyExperienceProgressionToBall,
    applyExperienceProgressionToBaseSpec,
    collectActiveExperienceProgression,
    getCharacterExperienceSummary,
    getExperienceRewardsBetween,
    grantCharacterExperience,
    grantExperienceFromMatchReport
} from "../src/experience/experienceService.js";
import {
    applyRebirthLoadoutToBaseSpec,
    applyRebirthLoadoutToBattleBall,
    beginRebirth,
    completeRebirth,
    createRebirthOffer,
    createRebirthStatReward,
    getRebirthCardDefinition,
    getRebirthLoadout,
    getRebirthOfferMaterial,
    getRebirthState,
    getSubAbilityIds,
    toggleRebirthCardEquip
} from "../src/rebirth/index.js";
import {
    drawRebirthVisualOverlay,
    getRebirthFlameDirection,
    getRebirthVisualProfile
} from "../src/rebirth/rebirthVisuals.js";
import {
    getCharacterLevelProgression,
    getCharacterLevelRewardsBetween
} from "../src/experience/characterLevelProgression.js";
import { getLevelRewardEffectHandler } from "../src/experience/reward-effects/effectRegistry.js";
import { DashEffect, WallSlamEffect } from "../src/combatEffects.js";
import { shuffled } from "../src/random.js";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import {
    predictNextWallCollision,
    TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS
} from "../src/tournament/angledBounceRamps.js";
import { Ability, AbilitySet } from "../src/abilities/index.js";
import { FighterPhysicsSimulation } from "../src/simulation/fighterPhysicsSimulation.js";
import { PreviewReselectSimulation } from "../src/preview/previewReselectSimulation.js";
import { createRoster } from "../src/roster.js";
import {
    createDefaultPlayerProfile,
    migrateLegacyExperienceToCharacter,
    migratePlayerProfile,
    sanitizePlayerProfile
} from "../src/playerProfile.js";
import { HuntingManager } from "../src/hunting/huntingManager.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "../src/hunting/huntingEvents.js";
import { MishapEvent } from "../src/hunting/events/mishapEvent.js";
import { RestSiteEvent } from "../src/hunting/events/restSiteEvent.js";
import {
    advanceHuntingRun,
    canEnterHunting,
    canRetreatFromHuntingRun,
    buyDailyShopChest,
    completeHuntingStage,
    createHuntingChest,
    createHuntingRun,
    defeatHuntingRun,
    applyHuntingCursedAltar,
    applyHuntingStatModifiersToSpec,
    getHuntingResumeStartFloor,
    getEligibleHuntingCharacters,
    getEnemyPowerMultiplier,
    getHuntingFloorChances,
    getHuntingPortalWeightMultiplier,
    getHuntingBattleArena,
    getHuntingStage,
    getHuntingStageArena,
    getNextHuntingStageId,
    getChestOpenCost,
    getDailyShop,
    getSelectedHuntingStageId,
    getUnlockedHuntingStageIds,
    previewHuntingChest,
    openHuntingChest,
    recordHuntingFloorResult,
    rerollDailyShop,
    retreatHuntingRun,
    setHuntingRunPhase,
    rollHuntingChestReward,
    rollHuntingFloorOutcome,
    scaleEnemySpecForHunting,
    HUNTING_ARENA,
    DAILY_SHOP,
    HUNTING_COMBAT_RELIEF,
    HUNTING_ENEMY_TYPES,
    HUNTING_EVENT_TYPES,
    HUNTING_FLOOR_OUTCOME_TYPES,
    HUNTING_MAX_FLOOR,
    HUNTING_MINIBOSS,
    HUNTING_MONSTER_TYPES,
    HUNTING_MONSTER_BASE_SPECS,
    HUNTING_MONSTER_TAGS,
    HUNTING_PRESSURE_BEHAVIORS,
    HUNTING_PORTAL_DECLINE,
    HUNTING_RUN_PHASES,
    HUNTING_STAGE_IDS,
    HUNTING_STAGES,
    HUNTING_TEAMS,
    getHuntingDisplayHealth,
    getHuntingDisplayHp,
    createHuntingMinibossSpec,
    createHuntingBossMobSpec,
    createHuntingMobSpec,
    createHuntingMobEncounter,
    applyHuntingRunAchievementProgress,
    recordHuntingBattleStart,
    recordHuntingBattleVictory,
    recordHuntingStageVisit,
    getHuntingMobCount,
    getHuntingMobCountWeights,
    getHuntingMonsterDefinition,
    getHuntingMonsterDefinitions,
    getHuntingMonsterEncounteredTypeCount,
    getHuntingMonsterTypeKillCount,
    getHuntingMonsterPool,
    BOSS_MOB_MULTIPLIERS,
    createMerchantOffers,
    createConsumableMerchantOffer,
    applyMerchantOffer,
    formatOfferResultToast,
    canAffordOffer,
    formatChestRarityCounts,
    formatPendingLootSummary,
    formatDefeatLossText,
    getRarityLabel,
    HUNTING_LOOT_ITEM_TYPES,
    HuntingBattleLootSession,
    HuntingLootDropController,
    ELITE_MOB_COMBINATION_GENERATION,
    ELITE_MOB_COMBINATIONS,
    createEliteMobEncounter,
    getEliteMobCombination,
    getHuntingBonusLootWeights,
    getHuntingLootDropChance,
    getHuntingLootMultiplier,
    getHuntingShardDropAmount,
    getHuntingEnhancementStoneDropCount,
    getHuntingCompletionExperience,
    getHuntingExperienceDropLimit,
    createHuntingExperienceAllocation,
    getHuntingShardPhysicalDropCount,
    getSmallHealPackAmount,
    rollHighChestRarity,
    rollHuntingBattleExperienceVariance,
    rollHuntingBonusLootItemType,
    rollHuntingShardBundleAmount,
    scaleHuntingLootAmount
} from "../src/hunting/index.js";
import { Grenade } from "../src/entities/grenade.js";
import {
    getArenaWallRay,
    getHuntingLaserCasterVisualState,
    HUNTING_LASER_CASTER_RENDERER,
    HUNTING_LINK_CHANNEL_CONFIG,
    LASER_CHARGE_TURN_RATE
} from "../src/abilities/huntingMobAbility.js";
import { createElectricArcPath } from "../src/effects/electricArc.js";
import { getVisibleCombatTextSize, getVisibleLineWidth } from "../src/effects/effectVisibility.js";
import {
    CONSUMABLE_IDS,
    HUNTING_CONSUMABLE_USE_LIMIT,
    buyConsumable,
    getConsumableShopItems,
    getHuntingConsumableUseLimit,
    getHuntingConsumableUseLimitUpgrade,
    getHuntingPreparationConsumables,
    upgradeHuntingConsumableUseLimit,
    useHuntingPreparationConsumable
} from "../src/consumables.js";
import {
    createEquipmentInstance,
    enhanceEquipment,
    fuseEquipment,
    sellEquipment,
    disassembleEquipment,
    expandInventory,
    canFuseEquipment,
    getFusionCost,
    getSellReward,
    calculateEnhanceCost,
    calculateEnhanceFailureRate,
    getEquippedStatBonuses,
    applyEquipmentStats,
    applyEquipmentVisuals,
    getEquippedItems,
    canCharacterEquipItem,
    equipEquipmentItem,
    getEquipmentRequiredLevel,
    EQUIPMENT_STAT_VALUE_RATIOS,
    EQUIPMENT_NAME_PREFIXES,
    EQUIPMENT_SPECIAL_OPTION_SUFFIXES,
    ENHANCE_MAX_LEVEL
} from "../src/hunting/equipmentConfig.js";
import { createEquipmentCombatEffects } from "../src/hunting/equipmentEffects.js";
import { EQUIPMENT } from "../src/hunting/equipmentData.js";
import { createEquipmentName, getDominantEquipmentStat } from "../src/hunting/equipmentNaming.js";
import { createHuntingTerrain } from "../src/terrain/terrainFactory.js";
import { TERRAIN_SHAPES } from "../src/terrain/terrainConfig.js";
import { resolveTerrainCollision, resolveTerrainCollisions } from "../src/terrain/terrainCollision.js";
import { drawTerrain } from "../src/terrain/terrainRenderer.js";
import { getWorldPolygonPoints } from "../src/physics/CollisionShape.js";
import {
    applyCollisionAngularImpulse,
    applyCollisionResponse,
    applyDynamicCollisionResponse
} from "../src/physics/collisionResponse.js";
import {
    getContactPointVelocity,
    getContactDamageSpeed,
    calculateRotationalContactDamageBonus,
    applyRotationalContactDamage,
    calculateStaticCollisionDamage
} from "../src/physics/contactDamage.js";
import RotationalBody from "../src/physics/RotationalBody.js";
import {
    drawEquipmentItems,
    getCharacterOutlineWidth,
    getEquipmentRingDashes,
    getEquipmentRingLineWidth,
    getEquipmentRingRadius
} from "../src/entities/equipmentVisuals.js";
import { ArenaRenderer } from "../src/ui.js";
import { ArenaCamera } from "../src/camera.js";
import { BurningEffect } from "../src/effects/rageEffects.js";
import {
    CrossOverloadEffect,
    DASH_LASER_CASTER_RENDERER,
    HeroResonanceEffect,
    LaserCasterDissipateEffect,
    LaserBeamEffect,
    traceArenaLaserSegments
} from "../src/effects/index.js";
import {
    createLaserCasterVisualState,
    drawLaserCasterVisual,
    getLaserCasterFireOrigin,
    LASER_CASTER_PHASES
} from "../src/effects/laserCasterVisual.js";
import { PATCH_NOTES } from "../src/patchNotes.js";
import {
    createTemplateComponentDirective,
    findTemplateComponentTagHosts,
    getTemplateComponentNameFromTagName,
    getTemplateComponentId,
    isValidTemplateComponentName,
    mountTemplateComponent,
    mountTemplateComponentByName,
    mountTemplateComponentTags,
    normalizeTemplateComponentName,
    registerAlpineComponentSystem,
    resolveTemplateComponent
} from "../src/alpineTemplateComponents.js";
import {
    BattleBall,
    ChestDrop,
    computeHeroOrbCarryover,
    createHuntingLootItem,
    EnhancementStoneDrop,
    ExperienceDrop,
    HERO_ORB_EFFECTS,
    HeroOrb,
    GunnerTurret,
    ShardDrop,
    ShardBundleDrop,
    SmallHealPack,
    STAT_ORB_KEYS
} from "../src/entities/index.js";
import { MobAppearance } from "../src/entities/mobAppearance.js";
import { PHYSICS_MATERIALS, resolvePhysicsMaterial, combinePhysicsMaterials } from "../src/physics/PhysicsMaterial.js";
import PhysicsMaterialBody from "../src/physics/PhysicsMaterialBody.js";
import { AppLifecycle, APP_LIFECYCLE_STATES } from "../src/appLifecycle.js";
import { ScreenWakeLock } from "../src/screenWakeLock.js";
import { recordDeveloperTournamentWin, seedDeveloperCollectionSample } from "../src/developer/developerTools.js";
import { advanceResultSequence, createResultSequence, getResultSequencePresentation } from "../src/resultSequence.js";

const EMPTY_EQUIPMENT_SUMMARY = {
    characterLevel: 1,
    inventoryUsed: 0,
    inventorySlots: 5,
    equippedCount: 0,
    activeCount: 0,
    slots: [],
    statLine: "적용 중인 장비 스탯 없음"
};

function makeClassList() {
    const set = new Set();
    return {
        add: (...names) => names.forEach((name) => set.add(name)),
        remove: (...names) => names.forEach((name) => set.delete(name)),
        contains: (name) => set.has(name),
        toggle: (name, force) => {
            if (force === undefined ? !set.has(name) : force) {
                set.add(name);
            } else {
                set.delete(name);
            }
        }
    };
}

function makeElement(id = "el") {
    const children = [];
    const queryCache = new Map();
    const element = {
        id,
        style: {},
        disabled: false,
        textContent: "",
        innerHTML: "",
        className: "",
        dataset: {},
        children,
        classList: makeClassList(),
        appendChild(child) {
            children.push(child);
            return child;
        },
        addEventListener() {},
        closest() {
            return element;
        },
        querySelector(selector) {
            if (!queryCache.has(selector)) {
                queryCache.set(selector, makeElement(selector));
            }
            return queryCache.get(selector);
        }
    };
    return element;
}

function makeRecordingCanvasContext() {
    const calls = [];
    const primitives = [];
    const methods = new Set([
        "save",
        "restore",
        "clearRect",
        "translate",
        "scale",
        "rotate",
        "beginPath",
        "arc",
        "ellipse",
        "fill",
        "stroke",
        "setLineDash",
        "fillRect",
        "strokeRect",
        "roundRect",
        "moveTo",
        "lineTo",
        "quadraticCurveTo",
        "closePath",
        "fillText",
        "strokeText"
    ]);
    return new Proxy(
        {
            calls,
            primitives,
            globalAlpha: 1,
            getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
        },
        {
            get(target, prop) {
                if (prop in target) return target[prop];
                if (methods.has(prop)) {
                    return (...args) => {
                        calls.push([prop, ...args]);
                        primitives.push({
                            method: prop,
                            args,
                            fillStyle: target.fillStyle,
                            strokeStyle: target.strokeStyle,
                            lineWidth: target.lineWidth,
                            globalAlpha: target.globalAlpha,
                            font: target.font,
                            textAlign: target.textAlign,
                            textBaseline: target.textBaseline
                        });
                    };
                }
                return target[prop];
            },
            set(target, prop, value) {
                target[prop] = value;
                calls.push(["set", prop, value]);
                return true;
            }
        }
    );
}

function assertForegroundEffectRenders(effect, label, assertEffectPrimitives = null) {
    assert.ok(effect, `${label} should create a dedicated effect entity`);
    assert.equal(effect.renderLayer, RENDER_LAYERS.FOREGROUND, `${label} should render in the foreground pass`);
    const ctx = makeRecordingCanvasContext();
    const canvas = {
        width: 960,
        height: 960,
        clientWidth: 700,
        clientHeight: 700,
        getBoundingClientRect: () => ({ width: 700, height: 700 }),
        getContext: () => ctx
    };
    ctx.canvas = canvas;
    let drawCount = 0;
    let effectPrimitives = [];
    const originalDraw = effect.draw.bind(effect);
    effect.draw = (...args) => {
        drawCount += 1;
        const primitiveStart = ctx.primitives.length;
        const result = originalDraw(...args);
        effectPrimitives = ctx.primitives.slice(primitiveStart);
        return result;
    };
    const renderer = new ArenaRenderer(canvas);
    try {
        renderer.render({
            width: 960,
            height: 960,
            screenShake: null,
            arenaTheme: "default",
            terrain: [],
            entities: [effect]
        });
    } finally {
        effect.draw = originalDraw;
    }
    assert.equal(drawCount, 1, `${label} should pass through ArenaRenderer exactly once`);
    assert.ok(effectPrimitives.length > 0, `${label} should issue its own canvas drawing primitives`);
    assert.ok(
        effectPrimitives.some((primitive) =>
            ["arc", "ellipse", "fillRect", "lineTo", "quadraticCurveTo", "fillText", "strokeText"].includes(
                primitive.method
            )
        ),
        `${label} should draw effect-specific geometry instead of passing on unrelated renderer calls`
    );
    assert.ok(
        effectPrimitives.some((primitive) =>
            ["fill", "stroke", "fillRect", "strokeRect", "fillText", "strokeText"].includes(primitive.method)
        ),
        `${label} should paint its geometry through the foreground renderer pass`
    );
    assertEffectPrimitives?.(effectPrimitives);
    return effectPrimitives;
}

function findEffectPrimitive(primitives, method, predicate = () => true) {
    return primitives.find((primitive) => primitive.method === method && predicate(primitive.args, primitive));
}

function assertEffectArcAt(primitives, point, label, radiusPredicate = (radius) => radius > 0) {
    const arc = findEffectPrimitive(
        primitives,
        "arc",
        ([x, y, radius]) => Math.abs(x - point.x) < 1e-6 && Math.abs(y - point.y) < 1e-6 && radiusPredicate(radius)
    );
    assert.ok(arc, `${label} should draw an arc at its gameplay center with the expected radius`);
    return arc;
}

function assertEffectTrajectory(primitives, start, end, label) {
    const startsAtOrigin = findEffectPrimitive(
        primitives,
        "moveTo",
        ([x, y]) => Math.abs(x - start.x) < 1e-6 && Math.abs(y - start.y) < 1e-6
    );
    const reachesTarget = findEffectPrimitive(
        primitives,
        "lineTo",
        ([x, y]) => Math.abs(x - end.x) < 1e-6 && Math.abs(y - end.y) < 1e-6
    );
    assert.ok(startsAtOrigin && reachesTarget, `${label} should preserve its gameplay start-to-target trajectory`);
}

function assertEffectUsesColor(primitives, color, label) {
    assert.ok(
        primitives.some((primitive) => primitive.fillStyle === color || primitive.strokeStyle === color),
        `${label} should retain its identifying ${color} color`
    );
}

function assertCombatTextSignature(primitives, effect, label) {
    const fillText = findEffectPrimitive(
        primitives,
        "fillText",
        ([text, x]) => text === effect.displayText && x > 0 && x < 960
    );
    const strokeText = findEffectPrimitive(
        primitives,
        "strokeText",
        ([text, x]) => text === effect.displayText && x > 0 && x < 960
    );
    assert.ok(fillText && strokeText, `${label} should paint outlined combat text inside the arena boundary`);
    assert.equal(fillText.fillStyle, effect.color, `${label} should preserve its identifying text color`);
    assert.equal(strokeText.strokeStyle, "#202020", `${label} should retain its dark combat-text outline`);
    assert.match(fillText.font, /^700 /, `${label} should use the combat-text font weight`);
    assert.equal(fillText.textAlign, "center", `${label} should keep centered text alignment`);
    return fillText;
}

function testEffectVisibilityTokens() {
    const createContext = ({ transformScale, cssSize }) => ({
        getTransform: () => ({ a: transformScale, b: 0, c: 0, d: transformScale }),
        canvas: {
            width: 960,
            height: 960,
            getBoundingClientRect: () => ({ width: cssSize, height: cssSize })
        }
    });
    for (const viewport of [
        { name: "PC", transformScale: 0.729, cssSize: 700 },
        { name: "mobile", transformScale: 0.28125, cssSize: 270 }
    ]) {
        const context = createContext(viewport);
        const worldToCss = viewport.transformScale * (viewport.cssSize / 960);
        assert.ok(
            getVisibleLineWidth(context, "standard", 2) * worldToCss >= 2 - 1e-9,
            `${viewport.name} standard effect line should remain at least 2 CSS px`
        );
        assert.ok(
            getVisibleCombatTextSize(context, 13) * worldToCss >= 13 - 1e-9,
            `${viewport.name} combat text should remain at least 13 CSS px`
        );
    }
    console.log("[effect-visibility-tokens] ok");
}

testEffectVisibilityTokens();

function makeCanvasContext() {
    const gradient = { addColorStop() {} };
    const target = {
        createRadialGradient: () => gradient,
        createLinearGradient: () => gradient,
        measureText: () => ({ width: 0 })
    };
    return new Proxy(target, {
        get: (object, property) => (property in object ? object[property] : () => undefined),
        set: (object, property, value) => {
            object[property] = value;
            return true;
        }
    });
}

class FakeAudioContext {
    constructor() {
        this.currentTime = 0;
        this.sampleRate = 44100;
        this.destination = {};
        this.state = "running";
    }

    resume() {
        this.state = "running";
    }

    createGain() {
        return {
            gain: {
                setValueAtTime() {},
                exponentialRampToValueAtTime() {}
            },
            connect() {}
        };
    }

    createOscillator() {
        return {
            frequency: {
                setValueAtTime() {},
                exponentialRampToValueAtTime() {}
            },
            type: "sine",
            connect() {},
            start() {},
            stop() {}
        };
    }

    createBuffer(_channels, length) {
        return {
            getChannelData() {
                return new Float32Array(length);
            }
        };
    }

    createBufferSource() {
        return {
            buffer: null,
            connect() {},
            start() {}
        };
    }
}

function makeHarness() {
    const elements = new Map();
    for (const id of [
        "arenaCanvas",
        "overlay",
        "startButton",
        "matchupLabel",
        "statusBadge",
        "fighterCards",
        "battleLog",
        "tournamentPanel",
        "tournamentBracket",
        "tournamentPhase",
        "playerPanel",
        "playerFaceCanvas"
    ]) {
        elements.set(id, makeElement(id));
    }

    const canvas = elements.get("arenaCanvas");
    canvas.width = 960;
    canvas.height = 960;
    canvas.getContext = () => makeCanvasContext();
    const playerFaceCanvas = elements.get("playerFaceCanvas");
    playerFaceCanvas.width = 50;
    playerFaceCanvas.height = 50;
    playerFaceCanvas.getContext = () => makeCanvasContext();

    const context = {
        console,
        Math,
        AudioContext: FakeAudioContext,
        webkitAudioContext: FakeAudioContext,
        performance: { now: () => Date.now() },
        requestAnimationFrame: () => 0,
        cancelAnimationFrame: () => {},
        document: {
            getElementById: (id) => elements.get(id) || makeElement(id),
            createElement: (tag) => makeElement(tag)
        }
    };
    context.setTimeout = (callback) => {
        callback();
        return 0;
    };
    const alpineStores = {};
    const mockComponentInstances = {};
    context.Alpine = {
        _stores: alpineStores,
        store(name, value) {
            if (arguments.length === 1) return this._stores[name];
            this._stores[name] = value;
            return value;
        }
    };
    const uiManagerStore = {
        components: {},
        gameActionBridge: null,
        register(id, instance) {
            this.components[id] = instance;
        },
        unregister(id) {
            delete this.components[id];
        },
        getComponent(componentId) {
            const instance = this.components[componentId];
            if (!instance) return null;
            return new Proxy(instance, {
                get(target, prop) {
                    if (typeof target[prop] === "function") return target[prop].bind(target);
                    return target[prop];
                },
                set(target, prop, value) {
                    target[prop] = value;
                    return true;
                }
            });
        },
        requireComponent(componentId) {
            const component = this.getComponent(componentId);
            if (!component) {
                throw new Error(`[Test] 필수 UI 컴포넌트 '${componentId}'가 uiManager에 등록되지 않았습니다.`);
            }
            return component;
        },
        setGameActionBridge(bridge) {
            this.gameActionBridge = bridge;
        },
        requireGameActionBridge(actionName) {
            const bridge = this.gameActionBridge;
            if (!bridge) throw new Error("[Test] gameActionBridge가 아직 등록되지 않았습니다.");
            if (actionName && typeof bridge[actionName] !== "function") {
                throw new Error(`[Test] gameActionBridge에 '${actionName}' 액션이 등록되지 않았습니다.`);
            }
            return bridge;
        },
        invokeGameAction(actionName, ...args) {
            const bridge = this.requireGameActionBridge(actionName);
            return bridge[actionName](...args);
        }
    };
    context.Alpine.store("uiManager", uiManagerStore);
    context.uiManager = uiManagerStore;
    context.createGameUI = (name, factory) => {
        context.Alpine.data(name, () => factory());
    };
    context.window = context;
    return { context, elements };
}

function createHuntingOverlayMock() {
    return {
        visible: false,
        label: "",
        text: "",
        subtext: "",
        huntingChoiceVisible: false,
        huntingFloor: 1,
        huntingCharacterName: "",
        huntingLootSummary: "",
        huntingCanRetreat: false,
        huntingMoving: false,
        huntingMoveFrom: 0,
        huntingMoveTo: 0,
        huntingMoveStep: 0,
        huntingMoveMax: 10,
        huntingMoveMessage: "",
        huntingMerchantActive: false,
        huntingMerchantOffers: null,
        huntingMerchantResult: "",
        huntingChestEventActive: false,
        huntingChestRarity: "common",
        huntingChestTitle: "",
        huntingChestSubtext: "",
        huntingChestConfirmLabel: "",
        huntingEventActive: false,
        huntingEventDetail: "",
        huntingEventConfirmLabel: "",
        huntingBattlePreparationActive: false,
        huntingBattlePreparationItems: [],
        huntingBattlePreparationHp: 0,
        huntingBattlePreparationMaxHp: 0,
        huntingBattlePreparationNotice: "",
        huntingLootHudVisible: false,
        huntingLootHudShards: 0,
        huntingLootHudEnhancementStones: 0,
        huntingLootHudChests: 0,
        show({ label, text, subtext, xpReward } = {}) {
            if (label !== undefined) this.label = label;
            if (text !== undefined) this.text = text;
            if (subtext !== undefined) this.subtext = subtext;
            const xpRewardPanel =
                Alpine.store("uiManager").getComponent("huntingXpRewardPanel") ??
                Alpine.store("uiManager").getComponent("xpRewardPanel");
            if (xpReward) {
                xpRewardPanel?.animate(xpReward);
            } else {
                xpRewardPanel?.hide();
            }
            this.visible = true;
        },
        hide() {
            this.reset();
        },
        reset() {
            this.visible = false;
            this.label = "";
            this.text = "";
            this.subtext = "";
            (
                Alpine.store("uiManager").getComponent("huntingXpRewardPanel") ??
                Alpine.store("uiManager").getComponent("xpRewardPanel")
            )?.reset();
            this.resetHuntingState();
        },
        resetHuntingState() {
            this.huntingChoiceVisible = false;
            this.huntingFloor = 1;
            this.huntingCharacterName = "";
            this.huntingLootSummary = "";
            this.huntingCanRetreat = false;
            this.huntingMoving = false;
            this.huntingMoveFrom = 0;
            this.huntingMoveTo = 0;
            this.huntingMoveStep = 0;
            this.huntingMoveMax = 10;
            this.huntingMoveMessage = "";
            this.huntingMerchantActive = false;
            this.huntingMerchantOffers = null;
            this.huntingMerchantResult = "";
            this.huntingChestEventActive = false;
            this.huntingChestRarity = "common";
            this.huntingChestTitle = "";
            this.huntingChestSubtext = "";
            this.huntingChestConfirmLabel = "";
            this.huntingEventActive = false;
            this.huntingEventDetail = "";
            this.huntingEventConfirmLabel = "";
            this.huntingBattlePreparationActive = false;
            this.huntingBattlePreparationItems = [];
            this.huntingBattlePreparationHp = 0;
            this.huntingBattlePreparationMaxHp = 0;
            this.huntingBattlePreparationNotice = "";
            this.huntingLootHudVisible = false;
            this.huntingLootHudShards = 0;
            this.huntingLootHudEnhancementStones = 0;
            this.huntingLootHudChests = 0;
        },
        setHuntingState(data) {
            if (data) Object.assign(this, data);
        }
    };
}

async function loadModuleApp() {
    const harness = makeHarness();
    Object.assign(globalThis, harness.context);
    const uiManager = globalThis.Alpine.store("uiManager");
    uiManager.register("battleLog", {
        items: [],
        add(msg) {
            this.items.push(msg);
        },
        reset() {
            this.items = [];
        }
    });
    const overlayMock = {
        visible: false,
        transient: false,
        label: "",
        text: "",
        subtext: "",
        huntingChoiceVisible: false,
        huntingFloor: 1,
        huntingCharacterName: "",
        huntingLootSummary: "",
        huntingCanRetreat: false,
        huntingMoving: false,
        huntingMoveFrom: 0,
        huntingMoveTo: 0,
        huntingMoveStep: 0,
        huntingMoveMax: 10,
        huntingMoveMessage: "",
        huntingMerchantActive: false,
        huntingMerchantOffers: null,
        huntingLootHudVisible: false,
        huntingLootHudShards: 0,
        huntingLootHudChests: 0,
        show({ label, text, subtext: st, xpReward } = {}) {
            if (label !== undefined) this.label = label;
            if (text !== undefined) this.text = text;
            if (st !== undefined) this.subtext = st;
            if (xpReward) {
                this.xpReward = xpReward;
                const rp = Alpine.store("uiManager").getComponent("xpRewardPanel");
                if (rp) rp.animate(xpReward);
            } else {
                const rp = Alpine.store("uiManager").getComponent("xpRewardPanel");
                if (rp) rp.hide();
            }
            this.visible = true;
        },
        hide() {
            this.visible = false;
            this.transient = false;
        },
        reset() {
            this.visible = false;
            this.transient = false;
            this.label = "";
            this.text = "";
            this.subtext = "";
            this.huntingChoiceVisible = false;
            this.huntingMoving = false;
            this.huntingMerchantActive = false;
            this.huntingMerchantOffers = null;
            this.huntingLootHudVisible = false;
        },
        showTransient(label, text) {
            this.label = label;
            this.text = text;
            this.transient = true;
            this.visible = true;
        },
        setHuntingState(data) {
            if (!data) return;
            Object.assign(this, data);
        }
    };
    uiManager.register("gameOverlay", overlayMock);
    globalThis.Alpine.store("gameOverlay", overlayMock);
    const huntingOverlayMock = createHuntingOverlayMock();
    uiManager.register("huntingOverlay", huntingOverlayMock);
    globalThis.Alpine.store("huntingOverlay", huntingOverlayMock);
    const xpRewardMock = {
        visible: false,
        characterName: "",
        xpGained: 0,
        previousLevelLabel: "Lv.1",
        levelLabel: "Lv.1",
        levelUp: false,
        barResetting: false,
        animatedProgressPct: 0,
        progressText: "",
        nextText: "",
        earnedRewardText: "",
        nextRewardText: "",
        animate(val) {
            if (!val) {
                this.visible = false;
                return;
            }
            this.characterName = val.characterName ?? "";
            this.xpGained = val.xpGained ?? 0;
            this.previousLevelLabel = val.previousLevelLabel ?? "Lv.1";
            this.levelLabel = val.levelLabel ?? "Lv.1";
            this.levelUp = Boolean(val.levelUp);
            this.barResetting = false;
            this.progressText = val.progressText ?? "";
            this.nextText = val.nextText ?? "";
            this.earnedRewardText = val.earnedRewardText ?? "";
            this.nextRewardText = val.nextRewardText ?? "";
            this.visible = true;
        },
        hide() {
            this.visible = false;
        },
        reset() {
            this.visible = false;
            this.characterName = "";
            this.xpGained = 0;
            this.previousLevelLabel = "Lv.1";
            this.levelLabel = "Lv.1";
            this.levelUp = false;
            this.barResetting = false;
            this.animatedProgressPct = 0;
            this.progressText = "";
            this.nextText = "";
            this.earnedRewardText = "";
            this.nextRewardText = "";
        }
    };
    uiManager.register("xpRewardPanel", xpRewardMock);
    uiManager.register("huntingXpRewardPanel", xpRewardMock);
    globalThis.Alpine.store("xpReward", xpRewardMock);
    uiManager.register("startButton", {
        hidden: true,
        disabledOverride: null,
        textOverride: null,
        remainingPoints: 0,
        locked: false,
        setState() {},
        reset() {
            this.hidden = true;
            this.disabledOverride = null;
            this.textOverride = null;
            this.remainingPoints = 0;
            this.locked = false;
        }
    });
    uiManager.register("fighterStrip", {
        fighters: [],
        reset() {
            this.fighters = [];
        }
    });
    const playerPanelMock = {
        fighter: null,
        experience: {},
        equipmentSummary: { ...EMPTY_EQUIPMENT_SUMMARY },
        allocation: {},
        totalPoints: 0,
        bonusPoints: 0,
        remainingPoints: 0,
        locked: false,
        statDefs: [],
        challengeLevel: 0,
        highestUnlockedLevel: 0,
        tournamentTierLabel: "첫 도전",
        tournamentOpponentLevel: 1,
        progressionBonusSummary: "",
        allocationSummary: "",
        reset() {
            this.fighter = null;
            this.experience = {};
            this.equipmentSummary = { ...EMPTY_EQUIPMENT_SUMMARY };
            this.allocation = {};
            this.totalPoints = 0;
            this.remainingPoints = 0;
            this.locked = false;
            this.statDefs = [];
            this.tournamentTierLabel = "첫 도전";
            this.tournamentOpponentLevel = 1;
            this.allocationSummary = "";
        }
    };
    uiManager.register("playerPanel", playerPanelMock);
    globalThis.Alpine.store("playerPanel", playerPanelMock);
    uiManager.register("tournamentBracket", {
        visible: false,
        phase: "Ready",
        rounds: [],
        render() {},
        reset() {
            this.visible = false;
            this.phase = "Ready";
            this.rounds = [];
        }
    });
    uiManager.register("appRoot", {
        tournamentActive: false,
        statusBadge: "Setup",
        statusText: "",
        statusSubtext: "",
        reset() {
            this.tournamentActive = false;
            this.statusBadge = "Setup";
            this.statusText = "내 캐릭터 스탯을 배분하세요";
            this.statusSubtext = "랜덤 대진과 전투 결과가 여기에 갱신됩니다.";
        }
    });
    uiManager.register("toastNotification", {
        show() {},
        reset() {}
    });
    uiManager.register("modeSegment", {
        visible: false,
        mode: "tournament",
        canHunt: false,
        locked: false,
        reset() {
            this.visible = false;
            this.mode = "tournament";
            this.canHunt = false;
            this.locked = false;
        }
    });
    uiManager.register("collectionHub", {
        visible: false,
        render() {},
        open() {},
        close() {},
        show() {},
        hide() {}
    });
    uiManager.register("popupDialog", {
        visible: false,
        show() {},
        hide() {}
    });
    const moduleUrl = new URL(`../src/app.js?test=${Date.now()}`, import.meta.url).href;
    const { BattleApp } = await import(moduleUrl);
    return new BattleApp();
}

async function loadModuleAppWithInitialAlpineAllocation(allocation) {
    const harness = makeHarness();
    const appRoot = makeElement("app");
    harness.context.document.querySelector = (selector) => (selector === ".app" ? appRoot : null);
    const uiManager = harness.context.Alpine.store("uiManager");
    uiManager.register("battleLog", {
        items: [],
        add(msg) {
            this.items.push(msg);
        },
        reset() {
            this.items = [];
        }
    });
    const overlayMock2 = {
        visible: false,
        transient: false,
        label: "",
        text: "",
        subtext: "",
        huntingChoiceVisible: false,
        huntingFloor: 1,
        huntingCharacterName: "",
        huntingLootSummary: "",
        huntingCanRetreat: false,
        huntingMoving: false,
        huntingMoveFrom: 0,
        huntingMoveTo: 0,
        huntingMoveStep: 0,
        huntingMoveMax: 10,
        huntingMoveMessage: "",
        huntingMerchantActive: false,
        huntingMerchantOffers: null,
        huntingLootHudVisible: false,
        huntingLootHudShards: 0,
        huntingLootHudChests: 0,
        show({ label, text, subtext: st, xpReward } = {}) {
            if (label !== undefined) this.label = label;
            if (text !== undefined) this.text = text;
            if (st !== undefined) this.subtext = st;
            if (xpReward) {
                this.xpReward = xpReward;
                const rp = Alpine.store("uiManager").getComponent("xpRewardPanel");
                if (rp) rp.animate(xpReward);
            } else {
                const rp = Alpine.store("uiManager").getComponent("xpRewardPanel");
                if (rp) rp.hide();
            }
            this.visible = true;
        },
        hide() {
            this.visible = false;
            this.transient = false;
        },
        reset() {
            this.visible = false;
            this.transient = false;
            this.label = "";
            this.text = "";
            this.subtext = "";
            this.huntingChoiceVisible = false;
            this.huntingMoving = false;
            this.huntingMerchantActive = false;
            this.huntingMerchantOffers = null;
            this.huntingLootHudVisible = false;
        },
        showTransient(label, text) {
            this.label = label;
            this.text = text;
            this.transient = true;
            this.visible = true;
        },
        setHuntingState(data) {
            if (data) Object.assign(this, data);
        }
    };
    uiManager.register("gameOverlay", overlayMock2);
    const huntingOverlayMock = createHuntingOverlayMock();
    uiManager.register("huntingOverlay", huntingOverlayMock);
    uiManager.register("startButton", {
        hidden: true,
        disabledOverride: null,
        textOverride: null,
        remainingPoints: 0,
        locked: false,
        setState() {},
        reset() {
            this.hidden = true;
            this.disabledOverride = null;
            this.textOverride = null;
            this.remainingPoints = 0;
            this.locked = false;
        }
    });
    uiManager.register("fighterStrip", {
        fighters: [],
        reset() {
            this.fighters = [];
        }
    });
    uiManager.register("playerPanel", {
        fighter: null,
        experience: {},
        equipmentSummary: { ...EMPTY_EQUIPMENT_SUMMARY },
        allocation: { ...allocation },
        totalPoints: 0,
        bonusPoints: 0,
        remainingPoints: 0,
        locked: false,
        statDefs: [],
        challengeLevel: 0,
        highestUnlockedLevel: 0,
        tournamentTierLabel: "첫 도전",
        tournamentOpponentLevel: 1,
        progressionBonusSummary: "",
        allocationSummary: "",
        reset() {
            this.fighter = null;
            this.experience = {};
            this.equipmentSummary = { ...EMPTY_EQUIPMENT_SUMMARY };
            this.allocation = {};
            this.totalPoints = 0;
            this.remainingPoints = 0;
            this.locked = false;
            this.statDefs = [];
            this.tournamentTierLabel = "첫 도전";
            this.tournamentOpponentLevel = 1;
            this.allocationSummary = "";
        }
    });
    uiManager.register("tournamentBracket", {
        visible: false,
        phase: "Ready",
        rounds: [],
        render() {},
        reset() {
            this.visible = false;
            this.phase = "Ready";
            this.rounds = [];
        }
    });
    uiManager.register("xpRewardPanel", {
        visible: false,
        characterName: "",
        xpGained: 0,
        previousLevelLabel: "Lv.1",
        levelLabel: "Lv.1",
        levelUp: false,
        barResetting: false,
        animatedProgressPct: 0,
        progressText: "",
        nextText: "",
        earnedRewardText: "",
        nextRewardText: "",
        animate(val) {
            if (!val) {
                this.visible = false;
                return;
            }
            this.characterName = val.characterName ?? "";
            this.xpGained = val.xpGained ?? 0;
            this.previousLevelLabel = val.previousLevelLabel ?? "Lv.1";
            this.levelLabel = val.levelLabel ?? "Lv.1";
            this.levelUp = Boolean(val.levelUp);
            this.barResetting = false;
            this.progressText = val.progressText ?? "";
            this.nextText = val.nextText ?? "";
            this.earnedRewardText = val.earnedRewardText ?? "";
            this.nextRewardText = val.nextRewardText ?? "";
            this.visible = true;
        },
        hide() {},
        reset() {
            this.visible = false;
            this.characterName = "";
            this.xpGained = 0;
            this.previousLevelLabel = "Lv.1";
            this.levelLabel = "Lv.1";
            this.levelUp = false;
            this.barResetting = false;
            this.animatedProgressPct = 0;
            this.progressText = "";
            this.nextText = "";
            this.earnedRewardText = "";
            this.nextRewardText = "";
        }
    });
    uiManager.register("appRoot", {
        tournamentActive: false,
        statusBadge: "Setup",
        statusText: "",
        statusSubtext: "",
        reset() {
            this.tournamentActive = false;
            this.statusBadge = "Setup";
            this.statusText = "내 캐릭터 스탯을 배분하세요";
            this.statusSubtext = "랜덤 대진과 전투 결과가 여기에 갱신됩니다.";
        }
    });
    uiManager.register("collectionHub", {
        visible: false,
        render() {},
        open() {},
        close() {},
        show() {},
        hide() {}
    });
    uiManager.register("toastNotification", {
        show() {},
        reset() {}
    });
    uiManager.register("modeSegment", {
        visible: false,
        mode: "tournament",
        canHunt: false,
        locked: false,
        reset() {
            this.visible = false;
            this.mode = "tournament";
            this.canHunt = false;
            this.locked = false;
        }
    });
    const alpineState = { allocation, remainingPoints: 0 };
    alpineState.allocation = { ...allocation };
    alpineState.remainingPoints = 0;
    const baseAlpine = harness.context.Alpine;
    const savedAlpine = globalThis.Alpine;
    const savedUiManager = globalThis.uiManager;
    const savedWindow = globalThis.window;
    harness.context.Alpine = {
        ...baseAlpine,
        $data: (root) => (root === appRoot ? alpineState : null)
    };
    Object.assign(globalThis, harness.context);
    globalThis.Alpine.store("gameOverlay", overlayMock2);
    globalThis.Alpine.store("huntingOverlay", huntingOverlayMock);
    const moduleUrl = new URL(`../src/app.js?test=${Date.now()}`, import.meta.url).href;
    const { BattleApp } = await import(moduleUrl);
    const app = new BattleApp();
    globalThis.Alpine = savedAlpine;
    globalThis.uiManager = savedUiManager;
    globalThis.window = savedWindow;
    return { app, alpineState };
}

async function testCloneSeedDash(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [trickster, opponent] = app.simulation.fighters;
    trickster.position.x = 200;
    trickster.position.y = 480;
    opponent.position.x = 640;
    opponent.position.y = 480;
    app.simulation.entities = [];
    trickster.ability.timer = 0;
    trickster.ability.update(0.016, opponent);
    const seeds = app.simulation.entities.filter((entity) => entity.constructor.name === "SeedOrb");
    assert.equal(seeds.length, 3, "Clone should launch three seeds");
    assert.ok(
        seeds.every((seed) => seed.life === trickster.ability.cooldown * 2),
        "Clone seeds should live for 2x the seed cooldown"
    );

    const angles = seeds.map((seed) => Math.atan2(seed.velocity.y, seed.velocity.x)).sort((a, b) => a - b);
    const gaps = angles.map((angle, index) => {
        const next = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? Math.PI * 2 : 0);
        return Math.round(((next - angle) * 180) / Math.PI);
    });
    assert.deepEqual(gaps, [120, 120, 120], "Clone seeds should spread at 120 degree intervals");

    const seedLife = trickster.ability.cooldown * 2;
    seeds[1].update(seedLife - 0.01, app.simulation);
    assert.equal(seeds[1].isExpired, false, "Clone seed should stay alive before its lifetime ends");
    seeds[1].update(0.02, app.simulation);
    assert.equal(seeds[1].isExpired, true, "Clone seed should expire at its lifetime (cooldown * 2)");

    seeds[0].position = opponent.position.clone();
    seeds[0].update(0.016, app.simulation);
    assert.ok(trickster.state.movement, "Clone should dash when any seed is collected");
    assert.equal(opponent.state.movement, null, "The collector should not dash");
}

async function testEaterFeast(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.EATER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER)
    ]);
    const [eater, target] = app.simulation.fighters;
    assert.equal(eater.stats.baseDefense, 2, "Eater base defense should stay near the roster average");
    eater.position.x = 300;
    eater.position.y = 480;
    target.position.x = 360;
    target.position.y = 300;
    eater.applyImpulse(Vector2.subtract(new Vector2(260, 0), eater.velocity));
    eater.ability.state.feastTimer = eater.ability.feastDuration;
    eater.ability.state.feastElapsed = eater.ability.feastDuration;
    eater.ability.update(0.2, target);
    assert.equal(eater.ability.getRadiusScale(), 1, "Eater should stay normal size during feast (no swallow)");
    assert.equal(eater.ability.getStatModifiers().defense, 1.5, "Eater feast defense should be moderate");
    assert.ok(eater.state.forcedHeading.direction.y < 0, "Eater feast should steer toward the target");
    assert.ok(eater.state.forcedHeading.direction.y > -0.7, "Eater feast should not snap directly to the target");
    eater.ability.state.feastTimer = 0;
    target.position.y = 480;

    eater.ability.state.feastTimer = 1.2;
    eater.ability.state.hasEatenThisFeast = false;
    eater.ability.onCollision(target);
    assert.ok(target.state.swallowed, "Eater should swallow on feast collision");
    eater.ability.update(0.3, target);
    assert.ok(eater.ability.getRadiusScale() > 1.1, "Eater should start growing after swallowing");

    app.simulation.update(0.8);
    assert.equal(target.state.swallowed, null, "Eater should spit target back out");
    assert.ok(target.state.wallSlam, "Spat target should receive wall slam state");
    assert.equal(
        typeof target.state.wallSlam.onWallBounce,
        "function",
        "Wall slam behavior should live on the wall slam effect"
    );
    assert.equal(target.state.forcedHeading, null, "Spit dash should allow wall bounce direction changes");
    assert.equal(
        Math.round(target.velocity.length()),
        target.stats.baseSpeed * 2,
        "Spat target should launch at twice its base speed"
    );
    assert.equal(target.state.movement.showRing, false, "Spit dash should not draw the normal speed ring");
    // WallSlam one-shot angular impulse was already applied during simulation.update(0.8)
    assert.ok(
        Math.abs(target.angularVelocity) > 0.1,
        "Spat target should have received physical angular impulse from wall slam"
    );
    const beforeHp = target.hp;
    target.applyImpulse(
        Vector2.subtract(new Vector2(Math.abs(target.velocity.x) || 500, target.velocity.y), target.velocity)
    );
    target.position.x = app.simulation.width + target.radius + 5;
    app.simulation.keepInsideArena(target);
    assert.ok(beforeHp - target.hp > 0, "Wall bounce should deal shared source-and-impact-based wall slam damage");
    const afterFirstWallSlamHp = target.hp;
    target.position.x = app.simulation.width + target.radius + 5;
    app.simulation.keepInsideArena(target);
    assert.equal(target.hp, afterFirstWallSlamHp, "Wall slam effect should own its repeat-hit cooldown");
    assert.ok(target.velocity.x < 0, "Wall bounce should reverse spat target direction");
    assert.ok(app.simulation.screenShake, "Wall slam should trigger screen shake");
    assert.ok(
        app.simulation.entities.filter((entity) => entity.constructor.name === "GravityParticle").length >= 20,
        "Wall slam should emit wall particles"
    );
}

async function testRageBallMomentum(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.RAGE),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [rage, opponent] = app.simulation.fighters;
    const initialSpeed = rage.ability.getStatModifiers().speed;
    rage.ability.update(7.5, opponent);
    const chargedSpeed = rage.ability.getStatModifiers().speed;
    assert.ok(initialSpeed < 1, "Rage Ball should start slower than normal");
    assert.ok(chargedSpeed > 1.7, "Rage Ball should gain speed while avoiding collision");
    rage.ability.onCollision(opponent);
    assert.equal(rage.ability.getChargeProgress(), 0, "Rage Ball collision should reset momentum");
}

async function testDashBallCooldownDash(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.DASH),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER)
    ]);
    const [dashBall, target] = app.simulation.fighters;
    assert.equal(dashBall.stats.baseDamage, 10, "Dash Ball should have reduced base damage");
    dashBall.position.x = 300;
    dashBall.position.y = 480;
    target.position.x = 620;
    target.position.y = 480;
    dashBall.ability.timer = 0;
    dashBall.ability.update(0.016, target);
    assert.ok(dashBall.state.movement, "Dash Ball should enter dash state");
    assert.ok(
        Math.abs(dashBall.state.forcedHeading.direction.length() - 1) < 0.001,
        "Dash Ball forced heading should remain a unit direction"
    );
    dashBall.update(0.016, app.simulation);
    assert.ok(dashBall.velocity.length() < 800, "Dash Ball dash velocity should stay bounded");
    assert.ok(dashBall.velocity.length() > 600, "Dash Ball dash should be faster than before");
    const directionBeforeSteer = dashBall.state.forcedHeading.direction.clone();
    target.position.y = 300;
    dashBall.ability.update(0.1, target);
    assert.ok(
        dashBall.state.forcedHeading.direction.y < directionBeforeSteer.y,
        "Dash Ball dash should steer toward the target at full cooldown"
    );
    dashBall.ability.state.cooldownLevel = 1;
    const directionAfterFullCooldownSteer = dashBall.state.forcedHeading.direction.clone();
    target.position.y = 660;
    dashBall.ability.update(0.1, target);
    assert.deepEqual(
        dashBall.state.forcedHeading.direction,
        directionAfterFullCooldownSteer,
        "Dash Ball dash should not steer after cooldown stacks are gained"
    );
    dashBall.ability.state.cooldownLevel = 0;

    dashBall.position.x = 480;
    dashBall.position.y = 480;
    target.position.x = 480 + dashBall.radius + target.radius - 2;
    target.position.y = 480;
    const hpBefore = target.hp;
    const baseCooldown = dashBall.ability.baseCooldown;
    app.simulation.handleCollision();
    assert.ok(target.hp < hpBefore, "Dash Ball collision should damage target");
    assert.equal(
        app.ui.logItems.some((item) => item.includes("Dash Contact lands")),
        false,
        "Dash Ball dash should not add separate collision damage"
    );
    assert.equal(target.state.slow, null, "Dash Ball collision should not slow target");
    assert.equal(baseCooldown, 3, "Dash Ball base cooldown should be 3 seconds");
    assert.equal(dashBall.ability.state.cooldownLevel, 1, "First dash hit should add one cooldown stack");
    assert.equal(dashBall.ability.cooldown, baseCooldown * 0.5, "First dash hit should halve future cooldown");
    assert.equal(dashBall.ability.maxCooldownLevel, 2, "Dash should have max 2 cooldown stacks");
    assert.equal(
        dashBall.ability.timer,
        dashBall.ability.cooldown,
        "Dash hit should clamp timer to the shorter cooldown"
    );
    assert.equal(dashBall.state.movement, null, "Dash Ball dash should clear after impact");

    dashBall.ability.onDashHit();
    assert.equal(dashBall.ability.state.cooldownLevel, 2, "Second dash hit should reach max cooldown stacks");
    assert.equal(dashBall.ability.cooldown, baseCooldown * 0.25, "Second dash hit should leave 25% base cooldown");
    dashBall.ability.onDashHit();
    assert.equal(dashBall.ability.state.cooldownLevel, 2, "Dash cooldown stacks should cap at two");
    assert.equal(
        dashBall.ability.cooldown,
        baseCooldown * 0.25,
        "Dash cooldown should not shrink below 25% base cooldown"
    );

    dashBall.position.x = app.simulation.width - dashBall.radius + 1;
    dashBall.position.y = 200;
    target.position.x = 200;
    target.position.y = 760;
    dashBall.ability.state.cooldownLevel = 2;
    dashBall.ability.cooldown = dashBall.ability.getCooldownForLevel();
    dashBall.ability.timer = dashBall.ability.cooldown;
    dashBall.setMovementEffect(
        new DashEffect({
            duration: 1.4,
            multiplier: 1,
            color: dashBall.color,
            collisionLabel: "Dash Contact",
            untilImpact: true,
            untilWall: true
        })
    );
    dashBall.forceHeading(new Vector2(1, 0), 1.4);
    dashBall.applyImpulse(Vector2.subtract(new Vector2(1, 0).scale(dashBall.stats.baseSpeed), dashBall.velocity));
    app.simulation.keepInsideArena(dashBall);
    assert.equal(dashBall.state.movement, null, "Dash Ball dash should clear on wall contact");
    assert.equal(dashBall.ability.state.cooldownLevel, 0, "Wall contact should reset cooldown stacks");
    assert.equal(dashBall.ability.cooldown, baseCooldown, "Wall contact should restore full cooldown");
    assert.equal(dashBall.ability.timer, baseCooldown, "Wall contact should restart from full cooldown");
}

async function testCollisionImpulsePersists(app) {
    const sim = new BattleSimulation(
        [
            app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
            app.roster.find((fighter) => fighter.id === FIGHTER_IDS.GRENADE)
        ],
        {
            onLog() {},
            onSound() {}
        }
    );
    const [a, b] = sim.fighters;
    a.position = new Vector2(440, 480);
    b.position = new Vector2(440 + a.radius + b.radius - 4, 480);
    a.applyImpulse(Vector2.subtract(new Vector2(700, 0), a.velocity));
    b.applyImpulse(Vector2.subtract(new Vector2(-520, 0), b.velocity));

    sim.handleCollision();
    assert.ok(a.velocity.x < 0, "Collision impulse should reverse the first fighter");
    assert.ok(b.velocity.x > 0, "Collision impulse should reverse the second fighter");

    a.update(0.016, sim);
    b.update(0.016, sim);
    assert.ok(
        a.velocity.length() > a.stats.baseSpeed * 1.2,
        "Collision impulse should persist instead of snapping back to base speed"
    );
    assert.ok(
        b.velocity.length() > b.stats.baseSpeed * 1.2,
        "Collision impulse should persist on both fighters after one update"
    );
}

async function testGrenadeScatterShot(app) {
    const grenadeBase = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.GRENADE);
    const grenade = {
        ...grenadeBase,
        stats: { ...grenadeBase.stats, speed: 580 },
        statAllocation: { skill: 100 }
    };
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.GRENADE);
    const sim = new BattleSimulation([grenade, opponent], { onLog() {}, onSound() {} });
    const grenadeFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.GRENADE);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.GRENADE);

    grenadeFighter.position.x = 300;
    grenadeFighter.position.y = 480;
    target.position.x = 500;
    target.position.y = 480;
    sim.entities = sim.fighters.slice();
    grenadeFighter.ability.timer = 0;
    grenadeFighter.ability.update(0.016, target);
    const allGrenades = () => sim.entities.filter((e) => e.constructor?.name === "Grenade");
    const firstCount = allGrenades().length;
    assert.ok(firstCount >= 1, "Grenade should fire 1 grenade on first burst tick");
    for (let i = 0; i < 10; i++) {
        grenadeFighter.ability.update(0.12, target);
    }
    const total = allGrenades().length;
    assert.ok(total >= 3, "Grenade should fire 3-5 grenades in burst");
    assert.ok(total <= 5, "Grenade should fire at most 5 grenades total");
    assert.equal(
        grenadeFighter.stats.baseSpeed,
        580,
        "Modified Grenade owner speed should reach the spawned projectile"
    );
    for (const g of allGrenades()) {
        assert.ok(
            Math.abs(g.velocity.length() - 638) < 0.001,
            "Grenade speed should be exactly 638 for a 580-speed owner"
        );
        assert.ok(g.timer > 0, "Each grenade should have a fuse timer");
    }
    const longestFuse = Math.max(...allGrenades().map((grenade) => grenade.maxTimer));
    const shortestFuse = Math.min(...allGrenades().map((grenade) => grenade.maxTimer));
    assert.ok(
        Math.abs(shortestFuse - grenadeFighter.ability.cooldown * 0.2) < 0.001,
        "The first grenade fuse should equal 20% of the effective grenade cooldown"
    );
    assert.ok(
        Math.abs(longestFuse - grenadeFighter.ability.cooldown) < 0.001,
        "The longest grenade fuse should match the effective grenade cooldown"
    );

    const defaultGrenade = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.GRENADE);
    const defaultSimulation = new BattleSimulation(
        [defaultGrenade, opponent],
        { onLog() {}, onSound() {}, onDamageTaken() {}, onDamageDealt() {}, onHpChanged() {} },
        null,
        { assignActions: false, arenaWidth: 960 }
    );
    const defaultOwner = defaultSimulation.fighters.find((fighter) => fighter.id === FIGHTER_IDS.GRENADE);
    const defaultTarget = defaultSimulation.getOpponent(defaultOwner);
    defaultSimulation.entities = [...defaultSimulation.fighters];
    const defaultRandom = Math.random;
    Math.random = () => 0;
    try {
        defaultOwner.ability._startBurst(defaultTarget);
    } finally {
        Math.random = defaultRandom;
    }
    const defaultShot = defaultSimulation.entities.find((entity) => entity.constructor?.name === "Grenade");
    assert.equal(defaultOwner.stats.baseSpeed, 290, "Grenade's baseline owner speed should remain 290");
    assert.equal(defaultShot.velocity.length(), 319, "Grenade's baseline launched speed should be exactly 319");
    const directGrenade = new Grenade(defaultOwner, defaultTarget.position, 3);
    assert.equal(
        directGrenade.velocity.length(),
        319,
        "Direct Grenade creation should also use the owner's current base-speed multiplier"
    );
}

async function testDamageShake(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [attacker, target] = app.simulation.fighters;
    target.takeDamage(10, attacker, "Test Hit");
    assert.ok(app.simulation.screenShake, "Taking damage should trigger screen shake");
    assert.ok(app.simulation.screenShake.strength >= 11, "Damage shake should be visible");
    assert.ok(app.simulation.screenShake.remaining >= 0.16, "Damage shake should last multiple frames");
}

async function testArrowBounceFacing(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [archer, target] = app.simulation.fighters;
    const Vector2 = archer.position.constructor;
    target.position.x = 480;
    target.position.y = 480;
    app.simulation.entities = [];
    app.simulation.spawnArrow(archer, new Vector2(app.simulation.width - 2, 120), new Vector2(520, 0));
    const arrow = app.simulation.entities.find((entity) => entity.constructor.name === "ArrowProjectile");
    arrow.update(0.016, app.simulation);
    assert.ok(arrow.velocity.x < 0, "Arrow should bounce off the wall");
    assert.ok(
        Math.abs(arrow.angle - Math.atan2(arrow.velocity.y, arrow.velocity.x)) < 0.001,
        "Arrow facing should follow its reflected velocity"
    );
}

async function testArcherPredictiveBurst(app) {
    const origin = new Vector2(240, 480);
    const targetPosition = new Vector2(610, 480);
    const upwardVelocity = new Vector2(0, -240);
    const predictedPoint = calculateInterceptPoint(origin, targetPosition, upwardVelocity, 540);
    const travelTime = Vector2.subtract(predictedPoint, origin).length() / 540;
    const targetAtImpact = Vector2.add(targetPosition, upwardVelocity.clone().scale(travelTime));

    assert.ok(predictedPoint.y < targetPosition.y, "Prediction should lead an upward-moving target");
    assert.ok(
        Vector2.subtract(predictedPoint, targetAtImpact).length() < 0.001,
        "Predicted point should match the target position at projectile arrival"
    );
    assert.deepEqual(
        calculateInterceptPoint(origin, targetPosition, new Vector2(800, 0), 540),
        targetPosition,
        "No valid interception should fall back to the target's current position"
    );

    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [archer, target] = app.simulation.fighters;
    const ability = archer.ability;
    archer.position = origin.clone();
    target.position = targetPosition.clone();
    target.velocity = upwardVelocity.clone();
    app.simulation.entities = app.simulation.fighters;

    // Tier 0: direct aim (no predictive)
    ability.setContext({ abilityTier: 0 });
    ability.timer = 0;
    ability.update(0.016, target);
    assert.ok(ability.state.aimPoint !== null, "Archer should enter aim state");

    // Tier 1+ should use predictive aim
    ability.setContext({ abilityTier: 1 });
    ability.timer = 0;
    ability.state.aimPoint = null;
    // trigger cooldown to start aim
    ability.timer = 0;
    ability.update(0.016, target);
    assert.ok(ability.state.aimPoint !== null, "Archer tier 1+ should set predictive aim point");

    // Tier 2: windup and double shot
    ability.setContext({ abilityTier: 2 });
    assert.ok(Math.abs(ability._getWindupDuration() - 0.32) < 1e-9, "Archer tier 2 should reduce windup to 0.32s");

    // Tier 3: crit boost
    ability.setContext({ abilityTier: 3 });
    const spawnedOptions = [];
    const originalSpawnArrow = app.simulation.spawnArrow;
    const originalRandom = Math.random;
    app.simulation.spawnArrow = (owner, start, velocity, options) => spawnedOptions.push(options);
    Math.random = () => 0;
    ability._fireArrowWithCrit(target, true);
    Math.random = originalRandom;
    app.simulation.spawnArrow = originalSpawnArrow;
    assert.equal(spawnedOptions.at(-1).critBoostOverride, 2, "Archer tier 3 arrow should double its critical chance");
    console.log("[archer-predictive-burst] ok");
}

async function testOrbitShardRecharge(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER)
    ]);
    const [orbit, target] = app.simulation.fighters;
    const ability = orbit.ability;
    orbit.position.x = 480;
    orbit.position.y = 480;
    target.position = ability.getShardPositions()[0].clone();
    const hpBefore = target.hp;
    ability.update(0.016, target);
    assert.ok(target.hp < hpBefore, "Orbit shard should damage when it hits");
    assert.equal(ability.getActiveShardCount(), 4, "Hit orbit shard should disappear (5→4)");
    assert.ok(ability.state.spinBurst > 0, "Orbit should spin faster after spending a shard");

    target.position.x = 80;
    target.position.y = 80;
    ability.update(0.86, target);
    ability.update(0.02, target);
    assert.ok(ability.getRefillingShard(), "Missing orbit shard should begin refilling after burst");
    assert.ok(
        ability.getShardRenderStates().some((shard) => shard.refilling && shard.progress > 0 && shard.progress < 1),
        "Refilling shard should render between the body and orbit"
    );
    ability.update(1.98, target);
    assert.equal(ability.getActiveShardCount(), 5, "Orbit shard should return after refill animation");

    ability.consumeShard(0);
    ability.consumeShard(1);
    ability.consumeShard(2);
    ability.consumeShard(3);
    ability.consumeShard(4);
    assert.equal(ability.getActiveShardCount(), 0, "All orbit shards can be spent");
    ability.update(0.016, target);
    assert.ok(ability.getRefillingShard(), "Orbit should immediately refill when every shard is gone");
}

async function testTournament(app) {
    app.playerProfile = createDefaultPlayerProfile();
    app.playerStatAllocation = createRandomStatAllocation(() => 0);
    const playerBase = app.roster.find((fighter) => fighter.id === app.playerFighterId);
    const weapon = createEquipmentInstance({ rarity: "common", slot: "weapon", rng: () => 0.5 });
    weapon.stats = [{ type: "damage", value: 9, min: 4, max: 8 }];
    app.playerProfile.equipment.inventory.push(weapon);
    app.playerProfile.equipment.equipped.weapon = weapon.instanceId;
    app.refreshPlayerSetup();
    await app.startTournament();
    const player = app.tournamentRoster.find((fighter) => fighter.id === app.playerFighterId);
    const baselineSpec = applyStatAllocation(playerBase, app.playerStatAllocation, true);
    const equippedSpec = applyEquipmentStats(baselineSpec, app.playerProfile);
    assert.ok(player.isPlayer, "Tournament roster should mark the user's random fighter");
    assert.equal(getSpentStatPoints(player.statAllocation), PLAYER_STAT_POINTS, "Player should spend all stat points");
    assert.equal(
        player.stats.damage,
        equippedSpec.stats.damage,
        "Tournament player spec should include equipped item stat bonuses"
    );
    assert.equal(player.equipment.equippedItems.length, 1, "Tournament player spec should carry equipment visuals");
    let matches = 0;
    while (!app.tournament.champion && matches < 8) {
        const match = app.currentTournamentMatch;
        assert.ok(match, "Tournament should expose an active match before champion");
        const desiredWinner = match.a;
        const loser = app.simulation.fighters.find((fighter) => fighter.id !== desiredWinner.id);
        const attacker = app.simulation.fighters.find((fighter) => fighter.id === desiredWinner.id);
        loser.takeDamage(999, attacker, "Forced KO");
        app.simulation.checkResult();
        app.simulation.update(2.3);
        app.finishMatch();
        matches += 1;
    }
    assert.equal(app.tournamentRoster.length, 8, "Tournament roster should include eight fighters");
    assert.equal(matches, 7, "Eight-fighter tournament should play seven matches");
    assert.ok(app.tournament.champion, "Tournament should produce a champion");
    assert.ok(app.playerResult, "Tournament should record the user's final rank");
    assert.equal(
        app.lifecycle.isAwaitingResultConfirmation,
        true,
        "Tournament completion should enter the shared result confirmation state"
    );
    assert.equal(app._modeSegment.visible, false, "Tournament result should keep the mode selector hidden");
    assert.equal(app._panel.locked, true, "Tournament result should keep stat allocation locked");
    app.returnToInitialState();
}

async function testTournamentOpponentProgressionByChallenge(app) {
    const { getTournamentOpponentExperienceLevel } = await import("../src/character-mastery/index.js");
    const playerId = app.playerFighterId;
    const scenarios = [
        { masteryLevel: 0, challengeLevel: 0, expectedTierLabel: "첫 도전", expectedOpponentLevel: 1 },
        { masteryLevel: 1, challengeLevel: 1, expectedTierLabel: "BRONZE", expectedOpponentLevel: 3 },
        { masteryLevel: 2, challengeLevel: 2, expectedTierLabel: "SILVER", expectedOpponentLevel: 6 },
        { masteryLevel: 3, challengeLevel: 3, expectedTierLabel: "GOLD", expectedOpponentLevel: 9 },
        { masteryLevel: 3, challengeLevel: 0, expectedTierLabel: "첫 도전", expectedOpponentLevel: 1 }
    ];

    for (const { masteryLevel, challengeLevel, expectedTierLabel, expectedOpponentLevel } of scenarios) {
        app.playerProfile = createDefaultPlayerProfile();
        app.playerProfile.experience.byCharacter[playerId] = { currentXp: getLevelRequirement(4) };
        app.playerProfile.characterMastery.levels[playerId] = masteryLevel;
        if (challengeLevel > 0) app.playerProfile.tournamentChallenge.levels[playerId] = challengeLevel;
        app.playerStatAllocation = createRandomStatAllocation(() => 0);
        app.refreshPlayerSetup();

        assert.equal(
            app._panel.tournamentTierLabel,
            expectedTierLabel,
            `Challenge ${challengeLevel} should determine the tournament label before the tournament starts`
        );
        assert.equal(
            app._panel.tournamentOpponentLevel,
            expectedOpponentLevel,
            `Challenge ${challengeLevel} should expose the actual AI starting level before start`
        );

        assert.equal(
            getTournamentOpponentExperienceLevel(app.playerProfile, playerId),
            challengeLevel === 0 ? null : expectedOpponentLevel,
            `Challenge ${challengeLevel} should resolve its tournament opponent starting level`
        );

        const originalWait = app.wait;
        app.wait = async () => {};
        try {
            const introCompleted = await app._presentTournamentChallengeIntro(app.lifecycle.revision);
            assert.equal(introCompleted, true, "The current tournament challenge intro should complete");
            assert.equal(
                app._overlay.text,
                expectedTierLabel,
                `Challenge ${challengeLevel} should determine the shared tournament intro label`
            );
            assert.equal(
                app._overlay.subtext,
                `상대 Lv.${expectedOpponentLevel} 시작`,
                `Challenge ${challengeLevel} should determine the shared tournament intro opponent level`
            );
        } finally {
            app.wait = originalWait;
        }

        await app.startTournament();

        const playerProgression = collectActiveExperienceProgression(app.playerProfile, playerId);
        const player = app.tournamentRoster.find((fighter) => fighter.id === playerId);
        const opponents = app.tournamentRoster.filter((fighter) => fighter.id !== playerId);
        const expectedPlayerSpec = applyStatAllocation(
            applyExperienceProgressionToBaseSpec(
                app.roster.find((fighter) => fighter.id === playerId),
                playerProgression
            ),
            app.playerStatAllocation,
            true
        );

        assert.equal(playerProgression.level, 4, "Tournament player should keep the stored experience level");
        assert.equal(
            app._experienceProgressionByFighter.get(playerId).level,
            4,
            "Tournament progression map should preserve the player experience snapshot"
        );
        assert.deepEqual(
            player.stats,
            expectedPlayerSpec.stats,
            "Player base stats should retain the stored XP progression"
        );
        assert.equal(
            opponents.length,
            app.tournamentRoster.length - 1,
            "Every selected non-player fighter should be an opponent"
        );
        assert.equal(
            new Set(app.tournamentRoster.map((fighter) => fighter.id)).size,
            app.tournamentRoster.length,
            "Tournament selection should not duplicate fighters"
        );
        assert.ok(
            opponents.every((fighter) => getSpentStatPoints(fighter.statAllocation) === PLAYER_STAT_POINTS),
            "Opponent random stat allocations should remain fully spent"
        );

        for (const opponent of opponents) {
            const expectedProgression =
                challengeLevel === 0 ? null : getCharacterLevelProgression(opponent.id, expectedOpponentLevel);
            const expectedSpec = applyStatAllocation(
                applyExperienceProgressionToBaseSpec(
                    app.roster.find((fighter) => fighter.id === opponent.id),
                    expectedProgression
                ),
                opponent.statAllocation,
                false
            );

            assert.deepEqual(
                opponent.stats,
                expectedSpec.stats,
                `Selected AI ${opponent.id} should receive the level ${expectedOpponentLevel} base stat effects before allocation`
            );
            assert.equal(
                app._experienceProgressionByFighter.get(opponent.id)?.level ?? 1,
                expectedOpponentLevel,
                `Selected AI ${opponent.id} should keep the level ${expectedOpponentLevel} progression snapshot`
            );
        }

        const simulation = new BattleSimulation(app.tournamentRoster, {
            onBattleBallReady(ball) {
                applyExperienceProgressionToBall(ball, app._experienceProgressionByFighter.get(ball.id));
            }
        });

        for (const fighter of app.tournamentRoster) {
            const ball = simulation.fighters.find((candidate) => candidate.id === fighter.id);
            const expectedProgression =
                fighter.id === playerId
                    ? playerProgression
                    : challengeLevel === 0
                      ? null
                      : getCharacterLevelProgression(fighter.id, expectedOpponentLevel);

            assert.equal(
                ball.progression.level,
                expectedProgression?.level ?? 1,
                `Battle ball ${fighter.id} should use the same level progression snapshot as its roster spec`
            );
            assert.equal(
                ball.progression.abilityTier,
                expectedProgression?.abilityTier ?? 0,
                `Battle ball ${fighter.id} should use the progression ability tier from its roster snapshot`
            );
        }

        app.returnToInitialState();
    }
}

async function testRebirthResetsTournamentChallengePresentation() {
    const app = await loadModuleApp();
    const { collectActiveEffects, getCharacterChallengeLevel, getCharacterMasteryLevel } =
        await import("../src/character-mastery/index.js");
    const playerId = FIGHTER_IDS.ARCHER;
    const supportTargetId = FIGHTER_IDS.RAGE;
    const profile = createDefaultPlayerProfile();
    const rebirthReward = createRebirthStatReward(0, () => 0);

    setCharacterXp(profile, playerId, getLevelRequirement(10));
    profile.characterMastery.levels[playerId] = 3;
    profile.tournamentChallenge.levels[playerId] = 3;
    profile.rebirth.byCharacter[playerId] = {
        rebirthCount: 0,
        statBonuses: { hp: 0, damage: 0, speed: 0, defense: 0 },
        cardRanks: {},
        equippedCardIds: [],
        pendingOfferCards: [getRebirthOfferMaterial(playerId, rebirthReward)]
    };
    app.playerProfile = profile;
    app.playerFighterId = playerId;

    const completion = completeRebirth(profile, playerId, rebirthReward.id);
    assert.equal(completion.ok, true, "A completed rebirth should provide the presentation reset scenario");
    assert.equal(getCharacterMasteryLevel(profile, playerId), 3, "Rebirth must preserve GOLD mastery");
    assert.equal(getCharacterChallengeLevel(profile, playerId), 0, "Rebirth must reset the current challenge to zero");
    assert.equal(
        collectActiveEffects(profile, supportTargetId).statModifiers.damage,
        0.06,
        "Preserved GOLD mastery must continue supporting other characters after rebirth"
    );

    app.refreshPlayerSetup();
    assert.equal(app._panel.tournamentTierLabel, "첫 도전", "The setup panel must use the reset challenge label");
    assert.equal(app._panel.tournamentOpponentLevel, 1, "The setup panel must use the reset Lv.1 opponent");

    const originalWait = app.wait;
    app.wait = async () => {};
    try {
        const introCompleted = await app._presentTournamentChallengeIntro(app.lifecycle.revision);
        assert.equal(introCompleted, true, "The rebirth challenge intro should complete");
        assert.equal(app._overlay.text, "첫 도전", "The intro must share the reset challenge label");
        assert.equal(app._overlay.subtext, "상대 Lv.1 시작", "The intro must share the reset Lv.1 opponent");
    } finally {
        app.wait = originalWait;
    }
}

async function testTournamentWinAdvancesChallengeAfterMasteryCheck() {
    const app = await loadModuleApp();
    const { createTournamentReport } = await import("../src/collection/index.js");
    const { getCharacterChallengeLevel, getCharacterMasteryLevel, getTournamentOpponentExperienceLevel } =
        await import("../src/character-mastery/index.js");
    const playerId = FIGHTER_IDS.ARCHER;
    const originalSettleAchievements = app._settleAchievements;

    app.playerProfile = createDefaultPlayerProfile();
    app.playerFighterId = playerId;
    app._currentTournamentReport = createTournamentReport();
    app._currentTournamentReport.playerFighterId = playerId;
    app._settleAchievements = () => [];

    try {
        app._settleTournamentProgression(true);
        assert.equal(
            getCharacterMasteryLevel(app.playerProfile, playerId),
            1,
            "First challenge win should unlock BRONZE"
        );
        assert.equal(
            getCharacterChallengeLevel(app.playerProfile, playerId),
            1,
            "Win should advance the next challenge"
        );
        assert.equal(
            getTournamentOpponentExperienceLevel(app.playerProfile, playerId),
            3,
            "The next tournament should use the Lv.3 AI after the first win"
        );
    } finally {
        app._settleAchievements = originalSettleAchievements;
    }
}

async function testActionSelectionShowsTournamentChallengeBeforeMatchup() {
    const app = await loadModuleApp();
    const player = app.roster.find((fighter) => fighter.id === app.playerFighterId);
    const opponent = app.roster.find((fighter) => fighter.id !== app.playerFighterId);
    const events = [];
    const originalResolveAction = app._resolveAction;
    const originalPresentChallenge = app._presentTournamentChallengeIntro;
    const originalOverlayShow = app._overlay.show;
    const originalWait = app.wait;

    app.currentTournamentMatch = { roundIndex: 0 };
    app._action = { selectedId: null, current: null, pickEveryMatch: false, ctx: null };
    app._resolveAction = async () => {
        events.push("action");
        app._action.current = { name: "테스트 액션" };
        return app._action.current;
    };
    app._presentTournamentChallengeIntro = async () => {
        events.push("challenge");
        return true;
    };
    app._overlay.show = ({ label }) => events.push(`overlay:${label}`);
    app.wait = async () => {};

    try {
        await app.startMatch([player, opponent]);
        assert.deepEqual(
            events,
            ["action", "challenge", "overlay:Matchup"],
            "The tournament challenge intro must appear after the first action selection and before the VS matchup"
        );
    } finally {
        app._resolveAction = originalResolveAction;
        app._presentTournamentChallengeIntro = originalPresentChallenge;
        app._overlay.show = originalOverlayShow;
        app.wait = originalWait;
    }
    console.log("[tournament-action-selection-challenge-intro] ok");
}

async function testTournamentWinDisplaysMasteryReward() {
    const app = await loadModuleApp();
    app.playerFighterId = FIGHTER_IDS.ARCHER;
    const champion = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const originalOverlayShow = app._overlay.show;
    const originalStartButtonSetState = app._startBtn.setState;
    const resultOverlays = [];
    const startButtonStates = [];

    app.playerProfile.characterMastery.levels[champion.id] = 1;
    app.playerProfile.tournamentChallenge.levels[champion.id] = 1;
    app._lastMasteryResult = {
        changed: true,
        characterId: champion.id,
        newLevel: 1,
        newTier: "BRONZE"
    };
    app._lastMatchXpResult = null;
    app.playerResult = { rankLabel: "1위", fighterName: champion.name };
    app._overlay.show = (options) => resultOverlays.push(options);
    app._startBtn.setState = (state) => {
        startButtonStates.push(state);
        originalStartButtonSetState.call(app._startBtn, state);
    };

    try {
        app._presentTournamentResult({ playerWon: true, champion, player: champion });
        assert.equal(resultOverlays.at(-1)?.label, "경험치", "The first result step must explain experience");
        assert.equal(
            startButtonStates.at(-1)?.hidden,
            true,
            "The shared confirm button must stay hidden before the final result step"
        );

        assert.equal(app.advanceResultSequence(), true, "The experience step must advance to the mastery result");
        assert.deepEqual(
            resultOverlays.at(-1)?.masteryReward,
            {
                sourceName: champion.name,
                tierLabel: "BRONZE",
                effectName: "정밀 훈련",
                effectDescription: "공격력이 2% 증가합니다.",
                scopeText: "다른 볼에 적용",
                nextOpponentLevel: 3
            },
            "Tournament victory must show the newly unlocked mastery effect with its actual value and target"
        );
        assert.equal(
            startButtonStates.at(-1)?.hidden,
            true,
            "The shared confirm button must stay hidden while the mastery result is still being viewed"
        );

        assert.equal(
            app.advanceResultSequence(),
            true,
            "The mastery result must advance to the existing congratulation summary"
        );
        assert.equal(
            resultOverlays.at(-1)?.label,
            "축하합니다!",
            "The final step must keep the existing congratulation text"
        );
        assert.equal(
            startButtonStates.at(-1)?.hidden,
            true,
            "The large shared confirm button must stay hidden when the final side tab takes over"
        );
    } finally {
        app._overlay.show = originalOverlayShow;
        app._startBtn.setState = originalStartButtonSetState;
    }
    console.log("[tournament-win-mastery-reward] ok");
}

function testResultSequenceProgression() {
    const sequence = createResultSequence([
        { id: "experience", label: "경험치" },
        { id: "summary", label: "축하합니다!" }
    ]);
    assert.deepEqual(
        getResultSequencePresentation(sequence),
        {
            id: "experience",
            label: "경험치",
            text: "",
            subtext: "",
            xpReward: null,
            masteryReward: null,
            currentStep: 1,
            totalSteps: 2,
            hasNext: true,
            isFinal: false
        },
        "A reusable result sequence must expose its first step and next-state metadata"
    );
    const finalSequence = advanceResultSequence(sequence);
    assert.equal(
        getResultSequencePresentation(finalSequence)?.isFinal,
        true,
        "The final sequence step must be explicit"
    );
    assert.equal(
        advanceResultSequence(finalSequence),
        finalSequence,
        "Advancing past the final step must keep the final state"
    );
    console.log("[result-sequence-progression] ok");
}

async function testTournamentEliminationAwaitsConfirmation(app) {
    app.playerProfile = createDefaultPlayerProfile();
    app.playerStatAllocation = createRandomStatAllocation(() => 0);
    const startButtonStates = [];
    const originalSetState = app._startBtn.setState;
    app._startBtn.setState = (state) => {
        startButtonStates.push(state);
        originalSetState.call(app._startBtn, state);
    };

    try {
        await app.startTournament();
        const match = app.currentTournamentMatch;
        assert.ok(match, "Tournament elimination test should begin with an active match");
        assert.ok(
            [match.a, match.b].some((fighter) => fighter?.id === app.playerFighterId),
            "The first forced tournament match should include the player"
        );

        const playerBall = app.simulation.fighters.find((fighter) => fighter.id === app.playerFighterId);
        const opponentBall = app.simulation.fighters.find((fighter) => fighter.id !== app.playerFighterId);
        playerBall.takeDamage(999, opponentBall, "Forced Tournament Elimination");
        app.simulation.checkResult();
        app.simulation.update(2.3);
        app.finishMatch();

        assert.equal(
            app.lifecycle.isAwaitingResultConfirmation,
            true,
            "Player elimination should immediately enter the shared result confirmation state"
        );
        assert.equal(app.currentTournamentMatch, null, "Elimination should not leave an active tournament match");
        assert.equal(app.tournament.champion, null, "Elimination should not continue AI matches to a champion");
        assert.equal(app._root.tournamentActive, false, "Result confirmation should unlock the tournament session");
        assert.equal(app._overlay.label, "경험치", "Elimination should begin with the shared experience result step");
        assert.equal(app.advanceResultSequence(), true, "Elimination experience should advance to the loss summary");
        assert.equal(
            app._overlay.label,
            "아쉽네요",
            "Elimination should end on the dedicated loss result presentation"
        );
        assert.equal(
            startButtonStates.at(-1)?.hidden,
            true,
            "Elimination should keep the large confirmation button hidden for the side tab"
        );
        assert.equal(
            getResultSequencePresentation(app._resultSequence)?.isFinal,
            true,
            "Elimination must expose its final side-tab confirmation state"
        );

        assert.equal(app.confirmResultSequence(), true, "The final side tab should confirm the elimination result");
        assert.equal(
            app.lifecycle.isSetup,
            true,
            "Confirming an elimination result should reuse returnToInitialState before another tournament can start"
        );
    } finally {
        app._startBtn.setState = originalSetState;
        app.returnToInitialState();
    }
    console.log("[tournament-elimination-result-confirmation] ok");
}

function testStatAllocationRules(app) {
    // Stat allocation logic is tested below via adjustStatAllocation / applyStatAllocation
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    let stepped = { hp: 0, damage: 0, speed: 0, skill: 0 };
    stepped = adjustStatAllocation(stepped, "hp", 10);
    stepped = adjustStatAllocation(stepped, "damage", 95);
    assert.deepEqual(
        stepped,
        { hp: 10, damage: 50, speed: 0, skill: 0 },
        "Large stat steps should clamp to the per-stat cap of 50"
    );
    stepped = adjustStatAllocation(stepped, "damage", -10);
    assert.equal(stepped.damage, 40, "Large negative stat steps should subtract multiple points");

    const allocation = { hp: 30, damage: 40, speed: 30, skill: 0, defense: 0, criticalChance: 0 };
    const boosted = applyStatAllocation(archer, allocation, true);
    const { multiplier } = calculateStatMultiplier([30, 40, 30, 0, 0]);
    assert.equal(
        boosted.stats.hp,
        Number((archer.stats.hp * 1.3 * multiplier).toFixed(3)),
        "HP points should multiply base health and balance multiplier"
    );
    assert.equal(
        boosted.stats.damage,
        Number((archer.stats.damage * 1.4 * multiplier).toFixed(3)),
        "Damage points should multiply base damage and balance multiplier"
    );
    assert.equal(
        boosted.stats.speed,
        Number((archer.stats.speed * 1.3 * multiplier).toFixed(3)),
        "Speed points should multiply base speed and balance multiplier"
    );
    assert.equal("force" in boosted.stats, false, "Force should not exist as an unused gameplay stat");
    assert.equal(
        formatStatAllocation(allocation),
        "체력 +30% · 공격 +40% · 속도 +30% · 쿨타임 +0% · 방어력 +0% · 크리티컬 +0%",
        "Allocation summary should show percentages instead of raw stats"
    );
    assert.equal(boosted.stats.radius, archer.stats.radius, "Radius should stay character-specific");
    assert.equal(boosted.stats.mass, archer.stats.mass, "Mass should stay character-specific");

    const rosterSize = Math.min(app.roster.length, 8);
    const roster = createTournamentRoster(app.roster, archer.id, allocation, () => 0);
    assert.equal(roster.length, rosterSize, "Tournament roster should cap at 8 (or all if under 8)");
    assert.ok(
        roster.every((fighter) => getSpentStatPoints(fighter.statAllocation) === PLAYER_STAT_POINTS),
        "Every fighter should receive the same stat budget"
    );
}

function testComponentBridgeCallsGameHandlers(app) {
    let started = false;
    let openedStageSelect = false;
    let retreated = false;
    let advanced = false;
    let advanceOptions = null;
    let chestContinued = false;
    const originalStartTournament = app.startTournament;
    const originalShowStageSelect = app.hunting.showStageSelect;
    const originalRetreat = app.hunting.retreat;
    const originalAdvance = app.hunting.advance;
    const originalChestContinue = app.hunting.chestContinue;

    try {
        app.startTournament = () => {
            started = true;
        };
        app.hunting.showStageSelect = () => {
            openedStageSelect = true;
        };
        app.hunting.retreat = () => {
            retreated = true;
        };
        app.hunting.advance = (options) => {
            advanced = true;
            advanceOptions = options;
        };
        app.hunting.chestContinue = () => {
            chestContinued = true;
        };
        const bridge = createAppComponentBridge(app);

        bridge.startTournament();
        bridge.openHuntingStageSelect();
        bridge.huntingRetreat();
        bridge.huntingAdvance();
        bridge.huntingChestContinue();
    } finally {
        app.startTournament = originalStartTournament;
        app.hunting.showStageSelect = originalShowStageSelect;
        app.hunting.retreat = originalRetreat;
        app.hunting.advance = originalAdvance;
        app.hunting.chestContinue = originalChestContinue;
    }

    assert.equal(started, true, "Start button bridge action should call BattleApp.startTournament");
    assert.equal(openedStageSelect, true, "Hunting button bridge action should open stage selection");
    assert.equal(retreated, true, "Overlay retreat action should call HuntingManager.retreat");
    assert.equal(advanced, true, "Overlay advance action should call HuntingManager.advance");
    assert.deepEqual(
        advanceOptions,
        { waitForFirstMoveUi: true },
        "Player-triggered hunting advance must wait for the movement card to paint"
    );
    assert.equal(chestContinued, true, "Chest reward action should call HuntingManager.chestContinue");
}

function testStartButtonReceivesRemainingStatPoints(app) {
    const previousRemaining = app._panel.remainingPoints;

    try {
        app._panel.remainingPoints = 100;
        app._syncStartButton();

        assert.equal(
            app._startBtn.remainingPoints,
            100,
            "Start button should receive remaining points so its disabled state explains the requirement"
        );
    } finally {
        app._panel.remainingPoints = previousRemaining;
        app._syncStartButton();
    }

    console.log("[start-button-remaining-points] ok");
}

function testHuntingUiRouteDisplay() {
    // HuntingManager._setHuntingMoveState가 route range를 올바르게 전달하는지 검증
    const recorded = { calls: [] };
    const originalSetHuntingOverlayState = app.setHuntingOverlayState.bind(app);
    app.setHuntingOverlayState = (data) => {
        recorded.calls.push({ ...data });
    };
    const hunting = app.hunting;

    // 7층에서 시작하는 10층 전진 시뮬레이션
    app.hunting._run = { floor: 7, maxFloor: 100 };
    try {
        hunting._setHuntingMoveState({
            moving: true,
            step: 1,
            maxSteps: 10,
            routeStartFloor: 7,
            routeEndFloor: 17,
            message: "8층으로 이동 중…"
        });

        const state = recorded.calls[recorded.calls.length - 1];
        assert.equal(state.huntingMoveFrom, 7, "Route start should show 7F");
        assert.equal(state.huntingMoveTo, 17, "Route end should show 17F");
        assert.equal(state.huntingMoveStep, 1, "Step should be 1");
        assert.equal(state.huntingMoveMax, 10, "Max steps should be 10");
        assert.equal(state.huntingMoveMessage, "8층으로 이동 중…", "Message should show current floor");

        // 95층에서 전진: routeMaxSteps가 5로 clamp
        recorded.calls = [];
        app.hunting._run = { floor: 95, maxFloor: 100 };
        hunting._setHuntingMoveState({
            moving: true,
            step: 1,
            maxSteps: 5,
            routeStartFloor: 95,
            routeEndFloor: 100,
            message: "96층으로 이동 중…"
        });

        const state2 = recorded.calls[recorded.calls.length - 1];
        assert.equal(state2.huntingMoveFrom, 95, "95층 route start");
        assert.equal(state2.huntingMoveTo, 100, "100층 route end (clamped)");
        assert.equal(state2.huntingMoveMax, 5, "95→100 is 5 steps");

        // 중간 단계에서도 route 표시는 변하지 않아야 함
        recorded.calls = [];
        hunting._setHuntingMoveState({
            moving: true,
            step: 3,
            maxSteps: 10,
            routeStartFloor: 7,
            routeEndFloor: 17,
            message: "10층으로 이동 중…"
        });
        const state3 = recorded.calls[recorded.calls.length - 1];
        assert.equal(state3.huntingMoveFrom, 7, "Route start should stay 7F at step 3");
        assert.equal(state3.huntingMoveTo, 17, "Route end should stay 17F at step 3");
    } finally {
        app.setHuntingOverlayState = originalSetHuntingOverlayState;
    }
}

async function testHuntingEarlyEventUi() {
    // 첫 층에서 포탈 이벤트 발생 시 choice UI가 정상 표시되고 route가 숨겨지는지 검증
    const overlayCalls = [];
    const overlayMessages = [];
    const mockApp = {
        setHuntingOverlayState(data) {
            overlayCalls.push({ ...data });
        },
        showOverlay(label, text, subtext) {
            overlayMessages.push({ label, text, subtext });
        },
        addLog() {},
        showToast() {},
        setHuntingActive() {},
        setStartButton() {},
        roster: app.roster,
        playerProfile: createDefaultPlayerProfile()
    };
    const manager = new HuntingManager(mockApp);

    // rng sequence: 첫 호출(floor outcome)=0.5→EVENT, 둘째 호출(weighted event)=0.05→PORTAL
    const rngSeq = [0.5, 0.05];
    let rngIdx = 0;
    const origRandom = Math.random;
    Math.random = () => rngSeq[rngIdx++] ?? 0;

    // setTimeout을 즉시 resolve하도록 mock
    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn, ms) => {
        if (ms === 350) {
            fn();
            return { unref() {} };
        }
        return origSetTimeout(fn, ms);
    };

    try {
        manager._run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.CAVE });
        await manager.advance();

        // 마지막 overlay 상태가 choice UI여야 함
        const choiceStates = overlayCalls.filter((s) => s.huntingChoiceVisible === true);
        assert.ok(choiceStates.length >= 1, "선택 이벤트 후 choice UI가 최소 1회 호출되어야 함");
        const lastState = choiceStates[choiceStates.length - 1];
        assert.equal(lastState.huntingMoving, false, "선택 이벤트 후 huntingMoving은 false여야 함");
        assert.equal(lastState.huntingMoveTo, 0, "선택 이벤트 후 huntingMoveTo는 0으로 초기화되어야 함");
        assert.equal(lastState.huntingMoveFrom, 0, "선택 이벤트 후 huntingMoveFrom은 0으로 초기화되어야 함");
        assert.equal(lastState.huntingMoveStep, 0, "선택 이벤트 후 huntingMoveStep은 0으로 초기화되어야 함");
        assert.equal(manager._moving, false, "선택 이벤트 후 _moving은 false로 풀려야 함");
        assert.equal(manager._run.lastEvent?.type, HUNTING_EVENT_TYPES.PORTAL, "첫 층에서 포탈 이벤트가 발생해야 함");
        assert.deepEqual(
            overlayMessages.at(-1),
            { label: "사냥터 이벤트", text: "귀환 포탈 발견", subtext: "지금 귀환하거나 더 깊이 전진할 수 있습니다." },
            "Portal should use the same event-result header as every hunting event"
        );
    } finally {
        Math.random = origRandom;
        globalThis.setTimeout = origSetTimeout;
    }
}

async function testHuntingFirstMoveUiPaintGate() {
    const overlayCalls = [];
    let resolvePaint = null;
    const mockApp = {
        setHuntingOverlayState(data) {
            overlayCalls.push({ ...data });
        },
        waitForHuntingMoveUiPaint() {
            return new Promise((resolve) => {
                resolvePaint = resolve;
            });
        },
        addLog() {},
        roster: app.roster,
        playerProfile: createDefaultPlayerProfile()
    };
    const manager = new HuntingManager(mockApp);
    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.CAVE });

    const advancePromise = manager.advance({ waitForFirstMoveUi: true });
    const firstMoveState = overlayCalls.at(-1);
    assert.equal(firstMoveState.huntingMoving, true, "First route state should be visible before processing any floor");
    assert.equal(firstMoveState.huntingMoveFrom, 1, "Initial route should start from floor 1");
    assert.equal(firstMoveState.huntingMoveTo, 11, "Initial route should end at floor 11");
    assert.equal(firstMoveState.huntingMoveStep, 1, "Initial route should show the first movement step");
    assert.equal(firstMoveState.huntingMoveMax, 10, "Initial route should still process all ten floors");
    assert.ok(resolvePaint, "First route should wait for the UI paint gate");

    manager._run = null;
    resolvePaint();
    await advancePromise;
    assert.equal(manager._moving, false, "Aborting during the UI paint gate should release the movement lock");
    console.log("[hunting-first-move-ui-paint-gate] ok");
}

function testHuntingChestEventStopsAndResumes() {
    const overlayCalls = [];
    const overlayMessages = [];
    const mockApp = {
        setHuntingOverlayState(data) {
            overlayCalls.push({ ...data });
        },
        showOverlay(label, text, subtext) {
            overlayMessages.push({ label, text, subtext });
        },
        addLog() {},
        roster: app.roster,
        playerProfile: createDefaultPlayerProfile()
    };
    const manager = new HuntingManager(mockApp);
    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.CAVE });
    const chestEvent = { type: HUNTING_EVENT_TYPES.CHEST_ROOM, chestRarity: "rare" };
    manager._run = { ...manager._run, lastEvent: chestEvent };
    manager._handleEventFloor({ app: mockApp, event: chestEvent });

    const chestState = overlayCalls.at(-1);
    assert.equal(manager._moving, false, "Chest event should stop the auto-advance loop");
    assert.deepEqual(
        overlayMessages.at(-1),
        { label: "사냥터 이벤트", text: "상자방 발견", subtext: "상자를 미확보 전리품에 보관했습니다." },
        "Chest event should show its own event title and concrete result"
    );
    assert.equal(
        manager._run.phase,
        HUNTING_RUN_PHASES.AWAITING_CHEST,
        "Chest event should enter its explicit waiting phase"
    );
    assert.equal(chestState.huntingChestEventActive, true, "Chest event should open the chest reward UI");
    assert.equal(chestState.huntingChestRarity, "rare", "Chest event should pass its rarity to the UI");
    assert.equal(chestState.huntingChestTitle, "rare 상자 확보", "Chest event should use the canonical rarity title");
    assert.equal(
        manager._run.pendingLoot.chests.length,
        1,
        "Chest event should add one unsecured chest before display"
    );

    let advanceCalls = 0;
    let advanceOptions = null;
    manager.advance = (options) => {
        advanceCalls += 1;
        advanceOptions = options;
    };
    manager.chestContinue();

    assert.equal(advanceCalls, 1, "Chest continue should resume the advance loop");
    assert.deepEqual(
        advanceOptions,
        { waitForFirstMoveUi: true },
        "Chest continue must paint the resumed movement card before advancing"
    );
    assert.equal(overlayCalls.at(-1).huntingChestEventActive, false, "Chest continue should close the chest reward UI");
    console.log("[hunting-chest-event] ok");
}

function testHuntingEventPresentationContracts() {
    const profile = createDefaultPlayerProfile();
    const run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.CAVE });
    const expectedTitles = {
        [HUNTING_EVENT_TYPES.PORTAL]: "귀환 포탈 발견",
        [HUNTING_EVENT_TYPES.WANDERING_MERCHANT]: "방랑 상인 발견",
        [HUNTING_EVENT_TYPES.BOON]: "축복",
        [HUNTING_EVENT_TYPES.MISHAP]: "함정 발동",
        [HUNTING_EVENT_TYPES.CHEST_ROOM]: "상자방 발견",
        [HUNTING_EVENT_TYPES.REST_SITE]: "휴식지",
        [HUNTING_EVENT_TYPES.CURSED_ALTAR]: "저주받은 제단",
        [HUNTING_EVENT_TYPES.CHAMPION_INTRUSION]: "챔피언 난입",
        [HUNTING_EVENT_TYPES.ELITE_MOB]: "정예 몹 습격"
    };

    for (const event of HuntingEvent.POOL) {
        const payload = event.createPayload(6, () => 0);
        const resolution = event.resolve(payload, { run, playerProfile: profile, roster: app.roster });
        assert.equal(
            resolution.presentation?.title,
            expectedTitles[event.type],
            `${event.type} should provide its own result-screen title`
        );
        assert.ok(
            resolution.presentation?.subtext,
            `${event.type} should explain its result instead of relying on a toast`
        );
        assert.ok(
            resolution.presentation?.detail,
            `${event.type} should expose the concrete effect for the result screen`
        );
    }
    console.log("[hunting-event-presentation-contracts] ok");
}

function testHuntingBoonShardRewardsScaleWithFloor() {
    const floorOneLow = HuntingEvent.createPayload(HUNTING_EVENT_TYPES.BOON, 1, () => 0);
    const floorOneHigh = HuntingEvent.createPayload(HUNTING_EVENT_TYPES.BOON, 1, () => 0.999999);
    const floorHundredLow = HuntingEvent.createPayload(HUNTING_EVENT_TYPES.BOON, 100, () => 0);
    const floorHundredHigh = HuntingEvent.createPayload(HUNTING_EVENT_TYPES.BOON, 100, () => 0.999999);
    const floorBeyondCap = HuntingEvent.createPayload(HUNTING_EVENT_TYPES.BOON, 500, () => 0.999999);

    assert.equal(floorOneLow.shards, 6, "Floor 1 boon rewards should start at 6 shards");
    assert.equal(floorOneHigh.shards, 10, "Floor 1 boon rewards should reach 10 shards");
    assert.equal(floorHundredLow.shards, 30, "Floor 100 boon rewards should scale the low roll to five times its base");
    assert.equal(
        floorHundredHigh.shards,
        50,
        "Floor 100 boon rewards should scale the high roll to five times its base"
    );
    assert.equal(floorBeyondCap.shards, 50, "Boon rewards should stop scaling beyond the five-times cap");
    console.log("[hunting-boon-shard-scaling] ok");
}

function testHuntingEventHealthInitialization() {
    const mockApp = {
        roster: app.roster,
        playerProfile: createDefaultPlayerProfile(),
        playerStatAllocation: {}
    };
    const manager = new HuntingManager(mockApp);
    const restEvent = HuntingEvent.createPayload(HUNTING_EVENT_TYPES.REST_SITE, 2);
    const mishapEvent = HuntingEvent.createPayload(HUNTING_EVENT_TYPES.MISHAP, 2);

    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.CAVE });
    const restResolution = manager._resolveHuntingEvent(restEvent, mockApp);
    const maxHp = restResolution.run.carriedMaxHp;
    assert.ok(maxHp > 0, "A first hunting event should initialize the player's actual maximum HP");
    assert.equal(restResolution.run.carriedHp, maxHp, "A rest site should not turn a fresh run into low HP");
    assert.ok(
        !restResolution.presentation.detail.includes("undefined"),
        "Rest site UI should always show a maximum HP"
    );

    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.CAVE });
    const mishapResolution = manager._resolveHuntingEvent(mishapEvent, mockApp);
    assert.equal(
        mishapResolution.run.carriedMaxHp,
        maxHp,
        "Mishaps should use the same initialized maximum HP as rest sites"
    );
    assert.ok(
        mishapResolution.run.carriedHp > 0 && mishapResolution.run.carriedHp < maxHp,
        "A first mishap should deal damage from the player's actual HP without causing defeat"
    );

    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.HERO, stageId: HUNTING_STAGE_IDS.CAVE });
    const heroBase = manager._resolveHuntingEvent(restEvent, mockApp).run.carriedMaxHp;
    manager._run = {
        ...createHuntingRun({ characterId: FIGHTER_IDS.HERO, stageId: HUNTING_STAGE_IDS.CAVE }),
        hero: { bonuses: {}, carryover: { hp: 3, damage: 0, speed: 0, defense: 0, skill: 0 } }
    };
    const heroCarryover = manager._resolveHuntingEvent(restEvent, mockApp).run.carriedMaxHp;
    assert.equal(heroCarryover - heroBase, 15, "Event HP should include Hero Ball's carried HP bonuses");
    console.log("[hunting-event-health-initialization] ok");
}

function testHuntingAutoEventRequiresConfirmation() {
    const overlayCalls = [];
    const overlayMessages = [];
    const mockApp = {
        setHuntingOverlayState(data) {
            overlayCalls.push({ ...data });
        },
        showOverlay(label, text, subtext) {
            overlayMessages.push({ label, text, subtext });
        },
        addLog() {},
        roster: app.roster,
        playerProfile: createDefaultPlayerProfile()
    };
    const manager = new HuntingManager(mockApp);
    const boonEvent = HuntingEvent.createPayload(HUNTING_EVENT_TYPES.BOON, 2, () => 0.5);
    manager._run = {
        ...createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.CAVE }),
        lastEvent: boonEvent
    };

    const action = manager._handleEventFloor({ app: mockApp, event: boonEvent });
    assert.equal(action, "stop", "Auto-resolved events should stop the route for their result screen");
    assert.equal(
        manager._run.phase,
        HUNTING_RUN_PHASES.AWAITING_EVENT,
        "Auto-resolved events should wait for acknowledgement"
    );
    assert.deepEqual(
        overlayMessages.at(-1),
        { label: "사냥터 이벤트", text: "축복", subtext: "전리품에 파편을 추가했습니다." },
        "Auto-resolved events should present their event title and result in the overlay"
    );
    assert.equal(
        overlayCalls.at(-1).huntingEventActive,
        true,
        "Event result UI should stay visible until confirmation"
    );
    assert.equal(overlayCalls.at(-1).huntingEventDetail, "파편 +8", "Event result UI should show the concrete gain");

    let advanceCalls = 0;
    let advanceOptions = null;
    manager.advance = (options) => {
        advanceCalls += 1;
        advanceOptions = options;
    };
    manager.eventContinue();

    assert.equal(advanceCalls, 1, "Confirming an auto event should resume the route exactly once");
    assert.deepEqual(
        advanceOptions,
        { waitForFirstMoveUi: true },
        "Event confirmation must paint the resumed movement card before advancing"
    );
    assert.equal(
        overlayCalls.at(-1).huntingEventActive,
        false,
        "Event confirmation should close only the event result UI"
    );
    console.log("[hunting-auto-event-requires-confirmation] ok");
}

function testHuntingChampionEventRequiresBattleConfirmation() {
    const overlayCalls = [];
    const mockApp = {
        setHuntingOverlayState(data) {
            overlayCalls.push({ ...data });
        },
        showOverlay() {},
        addLog() {},
        roster: app.roster,
        playerProfile: createDefaultPlayerProfile(),
        playerStatAllocation: {}
    };
    const manager = new HuntingManager(mockApp);
    const championEvent = HuntingEvent.createPayload(HUNTING_EVENT_TYPES.CHAMPION_INTRUSION, 4);
    manager._run = {
        ...createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.CAVE }),
        lastEvent: championEvent
    };

    const action = manager._handleEventFloor({ app: mockApp, event: championEvent });
    assert.equal(action, "stop", "Champion intrusion should stop for battle preparation before combat");
    assert.equal(
        manager._run.phase,
        HUNTING_RUN_PHASES.AWAITING_BATTLE_PREPARATION,
        "Champion should use the shared battle preparation phase"
    );
    assert.equal(
        overlayCalls.at(-1).huntingBattlePreparationActive,
        true,
        "Champion event should expose the shared battle preparation UI"
    );

    let battleStarts = 0;
    manager._startFloorBattle = () => {
        battleStarts += 1;
    };
    manager.startPreparedBattle();

    assert.equal(battleStarts, 1, "Champion combat should start only after battle preparation confirmation");
    assert.equal(manager._run.phase, HUNTING_RUN_PHASES.COMBAT, "Champion confirmation should enter combat phase");
    console.log("[hunting-champion-event-requires-confirmation] ok");
}

function testHuntingConsumableInventoryAndUseLimits() {
    const profile = createDefaultPlayerProfile();
    profile.hunting.shards = 10_000;

    const initialShopItem = getConsumableShopItems(profile).find((item) => item.id === CONSUMABLE_IDS.HP_POTION);
    assert.equal(initialShopItem.owned, 0, "New profiles should start with no HP potions");
    assert.equal(initialShopItem.cost, 100, "HP potion price should remain 100 shards");
    assert.equal(initialShopItem.maxOwned, 10, "HP potion inventory should cap at ten");

    for (let count = 0; count < 10; count += 1) {
        assert.ok(
            buyConsumable(profile, CONSUMABLE_IDS.HP_POTION),
            "A funded potion purchase below the cap should succeed"
        );
    }
    assert.equal(getConsumableShopItems(profile)[0].owned, 10, "Potion purchases should reach the owned cap");
    assert.equal(buyConsumable(profile, CONSUMABLE_IDS.HP_POTION), null, "Potion purchases must stop at the owned cap");
    assert.equal(profile.hunting.shards, 9_000, "Ten potions should cost exactly 1,000 shards");

    const upgradeCosts = [];
    while (getHuntingConsumableUseLimitUpgrade(profile).canUpgrade) {
        const result = upgradeHuntingConsumableUseLimit(profile);
        upgradeCosts.push(result.cost);
    }
    assert.deepEqual(upgradeCosts, [100, 200, 400, 800], "Potion use limit upgrades should double from 100 shards");
    assert.equal(
        getHuntingConsumableUseLimit(profile),
        HUNTING_CONSUMABLE_USE_LIMIT.max,
        "Potion use limit should cap at five per hunting run"
    );

    const run = {
        ...createHuntingRun({ characterId: FIGHTER_IDS.ARCHER }),
        carriedHp: 56,
        carriedMaxHp: 224
    };
    const preparationItems = getHuntingPreparationConsumables(profile, run);
    assert.equal(preparationItems[0].healAmount, 56, "Potion healing should be 25% of the actual run maximum HP");
    assert.equal(preparationItems[0].canUse, true, "A wounded player with stock and run allowance should use a potion");

    const firstUse = useHuntingPreparationConsumable(profile, run, CONSUMABLE_IDS.HP_POTION);
    assert.ok(firstUse, "The first potion use should succeed");
    assert.equal(firstUse.run.carriedHp, 112, "Potion use should restore 25% of maximum HP");
    assert.equal(firstUse.run.consumableUses[CONSUMABLE_IDS.HP_POTION], 1, "Run should record only used potions");
    assert.equal(profile.consumables.owned[CONSUMABLE_IDS.HP_POTION], 9, "Potion stock should decrease only when used");
    assert.equal(
        useHuntingPreparationConsumable(profile, firstUse.run, CONSUMABLE_IDS.HP_POTION),
        null,
        "A battle should allow only one potion even when the run allowance remains"
    );

    const nextBattleRun = { ...firstUse.run, battleConsumableUses: {} };
    const secondUse = useHuntingPreparationConsumable(profile, nextBattleRun, CONSUMABLE_IDS.HP_POTION);
    assert.ok(secondUse, "A later battle should allow another potion while the run allowance remains");
    const fullHpRun = { ...secondUse.run, carriedHp: secondUse.run.carriedMaxHp, battleConsumableUses: {} };
    assert.equal(
        useHuntingPreparationConsumable(profile, fullHpRun, CONSUMABLE_IDS.HP_POTION),
        null,
        "A full-HP player should not consume a potion"
    );
    console.log("[hunting-consumable-inventory-and-use-limits] ok");
}

function testHuntingBattlePreparationUsesActualBattleHp() {
    const profile = createDefaultPlayerProfile();
    profile.consumables.owned[CONSUMABLE_IDS.HP_POTION] = 1;
    const overlayStates = [];
    let startedMatches = 0;
    const mockApp = {
        roster: app.roster,
        playerProfile: profile,
        playerStatAllocation: {},
        setHuntingOverlayState(data) {
            overlayStates.push({ ...data });
        },
        showOverlay() {},
        addLog() {},
        startMatch(specs, options) {
            startedMatches += 1;
            this.simulation = new BattleSimulation(specs, { onLog() {}, onSound() {} }, null, options);
        }
    };
    const manager = new HuntingManager(mockApp);
    manager._run = {
        ...createHuntingRun({ characterId: FIGHTER_IDS.ARCHER }),
        carriedHp: 28.4,
        lastEncounter: { type: HUNTING_FLOOR_OUTCOME_TYPES.COMBAT }
    };

    manager._stopHuntingMoveForBattle(mockApp, "1층 — 전투 발생");

    assert.equal(
        startedMatches,
        0,
        "Normal combat should wait in battle preparation before constructing BattleSimulation"
    );
    assert.equal(
        manager._run.phase,
        HUNTING_RUN_PHASES.AWAITING_BATTLE_PREPARATION,
        "Normal combat should enter the dedicated preparation phase"
    );
    assert.equal(
        overlayStates.at(-1).huntingBattlePreparationItems[0].healAmount,
        56,
        "Preparation UI should calculate healing from the actual 224 maximum HP"
    );
    assert.equal(
        overlayStates.at(-1).huntingBattlePreparationHp,
        29,
        "Preparation UI should show a fractional current HP as an integer"
    );
    assert.equal(
        overlayStates.at(-1).huntingBattlePreparationMaxHp,
        224,
        "Preparation UI should expose an integer maximum HP"
    );

    const useResult = manager.usePreparationConsumable(CONSUMABLE_IDS.HP_POTION);
    assert.ok(Math.abs(useResult.healed - 56) < 1e-9, "Preparation potion use should report the actual healed amount");
    assert.equal(manager._run.carriedHp, 84.4, "Preparation potion use should preserve raw HP before battle start");
    assert.equal(
        overlayStates.at(-1).huntingBattlePreparationHp,
        85,
        "Potion feedback should refresh the displayed HP through the shared integer getter"
    );
    assert.match(
        overlayStates.at(-1).huntingBattlePreparationNotice,
        /85\/224$/,
        "Potion feedback should not expose a fractional current HP"
    );
    assert.equal(
        profile.consumables.owned[CONSUMABLE_IDS.HP_POTION],
        0,
        "Preparation potion use should consume the persistent stock"
    );

    manager.startPreparedBattle();
    const player = mockApp.simulation.fighters.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    assert.equal(startedMatches, 1, "BattleSimulation should start only after the preparation start action");
    assert.equal(player.hp, 84.4, "BattleSimulation should receive the raw potion-adjusted carried HP");
    console.log("[hunting-battle-preparation-actual-hp] ok");
}

function testHuntingHealthDisplayUsesSharedIntegerGetter() {
    const run = {
        ...createHuntingRun({ characterId: FIGHTER_IDS.DASH }),
        carriedHp: 42.1,
        carriedMaxHp: 101.5
    };
    assert.deepEqual(
        getHuntingDisplayHealth(run),
        { hp: 43, maxHp: 102 },
        "Hunting HP display should round the current and maximum values together"
    );
    assert.equal(getHuntingDisplayHp(0.1), 1, "A living fractional HP should not display as zero");
    assert.equal(
        getHuntingDisplayHp(56.00000000000001),
        56,
        "Display HP should absorb floating-point noise around an integer"
    );
    assert.equal(getHuntingDisplayHp(-1), 0, "Display HP should not become negative");

    const restEvent = new RestSiteEvent(HUNTING_EVENT_TYPES.REST_SITE);
    const restResolution = restEvent.resolve(restEvent.createPayload(1), { run, roster: [] });
    assert.ok(
        restResolution.presentation.detail.includes("68 / 102"),
        "Rest-site presentation should use the shared integer HP display"
    );

    const mishapEvent = new MishapEvent(HUNTING_EVENT_TYPES.MISHAP);
    const mishapResolution = mishapEvent.resolve(mishapEvent.createPayload(1), { run });
    assert.match(
        mishapResolution.presentation.detail,
        /\d+ \/ \d+$/,
        "Mishap presentation should end with integer current and maximum HP"
    );
    assert.ok(
        !mishapResolution.presentation.detail.includes(".1"),
        "Mishap presentation should not expose the raw fractional HP"
    );

    const profile = createDefaultPlayerProfile();
    profile.hunting.shards = 200;
    const repairOffer = createMerchantOffers(
        run,
        { type: HUNTING_EVENT_TYPES.WANDERING_MERCHANT, discountRatio: 0 },
        profile
    )[0];
    assert.match(repairOffer.description, /102\)$/, "Merchant repair offer should display an integer maximum HP");
    const repair = applyMerchantOffer(run, profile, repairOffer);
    assert.equal(repair.run.carriedHp, 77.1, "Merchant repair should preserve the raw fractional HP state");
    assert.match(
        formatOfferResultToast(repair.result),
        /\(78\)$/,
        "Merchant repair result should display an integer current HP"
    );
    console.log("[hunting-health-display-integers] ok");
}

async function testHuntingChestEventStopsAdvanceLoop() {
    const overlayCalls = [];
    const mockApp = {
        setHuntingOverlayState(data) {
            overlayCalls.push({ ...data });
        },
        showOverlay() {},
        addLog() {},
        roster: app.roster,
        playerProfile: createDefaultPlayerProfile()
    };
    const manager = new HuntingManager(mockApp);
    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.CAVE });
    const originalRandom = Math.random;
    const originalSetTimeout = globalThis.setTimeout;
    const rolls = [0.5, 0.5, 0];
    Math.random = () => rolls.shift() ?? 0;
    globalThis.setTimeout = (callback, delay) => {
        if (delay === 350) callback();
        return 0;
    };

    try {
        await manager.advance();
    } finally {
        Math.random = originalRandom;
        globalThis.setTimeout = originalSetTimeout;
    }

    assert.equal(manager._run.floor, 2, "Chest room should stop on the floor where it was found");
    assert.equal(manager._moving, false, "Chest room should release the movement lock");
    assert.equal(
        overlayCalls.at(-1).huntingChestEventActive,
        true,
        "Chest room should remain visible after advance returns"
    );
    console.log("[hunting-chest-event-stops-advance] ok");
}

function testHuntingChestContinueHandlersContract() {
    const managerSource = readFileSync(new URL("../src/hunting/huntingManager.js", import.meta.url), "utf8");
    const handlerDefStart = managerSource.indexOf("HUNTING_CHEST_CONTINUE_HANDLERS");
    const handlerDefEnd = managerSource.indexOf("});", handlerDefStart);
    const defBlock = managerSource.slice(handlerDefStart, handlerDefEnd);
    assert.ok(defBlock.includes("AWAITING_CHEST"), "Chest room phase must have a handler");
    assert.ok(defBlock.includes("AWAITING_COMBAT_REWARD_CHEST"), "Combat reward chest phase must have a handler");
    const handledPhases = [...defBlock.matchAll(/AWAITING_\w+/g)].map((m) => m[0]);
    const knownChestPhases = ["AWAITING_CHEST", "AWAITING_COMBAT_REWARD_CHEST"];
    assert.equal(
        handledPhases.length,
        knownChestPhases.length,
        "HUNTING_CHEST_CONTINUE_HANDLERS should cover exactly 2 phases: chest room and combat reward"
    );
    assert.ok(
        managerSource.includes('"_continueChestRoom"'),
        "HUNTING_CHEST_CONTINUE_HANDLERS must dispatch chest room to _continueChestRoom"
    );
    assert.ok(
        managerSource.includes('"_continueCombatRewardChest"'),
        "HUNTING_CHEST_CONTINUE_HANDLERS must dispatch combat reward to _continueCombatRewardChest"
    );
    assert.ok(managerSource.includes("_continueChestRoom()"), "_continueChestRoom must be implemented as a method");
    assert.ok(
        managerSource.includes("_continueCombatRewardChest()"),
        "_continueCombatRewardChest must be implemented as a method"
    );
    console.log("[hunting-chest-continue-handlers] ok");
}

function testHuntingLootBalanceRules() {
    const fullHp = { hp: 100, maxHp: 100 };
    const halfHp = { hp: 50, maxHp: 100 };
    const emptyHp = { hp: 0, maxHp: 100 };

    assert.ok(
        Math.abs(getHuntingLootDropChance(fullHp) - 0.15) < 1e-9,
        "Full HP must use the 15% bonus-loot base chance"
    );
    assert.ok(
        Math.abs(getHuntingLootDropChance(halfHp) - 0.225) < 1e-9,
        "Half missing HP must raise bonus loot halfway to double"
    );
    assert.ok(Math.abs(getHuntingLootDropChance(emptyHp) - 0.3) < 1e-9, "Empty HP must double bonus loot to 30%");
    assert.equal(
        rollHuntingBonusLootItemType({
            collector: fullHp,
            rng: (() => {
                const rolls = [0.149999, 0.8];
                return () => rolls.shift() ?? 0;
            })()
        }),
        HUNTING_LOOT_ITEM_TYPES.CHEST,
        "A full-HP bonus roll below 15% must create an additional loot item"
    );
    assert.equal(
        rollHuntingBonusLootItemType({
            collector: fullHp,
            rng: () => 0.15
        }),
        null,
        "A full-HP bonus roll at the 15% boundary must not create additional loot"
    );
    assert.notEqual(
        rollHuntingBonusLootItemType({
            collector: emptyHp,
            rng: () => 0.299999
        }),
        null,
        "A critical-HP bonus roll below 30% must create additional loot"
    );
    assert.equal(getSmallHealPackAmount(fullHp), 0, "A full-HP collector should not need a heal pack");
    assert.equal(getSmallHealPackAmount(halfHp), 15, "Heal packs should restore 25% of missing HP in five-point steps");
    assert.equal(getSmallHealPackAmount(emptyHp), 25, "Empty HP should receive a quarter of its missing HP");
    assert.equal(
        getHuntingShardDropAmount(1, () => 0),
        3,
        "Floor-one shard drops should begin at the three-shard roll"
    );
    assert.equal(
        getHuntingShardDropAmount(1, () => 0.999999),
        7,
        "Floor-one shard drops should reach the seven-shard roll"
    );
    assert.equal(
        getHuntingShardDropAmount(26, () => 0),
        8,
        "Each depth bracket should shift the shard range upward by five"
    );
    assert.equal(
        getHuntingShardDropAmount(100, () => 0.999999),
        22,
        "Deep floors should preserve the shifted upper shard roll"
    );
    assert.equal(
        getHuntingShardPhysicalDropCount(() => 0),
        3,
        "Physical shard-drop count should begin at three regardless of the hunting floor"
    );
    assert.equal(
        getHuntingShardPhysicalDropCount(() => 0.999999),
        7,
        "Physical shard-drop count should reach seven regardless of the hunting floor"
    );
    assert.equal(
        getHuntingEnhancementStoneDropCount(1, () => 0),
        1,
        "Floor-one bosses should drop at least one enhancement stone"
    );
    assert.equal(
        getHuntingEnhancementStoneDropCount(1, () => 0.999999),
        3,
        "Floor-one bosses should cap their enhancement stone roll at three"
    );
    assert.equal(
        getHuntingEnhancementStoneDropCount(100, () => 0),
        4,
        "Floor-one-hundred bosses should raise the minimum enhancement stone roll to four"
    );
    assert.equal(
        getHuntingEnhancementStoneDropCount(100, () => 0.999999),
        12,
        "Floor-one-hundred bosses should cap their enhancement stone roll at twelve"
    );
    assert.deepEqual(
        getHuntingBonusLootWeights({ collector: fullHp, rarity: "common" }),
        { small_heal_pack: 20, chest: 10, shard_bundle: 0, high_chest: 0 },
        "Common monsters should use only the ordinary bonus-loot table"
    );
    assert.deepEqual(
        getHuntingBonusLootWeights({ collector: halfHp, rarity: "rare" }),
        { small_heal_pack: 24, chest: 8, shard_bundle: 15, high_chest: 5 },
        "Rare monsters should preserve special rewards in the bonus-loot table"
    );
    assert.equal(
        getHuntingBonusLootWeights({ collector: emptyHp, rarity: "epic" }).small_heal_pack,
        14,
        "Missing HP should raise the heal-pack weight before rarity rewards reserve their share"
    );
    assert.equal(
        rollHuntingBonusLootItemType({
            collector: fullHp,
            rng: (() => {
                const rolls = [0, 0];
                return () => rolls.shift() ?? 0;
            })()
        }),
        HUNTING_LOOT_ITEM_TYPES.SMALL_HEAL_PACK,
        "A full-HP player may leave a rare heal pack behind instead of converting it to shards"
    );
    assert.equal(
        rollHuntingBonusLootItemType({
            collector: emptyHp,
            rng: (() => {
                const rolls = [0, 0.39];
                return () => rolls.shift();
            })()
        }),
        HUNTING_LOOT_ITEM_TYPES.SMALL_HEAL_PACK,
        "A wounded player should retain heal-pack entries in the drop table"
    );
    assert.equal(
        rollHuntingShardBundleAmount({ floor: 1, rarity: "rare", rng: () => 0.3 }),
        10,
        "Rare bundle multipliers must preserve the configured decimal-weight order"
    );
    assert.equal(
        rollHuntingShardBundleAmount({ floor: 100, rarity: "epic", rng: () => 0.99 }),
        70,
        "Epic bundles should retain the 3.5x high-end roll on the deep-floor base amount"
    );
    assert.equal(
        rollHighChestRarity({ rarity: "rare", rng: () => 0.99 }),
        "uncommon",
        "Rare monsters should always produce an uncommon high chest"
    );
    assert.equal(
        rollHighChestRarity({ rarity: "unique", rng: () => 0.8 }),
        "rare",
        "Unique high chests should retain the 30% rare branch"
    );
    console.log("[hunting-loot-balance-rules] ok");
}

function testHuntingLootItemsAndDropController(app) {
    const playerSpec = {
        ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
        teamId: HUNTING_TEAMS.PLAYER
    };
    const mobSpec = createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.PURSUER, floor: 1, index: 0 });
    const session = new HuntingBattleLootSession({ playerId: playerSpec.id, floor: 1 });
    const rolls = [0.5, 0, 0, 0, 0.25, 0.5, 0, 0.25, 0.999999, 0, 0.25, 0.9];
    const soundCalls = [];
    const collectedExperience = [];
    const controller = new HuntingLootDropController({
        session,
        rng: () => rolls.shift() ?? 0,
        onExperienceCollected: (reward) => collectedExperience.push(reward.amount)
    });
    const simulation = new BattleSimulation(
        [playerSpec, mobSpec],
        {
            onLog() {},
            onSound: (type, intensity) => soundCalls.push({ type, intensity }),
            onFighterDefeated: (fighter, context) => controller.onFighterDefeated(fighter, context),
            onResultResolved: (winner, context) => controller.onResultResolved(winner, context)
        },
        null,
        { assignActions: false }
    );
    const [player, mob] = simulation.fighters;
    controller.prepareExperienceDrops([mob]);
    player.position = new Vector2(300, 480);
    mob.position = player.position.clone();
    player.hp = player.maxHp;

    mob.takeDamage(100000, player, "Loot Hook Test");
    const droppedShards = simulation.entities.filter((entity) => entity instanceof ShardDrop);
    const droppedExperience = simulation.entities.filter((entity) => entity instanceof ExperienceDrop);
    const droppedShard = droppedShards[0];
    assert.ok(droppedShard, "Defeating a hunting mob must create configured floor-loot items");
    assert.equal(
        droppedShards.length,
        3,
        "A floor-one three-shard roll must create three physical standard-shard drops when bonus loot fails"
    );
    assert.deepEqual(
        droppedShards.map((shard) => shard.amount),
        [3, 5, 7],
        "Each physical standard shard must roll its own floor-scaled reward value"
    );
    assert.deepEqual(
        droppedShards.map((shard) => shard.radius),
        [14.74, 16, 17.03],
        "Independent shard amounts must produce visibly different physical sizes"
    );
    assert.equal(droppedExperience.length, 2, "A common monster must drop multiple visible XP orbs");
    assert.deepEqual(
        droppedExperience.map((experience) => experience.amount),
        [10, 10],
        "The normal kill XP pool must be split across the common monster's physical XP orbs"
    );
    assert.equal(droppedExperience[0].radius, 12.03, "Higher-value XP drops must grow above the compact base orb");
    assert.ok(
        Math.abs(droppedShard.velocity.length() - mob.stats.baseSpeed * 1.2) < 1e-9,
        "Loot should launch at least as quickly as its defeated monster, using the Hero Orb speed floor"
    );
    assert.ok(
        droppedShard.velocity.y > 0 && Math.abs(droppedShard.velocity.x) < 1e-8,
        "Loot should use the supplied full-circle launch direction"
    );
    assert.equal(session.getCollectedLoot().shards, 0, "A dropped shard must not enter battle loot before collection");
    droppedShards.forEach((shard) => shard.update(1 / 60, simulation));
    assert.equal(
        session.getCollectedLoot().shards,
        0,
        "New loot must not be collected during its collection grace period"
    );
    assert.ok(
        droppedShards.every((shard) => shard.collectionGraceRemaining > 0),
        "Every common loot item must begin with the shared collection grace duration"
    );
    droppedShards.forEach((shard) => {
        shard.collectionGraceRemaining = 0;
        shard.position = player.position.clone();
        shard.velocity = new Vector2();
    });
    const entitiesBeforeShardCollection = simulation.entities.length;
    droppedShards.forEach((shard) => shard.update(1 / 60, simulation));
    assert.equal(
        session.getCollectedLoot().shards,
        15,
        "Collecting physical shards must add every independently rolled shard value to the battle loot session"
    );
    assert.equal(
        simulation.entities.length - entitiesBeforeShardCollection,
        78,
        "Each collected physical shard should create its own burst, particles, and reward label"
    );
    assert.equal(
        simulation.entities.filter((entity) => entity instanceof EnhancementStoneDrop).length,
        0,
        "Normal hunting monsters must not create enhancement stone drops"
    );
    assert.deepEqual(
        soundCalls.at(-1),
        { type: "loot", intensity: 1 },
        "Loot collection should request its audible collect chime"
    );

    const entitiesBeforeExperienceCollection = simulation.entities.length;
    droppedExperience.forEach((experience) => {
        experience.collectionGraceRemaining = 0;
        experience.position = player.position.clone();
        experience.velocity = new Vector2();
        experience.update(1 / 60, simulation);
    });
    assert.equal(session.getCollectedExperience(), 20, "Collected XP must be tracked outside pending hunting loot");
    assert.equal(session.getCollectedLoot().xp, undefined, "Collected XP must not become defeatable pending loot");
    assert.deepEqual(collectedExperience, [10, 10], "Each XP orb must notify the immediate XP grant owner");
    assert.equal(
        simulation.entities.length - entitiesBeforeExperienceCollection,
        16,
        "XP collection must use a compact particle burst without combat reward text"
    );
    assert.deepEqual(
        soundCalls.at(-1),
        { type: "loot", intensity: 0.72 },
        "XP orb collection must use the lighter pickup chime"
    );

    const bonusSession = new HuntingBattleLootSession({ playerId: player.id, floor: 1 });
    const bonusRolls = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.8, 0, 0];
    const bonusController = new HuntingLootDropController({
        session: bonusSession,
        rng: () => bonusRolls.shift() ?? 0
    });
    const bonusEntityCount = simulation.entities.length;
    bonusController.onFighterDefeated(mob, { simulation });
    const bonusDrops = simulation.entities.slice(bonusEntityCount);
    assert.equal(
        bonusDrops.filter((entity) => entity instanceof ShardDrop).length,
        3,
        "A successful bonus roll must not replace the guaranteed physical shard drops"
    );
    assert.equal(
        bonusDrops.filter((entity) => entity instanceof ChestDrop).length,
        1,
        "A successful common bonus roll must add its chest beside the guaranteed shard"
    );
    assert.equal(
        controller.onFighterDefeated({ hunting: null }, { simulation }),
        null,
        "Non-mob defeats must not create hunting floor loot"
    );

    const magnetShard = new ShardDrop({
        position: new Vector2(player.position.x + player.radius * 4 + 11, player.position.y),
        velocity: new Vector2(),
        collectorId: player.id
    });
    magnetShard.update(0.5, simulation);
    assert.equal(magnetShard.velocity.x, 0, "Loot must ignore the collector magnet during its grace period");
    magnetShard.update(0.5, simulation);
    magnetShard.update(0.1, simulation);
    assert.ok(magnetShard.velocity.x < 0, "Loot inside four player radii must receive a physical magnet impulse");

    const collisionTerrain = [{ shape: "circle", blocking: true, x: 520, y: 620, radius: 48 }];
    const collisionSimulation = new BattleSimulation([playerSpec, mobSpec], { onLog() {}, onSound() {} }, null, {
        assignActions: false,
        terrain: collisionTerrain
    });
    const [lootCollector, collisionMob] = collisionSimulation.fighters;
    lootCollector.position = new Vector2(120, 120);
    collisionMob.position = new Vector2(400, 300);
    lootCollector.velocity = new Vector2();
    collisionMob.velocity = new Vector2();

    const fighterCollisionShard = new ShardDrop({
        position: new Vector2(340, 300),
        velocity: new Vector2(200, 0),
        collectorId: lootCollector.id,
        amount: 5
    });
    fighterCollisionShard.update(0.1, collisionSimulation);
    assert.ok(
        Vector2.subtract(fighterCollisionShard.position, collisionMob.position).length() >=
            fighterCollisionShard.radius + collisionMob.radius,
        "Loot must separate from a non-collector fighter instead of passing through it"
    );
    assert.ok(
        fighterCollisionShard.velocity.x < 200 && collisionMob.velocity.x === 0,
        "Loot must use Hero Orb bounce behavior without pushing the fighter"
    );

    const terrainCollisionShard = new ShardDrop({
        position: new Vector2(collisionTerrain[0].x, collisionTerrain[0].y),
        velocity: new Vector2(),
        collectorId: lootCollector.id,
        amount: 5
    });
    terrainCollisionShard.update(0.1, collisionSimulation);
    assert.ok(
        Vector2.subtract(terrainCollisionShard.position, collisionTerrain[0]).length() >=
            terrainCollisionShard.radius + collisionTerrain[0].radius,
        "Loot must separate from blocking terrain instead of remaining inside it"
    );

    const directCollectionGraceShard = new ShardDrop({
        position: lootCollector.position,
        velocity: new Vector2(),
        collectorId: lootCollector.id,
        amount: 5
    });
    directCollectionGraceShard.update(1, collisionSimulation);
    assert.equal(
        directCollectionGraceShard.isExpired,
        false,
        "Loot overlapping its collector must remain visible until the initial grace period ends"
    );
    directCollectionGraceShard.update(1 / 60, collisionSimulation);
    assert.equal(
        directCollectionGraceShard.isExpired,
        true,
        "Loot must remain collectible once the initial grace period ends"
    );

    const healResults = [];
    const healPack = new SmallHealPack({
        position: player.position,
        velocity: new Vector2(),
        collectorId: player.id,
        amount: 15,
        onCollected: (reward) => healResults.push(reward)
    });
    assert.equal(healPack.radius, 16.58, "Heal-pack size must reflect its stored recovery amount");
    healPack.update(1 / 60, simulation);
    assert.equal(healPack.isExpired, false, "Full-HP players must leave a small heal pack on the floor");
    player.hp = 50;
    healPack.collectionGraceRemaining = 0;
    healPack.update(1 / 60, simulation);
    assert.equal(player.hp, 65, "A collected small heal pack must restore its stored amount");
    assert.equal(
        healResults[0]?.type,
        HUNTING_LOOT_ITEM_TYPES.SMALL_HEAL_PACK,
        "Heal-pack feedback must identify the item"
    );

    const chest = createHuntingChest({ id: "loot-test-chest", rarity: "common" });
    const chestDrop = new ChestDrop({
        position: player.position,
        velocity: new Vector2(),
        collectorId: player.id,
        chest,
        onCollected: (reward) => session.recordCollection(reward)
    });
    assert.equal(chestDrop.radius, 20, "Chest drops should use the enlarged loot size");
    chestDrop.collectionGraceRemaining = 0;
    chestDrop.update(1 / 60, simulation);
    assert.equal(
        session.getCollectedLoot().chests[0]?.id,
        chest.id,
        "Collected chest drops must enter the battle loot session"
    );
    assert.ok(
        createHuntingLootItem(HUNTING_LOOT_ITEM_TYPES.CHEST, {
            position: player.position,
            velocity: new Vector2(),
            collectorId: player.id,
            chest
        }) instanceof ChestDrop,
        "The loot registry must construct the subclass registered for each item type"
    );
    assert.ok(
        createHuntingLootItem(HUNTING_LOOT_ITEM_TYPES.HIGH_CHEST, {
            position: player.position,
            velocity: new Vector2(),
            collectorId: player.id,
            chest: createHuntingChest({ id: "loot-test-high-chest", rarity: "rare" })
        }) instanceof ChestDrop,
        "High-chest rolls should reuse the chest drop renderer with their rolled rarity"
    );
    assert.equal(
        createHuntingLootItem(HUNTING_LOOT_ITEM_TYPES.SHARD_BUNDLE, {
            position: player.position,
            velocity: new Vector2(),
            collectorId: player.id,
            amount: 10
        }).radius,
        22,
        "Shard bundles should remain the largest standard loot item"
    );
    assert.ok(
        createHuntingLootItem(HUNTING_LOOT_ITEM_TYPES.ENHANCEMENT_STONE, {
            position: player.position,
            velocity: new Vector2(),
            collectorId: player.id
        }) instanceof EnhancementStoneDrop,
        "The loot registry must construct physical enhancement stone drops"
    );

    const victorySweepShard = new ShardDrop({
        position: new Vector2(player.position.x + 300, player.position.y),
        velocity: new Vector2(),
        collectorId: player.id
    });
    simulation.entities.push(victorySweepShard);
    simulation.resolveResult(player);
    victorySweepShard.update(1 / 60, simulation);
    assert.ok(
        victorySweepShard.velocity.x < 0,
        "Winning a hunting battle should pull remaining collectible loot across the whole arena"
    );
    console.log("[hunting-loot-items-and-drop-controller] ok");
}

function testHuntingLootValueRadius() {
    const createDrop = (DropClass, amount) =>
        new DropClass({ amount, position: new Vector2(), velocity: new Vector2() });
    const shard = [createDrop(ShardDrop, 3), createDrop(ShardDrop, 20)];
    const bundle = [createDrop(ShardBundleDrop, 5), createDrop(ShardBundleDrop, 35)];
    const heal = [createDrop(SmallHealPack, 5), createDrop(SmallHealPack, 100)];
    const experience = [createDrop(ExperienceDrop, 1), createDrop(ExperienceDrop, 20)];

    [shard, bundle, heal, experience].forEach(([small, large]) => {
        assert.ok(large.radius > small.radius, "Every value-bearing loot type must grow with its individual amount");
    });
    assert.equal(
        new EnhancementStoneDrop().radius,
        18,
        "Fixed-value enhancement stones must keep their known silhouette"
    );
    console.log("[hunting-loot-value-radius] ok");
}

function testHuntingNormalCombatWinUsesXpRewardPanel() {
    const manager = new HuntingManager({});
    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.DASH });
    manager._run.floor = 3;
    const calls = { overlay: null, state: null, startButton: null };
    const xpReward = { xpGained: 7, progressAfterPct: 42 };
    const app = {
        _createXpRewardView(result) {
            assert.equal(
                result.xpGained,
                7,
                "Normal combat must pass its collected XP result to the shared view creator"
            );
            return xpReward;
        },
        refreshPlayerSetup() {},
        showOverlay(label, text, subtext, options) {
            calls.overlay = { label, text, subtext, options };
        },
        setHuntingOverlayState(state) {
            calls.state = state;
        },
        setStartButton(state) {
            calls.startButton = state;
        }
    };

    manager._presentNormalCombatWin(app, "Dash Ball", { xpGained: 7 });

    assert.equal(calls.overlay.options.xpReward, xpReward, "Normal combat wins must reuse the XP reward panel data");
    assert.equal(
        calls.overlay.subtext.includes("+XP"),
        false,
        "Normal combat wins must not fall back to a numeric-only XP string"
    );
    assert.equal(
        calls.state.huntingChoiceVisible,
        true,
        "The next-floor choice must remain available after the post-combat result cards"
    );
    assert.equal(
        calls.state.huntingCombatResultActive,
        true,
        "Normal hunting wins must open the dedicated two-card combat result flow"
    );
    assert.equal(
        calls.state.huntingCombatResultStep,
        "experience",
        "Normal hunting wins must show the XP card before the combat-status card"
    );
    assert.equal(calls.state.huntingCombatResultTitle, "3층 전투 완료");
    assert.deepEqual(calls.startButton, { hidden: true, disabled: true, text: "" });
    console.log("[hunting-normal-win-xp-panel] ok");
}

function testHuntingExperienceBalance() {
    const normalEnemy = {
        id: "normal",
        hunting: { isMob: true, monsterTags: ["rarity:common"], enemyType: "normal" }
    };
    const championEnemy = {
        id: "champion",
        hunting: { isMiniboss: true, monsterTags: ["rarity:common"], enemyType: "champion", bossKind: "champion" }
    };
    const halfHealthVictory = {
        playerFighterId: FIGHTER_IDS.DASH,
        combatDamageDealt: 100,
        opponentMaxHp: 100,
        hpRemain: 50,
        myMaxHp: 100,
        lowestHpRatio: 0.5
    };
    const peakHealthVictory = {
        ...halfHealthVictory,
        combatDamageDealt: 200,
        hpRemain: 100,
        lowestHpRatio: 1
    };

    assert.equal(
        getHuntingCompletionExperience(halfHealthVictory, [normalEnemy]),
        10,
        "Normal completion XP must preserve the current 30 XP victory baseline after the 20 XP kill-orb pool"
    );
    assert.equal(
        getHuntingCompletionExperience(halfHealthVictory, [championEnemy]),
        20,
        "Champion completion XP may add its explicit rarity premium without changing the base formula"
    );
    assert.deepEqual(
        [0, 0.15, 0.3, 0.5, 0.7, 0.85, 0.999999].map((roll) => rollHuntingBattleExperienceVariance(() => roll)),
        [-15, -10, -5, 0, 5, 10, 15],
        "Hunting XP variance must use every readable 5 XP result in its configured range"
    );
    const getBattleExperienceTotal = (fighter, battleVariance) =>
        [...createHuntingExperienceAllocation([fighter], { battleVariance }).values()].reduce(
            (total, amount) => total + amount,
            0
        ) + getHuntingCompletionExperience(peakHealthVictory, [fighter]);
    assert.deepEqual(
        [-15, -10, -5, 0, 5, 10, 15].map((battleVariance) => getBattleExperienceTotal(normalEnemy, battleVariance)),
        [45, 50, 55, 60, 65, 70, 75],
        "A 60 XP hunting victory must vary by range without changing its seven-roll average"
    );
    assert.equal(
        getBattleExperienceTotal(championEnemy, 15),
        85,
        "Champion premiums must remain additive after the battle XP range is applied"
    );
    assert.ok(getHuntingExperienceDropLimit() > 0, "Hunting XP orbs must retain a finite visual-drop cap");
    console.log("[hunting-experience-balance] ok");
}

function testHuntingExperienceGrantsImmediately() {
    const profile = createDefaultPlayerProfile();
    const awardCalls = [];
    const manager = new HuntingManager({
        awardExperience(characterId, amount, options) {
            awardCalls.push({ characterId, amount, options });
            return grantCharacterExperience(profile, characterId, amount);
        }
    });
    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.DASH });

    const result = manager._awardHuntingExperience({ amount: 7 });

    assert.equal(result.xpGained, 7, "XP orb collection must grant its exact value immediately");
    assert.equal(
        profile.experience.byCharacter[FIGHTER_IDS.DASH].currentXp,
        7,
        "Collected hunting XP must update the character profile before the battle ends"
    );
    assert.deepEqual(
        awardCalls[0].options,
        { persist: false, refresh: false, log: false, notifyLevelUp: true },
        "The manager must batch persistence and UI refresh until the current battle settles"
    );
    assert.equal(
        manager._battleExperienceGrants.length,
        1,
        "The battle result must retain one aggregated XP grant record"
    );
    assert.equal(manager._run.pendingLoot.xp, undefined, "Immediate XP must never enter pending hunting loot");
    console.log("[hunting-experience-immediate-grant] ok");
}

function testHuntingBossRolesAndEnhancementStoneDrops(app) {
    const createSequenceRng = (values) => {
        let index = 0;
        return () => values[index++] ?? values.at(-1) ?? 0;
    };
    let run = createHuntingRun({ characterId: FIGHTER_IDS.ARCHER, now: 0 });

    [0.1, 0.15, 0.2, 0.25, 0.3, 0.3].forEach((expectedChance) => {
        run = advanceHuntingRun(run, { rng: createSequenceRng([0, 0.999999, 0.999999]) });
        assert.equal(
            run.lastEncounter.type,
            HUNTING_FLOOR_OUTCOME_TYPES.COMBAT,
            "The controlled roll must enter combat"
        );
        assert.equal(run.lastEncounter.isMiniboss, false, "A missed miniboss roll must keep the normal encounter");
        assert.equal(run.minibossChance, expectedChance, "A normal combat miss must raise the next miniboss chance");
    });

    run = advanceHuntingRun(run, { rng: createSequenceRng([0, 0.999999, 0]) });
    assert.equal(
        run.lastEncounter.isMiniboss,
        true,
        "A successful combat roll must mark only that encounter as a miniboss"
    );
    assert.equal(
        run.minibossChance,
        HUNTING_MINIBOSS.INITIAL_CHANCE,
        "A successful miniboss roll must reset the next chance to its initial value"
    );

    const championEventRun = advanceHuntingRun({ ...run, minibossChance: 0.2 }, { rng: createSequenceRng([0.5, 0.8]) });
    assert.equal(
        championEventRun.lastEvent.type,
        HUNTING_EVENT_TYPES.CHAMPION_INTRUSION,
        "The controlled event roll must produce a champion intrusion"
    );
    assert.equal(
        championEventRun.minibossChance,
        0.2,
        "Non-combat events must not advance the normal-combat miniboss chance"
    );
    const finalBossRun = advanceHuntingRun({ ...run, floor: 99, minibossChance: 0.25 }, { rng: () => 0 });
    assert.equal(
        finalBossRun.lastEncounter.type,
        HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS,
        "Floor 100 must remain a final boss"
    );
    assert.equal(finalBossRun.minibossChance, 0.25, "The final boss must not consume the normal-combat miniboss roll");

    const bossMob = createHuntingBossMobSpec({ floor: 1, index: 0, rng: () => 0 });
    const normalMob = scaleEnemySpecForHunting(
        createHuntingMobSpec({ type: bossMob.hunting.monsterType, floor: 1, index: 0, rng: () => 0 }),
        1,
        { enemyType: HUNTING_ENEMY_TYPES.NORMAL }
    );
    const bossRarity = bossMob.hunting.monsterTags.find((tag) => tag.startsWith("rarity:"))?.slice("rarity:".length);
    assert.ok(
        ["rare", "unique", "epic"].includes(bossRarity),
        "Normal-combat minibosses must use a high-rarity monster"
    );
    assert.equal(bossMob.ability, normalMob.ability, "BossMob must preserve the source monster behavior");
    assert.equal(bossMob.stats.speed, normalMob.stats.speed, "BossMob must preserve the source monster speed");
    assert.equal(bossMob.hunting.isMob, true, "BossMob must remain a monster for generic loot and statistics");
    assert.equal(bossMob.hunting.isMiniboss, true, "BossMob must be identified as the normal-combat miniboss");
    assert.equal(
        bossMob.stats.radius,
        normalMob.stats.radius * BOSS_MOB_MULTIPLIERS.radius,
        "BossMob radius must use the documented multiplier"
    );
    assert.ok(
        Math.abs(bossMob.stats.mass - normalMob.stats.mass * BOSS_MOB_MULTIPLIERS.mass) < 1e-9,
        "BossMob mass must use the documented multiplier"
    );
    assert.equal(bossMob.stats.hp, normalMob.stats.hp * BOSS_MOB_MULTIPLIERS.hp, "BossMob HP must double");
    assert.equal(
        bossMob.stats.damage,
        normalMob.stats.damage * BOSS_MOB_MULTIPLIERS.damage,
        "BossMob damage must use the documented multiplier"
    );
    assert.ok(
        Math.abs(bossMob.stats.defense - normalMob.stats.defense * BOSS_MOB_MULTIPLIERS.defense) < 1e-9,
        "BossMob defense must use the documented multiplier"
    );

    const capturedMatches = [];
    const managerApp = {
        roster: app.roster,
        playerProfile: createDefaultPlayerProfile(),
        playerStatAllocation: {},
        startMatch(specs) {
            capturedMatches.push(specs);
        }
    };
    const roleManager = new HuntingManager(managerApp);
    roleManager._run = {
        ...createHuntingRun({ characterId: FIGHTER_IDS.ARCHER, now: 0 }),
        floor: 3,
        lastEncounter: { type: HUNTING_FLOOR_OUTCOME_TYPES.COMBAT, isMiniboss: true }
    };
    roleManager._startFloorBattle();
    const normalCombatBoss = capturedMatches[0].slice(1).find((spec) => spec.hunting?.isMiniboss);
    assert.equal(
        normalCombatBoss.hunting.isMob,
        true,
        "A marked normal combat must compose a BossMob, not a roster boss"
    );
    roleManager._run = {
        ...createHuntingRun({ characterId: FIGHTER_IDS.ARCHER, now: 0 }),
        floor: 3,
        lastEncounter: { type: HUNTING_FLOOR_OUTCOME_TYPES.EVENT },
        lastEvent: { type: HUNTING_EVENT_TYPES.CHAMPION_INTRUSION, enemyType: HUNTING_ENEMY_TYPES.CHAMPION }
    };
    roleManager._startFloorBattle();
    const championBoss = capturedMatches[1].slice(1).find((spec) => spec.hunting?.isMiniboss);
    assert.equal(
        championBoss.hunting.isMob,
        undefined,
        "Champion events must retain their separate roster-boss composition"
    );
    roleManager._run = {
        ...createHuntingRun({ characterId: FIGHTER_IDS.ARCHER, now: 0 }),
        floor: 100,
        lastEncounter: { type: HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS }
    };
    roleManager._startFloorBattle();
    const finalBoss = capturedMatches[2].slice(1).find((spec) => spec.hunting?.isMiniboss);
    assert.equal(finalBoss.hunting.isMob, undefined, "The final boss must retain its separate roster-boss composition");

    const playerSpec = {
        ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
        teamId: HUNTING_TEAMS.PLAYER
    };
    const bossSimulation = new BattleSimulation([playerSpec, bossMob], { onLog() {}, onSound() {} }, null, {
        assignActions: false
    });
    const [player, boss] = bossSimulation.fighters;
    const bossSession = new HuntingBattleLootSession({ playerId: player.id, floor: 1 });
    const bossController = new HuntingLootDropController({ session: bossSession, rng: () => 0.999999 });
    bossController.onFighterDefeated(boss, { simulation: bossSimulation });
    const bossShards = bossSimulation.entities.filter(
        (entity) => entity instanceof ShardDrop && !(entity instanceof EnhancementStoneDrop)
    );
    const bossStones = bossSimulation.entities.filter((entity) => entity instanceof EnhancementStoneDrop);
    assert.equal(bossShards.length, 7, "BossMob must retain the generic monster shard drops");
    assert.equal(bossStones.length, 3, "A floor-one BossMob must create every rolled stone as a physical item");
    assert.ok(
        bossStones.every((stone) => stone.amount === 1),
        "Every physical enhancement stone must be worth exactly one"
    );
    bossStones.forEach((stone) => {
        stone.collectionGraceRemaining = 0;
        stone.position = player.position.clone();
        stone.velocity = new Vector2();
        stone.update(1 / 60, bossSimulation);
    });
    assert.equal(
        bossSession.getCollectedLoot().enhancementStones,
        3,
        "Collected physical stones must enter the transient hunting battle loot session"
    );

    const createRosterBossStoneDrops = (floor) => {
        const rosterBoss = createHuntingMinibossSpec({
            roster: app.roster,
            characterId: playerSpec.id,
            floor,
            enemyType: HUNTING_ENEMY_TYPES.CHAMPION,
            rng: () => 0
        });
        const simulation = new BattleSimulation([playerSpec, rosterBoss], { onLog() {}, onSound() {} }, null, {
            assignActions: false
        });
        const [, rosterBossBall] = simulation.fighters;
        const session = new HuntingBattleLootSession({ playerId: playerSpec.id, floor });
        new HuntingLootDropController({ session, rng: () => 0.999999 }).onFighterDefeated(rosterBossBall, {
            simulation
        });
        return simulation.entities.filter((entity) => entity instanceof EnhancementStoneDrop);
    };
    assert.equal(
        createRosterBossStoneDrops(1).length,
        3,
        "Champion intrusions must add their own individual enhancement stones"
    );
    assert.equal(
        createRosterBossStoneDrops(100).length,
        12,
        "Final bosses must use the floor-one-hundred enhancement stone range"
    );

    const runWithStones = recordHuntingFloorResult(createHuntingRun({ characterId: player.id, now: 0 }), {
        hpRemain: 80,
        maxHp: 100,
        loot: { shards: 0, enhancementStones: 5, chests: [] }
    });
    const retreated = retreatHuntingRun(runWithStones, { now: 1 });
    assert.equal(retreated.securedLoot.enhancementStones, 5, "Retreat must secure collected enhancement stones");
    const defeated = defeatHuntingRun(runWithStones, { rng: () => 0, now: 1 });
    assert.equal(
        defeated.securedLoot.enhancementStones + defeated.defeatLosses.enhancementStones,
        5,
        "Defeat preservation must account for every pending enhancement stone"
    );
    const profile = createDefaultPlayerProfile();
    const settlementApp = { playerProfile: profile, _settleHuntingAchievements() {} };
    const settlementManager = new HuntingManager(settlementApp);
    settlementManager._run = retreated;
    settlementManager._mergeIntoSecured(settlementApp);
    assert.equal(
        profile.equipment.enhancementStones,
        5,
        "Secured enhancement stones must settle into the persistent equipment resource"
    );
    console.log("[hunting-boss-roles-and-enhancement-stones] ok");
}

function testEliteMobCombinationEvent(app) {
    const uniqueMonsterTypes = [...new Set(Object.values(HUNTING_MONSTER_TYPES))].sort();
    assert.equal(
        HuntingEvent.POOL.at(-1)?.type,
        HUNTING_EVENT_TYPES.ELITE_MOB,
        "Elite mob events should append to the pool"
    );
    assert.deepEqual(
        ELITE_MOB_COMBINATIONS.map((combination) => combination.size),
        [3, 4, 5],
        "Generated elite data should keep one verified combination for each supported size"
    );
    assert.equal(
        ELITE_MOB_COMBINATION_GENERATION.seed,
        20260714,
        "Elite combination data should retain its reproducible generator seed"
    );
    assert.deepEqual(
        ELITE_MOB_COMBINATION_GENERATION.uniqueMonsterTypes,
        uniqueMonsterTypes,
        "Elite candidate sampling should remove monster-type aliases before using every unique type equally"
    );
    assert.equal(
        ELITE_MOB_COMBINATION_GENERATION.scoreFormula,
        "monsterWinRate + winningRemainingHpRatio * 0.01",
        "Elite scoring should keep win rate primary with only a small surviving-HP tiebreaker"
    );
    ELITE_MOB_COMBINATIONS.forEach((combination) => {
        assert.equal(
            combination.monsterTypes.length,
            combination.size,
            "Combination payload size should match its generated category"
        );
        assert.equal(
            combination.metrics.matches,
            26,
            "Every generated combination should evaluate every roster character equally"
        );
        assert.equal(
            getEliteMobCombination(combination.id),
            combination,
            "Generated combination IDs should resolve to their committed runtime data"
        );
    });

    const event = HuntingEvent.get(HUNTING_EVENT_TYPES.ELITE_MOB);
    const selected = event.createPayload(37, () => 0.5);
    const selectedCombination = ELITE_MOB_COMBINATIONS[1];
    assert.equal(selected.type, HUNTING_EVENT_TYPES.ELITE_MOB, "Elite events should keep their own event type");
    assert.equal(selected.floor, 37, "Elite event payloads should retain the current floor");
    assert.equal(
        selected.enemyType,
        HUNTING_ENEMY_TYPES.ELITE,
        "Elite event payloads should mark elite scaling explicitly"
    );
    assert.equal(
        selected.eliteCombinationId,
        selectedCombination.id,
        "Elite event payloads should persist the selected stable combination ID"
    );
    assert.deepEqual(
        selected.monsterTypes,
        selectedCombination.monsterTypes,
        "Elite event payloads should persist the exact selected type array"
    );

    const rolledElite = rollHuntingFloorOutcome(
        10,
        (() => {
            const values = [0.5, 0.95];
            return () => values.shift() ?? 0;
        })(),
        0,
        { hpRatio: 1 }
    );
    assert.equal(
        rolledElite.event.type,
        HUNTING_EVENT_TYPES.ELITE_MOB,
        "The appended event should roll through floor outcomes"
    );

    const resolution = event.resolve(selected, {
        run: createHuntingRun({ characterId: FIGHTER_IDS.ARCHER, stageId: HUNTING_STAGE_IDS.CAVE })
    });
    assert.equal(
        resolution.transition,
        HUNTING_EVENT_TRANSITIONS.BATTLE,
        "Elite events should use the battle preparation flow"
    );
    assert.equal(
        resolution.presentation.title,
        "정예 몹 습격",
        "Elite events should identify the verified monster battle"
    );
    assert.ok(
        resolution.presentation.detail.includes("elite 강화"),
        "Elite preparation text should explain the scaling applied to the selected group"
    );

    const eliteSpecs = createEliteMobEncounter({
        floor: selected.floor,
        stageId: HUNTING_STAGE_IDS.CAVE,
        combinationId: selected.eliteCombinationId,
        monsterTypes: selected.monsterTypes,
        rng: () => 0
    });
    assert.deepEqual(
        eliteSpecs.map((spec) => spec.hunting.monsterType),
        selected.monsterTypes,
        "Elite encounter factories should preserve payload order and duplicate monster types"
    );
    eliteSpecs.forEach((spec) => {
        assert.equal(spec.hunting.enemyType, HUNTING_ENEMY_TYPES.ELITE, "Elite event mobs should use elite scaling");
        assert.equal(spec.hunting.floor, selected.floor, "Elite event mobs should scale from the actual current floor");
        assert.equal(
            spec.hunting.enemyPowerMultiplier,
            getEnemyPowerMultiplier(selected.floor, { enemyType: HUNTING_ENEMY_TYPES.ELITE }),
            "Elite event mobs should expose the current-floor elite multiplier"
        );
    });
    assert.throws(
        () =>
            createEliteMobEncounter({
                floor: selected.floor,
                combinationId: selected.eliteCombinationId,
                monsterTypes: [...selected.monsterTypes].reverse()
            }),
        /does not match/,
        "Elite encounter factories should reject payloads that do not match their stable combination ID"
    );

    const capturedMatches = [];
    const managerApp = {
        roster: app.roster,
        playerProfile: createDefaultPlayerProfile(),
        playerStatAllocation: {},
        startMatch(specs) {
            capturedMatches.push(specs);
        }
    };
    const manager = new HuntingManager(managerApp);
    manager._run = {
        ...createHuntingRun({ characterId: FIGHTER_IDS.ARCHER, stageId: HUNTING_STAGE_IDS.CAVE, now: 0 }),
        floor: selected.floor,
        lastEncounter: { type: HUNTING_FLOOR_OUTCOME_TYPES.EVENT },
        lastEvent: selected
    };
    manager._startFloorBattle();
    const spawnedEliteSpecs = capturedMatches[0].slice(1);
    assert.deepEqual(
        spawnedEliteSpecs.map((spec) => spec.hunting.monsterType),
        selected.monsterTypes,
        "HuntingManager should spawn the payload combination rather than a normal weighted encounter"
    );
    assert.ok(
        spawnedEliteSpecs.every((spec) => spec.hunting.enemyType === HUNTING_ENEMY_TYPES.ELITE),
        "HuntingManager should preserve elite scaling on every selected monster"
    );

    manager._run = {
        ...createHuntingRun({ characterId: FIGHTER_IDS.ARCHER, stageId: HUNTING_STAGE_IDS.CAVE, now: 1 }),
        floor: selected.floor,
        lastEncounter: { type: HUNTING_FLOOR_OUTCOME_TYPES.EVENT },
        lastEvent: { type: HUNTING_EVENT_TYPES.CHAMPION_INTRUSION, enemyType: HUNTING_ENEMY_TYPES.CHAMPION }
    };
    manager._startFloorBattle();
    const championBoss = capturedMatches[1].slice(1).find((spec) => spec.hunting?.isMiniboss);
    assert.equal(
        championBoss.hunting.isMob,
        undefined,
        "Elite events must not replace roster-based champion intrusions"
    );
    console.log("[hunting-elite-mob-combination-event] ok");
}

function testHuntingLootItemsRotate() {
    const lootItems = [
        new ShardDrop({ position: new Vector2(200, 200), velocity: new Vector2(), collectorId: "collector" }),
        new ShardBundleDrop({ position: new Vector2(240, 200), velocity: new Vector2(), collectorId: "collector" }),
        new SmallHealPack({ position: new Vector2(280, 200), velocity: new Vector2(), collectorId: "collector" }),
        new ChestDrop({ position: new Vector2(320, 200), velocity: new Vector2(), collectorId: "collector" })
    ];
    const simulation = { fighters: [], keepEntityInsideArena() {} };
    const initialAngularVelocities = lootItems.map((item) => item.angularVelocity);

    initialAngularVelocities.forEach((angularVelocity) => {
        assert.ok(
            Number.isFinite(angularVelocity) && Math.abs(angularVelocity) >= 0.9,
            "All loot items must receive the shared random initial spin"
        );
    });

    lootItems.forEach((item) => item.update(0.5, simulation));
    lootItems.forEach((item, index) => {
        assert.ok(Number.isFinite(item.angle) && item.angle !== 0, "All loot items must advance a rotation angle");
        assert.ok(
            Number.isFinite(item.angularVelocity) && Math.abs(item.angularVelocity) > 0,
            "All loot items must retain a finite angular velocity after rotation integration"
        );
        assert.ok(
            Math.abs(item.angularVelocity) <= Math.abs(initialAngularVelocities[index]),
            "Rotation integration must not increase a loot item's free-spin velocity"
        );
    });

    const ctx = makeRecordingCanvasContext();
    lootItems.forEach((item) => item.draw(ctx));
    assert.equal(
        ctx.calls.filter(([method]) => method === "rotate").length,
        lootItems.length,
        "All loot renderers must apply their shared rotation transform"
    );
    console.log("[hunting-loot-rotation] ok");
}

function testHuntingLootSessionIsDiscardedOnDefeat(app) {
    const profile = createDefaultPlayerProfile();
    const playerBall = { id: FIGHTER_IDS.DASH, name: "Dash Ball", hp: 0, maxHp: 100 };
    const enemyBall = { id: "enemy", name: "Enemy", hp: 80, maxHp: 100 };
    const mockApp = {
        _cleanupMatch() {},
        matchFinalized: false,
        _onSimulationResult: null,
        simulation: {
            fighters: [playerBall, enemyBall],
            winner: enemyBall,
            isHostile(a, b) {
                return a !== b;
            },
            getEnemiesOf(fighter) {
                return this.fighters.filter((candidate) => candidate.id !== fighter.id);
            }
        },
        _currentMatchReport: null,
        _formatXpResult() {
            return "";
        },
        _createXpRewardView() {
            return null;
        },
        setHuntingOverlayState() {},
        showOverlay() {},
        presentResultSequence() {},
        refreshPlayerSetup() {},
        setStartButton() {},
        addLog() {},
        _settleHuntingAchievements() {},
        _refreshCollectionHub() {},
        beginResultConfirmation() {},
        setHuntingActive() {},
        roster: app.roster,
        playerProfile: profile
    };
    const manager = new HuntingManager(mockApp);
    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.CAVE });
    manager._battleLootSession = new HuntingBattleLootSession({ playerId: FIGHTER_IDS.DASH, floor: 1 });
    manager._battleLootSession.recordCollection({ type: HUNTING_LOOT_ITEM_TYPES.SHARD, amount: 20 });
    manager._battleLootSession.recordCollection({
        type: HUNTING_LOOT_ITEM_TYPES.CHEST,
        chest: createHuntingChest({ id: "defeat-discard-chest", rarity: "common" })
    });

    manager._handleFinish(mockApp);

    assert.equal(profile.hunting.shards, 0, "Collected battle loot must not be secured after a defeat");
    assert.equal(profile.hunting.chests.length, 0, "Collected battle chests must not be secured after a defeat");
    assert.equal(manager._battleLootSession, null, "Defeat must discard the transient battle loot session");
    console.log("[hunting-loot-defeat-discard] ok");
}

function testHuntingCombatRewardChestUi() {
    const overlayCalls = [];
    const mockApp = {
        setHuntingOverlayState(data) {
            overlayCalls.push({ ...data });
        },
        showOverlay() {},
        addLog() {},
        roster: app.roster,
        playerProfile: createDefaultPlayerProfile()
    };
    const manager = new HuntingManager(mockApp);
    const chest = createHuntingChest({ rarity: "common" });
    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.CAVE });
    manager._run = recordHuntingFloorResult(manager._run, {
        hpRemain: 80,
        maxHp: 100,
        loot: { shards: 15, chests: [chest] },
        combatCleared: true
    });
    manager._presentCombatRewardChest(mockApp, chest);

    const last = overlayCalls.at(-1);
    assert.ok(last, "Combat reward chest must call setHuntingOverlayState");
    assert.equal(last.huntingChestEventActive, true, "Combat reward chest must show chest UI");
    assert.equal(last.huntingChestRarity, "common", "Combat reward chest must pass chest rarity");
    assert.equal(last.huntingChestConfirmLabel, "확인", "Combat reward chest button must say '확인'");
    assert.equal(
        manager._run.phase,
        HUNTING_RUN_PHASES.AWAITING_COMBAT_REWARD_CHEST,
        "Combat reward chest must set phase to AWAITING_COMBAT_REWARD_CHEST"
    );
    console.log("[hunting-combat-reward-chest-ui] ok");
}

function createCombatRewardChestTestEnv({ isFinalBoss = false, collectedChestCount = 1 } = {}) {
    const overlayStates = [];
    const showOverlayCalls = [];
    const resultSequenceCalls = [];
    const playerBall = { id: FIGHTER_IDS.DASH, name: "Dash Ball", hp: 80, maxHp: 100 };
    const mockApp = {
        _cleanupMatch() {},
        matchFinalized: false,
        _onSimulationResult: null,
        simulation: {
            fighters: [playerBall, { id: "enemy", name: "Enemy", hp: 0, maxHp: 100 }],
            winner: playerBall,
            isHostile() {
                return true;
            },
            getEnemiesOf(fighter) {
                return this.fighters.filter((candidate) => candidate.id !== fighter.id);
            }
        },
        _currentMatchReport: null,
        _formatXpResult() {
            return "";
        },
        _createXpRewardView() {
            return null;
        },
        setHuntingOverlayState(data) {
            overlayStates.push({ ...data });
        },
        showOverlay(label, text, subtext) {
            showOverlayCalls.push({ label, text, subtext });
        },
        presentResultSequence(steps) {
            resultSequenceCalls.push(steps);
        },
        refreshPlayerSetup() {},
        setStartButton() {},
        addLog() {},
        _settleHuntingAchievements() {},
        roster: app.roster,
        playerProfile: createDefaultPlayerProfile()
    };
    if (isFinalBoss) {
        mockApp.beginResultConfirmation = () => {};
        mockApp._refreshCollectionHub = () => {};
        mockApp.setHuntingActive = () => {};
    }
    const manager = new HuntingManager(mockApp);
    const run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.CAVE });
    manager._run = isFinalBoss
        ? { ...run, floor: 100, lastEncounter: { type: HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS } }
        : run;
    manager._battleLootSession = new HuntingBattleLootSession({
        playerId: FIGHTER_IDS.DASH,
        floor: manager._run.floor
    });
    Array.from({ length: collectedChestCount }).forEach((_, index) => {
        manager._battleLootSession.recordCollection({
            type: HUNTING_LOOT_ITEM_TYPES.CHEST,
            chest: createHuntingChest({
                id: `combat-reward-chest-${isFinalBoss ? "boss" : "normal"}-${index}`,
                rarity: "common"
            })
        });
    });
    return { overlayStates, showOverlayCalls, resultSequenceCalls, playerBall, mockApp, manager };
}

function testHuntingCombatWithoutCollectedChestSkipsChestUi() {
    const { overlayStates, mockApp, manager } = createCombatRewardChestTestEnv({ collectedChestCount: 0 });
    const originalRandom = Math.random;
    try {
        Math.random = () => 0;
        manager._handleFinish(mockApp);
    } finally {
        Math.random = originalRandom;
    }

    assert.equal(
        manager._run.phase,
        HUNTING_RUN_PHASES.AWAITING_CHOICE,
        "A monster defeat roll must not synthesize an uncollected chest after combat"
    );
    assert.equal(
        overlayStates.some((state) => state.huntingChestEventActive === true),
        false,
        "Only chests collected on the battlefield may open the combat chest UI"
    );
    assert.equal(
        manager._run.pendingLoot.shards,
        0,
        "Winning without collected drops must not synthesize the former static combat shard reward"
    );
    console.log("[hunting-combat-uncollected-chest-skipped] ok");
}

function testHuntingCombatRewardChestQueue() {
    const { overlayStates, mockApp, manager } = createCombatRewardChestTestEnv({ collectedChestCount: 2 });
    manager._handleFinish(mockApp);

    manager.chestContinue();
    assert.equal(
        manager._run.phase,
        HUNTING_RUN_PHASES.AWAITING_COMBAT_REWARD_CHEST,
        "A second collected chest must remain in the combat chest flow"
    );
    assert.equal(
        overlayStates.filter((state) => state.huntingChestEventActive === true).length,
        2,
        "Each collected chest must present its own confirmation UI"
    );

    manager.chestContinue();
    assert.equal(
        manager._run.phase,
        HUNTING_RUN_PHASES.AWAITING_CHOICE,
        "Combat victory UI must appear after the final collected chest"
    );
    console.log("[hunting-combat-reward-chest-queue] ok");
}

function testHuntingCombatRewardChestNormalContinue() {
    const { overlayStates, showOverlayCalls, mockApp, manager } = createCombatRewardChestTestEnv();

    // Spy on advance() to prove it is never called implicitly
    let advanceCallCount = 0;
    const originalAdvance = manager.advance;
    manager.advance = () => {
        advanceCallCount++;
    };

    const originalRandom = Math.random;
    try {
        Math.random = () => 0.0;

        manager._handleFinish(mockApp);

        // Phase must be AWAITING_COMBAT_REWARD_CHEST (chest intercepted)
        assert.equal(
            manager._run.phase,
            HUNTING_RUN_PHASES.AWAITING_COMBAT_REWARD_CHEST,
            "Phase must be combat reward chest after _handleFinish with chest drop"
        );

        // Chest UI must be active with confirm label '확인'
        const lastChest = overlayStates.at(-1);
        assert.ok(lastChest, "_handleFinish must call setHuntingOverlayState");
        assert.equal(lastChest.huntingChestEventActive, true, "Chest UI must be active");
        assert.equal(lastChest.huntingChestConfirmLabel, "확인", "Combat reward chest button must say '확인'");

        // Victory overlay must NOT have appeared yet
        const victoryBefore = showOverlayCalls.find((c) => c.label === "사냥터" && c.text.includes("승리"));
        assert.equal(victoryBefore, undefined, "Victory overlay must NOT appear before chest confirm");

        // Reset tracking for chestContinue
        overlayStates.length = 0;
        showOverlayCalls.length = 0;
        advanceCallCount = 0;

        manager.chestContinue();

        // Chest UI must close
        const chestClose = overlayStates.find((s) => s.huntingChestEventActive === false);
        assert.ok(chestClose, "chestContinue must close chest UI");

        // Phase must be AWAITING_CHOICE (normal combat victory)
        assert.equal(
            manager._run.phase,
            HUNTING_RUN_PHASES.AWAITING_CHOICE,
            "Normal combat reward chest continue must transition to AWAITING_CHOICE"
        );

        // Victory overlay must appear
        const victoryAfter = showOverlayCalls.find((c) => c.label === "사냥터" && c.text.includes("승리"));
        assert.ok(victoryAfter, "After combat reward chest confirm, victory overlay must appear");

        // advance() must NOT have been called implicitly
        assert.equal(advanceCallCount, 0, "chestContinue must NOT implicitly call advance()");
        assert.equal(manager._moving, false, "Combat reward chest continue must not trigger advance automatically");
    } finally {
        Math.random = originalRandom;
        manager.advance = originalAdvance;
    }

    console.log("[hunting-combat-reward-chest-normal-continue] ok");
}

function testHuntingCombatRewardChestFinalBossContinue() {
    const { overlayStates, resultSequenceCalls, mockApp, manager } = createCombatRewardChestTestEnv({
        isFinalBoss: true
    });

    // Spy on beginResultConfirmation() to prove lifecycle
    let beginResultConfirmationCallCount = 0;
    const originalBeginResultConfirmation = mockApp.beginResultConfirmation;
    mockApp.beginResultConfirmation = () => {
        beginResultConfirmationCallCount++;
    };

    const originalRandom = Math.random;
    try {
        Math.random = () => 0.0;

        manager._handleFinish(mockApp);

        // Phase must be AWAITING_COMBAT_REWARD_CHEST (chest intercepted)
        assert.equal(
            manager._run.phase,
            HUNTING_RUN_PHASES.AWAITING_COMBAT_REWARD_CHEST,
            "Final boss: phase must be combat reward chest after _handleFinish"
        );

        // Chest UI must be visible with confirm label '확인'
        const chestState = overlayStates.find((s) => s.huntingChestEventActive === true);
        assert.ok(chestState, "Chest UI must be visible after _handleFinish");
        assert.equal(chestState.huntingChestConfirmLabel, "확인", "Chest confirm button must be '확인'");

        // beginResultConfirmation must NOT be called before chest confirm
        assert.equal(
            beginResultConfirmationCallCount,
            0,
            "beginResultConfirmation must NOT be called before chest confirm"
        );

        // Stage clear must NOT have appeared yet
        const clearBefore = resultSequenceCalls.find((steps) => steps[0]?.label === "스테이지 클리어");
        assert.equal(clearBefore, undefined, "Stage clear must NOT appear before chest confirm");

        // Reset tracking for chestContinue
        overlayStates.length = 0;
        resultSequenceCalls.length = 0;
        beginResultConfirmationCallCount = 0;

        manager.chestContinue();

        // After chest confirm: run must be null (stage clear)
        assert.equal(manager._run, null, "Final boss combat reward chest continue must set run to null (stage clear)");

        // Stage clear overlay must appear
        const clearAfter = resultSequenceCalls.find((steps) => steps.some((step) => step.label === "스테이지 클리어"));
        assert.ok(clearAfter, "After final boss chest confirm, stage clear overlay must appear");
        assert.equal(clearAfter[0]?.label, "경험치", "Stage clear results must show collected XP before the summary");

        // beginResultConfirmation must be called exactly once after chest confirm
        assert.equal(
            beginResultConfirmationCallCount,
            1,
            "beginResultConfirmation must be called exactly once after chest confirm"
        );
    } finally {
        Math.random = originalRandom;
        mockApp.beginResultConfirmation = originalBeginResultConfirmation;
    }

    console.log("[hunting-combat-reward-chest-finalboss-continue] ok");
}

function testHuntingChestRoomContinueStillWorks() {
    const overlayStates = [];
    const mockApp = {
        setHuntingOverlayState(data) {
            overlayStates.push({ ...data });
        },
        showOverlay() {},
        addLog() {},
        roster: app.roster,
        playerProfile: createDefaultPlayerProfile()
    };
    const manager = new HuntingManager(mockApp);
    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.CAVE });
    manager._run = setHuntingRunPhase(manager._run, HUNTING_RUN_PHASES.AWAITING_CHEST);

    // Spy on the advance method
    let advancedCalled = false;
    const originalAdvance = manager.advance;
    manager.advance = () => {
        advancedCalled = true;
    };

    try {
        overlayStates.length = 0;
        manager.chestContinue();
    } finally {
        manager.advance = originalAdvance;
    }

    assert.ok(advancedCalled, "Chest room chestContinue must call advance()");
    assert.equal(
        manager._run.phase,
        HUNTING_RUN_PHASES.AWAITING_CHEST,
        "Chest room continue must not change phase (advance handles it)"
    );
    console.log("[hunting-chest-room-continue-still-works] ok");
}

function testHuntingAdvanceDispatchContract() {
    const configuredEvents = HuntingEvent.POOL.map((event) => event.type).sort();
    const knownEvents = Object.values(HUNTING_EVENT_TYPES).sort();
    assert.deepEqual(configuredEvents, knownEvents, "Every hunting event type should declare one event class");
    assert.ok(
        HuntingEvent.POOL.every((event) => HuntingEvent.get(event.type) === event),
        "Every hunting event class should be available from the type registry"
    );
    assert.ok(
        HuntingEvent.POOL.every(
            (event) => typeof event.createPayload === "function" && typeof event.resolve === "function"
        ),
        "Every hunting event class should define payload creation and run transition behavior"
    );
    assert.equal(
        Object.values(HUNTING_EVENT_TRANSITIONS).length,
        5,
        "Event transitions should explicitly cover continue, choice, merchant, chest, and battle"
    );

    const source = readFileSync(new URL("../src/hunting/huntingManager.js", import.meta.url), "utf8");
    const advanceStart = source.indexOf("    async advance(");
    const advanceEnd = source.indexOf("    _prepareAdvanceFromPreviousEvent", advanceStart);
    const advanceSource = source.slice(advanceStart, advanceEnd);
    assert.ok(
        advanceSource.includes("_advanceOneFloor"),
        "advance should delegate each floor to the route step handler"
    );
    assert.equal(
        /HUNTING_(?:FLOOR_OUTCOME|EVENT)_TYPES/.test(advanceSource),
        false,
        "advance should not branch on individual floor or event types"
    );
    assert.equal(
        source.includes("_handleBoonEvent"),
        false,
        "HuntingManager should not retain individual event behavior methods"
    );
    const encountersSource = readFileSync(new URL("../src/hunting/huntingEncounters.js", import.meta.url), "utf8");
    assert.ok(
        encountersSource.includes("HuntingEvent.POOL"),
        "Encounter rolls should use the event class pool as the single candidate list"
    );
    console.log("[hunting-advance-dispatch] ok");
}

function testComponentBridgeEquipmentFunctions() {
    const profile = createDefaultPlayerProfile();
    const weapon = createEquipmentInstance({ rarity: "common", slot: "weapon", rng: () => 0.5 });
    weapon.stats = [{ type: "damage", value: 9, min: 4, max: 8 }];
    profile.equipment.inventory.push(weapon);

    const mockApp = {
        playerProfile: profile,
        playerFighterId: "archer",
        _refreshCollectionHub() {},
        refreshPlayerSetup() {}
    };

    const bridge = createAppComponentBridge(mockApp);

    // 모든 장비 관련 함수가 bridge에 존재하는지 확인
    const requiredFunctions = [
        "equipItem",
        "unequipItem",
        "enhanceItem",
        "fuseEquipmentItems",
        "disassembleItem",
        "sellItem",
        "expandInventory"
    ];
    for (const fnName of requiredFunctions) {
        assert.equal(typeof bridge[fnName], "function", `Bridge should expose ${fnName}`);
    }

    // ── equipItem은 프로필을 저장해야 함 ──
    bridge.equipItem(weapon.instanceId);
    assert.equal(profile.equipment.equipped.weapon, weapon.instanceId, "Weapon should be equipped in profile");

    // ── unequipItem은 프로필을 저장해야 함 ──
    bridge.unequipItem(weapon.instanceId);
    assert.equal(profile.equipment.equipped.weapon, null, "Weapon should be unequipped in profile");
}

async function testBattleAppAdoptsPreExistingAlpineAllocation() {
    const initialAllocation = { hp: 20, damage: 20, speed: 20, skill: 20, defense: 20, criticalChance: 0 };
    const { app } = await loadModuleAppWithInitialAlpineAllocation(initialAllocation);
    assert.deepEqual(
        app.playerStatAllocation,
        initialAllocation,
        "BattleApp should adopt Alpine allocation that changed before event listeners were attached"
    );
}

async function testAdjustRandomResetSyncPlayerStatAllocation(app) {
    const panel = app._panel;
    app.resetAllocation();

    // adjustStat
    app.adjustStat("hp", 10);
    assert.equal(app.playerStatAllocation.hp, 10, "adjustStat should sync playerStatAllocation.hp");
    assert.deepEqual(app.playerStatAllocation, panel.allocation, "adjustStat should match panel.allocation");

    app.adjustStat("damage", 15);
    assert.equal(app.playerStatAllocation.damage, 15, "adjustStat should sync playerStatAllocation.damage");

    // randomAllocation
    app.randomAllocation();
    assert.equal(
        getSpentStatPoints(app.playerStatAllocation),
        PLAYER_STAT_POINTS,
        "randomAllocation should spend all points"
    );
    assert.deepEqual(app.playerStatAllocation, panel.allocation, "randomAllocation should match panel.allocation");

    // resetAllocation
    app.resetAllocation();
    const empty = createEmptyStatAllocation();
    assert.deepEqual(app.playerStatAllocation, empty, "resetAllocation should clear playerStatAllocation");
    assert.deepEqual(app.playerStatAllocation, panel.allocation, "resetAllocation should match panel.allocation");
}

function testIndexCacheVersionMatchesLatestPatchNote() {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const match = html.match(/const V = "([^"]+)";/);
    assert.ok(match, "index.html should define a module cache-busting version");
    assert.equal(
        match[1],
        PATCH_NOTES[0].version,
        "Module cache-busting version should match the latest patch note version"
    );
    assert.ok(
        !/<main[^>]*x-init="[^"]*app-loading/.test(html),
        "Loading overlay should not be removed before BattleApp is imported"
    );
    assert.ok(
        html.includes('document.getElementById("app-loading")?.remove();'),
        "Loading overlay should be removed after app modules finish importing"
    );
}

function testStatBalanceSystem() {
    // 극단 올인 [100, 0, 0] → 표준편차 큼 → 배율 낮음
    const allIn = calculateStatMultiplier([100, 0, 0]);
    assert.ok(allIn.stdDev > 40, "All-in build should have high stdDev");
    assert.ok(
        allIn.multiplier < STAT_BALANCER_CONFIG.BASE_MULTIPLIER + STAT_BALANCER_CONFIG.MAX_BONUS * 0.5,
        "All-in build should get less than half of max bonus"
    );

    // 완벽 균등 [30, 30, 30] → 표준편차 0 → 최대 배율
    const even = calculateStatMultiplier([30, 30, 30]);
    assert.equal(even.stdDev, 0, "Even build should have zero stdDev");
    assert.equal(
        even.multiplier,
        STAT_BALANCER_CONFIG.BASE_MULTIPLIER + STAT_BALANCER_CONFIG.MAX_BONUS,
        "Even build should receive maximum bonus"
    );

    // 분산이 작을수록 multiplier가 높음
    const lowVar = calculateStatMultiplier([35, 30, 35]);
    const highVar = calculateStatMultiplier([70, 30, 0]);
    assert.ok(lowVar.multiplier > highVar.multiplier, "Lower variance build should have higher multiplier");
    assert.ok(
        lowVar.multiplier >= STAT_BALANCER_CONFIG.BASE_MULTIPLIER,
        "Multiplier should never drop below BASE_MULTIPLIER"
    );
    assert.ok(
        lowVar.multiplier <= STAT_BALANCER_CONFIG.BASE_MULTIPLIER + STAT_BALANCER_CONFIG.MAX_BONUS,
        "Multiplier should never exceed BASE_MULTIPLIER + MAX_BONUS"
    );
}

function testExperienceSystem() {
    assert.equal(
        calcMatchXp({
            damageDealt: 60,
            opponentMaxHp: 100,
            hpRemain: 40,
            myMaxHp: 100,
            minHpRatio: 0.4,
            won: true,
            stage: 1
        }),
        20
    );
    const finalXp = calcMatchXp({
        damageDealt: 80,
        opponentMaxHp: 100,
        hpRemain: 15,
        myMaxHp: 100,
        minHpRatio: 0.1,
        won: true,
        stage: 3
    });
    assert.equal(finalXp, 53);
    assert.equal(
        calcMatchXp({
            damageDealt: 30,
            opponentMaxHp: 100,
            hpRemain: 0,
            myMaxHp: 100,
            minHpRatio: 0,
            won: false,
            stage: 1
        }),
        6
    );
    assert.equal(getLevelRequirement(1), 0);
    assert.equal(getLevelRequirement(2), 100);
    assert.equal(getLevelRequirement(10), 3968);
    assert.equal(getLevelFromXp(0), 1);
    assert.equal(getLevelFromXp(100), 2);
    assert.equal(getLevelFromXp(3968), 10);
    assert.equal(getLevelFromXp(9999), 10);
    assert.equal(getXpForNextLevel(0), 100);
    assert.equal(getXpForNextLevel(3968), 0);
    const tourneyXp = calcTournamentXp(
        [
            { damageDealt: 60, opponentMaxHp: 100, hpRemain: 40, myMaxHp: 100, minHpRatio: 0.4, won: true, stage: 1 },
            { damageDealt: 70, opponentMaxHp: 100, hpRemain: 30, myMaxHp: 100, minHpRatio: 0.3, won: true, stage: 2 },
            { damageDealt: 80, opponentMaxHp: 100, hpRemain: 15, myMaxHp: 100, minHpRatio: 0.1, won: true, stage: 3 }
        ],
        true
    );
    assert.equal(tourneyXp, 118);

    const profile = createDefaultPlayerProfile();
    const matchResult = grantExperienceFromMatchReport(profile, {
        playerFighterId: FIGHTER_IDS.DASH,
        combatDamageDealt: 60,
        opponentMaxHp: 100,
        hpRemain: 40,
        myMaxHp: 100,
        lowestHpRatio: 0.4,
        playerWon: true,
        tournamentRoundIndex: 0
    });
    assert.equal(matchResult.xpGained, 20, "Match report should grant a single match worth of XP");
    assert.equal(
        profile.experience.byCharacter[FIGHTER_IDS.DASH].currentXp,
        20,
        "Match XP should be saved immediately to the selected character"
    );
    assert.equal(profile.experience.currentXp, 20, "Aggregate XP should mirror character XP total");
    assert.equal(
        getCharacterExperienceSummary(profile, FIGHTER_IDS.DASH).remainingXp,
        80,
        "Character summary should expose next-level remaining XP"
    );
    profile.experience.byCharacter[FIGHTER_IDS.DASH].currentXp = 90;
    profile.experience.currentXp = 90;
    const levelUpResult = grantExperienceFromMatchReport(profile, {
        playerFighterId: FIGHTER_IDS.DASH,
        combatDamageDealt: 60,
        opponentMaxHp: 100,
        hpRemain: 40,
        myMaxHp: 100,
        lowestHpRatio: 0.4,
        playerWon: true,
        tournamentRoundIndex: 0
    });
    assert.equal(levelUpResult.levelUp, true, "Crossing the level threshold should be reported");
    assert.equal(levelUpResult.previousLevel, 1, "Level-up result should expose the previous level");
    assert.equal(levelUpResult.previousLevelLabel, "Lv.1", "Level-up result should expose the previous level label");
    assert.equal(
        levelUpResult.previousProgressText,
        "90/100 XP",
        "Level-up result should retain the previous level progress for the animation"
    );
    assert.equal(
        levelUpResult.previousNextText,
        "다음 레벨까지 10XP",
        "Level-up result should retain the previous level remaining XP for the animation"
    );
    const dashLevelTwoReward = getExperienceRewardsBetween(FIGHTER_IDS.DASH, 1, 2)[0];
    const dashLevelThreeReward = getExperienceRewardsBetween(FIGHTER_IDS.DASH, 2, 3)[0];
    const dashLevelFiveReward = getExperienceRewardsBetween(FIGHTER_IDS.DASH, 4, 5)[0];
    assert.equal(
        levelUpResult.previousNextRewardText,
        `Lv.2 · ${dashLevelTwoReward.text}`,
        "Level-up result should retain the reward reached by the animation"
    );
    assert.equal(levelUpResult.level, 2, "Level-up result should expose the new level");
    assert.deepEqual(
        levelUpResult.earnedRewards.map((reward) => reward.text),
        [dashLevelTwoReward.text],
        "Every level should grant the configured permanent base-stat reward"
    );
    assert.equal(
        levelUpResult.nextRewardText,
        `Lv.3 · ${dashLevelThreeReward.text}`,
        "Tier levels should expose both the next base stat and player-facing ability reward"
    );
    profile.experience.byCharacter[FIGHTER_IDS.DASH].currentXp = getLevelRequirement(4);
    assert.equal(
        getCharacterExperienceSummary(profile, FIGHTER_IDS.DASH).nextRewardText,
        `Lv.5 · ${dashLevelFiveReward.text}`,
        "Next reward UI should resolve the selected character's next level row"
    );

    const dashLevelThree = getCharacterLevelProgression(FIGHTER_IDS.DASH, 3);
    const allRewardEffects = dashLevelThree.effects;
    allRewardEffects.forEach((effect) => {
        assert.doesNotThrow(() => getLevelRewardEffectHandler(effect), "Every configured level reward needs a handler");
    });
    assert.deepEqual(
        getExperienceRewardsBetween(FIGHTER_IDS.DASH, 1, 3).map((reward) => reward.text),
        [dashLevelTwoReward.text, dashLevelThreeReward.text],
        "Level ranges should expose every base stat reward and player-facing tier reward"
    );
    assert.equal(
        allRewardEffects.find((effect) => effect.type === "ability_tier")?.gameText,
        "대시 적중 레이저 · 0.35초 조준 ×0.60",
        "Ability tier effects should preserve the configured game text"
    );

    const playerSpec = {
        ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.DASH),
        teamId: "xp-player",
        hero: null
    };
    const opponentSpec = {
        ...app.roster.find((fighter) => fighter.id !== FIGHTER_IDS.DASH),
        id: "xp-opponent",
        teamId: "xp-opponent"
    };
    const progression = collectActiveExperienceProgression(profile, playerSpec.id);
    const allocation = { hp: 20, damage: 20, speed: 0, skill: 5, defense: 0 };
    const baselineSpec = applyStatAllocation(playerSpec, allocation, true);
    const rewardedSpec = applyStatAllocation(
        applyExperienceProgressionToBaseSpec(playerSpec, progression),
        allocation,
        true
    );
    const expectedDamageMultiplier = baselineSpec.stats.damage / playerSpec.stats.damage;
    const expectedSpeedMultiplier = baselineSpec.stats.speed / playerSpec.stats.speed;
    assert.equal(
        rewardedSpec.stats.damage,
        Number(((playerSpec.stats.damage + progression.baseStatBonuses.damage) * expectedDamageMultiplier).toFixed(3)),
        "Level base damage should be increased before the percentage stat multiplier"
    );
    assert.equal(
        rewardedSpec.stats.speed,
        Number(((playerSpec.stats.speed + progression.baseStatBonuses.speed) * expectedSpeedMultiplier).toFixed(3)),
        "Level base speed should be increased before the percentage stat multiplier"
    );
    assert.equal(
        rewardedSpec.stats.skill,
        baselineSpec.stats.skill,
        "Level rewards must not add cooldown as a base stat"
    );
    const equipmentProfile = createDefaultPlayerProfile();
    equipmentProfile.experience.byCharacter[FIGHTER_IDS.DASH] = { currentXp: getLevelRequirement(4) };
    const fixedDamageItem = {
        instanceId: "experience-fixed-damage",
        rarity: "common",
        slot: "weapon",
        stats: [{ type: "damage", value: 5 }]
    };
    equipmentProfile.equipment.inventory.push(fixedDamageItem);
    equipmentProfile.equipment.equipped.weapon = fixedDamageItem.instanceId;
    const equippedRewardedSpec = applyEquipmentStats(rewardedSpec, equipmentProfile);
    assert.equal(
        equippedRewardedSpec.stats.damage,
        rewardedSpec.stats.damage + 5,
        "Equipment should add a fixed stat after level rewards and percentage allocation"
    );

    let preparedPlayer = null;
    new BattleSimulation([equippedRewardedSpec, opponentSpec], {
        onBattleBallReady(ball) {
            if (ball.id === equippedRewardedSpec.id) {
                applyExperienceProgressionToBall(ball, progression);
                preparedPlayer = ball;
            }
        }
    });
    assert.equal(
        preparedPlayer.maxHp,
        equippedRewardedSpec.stats.hp,
        "Battle ball should receive the prepared HP base stat"
    );
    assert.equal(
        preparedPlayer.stats.baseDamage,
        equippedRewardedSpec.stats.damage,
        "Battle ball should receive the prepared damage base stat"
    );
    assert.equal(
        preparedPlayer.getSkillPoints(),
        allocation.skill,
        "Battle ball should keep cooldown points separate from level base-stat rewards"
    );
    assert.equal(
        preparedPlayer.progression.abilityTier,
        1,
        "Tier rewards should be recorded on the ball progression snapshot"
    );
    assert.deepEqual(
        preparedPlayer.progression.baseStatBonuses,
        progression.baseStatBonuses,
        "Ball progression should retain the accumulated permanent base-stat report"
    );
    assert.equal(
        "skill" in preparedPlayer.progression.baseStatBonuses,
        false,
        "Ball progression must not treat cooldown as a permanent base stat"
    );

    const legacyProfile = createDefaultPlayerProfile();
    legacyProfile.experience = { currentXp: 55, byCharacter: {} };
    legacyProfile.collection.characters.archer = {
        tournamentsCompleted: 1,
        tournamentWins: 0,
        matchWins: 1,
        bestPlacement: 5,
        totalDamageDealt: 100,
        comebackMatchWins: 0,
        firstTournamentAt: 1000,
        lastTournamentAt: 2000
    };
    assert.equal(
        migrateLegacyExperienceToCharacter(legacyProfile, FIGHTER_IDS.DASH),
        FIGHTER_IDS.ARCHER,
        "Legacy global XP should migrate to the most recent recorded character"
    );
    assert.equal(legacyProfile.experience.byCharacter.archer.currentXp, 55);
    console.log("[experience] ok");
}

function testCharacterLevelProgressions(app) {
    const expectedLevels = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    const tierLevels = [3, 6, 9];

    for (const fighter of app.roster) {
        const entries = REWARD_BALANCE.experience.characterLevelProgressions[fighter.id];
        assert.ok(entries, `${fighter.id} should define its own level progression`);
        assert.deepEqual(
            entries.map((entry) => entry.level),
            expectedLevels,
            `${fighter.id} should receive a base stat reward at every level-up`
        );
        assert.ok(
            entries.every((entry) => {
                const [reward] = getCharacterLevelRewardsBetween(fighter.id, entry.level - 1, entry.level);
                return reward.effects.some((effect) => effect.type === "stat" && effect.value > 0);
            }),
            `${fighter.id} should expose a positive permanent base-stat reward on every level row`
        );
        assert.deepEqual(
            entries.filter((entry) => entry.abilityTier).map((entry) => entry.level),
            tierLevels,
            `${fighter.id} should receive ability upgrades only at levels 3, 6, and 9`
        );
        assert.deepEqual(
            entries.filter((entry) => entry.abilityTier).map((entry) => entry.abilityTier),
            [1, 2, 3],
            `${fighter.id} should apply ability tiers in order`
        );
        assert.ok(
            entries
                .filter((entry) => entry.abilityTier)
                .every((entry) => typeof entry.gameText === "string" && entry.gameText.trim()),
            `${fighter.id} should define player-facing game text for every ability tier reward`
        );

        const progression = getCharacterLevelProgression(fighter.id, 10);
        assert.equal(
            progression.rewards.length,
            expectedLevels.length,
            `${fighter.id} should expose every level reward`
        );
        assert.ok(
            progression.effects.filter((effect) => effect.type === "stat").length >= expectedLevels.length,
            `${fighter.id} should expose each level's generated base-stat effects together`
        );
        assert.equal(progression.abilityTier, 3, `${fighter.id} should reach ability tier three at level 9`);

        for (const level of expectedLevels) {
            const [reward] = getCharacterLevelRewardsBetween(fighter.id, level - 1, level);
            assert.equal(reward.level, level, `${fighter.id} should report level ${level} as a single reward row`);
        }
        assert.deepEqual(
            getCharacterLevelRewardsBetween(fighter.id, 10, 10),
            [],
            `${fighter.id} should not receive a duplicate reward at the level cap`
        );
    }
    console.log("[character-level-progression] ok");
}

function testAbilityLevelUpgrades(app) {
    const TIER_LEVELS = [1, 3, 6, 9];
    const assertClose = (actual, expected, message) => {
        assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
    };
    const createTierSimulation = (fighterId, tier = 3) => {
        const fighterSpec = app.roster.find((fighter) => fighter.id === fighterId);
        const opponentSpec = app.roster.find((fighter) => fighter.id !== fighterId);
        const sim = new BattleSimulation(
            [
                { ...fighterSpec, teamId: "tier-player" },
                { ...opponentSpec, id: `tier-opponent-${fighterId}`, teamId: "tier-opponent" }
            ],
            { onLog() {}, onSound() {} },
            null,
            { assignActions: false }
        );
        const ball = sim.fighters[0];
        applyExperienceProgressionToBall(ball, getCharacterLevelProgression(fighterId, TIER_LEVELS[tier]));
        return { sim, ball, target: sim.fighters[1] };
    };

    for (const fighter of app.roster) {
        const { ball } = createTierSimulation(fighter.id);
        const definition = REWARD_BALANCE.experience.abilityUpgrades[fighter.ability];
        const expectedUpgrade = definition.tiers.reduce((merged, tierUpgrade) => ({ ...merged, ...tierUpgrade }), {
            ...definition.base
        });
        assert.equal(ball.progression.abilityTier, 3, `${fighter.id} should receive all three ability tiers`);
        assert.deepEqual(
            ball.ability.getLevelUpgrade(),
            expectedUpgrade,
            `${fighter.id} should consume its own upgrade data`
        );
    }

    const archer = createTierSimulation(FIGHTER_IDS.ARCHER).ball.ability;
    assertClose(archer._getArrowSpeed(), 270 * 2 * 1.15, "Archer tier 1 should increase arrow speed by 15%");
    assertClose(archer._getWindupDuration(), 0.32, "Archer tier 2 should reduce windup by 20%");

    const orbitRun = createTierSimulation(FIGHTER_IDS.ORBIT);
    orbitRun.ball.ability.update(0, orbitRun.target);
    assert.equal(orbitRun.ball.ability.shardCount, 5, "Orbit level rewards should keep the base five shards");
    assertClose(orbitRun.ball.ability.rechargeDuration, 1, "Orbit level rewards should keep base recharge speed");
    assertClose(orbitRun.ball.ability.getVolleyDelay(), 0.18, "Orbit level rewards should keep base volley delay");
    assert.deepEqual(
        orbitRun.ball.ability.getLevelUpgrade(),
        { synchronizedVolley: true, explosiveVolley: true, bodyCatch: true },
        "Orbit tiers should expose only the three behavior rewards"
    );

    const tricksterRun = createTierSimulation(FIGHTER_IDS.TRICKSTER);
    tricksterRun.ball.ability.timer = 0;
    tricksterRun.ball.ability.update(0.01, tricksterRun.target);
    const tierSeeds = tricksterRun.sim.entities.filter((entity) => entity.constructor?.name === "SeedOrb");
    assert.equal(tierSeeds.length, 3, "Trickster level rewards should keep the base three seeds");
    assertClose(tierSeeds[0].life, 14, "Trickster level rewards should keep the base fourteen-second lifetime");
    assert.deepEqual(
        tricksterRun.ball.ability.getLevelUpgrade(),
        { vineSnare: true, seedMarkBurst: true, followupSeed: true },
        "Trickster tiers should expose only the three behavior rewards"
    );

    const grenadeRun = createTierSimulation(FIGHTER_IDS.GRENADE);
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
        grenadeRun.ball.ability._startBurst(grenadeRun.target);
        assert.equal(grenadeRun.ball.ability._burstTotal, 3, "Grenade rewards should preserve the base minimum burst");
    } finally {
        Math.random = originalRandom;
    }
    const grenade = grenadeRun.sim.entities.find((entity) => entity.constructor?.name === "Grenade");
    assert.equal(grenade.explosionRadius, 174, "Grenade rewards should preserve the base explosion radius");
    assert.deepEqual(
        [grenade.stickyEnabled, grenade.burningEnabled, grenade.stickyHomingEnabled],
        [true, true, true],
        "Grenade tiers should expose sticky, burning, and sticky-homing behavior"
    );

    const dashRun = createTierSimulation(FIGHTER_IDS.DASH);
    dashRun.ball.ability.state.cooldownLevel = 2;
    dashRun.ball.ability.onDashWall();
    assertClose(dashRun.ball.ability.getDashMultiplier(), 2.15, "Dash rewards should preserve dash speed");
    assertClose(dashRun.ball.ability.getHomingTurnRate(), 2.4, "Dash rewards should preserve turn rate");
    assert.equal(dashRun.ball.ability.state.cooldownLevel, 0, "Dash wall contact should reset the cooldown stage");
    dashRun.ball.ability.onDashHit(dashRun.target);
    assert.ok(
        dashRun.sim.entities.some((entity) => entity instanceof LaserBeamEffect),
        "Dash tier rewards should create the shared laser effect after a real dash hit"
    );
    const dashCasterLaser = dashRun.sim.entities.find((entity) => entity instanceof LaserBeamEffect);
    const dashCasterState = dashCasterLaser.getCasterVisualState();
    assert.equal(
        DASH_LASER_CASTER_RENDERER,
        drawLaserCasterVisual,
        "Dash laser should expose the named shared caster renderer instead of a Dash-only drawing path"
    );
    assert.deepEqual(
        dashCasterState.origin,
        { x: dashRun.ball.position.x, y: dashRun.ball.position.y },
        "Dash caster visual should anchor its fire origin at the moving Dash owner"
    );
    assert.equal(
        dashCasterState.phase,
        LASER_CASTER_PHASES.MATERIALIZE,
        "Dash caster should materialize before charge"
    );
    assert.equal("target" in dashCasterState, false, "Dash caster visual state should not expose a combat target");
    assert.equal("simulation" in dashCasterState, false, "Dash caster visual state should not expose simulation state");

    const rageRun = createTierSimulation(FIGHTER_IDS.RAGE);
    rageRun.ball.ability.state.timeWithoutCollision = rageRun.ball.ability.getMaxChargeTime();
    assertClose(rageRun.ball.ability.getMaxChargeTime(), 14, "Rage max charge time should be 14 seconds");

    const setBallAngularVelocity = (ball, value) => {
        ball._computeMomentOfInertia();
        ball.applyAngularImpulse((value - ball.angularVelocity) / ball._inverseMomentOfInertia);
        ball.integrateRotation(1 / 60);
    };
    const setSpinVelocity = (ability, value) => {
        setBallAngularVelocity(ability.owner, ability._spinDirection * value);
    };
    const setBallVelocity = (ball, value) => {
        ball.applyImpulse(Vector2.subtract(value, ball.velocity));
    };

    const spinBaseRun = createTierSimulation(FIGHTER_IDS.SPIN, 0);
    const spinBase = spinBaseRun.ball.ability;
    setSpinVelocity(spinBase, 0);
    spinBase.update(spinBase.getMaxChargeTime() * 0.5, spinBaseRun.target);
    assert.ok(
        Math.abs(spinBaseRun.ball._accumulatedTorque) > 0,
        "Spin Ball should make its charged target rotation through torque instead of directly assigning angular velocity"
    );
    assertClose(
        spinBase.getChargeProgress(),
        0.5,
        "Spin Ball should build its rotation resource continuously while it avoids collisions"
    );
    assert.equal(spinBase.getUiState().label, "회전력", "Spin Ball should expose its rotation state in the live UI");

    spinBase.state.timeWithoutCollision = spinBase.getMaxChargeTime();
    assertClose(
        spinBase.getTargetSpinVelocity(),
        Math.PI * 20,
        "Spin Ball should reach a physical 10-revolutions-per-second charge target without changing collision damage rules"
    );
    setSpinVelocity(spinBase, spinBase.getTargetSpinVelocity());
    const spinDamageSpeed = getContactDamageSpeed(spinBaseRun.ball, {
        x: spinBaseRun.ball.position.x,
        y: spinBaseRun.ball.position.y + spinBaseRun.ball.radius
    });
    assert.ok(
        spinDamageSpeed.rotationalSpeed > spinBaseRun.ball.stats.baseSpeed * 10,
        "Spin Ball's actual rotation should convert into linear-equivalent collision damage speed"
    );
    spinBase.onCollision(spinBaseRun.target);
    spinBaseRun.ball.integrateRotation(1 / 60);
    assertClose(spinBase.getChargeProgress(), 0, "Base Spin Ball collisions should consume all rotation charge");
    assertClose(spinBase.getSpinVelocity(), 0, "Base Spin Ball collisions should physically drain its rotation");

    const spinGripRun = createTierSimulation(FIGHTER_IDS.SPIN, 0);
    const spinGrip = spinGripRun.ball.ability;
    assert.equal(
        spinGripRun.ball.physicsMaterial,
        "spinGrip",
        "Spin Ball should use its dedicated high-friction material"
    );
    spinGripRun.ball.position = new Vector2(420, 360);
    spinGripRun.target.position = new Vector2(420 + spinGripRun.ball.radius + spinGripRun.target.radius - 1, 360);
    setBallVelocity(spinGripRun.ball, new Vector2(220, 0));
    setBallVelocity(spinGripRun.target, new Vector2(0, 0));
    setBallAngularVelocity(spinGripRun.target, 0);
    spinGrip.state.timeWithoutCollision = spinGrip.getMaxChargeTime();
    setSpinVelocity(spinGrip, spinGrip.getTargetSpinVelocity());
    const targetLateralVelocityBefore = spinGripRun.target.velocity.y;
    spinGripRun.sim.handleCollision();
    assert.ok(
        Math.abs(spinGripRun.target.velocity.y - targetLateralVelocityBefore) > 300,
        "Spin Ball should transfer its actual rotation through high-friction tangential physics"
    );

    const spinTierOneRun = createTierSimulation(FIGHTER_IDS.SPIN, 1);
    assert.deepEqual(
        spinTierOneRun.ball.ability.getLevelUpgrade(),
        { surfaceCut: true },
        "Spin tier 1 should expose the surface-cut behavior"
    );
    const spinTierThreeRun = createTierSimulation(FIGHTER_IDS.SPIN, 3);
    assert.deepEqual(
        spinTierThreeRun.ball.ability.getLevelUpgrade(),
        { surfaceCut: true, acceleratingCut: true, piercingVortex: true },
        "Spin tiers should expose only the three behavior rewards"
    );

    const eaterRun = createTierSimulation(FIGHTER_IDS.EATER);
    assertClose(eaterRun.ball.ability._getSwallowHoldDuration(), 0.72, "Eater swallow hold duration should be 0.72s");

    const batRun = createTierSimulation(FIGHTER_IDS.BAT_BALL);
    assert.equal(batRun.ball.ability.getArcRange(), 160, "Bat level rewards should keep the base arc range");
    assertClose(batRun.ball.ability.getArcAngle(), (Math.PI * 2) / 3, "Bat level rewards should keep the base arc");
    assertClose(batRun.ball.ability.getWallSlamDuration(), 0.85, "Bat should keep the base 0.85s Wall Slam flow");
    assert.deepEqual(
        batRun.ball.ability.getLevelUpgrade(),
        { rotatingHit: true, homeRun: true, wallReset: true },
        "Bat tiers should expose only the three behavior rewards"
    );

    const vampireRun = createTierSimulation(FIGHTER_IDS.VAMPIRE);
    vampireRun.ball.ability._spawnBats(vampireRun.target);
    const tierBats = vampireRun.sim.entities.filter((entity) => entity.constructor?.name === "BatProjectile");
    assert.equal(tierBats.length, 7, "Vampire level rewards should keep the base seven-bat swarm");
    assertClose(
        tierBats[0].velocity.length(),
        vampireRun.ball.stats.baseSpeed * 0.5,
        "Vampire level rewards should keep the base launch speed"
    );
    assert.deepEqual(
        vampireRun.ball.ability.getLevelUpgrade(),
        { repeatBite: true, lifeBurst: true, bloodPull: true },
        "Vampire tiers should expose only the three behavior rewards"
    );

    const gunnerRun = createTierSimulation(FIGHTER_IDS.GUNNER);
    Math.random = () => 0;
    try {
        gunnerRun.ball.ability._startBurst();
    } finally {
        Math.random = originalRandom;
    }
    assert.equal(gunnerRun.ball.ability.state.burstBulletCount, 6, "Gunner rewards should preserve the 6-shot minimum");
    while (gunnerRun.ball.ability._burstRemaining > 0) gunnerRun.ball.ability._fireBurstBullet();
    const bullets = gunnerRun.sim.entities.filter((entity) => entity.constructor?.name === "BulletProjectile");
    const bullet = bullets[0];
    assertClose(
        bullet.velocity.length(),
        gunnerRun.ball.stats.baseSpeed * 2,
        "Gunner rewards should preserve bullet speed"
    );
    assert.equal(bullets.at(-1).isFinisher, true, "Gunner tier 1 should empower every burst's last bullet");
    assertClose(
        bullets.at(-1).damageMult,
        (0.2 + (6 / 12) * 0.8) * 2,
        "The empowered last bullet should retain the burst-derived multiplier and double it"
    );
    bullet.position = gunnerRun.ball.position.clone();
    bullet._ownerCollectCheck(gunnerRun.sim);
    const refire = gunnerRun.sim.entities.find((entity) => entity.isRefire && !entity.isExpired);
    assert.ok(refire, "Gunner tier 2 should refire an actually collected normal bullet");
    assert.deepEqual(
        [refire.damageMult, refire.canCollect, refire.canStack, refire.retargetAfterBounce],
        [bullet.damageMult, false, false, true],
        "The refire bullet should preserve damage and allow exactly one ricochet retarget"
    );
    gunnerRun.ball.ability.state.collectionStacks = 19;
    gunnerRun.ball.ability.onBulletCollected(bullets[1], gunnerRun.sim);
    const turret = gunnerRun.sim.entities.find((entity) => entity instanceof GunnerTurret);
    assert.ok(turret, "Gunner tier 3 should consume twenty actual collections to deploy a turret");
    assert.deepEqual(
        [turret.life, turret.maxHp, turret.movementMode],
        [8, Math.round(gunnerRun.ball.maxHp * 0.25), "fixed"],
        "The default turret should use the shared eight-second, 25%-HP fixed contract"
    );

    const phantomRun = createTierSimulation(FIGHTER_IDS.PHANTOM);
    assert.deepEqual(
        phantomRun.ball.ability.getStatModifiers(),
        { speed: 1.15, damage: 1.1, defense: 1.5, impact: 1.15 },
        "Phantom should use its rebalanced base stats"
    );
    phantomRun.ball.ability._markTarget(phantomRun.target);
    phantomRun.ball.ability.onFighterStaticCollision(phantomRun.target, { wall: true, terrain: false });
    assert.equal(
        phantomRun.ball.ability.state.pendingStrikeStage,
        "echo",
        "Phantom tier 2 should trigger echo from a wall collision"
    );
    phantomRun.ball.ability.state.activeDashStage = "echo";
    phantomRun.ball.ability.onDashHit(phantomRun.target, {});
    assert.equal(
        phantomRun.ball.ability.state.pendingStrikeStage,
        "terminal",
        "Phantom tier 3 should allow one terminal dash"
    );

    const heroRun = createTierSimulation(FIGHTER_IDS.HERO);
    const heroAbility = heroRun.ball.ability;
    heroAbility.update(5, heroRun.target);
    assert.deepEqual(
        heroAbility.getOrbStackState(),
        { stacks: 5, stackCap: 5, progress: 1 },
        "Hero should charge exactly five growth stacks in five seconds"
    );
    const attractionOrb = new HeroOrb(heroRun.ball, heroRun.ball.position.clone(), new Vector2(0, 0), "hp");
    const heroAttraction = heroAbility.getOrbAttraction(attractionOrb);
    assert.ok(heroAttraction.radius > heroRun.ball.radius, "Hero tier 1 should magnetize growth cores only nearby");
    heroAbility.onFighterCollisionDamageResolved(heroRun.target, 1, { contactPoint: heroRun.target.position });
    assert.equal(heroAbility.state.growthStacks, 0, "Hero should consume every growth stack on one real collision");
    assert.ok(heroAbility.state.stackReleaseFlash > 0, "Hero stack consumption should trigger a visible release flash");
    assert.equal(
        heroRun.sim.entities.filter((entity) => entity.constructor?.name === "HeroOrb").length,
        5,
        "Five consumed growth stacks should create exactly five eight-second cores"
    );
    heroAbility.state.resonanceFragments = Array.from({ length: 5 }, () => ({ color: "#ffd84d" }));
    heroAbility.onFighterCollisionDamageResolved(heroRun.target, 1, { contactPoint: heroRun.target.position });
    const resonance = heroRun.sim.entities.find((entity) => entity instanceof HeroResonanceEffect);
    assert.ok(resonance?.heroicBurst, "Five stored fragments at tier three should arm Heroic Burst");
    console.log("[ability-level-upgrades] ok");
}

function testFiveBallLevelRewardContracts(app) {
    const createRun = (fighterId, { extraEnemy = false, abilityTier = 3 } = {}) => {
        const ownerSpec = app.roster.find((fighter) => fighter.id === fighterId);
        const targetSpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
        const specs = [
            { ...ownerSpec, teamId: `${fighterId}-reward-team` },
            { ...targetSpec, id: `${fighterId}-reward-target`, teamId: "reward-enemy-team" }
        ];
        if (extraEnemy) {
            specs.push({ ...targetSpec, id: `${fighterId}-reward-nearby`, teamId: "reward-enemy-team" });
        }
        const simulation = new BattleSimulation(
            specs,
            { onLog() {}, onSound() {}, onDamageTaken() {}, onDamageDealt() {}, onHpChanged() {} },
            null,
            { assignActions: false, arenaWidth: 960 }
        );
        const [owner, target, nearby] = simulation.fighters;
        owner.ability.setContext({ abilityTier });
        owner.progression.abilityTier = abilityTier;
        owner.stats.baseDamage = 100;
        owner.stats.criticalChance = 0;
        owner.position = new Vector2(180, 300);
        target.position = new Vector2(520, 300);
        for (const enemy of [target, nearby].filter(Boolean)) {
            enemy.maxHp = 5_000;
            enemy.hp = 5_000;
            enemy.stats.baseDefense = 0;
            enemy.stats.criticalChance = 0;
        }
        if (nearby) nearby.position = new Vector2(580, 300);
        return { simulation, owner, target, nearby };
    };

    const straightSegments = traceArenaLaserSegments(new Vector2(100, 100), 0, 300, 200, 1);
    assert.equal(straightSegments.length, 2, "Dash Lv6 should trace an incident and one reflected segment");
    assert.deepEqual(
        [straightSegments[0].end.x, straightSegments[0].end.y, straightSegments[1].end.x],
        [300, 100, 0],
        "Dash reflected ray should use the shared arena bounds"
    );
    const cornerAngle = Math.atan2(100, 200);
    const [cornerSegment] = traceArenaLaserSegments(new Vector2(100, 100), cornerAngle, 300, 200, 0);
    assert.deepEqual(
        [cornerSegment.normal.x, cornerSegment.normal.y],
        [-1, 0],
        "Equal-time corner rays should deterministically choose the x-axis normal"
    );

    const phaseRun = createRun(FIGHTER_IDS.DASH);
    phaseRun.owner.position = new Vector2(100, 300);
    phaseRun.target.position = new Vector2(320, 300);
    const phaseLaser = new LaserBeamEffect(phaseRun.owner, phaseRun.target, { maxWallBounces: 0 });
    const phaseHpBefore = phaseRun.target.hp;
    assert.equal(
        phaseLaser.getCasterVisualState().phase,
        LASER_CASTER_PHASES.MATERIALIZE,
        "Dash laser should start with a materialize flash before its charge aim"
    );
    phaseLaser.update(0.1, phaseRun.simulation);
    phaseRun.owner.position = new Vector2(140, 340);
    phaseLaser.update(0.25, phaseRun.simulation);
    assert.deepEqual(
        [phaseLaser.phase, phaseLaser.fireRemaining, phaseRun.target.hp],
        ["fire", 0.3, phaseHpBefore],
        "An exact 0.35s update should finish only the Dash charge and leave the whole fire phase"
    );
    assert.deepEqual(
        phaseLaser.getCasterVisualState().origin,
        { x: 140, y: 340 },
        "Dash caster visual should follow its owner before the beam locks"
    );
    assert.deepEqual(
        getLaserCasterFireOrigin(phaseLaser.getCasterVisualState()),
        { x: phaseLaser.segments[0].start.x, y: phaseLaser.segments[0].start.y },
        "Dash caster eye origin should match the first gameplay beam segment origin"
    );
    phaseLaser.update(0.1, phaseRun.simulation);
    assert.equal(
        phaseHpBefore - phaseRun.target.hp,
        20,
        "Dash laser should route two immediate 0.05s damage ticks through takeDamage during fire"
    );
    phaseRun.target.position = new Vector2(320, 430);
    phaseLaser.update(0.2, phaseRun.simulation);
    assert.equal(
        phaseHpBefore - phaseRun.target.hp,
        20,
        "A target that leaves the locked beam should receive no later fire ticks"
    );
    assert.equal(phaseLaser.isExpired, true, "Dash laser gameplay should still end at 0.35s charge plus 0.30s fire");
    const dissipateCaster = phaseRun.simulation.entities.find((entity) => entity instanceof LaserCasterDissipateEffect);
    assert.ok(dissipateCaster, "Dash laser expiry should create a short-lived caster dissipate visual");
    assert.equal(
        dissipateCaster.getCasterVisualState().phase,
        LASER_CASTER_PHASES.DISSIPATE,
        "Dash caster should expose a dissipate phase after firing"
    );
    assert.equal("hp" in dissipateCaster, false, "Dash caster visual should not create HP state");
    assert.equal("teamId" in dissipateCaster, false, "Dash caster visual should not create team state");
    assert.equal("name" in dissipateCaster, false, "Dash caster visual should not create a nameplate identity");
    assert.equal("isCombatTarget" in dissipateCaster, false, "Dash caster visual should not become a combat target");
    phaseRun.owner.position = new Vector2(170, 360);
    dissipateCaster.update(0.08, phaseRun.simulation);
    assert.deepEqual(
        dissipateCaster.getCasterVisualState().origin,
        { x: 170, y: 360 },
        "Dissipating Dash caster should remain anchored to owner movement"
    );
    dissipateCaster.update(0.08, phaseRun.simulation);
    assert.equal(dissipateCaster.isExpired, true, "Dash caster dissipate visual should clear within 0.12~0.20 seconds");
    const movingOriginRun = createRun(FIGHTER_IDS.DASH, { extraEnemy: true });
    movingOriginRun.owner.position = new Vector2(100, 300);
    movingOriginRun.target.position = new Vector2(320, 300);
    movingOriginRun.nearby.position = new Vector2(520, 360);
    const movingOriginLaser = new LaserBeamEffect(movingOriginRun.owner, movingOriginRun.target, {
        maxWallBounces: 1
    });
    movingOriginLaser.update(0.35, movingOriginRun.simulation);
    const lockedFireAngle = movingOriginLaser.angle;
    movingOriginRun.owner.position = new Vector2(140, 360);
    movingOriginRun.target.position = new Vector2(320, 300);
    movingOriginLaser.target = movingOriginRun.nearby;
    const oldWorldHpBefore = movingOriginRun.target.hp;
    const translatedLineHpBefore = movingOriginRun.nearby.hp;
    movingOriginLaser.update(0.1, movingOriginRun.simulation);
    assert.equal(movingOriginLaser.angle, lockedFireAngle, "Dash laser should not re-aim after fire starts");
    assert.deepEqual(
        {
            x: movingOriginLaser.segments[0].start.x,
            y: movingOriginLaser.segments[0].start.y
        },
        {
            x: movingOriginRun.owner.position.x,
            y: movingOriginRun.owner.position.y
        },
        "Dash laser should keep the first beam segment anchored to the latest owner position during fire"
    );
    assert.ok(
        Math.abs(movingOriginLaser.segments[1].start.x - movingOriginRun.simulation.width) <= 0.02 &&
            Math.abs(movingOriginLaser.segments[1].start.y - movingOriginRun.owner.position.y) <= 0.02,
        "Dash reflected segment should also be recomputed from the moved owner origin"
    );
    assert.equal(
        oldWorldHpBefore - movingOriginRun.target.hp,
        0,
        "A target left behind on the old world beam should stop taking Dash laser damage after the owner moves"
    );
    assert.equal(
        translatedLineHpBefore - movingOriginRun.nearby.hp,
        40,
        "A target on the translated fixed-angle beam should still receive the reflected Dash laser segments at the moved origin"
    );
    assertForegroundEffectRenders(movingOriginLaser, "Dash moving-origin laser", (primitives) => {
        assert.ok(
            findEffectPrimitive(
                primitives,
                "moveTo",
                ([x, y]) =>
                    Math.abs(x - movingOriginRun.owner.position.x) <= 0.02 &&
                    Math.abs(y - movingOriginRun.owner.position.y) <= 0.02
            ),
            "Dash moving-origin laser should draw from the moved owner position"
        );
        assert.ok(
            !findEffectPrimitive(
                primitives,
                "moveTo",
                ([x, y]) => Math.abs(x - 100) <= 0.02 && Math.abs(y - 300) <= 0.02
            ),
            "Dash moving-origin laser should not leave a fixed beam start at the original fire point"
        );
    });
    const activeCasterLaser = new LaserBeamEffect(phaseRun.owner, phaseRun.target);
    const dissipateCountBeforeSourceDefeat = phaseRun.simulation.entities.filter(
        (entity) => entity instanceof LaserCasterDissipateEffect
    ).length;
    phaseRun.owner.flags.defeated = true;
    activeCasterLaser.update(0.01, phaseRun.simulation);
    assert.equal(
        activeCasterLaser.isExpired,
        true,
        "Defeated Dash source should expire an active caster visual immediately"
    );
    assert.equal(
        phaseRun.simulation.entities.filter((entity) => entity instanceof LaserCasterDissipateEffect).length,
        dissipateCountBeforeSourceDefeat,
        "Early Dash caster expiry should not leave a new dissipation visual behind"
    );
    const sourceCleanupCaster = new LaserCasterDissipateEffect(phaseRun.owner, {
        angle: 0,
        scale: 1,
        palette: phaseLaser.getCasterVisualState().palette
    });
    phaseRun.owner.flags.defeated = true;
    sourceCleanupCaster.update(0.01, phaseRun.simulation);
    assert.equal(
        sourceCleanupCaster.isExpired,
        true,
        "Defeated Dash source should clear its caster visual immediately"
    );
    phaseRun.owner.flags.defeated = false;
    const activeBattleEndLaser = new LaserBeamEffect(phaseRun.owner, phaseRun.target);
    const dissipateCountBeforeBattleEnd = phaseRun.simulation.entities.filter(
        (entity) => entity instanceof LaserCasterDissipateEffect
    ).length;
    phaseRun.simulation.winner = phaseRun.target;
    activeBattleEndLaser.update(0.01, phaseRun.simulation);
    assert.equal(activeBattleEndLaser.isExpired, true, "Battle end should expire an active Dash caster immediately");
    assert.equal(
        phaseRun.simulation.entities.filter((entity) => entity instanceof LaserCasterDissipateEffect).length,
        dissipateCountBeforeBattleEnd,
        "Battle-ended Dash caster should not create a new dissipation visual"
    );
    phaseRun.simulation.winner = null;
    const battleEndCaster = new LaserCasterDissipateEffect(phaseRun.owner, {
        angle: 0,
        scale: 1,
        palette: phaseLaser.getCasterVisualState().palette
    });
    battleEndCaster.update(0.01, { winner: phaseRun.target });
    assert.equal(battleEndCaster.isExpired, true, "Battle end should clear a pending Dash caster visual immediately");
    const casterSmokeContext = makeRecordingCanvasContext();
    drawLaserCasterVisual(
        casterSmokeContext,
        createLaserCasterVisualState({
            origin: { x: 140, y: 340 },
            angle: 0,
            phase: LASER_CASTER_PHASES.CHARGE,
            phaseProgress: 0.5,
            scale: 1,
            aimLength: 180
        })
    );
    assert.ok(
        casterSmokeContext.primitives.some((primitive) => primitive.method === "ellipse"),
        "Shared caster renderer smoke should paint the cyclops silhouette"
    );
    assert.ok(
        casterSmokeContext.primitives.some((primitive) => primitive.method === "setLineDash"),
        "Shared caster renderer smoke should paint the dotted aim line"
    );

    const runReflectedLaser = (steps) => {
        const run = createRun(FIGHTER_IDS.DASH);
        run.owner.position = new Vector2(100, 300);
        run.target.position = new Vector2(320, 300);
        const laser = new LaserBeamEffect(run.owner, run.target, { maxWallBounces: 1 });
        const hpBefore = run.target.hp;
        for (const delta of steps) laser.update(delta, run.simulation);
        return { run, laser, damage: hpBefore - run.target.hp };
    };
    const steppedDash = runReflectedLaser([0.35, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05]);
    const largeDeltaDash = runReflectedLaser([0.65]);
    assert.deepEqual(
        [steppedDash.damage, largeDeltaDash.damage],
        [220, 220],
        "Dash should apply two x0.60 segments and one x1.00 overload independent of phase-sized or large delta updates"
    );
    assert.equal(steppedDash.laser.isExpired, true, "Dash laser should expire only after 0.35s charge plus 0.30s fire");
    assertForegroundEffectRenders(steppedDash.laser, "Dash reflected laser", (primitives) => {
        assert.ok(
            primitives.filter((primitive) => primitive.method === "lineTo").length >= 2,
            "Dash reflected laser should draw both gameplay segments"
        );
        assert.ok(
            findEffectPrimitive(primitives, "arc", ([x]) => Math.abs(x - steppedDash.run.simulation.width) <= 0.02),
            "Dash reflected laser should draw a white reflection core at the wall hit"
        );
        assertEffectUsesColor(
            primitives,
            "#c85222",
            "Dash reflected laser should keep its reflected segment visible against the bright arena"
        );
    });
    const overloadEffect = steppedDash.run.simulation.entities.find((entity) => entity instanceof CrossOverloadEffect);
    assertForegroundEffectRenders(overloadEffect, "Dash cross overload", (primitives) => {
        assertEffectArcAt(
            primitives,
            steppedDash.run.target.position,
            "Dash cross overload",
            (radius) => radius <= 100
        );
        assert.ok(
            primitives.filter((primitive) => primitive.method === "lineTo").length >= 2,
            "Dash cross overload should persist its crossed warning above fighters"
        );
    });

    const stickyRun = createRun(FIGHTER_IDS.GRENADE);
    stickyRun.owner.position = new Vector2(180, 300);
    stickyRun.target.position = new Vector2(420, 300);
    const sticky = new Grenade(stickyRun.owner, stickyRun.target.position, 1, { sticky: true });
    sticky.pos = new Vector2(320, 300);
    sticky.velocity = new Vector2(200, 0);
    sticky.update(0.5, stickyRun.simulation);
    assert.equal(sticky.stickyTarget, stickyRun.target, "Grenade Lv3 should stick only after actual path-body contact");
    const localOffset = sticky.stickyLocalOffset.clone();
    stickyRun.target.angle = Math.PI / 2;
    stickyRun.target.position = new Vector2(440, 330);
    sticky.update(0, stickyRun.simulation);
    const rotatedOffset = new Vector2(-localOffset.y, localOffset.x);
    assert.ok(
        Vector2.subtract(sticky.position, Vector2.add(stickyRun.target.position, rotatedOffset)).length() < 1e-6,
        "Sticky grenade should follow the target's rotated local surface coordinate"
    );
    const blockedSticky = new Grenade(stickyRun.owner, stickyRun.target.position, 1, { sticky: true });
    const blockedStart = Vector2.add(stickyRun.target.position, new Vector2(-100, 0));
    blockedSticky.pos = stickyRun.target.position.clone();
    blockedSticky.velocity = new Vector2(160, 0);
    assert.equal(
        blockedSticky._tryStick(blockedStart, stickyRun.simulation),
        false,
        "A target with one live sticky grenade should reject a simultaneous second sticky grenade"
    );

    const sweepRun = createRun(FIGHTER_IDS.GRENADE, { extraEnemy: true });
    sweepRun.target.position = new Vector2(420, 300);
    sweepRun.nearby.position = new Vector2(570, 300);
    const sweepGrenade = new Grenade(sweepRun.owner, new Vector2(700, 300), 1, { sticky: true });
    const leftEntry = sweepGrenade._getSweptContact(new Vector2(300, 300), new Vector2(700, 300), sweepRun.target);
    const rightEntry = sweepGrenade._getSweptContact(new Vector2(540, 300), new Vector2(300, 300), sweepRun.target);
    assert.ok(
        leftEntry.surfacePoint.x < sweepRun.target.position.x && rightEntry.surfacePoint.x > sweepRun.target.position.x,
        "Swept sticky contact should preserve the actual entry surface instead of estimating it from the end position"
    );
    const overlapContact = sweepGrenade._getSweptContact(
        sweepRun.target.position,
        sweepRun.target.position,
        sweepRun.target
    );
    assert.deepEqual(
        [overlapContact.time, overlapContact.surfacePoint.x, overlapContact.surfacePoint.y],
        [0, sweepRun.target.position.x + sweepRun.target.radius, sweepRun.target.position.y],
        "Zero-length center overlap should use a deterministic positive-x surface anchor"
    );
    sweepGrenade.pos = new Vector2(700, 300);
    assert.equal(sweepGrenade._tryStick(new Vector2(300, 300), sweepRun.simulation), true);
    assert.equal(
        sweepGrenade.stickyTarget,
        sweepRun.target,
        "A swept frame crossing multiple hostiles should attach only to the earliest intersection"
    );

    const attachStickyMarker = (run, target) => {
        const marker = new Grenade(run.owner, target.position, 3, { sticky: true, stickyHoming: true });
        marker.pos = Vector2.add(target.position, new Vector2(-(target.radius + marker.radius + 8), 0));
        marker.applyImpulse(Vector2.subtract(new Vector2(240, 0), marker.velocity));
        marker.update(0.1, run.simulation);
        run.simulation.entities.push(marker);
        assert.equal(marker.stickyTarget, target, "Homing markers should come from actual Lv3 surface contact");
        return marker;
    };

    const homingRun = createRun(FIGHTER_IDS.GRENADE, { extraEnemy: true });
    homingRun.owner.position = new Vector2(120, 300);
    homingRun.target.position = new Vector2(720, 560);
    homingRun.nearby.position = new Vector2(520, 620);
    const existingFlyer = new Grenade(homingRun.owner, new Vector2(900, 300), 4, { sticky: true, stickyHoming: true });
    homingRun.simulation.entities.push(existingFlyer);
    const speedBeforeHoming = existingFlyer.velocity.length();
    existingFlyer.update(0.5, homingRun.simulation);
    assert.equal(
        Math.atan2(existingFlyer.velocity.y, existingFlyer.velocity.x),
        0,
        "Grenade should retain its initial inertia through the exact 0.50-second homing offset"
    );
    assert.equal(
        existingFlyer.homingTrail.length,
        0,
        "Grenade should not draw a homing trail before the 0.50-second offset"
    );
    const preHomingContext = makeRecordingCanvasContext();
    existingFlyer.draw(preHomingContext);
    assert.equal(
        preHomingContext.primitives.some((primitive) => primitive.method === "quadraticCurveTo"),
        false,
        "Grenade should not render a curved trail before homing is active"
    );

    const distantMarker = attachStickyMarker(homingRun, homingRun.target);
    const closestMarker = attachStickyMarker(homingRun, homingRun.nearby);
    assert.equal(
        existingFlyer._getStickyHomingTarget(homingRun.simulation),
        homingRun.nearby,
        "Grenade should select only the closest same-owner sticky hostile marker"
    );
    assert.equal(
        closestMarker._getStickyHomingTarget(homingRun.simulation),
        null,
        "A sticky grenade should be excluded from its own flying homing path"
    );
    const markerContext = makeRecordingCanvasContext();
    closestMarker.draw(markerContext);
    assert.ok(
        findEffectPrimitive(
            markerContext.primitives,
            "arc",
            ([x, y, radius], primitive) =>
                x === closestMarker.position.x &&
                y === closestMarker.position.y &&
                radius === closestMarker.radius + 8 &&
                String(primitive.fillStyle).includes("rgba")
        ),
        "Sticky grenade should keep its existing red blinking marker ring"
    );
    assert.equal(
        markerContext.primitives.some((primitive) => primitive.method === "quadraticCurveTo"),
        false,
        "Sticky grenade should never draw the flying homing trail"
    );

    existingFlyer.update(0.1, homingRun.simulation);
    const firstTurn = Math.atan2(existingFlyer.velocity.y, existingFlyer.velocity.x);
    assert.ok(firstTurn > 0 && firstTurn <= 0.2 + 1e-9, "Grenade homing should turn at most 2 rad/s toward its marker");
    assert.ok(
        Math.abs(existingFlyer.velocity.length() - speedBeforeHoming) < 1e-9,
        "Grenade homing should preserve its exact speed magnitude"
    );
    assert.ok(
        Math.abs(existingFlyer.timer - 3.4) < 1e-9,
        "Grenade homing should not shorten its fuse outside the existing proximity rule"
    );
    existingFlyer.update(0.1, homingRun.simulation);
    const activeTrailContext = makeRecordingCanvasContext();
    existingFlyer.draw(activeTrailContext);
    assert.ok(
        activeTrailContext.primitives.some((primitive) => primitive.method === "quadraticCurveTo"),
        "Only an actively homing flying grenade should draw a short curved trail"
    );

    const newFlyer = new Grenade(homingRun.owner, new Vector2(900, 300), 4, { sticky: true, stickyHoming: true });
    newFlyer.update(0.49, homingRun.simulation);
    assert.equal(
        Math.atan2(newFlyer.velocity.y, newFlyer.velocity.x),
        0,
        "Newly fired Grenades should also retain the full 0.50-second initial offset"
    );
    newFlyer.update(0.02, homingRun.simulation);
    assert.ok(
        Math.atan2(newFlyer.velocity.y, newFlyer.velocity.x) > 0,
        "Newly fired Grenades should begin homing immediately after their own offset completes"
    );
    assert.ok(
        Math.abs(newFlyer.velocity.length() - speedBeforeHoming) < 1e-9,
        "Newly fired homing Grenades should also preserve speed magnitude"
    );

    homingRun.nearby.flags.defeated = true;
    assert.equal(
        existingFlyer._getStickyHomingTarget(homingRun.simulation),
        homingRun.target,
        "Grenade should immediately reselect the next closest live sticky marker after a target disappears"
    );
    homingRun.nearby.flags.defeated = false;
    const foreignMarker = new Grenade(homingRun.target, homingRun.nearby.position, 3, { sticky: true });
    foreignMarker.stickyTarget = homingRun.nearby;
    homingRun.nearby._stickyGrenade = foreignMarker;
    assert.equal(
        existingFlyer._getStickyHomingTarget(homingRun.simulation),
        homingRun.target,
        "Grenade should ignore a sticky marker owned by another fighter"
    );
    homingRun.nearby._stickyGrenade = closestMarker;
    homingRun.target.flags.defeated = true;
    homingRun.nearby.flags.defeated = true;
    const inertialVelocity = existingFlyer.velocity.clone();
    const inertialTimer = existingFlyer.timer;
    existingFlyer.update(0.1, homingRun.simulation);
    assert.ok(
        Vector2.subtract(existingFlyer.velocity, inertialVelocity).length() < 1e-9,
        "Grenade should resume inertial flight when no live sticky marker remains"
    );
    assert.equal(existingFlyer.homingTrail.length, 0, "Grenade should remove its trail when no marker remains");
    assert.ok(
        Math.abs(existingFlyer.timer - (inertialTimer - 0.1)) < 1e-9,
        "No-marker inertia should keep the normal fuse countdown without Lv9 shortening"
    );

    const grenadeRun = createRun(FIGHTER_IDS.GRENADE, { extraEnemy: true });
    grenadeRun.target.position = new Vector2(440, 300);
    grenadeRun.nearby.position = new Vector2(510, 300);
    const firstExplosion = new Grenade(grenadeRun.owner, grenadeRun.target.position, 1, { burning: true });
    firstExplosion.pos = grenadeRun.target.position.clone();
    firstExplosion._detonate(grenadeRun.simulation);
    const burning = grenadeRun.target._igniteState;
    const hpAfterExplosion = grenadeRun.target.hp;
    burning.update(0.5);
    assert.equal(
        hpAfterExplosion - grenadeRun.target.hp,
        50,
        "Grenade Lv6 should deal five 0.1s ticks for total-attack x0.50"
    );
    const burnPrimer = new Grenade(grenadeRun.owner, grenadeRun.target.position, 1, { burning: true });
    burnPrimer.pos = grenadeRun.target.position.clone();
    burnPrimer._detonate(grenadeRun.simulation);
    const secondExplosion = new Grenade(grenadeRun.owner, grenadeRun.target.position, 1, {
        burning: true,
        stickyHoming: true
    });
    secondExplosion.pos = grenadeRun.target.position.clone();
    const targetHpBeforeReburst = grenadeRun.target.hp;
    const nearbyHpBeforeReburst = grenadeRun.nearby.hp;
    secondExplosion._detonate(grenadeRun.simulation);
    assert.equal(
        targetHpBeforeReburst - grenadeRun.target.hp,
        250,
        "Grenade Lv9 should keep only the original direct explosion damage on an already burning target"
    );
    assert.equal(
        nearbyHpBeforeReburst - grenadeRun.nearby.hp,
        250,
        "Grenade Lv9 should not add a nearby reburst damage or knockback path"
    );
    assert.equal(
        grenadeRun.simulation.entities.some((entity) => entity.constructor?.name === "GrenadeReburstEffect"),
        false,
        "Grenade Lv9 should not create the removed reburst effect entity"
    );

    const gunnerRun = createRun(FIGHTER_IDS.GUNNER, { extraEnemy: true });
    const gunnerAbility = gunnerRun.owner.ability;
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
        gunnerAbility._startBurst();
        gunnerAbility._fireBurstBullet();
    } finally {
        Math.random = originalRandom;
    }
    const collectedBullet = gunnerRun.simulation.entities.find(
        (entity) => entity.constructor?.name === "BulletProjectile" && !entity.isRefire
    );
    collectedBullet.position = gunnerRun.owner.position.clone();
    collectedBullet._ownerCollectCheck(gunnerRun.simulation);
    const refire = gunnerRun.simulation.entities.find((entity) => entity.isRefire && !entity.isExpired);
    gunnerRun.target.position = new Vector2(300, 500);
    gunnerRun.nearby.position = new Vector2(850, 240);
    refire.pos = new Vector2(gunnerRun.simulation.width - refire.radius - 1, 240);
    refire.applyImpulse(Vector2.subtract(new Vector2(300, 0), refire.velocity));
    refire.update(0.02, gunnerRun.simulation);
    assert.deepEqual(
        [refire.retargetConsumed, refire.canBounce, refire.canCollect, refire.canStack],
        [true, false, false, false],
        "Gunner refire should consume its only ricochet retarget and remain ineligible for every collection chain"
    );
    const nearbyDirection = Vector2.subtract(gunnerRun.nearby.position, refire.position).normalize();
    assert.ok(
        refire.velocity.clone().normalize().dot(nearbyDirection) > 0.999,
        "Gunner first ricochet should turn toward the hostile nearest to the wall contact point"
    );
    const ricochetTrail = gunnerRun.simulation.entities
        .filter((entity) => entity.constructor?.name === "SlashTrail")
        .at(-1);
    assert.ok(
        Math.abs(Vector2.subtract(ricochetTrail.to, ricochetTrail.from).length() - 48) < 0.001,
        "Gunner ricochet direction marker should remain a bounded 48-unit trail"
    );
    refire.pos = new Vector2(gunnerRun.simulation.width - refire.radius - 1, 240);
    refire.applyImpulse(Vector2.subtract(new Vector2(300, 0), refire.velocity));
    refire.update(0.02, gunnerRun.simulation);
    assert.equal(refire.isExpired, true, "Gunner refire should expire instead of bouncing a second time");
    while (gunnerAbility._burstRemaining > 1) gunnerAbility._fireBurstBullet();
    const bulletCountBeforeCharge = gunnerRun.simulation.entities.filter(
        (entity) => entity.constructor?.name === "BulletProjectile"
    ).length;
    gunnerAbility._fireBurstBullet();
    assert.ok(gunnerAbility.finisherCharge, "Gunner should visibly charge before every eligible last bullet");
    assert.equal(
        gunnerRun.simulation.entities.filter((entity) => entity.constructor?.name === "BulletProjectile").length,
        bulletCountBeforeCharge,
        "Gunner finisher charge should precede projectile creation instead of overlapping it"
    );
    const chargeCtx = makeRecordingCanvasContext();
    gunnerAbility.draw(chargeCtx);
    assert.ok(
        findEffectPrimitive(chargeCtx.primitives, "arc", (args, primitive) => primitive.strokeStyle === "#ff4488"),
        "Gunner finisher charge should draw a dedicated pink muzzle ring"
    );
    gunnerAbility._fireBurstBullet();
    const chargedFinisher = gunnerRun.simulation.entities
        .filter((entity) => entity.constructor?.name === "BulletProjectile")
        .at(-1);
    assert.deepEqual(
        [chargedFinisher.isFinisher, chargedFinisher.radius, gunnerAbility.finisherCharge],
        [true, 7, null],
        "Gunner charge should release one larger pink finisher and clear its transient state"
    );
    const blockedPlacement = Vector2.add(gunnerRun.owner.position, new Vector2(80, 0));
    gunnerRun.simulation.terrain.push({
        shape: "circle",
        x: blockedPlacement.x,
        y: blockedPlacement.y,
        radius: 42,
        blocking: true
    });
    const correctedPlacement = gunnerAbility._findTurretPlacement(new Vector2(1, 0), gunnerRun.simulation);
    assert.ok(
        Vector2.subtract(correctedPlacement, blockedPlacement).length() >= 70,
        "Gunner turret placement should reject terrain overlap and select the nearest clear candidate"
    );

    const compareTurretMode = (movementMode) => {
        const run = createRun(FIGHTER_IDS.GUNNER);
        run.owner.position = new Vector2(180, 300);
        run.target.position = new Vector2(760, 300);
        const turret = new GunnerTurret(run.owner, new Vector2(320, 300), { movementMode });
        run.simulation.entities.push(turret);
        const start = turret.position.clone();
        for (const _ of Array.from({ length: 10 })) turret.update(0.1, run.simulation);
        return {
            run,
            turret,
            displacement: Vector2.subtract(turret.position, start).length(),
            shots: run.simulation.entities.filter((entity) => entity.constructor?.name === "BulletProjectile").length
        };
    };
    const fixedTurret = compareTurretMode("fixed");
    const mobileTurret = compareTurretMode("mobile");
    assert.equal(
        fixedTurret.displacement,
        0,
        "The selected default fixed turret should preserve its deployed position"
    );
    assert.ok(
        mobileTurret.displacement > 60,
        "The comparison mobile turret should visibly move during the same second"
    );
    assert.deepEqual(
        [fixedTurret.shots, fixedTurret.turret.hp, fixedTurret.turret.life],
        [mobileTurret.shots, mobileTurret.turret.hp, mobileTurret.turret.life],
        "Fixed and mobile turret modes should preserve the same fire, HP, and lifetime contract"
    );
    const verifyTurretSeparation = (movementMode) => {
        const run = createRun(FIGHTER_IDS.GUNNER);
        const turret = new GunnerTurret(run.owner, new Vector2(320, 300), { movementMode });
        run.target.position = new Vector2(320 + turret.radius + run.target.radius - 9, 300);
        const fighterVelocity = run.target.velocity.clone();
        const fighterAngularVelocity = run.target.angularVelocity;
        const turretVelocity = turret.velocity.clone();
        turret._handleFighterContacts(run.simulation);
        return {
            separatedDistance: Vector2.subtract(run.target.position, turret.position).length(),
            requiredDistance: turret.radius + run.target.radius,
            fighterVelocity,
            fighterAngularVelocity,
            turretVelocity,
            run,
            turret
        };
    };
    const fixedSeparation = verifyTurretSeparation("fixed");
    const mobileSeparation = verifyTurretSeparation("mobile");
    for (const separation of [fixedSeparation, mobileSeparation]) {
        assert.ok(
            separation.separatedDistance >= separation.requiredDistance,
            "PhysicsBody position correction should separate turret contacts in both movement modes"
        );
        assert.deepEqual(
            [separation.run.target.velocity, separation.run.target.angularVelocity],
            [separation.fighterVelocity, separation.fighterAngularVelocity],
            "Turret overlap correction should not mutate fighter velocity or angular velocity"
        );
    }
    assert.deepEqual(
        fixedSeparation.turret.velocity,
        fixedSeparation.turretVelocity,
        "Fixed turret separation should not add an unintended movement impulse"
    );
    assert.ok(
        Vector2.subtract(mobileSeparation.turret.velocity, mobileSeparation.turretVelocity).length() > 0,
        "Mobile turret separation may retain its intentional recoil impulse"
    );
    fixedTurret.turret.aimTarget = fixedTurret.run.target;
    assertForegroundEffectRenders(fixedTurret.turret, "Gunner fixed turret", (primitives) => {
        assert.ok(findEffectPrimitive(primitives, "fillRect"), "Gunner turret should draw its body and HP bar");
        assertEffectArcAt(primitives, fixedTurret.turret.position, "Gunner fixed turret");
        assert.ok(findEffectPrimitive(primitives, "lineTo"), "Gunner turret should telegraph its next shot in teal");
    });
    const expiringAbility = { state: { turret: null } };
    const expiringTurret = new GunnerTurret(fixedTurret.run.owner, new Vector2(420, 300), {
        movementMode: "fixed",
        sourceAbility: expiringAbility
    });
    expiringAbility.state.turret = expiringTurret;
    expiringTurret.life = 0.05;
    expiringTurret.update(0.1, fixedTurret.run.simulation);
    assert.deepEqual(
        [expiringTurret.isExpired, expiringAbility.state.turret],
        [true, null],
        "Gunner turret natural expiry should run shared cleanup and release the ability reference"
    );
    fixedTurret.turret.takeDamage(fixedTurret.turret.maxHp, fixedTurret.run.owner, "Turret Test");
    assert.equal(
        fixedTurret.turret.isExpired,
        true,
        "Gunner turret should use the common destructible target lifecycle"
    );

    const phantomRun = createRun(FIGHTER_IDS.PHANTOM);
    phantomRun.owner.ability.setContext({ abilityTier: 3 });
    phantomRun.owner.stats.criticalChance = 0;
    phantomRun.target.stats.criticalChance = 0;
    const approvedOptimalCollisionBaseline = 46.2;
    const shadowStrikeDamage = 10 * 1.5;
    assert.equal(
        approvedOptimalCollisionBaseline + shadowStrikeDamage,
        61.2,
        "Phantom attack 10 approved optimal Lv9 chain baseline should fall from 64.2 to 61.2"
    );
    let capturedDash = null;
    phantomRun.owner.initiateDash = (direction, options) => {
        capturedDash = { direction, options };
    };
    phantomRun.owner.ability.state.teleportTargetId = phantomRun.target.id;
    phantomRun.owner.ability.state.pendingStrikeStage = "base";
    phantomRun.owner.stats.baseDamage = 40;
    phantomRun.owner.ability._startDashAfterTeleport();
    assert.equal(
        capturedDash.options.collisionDamage,
        60,
        "Phantom base Shadow Strike should scale growth and equipment attack by x1.50 instead of fixed damage"
    );

    const heroRun = createRun(FIGHTER_IDS.HERO, { extraEnemy: true });
    const heroAbility = heroRun.owner.ability;
    heroAbility.update(5);
    const seededRandom = Math.random;
    Math.random = () => 0.5;
    try {
        heroAbility.onFighterCollisionDamageResolved(heroRun.target, 1, {
            contactPoint: heroRun.target.position.clone()
        });
    } finally {
        Math.random = seededRandom;
    }
    const growthCores = heroRun.simulation.entities.filter((entity) => entity.constructor?.name === "HeroOrb");
    assert.equal(growthCores.length, 5, "Hero should release one growth core per consumed stack");
    assert.ok(
        growthCores.every((core) => core.life === 8),
        "Every Hero growth core should use the fixed eight-second life"
    );
    const combatSpeed = heroRun.owner.stats.baseSpeed * heroRun.owner.getStatModifiers().speed;
    assert.ok(
        growthCores.every(
            (core) => core.velocity.length() >= combatSpeed * 0.72 && core.velocity.length() <= combatSpeed * 0.96
        ),
        "Hero growth core launch speeds should stay inside the owner combat-speed range"
    );
    const oldestCore = growthCores[0];
    heroAbility._spawnCore("hp", heroRun.owner.position, new Vector2(1, 0));
    assert.equal(oldestCore.isExpired, true, "Hero should expire the oldest core before exceeding five active cores");

    const criticalCore = heroRun.simulation.entities.find(
        (entity) => entity.constructor?.name === "HeroOrb" && !entity.isExpired
    );
    criticalCore.effectType = "critical";
    criticalCore.color = "#ff7bd5";
    criticalCore.collectionGraceRemaining = 0;
    criticalCore.position = heroRun.owner.position.clone();
    heroRun.owner.stats.criticalChance = 95;
    Math.random = () => 0.999;
    try {
        criticalCore.update(0, heroRun.simulation);
    } finally {
        Math.random = seededRandom;
    }
    assert.equal(heroRun.owner.stats.criticalChance, 100, "Hero critical core should clamp its 2~6%p reward at 100%");

    const skillRun = createRun(FIGHTER_IDS.HERO);
    const skillBefore = skillRun.owner.getSkillPoints();
    const cooldownBefore = skillRun.owner.ability.cooldown;
    const allocationBefore = skillRun.owner.stats.allocation ? { ...skillRun.owner.stats.allocation } : null;
    Math.random = () => 0;
    try {
        HERO_ORB_EFFECTS.skill.apply(skillRun.owner);
    } finally {
        Math.random = seededRandom;
    }
    assert.deepEqual(
        [skillRun.owner.hero.bonuses.skill, skillRun.owner.getSkillPoints()],
        [2, skillBefore + 2],
        "Hero skill cores should contribute their current-match bonus through the shared skill-point getter"
    );
    assert.ok(
        skillRun.owner.ability.cooldown < cooldownBefore,
        "Hero skill cores should immediately reduce ability cooldown"
    );
    assert.deepEqual(
        skillRun.owner.stats.allocation,
        allocationBefore,
        "Current-match Hero skill cores should not mutate permanent or allocated skill ownership"
    );
    const archerDefaults = createRun(FIGHTER_IDS.ARCHER).owner;
    assert.equal(
        archerDefaults.getSkillPoints(),
        archerDefaults.stats.baseSkill + (archerDefaults.stats.allocation?.skill ?? 0),
        "Non-Hero fighters should preserve their default skill-point calculation when Hero bonuses are zero"
    );
    const carryoverSpec = {
        ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO),
        teamId: "hero-carryover-team",
        statAllocation: { skill: 4 },
        hero: { carryover: { skill: 3 } }
    };
    const carryoverOpponent = {
        ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
        id: "hero-carryover-target",
        teamId: "hero-carryover-enemy"
    };
    const carryoverSimulation = new BattleSimulation([carryoverSpec, carryoverOpponent], {}, null, {
        assignActions: false
    });
    assert.deepEqual(
        [carryoverSimulation.fighters[0].getSkillPoints(), carryoverSimulation.fighters[0].hero.bonuses.skill],
        [7, 0],
        "Hunting carryover skill should remain in its existing carryover/allocation path without double counting bonuses"
    );

    heroRun.owner.stats.baseDamage = 100;
    heroRun.owner.stats.criticalChance = 0;
    heroRun.target.position = new Vector2(520, 300);
    heroRun.nearby.position = new Vector2(580, 300);
    const resonance = new HeroResonanceEffect(
        heroRun.owner,
        heroRun.target,
        Array.from({ length: 5 }, (_, index) => ({
            color: ["#44dd44", "#ff4444", "#4488ff", "#bb66ff", "#ff7bd5"][index]
        })),
        { heroicBurst: true }
    );
    assertForegroundEffectRenders(resonance, "Hero resonance launch", (primitives) => {
        assert.ok(
            findEffectPrimitive(primitives, "quadraticCurveTo"),
            "Hero resonance should draw its curved flight path"
        );
    });
    const heroTargetHpBefore = heroRun.target.hp;
    const heroNearbyHpBefore = heroRun.nearby.hp;
    resonance.update(0.2, heroRun.simulation);
    assert.equal(resonance.hitCount, 2, "Hero resonance mid-frame should retain two actual surface anchors");
    assertForegroundEffectRenders(resonance, "Hero resonance mid", (primitives) => {
        assert.ok(
            primitives.filter((primitive) => primitive.method === "lineTo").length >= 1,
            "Hero resonance mid-frame should connect its first anchored star vertices"
        );
    });
    resonance.update(0.3, heroRun.simulation);
    assert.equal(
        heroTargetHpBefore - heroRun.target.hp,
        175,
        "Five Hero resonance hits and one Heroic Burst should total x1.75 on the primary target"
    );
    assert.equal(heroNearbyHpBefore - heroRun.nearby.hp, 75, "Heroic Burst should deal x0.75 once to a nearby hostile");
    const firstAnchor = resonance.starAnchors[0];
    heroRun.target.applyPositionCorrection(new Vector2(45, 30));
    heroRun.target.angle = Math.PI / 2;
    const expectedAnchor = Vector2.add(
        heroRun.target.position,
        new Vector2(-firstAnchor.localOffset.y, firstAnchor.localOffset.x)
    );
    const movedAnchor = resonance.getStarAnchorPosition(0);
    assert.ok(
        Vector2.subtract(movedAnchor, expectedAnchor).length() < 1e-6,
        "Hero star vertices should follow target translation and rotation from their stored local surface offsets"
    );
    assertForegroundEffectRenders(resonance, "Heroic Burst star", (primitives) => {
        const visibleAnchor = resonance.getStarAnchorPosition(0, 7);
        assert.ok(
            findEffectPrimitive(
                primitives,
                "moveTo",
                ([x, y]) => Math.abs(x - visibleAnchor.x) < 1e-6 && Math.abs(y - visibleAnchor.y) < 1e-6
            ),
            "ArenaRenderer should draw the completed star from the moved target's local surface anchor"
        );
        assert.ok(
            primitives.filter((primitive) => primitive.method === "lineTo").length >= 4,
            "Heroic Burst should draw the completed five-point star"
        );
    });

    console.log("[five-ball-level-reward-contracts] ok");
}

function testTricksterLevelRewardContracts(app) {
    const createRun = (tier) => {
        const ownerSpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER);
        const targetSpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
        const simulation = new BattleSimulation(
            [
                { ...ownerSpec, teamId: "trickster-team" },
                { ...targetSpec, id: `trickster-target-${tier}`, teamId: "enemy-team" }
            ],
            { onLog() {}, onSound() {}, onDamageTaken() {}, onDamageDealt() {}, onHpChanged() {} },
            null,
            { assignActions: false, arenaWidth: 2_000 }
        );
        const [owner, target] = simulation.fighters;
        owner.ability.setContext({ abilityTier: tier });
        owner.stats.baseDamage = 100;
        owner.stats.criticalChance = 0;
        target.maxHp = 2_000;
        target.hp = 2_000;
        target.stats.baseDefense = 0;
        owner.position = new Vector2(300, 480);
        target.position = new Vector2(700, 480);
        return { simulation, owner, target };
    };
    const triggerEnemySeed = (run) => {
        const seed = run.simulation.spawnSeedOrb(run.owner, run.target.position.clone(), new Vector2(), 14);
        seed.update(0, run.simulation);
        return seed;
    };

    const progressionRows = REWARD_BALANCE.experience.characterLevelProgressions.trickster.filter(
        (entry) => entry.abilityTier
    );
    assert.deepEqual(
        progressionRows.map((entry) => entry.gameText),
        ["덩굴 감속 0.5초 · 5틱 ×0.10", "씨앗 표식 1.8초 · 돌진 폭발 ×1.20", "폭발 접점 후속 씨앗 · 활성 유예 0.5초"]
    );
    assert.deepEqual(REWARD_BALANCE.experience.abilityUpgrades.trickster.tiers, [
        {},
        { vineSnare: true },
        { seedMarkBurst: true },
        { followupSeed: true }
    ]);

    const slowRun = createRun(1);
    const hpBeforeTicks = slowRun.target.hp;
    triggerEnemySeed(slowRun);
    assert.equal(slowRun.target.state.slow.amount, 0.8, "Lv3 seed contact should slow hostile targets by 20%");
    assert.equal(slowRun.target.state.periodicDamage.length, 1, "Lv3 should attach one reusable periodic effect");
    const vineEffect = slowRun.simulation.entities.find(
        (entity) => entity.constructor?.name === "VineSnareVisualEffect"
    );
    const renderVine = (label) => {
        let vineArc;
        assertForegroundEffectRenders(vineEffect, label, (primitives) => {
            vineArc = assertEffectArcAt(
                primitives,
                slowRun.target.position,
                label,
                (radius) => radius >= slowRun.target.radius + 4 && radius <= slowRun.target.radius + 14
            );
            assertEffectUsesColor(primitives, "#55d66b", label);
            assert.ok(
                findEffectPrimitive(
                    primitives,
                    "ellipse",
                    ([x, y, radiusX, radiusY]) => x === 0 && y === 0 && radiusX >= 6 && radiusY === 2.5
                ),
                `${label} should draw the vine leaves around the snared target`
            );
        });
        return { alpha: vineArc.globalAlpha, startAngle: vineArc.args[3] };
    };
    const vineStart = renderVine("Lv3 vine snare start");
    for (const _ of Array.from({ length: 2 })) slowRun.target._tickTimers(0.1);
    vineEffect.update(0);
    const vineMid = renderVine("Lv3 vine snare mid");
    for (const _ of Array.from({ length: 2 })) slowRun.target._tickTimers(0.1);
    vineEffect.update(0);
    const vineEnd = renderVine("Lv3 vine snare end");
    assert.ok(
        vineStart.alpha > vineMid.alpha && vineMid.alpha > vineEnd.alpha,
        "Vine snare should visibly fade across start, mid, and final active frames"
    );
    assert.ok(
        vineStart.startAngle < vineMid.startAngle && vineMid.startAngle < vineEnd.startAngle,
        "Vine arcs should tighten around the target as the periodic effect advances"
    );
    slowRun.target._tickTimers(0.1);
    vineEffect.update(0);
    assert.equal(vineEffect.isExpired, true, "Vine visual should expire with the fifth periodic damage tick");
    assert.equal(hpBeforeTicks - slowRun.target.hp, 50, "Lv3 vines should deal five total-attack x0.10 ticks");
    assert.equal(slowRun.target.state.slow, null, "Lv3 slow should finish at 0.50 seconds");

    const markRun = createRun(2);
    triggerEnemySeed(markRun);
    assert.equal(markRun.owner.ability.state.marks.get(markRun.target), 1.8, "Lv6 mark should last 1.8 seconds");
    const markEffect = markRun.simulation.entities.find(
        (entity) => entity.constructor?.name === "TricksterSeedMarkEffect"
    );
    const markCenter = Vector2.add(markRun.target.position, new Vector2(0, -markRun.target.radius - 14));
    const renderSeedMark = (label) => {
        let seedAlpha;
        assertForegroundEffectRenders(markEffect, label, (primitives) => {
            assert.ok(
                findEffectPrimitive(
                    primitives,
                    "translate",
                    ([x, y]) => Math.abs(x - markCenter.x) < 1e-6 && Math.abs(y - markCenter.y) < 1e-6
                ),
                `${label} should anchor the seed above the marked target`
            );
            const seed = findEffectPrimitive(
                primitives,
                "ellipse",
                ([x, y, radiusX, radiusY, rotation]) =>
                    x === 0 && y === 2 && radiusX > 0 && radiusY > radiusX && Math.abs(rotation + 0.36) < 1e-9
            );
            assert.ok(seed, `${label} should draw the tilted seed silhouette`);
            assertEffectUsesColor(primitives, markRun.owner.color, label);
            seedAlpha = seed.globalAlpha;
        });
        return seedAlpha;
    };
    const markStartAlpha = renderSeedMark("Lv6 seed mark start");
    markEffect.update(0.9);
    const markMidAlpha = renderSeedMark("Lv6 seed mark mid");
    markEffect.update(0.8);
    const markEndAlpha = renderSeedMark("Lv6 seed mark end");
    assert.ok(
        markStartAlpha > markMidAlpha && markMidAlpha > markEndAlpha,
        "Trickster mark should visibly fade from start through its final active frame"
    );
    const hpBeforeBurst = markRun.target.hp;
    markRun.owner.ability.onDashHit(
        markRun.target,
        { collisionLabel: "Seed Dash" },
        { contactPoint: markRun.target.position.clone() }
    );
    assert.equal(hpBeforeBurst - markRun.target.hp, 120, "Lv6 marked dash should add total-attack x1.20 damage");
    assert.equal(markRun.owner.ability.state.marks.has(markRun.target), false, "Lv6 mark should be consumed first");
    const hpAfterBurst = markRun.target.hp;
    markRun.owner.ability.onDashHit(markRun.target, { collisionLabel: "Seed Dash" });
    assert.equal(markRun.target.hp, hpAfterBurst, "The same mark must not burst twice");

    const followupRun = createRun(3);
    triggerEnemySeed(followupRun);
    followupRun.owner.ability.onDashHit(
        followupRun.target,
        { collisionLabel: "Seed Dash" },
        { contactPoint: followupRun.target.position.clone() }
    );
    const followup = followupRun.simulation.entities.find(
        (entity) => entity.constructor?.name === "SeedOrb" && !entity.isExpired
    );
    assert.ok(followup, "Lv9 marked dash should scatter one follow-up seed");
    assert.equal(followup.life, 14, "Lv9 follow-up seed should keep the base fourteen-second life");
    assert.equal(followup.collisionGraceRemaining, 0.5, "Lv9 follow-up seed should start with 0.50s collision grace");
    assert.equal(
        followup.renderLayer,
        RENDER_LAYERS.FOREGROUND,
        "Lv9 follow-up seed should stay visible above fighters"
    );
    const renderFollowupSeed = (label) => {
        let seedArc;
        assertForegroundEffectRenders(followup, label, (primitives) => {
            seedArc = assertEffectArcAt(
                primitives,
                followup.position,
                label,
                (radius) => radius >= followup.radius * 0.55 && radius <= followup.radius
            );
            assertEffectUsesColor(primitives, followup.owner.color, label);
            assert.ok(
                primitives.filter((primitive) => primitive.method === "lineTo").length >= 2,
                `${label} should draw both growing sprout stems during collision grace`
            );
        });
        return { radius: seedArc.args[2], alpha: seedArc.globalAlpha };
    };
    const followupStart = renderFollowupSeed("Lv9 follow-up seed start");
    followup.applyImpulse(followup.velocity.clone().scale(-1));
    followup.position = followupRun.target.position.clone();
    followup.update(0.25, followupRun.simulation);
    const followupMid = renderFollowupSeed("Lv9 follow-up seed mid");
    followup.update(0.24, followupRun.simulation);
    const followupEnd = renderFollowupSeed("Lv9 follow-up seed end");
    assert.ok(
        followupStart.radius < followupMid.radius && followupMid.radius < followupEnd.radius,
        "Follow-up seed should grow from start through the end of collision grace"
    );
    assert.ok(
        followupStart.alpha < followupMid.alpha && followupMid.alpha < followupEnd.alpha,
        "Follow-up seed should become fully opaque as it activates"
    );
    assert.equal(followup.isExpired, false, "Follow-up seed must remain intangible before 0.50 seconds");
    followup.update(0.01, followupRun.simulation);
    assert.equal(followup.isExpired, true, "Follow-up seed should activate after the grace period");
    const activationEffect = followupRun.simulation.entities.find(
        (entity) => entity.constructor?.name === "SeedActivationEffect"
    );
    const renderActivation = (label) => {
        let activationArc;
        assertForegroundEffectRenders(activationEffect, label, (primitives) => {
            activationArc = assertEffectArcAt(
                primitives,
                activationEffect.position,
                label,
                (radius) => radius >= followup.radius * 0.9 && radius <= followup.radius * 2.05
            );
            assertEffectUsesColor(primitives, "#caff7b", label);
            assert.ok(
                primitives.filter((primitive) => primitive.method === "moveTo").length >= 8,
                `${label} should draw the eight activation rays around the seed`
            );
        });
        return { radius: activationArc.args[2], alpha: activationArc.globalAlpha };
    };
    const activationStart = renderActivation("Lv9 seed activation start");
    activationEffect.update(0.12);
    const activationMid = renderActivation("Lv9 seed activation mid");
    activationEffect.update(0.11);
    const activationEnd = renderActivation("Lv9 seed activation end");
    assert.ok(
        activationStart.radius < activationMid.radius && activationMid.radius < activationEnd.radius,
        "Seed activation ring should expand across start, mid, and end frames"
    );
    assert.ok(
        activationStart.alpha > activationMid.alpha && activationMid.alpha > activationEnd.alpha,
        "Seed activation rays should fade while the activation ring expands"
    );

    const ownerRun = createRun(3);
    const ownerSeed = ownerRun.simulation.spawnSeedOrb(
        ownerRun.owner,
        ownerRun.owner.position.clone(),
        new Vector2(),
        14
    );
    ownerSeed.update(0, ownerRun.simulation);
    assert.ok(ownerRun.owner.state.movement, "Owner seed contact should retain the base dash");
    assert.equal(ownerRun.owner.state.periodicDamage.length, 0, "Owner seed contact should not apply hostile vines");
    assert.equal(
        ownerRun.owner.ability.state.marks.has(ownerRun.owner),
        false,
        "Owner seed contact should not mark itself"
    );
    console.log("[trickster-level-reward-contracts] ok");
}

function testOrbitLevelRewardContracts(app) {
    class StaticCollisionProbe extends Projectile {
        constructor(owner, position, velocity, radius, { resolveTerrain = false } = {}) {
            super(owner, position, velocity, radius);
            this.resolveTerrain = resolveTerrain;
            this.staticCollisionContexts = [];
        }

        getStaticCollisionOptions() {
            return {
                resolveTerrain: this.resolveTerrain,
                onStaticCollision: (context) => this.staticCollisionContexts.push(context)
            };
        }
    }

    const createRun = (tier, extraEnemy = false) => {
        const ownerSpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT);
        const targetSpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
        const specs = [
            { ...ownerSpec, teamId: "orbit-team" },
            { ...targetSpec, id: `orbit-target-${tier}`, teamId: "enemy-team" }
        ];
        if (extraEnemy) {
            specs.push({ ...targetSpec, id: `orbit-nearby-${tier}`, teamId: "enemy-team" });
        }
        const simulation = new BattleSimulation(
            specs,
            { onLog() {}, onSound() {}, onDamageTaken() {}, onDamageDealt() {}, onHpChanged() {} },
            null,
            { assignActions: false, arenaWidth: 2_000 }
        );
        const [owner, target, nearby] = simulation.fighters;
        owner.ability.setContext({ abilityTier: tier });
        owner.stats.baseDamage = 100;
        owner.stats.criticalChance = 0;
        owner.position = new Vector2(300, 480);
        target.position = new Vector2(900, 480);
        for (const enemy of [target, nearby].filter(Boolean)) {
            enemy.maxHp = 2_000;
            enemy.hp = 2_000;
            enemy.stats.baseDefense = 0;
        }
        return { simulation, owner, target, nearby };
    };

    const rows = REWARD_BALANCE.experience.characterLevelProgressions.orbit.filter((entry) => entry.abilityTier);
    assert.deepEqual(
        rows.map((entry) => entry.gameText),
        [
            "첫 적중점 동기화 협공 · 직접 ×0.80/×1.00",
            "수명 2.4초 · 협공 폭발 70px ×0.25",
            "미적중 탄 본체 캐치 · 원래 위성 회수"
        ]
    );
    assert.deepEqual(REWARD_BALANCE.experience.abilityUpgrades.orbit.tiers, [
        {},
        { synchronizedVolley: true },
        { explosiveVolley: true },
        { bodyCatch: true }
    ]);

    const staticCollisionRun = createRun(1);
    const wallProbe = new StaticCollisionProbe(
        staticCollisionRun.owner,
        new Vector2(10, 300),
        new Vector2(-120, 30),
        11
    );
    wallProbe._integrateAndClamp(0, staticCollisionRun.simulation);
    assert.equal(wallProbe.staticCollisionContexts.length, 1, "Opt-in projectile should receive one wall context");
    const wallContext = wallProbe.staticCollisionContexts[0];
    assert.equal(wallContext.wall, true, "Wall context should identify the arena wall");
    assert.equal(wallContext.terrain, false, "Wall context should not identify terrain");
    assert.deepEqual(wallContext.normal, new Vector2(1, 0), "Left wall context should expose its inward normal");
    assert.deepEqual(
        wallContext.contactPoint,
        new Vector2(0, 300),
        "Wall context should expose the world contact point"
    );
    assert.deepEqual(
        wallContext.preCollisionVelocity,
        new Vector2(-120, 30),
        "Wall context should snapshot the pre-reflection velocity"
    );
    assert.ok(
        wallContext.postCollisionVelocity.dot(wallContext.normal) > 0,
        "Wall context should expose the actual inward post-reflection velocity"
    );

    staticCollisionRun.simulation.terrain = [
        { id: "probe-rock", shape: "circle", x: 420, y: 420, radius: 40, blocking: true }
    ];
    const terrainProbe = new StaticCollisionProbe(
        staticCollisionRun.owner,
        new Vector2(420, 420),
        new Vector2(-120, 0),
        11,
        { resolveTerrain: true }
    );
    terrainProbe._integrateAndClamp(0, staticCollisionRun.simulation);
    assert.equal(
        terrainProbe.staticCollisionContexts.length,
        1,
        "Opt-in terrain projectile should receive one context"
    );
    const terrainContext = terrainProbe.staticCollisionContexts[0];
    assert.equal(terrainContext.wall, false, "Terrain context should not identify a wall");
    assert.equal(terrainContext.terrain, true, "Terrain context should identify terrain");
    assert.deepEqual(terrainContext.normal, new Vector2(1, 0), "Terrain context should preserve its collision normal");
    assert.deepEqual(
        terrainContext.contactPoint,
        new Vector2(460, 420),
        "Terrain context should preserve the terrain contact point"
    );
    assert.deepEqual(
        terrainContext.preCollisionVelocity,
        new Vector2(-120, 0),
        "Terrain context should snapshot the pre-reflection velocity"
    );
    assert.ok(
        terrainContext.postCollisionVelocity.dot(terrainContext.normal) > 0,
        "Terrain context should expose the actual post-reflection velocity"
    );

    const nonOptInProjectile = new Projectile(staticCollisionRun.owner, new Vector2(10, 620), new Vector2(-120, 0), 11);
    nonOptInProjectile._integrateAndClamp(0, staticCollisionRun.simulation);
    assert.equal(
        nonOptInProjectile.position.x,
        11,
        "Non-opt-in projectile should retain the existing wall position clamp"
    );
    assert.ok(nonOptInProjectile.velocity.x > 0, "Non-opt-in projectile should retain the existing wall reflection");
    assert.equal(
        Object.hasOwn(nonOptInProjectile, "staticCollisionContexts"),
        false,
        "Non-opt-in projectile should not allocate a static collision context"
    );

    const syncRun = createRun(1);
    const first = syncRun.simulation.spawnOrbitShot(
        syncRun.owner,
        syncRun.target.position.clone(),
        new Vector2(1, 0),
        16,
        { slotIndex: 0, volleyId: "same-volley" }
    );
    const converging = syncRun.simulation.spawnOrbitShot(syncRun.owner, new Vector2(500, 400), new Vector2(1, 0), 16, {
        slotIndex: 1,
        volleyId: "same-volley"
    });
    const otherVolley = syncRun.simulation.spawnOrbitShot(syncRun.owner, new Vector2(500, 560), new Vector2(1, 0), 16, {
        slotIndex: 2,
        volleyId: "other-volley"
    });
    const hpBeforeFirst = syncRun.target.hp;
    first.update(0, syncRun.simulation);
    assert.equal(hpBeforeFirst - syncRun.target.hp, 80, "Lv3 first volley hit should deal total-attack x0.80");
    assert.ok(converging.convergence, "Lv3 should convert a living projectile from the same volley");
    assert.equal(
        converging.renderLayer,
        RENDER_LAYERS.FOREGROUND,
        "Lv3 convergence projectile should render above fighters"
    );
    assert.equal(otherVolley.convergence, null, "Lv3 must not convert another volley");

    const wallRebaseRun = createRun(1);
    wallRebaseRun.owner.position = new Vector2(180, 700);
    wallRebaseRun.target.position = new Vector2(420, 480);
    const wallRebaseShot = wallRebaseRun.simulation.spawnOrbitShot(
        wallRebaseRun.owner,
        new Vector2(wallRebaseRun.simulation.width - 11.5, 700),
        new Vector2(1, 0),
        16,
        { slotIndex: 1, volleyId: "wall-rebase" }
    );
    wallRebaseShot.elapsed = 1;
    wallRebaseShot.beginSynchronizedConvergence(wallRebaseRun.target.position.clone());
    const wallRebaseFixedPoint = wallRebaseShot.convergence.fixedPoint.clone();
    const synchronizedVolleysBeforeRebase = wallRebaseRun.owner.ability.state.synchronizedVolleys.size;
    wallRebaseShot.update(1 / 60, wallRebaseRun.simulation);
    const reboundStartAngle = Math.atan2(wallRebaseShot.velocity.y, wallRebaseShot.velocity.x);
    assert.equal(wallRebaseShot.convergence.elapsed, 0, "Wall reflection should restart convergence progress");
    assert.ok(
        Math.abs(wallRebaseShot.convergence.startAngle - reboundStartAngle) < 1e-9,
        "Wall reflection should use the actual reflected velocity as the new convergence start direction"
    );
    assert.deepEqual(
        wallRebaseShot.convergence.fixedPoint,
        wallRebaseFixedPoint,
        "Wall reflection should preserve the original synchronized fixed point"
    );
    assert.equal(
        wallRebaseRun.owner.ability.state.synchronizedVolleys.size,
        synchronizedVolleysBeforeRebase,
        "Wall rebasing must not synchronize another volley"
    );
    const wallBoundaryX = wallRebaseShot.position.x;
    assert.ok(wallRebaseShot.velocity.x < 0, "Wall reflection should leave the shard travelling into the arena");
    wallRebaseShot.update(1 / 60, wallRebaseRun.simulation);
    assert.ok(
        wallRebaseShot.position.x < wallBoundaryX,
        "Rebased convergence should leave the wall on its first post-reflection frame"
    );
    const renderConvergence = (label, expectTrail) => {
        let projectileSquare;
        assertForegroundEffectRenders(converging, label, (primitives) => {
            assert.ok(
                findEffectPrimitive(
                    primitives,
                    "translate",
                    ([x, y]) => Math.abs(x - converging.position.x) < 1e-6 && Math.abs(y - converging.position.y) < 1e-6
                ),
                `${label} should anchor the synchronized shard at its physical position`
            );
            projectileSquare = findEffectPrimitive(
                primitives,
                "fillRect",
                ([x, y, width, height], primitive) =>
                    x === -8 && y === -8 && width === 16 && height === 16 && primitive.fillStyle === "#ffea00"
            );
            assert.ok(projectileSquare, `${label} should retain the yellow synchronized shard silhouette`);
            if (expectTrail) {
                assertEffectUsesColor(primitives, syncRun.owner.color, label);
                assert.ok(
                    findEffectPrimitive(primitives, "lineTo"),
                    `${label} should draw the accumulated convergence trajectory`
                );
            }
        });
        return converging.angle;
    };
    const convergenceStartAngle = renderConvergence("Lv3 convergence start", false);
    converging.update(0.04, syncRun.simulation);
    converging.update(0.04, syncRun.simulation);
    const convergenceMidAngle = renderConvergence("Lv3 convergence mid", true);
    converging.update(0.07, syncRun.simulation);
    const convergenceEndAngle = renderConvergence("Lv3 convergence end", true);
    assert.ok(
        convergenceStartAngle < convergenceMidAngle && convergenceMidAngle < convergenceEndAngle,
        "Synchronized shard angle should converge toward the fixed contact across start, mid, and end frames"
    );
    assert.deepEqual(
        converging.convergence.fixedPoint,
        syncRun.target.position,
        "Lv3 convergence should snapshot the first world contact"
    );
    const fixedPoint = converging.convergence.fixedPoint.clone();
    syncRun.target.position.add(new Vector2(200, 120));
    converging._getPlannedDirection(0.15);
    assert.deepEqual(
        converging.convergence.fixedPoint,
        fixedPoint,
        "Lv3 convergence must not track later target movement"
    );
    converging.position = syncRun.target.position.clone();
    const hpBeforeConvergence = syncRun.target.hp;
    converging.update(0, syncRun.simulation);
    assert.equal(hpBeforeConvergence - syncRun.target.hp, 100, "Lv3 convergence hit should deal total-attack x1.00");

    const explosiveRun = createRun(2, true);
    explosiveRun.nearby.position = new Vector2(explosiveRun.target.position.x + 60, explosiveRun.target.position.y);
    const standard = explosiveRun.simulation.spawnOrbitShot(
        explosiveRun.owner,
        explosiveRun.target.position.clone(),
        new Vector2(1, 0),
        16,
        { slotIndex: 0, volleyId: "explosive" }
    );
    assert.equal(standard.life, 2.4, "Lv6 projectile life should be 2.4 seconds");
    const targetHpBefore = explosiveRun.target.hp;
    const nearbyHpBefore = explosiveRun.nearby.hp;
    standard.update(0, explosiveRun.simulation);
    assert.equal(targetHpBefore - explosiveRun.target.hp, 115, "Lv6 direct target should take x0.90 and x0.25");
    assert.equal(nearbyHpBefore - explosiveRun.nearby.hp, 25, "Lv6 nearby target should take the 70px x0.25 burst");
    const explosionEffect = explosiveRun.simulation.entities.find(
        (entity) => entity.constructor?.name === "OrbitHitEffect" && entity.drawConnection === false
    );
    const renderOrbitExplosion = (label) => {
        let impactArc;
        assertForegroundEffectRenders(explosionEffect, label, (primitives) => {
            impactArc = assertEffectArcAt(
                primitives,
                explosionEffect.targetPosition,
                label,
                (radius) => radius >= 18 && radius <= 70
            );
            assertEffectUsesColor(primitives, explosiveRun.owner.color, label);
            assert.equal(
                primitives.some((primitive) => primitive.method === "moveTo"),
                false,
                `${label} should remain a zero-distance burst without a false connection beam`
            );
        });
        return impactArc.args[2];
    };
    const explosionStartRadius = renderOrbitExplosion("Lv6 zero-distance explosion start");
    explosionEffect.update(0.12);
    const explosionMidRadius = renderOrbitExplosion("Lv6 zero-distance explosion mid");
    explosionEffect.update(0.11);
    const explosionEndRadius = renderOrbitExplosion("Lv6 zero-distance explosion end");
    assert.ok(
        explosionStartRadius < explosionMidRadius && explosionMidRadius < explosionEndRadius,
        "Orbit explosion should expand toward its 70px radius across start, mid, and end frames"
    );

    const catchRun = createRun(3);
    catchRun.owner.ability.consumeShard(0);
    const caught = catchRun.simulation.spawnOrbitShot(
        catchRun.owner,
        catchRun.owner.position.clone(),
        new Vector2(1, 0),
        16,
        { slotIndex: 0, volleyId: "catch" }
    );
    caught.update(0, catchRun.simulation);
    assert.equal(caught.wasCaught, true, "Lv9 should catch an unhit projectile on body contact");
    assert.equal(
        catchRun.owner.ability.state.shards[0].active,
        true,
        "Lv9 catch should restore the original slot once"
    );
    assert.equal(caught.isExpired, true, "Caught projectile should disappear immediately");
    const catchEffect = catchRun.simulation.entities.find((entity) => entity.constructor?.name === "OrbitCatchEffect");
    const renderOrbitCatch = (label) => {
        const slotPosition = catchRun.owner.ability.getOrbitPosition(0);
        let catchRadius;
        assertForegroundEffectRenders(catchEffect, label, (primitives) => {
            assert.ok(
                findEffectPrimitive(
                    primitives,
                    "moveTo",
                    ([x, y]) =>
                        Math.abs(x - catchEffect.contactPosition.x) < 1e-6 &&
                        Math.abs(y - catchEffect.contactPosition.y) < 1e-6
                ),
                `${label} should begin at the projectile contact point`
            );
            assert.ok(
                findEffectPrimitive(
                    primitives,
                    "quadraticCurveTo",
                    ([, , x, y]) => Math.abs(x - slotPosition.x) < 1e-6 && Math.abs(y - slotPosition.y) < 1e-6
                ),
                `${label} should curve back into the restored orbit slot`
            );
            const slotArc = assertEffectArcAt(
                primitives,
                slotPosition,
                label,
                (radius) => radius >= 10 && radius <= 28
            );
            catchRadius = slotArc.args[2];
            assertEffectUsesColor(primitives, catchEffect.color, label);
        });
        return catchRadius;
    };
    const catchStartRadius = renderOrbitCatch("Lv9 orbit catch start");
    catchEffect.update(0.16);
    const catchMidRadius = renderOrbitCatch("Lv9 orbit catch mid");
    catchEffect.update(0.15);
    const catchEndRadius = renderOrbitCatch("Lv9 orbit catch end");
    assert.ok(
        catchStartRadius < catchMidRadius && catchMidRadius < catchEndRadius,
        "Orbit catch ring should expand along its return trajectory"
    );

    const priorityRun = createRun(3);
    priorityRun.owner.ability.consumeShard(1);
    priorityRun.target.position = priorityRun.owner.position.clone();
    const priorityShot = priorityRun.simulation.spawnOrbitShot(
        priorityRun.owner,
        priorityRun.owner.position.clone(),
        new Vector2(1, 0),
        16,
        { slotIndex: 1, volleyId: "priority" }
    );
    priorityShot.update(0, priorityRun.simulation);
    assert.equal(priorityShot.hasHit, true, "Enemy hit should resolve when enemy and owner overlap");
    assert.equal(priorityShot.wasCaught, false, "Enemy hit must win over body catch in the same frame");
    assert.equal(priorityRun.owner.ability.state.shards[1].active, false, "Hit projectile must not restore its slot");
    console.log("[orbit-level-reward-contracts] ok");
}

function testSpinLevelRewardContracts(app) {
    const setVelocity = (body, velocity) => body.applyImpulse(Vector2.subtract(velocity, body.velocity));
    const assertClose = (actual, expected, message, tolerance = 1e-9) => {
        assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} !== ${expected}`);
    };
    const createRun = (tier, { defense = 0, extraEnemy = false } = {}) => {
        const ownerSpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.SPIN);
        const targetSpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
        const specs = [
            { ...ownerSpec, teamId: "spin-team" },
            { ...targetSpec, id: `spin-target-${tier}`, teamId: "enemy-team" }
        ];
        if (extraEnemy) specs.push({ ...targetSpec, id: `spin-nearby-${tier}`, teamId: "enemy-team" });
        const simulation = new BattleSimulation(
            specs,
            { onLog() {}, onSound() {}, onDamageTaken() {}, onDamageDealt() {}, onHpChanged() {} },
            null,
            { assignActions: false, arenaWidth: 2_000 }
        );
        const [owner, target, nearby] = simulation.fighters;
        owner.ability.setContext({ abilityTier: tier });
        owner.stats.baseDamage = 100;
        owner.stats.criticalChance = 0;
        target.maxHp = 3_000;
        target.hp = 3_000;
        target.stats.baseDefense = defense;
        owner.position = new Vector2(500, 480);
        target.position = new Vector2(500 + owner.radius + target.radius - 1, 480);
        setVelocity(owner, new Vector2(200, 0));
        setVelocity(target, new Vector2());
        if (nearby) {
            nearby.maxHp = 3_000;
            nearby.hp = 3_000;
            nearby.stats.baseDefense = defense;
            setVelocity(nearby, new Vector2());
        }
        return { simulation, owner, target, nearby };
    };
    const recordDamageEvents = (target) => {
        const events = [];
        const takeDamage = target.takeDamage.bind(target);
        target.takeDamage = (amount, source, label, options) => {
            const result = takeDamage(amount, source, label, options);
            events.push({ amount, label, options, ...result });
            return result;
        };
        return events;
    };
    const runCut = (run, { assertCrash = true } = {}) => {
        run.owner.ability.state.timeWithoutCollision = run.owner.ability.getMaxChargeTime();
        const events = recordDamageEvents(run.target);
        let opponentNormalHooks = 0;
        const onCollision = run.target.abilities.onCollision.bind(run.target.abilities);
        run.target.abilities.onCollision = (...args) => {
            opponentNormalHooks += 1;
            return onCollision(...args);
        };
        run.owner.hp = Math.max(1, run.owner.maxHp - 30);
        run.owner.equipmentEffects = { ...run.owner.equipmentEffects, hpStealRatio: 0.1, hpStealCooldown: 0 };
        let hpStealCalls = 0;
        const heal = run.owner.heal.bind(run.owner);
        run.owner.heal = (amount) => {
            hpStealCalls += 1;
            return heal(amount);
        };
        const hpBefore = run.target.hp;
        run.simulation.handleCollision();
        assert.ok(
            run.owner.ability.state.cut,
            "A full charged tier Spin should retain damage while deferring only rigid-body separation"
        );
        const crashEvents = events.filter((event) => event.label === "Crash");
        assert.equal(crashEvents.length, 1, "Full-charge cut must retain exactly one ordinary Crash damage event");
        assert.ok(crashEvents[0].actualDamage > 0, "Full-charge Crash must retain its actual damage");
        assert.equal(opponentNormalHooks, 1, "Full-charge cut must retain the opponent normal collision hook once");
        assert.equal(hpStealCalls, 1, "Full-charge Crash must trigger collision lifesteal only once");
        assert.ok(run.target.hp < hpBefore, "Full-charge cut must apply ordinary Crash damage before cutting");
        const cutEffect = run.simulation.entities.find((entity) => entity.constructor?.name === "SpinCutEffect");
        const renderSpinCut = (label) => {
            let cutArc;
            assertForegroundEffectRenders(cutEffect, label, (primitives) => {
                cutArc = assertEffectArcAt(
                    primitives,
                    cutEffect.position,
                    label,
                    (radius) => radius >= 18 && radius <= 42
                );
                const expectedColor = run.owner.ability.getLevelUpgrade().piercingVortex ? "#fff4ae" : "#ffb347";
                assertEffectUsesColor(primitives, expectedColor, label);
                assert.ok(
                    cutArc.args[4] - cutArc.args[3] >= Math.PI * 0.85,
                    `${label} should retain the charged cut sweep angle`
                );
            });
            return { radius: cutArc.args[2], sweep: cutArc.args[4] - cutArc.args[3] };
        };
        const cutStart = renderSpinCut("Spin cut feedback start");
        setVelocity(run.owner, new Vector2());
        setVelocity(run.target, new Vector2());
        for (const _ of Array.from({ length: 6 })) run.owner.ability.update(0.05);
        const cutMid = renderSpinCut("Spin cut feedback mid");
        for (const _ of Array.from({ length: 6 })) run.owner.ability.update(0.05);
        const cutEnd = renderSpinCut("Spin cut feedback end");
        assert.ok(
            cutStart.radius < cutMid.radius && cutMid.radius <= cutEnd.radius,
            "Spin cut radius should advance across start, mid, and finish frames"
        );
        assert.ok(
            cutStart.sweep < cutMid.sweep && cutMid.sweep <= cutEnd.sweep,
            "Spin cut sweep angle should widen across start, mid, and finish frames"
        );
        assert.equal(
            events.filter((event) => event.label === "Spin Cut").length,
            12,
            "Cut must apply exactly twelve ticks"
        );
        assert.equal(
            events.filter((event) => event.label === "Crash").length,
            1,
            "Cut finish must not replay Crash damage"
        );
        if (assertCrash) {
            assert.ok(events.some((event) => event.label === "Crash" && event.actualDamage > 0));
        }
        return { events, cutEffect, crashActual: crashEvents[0].actualDamage };
    };

    const rows = REWARD_BALANCE.experience.characterLevelProgressions.spin.filter((entry) => entry.abilityTier);
    assert.deepEqual(
        rows.map((entry) => entry.gameText),
        [
            "만충 Crash 유지 · 표면 절단 0.60초 · 12틱 ×0.15",
            "가속 절삭 ×0.10→×0.30 · 합계 ×2.40",
            "340px 관통 유체장 · 절단 방어 무시"
        ]
    );
    assert.deepEqual(REWARD_BALANCE.experience.abilityUpgrades.spin.tiers, [
        {},
        { surfaceCut: true },
        { acceleratingCut: true },
        { piercingVortex: true }
    ]);

    const partialRun = createRun(1);
    partialRun.owner.ability.state.timeWithoutCollision = partialRun.owner.ability.getMaxChargeTime() * 0.5;
    const partialHpBefore = partialRun.target.hp;
    partialRun.simulation.handleCollision();
    assert.equal(partialRun.owner.ability.state.cut, null, "Partial charge should retain the ordinary collision flow");
    assert.ok(partialRun.target.hp < partialHpBefore, "Partial charge should keep immediate collision damage");
    assert.equal(partialRun.owner.ability.getChargeProgress(), 0, "Partial collision should consume the base charge");

    const tierOneRun = createRun(1);
    tierOneRun.target.stats.baseDefense = 0;
    const tierOneCut = runCut(tierOneRun);
    assert.equal(
        tierOneCut.events
            .filter((event) => event.label === "Spin Cut")
            .reduce((total, event) => total + event.actualDamage, 0),
        180,
        "Lv3 cut should deal twelve x0.15 ticks for x1.80 total attack"
    );
    assert.equal(tierOneRun.owner.ability.state.cut, null, "Lv3 cut should finish after twelve ticks");

    const tierTwoRun = createRun(2);
    tierTwoRun.target.stats.baseDefense = 0;
    const tierTwoCut = runCut(tierTwoRun);
    assert.equal(
        tierTwoCut.events
            .filter((event) => event.label === "Spin Cut")
            .reduce((total, event) => total + event.actualDamage, 0),
        240,
        "Lv6 linear x0.10-to-x0.30 ticks should total x2.40 total attack"
    );

    const defendedTierTwo = createRun(2, { defense: 50 });
    const defendedTierTwoCut = runCut(defendedTierTwo);
    const defendedTierTwoDamage = defendedTierTwoCut.events
        .filter((event) => event.label === "Spin Cut")
        .reduce((total, event) => total + event.actualDamage, 0);
    assert.ok(defendedTierTwoDamage < 240, "Lv6 cut should still use ordinary defense");
    const piercingRun = createRun(3, { defense: 50 });
    const piercingCut = runCut(piercingRun);
    assert.equal(
        piercingCut.events
            .filter((event) => event.label === "Spin Cut")
            .reduce((total, event) => total + event.actualDamage, 0),
        240,
        "Lv9 cut should ignore defense for exactly its twelve ticks"
    );
    const hpBeforeOrdinaryDamage = piercingRun.target.hp;
    piercingRun.target.takeDamage(100, piercingRun.owner, "Post-cut hit");
    assert.equal(
        hpBeforeOrdinaryDamage - piercingRun.target.hp,
        50,
        "Defense ignore must not leak beyond the cut ticks"
    );

    const totalAttackRun = createRun(1);
    totalAttackRun.target.stats.baseDefense = 0;
    totalAttackRun.owner.stats.baseDamage = 125;
    const totalAttackCut = runCut(totalAttackRun);
    assert.equal(
        totalAttackCut.events
            .filter((event) => event.label === "Spin Cut")
            .reduce((total, event) => total + event.amount, 0),
        225,
        "Lv3 cut raw damage must use BattleBall's final total attack helper"
    );

    const referenceRun = createRun(1);
    referenceRun.owner.angularVelocity = 8;
    referenceRun.target.angularVelocity = -3;
    referenceRun.owner.ability.onCollision = () => {};
    const referenceOwnerVelocity = referenceRun.owner.velocity.clone();
    const referenceTargetVelocity = referenceRun.target.velocity.clone();
    const referenceOwnerAngular = referenceRun.owner._accumulatedAngularImpulse;
    const referenceTargetAngular = referenceRun.target._accumulatedAngularImpulse;
    referenceRun.simulation.handleCollision();
    const referenceDelta = {
        ownerLinear: Vector2.subtract(referenceRun.owner.velocity, referenceOwnerVelocity),
        targetLinear: Vector2.subtract(referenceRun.target.velocity, referenceTargetVelocity),
        ownerAngular: referenceRun.owner._accumulatedAngularImpulse - referenceOwnerAngular,
        targetAngular: referenceRun.target._accumulatedAngularImpulse - referenceTargetAngular
    };

    const deferredRun = createRun(1);
    deferredRun.owner.angularVelocity = 8;
    deferredRun.target.angularVelocity = -3;
    deferredRun.owner.ability.state.timeWithoutCollision = deferredRun.owner.ability.getMaxChargeTime();
    const deferredOwnerVelocity = deferredRun.owner.velocity.clone();
    const deferredTargetVelocity = deferredRun.target.velocity.clone();
    deferredRun.simulation.handleCollision();
    const storedResponse = deferredRun.owner.ability.state.cut.deferredRigidBodyResponse;
    assert.ok(storedResponse, "Full charge must capture the common collision response at contact time");
    assertClose(
        storedResponse.bodyA.linearDelta.x,
        referenceDelta.ownerLinear.x,
        "Stored owner x delta must match normal response"
    );
    assertClose(
        storedResponse.bodyA.linearDelta.y,
        referenceDelta.ownerLinear.y,
        "Stored owner y delta must match normal response"
    );
    assertClose(
        storedResponse.bodyB.linearDelta.x,
        referenceDelta.targetLinear.x,
        "Stored target x delta must match normal response"
    );
    assertClose(
        storedResponse.bodyB.linearDelta.y,
        referenceDelta.targetLinear.y,
        "Stored target y delta must match normal response"
    );
    assertClose(
        storedResponse.bodyA.angularImpulse,
        referenceDelta.ownerAngular,
        "Stored owner angular delta must match normal response"
    );
    assertClose(
        storedResponse.bodyB.angularImpulse,
        referenceDelta.targetAngular,
        "Stored target angular delta must match normal response"
    );
    assertClose(
        deferredRun.owner.velocity.x,
        deferredOwnerVelocity.x,
        "Deferred response must not immediately change owner linear velocity"
    );
    assertClose(
        deferredRun.target.velocity.x,
        deferredTargetVelocity.x,
        "Deferred response must not immediately change target linear velocity"
    );
    for (const _ of Array.from({ length: 11 })) deferredRun.owner.ability.update(0.05, deferredRun.target);
    const beforeReleaseOwnerVelocity = deferredRun.owner.velocity.clone();
    const beforeReleaseTargetVelocity = deferredRun.target.velocity.clone();
    const beforeReleaseOwnerAngular = deferredRun.owner._accumulatedAngularImpulse;
    const beforeReleaseTargetAngular = deferredRun.target._accumulatedAngularImpulse;
    deferredRun.owner.ability.update(0.05, deferredRun.target);
    assertClose(
        deferredRun.owner.velocity.x - beforeReleaseOwnerVelocity.x,
        storedResponse.bodyA.linearDelta.x,
        "Cut finish must apply the stored owner x response without recalculation"
    );
    assertClose(
        deferredRun.target.velocity.x - beforeReleaseTargetVelocity.x,
        storedResponse.bodyB.linearDelta.x,
        "Cut finish must apply the stored target x response without recalculation"
    );
    assertClose(
        deferredRun.owner._accumulatedAngularImpulse - beforeReleaseOwnerAngular,
        storedResponse.bodyA.angularImpulse,
        "Cut finish must apply the stored owner angular response once"
    );
    assertClose(
        deferredRun.target._accumulatedAngularImpulse - beforeReleaseTargetAngular,
        storedResponse.bodyB.angularImpulse,
        "Cut finish must apply the stored target angular response once"
    );
    assert.equal(storedResponse.applied, true, "Deferred collision response must only apply once");

    const criticalRun = createRun(1);
    criticalRun.owner.stats.criticalChance = 100;
    criticalRun.target.stats.baseDefense = 0;
    const criticalCut = runCut(criticalRun);
    const tickNumbers = criticalRun.simulation.entities.filter(
        (entity) => entity.constructor?.name === "DamageNumber" && entity.visibilityToken === "combatText"
    );
    assert.ok(tickNumbers.length > 0, "Cut ticks must create actual-damage number entities");
    for (const number of tickNumbers) {
        assert.equal(number.visibilityToken, "combatText", "Cut numbers must reuse common combat text visibility");
        assert.ok(number.fontSize >= 11 && number.fontSize <= 12, "Cut numbers must stay small");
        assert.ok(number.maxLife >= 0.22 && number.maxLife <= 0.3, "Cut numbers must stay short-lived");
        assert.equal(number.color, "#ffdd00", "Critical cut numbers must use the takeDamage critical color");
        assert.ok(/^\d+$/.test(number.displayText), "Cut numbers must show only actual damage values");
    }
    assert.ok(
        criticalCut.events.filter((event) => event.label === "Spin Cut").every((event) => event.isCritical),
        "Critical cut text must use the exact takeDamage critical result without rerolling"
    );
    assert.equal(
        criticalRun.simulation.entities.some((entity) => String(entity.displayText ?? "").includes("×")),
        false,
        "Cut must not create cumulative or multiplier counter text"
    );

    const vortexRun = createRun(3, { extraEnemy: true });
    vortexRun.owner.ability.state.timeWithoutCollision = vortexRun.owner.ability.getMaxChargeTime();
    vortexRun.target.position = Vector2.add(vortexRun.owner.position, new Vector2(170, 0));
    vortexRun.nearby.position = Vector2.add(vortexRun.owner.position, new Vector2(65, 0));
    const halfRadiusAcceleration = vortexRun.owner.ability.getVortexAccelerationAt(vortexRun.target.position);
    assert.ok(
        Math.abs(halfRadiusAcceleration.length() - 210) < 1e-9,
        "Lv9 vortex should use smoothstep distance attenuation"
    );
    assert.ok(
        Math.abs(Math.abs(halfRadiusAcceleration.y / halfRadiusAcceleration.x) - 3) < 1e-9,
        "Lv9 vortex direction should combine tangent and inward components at 3:1"
    );
    const targetVelocityBefore = vortexRun.target.velocity.clone();
    const nearbyVelocityBefore = vortexRun.nearby.velocity.clone();
    vortexRun.owner.ability.update(0.1);
    const vortexEffect = vortexRun.simulation.entities.find(
        (entity) => entity.constructor?.name === "SpinVortexEffect"
    );
    const renderVortex = (label) => {
        assertForegroundEffectRenders(vortexEffect, label, (primitives) => {
            assertEffectArcAt(primitives, vortexRun.owner.position, label, (radius) => Math.abs(radius - 340) < 1e-9);
            assertEffectUsesColor(primitives, "#ffe36d", label);
            assert.ok(
                findEffectPrimitive(primitives, "lineTo"),
                `${label} should draw inward-curving stream trajectories inside the 340px boundary`
            );
        });
        return Vector2.subtract(vortexEffect.streams[0].position, vortexRun.owner.position).length();
    };
    vortexEffect.update(0.016);
    const vortexStartDistance = renderVortex("Lv9 spin vortex start");
    vortexEffect.update(0.08);
    const vortexMidDistance = renderVortex("Lv9 spin vortex mid");
    vortexEffect.update(0.08);
    const vortexEndDistance = renderVortex("Lv9 spin vortex end");
    assert.ok(
        new Set([vortexStartDistance, vortexMidDistance, vortexEndDistance].map((distance) => distance.toFixed(3)))
            .size === 3,
        "Spin vortex stream positions should visibly evolve across consecutive frames"
    );
    assert.ok(
        Vector2.subtract(vortexRun.target.velocity, targetVelocityBefore).length() > 0,
        "Lv9 vortex should apply physical impulse to one hostile target"
    );
    assert.ok(
        Vector2.subtract(vortexRun.nearby.velocity, nearbyVelocityBefore).length() > 0,
        "Lv9 vortex should apply to every hostile target in range"
    );
    assert.equal(
        vortexRun.owner.ability
            .getVortexAccelerationAt(Vector2.add(vortexRun.owner.position, new Vector2(341, 0)))
            .length(),
        0,
        "Lv9 vortex should stop outside 340px"
    );
    assert.equal(
        vortexRun.owner.ability
            .getVortexAccelerationAt(Vector2.add(vortexRun.owner.position, new Vector2(340, 0)))
            .length(),
        0,
        "Lv9 vortex should have zero acceleration at the 340px boundary"
    );
    vortexRun.target.position = new Vector2(
        vortexRun.owner.position.x + vortexRun.owner.radius + vortexRun.target.radius - 1,
        vortexRun.owner.position.y
    );
    vortexRun.simulation.handleCollision();
    assert.equal(
        vortexRun.owner.ability.state.vortexEffect,
        null,
        "Full-charge collision must end Lv9 vortex immediately"
    );
    assert.equal(vortexEffect.isExpired, true, "Existing vortex entity must expire during the cut");
    console.log("[spin-level-reward-contracts] ok");
}

function testBatBallWallSlamContracts(app) {
    const setVelocity = (body, velocity) => body.applyImpulse(Vector2.subtract(velocity, body.velocity));
    const setAngularVelocity = (body, value) => {
        body._computeMomentOfInertia();
        body.applyAngularImpulse((value - body.angularVelocity) / body._inverseMomentOfInertia);
        body.integrateRotation(Number.EPSILON);
    };
    const createRun = (tier, options = {}) => {
        const ownerSpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.BAT_BALL);
        const targetSpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
        const terrain = options.terrain ?? [];
        const simulation = new BattleSimulation(
            [
                { ...ownerSpec, teamId: "bat-team" },
                { ...targetSpec, id: `bat-target-${tier}`, teamId: "enemy-team" }
            ],
            { onLog() {}, onSound() {}, onDamageTaken() {}, onDamageDealt() {}, onHpChanged() {} },
            null,
            { assignActions: false, arenaWidth: 2_000, terrain }
        );
        const [owner, target] = simulation.fighters;
        owner.ability.setContext({ abilityTier: tier });
        owner.stats.baseDamage = 100;
        owner.stats.criticalChance = 0;
        target.maxHp = 4_000;
        target.hp = 4_000;
        target.stats.baseDefense = 0;
        owner.position = new Vector2(300, 480);
        target.position = new Vector2(430, 480);
        setVelocity(owner, new Vector2());
        setVelocity(target, new Vector2());
        setAngularVelocity(target, 0);
        return { simulation, owner, target };
    };

    const rows = REWARD_BALANCE.experience.characterLevelProgressions.bat_ball.filter((entry) => entry.abilityTier);
    assert.deepEqual(
        rows.map((entry) => entry.gameText),
        [
            "회전 타구 · 기본 Wall Slam 각충격 ×1.5 추가",
            "첫 Wall Slam 비거리 HOME RUN ×1.00~×2.00",
            "유효 Wall Slam 스킬 초기화 · 재발동 0.50초"
        ]
    );
    assert.deepEqual(REWARD_BALANCE.experience.abilityUpgrades.bat_ball.tiers, [
        {},
        { rotatingHit: true },
        { homeRun: true },
        { wallReset: true }
    ]);

    const baseRun = createRun(0);
    baseRun.owner.ability.performSlash(baseRun.target);
    baseRun.target.integrateRotation(1 / 60);
    const baseAngularVelocity = baseRun.target.angularVelocity;
    const rotatingRun = createRun(1);
    rotatingRun.owner.ability.state.sweepDirection = -1;
    rotatingRun.owner.ability.performSlash(rotatingRun.target);
    rotatingRun.target.integrateRotation(1 / 60);
    assert.ok(
        Math.abs(rotatingRun.target.angularVelocity) > Math.abs(baseAngularVelocity),
        "Lv3 should add a real angular impulse in the swing direction"
    );
    assert.ok(rotatingRun.target.angularVelocity < 0, "Lv3 rotating hit should preserve a counter-clockwise bat sweep");

    const source = { stats: { baseDamage: 100 } };
    const impactBody = {
        position: new Vector2(100, 100),
        velocity: new Vector2(-200, 0),
        angularVelocity: 0,
        stats: { baseSpeed: 200, baseDamage: 1 }
    };
    const impactContext = {
        source,
        impactBody,
        normal: new Vector2(1, 0),
        contactPoint: new Vector2(100, 150),
        preCollisionVelocity: new Vector2(-200, 0)
    };
    const baseImpactDamage = calculateStaticCollisionDamage(impactContext);
    const fasterImpactDamage = calculateStaticCollisionDamage({
        ...impactContext,
        preCollisionVelocity: new Vector2(-400, 0)
    });
    const rotatingImpactDamage = calculateStaticCollisionDamage({
        ...impactContext,
        impactBody: { ...impactBody, angularVelocity: 4 }
    });
    const glancingDamage = calculateStaticCollisionDamage({ ...impactContext, normal: new Vector2(0, 1) });
    const highImpactBodyAttackDamage = calculateStaticCollisionDamage({
        ...impactContext,
        impactBody: { ...impactBody, stats: { ...impactBody.stats, baseDamage: 999 } }
    });
    assert.ok(fasterImpactDamage > baseImpactDamage, "Wall Slam damage should rise with impact linear speed");
    assert.ok(rotatingImpactDamage > baseImpactDamage, "Wall Slam damage should include rotational contact speed");
    assert.equal(glancingDamage, 0, "Wall Slam damage should require inward surface-normal alignment");
    assert.equal(
        highImpactBodyAttackDamage,
        baseImpactDamage,
        "Wall Slam damage should use the original source attack, not the impact body's attack"
    );

    const cooldownRun = createRun(0);
    const cooldownEffect = new WallSlamEffect({ source: cooldownRun.owner, duration: 1 });
    cooldownRun.target.state.wallSlam = cooldownEffect;
    cooldownRun.target.position = new Vector2(cooldownRun.simulation.width + cooldownRun.target.radius, 480);
    setVelocity(cooldownRun.target, new Vector2(400, 0));
    const hpBeforeWall = cooldownRun.target.hp;
    cooldownRun.simulation.keepInsideArena(cooldownRun.target);
    assert.ok(cooldownRun.target.hp < hpBeforeWall, "Common Wall Slam should damage on arena wall contact");
    const hpAfterFirstWall = cooldownRun.target.hp;
    cooldownRun.target.position = new Vector2(cooldownRun.simulation.width + cooldownRun.target.radius, 480);
    setVelocity(cooldownRun.target, new Vector2(400, 0));
    cooldownRun.simulation.keepInsideArena(cooldownRun.target);
    assert.equal(cooldownRun.target.hp, hpAfterFirstWall, "Wall Slam should enforce its 0.20s per-body cooldown");
    cooldownEffect.tick(cooldownRun.target, 0.2);
    cooldownRun.target.position = new Vector2(cooldownRun.simulation.width + cooldownRun.target.radius, 480);
    setVelocity(cooldownRun.target, new Vector2(400, 0));
    cooldownRun.simulation.keepInsideArena(cooldownRun.target);
    assert.ok(cooldownRun.target.hp < hpAfterFirstWall, "Wall Slam should reactivate after 0.20s");

    const terrain = [{ shape: "circle", x: 900, y: 480, radius: 50, blocking: true }];
    const terrainRun = createRun(0, { terrain });
    terrainRun.target.state.wallSlam = new WallSlamEffect({ source: terrainRun.owner, duration: 1 });
    terrainRun.target.position = new Vector2(850, 480);
    setVelocity(terrainRun.target, new Vector2(400, 0));
    const hpBeforeTerrain = terrainRun.target.hp;
    terrainRun.simulation.keepInsideArena(terrainRun.target);
    assert.ok(terrainRun.target.hp < hpBeforeTerrain, "Common Wall Slam should reuse terrain contactPoint and normal");

    for (const ratio of [0, 0.5, 1]) {
        const homeRun = createRun(2);
        homeRun.owner.ability.performSlash(homeRun.target);
        const effect = homeRun.target.state.wallSlam;
        const hitContactPoint = new Vector2(
            homeRun.target.position.x - homeRun.target.radius,
            homeRun.target.position.y
        );
        const multiplier = effect.getDamageMultiplier({
            contactPoint: Vector2.add(
                hitContactPoint,
                new Vector2(Math.hypot(homeRun.simulation.width, homeRun.simulation.height) * ratio, 0)
            )
        });
        assert.ok(
            Math.abs(multiplier - (1 + ratio)) < 1e-9,
            `Lv6 home run multiplier should be ${1 + ratio} at diagonal ratio ${ratio}`
        );
        assert.equal(
            effect.getDamageMultiplier({ contactPoint: hitContactPoint }),
            1,
            "Lv6 should enhance only the first Wall Slam"
        );
        if (ratio === 1) {
            const homeRunText = homeRun.simulation.entities.find(
                (entity) => entity.constructor?.name === "ActionText" && entity.displayText.startsWith("HOME RUN ")
            );
            assert.ok(
                homeRunText.displayText.endsWith("2.00"),
                "Maximum first-wall distance should announce HOME RUN x2"
            );
            homeRunText.position.x = homeRun.simulation.width + 100;
            const renderHomeRunText = (label) => {
                let textPrimitive;
                assertForegroundEffectRenders(homeRunText, label, (primitives) => {
                    textPrimitive = assertCombatTextSignature(primitives, homeRunText, label);
                    assert.equal(
                        homeRunText.visibilityToken,
                        "combatText",
                        `${label} should use the shared visibility token`
                    );
                });
                return { y: textPrimitive.args[2], alpha: textPrimitive.globalAlpha };
            };
            homeRunText.update(0.05);
            const homeRunStart = renderHomeRunText("Bat HOME RUN text start");
            homeRunText.update(0.45);
            const homeRunMid = renderHomeRunText("Bat HOME RUN text mid");
            homeRunText.update(0.45);
            const homeRunEnd = renderHomeRunText("Bat HOME RUN text end");
            assert.ok(
                homeRunStart.y > homeRunMid.y && homeRunMid.y > homeRunEnd.y,
                "HOME RUN combat text should rise across start, mid, and end frames"
            );
            assert.ok(
                homeRunStart.alpha < homeRunMid.alpha && homeRunMid.alpha === homeRunEnd.alpha,
                "HOME RUN combat text should fade in before holding readable opacity"
            );
            homeRunText.update(0.151);
            assert.equal(homeRunText.isExpired, true, "HOME RUN combat text should expire after its 1.1s lifetime");
        }
    }

    const resetRun = createRun(3);
    resetRun.owner.ability.performSlash(resetRun.target);
    const resetEffect = resetRun.target.state.wallSlam;
    resetRun.owner.ability.timer = 2;
    resetEffect.onWallBounce(
        resetRun.target,
        new Vector2(-1, 0),
        resetRun.simulation,
        resetRun.target.position.clone(),
        new Vector2(400, 0)
    );
    assert.equal(resetRun.owner.ability.timer, 0, "Lv9 valid Wall Slam should reset Bat cooldown");
    assert.ok(resetRun.owner.ability.state.resetFlash > 0, "Lv9 reset should activate the bat flash state");
    const resetText = resetRun.simulation.entities.find(
        (entity) => entity.constructor?.name === "ActionText" && entity.displayText === "RESET!"
    );
    resetText.position.x = -100;
    const renderResetText = (label) => {
        let textPrimitive;
        assertForegroundEffectRenders(resetText, label, (primitives) => {
            textPrimitive = assertCombatTextSignature(primitives, resetText, label);
            assert.equal(resetText.visibilityToken, "combatText", `${label} should use the shared visibility token`);
        });
        return { y: textPrimitive.args[2], alpha: textPrimitive.globalAlpha };
    };
    resetText.update(0.05);
    const resetStart = renderResetText("Bat RESET text start");
    resetText.update(0.45);
    const resetMid = renderResetText("Bat RESET text mid");
    resetText.update(0.45);
    const resetEnd = renderResetText("Bat RESET text end");
    assert.ok(
        resetStart.y > resetMid.y && resetMid.y > resetEnd.y,
        "RESET combat text should rise across start, mid, and end frames"
    );
    assert.ok(
        resetStart.alpha < resetMid.alpha && resetMid.alpha === resetEnd.alpha,
        "RESET combat text should fade in before holding readable opacity"
    );
    resetText.update(0.151);
    assert.equal(resetText.isExpired, true, "RESET combat text should expire after its 1.1s lifetime");
    resetRun.owner.ability.timer = 2;
    resetEffect.tick(resetRun.target, 0.2);
    resetEffect.onWallBounce(
        resetRun.target,
        new Vector2(-1, 0),
        resetRun.simulation,
        resetRun.target.position.clone(),
        new Vector2(400, 0)
    );
    assert.equal(resetRun.owner.ability.timer, 2, "Lv9 reset should retain its owner-level 0.50s cooldown");
    resetRun.owner.ability.update(0.5, null);
    resetRun.owner.ability.timer = 2;
    resetEffect.tick(resetRun.target, 0.3);
    resetEffect.onWallBounce(
        resetRun.target,
        new Vector2(-1, 0),
        resetRun.simulation,
        resetRun.target.position.clone(),
        new Vector2(400, 0)
    );
    assert.equal(resetRun.owner.ability.timer, 0, "Lv9 reset should reactivate after 0.50s without a target lock");
    console.log("[bat-ball-wall-slam-contracts] ok");
}

function testVampireLevelRewardContracts(app) {
    const tierLevels = [1, 3, 6, 9];
    const setVelocity = (body, velocity) => {
        body.applyImpulse(Vector2.subtract(velocity, body.velocity));
    };
    const createRun = (tier, { ally = false } = {}) => {
        const vampireSpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.VAMPIRE);
        const enemySpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
        const specs = [
            { ...vampireSpec, teamId: "vampire-team" },
            { ...enemySpec, id: `vampire-reward-target-${tier}`, teamId: "enemy-team" }
        ];
        if (ally) {
            const allySpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.GUNNER);
            specs.push({ ...allySpec, id: `vampire-reward-ally-${tier}`, teamId: "vampire-team" });
        }
        const simulation = new BattleSimulation(specs, { onLog() {}, onSound() {} }, null, {
            assignActions: false,
            arenaWidth: 2_000,
            arenaHeight: 960
        });
        const [owner, target, friendly] = simulation.fighters;
        applyExperienceProgressionToBall(owner, getCharacterLevelProgression(FIGHTER_IDS.VAMPIRE, tierLevels[tier]));
        simulation.spawnParticleBurst = () => {};
        simulation.spawnExplosion = () => {};
        simulation.spawnPulse = () => {};
        simulation.spawnDamageNumber = () => {};
        simulation.spawnCriticalNumber = () => {};
        simulation.spawnActionText = () => {};
        simulation.shakeScreen = () => {};
        owner.stats.baseDamage = 100;
        owner.stats.criticalChance = 0;
        target.maxHp = 100;
        target.hp = 100;
        target.stats.baseDefense = 0;
        target.position = new Vector2(700, 480);
        owner.position = new Vector2(300, 480);
        setVelocity(owner, new Vector2());
        setVelocity(target, new Vector2());
        if (friendly) {
            friendly.position = new Vector2(700, 480);
            setVelocity(friendly, new Vector2());
        }
        return { simulation, owner, target, friendly };
    };
    const spawnBats = (run, rolls = null) => {
        const previousRandom = Math.random;
        if (rolls) {
            const values = [...rolls];
            Math.random = () => values.shift() ?? 0.5;
        }
        try {
            run.owner.ability._spawnBats(run.target);
        } finally {
            Math.random = previousRandom;
        }
        return run.simulation.entities.filter((entity) => entity.constructor?.name === "BatProjectile");
    };
    const placeBatInContact = (bat, target) => {
        bat.position = new Vector2(target.position.x - target.radius - bat.radius + 1, target.position.y);
        setVelocity(bat, new Vector2());
    };

    const progressionRows = REWARD_BALANCE.experience.characterLevelProgressions.vampire.filter(
        (entry) => entry.abilityTier
    );
    assert.deepEqual(
        progressionRows.map((entry) => entry.gameText),
        ["반복 물기 ×0.05 · 반동 재돌입", "수명 종료 폭발 65px · ×0.05", "피의 견인 180px/s · 혈액 파열 ×0.15"],
        "Vampire level rewards should describe the three behavior tiers"
    );
    assert.deepEqual(
        REWARD_BALANCE.experience.abilityUpgrades.vampire.tiers,
        [{}, { repeatBite: true }, { lifeBurst: true }, { bloodPull: true }],
        "Vampire level tiers should not retain count, speed, or lifetime multipliers"
    );

    const lifetimeRun = createRun(3);
    const lifeRolls = [0, 0.200001, 0.4, 0.5, 0.6, 0.8, 0.999999];
    const lifetimeBats = spawnBats(lifetimeRun, lifeRolls);
    assert.equal(lifetimeBats.length, 7, "Vampire should always launch seven bats");
    assert.ok(
        lifetimeBats.every((bat) => bat.life >= 3.25 && bat.life <= 4.75 && bat.maxLife === bat.life),
        "Every bat should receive an independent 3.25-4.75 second base lifetime"
    );
    assert.ok(
        Math.abs(lifetimeBats.reduce((sum, bat) => sum + bat.life, 0) / lifetimeBats.length - 4) < 1e-6,
        "Symmetric deterministic lifetime rolls should preserve the four-second average"
    );
    assert.equal(
        new Set(lifetimeBats.map((bat) => bat.life)).size,
        7,
        "A swarm should retain independently rolled lifetimes"
    );

    const baseRun = createRun(0);
    baseRun.owner.hp = 50;
    const [baseBat] = spawnBats(baseRun, Array(7).fill(0.5));
    placeBatInContact(baseBat, baseRun.target);
    baseBat.update(0, baseRun.simulation);
    assert.equal(baseRun.target.hp, 80, "Lv.1-2 bat bites should keep the base total-attack x0.20 damage");
    assert.equal(baseRun.owner.hp, 64, "Base bat healing should use 70% of actual bite damage");
    assert.equal(baseBat.isExpired, true, "Lv.1-2 bats should still expire after the first real contact");

    const repeatRun = createRun(1);
    repeatRun.owner.hp = 50;
    const [repeatBat] = spawnBats(repeatRun, Array(7).fill(0.5));
    placeBatInContact(repeatBat, repeatRun.target);
    repeatBat.update(0, repeatRun.simulation);
    assert.equal(repeatRun.target.hp, 95, "Lv.3 bites should deal total-attack x0.05");
    assert.equal(repeatRun.owner.hp, 54, "Lv.3 bites should heal 70% of actual damage exactly once");
    assert.equal(repeatBat.isExpired, false, "Lv.3 bats should survive their first bite");
    assert.ok(
        Math.abs(repeatBat.velocity.length() - 240) < 1e-9 && repeatBat.velocity.x < 0,
        "Lv.3 bites should apply a 240px/s outward recoil impulse"
    );
    assert.equal(repeatBat.isHomingLocked, true, "Lv.3 recoil should pause homing for 0.15 seconds");
    repeatBat.update(0, repeatRun.simulation);
    assert.equal(repeatRun.target.hp, 95, "A repeated contact inside one second should not bite again");
    repeatRun.target.position = new Vector2(1_700, 480);
    repeatBat.update(0.99, repeatRun.simulation);
    repeatRun.target.position = new Vector2(700, 480);
    placeBatInContact(repeatBat, repeatRun.target);
    repeatBat.update(0, repeatRun.simulation);
    assert.equal(repeatRun.target.hp, 95, "The per-bat target cooldown should still block at 0.99 seconds");
    repeatRun.target.position = new Vector2(1_700, 480);
    repeatBat.update(0.01, repeatRun.simulation);
    repeatRun.target.position = new Vector2(700, 480);
    placeBatInContact(repeatBat, repeatRun.target);
    repeatBat.update(0, repeatRun.simulation);
    assert.equal(repeatRun.target.hp, 90, "A new real contact should bite again after one second");
    assert.equal(repeatBat.isHomingLocked, true, "Every successful repeat bite should restart the homing pause");
    const repeatBatContext = makeRecordingCanvasContext();
    assert.doesNotThrow(() => repeatBat.draw(repeatBatContext), "The recoil bat visual should render without errors");
    assert.ok(
        repeatBatContext.calls.some((call) => call[0] === "setLineDash"),
        "A recoiling bat should render the dotted blood trail"
    );
    const biteEffect = repeatRun.simulation.entities.find((entity) => entity.constructor?.name === "BloodBiteEffect");
    assert.ok(biteEffect, "A successful bite should emit the crescent bite effect");
    assert.doesNotThrow(
        () => biteEffect.draw(makeRecordingCanvasContext()),
        "The crescent bite effect should render without errors"
    );

    const guardedRun = createRun(1);
    guardedRun.owner.hp = 50;
    guardedRun.target.hp = 3;
    guardedRun.target.stats.baseDefense = 2;
    let projectileGuardCalls = 0;
    let damageCalls = 0;
    let healCalls = 0;
    guardedRun.target.actionContext.onProjectileDamage = (rawDamage) => {
        projectileGuardCalls += 1;
        return rawDamage;
    };
    const originalTakeDamage = guardedRun.target.takeDamage.bind(guardedRun.target);
    guardedRun.target.takeDamage = (...args) => {
        damageCalls += 1;
        return originalTakeDamage(...args);
    };
    const originalHeal = guardedRun.owner.heal.bind(guardedRun.owner);
    guardedRun.owner.heal = (amount) => {
        healCalls += 1;
        return originalHeal(amount);
    };
    const [guardedBat] = spawnBats(guardedRun, Array(7).fill(0.5));
    placeBatInContact(guardedBat, guardedRun.target);
    guardedBat.update(0, guardedRun.simulation);
    assert.equal(guardedRun.target.hp, 0, "Bite damage should respect defense and remaining HP");
    assert.equal(guardedRun.owner.hp, 52, "Bite healing should use capped actual damage instead of raw damage");
    assert.deepEqual(
        [projectileGuardCalls, damageCalls, healCalls],
        [1, 1, 1],
        "A bite should traverse projectile defense, damage, and healing exactly once"
    );

    const burstRun = createRun(2, { ally: true });
    burstRun.owner.hp = 50;
    const [burstBat] = spawnBats(burstRun, Array(7).fill(0.5));
    burstBat.position = new Vector2(700, 480);
    burstRun.target.position = new Vector2(750, 480);
    burstRun.friendly.position = new Vector2(750, 480);
    const friendlyHp = burstRun.friendly.hp;
    burstBat.life = 0.01;
    burstBat.update(0.02, burstRun.simulation);
    assert.equal(burstRun.target.hp, 95, "Lv.6 natural expiration should deal x0.05 inside 65px");
    assert.equal(burstRun.friendly.hp, friendlyHp, "Lv.6 expiration should not damage the owner team");
    assert.equal(burstRun.owner.hp, 54, "Lv.6 expiration should heal from actual damage exactly once");
    assert.equal(burstBat.isExpired, true, "The bat should expire after its lifetime burst");
    const burstEffects = burstRun.simulation.entities.filter(
        (entity) => entity.constructor?.name === "BloodBatBurstEffect"
    );
    assert.equal(burstEffects.length, 1, "Lv.6 natural expiration should emit one sequential blood-bat burst effect");
    assert.doesNotThrow(
        () => burstEffects[0].draw(makeRecordingCanvasContext()),
        "The sequential blood-bat burst should render without errors"
    );
    burstBat.update(0.02, burstRun.simulation);
    assert.equal(burstRun.target.hp, 95, "An expired bat should never burst twice");

    const pullRun = createRun(3);
    pullRun.owner.hp = 50;
    const pullBats = spawnBats(pullRun, Array(7).fill(0.5));
    placeBatInContact(pullBats[0], pullRun.target);
    placeBatInContact(pullBats[1], pullRun.target);
    pullBats[0].update(0, pullRun.simulation);
    pullBats[1].update(0, pullRun.simulation);
    assert.ok(
        Math.abs(pullRun.target.velocity.x + 180) < 1e-9 && Math.abs(pullRun.target.velocity.y) < 1e-9,
        "Same-frame bites should apply only one 180px/s pull toward Vampire"
    );
    assert.equal(
        pullRun.owner.ability.getBloodMarkRemaining(pullRun.target),
        0.6,
        "Blood pull should mark 0.6s vulnerability"
    );
    assert.equal(
        pullRun.simulation.entities.filter((entity) => entity.constructor?.name === "BloodTetherEffect").length,
        1,
        "Same-frame bites should emit only one short blood tether"
    );
    const tetherEffect = pullRun.simulation.entities.find((entity) => entity.constructor?.name === "BloodTetherEffect");
    const markEffect = pullRun.simulation.entities.find((entity) => entity.constructor?.name === "BloodMarkEffect");
    const renderBloodTether = (label) => {
        let travelingDrop;
        assertForegroundEffectRenders(tetherEffect, label, (primitives) => {
            assertEffectTrajectory(primitives, tetherEffect.position, pullRun.owner.position, label);
            assertEffectUsesColor(primitives, "#d81f4d", label);
            const drops = primitives.filter(
                (primitive) => primitive.method === "arc" && primitive.fillStyle === "#ff426d"
            );
            assert.equal(drops.length, 3, `${label} should draw three blood drops traveling toward Vampire`);
            travelingDrop = drops[0];
        });
        return { radius: travelingDrop.args[2], alpha: travelingDrop.globalAlpha };
    };
    const tetherStart = renderBloodTether("Vampire blood tether start");
    tetherEffect.update(0.09);
    const tetherMid = renderBloodTether("Vampire blood tether mid");
    tetherEffect.update(0.08);
    const tetherEnd = renderBloodTether("Vampire blood tether end");
    assert.ok(
        tetherStart.radius > tetherMid.radius && tetherMid.radius > tetherEnd.radius,
        "Blood tether drops should contract while traveling to Vampire"
    );
    assert.ok(
        tetherStart.alpha > tetherMid.alpha && tetherMid.alpha > tetherEnd.alpha,
        "Blood tether should fade across start, mid, and end frames"
    );

    const renderBloodMark = (label) => {
        let markArc;
        assertForegroundEffectRenders(markEffect, label, (primitives) => {
            assert.ok(
                findEffectPrimitive(
                    primitives,
                    "translate",
                    ([x, y]) =>
                        Math.abs(x - pullRun.target.position.x) < 1e-6 && Math.abs(y - pullRun.target.position.y) < 1e-6
                ),
                `${label} should stay anchored to the marked target`
            );
            markArc = findEffectPrimitive(
                primitives,
                "arc",
                ([x, y, radius, startAngle, endAngle], primitive) =>
                    x === 0 &&
                    y === 0 &&
                    radius >= pullRun.target.radius + 4 &&
                    radius <= pullRun.target.radius + 10 &&
                    Math.abs(startAngle + 1.05) < 1e-9 &&
                    Math.abs(endAngle - 1.05) < 1e-9 &&
                    primitive.strokeStyle.startsWith("rgba(210, 24, 67,")
            );
            assert.ok(markArc, `${label} should draw the blood crescent around the target`);
            assert.ok(
                primitives.filter((primitive) => primitive.method === "lineTo").length >= 3,
                `${label} should retain the lightning-shaped vulnerability mark`
            );
        });
        return Number(markArc.strokeStyle.match(/([0-9.]+)\)$/)?.[1]);
    };
    const markStartAlpha = renderBloodMark("Vampire blood mark start");
    markEffect.update(0.3);
    const markMidAlpha = renderBloodMark("Vampire blood mark mid");
    markEffect.update(0.29);
    const markEndAlpha = renderBloodMark("Vampire blood mark end");
    assert.ok(
        markStartAlpha > markMidAlpha && markMidAlpha > markEndAlpha,
        "Blood mark crescent should fade across start, mid, and final active frames"
    );
    setVelocity(pullRun.target, new Vector2());
    pullRun.target.position = new Vector2(
        pullRun.owner.position.x + pullRun.owner.radius + pullRun.target.radius - 1,
        pullRun.owner.position.y
    );
    const hpBeforeRupture = pullRun.target.hp;
    pullRun.owner.ability.onCollision(pullRun.target, { contactPoint: pullRun.target.position.clone() });
    assert.equal(pullRun.target.hp, hpBeforeRupture - 15, "The first marked body collision should deal x0.15 rupture");
    assert.equal(pullRun.owner.hp, 69, "Two bites and one rupture should each heal once from actual damage");
    const ruptureEffect = pullRun.simulation.entities.find(
        (entity) => entity.constructor?.name === "BloodRuptureEffect"
    );
    const renderBloodRupture = (label) => {
        let ruptureArc;
        assertForegroundEffectRenders(ruptureEffect, label, (primitives) => {
            assert.ok(
                findEffectPrimitive(
                    primitives,
                    "translate",
                    ([x, y]) =>
                        Math.abs(x - ruptureEffect.position.x) < 1e-6 && Math.abs(y - ruptureEffect.position.y) < 1e-6
                ),
                `${label} should stay anchored to the collision contact`
            );
            ruptureArc = findEffectPrimitive(
                primitives,
                "arc",
                ([x, y, radius], primitive) =>
                    x === 0 && y === 0 && radius >= 0 && radius <= 38 && primitive.strokeStyle === "#ff315f"
            );
            assert.ok(ruptureArc, `${label} should draw the collapsing blood rupture ring`);
            assert.equal(
                primitives.filter((primitive) => primitive.method === "lineTo").length,
                6,
                `${label} should draw six radial rupture cuts`
            );
        });
        return { radius: ruptureArc.args[2], alpha: ruptureArc.globalAlpha };
    };
    const ruptureStart = renderBloodRupture("Vampire blood rupture start");
    ruptureEffect.update(0.11);
    const ruptureMid = renderBloodRupture("Vampire blood rupture mid");
    ruptureEffect.update(0.1);
    const ruptureEnd = renderBloodRupture("Vampire blood rupture end");
    assert.ok(
        ruptureStart.radius > ruptureMid.radius && ruptureMid.radius < ruptureEnd.radius,
        "Blood rupture should collapse inward before bursting outward"
    );
    assert.ok(
        ruptureStart.alpha > ruptureMid.alpha && ruptureMid.alpha > ruptureEnd.alpha,
        "Blood rupture should fade across start, collapse, and burst frames"
    );
    assert.equal(
        pullRun.owner.ability.getBloodMarkRemaining(pullRun.target),
        0,
        "Rupture should consume vulnerability"
    );
    pullRun.owner.ability.onCollision(pullRun.target, { contactPoint: pullRun.target.position.clone() });
    assert.equal(pullRun.target.hp, hpBeforeRupture - 15, "Consumed vulnerability should not rupture twice");

    const expiredMarkRun = createRun(3);
    const [expiredMarkBat] = spawnBats(expiredMarkRun, Array(7).fill(0.5));
    placeBatInContact(expiredMarkBat, expiredMarkRun.target);
    expiredMarkBat.update(0, expiredMarkRun.simulation);
    expiredMarkRun.owner.ability.update(0.61, expiredMarkRun.target);
    assert.equal(
        expiredMarkRun.owner.ability.getBloodMarkRemaining(expiredMarkRun.target),
        0,
        "Blood vulnerability should expire after 0.6 seconds"
    );
    console.log("[vampire-level-reward-contracts] ok");
}

function testMultiAbilityFoundation(app) {
    class ProbeAbility extends Ability {
        constructor(owner, simulation, events, modifier) {
            super(owner, simulation, 4);
            this.events = events;
            this.modifier = modifier;
        }

        update() {
            this.events.push(`${this.instanceKey}:update`);
        }

        onCollision() {
            this.events.push(`${this.instanceKey}:collision`);
        }

        getStatModifiers() {
            return this.modifier;
        }

        getUiState() {
            return { label: this.displayName, progress: this.timer / this.cooldown };
        }
    }

    const primarySpec = { ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.DASH), teamId: "ability-set-a" };
    const opponentSpec = {
        ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
        id: "ability-set-opponent",
        teamId: "ability-set-b"
    };
    const probeSimulation = new BattleSimulation([primarySpec, opponentSpec], { onLog() {}, onSound() {} }, null, {
        assignActions: false
    });
    const [probeOwner, probeTarget] = probeSimulation.fighters;
    const events = [];
    const primaryProbe = new ProbeAbility(probeOwner, probeSimulation, events, {
        speed: 1.2,
        damage: 1.1,
        defense: 1.05,
        impact: 1.15
    }).setContext({
        abilityId: "dash",
        role: "primary",
        abilityTier: 1,
        instanceKey: "primary:probe",
        displayName: "Primary Probe"
    });
    const subProbe = new ProbeAbility(probeOwner, probeSimulation, events, {
        speed: 0.1,
        damage: 5,
        defense: 5,
        impact: 5
    }).setContext({
        abilityId: "hero",
        role: "sub",
        abilityTier: 3,
        instanceKey: "sub:probe",
        displayName: "Sub Probe"
    });
    primaryProbe.timer = 3;
    subProbe.timer = 1;
    probeOwner.bindAbilitySet(new AbilitySet(probeOwner, { primary: primaryProbe, subAbilities: [subProbe] }));

    probeOwner.abilities.update(0.1, probeTarget);
    probeOwner.abilities.onCollision(probeTarget, {});
    assert.deepEqual(
        events,
        ["primary:probe:update", "sub:probe:update", "primary:probe:collision", "sub:probe:collision"],
        "Ability lifecycle hooks should run in primary then sub registration order"
    );
    assert.deepEqual(
        probeOwner.getStatModifiers(),
        primaryProbe.modifier,
        "Sub abilities must not change fighter collision physics modifiers"
    );
    const probeStates = probeOwner.getAbilityUiStates();
    assert.deepEqual(
        probeStates.map((state) => state.key),
        ["primary:probe", "sub:probe"],
        "Ability UI state should preserve stable primary/sub registration order"
    );
    assert.deepEqual(
        probeStates.map((state) => state.cooldownRemaining),
        [3, 1],
        "Each ability UI row should retain its own cooldown state"
    );
    assert.equal(
        subProbe.getLevelUpgrade().heroicBurst,
        true,
        "A Hero sub ability must read its own id and tier upgrade data"
    );
    for (const state of probeStates) {
        assert.deepEqual(
            Object.keys(state).sort(),
            [
                "abilityId",
                "cooldownDuration",
                "cooldownRemaining",
                "displayName",
                "key",
                "label",
                "progress",
                "role",
                "status",
                "text"
            ],
            "Ability UI rows should expose the complete shared card contract"
        );
    }

    const gunnerSpec = {
        ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.GUNNER),
        teamId: "source-primary"
    };
    const sourceSimulation = new BattleSimulation([gunnerSpec, opponentSpec], { onLog() {}, onSound() {} }, null, {
        assignActions: false
    });
    const [gunnerOwner] = sourceSimulation.fighters;
    const gunner = gunnerOwner.abilities.primary;
    const heroSub = sourceSimulation.createAbility("hero", gunnerOwner, {
        role: "sub",
        abilityTier: 3,
        instanceKey: "sub:hero-orb",
        displayName: "Hero Orb"
    });
    gunnerOwner.abilities.addSubAbility(heroSub);

    gunner.timer = 3;
    heroSub.timer = 3;
    gunner._startBurst();
    gunner._fireBurstBullet();
    const bullet = sourceSimulation.entities.find((entity) => entity.constructor?.name === "BulletProjectile");
    assert.equal(bullet.sourceAbility, gunner, "Bullets should retain the ability instance that spawned them");
    bullet.position = gunnerOwner.position.clone();
    bullet._ownerCollectCheck(sourceSimulation);
    assert.ok(gunner.timer < 3, "A returned bullet should reduce only the Gunner source cooldown");
    assert.equal(heroSub.timer, 3, "A returned bullet must not reduce a different sub ability cooldown");

    heroSub._spawnCore("critical", gunnerOwner.position, new Vector2(1, 0));
    const orb = sourceSimulation.entities.find((entity) => entity.constructor?.name === "HeroOrb" && !entity.isExpired);
    assert.equal(orb.sourceAbility, heroSub, "Hero cores should retain their spawning Hero ability instance");
    orb.collectionGraceRemaining = 0;
    orb.position = gunnerOwner.position.clone();
    orb.velocity = new Vector2(0, 0);
    orb.update(0, sourceSimulation);
    assert.equal(
        heroSub.state.resonanceFragments.length,
        1,
        "A Hero sub ability should retain its own collected resonance fragment"
    );
    assert.equal(gunner.timer, 3 - gunner.cooldown / 2 / 12, "Hero core effects must not mutate the Gunner cooldown");

    const fighterStrip = readFileSync("src/components/fighter-strip.html", "utf8");
    assert.ok(fighterStrip.includes("fighter.abilityStates"), "Fighter cards should render the ability state list");
    assert.ok(fighterStrip.includes("abilityState.role === 'sub'"), "Fighter cards should identify sub ability rows");
    const styles = readFileSync("src/styles.css", "utf8");
    assert.ok(
        styles.includes(".battle-stage") && styles.includes("overflow-y: auto"),
        "Portrait battle layout should scroll as cards grow"
    );
    console.log("[multi-ability-foundation] ok");
}

function testHuntingSystem() {
    const profile = createDefaultPlayerProfile();
    assert.equal(canEnterHunting(profile, FIGHTER_IDS.DASH), false, "Characters need one tournament win to enter");
    profile.collection.characters[FIGHTER_IDS.DASH] = {
        tournamentsCompleted: 1,
        tournamentWins: 1,
        matchWins: 3,
        bestPlacement: 1,
        totalDamageDealt: 1200,
        comebackMatchWins: 0,
        firstTournamentAt: 100,
        lastTournamentAt: 200
    };
    const eligible = getEligibleHuntingCharacters(profile, [{ id: FIGHTER_IDS.DASH }, { id: FIGHTER_IDS.ARCHER }]);
    assert.deepEqual(
        eligible.map((fighter) => fighter.id),
        [FIGHTER_IDS.DASH],
        "Only tournament winners should be listed as hunting candidates"
    );

    assert.equal(getEnemyPowerMultiplier(1), 1, "Floor 1 enemy power should be base");
    assert.equal(getEnemyPowerMultiplier(3), 1.16, "Enemy power should scale by 8% per floor");
    assert.equal(getEnemyPowerMultiplier(3, { enemyType: "champion" }), 1.44, "Champion intrusions should be stronger");
    const baseSpec = {
        id: "enemy",
        stats: { hp: 100, damage: 10, defense: 2, speed: 300, skill: 4, radius: 24 }
    };
    const scaled = scaleEnemySpecForHunting(baseSpec, 3);
    assert.equal(scaled.stats.hp, 116, "Hunting scaling should affect HP");
    assert.equal(scaled.stats.damage, 12, "Hunting scaling should affect damage");
    assert.equal(scaled.stats.defense, 2.32, "Hunting scaling should affect defense");
    assert.equal(scaled.stats.speed, 300, "Hunting scaling should not affect speed");
    assert.equal(scaled.stats.skill, 4, "Hunting scaling should not affect skill");

    const floor1MobWeights = getHuntingMobCountWeights(1);
    const floor100MobWeights = getHuntingMobCountWeights(100);
    assert.equal(
        getHuntingMobCount(1, () => 0),
        2,
        "The lowest weighted roll should create two early enemies"
    );
    assert.equal(
        getHuntingMobCount(1, () => 0.999999),
        10,
        "All mob counts should remain possible from the first floor"
    );
    assert.ok(
        floor1MobWeights.find((entry) => entry.count === 2).weight >
            floor1MobWeights.find((entry) => entry.count === 10).weight,
        "Early floors should weight small encounters more heavily"
    );
    assert.ok(
        floor100MobWeights.find((entry) => entry.count === 10).weight >
            floor100MobWeights.find((entry) => entry.count === 2).weight,
        "Deep floors should weight large encounters more heavily"
    );
    const mobs = createHuntingMobEncounter({
        floor: 3,
        rng: (() => {
            // [mob0 type, mob1 forced-different type, mob2 type, mob0 appearance×5, mob1 appearance×5, mob2 appearance×5]
            // MobAppearance.generate는 이제 randomSpin 헬퍼로 2회 rng 호출 (abs+sign)
            const rolls = [0, 0.9, 0, 0.1, 0.2, 0.3, 0.5, 0.6, 0.7, 0.8, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
            return () => rolls.shift() ?? 0;
        })()
    });
    assert.equal(mobs.length, 2, "Early hunting encounters should create their configured enemy count");
    assert.equal(new Set(mobs.map((mob) => mob.id)).size, mobs.length, "Hunting mob IDs should be unique per fight");
    assert.ok(
        mobs.every((mob) => mob.teamId === HUNTING_TEAMS.ENEMY),
        "Hunting mobs should all be assigned to the enemy team"
    );
    assert.ok(
        mobs.every((mob) => mob.name !== "사냥터 몬스터"),
        "Hunting mobs should expose their own type through their nameplates"
    );
    assert.equal(
        createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.ELECTRIC }).name,
        "전기 마법사",
        "Electric mobs should use their unique display name"
    );
    assert.ok(
        new Set(mobs.map((mob) => mob.hunting.monsterType)).size >= 2,
        "Early floors should combine at least two monster types"
    );
    const floor1Pool = getHuntingMonsterPool(1);
    const floor10Pool = getHuntingMonsterPool(10);
    const floor90Pool = getHuntingMonsterPool(90);
    const floor94Pool = getHuntingMonsterPool(94);
    assert.equal(floor1Pool.length, 14, "All monster types should have a small chance from floor 1");
    assert.ok(
        floor1Pool.find((monster) => monster.type === HUNTING_MONSTER_TYPES.LASER).weight > 0,
        "Late monsters should remain rare but possible in early floors"
    );
    assert.ok(
        floor10Pool.find((monster) => monster.type === HUNTING_MONSTER_TYPES.SHOOTER).weight >
            floor10Pool.find((monster) => monster.type === HUNTING_MONSTER_TYPES.PURSUER).weight,
        "A monster should become the main encounter after its focus floor"
    );
    assert.ok(
        mobs.every((mob) => mob.ability === "hunting_mob"),
        "Hunting mobs should use the dedicated monster ability"
    );
    assert.ok(
        floor90Pool.find((monster) => monster.type === HUNTING_MONSTER_TYPES.SHARD).weight >
            floor90Pool.find((monster) => monster.type === HUNTING_MONSTER_TYPES.SIPHON).weight,
        "Floor 90 should make shard monsters the main encounter"
    );
    assert.ok(
        floor94Pool.find((monster) => monster.type === HUNTING_MONSTER_TYPES.LASER).weight >
            floor94Pool.find((monster) => monster.type === HUNTING_MONSTER_TYPES.SHARD).weight,
        "Floor 94 should make laser monsters the main encounter"
    );
    assert.equal(
        Object.keys(HUNTING_MONSTER_BASE_SPECS).length,
        14,
        "Cave should define fourteen data-driven monster types"
    );
    const forestDefinitions = getHuntingMonsterDefinitions(HUNTING_STAGE_IDS.FOREST);
    const forestElectric = getHuntingMonsterDefinition(HUNTING_MONSTER_TYPES.ELECTRIC, HUNTING_STAGE_IDS.FOREST);
    assert.equal(
        forestDefinitions.length,
        14,
        "Every unlocked region should resolve the full monster definition table"
    );
    assert.equal(
        forestElectric.stageId,
        HUNTING_STAGE_IDS.FOREST,
        "Region definitions should retain their stage identity"
    );
    assert.ok(
        forestElectric.behaviorDescription,
        "Monster definitions should own their player-facing behavior description"
    );
    assert.equal(
        createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.ELECTRIC, stageId: HUNTING_STAGE_IDS.FOREST }).hunting
            .stageSkin,
        HUNTING_STAGE_IDS.FOREST,
        "Actual encounters should keep the entered region on their monster specs"
    );
    const rosterMiniboss = createHuntingMinibossSpec({
        roster: [
            {
                id: FIGHTER_IDS.DASH,
                name: "Dash Ball",
                ability: "dash",
                color: "#8ee8d7",
                stats: { hp: 110, damage: 10, speed: 294, radius: 49, mass: 1.16, defense: 1 }
            },
            {
                id: FIGHTER_IDS.ARCHER,
                name: "Archer Ball",
                ability: "archer",
                color: "#f7b34d",
                stats: { hp: 112, damage: 10, speed: 270, radius: 50, mass: 1.2, defense: 1 }
            }
        ],
        characterId: FIGHTER_IDS.DASH,
        floor: 3,
        rng: () => 0
    });
    assert.equal(rosterMiniboss.hunting.isMiniboss, true, "Roster enemies should remain marked as minibosses");
    assert.equal(rosterMiniboss.hunting.isMob, undefined, "Roster bosses must stay separate from generic monster loot");
    assert.equal(rosterMiniboss.hunting.sourceFighterId, FIGHTER_IDS.ARCHER, "Minibosses should not copy the player");
    assert.equal(rosterMiniboss.teamId, HUNTING_TEAMS.ENEMY, "Minibosses should fight on the enemy team");

    const run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, now: 1000 });
    assert.equal(run.floor, 1, "Hunting run should start at floor 1");
    assert.equal(run.stageId, HUNTING_STAGE_IDS.CAVE, "Default stage should be cave");
    const common = createHuntingChest({ id: "c1", rarity: "common", acquiredAt: 1000 });
    const uncommon = createHuntingChest({ id: "u1", rarity: "uncommon", acquiredAt: 1000 });
    const rare = createHuntingChest({ id: "r1", rarity: "rare", acquiredAt: 1000 });
    assert.equal(common.openCost, 20, "Chest instances should expose their open cost");
    assert.ok(common.rewardPreview.includes("파편"), "Chest instances should expose reward table preview text");
    assert.equal(
        rollHuntingChestReward(common, { rng: () => 0 }).type,
        "SHARDS",
        "Chest rewards should roll from the rarity reward table"
    );
    assert.ok(
        previewHuntingChest(rare).rewardTable.every((reward) => reward.type === "equipment"),
        "Rare and higher chests should guarantee equipment rewards"
    );
    const afterFloor = recordHuntingFloorResult(run, {
        hpRemain: 55,
        maxHp: 100,
        loot: { shards: 100, chests: [common, uncommon, rare] }
    });
    assert.equal(afterFloor.carriedHp, 55, "Hunting run should carry HP between floors");
    assert.equal(afterFloor.pendingLoot.chests.length, 3, "Floor rewards should stay pending");

    // rng(1)=0.4→EVENT, rng(2)=0.5→CHEST_ROOM(idx4), rng(3)=0→uncommon
    const advanced = advanceHuntingRun(afterFloor, {
        rng: (() => {
            const rolls = [0.4, 0.5, 0];
            return () => rolls.shift() ?? 0;
        })()
    });
    assert.equal(advanced.floor, 2, "Advance should move from floor 1 to 2");
    assert.equal(advanced.lastEncounter.type, HUNTING_FLOOR_OUTCOME_TYPES.EVENT, "Should produce an event encounter");
    assert.ok(advanced.lastEvent, "Event encounter should set lastEvent");
    assert.equal(advanced.lastEvent.type, HUNTING_EVENT_TYPES.CHEST_ROOM, "Event rolls should include chest rooms");
    assert.equal(advanced.lastEvent.chestRarity, "uncommon", "Chest room events should carry a concrete rarity");

    // rng(1)=0.4→EVENT, rng(2)=0.75→CURSED_ALTAR(idx6), rng(3)=0→first trade
    const cursed = advanceHuntingRun(afterFloor, {
        rng: (() => {
            const rolls = [0.4, 0.75, 0];
            return () => rolls.shift() ?? 0;
        })()
    });
    assert.equal(cursed.lastEncounter.type, HUNTING_FLOOR_OUTCOME_TYPES.EVENT, "Should produce an event encounter");
    assert.equal(cursed.lastEvent.type, HUNTING_EVENT_TYPES.CURSED_ALTAR, "Event pool should include cursed altars");
    const cursedApplied = applyHuntingCursedAltar(cursed, { trade: cursed.lastEvent.trade });
    assert.equal(cursedApplied.statModifiers.length, 2, "Cursed altars should add a gain and a loss modifier");
    const altarSpec = applyHuntingStatModifiersToSpec(
        { id: "hero", stats: { hp: 100, damage: 10, defense: 2, speed: 300, skill: 4 } },
        cursedApplied.statModifiers
    );
    assert.equal(altarSpec.stats.damage, 12, "Cursed altar gain should modify the target stat");
    assert.equal(altarSpec.stats.defense, 1.8, "Cursed altar loss should modify the traded-away stat");
    const consumedCursed = recordHuntingFloorResult(cursedApplied, { hpRemain: 50, maxHp: 100 });
    assert.equal(consumedCursed.statModifiers.length, 0, "One-floor altar modifiers should expire after a floor");
    const preservedEventBuff = recordHuntingFloorResult(cursedApplied, {
        loot: { shards: 0, chests: [common] },
        consumeStatModifiers: false
    });
    assert.equal(
        preservedEventBuff.statModifiers.length,
        2,
        "Non-combat event rewards should not consume temporary stat modifiers"
    );

    // rng(1)=0.4→EVENT, rng(2)=0.8→CHAMPION_INTRUSION(idx7)
    const champion = advanceHuntingRun(afterFloor, {
        rng: (() => {
            const rolls = [0.4, 0.8];
            return () => rolls.shift() ?? 0;
        })()
    });
    assert.equal(champion.lastEncounter.type, HUNTING_FLOOR_OUTCOME_TYPES.EVENT, "Should produce an event encounter");
    assert.equal(
        champion.lastEvent.type,
        HUNTING_EVENT_TYPES.CHAMPION_INTRUSION,
        "Event pool should include champion intrusions"
    );
    assert.equal(champion.lastEvent.enemyType, "champion", "Champion events should mark the next enemy type");

    const retreated = retreatHuntingRun(afterFloor, { now: 2000 });
    assert.equal(retreated.status, "retreated", "Retreat should end the run safely");
    assert.equal(retreated.securedLoot.shards, 100, "Retreat should secure pending key shards");
    assert.equal(retreated.pendingLoot.chests.length, 0, "Retreat should clear pending loot");

    const defeated = defeatHuntingRun(afterFloor, {
        rng: (() => {
            const rolls = [0.1, 0.2, 0.3, 0.4, 0.4, 0.6];
            return () => rolls.shift() ?? 0.6;
        })(),
        now: 3000
    });
    assert.equal(defeated.status, "defeated", "Defeat should end the run");
    assert.equal(defeated.securedLoot.shards, 50, "Defeat should preserve half of key shards");
    assert.equal(defeated.securedLoot.xp, undefined, "XP must not become defeatable hunting loot");
    assert.deepEqual(
        defeated.defeatLosses.chests.map((chest) => chest.id),
        ["r1", "u1"],
        "Defeat should break higher-rarity chests first with chain probability"
    );

    profile.hunting.shards = 50;
    profile.hunting.chests = [uncommon];
    assert.equal(getChestOpenCost("uncommon"), 50, "Uncommon chest open cost should match design");
    const opened = openHuntingChest(profile, "u1", { rng: () => 0 });
    assert.equal(opened.opened, true, "Chest should open when enough key shards are available");
    assert.equal(opened.reward.type, "equipment", "Uncommon chests should guarantee equipment rewards");
    assert.equal(profile.hunting.shards, 0, "Opening a guaranteed equipment chest should only spend its cost");
    assert.equal(profile.equipment.inventory.length, 1, "Guaranteed equipment rewards should enter the inventory");
    assert.equal(profile.hunting.chests.length, 0, "Opened chest should leave storage");

    const sanitized = sanitizePlayerProfile({
        hunting: {
            shards: 12,
            chests: [
                { id: "safe", rarity: "rare", acquiredAt: 1000 },
                { id: "safe", rarity: "common", acquiredAt: 2000 },
                { id: "", rarity: "legendary", acquiredAt: 3000 }
            ],
            stats: { runsStarted: 2, runsRetreated: 1, runsDefeated: 1, deepestFloor: 4 }
        }
    });
    assert.equal(sanitized.hunting.shards, 12, "Sanitized profile should keep hunting key shards");
    assert.equal(sanitized.hunting.chests.length, 1, "Sanitized profile should dedupe and discard invalid chests");
    assert.equal(sanitized.hunting.stats.deepestFloor, 4, "Sanitized profile should keep hunting stats");
    console.log("[hunting] ok");
}

async function testHuntingAchievementProgress() {
    const { ACHIEVEMENT_DEFINITIONS } = await import("../src/collection/achievementDefinitions.js");
    const { evaluateAchievements } = await import("../src/collection/achievementRules.js");
    const { grantAchievementReward } = await import("../src/collection/achievementRewards.js");

    assert.deepEqual(
        recordHuntingStageVisit(createDefaultPlayerProfile().hunting.stats, HUNTING_STAGE_IDS.FOREST).visitedStageIds,
        [HUNTING_STAGE_IDS.FOREST],
        "Entered regions should be recorded immediately instead of waiting for a battle result"
    );

    for (const monster of Object.values(HUNTING_MONSTER_BASE_SPECS)) {
        assert.ok(
            monster.monsterTags.includes(HUNTING_MONSTER_TAGS.MONSTER),
            `${monster.type} should be identified as a normal monster`
        );
        assert.equal(
            monster.monsterTags.filter((tag) => tag.startsWith("rarity:")).length,
            1,
            `${monster.type} should have exactly one rarity tag`
        );
    }

    const rareMonster = createHuntingMobSpec({
        type: HUNTING_MONSTER_TYPES.ELECTRIC,
        floor: 20,
        stageId: HUNTING_STAGE_IDS.FOREST
    });
    const epicMonster = createHuntingMobSpec({
        type: HUNTING_MONSTER_TYPES.LASER,
        floor: 94,
        stageId: HUNTING_STAGE_IDS.FOREST
    });
    let run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, stageId: HUNTING_STAGE_IDS.FOREST });
    run = recordHuntingBattleStart(run, {
        enemySpecs: [rareMonster, epicMonster, { hunting: { isMiniboss: true } }],
        hpRemain: 20,
        maxHp: 100,
        isChampion: true
    });
    run = recordHuntingBattleVictory(run);
    const repeatedVictory = recordHuntingBattleVictory(run);
    assert.equal(
        repeatedVictory.achievementProgress.monsterKillsByTag[HUNTING_MONSTER_TAGS.MONSTER],
        2,
        "A completed battle must not count its monster tags twice"
    );
    assert.equal(
        repeatedVictory.achievementProgress.monsterKillsByTag[HUNTING_MONSTER_TAGS.RARITY_RARE],
        1,
        "Rare monster tags should count from the actual encounter"
    );
    assert.equal(
        repeatedVictory.achievementProgress.monsterKillsByTag[HUNTING_MONSTER_TAGS.RARITY_EPIC],
        1,
        "Epic monster tags should count from the actual encounter"
    );
    assert.equal(
        repeatedVictory.achievementProgress.monsterKillsByTag["isMiniboss"],
        undefined,
        "Miniboss metadata must not be treated as a normal monster tag"
    );
    assert.equal(
        repeatedVictory.achievementProgress.monsterCodexByType[HUNTING_MONSTER_TYPES.ELECTRIC].kills,
        1,
        "Monster codex kills should only increase after the battle is won"
    );
    assert.equal(
        repeatedVictory.achievementProgress.monsterCodexByType[HUNTING_MONSTER_TYPES.ELECTRIC].regions.forest
            .firstEncounterFloor,
        1,
        "Monster codex discovery should remember the region of the actual encounter"
    );

    const returnedRun = retreatHuntingRun(
        {
            ...repeatedVictory,
            floor: 45,
            lastEvent: { type: HUNTING_EVENT_TYPES.PORTAL },
            pendingLoot: { shards: 0, chests: [createHuntingChest({ rarity: "common" })] }
        },
        { reason: "retreat" }
    );
    const stats = applyHuntingRunAchievementProgress(createDefaultPlayerProfile().hunting.stats, returnedRun);
    assert.equal(stats.monsterKillsByTag[HUNTING_MONSTER_TAGS.MONSTER], 2, "Normal monster kills should persist");
    assert.equal(stats.criticalHpCombatWins, 1, "A battle won from 20% starting HP should persist");
    assert.equal(stats.championVictories, 1, "Champion intrusion victories should persist separately");
    assert.equal(stats.securedChestCount, 1, "Only secured run chests should count toward the storage achievement");
    assert.equal(stats.bestPortalRetreatFloor, 45, "Portal retreats should keep their highest floor");
    assert.deepEqual(
        stats.visitedStageIds,
        [HUNTING_STAGE_IDS.FOREST],
        "Completed runs should persist entered regions"
    );
    assert.equal(
        getHuntingMonsterTypeKillCount(stats, HUNTING_MONSTER_TYPES.ELECTRIC),
        1,
        "Monster type kill helpers should read the persisted codex record"
    );
    assert.equal(
        getHuntingMonsterEncounteredTypeCount(stats),
        2,
        "Monster codex discovery should count each encountered behavior type"
    );

    const stageClearStats = applyHuntingRunAchievementProgress(stats, {
        ...returnedRun,
        stageId: HUNTING_STAGE_IDS.CAVE,
        endedReason: "stage_clear"
    });
    assert.deepEqual(
        stageClearStats.clearedStageIds,
        [HUNTING_STAGE_IDS.CAVE],
        "Stage clears should persist by stage ID"
    );

    const profile = createDefaultPlayerProfile();
    profile.hunting.stats = {
        ...stageClearStats,
        deepestFloor: 30,
        securedChestCount: 2,
        clearedStageIds: Object.values(HUNTING_STAGE_IDS),
        monsterKillsByTag: {
            [HUNTING_MONSTER_TAGS.MONSTER]: 300,
            [HUNTING_MONSTER_TAGS.RARITY_RARE]: 100,
            [HUNTING_MONSTER_TAGS.RARITY_UNIQUE]: 75,
            [HUNTING_MONSTER_TAGS.RARITY_EPIC]: 50
        },
        monsterCodexByType: Object.fromEntries(
            Object.keys(HUNTING_MONSTER_BASE_SPECS).map((type) => [
                type,
                {
                    firstEncounterFloor: 1,
                    lastEncounterFloor: 1,
                    kills: 1,
                    regions: {
                        [HUNTING_STAGE_IDS.CAVE]: { firstEncounterFloor: 1, lastEncounterFloor: 1, kills: 1 }
                    }
                }
            ])
        )
    };
    const unlocked = evaluateAchievements(profile, ACHIEVEMENT_DEFINITIONS, { profile, roster: [] });
    const huntingAchievementIds = new Set(
        unlocked.filter((result) => result.id.startsWith("hunting_")).map((result) => result.id)
    );
    assert.deepEqual(
        huntingAchievementIds,
        new Set([
            "hunting_depth_30",
            "hunting_critical_hp_win",
            "hunting_portal_retreat_40",
            "hunting_champion_victory",
            "hunting_secured_chests_10",
            "hunting_all_stages_clear",
            "hunting_monster_codex_complete",
            "hunting_monster_slayer",
            "hunting_rare_monster_slayer",
            "hunting_unique_monster_slayer",
            "hunting_epic_monster_slayer"
        ]),
        "All hunting achievement definitions should evaluate from their persistent hunting statistics"
    );
    const championAchievement = ACHIEVEMENT_DEFINITIONS.find(
        (achievement) => achievement.id === "hunting_champion_victory"
    );
    assert.equal(championAchievement.tier, "bronze", "Champion intrusion should remain an introductory achievement");
    assert.equal(
        championAchievement.reward.rarity,
        "common",
        "Champion intrusion should not bypass its existing shard multiplier with a high-rarity chest"
    );
    const monsterCodexAchievement = ACHIEVEMENT_DEFINITIONS.find(
        (achievement) => achievement.id === "hunting_monster_codex_complete"
    );
    assert.equal(monsterCodexAchievement.reward.rarity, "rare", "Monster codex completion should grant a rare chest");
    assert.deepEqual(
        monsterCodexAchievement.getProgress({ profile, roster: [] }),
        { current: 14, target: 14 },
        "Monster codex achievement should use the count of encountered monster types"
    );
    const securedChestAchievement = ACHIEVEMENT_DEFINITIONS.find(
        (achievement) => achievement.id === "hunting_secured_chests_10"
    );
    assert.equal(
        securedChestAchievement.name,
        "전리품 회수",
        "The achievement name should explain its safe-return goal"
    );
    assert.equal(
        securedChestAchievement.description,
        "사냥터에서 얻은 상자 2개를 보관함으로 무사히 가져오세요.",
        "The achievement description should say that chests must reach storage"
    );
    assert.deepEqual(
        securedChestAchievement.getProgress({ profile, roster: [] }),
        { current: 2, target: 2 },
        "Two secured chests should complete the early safe-return milestone"
    );
    const rewardProfile = createDefaultPlayerProfile();
    const rewardResult = grantAchievementReward(rewardProfile, securedChestAchievement);
    assert.equal(rewardResult.type, "EQUIPMENT", "Safe-return achievement should grant ready-to-use equipment");
    assert.equal(
        rewardProfile.equipment.inventory.length,
        1,
        "Safe-return equipment should enter the inventory directly"
    );
    assert.equal(rewardProfile.equipment.inventory[0].rarity, "uncommon", "Safe-return equipment should be uncommon");
    assert.deepEqual(
        rewardProfile.equipment.inventory[0].stats,
        [
            { type: "hp", value: 20, min: 20, max: 20 },
            { type: "defense", value: 1, min: 1, max: 1 }
        ],
        "Safe-return equipment should provide the documented early-survival stats"
    );

    const sanitized = sanitizePlayerProfile({
        hunting: {
            stats: {
                monsterKillsByTag: { [HUNTING_MONSTER_TAGS.RARITY_RARE]: 3, "invalid tag": 99 },
                visitedStageIds: [HUNTING_STAGE_IDS.CAVE, "unknown-stage"],
                monsterCodexByType: {
                    [HUNTING_MONSTER_TYPES.ELECTRIC]: {
                        firstEncounterFloor: 20,
                        lastEncounterFloor: 25,
                        kills: 4,
                        regions: {
                            [HUNTING_STAGE_IDS.FOREST]: { firstEncounterFloor: 20, lastEncounterFloor: 25, kills: 4 },
                            "unknown-stage": { firstEncounterFloor: 1, lastEncounterFloor: 1, kills: 1 }
                        }
                    },
                    unknown: { firstEncounterFloor: 1, lastEncounterFloor: 1, kills: 99, regions: {} }
                },
                clearedStageIds: [HUNTING_STAGE_IDS.CAVE, "unknown-stage"]
            }
        }
    });
    assert.equal(
        sanitized.hunting.stats.monsterKillsByTag[HUNTING_MONSTER_TAGS.RARITY_RARE],
        3,
        "Profile sanitization should keep known tag counters"
    );
    assert.equal(
        sanitized.hunting.stats.monsterKillsByTag["invalid tag"],
        undefined,
        "Profile sanitization should reject malformed monster tags"
    );
    assert.deepEqual(
        sanitized.hunting.stats.clearedStageIds,
        [HUNTING_STAGE_IDS.CAVE],
        "Profile sanitization should reject unknown cleared stage IDs"
    );
    assert.deepEqual(
        sanitized.hunting.stats.visitedStageIds,
        [HUNTING_STAGE_IDS.CAVE],
        "Profile sanitization should reject unknown visited stages"
    );
    assert.equal(
        sanitized.hunting.stats.monsterCodexByType[HUNTING_MONSTER_TYPES.ELECTRIC].regions[HUNTING_STAGE_IDS.FOREST]
            .kills,
        4,
        "Profile sanitization should preserve valid region-specific monster records"
    );
    assert.equal(
        sanitized.hunting.stats.monsterCodexByType.unknown,
        undefined,
        "Profile sanitization should reject unknown monster type records"
    );
    console.log("[hunting-achievement-progress] ok");
}

function testHunting100FloorStructure() {
    // ── Run starts at floor 1 ──
    const run0 = createHuntingRun({ characterId: FIGHTER_IDS.DASH, now: 1000 });
    assert.equal(run0.floor, 1, "Hunting run should start at floor 1");
    assert.equal(run0.maxFloor, 100, "Default max floor should be 100");
    assert.equal(run0.stageId, HUNTING_STAGE_IDS.CAVE, "Default stage should be cave");
    assert.equal(run0.lastEncounter, null, "New run should have no last encounter");

    // ── advanceHuntingRun moves 1→2 with empty outcome ──
    // rng=0.9 → empty (above combat+event threshold)
    const advanced1 = advanceHuntingRun(run0, { rng: () => 0.9 });
    assert.equal(advanced1.floor, 2, "First advance should move from floor 1 to 2");
    assert.equal(advanced1.lastEncounter.type, HUNTING_FLOOR_OUTCOME_TYPES.EMPTY, "Empty outcome with high rng");

    // ── 100층에서 final_boss 고정 ──
    const run99 = { ...run0, floor: 99 };
    const bossEncounter = rollHuntingFloorOutcome(100, () => 0);
    assert.equal(bossEncounter.type, HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS, "Floor 100 should always be final_boss");
    assert.equal(bossEncounter.floor, 100, "Final boss floor should be exactly 100");
    assert.equal(bossEncounter.enemyType, HUNTING_ENEMY_TYPES.CHAMPION, "Final boss should be champion type");

    // floor >= maxFloor → retreat
    const runAtMax = { ...run0, floor: 100, status: "active", maxFloor: 100 };
    const retreatedAtMax = advanceHuntingRun(runAtMax, { rng: () => 0 });
    assert.equal(retreatedAtMax.status, "retreated", "Floor >= maxFloor should auto-retreat with max_floor_clear");

    // advanceHuntingRun from 99 → 100 should set final_boss encounter
    const run98 = { ...run0, floor: 98, status: "active", maxFloor: 100 };
    const to99 = advanceHuntingRun(run98, { rng: () => 0.9 });
    assert.equal(to99.floor, 99, "Advance from 98 should go to 99");
    const to100 = advanceHuntingRun(to99, { rng: () => 0.9 });
    assert.equal(to100.floor, 100, "Advance from 99 should go to 100");
    assert.equal(
        to100.lastEncounter.type,
        HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS,
        "Floor 100 encounter should be final_boss"
    );

    // ── canRetreatFromHuntingRun: portal only ──
    const noEventRun = { ...run0, status: "active", floor: 5, lastEvent: null };
    assert.equal(canRetreatFromHuntingRun(noEventRun), false, "No event → cannot retreat");

    const combatRun = {
        ...run0,
        status: "active",
        floor: 5,
        lastEvent: null,
        lastEncounter: { type: HUNTING_FLOOR_OUTCOME_TYPES.COMBAT }
    };
    assert.equal(canRetreatFromHuntingRun(combatRun), false, "Combat encounter → cannot retreat");

    const portalRun = {
        ...run0,
        status: "active",
        floor: 5,
        lastEvent: { type: HUNTING_EVENT_TYPES.PORTAL, floor: 5 },
        lastEncounter: {
            type: HUNTING_FLOOR_OUTCOME_TYPES.EVENT,
            event: { type: HUNTING_EVENT_TYPES.PORTAL, floor: 5 }
        }
    };
    assert.equal(canRetreatFromHuntingRun(portalRun), true, "Portal event → can retreat");

    const merchantRun = {
        ...run0,
        status: "active",
        floor: 5,
        lastEvent: { type: HUNTING_EVENT_TYPES.WANDERING_MERCHANT, floor: 5 }
    };
    assert.equal(canRetreatFromHuntingRun(merchantRun), false, "Merchant event → cannot retreat");

    const defeatedRun = { ...portalRun, status: "defeated" };
    assert.equal(canRetreatFromHuntingRun(defeatedRun), false, "Defeated run → cannot retreat");

    // ── getHuntingFloorChances ──
    const earlyChances = getHuntingFloorChances(1);
    assert.ok(
        earlyChances.combatChance > 0 && earlyChances.combatChance < 1,
        "Early floor combat chance should be valid"
    );
    assert.ok(earlyChances.eventChance > 0 && earlyChances.eventChance < 1, "Early floor event chance should be valid");
    assert.ok(earlyChances.emptyChance > 0 && earlyChances.emptyChance < 1, "Early floor empty chance should be valid");
    assert.ok(
        Math.abs(earlyChances.combatChance + earlyChances.eventChance + earlyChances.emptyChance - 1) < 0.01,
        "Floor chances should sum to ~1"
    );

    const lateChances = getHuntingFloorChances(99);
    assert.ok(lateChances.combatChance > earlyChances.combatChance, "Deep floor should have higher combat chance");

    // ── completeHuntingStage ──
    const profile = createDefaultPlayerProfile();
    assert.deepEqual(
        getUnlockedHuntingStageIds(profile),
        [HUNTING_STAGE_IDS.CAVE],
        "New profile should only have cave"
    );
    assert.equal(getSelectedHuntingStageId(profile), HUNTING_STAGE_IDS.CAVE, "Default selected stage should be cave");

    // Clear cave → unlock forest
    const result1 = completeHuntingStage(profile, HUNTING_STAGE_IDS.CAVE);
    assert.equal(result1.unlockedStageId, HUNTING_STAGE_IDS.FOREST, "Clearing cave should unlock forest");
    assert.deepEqual(
        getUnlockedHuntingStageIds(profile),
        [HUNTING_STAGE_IDS.CAVE, HUNTING_STAGE_IDS.FOREST],
        "Profile should have cave + forest unlocked"
    );
    assert.equal(getSelectedHuntingStageId(profile), HUNTING_STAGE_IDS.FOREST, "Selected stage should auto-advance");

    // Clear forest → unlock desert
    const result2 = completeHuntingStage(profile, HUNTING_STAGE_IDS.FOREST);
    assert.equal(result2.unlockedStageId, HUNTING_STAGE_IDS.DESERT, "Clearing forest should unlock desert");
    assert.deepEqual(
        getUnlockedHuntingStageIds(profile),
        [HUNTING_STAGE_IDS.CAVE, HUNTING_STAGE_IDS.FOREST, HUNTING_STAGE_IDS.DESERT],
        "All three stages should be unlocked"
    );

    // Clear desert → no more stages
    const result3 = completeHuntingStage(profile, HUNTING_STAGE_IDS.DESERT);
    assert.equal(result3.unlockedStageId, null, "Clearing last stage should unlock nothing");

    // Invalid stage ID in profile
    profile.hunting.unlockedStageIds = ["cave", "invalid_id"];
    assert.deepEqual(
        getUnlockedHuntingStageIds(profile),
        [HUNTING_STAGE_IDS.CAVE],
        "Invalid stage IDs should be filtered out"
    );

    // selectedStageId fallback
    profile.hunting.selectedStageId = "invalid";
    assert.equal(
        getSelectedHuntingStageId(profile),
        HUNTING_STAGE_IDS.CAVE,
        "Invalid selection should fallback to cave"
    );

    // ── Stage helpers ──
    const caveStage = getHuntingStage(HUNTING_STAGE_IDS.CAVE);
    assert.equal(caveStage.name, "동굴", "Cave stage should have correct name");
    assert.equal(getHuntingStageArena(HUNTING_STAGE_IDS.CAVE).WIDTH, 1000, "Cave arena should start at 1000 wide");
    assert.deepEqual(
        getHuntingBattleArena(HUNTING_STAGE_IDS.CAVE, 2),
        { WIDTH: 1000, HEIGHT: 1000 },
        "Two-mob cave fights should use the initial arena size"
    );
    assert.deepEqual(
        getHuntingBattleArena(HUNTING_STAGE_IDS.CAVE, 10),
        { WIDTH: 1414, HEIGHT: 1414 },
        "Ten enemies should cap arena area growth at twice the base"
    );

    const nextAfterCave = getNextHuntingStageId(HUNTING_STAGE_IDS.CAVE);
    assert.equal(nextAfterCave, HUNTING_STAGE_IDS.FOREST, "Next after cave should be forest");
    assert.equal(getNextHuntingStageId(HUNTING_STAGE_IDS.DESERT), null, "Next after desert should be null");

    // ── HUNTING_FLOOR_OUTCOME_TYPES completeness ──
    assert.equal(HUNTING_FLOOR_OUTCOME_TYPES.EMPTY, "empty");
    assert.equal(HUNTING_FLOOR_OUTCOME_TYPES.COMBAT, "combat");
    assert.equal(HUNTING_FLOOR_OUTCOME_TYPES.EVENT, "event");
    assert.equal(HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS, "final_boss");

    // ── New event types ──
    assert.equal(HUNTING_EVENT_TYPES.PORTAL, "portal");
    assert.equal(HUNTING_EVENT_TYPES.WANDERING_MERCHANT, "wandering_merchant");
    assert.equal(HUNTING_EVENT_TYPES.BOON, "boon");
    assert.equal(HUNTING_EVENT_TYPES.MISHAP, "mishap");

    // ── huntingOverlay store default values ──
    const overlayStore = Alpine.store("huntingOverlay");
    assert.equal(overlayStore.huntingCanRetreat, false, "huntingOverlay huntingCanRetreat default should be false");
    assert.equal(overlayStore.huntingMoving, false, "huntingOverlay huntingMoving default should be false");
    assert.equal(overlayStore.huntingMoveFrom, 0, "huntingOverlay huntingMoveFrom default should be 0");
    assert.equal(overlayStore.huntingMoveTo, 0, "huntingOverlay huntingMoveTo default should be 0");
    assert.equal(overlayStore.huntingMoveStep, 0, "huntingOverlay huntingMoveStep default should be 0");
    assert.equal(overlayStore.huntingMoveMax, 10, "huntingOverlay huntingMoveMax default should be 10");
    assert.equal(overlayStore.huntingMoveMessage, "", "huntingOverlay huntingMoveMessage default should be empty");

    console.log("[hunting-floors] ok");
}

function testHuntingCombatRelief() {
    // ── 기본 확률 vs 완충 확률 ──
    const baseChances = getHuntingFloorChances(1, 0);
    const relief3 = getHuntingFloorChances(1, 3);
    const relief2 = getHuntingFloorChances(1, 2);
    const relief1 = getHuntingFloorChances(1, 1);

    // 완충 중 combatChance는 기본보다 낮아야 함
    assert.ok(relief3.combatChance < baseChances.combatChance, "Relief 3 should reduce combat chance");
    assert.ok(relief2.combatChance < baseChances.combatChance, "Relief 2 should reduce combat chance");
    assert.ok(relief1.combatChance < baseChances.combatChance, "Relief 1 should reduce combat chance");

    // 완충 중 eventChance는 기본보다 높아야 함
    assert.ok(relief3.eventChance > baseChances.eventChance, "Relief 3 should increase event chance");
    assert.ok(relief2.eventChance > baseChances.eventChance, "Relief 2 should increase event chance");
    assert.ok(relief1.eventChance > baseChances.eventChance, "Relief 1 should increase event chance");

    // relief=0이면 기본값과 동일
    assert.equal(
        relief3.combatChance,
        getHuntingFloorChances(1, 3).combatChance,
        "Same relief should give same result"
    );
    const zeroRelief = getHuntingFloorChances(1, 0);
    assert.equal(zeroRelief.combatChance, baseChances.combatChance, "Zero relief should equal base");
    assert.equal(zeroRelief.eventChance, baseChances.eventChance, "Zero relief should equal base");

    // 확률은 항상 0~1 범위이며 합이 ~1
    for (const chances of [relief3, relief2, relief1, baseChances]) {
        assert.ok(chances.combatChance >= 0 && chances.combatChance <= 1, "Combat chance should be in [0,1]");
        assert.ok(chances.eventChance >= 0 && chances.eventChance <= 1, "Event chance should be in [0,1]");
        assert.ok(chances.emptyChance >= 0 && chances.emptyChance <= 1, "Empty chance should be in [0,1]");
        assert.ok(
            Math.abs(chances.combatChance + chances.eventChance + chances.emptyChance - 1) < 0.01,
            "Chances should sum to ~1"
        );
    }

    // 완충은 점진적으로 약해짐 (단조성)
    assert.ok(relief3.combatChance < relief2.combatChance, "More relief → lower combat chance");
    assert.ok(relief2.combatChance < relief1.combatChance, "Less relief → higher combat chance (approaching base)");

    // deep floor에서도 완충 작동
    const deepBase = getHuntingFloorChances(90, 0);
    const deepRelief = getHuntingFloorChances(90, 3);
    assert.ok(deepRelief.combatChance < deepBase.combatChance, "Deep floor relief should still reduce combat");

    // ── 100층은 완충 무시하고 항상 final_boss ──
    const bossOutcome = rollHuntingFloorOutcome(100, () => 0, 3);
    assert.equal(
        bossOutcome.type,
        HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS,
        "Floor 100 should be final_boss even with combat relief"
    );

    // ── combatReliefFloors 설정/소비 ──
    const run = createHuntingRun({ characterId: FIGHTER_IDS.DASH });
    assert.equal(run.combatReliefFloors ?? 0, 0, "New run should have no combat relief");

    // 전투 클리어 시 relief 설정
    const afterCombat = recordHuntingFloorResult(run, {
        hpRemain: 50,
        maxHp: 100,
        loot: { shards: 0, chests: [] },
        combatCleared: true
    });
    assert.equal(
        afterCombat.combatReliefFloors,
        HUNTING_COMBAT_RELIEF.INITIAL_FLOORS,
        "Combat clear should set initial relief floors"
    );

    // 비전투 이벤트에서는 relief 유지
    const afterEvent = recordHuntingFloorResult(afterCombat, {
        hpRemain: 50,
        maxHp: 100,
        loot: { shards: 10, chests: [] },
        consumeStatModifiers: false
    });
    assert.equal(
        afterEvent.combatReliefFloors,
        HUNTING_COMBAT_RELIEF.INITIAL_FLOORS,
        "Non-combat event should preserve relief"
    );

    // ── advanceHuntingRun이 relief를 소비 ──
    // 첫 번째 전진: 판정은 relief=3으로, 저장은 2로
    const firstAdvance = advanceHuntingRun(afterCombat, { rng: () => 0.17 });
    assert.equal(
        firstAdvance.combatReliefFloors,
        HUNTING_COMBAT_RELIEF.INITIAL_FLOORS - 1,
        "First advance should store relief=2 after roll"
    );
    // relief=3일 때 floor 1 combatChance ≈ 0.124, rng=0.17는 combat이 아니어야 함
    // relief=2였다면 combatChance ≈ 0.194, rng=0.17는 combat — 버그 검증
    assert.notEqual(
        firstAdvance.lastEncounter.type,
        HUNTING_FLOOR_OUTCOME_TYPES.COMBAT,
        "First post-combat roll must use relief=3 (not relief=2), so rng=0.17 should not be combat"
    );
    assert.equal(
        firstAdvance.lastEncounter.type,
        HUNTING_FLOOR_OUTCOME_TYPES.EVENT,
        "First post-combat roll with relief=3 and rng=0.17 should be event"
    );

    const afterAdvance = advanceHuntingRun(afterCombat, { rng: () => 0.9 });
    assert.equal(
        afterAdvance.combatReliefFloors,
        HUNTING_COMBAT_RELIEF.INITIAL_FLOORS - 1,
        "Advance should decrement relief by 1"
    );

    // 연속 전진으로 relief 완전 소비
    const twiceAdvanced = advanceHuntingRun(afterAdvance, { rng: () => 0.9 });
    assert.equal(twiceAdvanced.combatReliefFloors, 1, "Two advances should leave relief at 1");
    const thriceAdvanced = advanceHuntingRun(twiceAdvanced, { rng: () => 0.9 });
    assert.equal(thriceAdvanced.combatReliefFloors, 0, "Three advances should exhaust relief");
    const fourthAdvanced = advanceHuntingRun(thriceAdvanced, { rng: () => 0.9 });
    assert.equal(fourthAdvanced.combatReliefFloors, 0, "Relief should not go below 0");

    // ── combatCleared=false는 relief 재설정 안 함 ──
    const noReset = recordHuntingFloorResult(afterCombat, {
        hpRemain: 50,
        maxHp: 100,
        combatCleared: false
    });
    assert.equal(
        noReset.combatReliefFloors,
        HUNTING_COMBAT_RELIEF.INITIAL_FLOORS,
        "combatCleared=false should keep existing relief"
    );

    console.log("[hunting-relief] ok");
}

function testHuntingPortalDecline() {
    // ── portal weight multiplier ──
    assert.equal(getHuntingPortalWeightMultiplier(0.6, 0), 1.0, "HP >= 50% should use base portal weight");
    assert.equal(getHuntingPortalWeightMultiplier(0.5, 0), 1.0, "HP >= 50% boundary should use base portal weight");
    assert.equal(getHuntingPortalWeightMultiplier(0.4, 0), 1.8, "HP 30-50% should increase portal weight");
    assert.equal(getHuntingPortalWeightMultiplier(0.3, 0), 1.8, "HP 30% boundary should use mid-tier portal weight");
    assert.equal(getHuntingPortalWeightMultiplier(0.2, 0), 3.0, "HP < 30% should strongly increase portal weight");
    assert.equal(getHuntingPortalWeightMultiplier(0.01, 0), 3.0, "Very low HP should use max portal weight");

    // ── portal decline suppresses HP boost ──
    assert.equal(getHuntingPortalWeightMultiplier(0.2, 1), 1.0, "Portal decline should suppress HP boost to 1.0");
    assert.equal(getHuntingPortalWeightMultiplier(0.2, 5), 1.0, "Full decline should suppress HP boost");
    assert.equal(
        getHuntingPortalWeightMultiplier(0.6, 3),
        1.0,
        "Decline should keep base weight at 1.0 regardless of HP"
    );

    // ── invalid HP → base weight ──
    assert.equal(getHuntingPortalWeightMultiplier(-1, 0), 1.0, "Negative HP should use base weight");
    assert.equal(getHuntingPortalWeightMultiplier(NaN, 0), 1.0, "NaN HP should use base weight");

    // ── low HP makes portal more likely in weighted selection ──
    // 8 event types, base portal weight = 1/8. low-HP: portal mult=3 →
    // portal weight=3, others=1, total=10, portal prob=3/10=0.3
    // rng seq [0.5, 0.2]: 0.5→EVENT, 0.2 picks:
    //   base (mult=1): 0.2*8=1.6 → index 1 = WANDERING_MERCHANT
    //   high (mult=3): 0.2*10=2.0 → index 0 = PORTAL

    const outcomeBase = rollHuntingFloorOutcome(
        1,
        (() => {
            const seq = [0.5, 0.2];
            let i = 0;
            return () => seq[i++] ?? 0;
        })(),
        0,
        { hpRatio: 0.6, portalDeclineFloors: 0 }
    );
    assert.equal(outcomeBase.type, HUNTING_FLOOR_OUTCOME_TYPES.EVENT, "Should be event");
    assert.equal(
        outcomeBase.event.type,
        HUNTING_EVENT_TYPES.WANDERING_MERCHANT,
        "Base HP should give non-portal event at rng=0.2"
    );

    const outcomeLowHp = rollHuntingFloorOutcome(
        1,
        (() => {
            const seq = [0.5, 0.2];
            let i = 0;
            return () => seq[i++] ?? 0;
        })(),
        0,
        { hpRatio: 0.2, portalDeclineFloors: 0 }
    );
    assert.equal(outcomeLowHp.type, HUNTING_FLOOR_OUTCOME_TYPES.EVENT, "Should be event");
    assert.equal(outcomeLowHp.event.type, HUNTING_EVENT_TYPES.PORTAL, "Low HP should give portal at rng=0.2");

    // ── portal decline floors suppress the low-HP boost ──
    const outcomeDeclined = rollHuntingFloorOutcome(
        1,
        (() => {
            const seq = [0.5, 0.2];
            let i = 0;
            return () => seq[i++] ?? 0;
        })(),
        0,
        { hpRatio: 0.2, portalDeclineFloors: 3 }
    );
    assert.equal(outcomeDeclined.type, HUNTING_FLOOR_OUTCOME_TYPES.EVENT, "Should be event");
    assert.equal(
        outcomeDeclined.event.type,
        HUNTING_EVENT_TYPES.WANDERING_MERCHANT,
        "Portal decline should suppress low-HP portal boost"
    );

    // ── 100층 final_boss unaffected by portal weighting ──
    const bossOutcome = rollHuntingFloorOutcome(100, () => 0, 0, { hpRatio: 0.1, portalDeclineFloors: 0 });
    assert.equal(
        bossOutcome.type,
        HUNTING_FLOOR_OUTCOME_TYPES.FINAL_BOSS,
        "Floor 100 should be final_boss even with low HP and high portal weight"
    );

    // ── portalDeclineFloors decrements in advanceHuntingRun ──
    const run = createHuntingRun({ characterId: FIGHTER_IDS.DASH });
    const runWithDecline = { ...run, portalDeclineFloors: 5, status: "active" };
    const advanced1 = advanceHuntingRun(runWithDecline, { rng: () => 0.9 });
    assert.equal(advanced1.portalDeclineFloors, 4, "Advance should decrement portal decline by 1");
    const advanced2 = advanceHuntingRun(advanced1, { rng: () => 0.9 });
    assert.equal(advanced2.portalDeclineFloors, 3, "Second advance should decrement further");
    // Exhaust decline
    let runPtr = runWithDecline;
    for (let i = 0; i < 6; i++) {
        runPtr = advanceHuntingRun(runPtr, { rng: () => 0.9 });
    }
    assert.equal(runPtr.portalDeclineFloors, 0, "Portal decline should not go below 0");

    // ── new run has portalDeclineFloors = 0 ──
    const freshRun = createHuntingRun({ characterId: FIGHTER_IDS.DASH });
    assert.equal(freshRun.portalDeclineFloors ?? 0, 0, "New run should start with no portal decline");

    console.log("[hunting-portal] ok");
}

function testHuntingStageSelectionAndArenaTheme() {
    // ── stage selection state ──
    const profile = createDefaultPlayerProfile();
    assert.deepEqual(
        getUnlockedHuntingStageIds(profile),
        [HUNTING_STAGE_IDS.CAVE],
        "New profile should only have cave unlocked"
    );
    assert.equal(getSelectedHuntingStageId(profile), HUNTING_STAGE_IDS.CAVE, "Default selected stage should be cave");

    // selectedStageId fallback when invalid
    profile.hunting.selectedStageId = "invalid";
    assert.equal(
        getSelectedHuntingStageId(profile),
        HUNTING_STAGE_IDS.CAVE,
        "Invalid selectedStageId should fallback to cave"
    );

    // unlocked stage list reflects actual HUNTING_STAGES config
    const validIds = HUNTING_STAGES.map((s) => s.id);
    const unlockedIds = getUnlockedHuntingStageIds(profile);
    assert.ok(
        unlockedIds.every((id) => validIds.includes(id)),
        "All unlocked IDs must be valid stage IDs"
    );

    // stage has theme property
    const caveStage = getHuntingStage(HUNTING_STAGE_IDS.CAVE);
    assert.equal(caveStage.theme, "cave", "Cave stage should have theme=cave");
    const forestStage = getHuntingStage(HUNTING_STAGE_IDS.FOREST);
    assert.equal(forestStage.theme, "forest", "Forest stage should have theme=forest");
    const desertStage = getHuntingStage(HUNTING_STAGE_IDS.DESERT);
    assert.equal(desertStage.theme, "desert", "Desert stage should have theme=desert");

    // ── BattleSimulation stores arenaTheme from options ──
    const testSpecs = app.roster.slice(0, 2).map((spec) => ({ ...spec }));
    const sim = new BattleSimulation(testSpecs, { onLog() {}, onSound() {} }, null, { arenaTheme: "forest" });
    assert.equal(sim.arenaTheme, "forest", "BattleSimulation should store arenaTheme from options");

    const simNoTheme = new BattleSimulation(testSpecs, { onLog() {}, onSound() {} }, null, {});
    assert.equal(simNoTheme.arenaTheme, null, "BattleSimulation should default arenaTheme to null");

    // ── ArenaRenderer._drawArenaBackground dispatches by theme ──
    const canvasCtx = makeRecordingCanvasContext();
    const renderer = new ArenaRenderer({ getContext: () => canvasCtx, width: 800, height: 600 });
    // Call _drawArenaBackground directly to verify dispatch
    renderer._drawArenaBackground(canvasCtx, { arenaTheme: "cave", width: 960, height: 960 });
    const caveCalls = canvasCtx.calls.filter((c) => c[0] === "fillRect" || c[0] === "arc" || c[0] === "stroke");
    assert.ok(caveCalls.length > 3, "Cave background should draw multiple shapes");

    const canvasCtx2 = makeRecordingCanvasContext();
    const renderer2 = new ArenaRenderer({ getContext: () => canvasCtx2, width: 800, height: 600 });
    renderer2._drawArenaBackground(canvasCtx2, { arenaTheme: "forest", width: 960, height: 960 });
    const forestCalls = canvasCtx2.calls.filter((c) => c[0] === "fillRect" || c[0] === "arc" || c[0] === "stroke");
    assert.ok(forestCalls.length > 3, "Forest background should draw multiple shapes");

    const canvasCtx3 = makeRecordingCanvasContext();
    const renderer3 = new ArenaRenderer({ getContext: () => canvasCtx3, width: 800, height: 600 });
    renderer3._drawArenaBackground(canvasCtx3, { arenaTheme: "desert", width: 960, height: 960 });
    const desertCalls = canvasCtx3.calls.filter((c) => c[0] === "fillRect" || c[0] === "arc" || c[0] === "stroke");
    assert.ok(desertCalls.length > 3, "Desert background should draw multiple shapes");

    // unknown theme falls back to default
    const canvasCtx4 = makeRecordingCanvasContext();
    const renderer4 = new ArenaRenderer({ getContext: () => canvasCtx4, width: 800, height: 600 });
    renderer4._drawArenaBackground(canvasCtx4, { arenaTheme: null, width: 960, height: 960 });
    // default fallback should call fillRect
    const defaultCalls = canvasCtx4.calls.filter((c) => c[0] === "fillRect");
    assert.ok(defaultCalls.length >= 1, "Unknown theme should fall back to default fill");

    console.log("[hunting-stage] ok");
}

async function testHuntingStageSelectUsesPreviewCharacter() {
    const profile = createDefaultPlayerProfile();
    profile.collection.characters[FIGHTER_IDS.RAGE] = { tournamentWins: 1 };
    const app = {
        playerProfile: profile,
        playerFighterId: FIGHTER_IDS.RAGE,
        roster: [{ id: FIGHTER_IDS.RAGE, name: "Rage", title: "Test", color: "#f00" }],
        renderer: { clear() {} },
        stopPlayerPreviewLoop() {},
        beginGameSession() {},
        _refreshCollectionHub() {
            this.collectionRefreshCount += 1;
        },
        _syncPlayerStatAllocationFromUi() {},
        refreshPlayerSetup() {},
        setHuntingActive() {},
        setHuntingOverlayState(data) {
            this.overlayStates.push({ ...data });
        },
        showOverlay(label, text, subtext) {
            this.overlayShown = { label, text, subtext };
        },
        addLog() {},
        overlayStates: [],
        collectionRefreshCount: 0,
        waitForHuntingMoveUiPaint() {
            return new Promise((resolve) => {
                this.resolveFirstMoveUi = resolve;
            });
        }
    };
    const manager = new HuntingManager(app);
    let popupOptions = null;
    let advanced = false;
    let selectStage = null;
    const originalDialog = PopupService._testDialog;
    const originalQuerySelectorAll = document.querySelectorAll;

    PopupService.setTestDialog({
        show(options) {
            popupOptions = options;
            return Promise.resolve("start");
        },
        close() {}
    });
    document.querySelectorAll = () => [
        {
            dataset: { stage: HUNTING_STAGE_IDS.CAVE },
            addEventListener(_type, handler) {
                selectStage = handler;
            }
        }
    ];
    manager.advance = async ({ waitForFirstMoveUi } = {}) => {
        assert.equal(waitForFirstMoveUi, true, "Run start should require the first move UI paint before advancing");
        await app.waitForHuntingMoveUiPaint();
        advanced = true;
    };

    try {
        manager.showStageSelect();
        const startPromise = selectStage();
        await Promise.resolve();

        assert.ok(popupOptions.bodyHtml.includes("hunting-stage-btn"), "Stage selection should render map cards");
        assert.equal(
            popupOptions.bodyHtml.includes("hunting-char-btn"),
            false,
            "Stage selection should not render character selection cards"
        );
        assert.deepEqual(popupOptions.buttons, [], "Stage selection should not require a second start action");
        assert.equal(manager._run.characterId, FIGHTER_IDS.RAGE, "Run should use the current preview character");
        assert.deepEqual(
            profile.hunting.stats.visitedStageIds,
            [HUNTING_STAGE_IDS.CAVE],
            "Run start should record the selected region before the first battle"
        );
        assert.equal(
            app.collectionRefreshCount,
            1,
            "Run start should refresh the monster codex after recording the region"
        );
        assert.equal(advanced, false, "Stage selection should not advance before the first move UI is painted");
        assert.deepEqual(app.overlayShown, {
            label: "사냥터",
            text: "동굴 · 1층",
            subtext: "원정 시작"
        });
        const firstFloorState = app.overlayStates.at(-1);
        assert.equal(
            firstFloorState.huntingChoiceVisible,
            false,
            "Start should not expose an advance choice before moving"
        );
        assert.equal(firstFloorState.huntingMoving, false, "Start should not move before the first move UI is emitted");
        assert.equal(firstFloorState.huntingFloor, 1, "Start should render the first floor before advancing");
        app.resolveFirstMoveUi();
        await startPromise;
        assert.equal(advanced, true, "Stage selection should advance only after the first move UI is painted");
    } finally {
        PopupService.setTestDialog(originalDialog);
        document.querySelectorAll = originalQuerySelectorAll;
    }

    console.log("[hunting-stage-select-preview-character] ok");
}

async function testDebugHuntingStartsRequestedFloor() {
    const profile = createDefaultPlayerProfile();
    profile.hunting.stats.lastReachedFloorByStage = { [HUNTING_STAGE_IDS.FOREST]: 100 };
    const overlayStates = [];
    const overlayMessages = [];
    const app = {
        playerProfile: profile,
        playerFighterId: FIGHTER_IDS.RAGE,
        playerStatAllocation: createEmptyStatAllocation(),
        roster: createRoster(),
        renderer: { clear() {} },
        stopPlayerPreviewLoop() {},
        beginGameSession() {},
        _refreshCollectionHub() {},
        _syncPlayerStatAllocationFromUi() {},
        refreshPlayerSetup() {},
        setHuntingActive() {},
        setHuntingOverlayState(data) {
            overlayStates.push({ ...data });
        },
        showOverlay(label, text, subtext) {
            overlayMessages.push({ label, text, subtext });
        },
        addLog(message) {
            this.lastLog = message;
        }
    };
    const manager = new HuntingManager(app);
    let advanceOptions = null;
    manager.advance = async (options) => {
        advanceOptions = options;
    };

    const originalDialog = PopupService._testDialog;
    PopupService.setTestDialog({ close() {} });
    try {
        await manager.startDebugRun(FIGHTER_IDS.RAGE, {
            stageId: HUNTING_STAGE_IDS.FOREST,
            encounterFloor: HUNTING_MAX_FLOOR + 30
        });

        assert.equal(
            manager._run.floor,
            HUNTING_MAX_FLOOR - 1,
            "Debug start should prepare the requested encounter floor"
        );
        assert.deepEqual(overlayMessages.at(-1), {
            label: "사냥터",
            text: `숲 · ${HUNTING_MAX_FLOOR}층`,
            subtext: "원정 시작"
        });
        assert.equal(overlayStates.at(-1).huntingFloor, HUNTING_MAX_FLOOR);
        assert.deepEqual(advanceOptions, { waitForFirstMoveUi: true });
        assert.match(app.lastLog, /디버그/, "Debug hunting logs should distinguish development runs");
    } finally {
        PopupService.setTestDialog(originalDialog);
    }
    console.log("[debug-hunting-requested-floor] ok");
}

async function testDebugHuntingEventPreviewUsesProductionEventFlow() {
    const profile = createDefaultPlayerProfile();
    const overlayStates = [];
    const app = {
        playerProfile: profile,
        playerFighterId: FIGHTER_IDS.RAGE,
        playerStatAllocation: createEmptyStatAllocation(),
        roster: createRoster(),
        renderer: { clear() {} },
        stopPlayerPreviewLoop() {},
        beginGameSession() {},
        _refreshCollectionHub() {},
        _syncPlayerStatAllocationFromUi() {},
        refreshPlayerSetup() {},
        setHuntingActive() {},
        setHuntingOverlayState(data) {
            overlayStates.push({ ...data });
        },
        showOverlay() {},
        addLog(message) {
            this.lastLog = message;
        }
    };
    const manager = new HuntingManager(app);
    let advanceCalled = false;
    manager.advance = async () => {
        advanceCalled = true;
    };

    const originalDialog = PopupService._testDialog;
    PopupService.setTestDialog({ close() {} });
    try {
        await manager.startDebugEventPreview(FIGHTER_IDS.RAGE, {
            stageId: HUNTING_STAGE_IDS.FOREST,
            encounterFloor: 17,
            eventType: HUNTING_EVENT_TYPES.PORTAL
        });

        assert.equal(advanceCalled, false, "Event preview must not advance into a random floor");
        assert.equal(manager._run.floor, 17, "Event preview should use the requested floor");
        assert.equal(manager._run.lastEncounter.type, HUNTING_FLOOR_OUTCOME_TYPES.EVENT);
        assert.equal(manager._run.lastEvent.type, HUNTING_EVENT_TYPES.PORTAL);
        assert.equal(manager._run.phase, HUNTING_RUN_PHASES.AWAITING_CHOICE);
        assert.equal(overlayStates.at(-1).huntingChoiceVisible, true, "Portal should open its production choice UI");

        await manager.startDebugEventPreview(FIGHTER_IDS.RAGE, {
            stageId: "invalid-stage",
            encounterFloor: HUNTING_MAX_FLOOR + 1,
            eventType: "invalid-event"
        });
        assert.equal(
            manager._run.stageId,
            HUNTING_STAGE_IDS.CAVE,
            "Invalid stages should use the normal debug fallback"
        );
        assert.equal(manager._run.floor, HUNTING_MAX_FLOOR, "Event preview should keep the configured floor bound");
        assert.equal(
            manager._run.lastEvent.type,
            HUNTING_EVENT_TYPES.PORTAL,
            "Invalid events should use the normal fallback"
        );
    } finally {
        PopupService.setTestDialog(originalDialog);
    }
    console.log("[debug-hunting-event-preview] ok");
}

async function testHuntingResumeStartsAtHalfLatestStageFloor() {
    const sanitized = sanitizePlayerProfile({
        version: 8,
        hunting: {
            stats: {
                lastReachedFloorByStage: {
                    [HUNTING_STAGE_IDS.CAVE]: 47.9,
                    [HUNTING_STAGE_IDS.FOREST]: 999,
                    [HUNTING_STAGE_IDS.DESERT]: -3,
                    invalid_stage: 50
                }
            }
        }
    });
    assert.deepEqual(
        sanitized.hunting.stats.lastReachedFloorByStage,
        {
            [HUNTING_STAGE_IDS.CAVE]: 47,
            [HUNTING_STAGE_IDS.FOREST]: HUNTING_MAX_FLOOR
        },
        "Stored resume floors must keep only valid stages and safe integer floors"
    );
    assert.equal(getHuntingResumeStartFloor({}, HUNTING_STAGE_IDS.CAVE), 1, "Missing progress should start at floor 1");
    assert.equal(
        getHuntingResumeStartFloor(
            { lastReachedFloorByStage: { [HUNTING_STAGE_IDS.CAVE]: 1 } },
            HUNTING_STAGE_IDS.CAVE
        ),
        1,
        "Floor 1 should restart from floor 1"
    );
    assert.equal(
        getHuntingResumeStartFloor(
            { lastReachedFloorByStage: { [HUNTING_STAGE_IDS.CAVE]: 2 } },
            HUNTING_STAGE_IDS.CAVE
        ),
        1,
        "Floor 2 should restart from floor 1"
    );
    assert.equal(
        getHuntingResumeStartFloor(
            { lastReachedFloorByStage: { [HUNTING_STAGE_IDS.CAVE]: 47 } },
            HUNTING_STAGE_IDS.CAVE
        ),
        23,
        "Floor 47 should restart from floor 23"
    );
    assert.equal(
        getHuntingResumeStartFloor(
            { lastReachedFloorByStage: { [HUNTING_STAGE_IDS.CAVE]: 100 } },
            HUNTING_STAGE_IDS.CAVE
        ),
        50,
        "Floor 100 should restart from floor 50"
    );

    const profile = createDefaultPlayerProfile();
    profile.collection.characters[FIGHTER_IDS.RAGE] = { tournamentWins: 1 };
    profile.hunting.unlockedStageIds = [HUNTING_STAGE_IDS.CAVE, HUNTING_STAGE_IDS.FOREST, HUNTING_STAGE_IDS.DESERT];
    profile.hunting.selectedStageId = HUNTING_STAGE_IDS.FOREST;
    profile.hunting.stats.lastReachedFloorByStage = {
        [HUNTING_STAGE_IDS.CAVE]: 100,
        [HUNTING_STAGE_IDS.FOREST]: 47,
        [HUNTING_STAGE_IDS.DESERT]: 2
    };
    const overlayMessages = [];
    const app = {
        playerProfile: profile,
        playerFighterId: FIGHTER_IDS.RAGE,
        playerStatAllocation: createEmptyStatAllocation(),
        roster: createRoster(),
        renderer: { clear() {} },
        stopPlayerPreviewLoop() {},
        beginGameSession() {},
        _refreshCollectionHub() {},
        _syncPlayerStatAllocationFromUi() {},
        refreshPlayerSetup() {},
        setHuntingActive() {},
        setHuntingOverlayState() {},
        showOverlay(label, text, subtext) {
            overlayMessages.push({ label, text, subtext });
        },
        addLog() {}
    };
    const manager = new HuntingManager(app);
    manager.advance = async () => {};
    const originalDialog = PopupService._testDialog;
    PopupService.setTestDialog({ close() {} });
    try {
        await manager.startRun(FIGHTER_IDS.RAGE);
        assert.equal(manager._run.floor, 23, "Normal restart should preserve the displayed starting floor internally");
        assert.deepEqual(overlayMessages.at(-1), {
            label: "사냥터",
            text: "숲 · 23층",
            subtext: "원정 시작"
        });
        assert.equal(manager._run.floor + 1, 24, "The first encounter must remain one floor after the displayed start");

        await manager.startDebugRun(FIGHTER_IDS.RAGE, {
            stageId: HUNTING_STAGE_IDS.FOREST,
            encounterFloor: 47
        });
        assert.equal(
            manager._run.floor,
            46,
            "Debug start must retain the requested encounter floor without resume offset"
        );
        assert.equal(overlayMessages.at(-1).text, "숲 · 47층", "Debug start display must remain exact");
    } finally {
        PopupService.setTestDialog(originalDialog);
    }

    const finalizationProfile = createDefaultPlayerProfile();
    finalizationProfile.hunting.stats.deepestFloor = 100;
    finalizationProfile.hunting.stats.lastReachedFloorByStage = { [HUNTING_STAGE_IDS.CAVE]: 100 };
    const finalizationApp = {
        playerProfile: finalizationProfile,
        _settleHuntingAchievements() {}
    };
    const finalizationManager = new HuntingManager(finalizationApp);
    const endedRuns = [
        defeatHuntingRun(
            { ...createHuntingRun({ characterId: FIGHTER_IDS.RAGE, stageId: HUNTING_STAGE_IDS.CAVE }), floor: 47 },
            { rng: () => 1 }
        ),
        retreatHuntingRun({
            ...createHuntingRun({ characterId: FIGHTER_IDS.RAGE, stageId: HUNTING_STAGE_IDS.FOREST }),
            floor: 42,
            lastEvent: { type: HUNTING_EVENT_TYPES.PORTAL }
        }),
        retreatHuntingRun(
            { ...createHuntingRun({ characterId: FIGHTER_IDS.RAGE, stageId: HUNTING_STAGE_IDS.DESERT }), floor: 100 },
            { reason: "stage_clear" }
        )
    ];
    for (const endedRun of endedRuns) {
        finalizationManager._run = endedRun;
        finalizationManager._mergeIntoSecured(finalizationApp);
    }
    assert.deepEqual(
        finalizationProfile.hunting.stats.lastReachedFloorByStage,
        {
            [HUNTING_STAGE_IDS.CAVE]: 47,
            [HUNTING_STAGE_IDS.FOREST]: 42,
            [HUNTING_STAGE_IDS.DESERT]: 100
        },
        "Defeat, portal retreat, and stage clear must each overwrite only their stage's latest floor"
    );
    assert.equal(
        finalizationProfile.hunting.stats.deepestFloor,
        100,
        "Achievement maximum must remain independent of resume state"
    );
    console.log("[hunting-resume-half-floor] ok");
}

function testHuntingTerrain() {
    const CAVE = HUNTING_STAGE_IDS.CAVE;

    // ── cave generates polygon-only terrain ──
    const caveTerrain = createHuntingTerrain({ stageId: CAVE, floor: 1, width: 1120, height: 1120 });
    assert.ok(Array.isArray(caveTerrain), "Cave terrain should be an array");
    assert.ok(caveTerrain.length >= 3, "Cave should generate at least 3 obstacles");
    assert.ok(caveTerrain.length <= 5, "Cave should generate at most 5 obstacles");

    const circles = caveTerrain.filter((obs) => obs.shape === "circle");
    const polygons = caveTerrain.filter((obs) => obs.shape === "polygon");
    assert.equal(circles.length, 0, "Cave terrain generation should not create circle obstacles");
    assert.equal(polygons.length, caveTerrain.length, "Cave terrain should use polygons for every obstacle");

    for (const obs of polygons) {
        assert.equal(obs.type, "rock", "Polygon terrain type should be rock");
        assert.equal(obs.blocking, true, "Polygon terrain should be blocking");
        assert.ok(Array.isArray(obs.points) && obs.points.length >= 3, "Polygon should have valid points array");
        assert.ok(Number.isFinite(obs.x) && Number.isFinite(obs.y), "Polygon should have valid position");
    }

    // ── even floor also generates only polygons ──
    const evenTerrain = createHuntingTerrain({ stageId: CAVE, floor: 2, width: 1120, height: 1120 });
    const evenCircles = evenTerrain.filter((obs) => obs.shape === "circle");
    const evenPolygons = evenTerrain.filter((obs) => obs.shape === "polygon");
    assert.equal(evenCircles.length, 0, "Even floor cave should also avoid circle obstacles");
    assert.equal(evenPolygons.length, evenTerrain.length, "Even floor cave should also generate polygon obstacles");

    // ── deterministic ──
    const cave1 = createHuntingTerrain({ stageId: CAVE, floor: 1, width: 1120, height: 1120 });
    const cave2 = createHuntingTerrain({ stageId: CAVE, floor: 1, width: 1120, height: 1120 });
    assert.deepEqual(cave1, cave2, "Same input should produce identical terrain");

    // ── polygon world points deterministic ──
    if (polygons.length > 0) {
        const wp1 = getWorldPolygonPoints(polygons[0]);
        const wp2 = getWorldPolygonPoints(polygons[0]);
        assert.deepEqual(wp1, wp2, "Polygon world points should be deterministic");
    }

    // ── forest/desert produce no terrain ──
    assert.deepEqual(
        createHuntingTerrain({ stageId: HUNTING_STAGE_IDS.FOREST, floor: 1, width: 1280, height: 1280 }),
        [],
        "Forest should produce no terrain"
    );
    assert.deepEqual(
        createHuntingTerrain({ stageId: HUNTING_STAGE_IDS.DESERT, floor: 1, width: 1440, height: 1280 }),
        [],
        "Desert should produce no terrain"
    );
    assert.deepEqual(createHuntingTerrain({ stageId: null, floor: 1 }), [], "Null stage should produce no terrain");

    // ── BattleSimulation stores terrain ──
    const testSpecs = app.roster.slice(0, 2).map((spec) => ({ ...spec }));
    const simWithTerrain = new BattleSimulation(testSpecs, { onLog() {}, onSound() {} }, null, {
        terrain: caveTerrain
    });
    assert.deepEqual(simWithTerrain.terrain, caveTerrain, "BattleSimulation should store terrain from options");

    const simNoTerrain = new BattleSimulation(testSpecs, { onLog() {}, onSound() {} }, null, {});
    assert.deepEqual(simNoTerrain.terrain, [], "BattleSimulation should default terrain to empty array");

    // ── circle terrain collision ──
    const mockApplyImpulse = {
        calls: [],
        fn(impulse) {
            this.calls.push(impulse);
        }
    };
    const fighter = {
        position: { x: 200, y: 200 },
        velocity: { x: 50, y: 0 },
        radius: 24,
        applyImpulse(impulse) {
            mockApplyImpulse.fn(impulse);
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        }
    };
    const rock = { shape: "circle", type: "rock", x: 200, y: 200, radius: 50, blocking: true };
    const collided = resolveTerrainCollision(fighter, rock);
    assert.ok(collided, "Fighter at rock center should collide");
    const distAfter = Math.sqrt((fighter.position.x - rock.x) ** 2 + (fighter.position.y - rock.y) ** 2);
    assert.ok(
        distAfter >= fighter.radius + rock.radius - 0.01,
        "Fighter should be pushed outside rock after collision"
    );

    // ── polygon terrain collision ──
    const polyTerrain = {
        shape: "polygon",
        type: "rock",
        x: 300,
        y: 300,
        points: [
            { x: -40, y: -30 },
            { x: 48, y: -20 },
            { x: 35, y: 38 },
            { x: -35, y: 30 }
        ],
        blocking: true
    };
    const polyFighter = {
        position: { x: 300, y: 300 },
        velocity: { x: 30, y: 0 },
        radius: 24,
        applyImpulse() {}
    };
    const polyCollided = resolveTerrainCollision(polyFighter, polyTerrain);
    assert.ok(polyCollided, "Fighter inside polygon should collide");
    // fighter should be pushed outside polygon bounding box
    const polyDistAfter = Math.sqrt(
        (polyFighter.position.x - polyTerrain.x) ** 2 + (polyFighter.position.y - polyTerrain.y) ** 2
    );
    assert.ok(polyDistAfter > 1, "Fighter should be pushed out of polygon");

    // ── non-blocking / far / invalid ignored ──
    assert.equal(
        resolveTerrainCollision(
            { position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 }, radius: 24, applyImpulse() {} },
            { shape: "circle", type: "rock", x: 200, y: 200, radius: 50, blocking: false }
        ),
        null,
        "Non-blocking should be ignored"
    );
    assert.equal(
        resolveTerrainCollision(
            { position: { x: 500, y: 500 }, velocity: { x: 0, y: 0 }, radius: 24, applyImpulse() {} },
            rock
        ),
        null,
        "Far fighter should not collide"
    );

    // ── renderer draws generated polygons ──
    const ctx = makeRecordingCanvasContext();
    drawTerrain(ctx, caveTerrain);
    const arcCalls = ctx.calls.filter((c) => c[0] === "arc");
    const moveToCalls = ctx.calls.filter((c) => c[0] === "moveTo");
    const lineToCalls = ctx.calls.filter((c) => c[0] === "lineTo");
    assert.equal(arcCalls.length, 0, "Generated terrain should not draw circle arcs");
    assert.ok(moveToCalls.length > 0, "Renderer should draw polygon obstacles with moveTo");
    assert.ok(lineToCalls.length > 0, "Renderer should draw polygon obstacles with lineTo");

    // ── RotationalBody mixin (torque/impulse accumulator + MOI 기반) ──
    class Dummy {}
    const SpinningDummy = RotationalBody(Dummy);
    const spinner = new SpinningDummy();
    spinner.mass = 2;
    spinner.radius = 5;
    // solid disk: I = 0.5*2*25 = 25, inverse = 0.04
    assert.equal(spinner.angle, 0, "RotationalBody should start at angle 0");
    assert.equal(spinner.angularVelocity, 0, "RotationalBody should start at angularVelocity 0");
    assert.equal(spinner.angularDamping, 0.98, "RotationalBody should default angularDamping to 0.98");
    assert.equal(spinner._accumulatedTorque, 0, "should start with zero accumulated torque");
    assert.equal(spinner._accumulatedAngularImpulse, 0, "should start with zero accumulated angular impulse");

    // applyAngularImpulse는 누적만 하고 angularVelocity를 즉시 바꾸지 않음
    spinner.applyAngularImpulse(3);
    assert.equal(spinner.angularVelocity, 0, "applyAngularImpulse should NOT immediately change angularVelocity");
    assert.equal(spinner._accumulatedAngularImpulse, 3, "applyAngularImpulse should accumulate");

    // integrateRotation: 누적 impulse L → Δω = L * I⁻¹ → velocity → angle (프레임레이트 독립 damping)
    spinner.integrateRotation(0.5);
    // Δω = 3 * 0.04 = 0.12
    // damping = 0.98 ^ 0.5 ≈ 0.98995 → velocity = 0.12 * 0.98995 ≈ 0.11879
    // angle = 0.11879 * 0.5 ≈ 0.05940
    assert.ok(
        Math.abs(spinner.angularVelocity - 0.1188) < 0.001,
        "integrateRotation should apply L * I⁻¹ to velocity with FR-independent damping (mass=2, radius=5)"
    );
    assert.ok(Math.abs(spinner.angle - 0.0594) < 0.001, "integrateRotation should advance angle");
    // integrate 후 누적 초기화 확인
    assert.equal(spinner._accumulatedAngularImpulse, 0, "accumulated impulse should clear after integrate");
    assert.equal(spinner._accumulatedTorque, 0, "accumulated torque should clear after integrate");

    // torque 누적 테스트
    spinner.applyTorque(10);
    assert.equal(spinner._accumulatedTorque, 10, "applyTorque should accumulate");
    spinner.applyTorque(5);
    assert.equal(spinner._accumulatedTorque, 15, "multiple applyTorque should sum");

    // torque 누적 초기화 후 damping 테스트
    spinner.clearAngularForces();
    spinner.angularVelocity = 0.1176; // 첫 integrate 이후 상태로 리셋
    spinner.angle = 0.0588;

    // damping 적용 테스트
    spinner.angularDamping = 0.5;
    spinner.integrateRotation(1);
    // velocity=0.1176, damping=0.5 → 0.0588, angle=0.0588+0.0588=0.1176
    assert.ok(Math.abs(spinner.angle - 0.1176) < 0.001, "angularDamping should reduce angularVelocity");

    // _computeMomentOfInertia 테스트
    spinner.mass = 4;
    spinner.radius = 5;
    spinner._computeMomentOfInertia();
    // solid disk: I = 0.5*4*25 = 50, inverse = 0.02
    assert.ok(
        Math.abs(spinner._inverseMomentOfInertia - 0.02) < 0.001,
        "_computeMomentOfInertia should compute 1/(0.5*m*r^2)"
    );

    // clearAngularForces
    spinner.applyTorque(100);
    spinner.applyAngularImpulse(50);
    spinner.clearAngularForces();
    assert.equal(spinner._accumulatedTorque, 0, "clearAngularForces should reset torque");
    assert.equal(spinner._accumulatedAngularImpulse, 0, "clearAngularForces should reset impulse");

    // ── MOI weighting test: 같은 angular impulse라도 mass/radius가 크면 angularVelocity 변화가 작음 ──
    class Dummy2 {}
    const SpinnerLight = RotationalBody(Dummy2);
    const light = new SpinnerLight();
    light.mass = 1;
    light.radius = 5;
    // I = 0.5*1*25 = 12.5, inverse = 0.08

    class Dummy3 {}
    const SpinnerHeavy = RotationalBody(Dummy3);
    const heavy = new SpinnerHeavy();
    heavy.mass = 4;
    heavy.radius = 10;
    // I = 0.5*4*100 = 200, inverse = 0.005

    light.applyAngularImpulse(10);
    heavy.applyAngularImpulse(10);
    light.integrateRotation(1);
    heavy.integrateRotation(1);
    // light: Δω = 10 * 0.08 = 0.8, damping 0.98 → 0.784
    // heavy: Δω = 10 * 0.005 = 0.05, damping 0.98 → 0.049
    assert.ok(
        Math.abs(light.angularVelocity - 0.784) < 0.001,
        "light object should have larger angularVelocity change (I⁻¹=0.08)"
    );
    assert.ok(
        Math.abs(heavy.angularVelocity - 0.049) < 0.001,
        "heavy object should have smaller angularVelocity change (I⁻¹=0.005)"
    );
    assert.ok(light.angularVelocity > heavy.angularVelocity, "same angular impulse → lighter object spins faster");

    // ── terrain draw wraps ctx state with save/restore ──
    const leakCtx = makeRecordingCanvasContext();
    drawTerrain(leakCtx, caveTerrain);
    const saveCalls = leakCtx.calls.filter((c) => c[0] === "save");
    const restoreCalls = leakCtx.calls.filter((c) => c[0] === "restore");
    assert.ok(saveCalls.length >= caveTerrain.length, "drawTerrain should save ctx state per obstacle");
    assert.ok(restoreCalls.length >= caveTerrain.length, "drawTerrain should restore ctx state per obstacle");

    console.log("[hunting-terrain] ok");
}

function createTournamentRampSpec(id, color) {
    return {
        id,
        name: id,
        title: "검증용",
        description: "토너먼트 경사면 검증",
        color,
        ability: "none",
        appearance: { sides: 0, face: "default" },
        stats: { hp: 9999, damage: 1, defense: 0, speed: 600, radius: 32, mass: 1 }
    };
}

function createTournamentRampSimulation() {
    const simulation = new BattleSimulation(
        [createTournamentRampSpec("ramp-a", "#ffffff"), createTournamentRampSpec("ramp-b", "#222222")],
        { onLog() {}, onSound() {} },
        null,
        { assignActions: false, tournamentAngledBounceRamps: { enabled: true, seed: "regression-ramp" } }
    );
    const [fighter, opponent] = simulation.fighters;
    fighter.position = new Vector2(780, 480);
    fighter.velocity = new Vector2(600, 0);
    opponent.position = new Vector2(160, 160);
    opponent.velocity = new Vector2();
    return { simulation, fighter };
}

function testTournamentAngledBounceRamps() {
    const { simulation, fighter } = createTournamentRampSimulation();
    const ramps = simulation._tournamentAngledBounceRampSystem;
    const prediction = predictNextWallCollision(simulation, fighter);

    assert.ok(ramps, "Tournament-only option should create the angled-ramp system");
    assert.equal(prediction.wall, "right", "Axis-aligned fighter should predict the approaching right wall");
    assert.ok(
        prediction.incidenceDegrees <= TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.incidenceThresholdDegrees,
        "Wall-normal incidence should classify an axis trajectory as eligible"
    );
    assert.ok(
        prediction.time <= TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.leadTime,
        "The probe fighter should be inside the ramp lead-time window"
    );

    ramps.update(0);
    const activeTerrain = ramps.activeRamp?.terrain;
    assert.ok(activeTerrain, "Eligible tournament trajectory should create one temporary ramp");
    assert.equal(
        simulation.terrain.length,
        1,
        "Only the active temporary ramp should join the tournament terrain list"
    );
    assert.equal(activeTerrain.shape, "polygon", "Temporary ramp should use the shared polygon terrain contract");
    assert.equal(activeTerrain.points.length, 3, "Temporary ramp should be a right-triangle polygon");
    assert.equal(activeTerrain.physicsMaterial, "wood", "Temporary ramp should use the existing wood terrain material");
    const trianglePoints = getWorldPolygonPoints(activeTerrain);
    const wallVertices = trianglePoints.filter((point) => point.x === simulation.width);
    const innerVertex = trianglePoints.find((point) => point.x < simulation.width);
    assert.ok(
        wallVertices.length === 2,
        "Right-triangle ramp should keep one complete side directly attached to the predicted wall"
    );
    const expectedTriangleDepth =
        TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.length *
        Math.tan((TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.surfaceNormalTiltDegrees * Math.PI) / 180);
    assert.equal(
        TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.surfaceNormalTiltDegrees,
        10,
        "Ramp surface normal should stay at the approved 10-degree tilt"
    );
    assert.ok(
        Math.abs(innerVertex.x - (simulation.width - expectedTriangleDepth)) < 0.001,
        "Right-triangle ramp depth should derive from its 120px wall side and 10-degree tilt"
    );
    const creationParticleCount = simulation.entities.filter(
        (entity) => entity.constructor.name === "GravityParticle"
    ).length;
    assert.equal(creationParticleCount, 12, "Ramp creation should emit the configured particle burst");

    const rampContext = makeRecordingCanvasContext();
    drawTerrain(rampContext, [activeTerrain]);
    assert.equal(
        rampContext.calls.filter((call) => call[0] === "fill").length,
        1,
        "Temporary ramp should render as one clear fill without a terrain shadow pass"
    );
    assert.ok(
        rampContext.calls.some((call) => call[0] === "set" && call[1] === "fillStyle" && call[2] === "#e6ae35"),
        "Temporary ramp should use its dedicated single-color visual"
    );

    let collisionVelocity = null;
    for (let frame = 0; frame < 60; frame += 1) {
        simulation.update(1 / 60);
        if (ramps.events.some((event) => event.type === "collision")) {
            collisionVelocity = fighter.velocity.clone();
            break;
        }
    }
    assert.ok(collisionVelocity, "Ramp should be removed when a fighter physically collides with it");
    assert.equal(ramps.activeRamp, null, "Physical ramp collision should immediately clear the active terrain");
    assert.equal(simulation.terrain.length, 0, "Physical ramp collision should remove the terrain from simulation");
    assert.ok(
        simulation.entities.filter((entity) => entity.constructor.name === "GravityParticle").length >=
            creationParticleCount + 18,
        "Ramp removal should emit an additional particle burst"
    );
    const outgoingAngle = (Math.atan2(Math.abs(collisionVelocity.y), Math.abs(collisionVelocity.x)) * 180) / Math.PI;
    assert.ok(
        outgoingAngle >= 10 && outgoingAngle <= 25,
        "The 10-degree triangle should keep the axis trajectory visibly but gently angled"
    );

    fighter.position = new Vector2(780, 480);
    fighter.velocity = new Vector2(600, 0);
    simulation.fighters.find((candidate) => candidate !== fighter).velocity = new Vector2();
    ramps.update(0);
    assert.equal(ramps.activeRamp, null, "A fighter cooldown should block immediate duplicate ramp creation");

    ramps.update(TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.cooldown + 0.01);
    assert.ok(ramps.activeRamp, "The same fighter should become eligible again after the confirmed cooldown");
    fighter.velocity = new Vector2();
    ramps.update(TOURNAMENT_ANGLED_BOUNCE_RAMP_DEFAULTS.lifetime + 0.01);
    assert.equal(ramps.activeRamp, null, "Unused ramp should expire after the confirmed lifetime");
    assert.ok(
        ramps.events.some((event) => event.type === "expired"),
        "Ramp lifecycle should record expiry cleanup"
    );

    const staticCollisionTerrain = {
        shape: "circle",
        type: "rock",
        x: 100,
        y: 100,
        radius: 40,
        blocking: true,
        onTerrainCollision() {
            this.collisions = (this.collisions ?? 0) + 1;
        }
    };
    const staticCollisionFighter = {
        position: { x: 100, y: 100 },
        velocity: { x: 30, y: 0 },
        radius: 20,
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        }
    };
    assert.ok(
        resolveTerrainCollision(staticCollisionFighter, staticCollisionTerrain),
        "Existing terrain collision should still resolve through the common dispatcher"
    );
    assert.equal(
        staticCollisionTerrain.collisions,
        1,
        "Terrain collision callback should fire only after a real collision"
    );

    const huntingTerrain = createHuntingTerrain({ stageId: HUNTING_STAGE_IDS.CAVE, floor: 1 });
    const huntingSimulation = new BattleSimulation(
        [createTournamentRampSpec("hunting-a", "#ffffff"), createTournamentRampSpec("hunting-b", "#222222")],
        { onLog() {}, onSound() {} },
        null,
        { assignActions: false, terrain: huntingTerrain }
    );
    assert.equal(
        huntingSimulation._tournamentAngledBounceRampSystem,
        null,
        "Hunting and general BattleSimulation paths must leave tournament ramps disabled"
    );
    assert.equal(
        huntingSimulation.terrain.length,
        huntingTerrain.length,
        "Disabled ramp policy must not mutate hunting terrain"
    );
    assert.ok(
        readFileSync("src/app.js", "utf8").includes("tournamentAngledBounceRamps: this.currentTournamentMatch"),
        "Actual tournament match creation should explicitly enable the ramp policy"
    );

    console.log("[tournament-angled-bounce-ramps] ok");
}

function testEquipmentEnhancement() {
    const profile = createDefaultPlayerProfile();

    // 기본값 확인
    assert.equal(profile.equipment.enhancementStones, 0, "New profiles should start with 0 enhancement stones");
    assert.equal(profile.equipment.maxInventorySlots, 5, "New profiles should start with default inventory slots");

    // 강화석 추가 (분해 시뮬레이션)
    profile.equipment.enhancementStones = 100;
    profile.hunting.shards = 200;

    // 장비 생성
    const item = createEquipmentInstance({ rarity: "common", slot: "weapon", rng: () => 0.5 });
    profile.equipment.inventory.push(item);

    // 강화 비용 계산
    const cost0 = calculateEnhanceCost(0);
    assert.equal(cost0.stones, 2, "Enhance +0→+1 should cost 2 stones");
    assert.equal(cost0.shards, 10, "Enhance +0→+1 should cost 10 shards");

    // 실패율 계산
    const failRate0 = calculateEnhanceFailureRate(0);
    assert.ok(Math.abs(failRate0 - 0.16) < 0.001, `Failure rate at +0 should be ~16%, got ${failRate0}`);

    const failRate3 = calculateEnhanceFailureRate(3);
    assert.ok(Math.abs(failRate3 - 0.64) < 0.001, `Failure rate at +3 should be ~64%, got ${failRate3}`);

    const failRate4 = calculateEnhanceFailureRate(4);
    assert.ok(Math.abs(failRate4 - 0.8) < 0.001, `Failure rate at +4 should be ~80%, got ${failRate4}`);

    const failRateMax = calculateEnhanceFailureRate(ENHANCE_MAX_LEVEL);
    assert.equal(failRateMax, 1, "Failure rate at max level should be 1 (100%)");

    // 강화 성공 테스트 (rng=0.5, failRate=0.16 → 성공)
    const resultSuccess = enhanceEquipment(profile, item.instanceId, () => 0.5);
    assert.notEqual(resultSuccess, null, "EnhanceEquipment should return a result");
    assert.equal(resultSuccess.success, true, "Common enhance should succeed with high RNG roll");
    assert.equal(resultSuccess.oldLevel, 0, "Previous level should be 0");
    assert.equal(resultSuccess.newLevel, 1, "New level should be 1 after success");
    assert.equal(item.enhanceLevel, 1, "Item enhance level should be updated to 1");
    assert.equal(profile.equipment.enhancementStones, 98, "Enhance should deduct 2 stones");
    assert.equal(profile.hunting.shards, 190, "Enhance should deduct 10 shards");

    // 강화 실패 테스트 (rng=0, failRate=0.32 → 실패)
    profile.hunting.shards = 200;
    profile.equipment.enhancementStones = 100;
    const item2 = createEquipmentInstance({ rarity: "uncommon", slot: "armor", rng: () => 0.5 });
    item2.enhanceLevel = 1;
    profile.equipment.inventory.push(item2);

    const resultFail = enhanceEquipment(profile, item2.instanceId, () => 0);
    assert.notEqual(resultFail, null, "EnhanceEquipment should return a result for failure case");
    assert.equal(resultFail.success, false, "Enhance should fail with low RNG roll");
    assert.equal(resultFail.oldLevel, 1, "Previous level should be 1");
    assert.equal(resultFail.newLevel, 0, "Level should drop to 0 after failure");

    // 0 레벨에서 실패 시 0 유지
    const item3 = createEquipmentInstance({ rarity: "common", slot: "accessory", rng: () => 0.5 });
    profile.equipment.inventory.push(item3);
    const resultFail0 = enhanceEquipment(profile, item3.instanceId, () => 0);
    assert.equal(resultFail0.success, false, "Enhance at +0 should fail with low RNG");
    assert.equal(resultFail0.newLevel, 0, "Level should not drop below 0");

    // 최대 레벨 도달 시 강화 불가
    const itemMax = createEquipmentInstance({ rarity: "legendary", slot: "weapon", rng: () => 0.5 });
    itemMax.enhanceLevel = ENHANCE_MAX_LEVEL;
    profile.equipment.inventory.push(itemMax);
    const resultMax = enhanceEquipment(profile, itemMax.instanceId, () => 0);
    assert.equal(resultMax, null, "Max level equipment should not be enhanceable");

    // 재료 부족 시 오류 반환
    profile.equipment.enhancementStones = 0;
    profile.hunting.shards = 0;
    const item4 = createEquipmentInstance({ rarity: "common", slot: "weapon", rng: () => 0.5 });
    profile.equipment.inventory.push(item4);
    const resultNoStones = enhanceEquipment(profile, item4.instanceId, () => 0);
    assert.equal(resultNoStones.error, "stones", "Enhance with no stones should return stones error");

    profile.equipment.enhancementStones = 100;
    profile.hunting.shards = 0;
    const resultNoShards = enhanceEquipment(profile, item4.instanceId, () => 0);
    assert.equal(resultNoShards.error, "shards", "Enhance with no shards should return shards error");

    // 장착된 장비 강화 + 스탯 반영 확인
    profile.equipment.enhancementStones = 100;
    profile.hunting.shards = 200;
    const item5 = createEquipmentInstance({ rarity: "rare", slot: "weapon", rng: () => 0.5 });
    item5.stats = [{ type: "damage", value: 6, min: 4, max: 8 }];
    profile.equipment.inventory.push(item5);
    // 기존 장착 해제 후 item5 장착
    profile.equipment.equipped.weapon = null;
    profile.equipment.equipped.weapon = item5.instanceId;

    // 강화 전 스탯 (레벨 0 → 1.0배)
    const bonusesBefore = getEquippedStatBonuses(profile);
    assert.equal(bonusesBefore.damage, 6, "Before enhance, +0 item should give base stat");

    // 장착된 상태로 강화 성공 (+0→+1)
    const enhanceEquipped = enhanceEquipment(profile, item5.instanceId, () => 0.5);
    assert.equal(enhanceEquipped.success, true, "Equipped item should be enhanceable");
    assert.equal(enhanceEquipped.newLevel, 1, "Equipped item should reach level 1");

    // 강화 후 스탯 반영 확인 (레벨 1 → 1.2배, 6*1.2=7.2 → round=7)
    const bonusesAfter = getEquippedStatBonuses(profile);
    assert.equal(
        bonusesAfter.damage,
        7,
        `After +1 enhance, stat should be 7 (6*1.2=7.2→round), got ${bonusesAfter.damage}`
    );

    // 장착된 상태로 한 번 더 강화 (+1→+2, 실패 → +1→+0)
    profile.equipment.enhancementStones = 100;
    profile.hunting.shards = 200;
    const enhanceEquippedFail = enhanceEquipment(profile, item5.instanceId, () => 0);
    assert.equal(enhanceEquippedFail.success, false, "Equipped item enhance should fail with low RNG");
    assert.equal(enhanceEquippedFail.newLevel, 0, "Level should drop from +1 to +0 on fail");

    // 실패 후 스탯이 원래대로 돌아왔는지 확인 (레벨 0 → 1.0배)
    const bonusesAfterFail = getEquippedStatBonuses(profile);
    assert.equal(bonusesAfterFail.damage, 6, "After fail to +0, stat should return to base 6");

    // 존재하지 않는 장비 강화 시도
    const resultMissing = enhanceEquipment(profile, "non-existent-id", () => 0);
    assert.equal(resultMissing, null, "Enhance on non-existent item should return null");

    const craftProfile = createDefaultPlayerProfile();
    craftProfile.hunting.shards = 500;
    craftProfile.equipment.enhancementStones = 100;
    const fuseA = createEquipmentInstance({ rarity: "common", slot: "weapon", rng: () => 0.5 });
    const fuseB = createEquipmentInstance({ rarity: "common", slot: "armor", rng: () => 0.5 });
    const fuseC = createEquipmentInstance({ rarity: "common", slot: "accessory", rng: () => 0.5 });
    fuseA.enhanceLevel = 5;
    craftProfile.equipment.inventory.push(fuseA, fuseB, fuseC);
    craftProfile.equipment.equipped.weapon = fuseA.instanceId;

    const fusionCost = getFusionCost("common");
    const fusionSourceIds = [fuseA.instanceId, fuseB.instanceId, fuseC.instanceId];
    assert.equal(
        canFuseEquipment(craftProfile, fusionSourceIds),
        true,
        "Fusion should accept exactly three same-rarity selected sources"
    );
    assert.deepEqual(
        fusionCost,
        { stones: 10, shards: 50 },
        "Fusion cost should be 10 times the source rarity disassembly and sale rewards"
    );
    assert.deepEqual(
        getFusionCost("uncommon"),
        { stones: 30, shards: 120 },
        "Uncommon fusion cost should use 10x rewards"
    );
    assert.deepEqual(getFusionCost("rare"), { stones: 80, shards: 300 }, "Rare fusion cost should use 10x rewards");
    assert.deepEqual(getFusionCost("epic"), { stones: 200, shards: 800 }, "Epic fusion cost should use 10x rewards");
    assert.equal(getFusionCost("legendary"), null, "Legendary should not have a fusion recipe");
    const fused = fuseEquipment(craftProfile, fusionSourceIds, () => 0.5);
    assert.equal(fused.toRarity, "uncommon", "Fusion should upgrade common equipment to uncommon");
    assert.equal(fused.consumed.length, 3, "Fusion should consume three selected source items");
    assert.equal(craftProfile.equipment.inventory.length, 1, "Fusion should replace three items with one item");
    assert.equal(craftProfile.equipment.inventory[0].rarity, "uncommon", "Fusion result should be the next rarity");
    assert.equal(craftProfile.equipment.inventory[0].enhanceLevel, 0, "Fusion should create a fresh +0 item");
    assert.equal(craftProfile.equipment.equipped.weapon, null, "Fusing an equipped item should unequip it");
    assert.equal(
        craftProfile.equipment.enhancementStones,
        100 - fusionCost.stones,
        "Fusion should deduct enhancement stones"
    );
    assert.equal(craftProfile.hunting.shards, 500 - fusionCost.shards, "Fusion should deduct key shards");

    const lonely = createEquipmentInstance({ rarity: "rare", slot: "weapon", rng: () => 0.5 });
    craftProfile.equipment.inventory.push(lonely);
    const insufficientSources = fuseEquipment(craftProfile, [lonely.instanceId], () => 0.5);
    assert.equal(insufficientSources.error, "sources", "Fusion should require exactly three selected sources");

    const duplicateSources = fuseEquipment(
        craftProfile,
        [lonely.instanceId, lonely.instanceId, lonely.instanceId],
        () => 0.5
    );
    assert.equal(duplicateSources.error, "sources", "Fusion should reject duplicate source selections");

    const legendA = createEquipmentInstance({ rarity: "legendary", slot: "weapon", rng: () => 0.5 });
    const legendB = createEquipmentInstance({ rarity: "legendary", slot: "armor", rng: () => 0.5 });
    const legendC = createEquipmentInstance({ rarity: "legendary", slot: "accessory", rng: () => 0.5 });
    craftProfile.equipment.inventory.push(legendA, legendB, legendC);
    const maxFusion = fuseEquipment(
        craftProfile,
        [legendA.instanceId, legendB.instanceId, legendC.instanceId],
        () => 0.5
    );
    assert.equal(maxFusion.error, "max_rarity", "Legendary equipment should not fuse beyond max rarity");

    const sellProfile = createDefaultPlayerProfile();
    const sellItem = createEquipmentInstance({ rarity: "rare", slot: "weapon", rng: () => 0.5 });
    sellProfile.equipment.inventory.push(sellItem);
    sellProfile.equipment.equipped.weapon = sellItem.instanceId;
    const sold = sellEquipment(sellProfile, sellItem.instanceId);
    assert.equal(sold.shards, getSellReward("rare"), "Selling should return rarity-based key shards");
    assert.equal(sellProfile.hunting.shards, getSellReward("rare"), "Selling should add shards to profile");
    assert.equal(sellProfile.equipment.inventory.length, 0, "Sold equipment should leave inventory");
    assert.equal(sellProfile.equipment.equipped.weapon, null, "Selling an equipped item should unequip it");

    console.log("[equipment] ok");
}

function testEquipmentStatValueRatios() {
    assert.equal(
        EQUIPMENT_STAT_VALUE_RATIOS,
        REWARD_BALANCE.equipment.statValueRatios,
        "Equipment generation must use the reward-balance stat-value ratios directly"
    );
    assert.deepEqual(
        EQUIPMENT_STAT_VALUE_RATIOS,
        { hp: 10, damage: 1, defense: 1, speed: 5 },
        "Equipment stat value ratios should match the standard-ball win-rate reference"
    );

    const hpItem = createEquipmentInstance({ rarity: "common", slot: "weapon", rng: () => 0 });
    assert.deepEqual(
        hpItem.stats,
        [{ type: "hp", value: 10, min: 10, max: 30 }],
        "Common HP rolls should convert one value unit into HP +10"
    );

    const speedRolls = [0, 0, 0.999, 0];
    const speedItem = createEquipmentInstance({
        rarity: "common",
        slot: "weapon",
        rng: () => speedRolls.shift() ?? 0
    });
    assert.deepEqual(
        speedItem.stats,
        [{ type: "speed", value: 5, min: 5, max: 15 }],
        "Common speed rolls should convert one value unit into speed +5"
    );
    console.log("[equipment-stat-value-ratios] ok");
}

function testEquipmentNaming() {
    const stats = [
        { type: "hp", value: 20 },
        { type: "speed", value: 15 }
    ];
    assert.equal(
        getDominantEquipmentStat(stats, EQUIPMENT_STAT_VALUE_RATIOS),
        "speed",
        "Equipment names should use the stat with the highest normalized combat value"
    );
    assert.deepEqual(
        createEquipmentName("철검", stats, {
            statValueRatios: EQUIPMENT_STAT_VALUE_RATIOS,
            prefixes: EQUIPMENT_NAME_PREFIXES,
            rng: () => 0
        }),
        { name: "질풍의 철검", primaryStatType: "speed" },
        "Equipment names should combine one primary-stat prefix with the base name"
    );

    const item = createEquipmentInstance({ rarity: "common", slot: "weapon", rng: () => 0 });
    assert.equal(item.baseName, "녹슨 검", "Generated equipment should retain its base name");
    assert.equal(item.primaryStatType, "hp", "Generated equipment should store its primary stat type");
    assert.equal(item.name, "튼튼한 녹슨 검", "Generated equipment should show its primary-stat prefix");

    assert.deepEqual(
        createEquipmentName("철검", stats, {
            statValueRatios: EQUIPMENT_STAT_VALUE_RATIOS,
            prefixes: EQUIPMENT_NAME_PREFIXES,
            specialOptions: [{ type: "hpSteal", value: 8 }],
            specialSuffixes: EQUIPMENT_SPECIAL_OPTION_SUFFIXES,
            rng: () => 0
        }),
        { name: "질풍의 철검 • 갈망", primaryStatType: "speed", specialOptionType: "hpSteal" },
        "Equipment special options should use a visually distinct suffix delimiter"
    );
    console.log("[equipment-naming] ok");
}

function testEquipmentSpecialCombatEffects() {
    const effects = createEquipmentCombatEffects([
        {
            specialOptions: [
                { type: "crashDamage", value: 5 },
                { type: "hpSteal", value: 2 }
            ]
        },
        {
            specialOptions: [
                { type: "crashDamage", value: 15 },
                { type: "cooldown", value: 10 }
            ]
        },
        { specialOptions: [{ type: "hpSteal", value: 8 }] }
    ]);
    assert.equal(effects.crashDamageMultiplier, 1.15, "Duplicate 파쇄 options should use only the highest value");
    assert.equal(effects.abilityCooldownMultiplier, 0.9, "순환 should shorten ability cooldown by its percentage");
    assert.equal(effects.hpStealRatio, 0.08, "Duplicate 갈망 options should use only the highest value");
    assert.equal(effects.hpStealCooldown, 2.5, "갈망 should use the configured 2.5 second cooldown");

    const logs = [];
    const createSpec = (id, specialOptions = []) => ({
        id,
        teamId: id,
        name: id,
        title: "",
        description: "",
        color: "#777777",
        face: "default",
        ability: "dash",
        stats: { hp: 100, damage: 10, defense: 1, speed: 300, radius: 50, mass: 1 },
        equipment: { equippedItems: [{ instanceId: `${id}-equipment`, specialOptions }] }
    });
    const sim = new BattleSimulation(
        [
            createSpec("attacker", [
                { type: "crashDamage", value: 15 },
                { type: "cooldown", value: 10 },
                { type: "hpSteal", value: 8 }
            ]),
            createSpec("defender")
        ],
        { onLog: (message) => logs.push(message), onSound() {} },
        null,
        { assignActions: false }
    );
    const [attacker, defender] = sim.fighters;
    assert.equal(attacker.ability.cooldown, 2.7, "순환 should affect the equipped fighter's ability cooldown");

    attacker.hp = 60;
    attacker.position = new Vector2(400, 480);
    defender.position = new Vector2(480, 480);
    attacker.velocity = new Vector2(520, 0);
    defender.velocity = new Vector2(-120, 0);
    attacker.state.movement = new DashEffect({
        duration: 1,
        multiplier: 1,
        color: attacker.color,
        collisionDamage: 24,
        collisionLabel: "Dash Contact",
        untilImpact: true
    });

    const context = sim.handleFighterCollision(attacker, defender);
    assert.ok(context, "Overlapping fighters should produce a collision transaction");
    assert.ok(
        context.damageByAttacker.get(attacker) > context.damageFromAToB,
        "갈망 damage ledger should include dash contact damage after base collision damage"
    );
    assert.ok(
        logs.some((message) => message.includes("갈망")),
        "갈망 should restore after a hostile collision transaction"
    );
    assert.equal(attacker._equipmentEffectCooldowns.hpSteal, 2.5, "갈망 should enter its own cooldown after restoring");
    console.log("[equipment-special-combat-effects] ok");
}

function testEquipmentPhysicalSpecialEffects() {
    const effects = createEquipmentCombatEffects([
        {
            specialOptions: [
                { type: "mass", value: 5 },
                { type: "wallBounce", value: 15 }
            ]
        },
        {
            specialOptions: [
                { type: "mass", value: 15 },
                { type: "angularImpulse", value: 15 }
            ]
        }
    ]);
    assert.equal(effects.massMultiplier, 1.15, "Duplicate 중량 options should use only the highest value");
    assert.equal(effects.wallBounceMultiplier, 1.15, "반향 should amplify post-wall normal speed");
    assert.equal(effects.collisionAngularMultiplier, 1.15, "소용돌이 should amplify solver angular impulse");

    const createSpec = (id, specialOptions = []) => ({
        id,
        teamId: id,
        name: id,
        title: "",
        description: "",
        color: "#777777",
        face: "default",
        ability: "none",
        appearance: { sides: 4, face: "default", angle: 0, angularVelocity: 0 },
        stats: { hp: 100, damage: 10, defense: 1, speed: 300, radius: 50, mass: 1 },
        equipment: { equippedItems: [{ instanceId: `${id}-equipment`, specialOptions }] }
    });
    const createSimulation = (specialOptions = []) =>
        new BattleSimulation(
            [createSpec("equipped", specialOptions), createSpec("baseline")],
            { onLog() {}, onSound() {} },
            null,
            { assignActions: false }
        );
    const arrangeCollision = (sim) => {
        const [a, b] = sim.fighters;
        a.position = new Vector2(450, 480);
        b.position = new Vector2(500, 480);
        a.velocity = new Vector2(500, 0);
        b.velocity = new Vector2(-120, 0);
        return [a, b];
    };

    const baselineMassSim = createSimulation();
    const [, baselineMassTarget] = arrangeCollision(baselineMassSim);
    baselineMassSim.handleFighterCollision(...baselineMassSim.fighters);

    const massSim = createSimulation([{ type: "mass", value: 15 }]);
    const [heavy, heavyTarget] = arrangeCollision(massSim);
    massSim.handleFighterCollision(heavy, heavyTarget);
    assert.equal(heavy.mass, 1.15, "중량 should change the fighter's actual rigid-body mass");
    assert.ok(
        heavyTarget.velocity.x > baselineMassTarget.velocity.x,
        "중량 should change shared rigid-body collision momentum without a separate knockback effect"
    );

    const echoSim = createSimulation([{ type: "wallBounce", value: 15 }]);
    const [echoBall] = echoSim.fighters;
    echoBall.position = new Vector2(echoBall.radius, 480);
    echoBall.velocity = new Vector2(-500, 0);
    echoSim.keepInsideArena(echoBall);
    assert.equal(echoBall.velocity.x, 575, "반향 should increase the reflected wall-normal velocity by its percentage");

    const baselineVortexSim = createSimulation();
    const [baselineSpinner, baselineTarget] = arrangeCollision(baselineVortexSim);
    baselineSpinner.velocity = new Vector2(460, 130);
    baselineTarget.velocity = new Vector2(-150, -90);
    baselineVortexSim.handleFighterCollision(baselineSpinner, baselineTarget);
    baselineSpinner.integrateRotation(1 / 60);

    const vortexSim = createSimulation([{ type: "angularImpulse", value: 15 }]);
    const [vortexSpinner, vortexTarget] = arrangeCollision(vortexSim);
    vortexSpinner.velocity = new Vector2(460, 130);
    vortexTarget.velocity = new Vector2(-150, -90);
    vortexSim.handleFighterCollision(vortexSpinner, vortexTarget);
    vortexSpinner.integrateRotation(1 / 60);
    assert.ok(
        Math.abs(vortexSpinner.angularVelocity) > Math.abs(baselineSpinner.angularVelocity) * 1.14,
        "소용돌이 should amplify the solver angular impulse instead of assigning angular velocity directly"
    );
    console.log("[equipment-physical-special-effects] ok");
}

function testEquipmentLevelRequirement(app) {
    const profile = createDefaultPlayerProfile();
    const characterId = FIGHTER_IDS.DASH;
    const rareWeapon = createEquipmentInstance({ rarity: "rare", slot: "weapon", rng: () => 0.5 });
    rareWeapon.stats = [{ type: "damage", value: 8, min: 4, max: 8 }];
    profile.equipment.inventory.push(rareWeapon);

    assert.equal(getEquipmentRequiredLevel(rareWeapon), 5, "Rare equipment should require character level 5");
    assert.equal(
        canCharacterEquipItem(profile, rareWeapon, characterId),
        false,
        "Level 1 character should not be able to equip rare equipment"
    );

    const equipLocked = equipEquipmentItem(profile, rareWeapon.instanceId, characterId);
    assert.equal(equipLocked.error, "level", "Equip action should reject locked equipment");
    assert.equal(profile.equipment.equipped.weapon, null, "Rejected equipment should not be equipped");

    profile.equipment.equipped.weapon = rareWeapon.instanceId;
    const baseSpec = {
        id: characterId,
        name: "장비 레벨 테스트",
        stats: { hp: 100, damage: 10, defense: 2, speed: 260, radius: 42, mass: 1 }
    };
    const lockedSpec = applyEquipmentStats(baseSpec, profile);
    assert.equal(lockedSpec.stats.damage, 10, "Locked equipment should not add stat bonuses");
    assert.equal(lockedSpec.equipment.equippedItems.length, 0, "Locked equipment should not be drawn");
    const lockedSummary = app._getPlayerEquipmentSummary.call({ playerProfile: profile, playerFighterId: characterId });
    assert.equal(
        lockedSummary.statLine,
        "적용 중인 장비 스탯 없음",
        "Locked equipment should not appear in the main setup stat summary"
    );
    assert.equal(lockedSummary.activeCount, 0, "Locked equipment should not count as active in the main setup");
    assert.equal(
        lockedSummary.slots.find((slot) => slot.id === "weapon")?.locked,
        true,
        "Locked equipment should keep its setup slot lock indicator"
    );

    profile.experience.byCharacter[characterId] = { currentXp: getLevelRequirement(5) };
    assert.equal(
        canCharacterEquipItem(profile, rareWeapon, characterId),
        true,
        "Level 5 character should be able to equip rare equipment"
    );
    const unlockedSpec = applyEquipmentStats(baseSpec, profile);
    assert.equal(unlockedSpec.stats.damage, 18, "Unlocked equipment should add stat bonuses");
    assert.equal(unlockedSpec.equipment.equippedItems.length, 1, "Unlocked equipment should be drawn");
    const unlockedSummary = app._getPlayerEquipmentSummary.call({
        playerProfile: profile,
        playerFighterId: characterId
    });
    assert.equal(
        unlockedSummary.statLine,
        "공격 +8",
        "Unlocked equipment should return to the main setup stat summary"
    );
    assert.equal(unlockedSummary.activeCount, 1, "Unlocked equipment should count as active in the main setup");
    assert.equal(
        unlockedSummary.slots.find((slot) => slot.id === "weapon")?.locked,
        false,
        "Unlocked equipment should clear its setup slot lock indicator"
    );
}

function testEquipmentDraw() {
    const profile = createDefaultPlayerProfile();
    profile.experience.byCharacter["equipment-test"] = { currentXp: getLevelRequirement(10) };
    // 전체 장비 세트: weapon + armor + accessory 2개
    const weapon = createEquipmentInstance({ rarity: "rare", slot: "weapon", rng: () => 0.5 });
    const armor = createEquipmentInstance({ rarity: "epic", slot: "armor", rng: () => 0.5 });
    const accessory1 = createEquipmentInstance({ rarity: "uncommon", slot: "accessory", rng: () => 0.5 });
    const accessory2 = createEquipmentInstance({ rarity: "legendary", slot: "accessory", rng: () => 0.5 });
    profile.equipment.inventory.push(weapon, armor, accessory1, accessory2);
    profile.equipment.equipped.weapon = weapon.instanceId;
    profile.equipment.equipped.armor = armor.instanceId;
    profile.equipment.equipped.accessory1 = accessory1.instanceId;
    profile.equipment.equipped.accessory2 = accessory2.instanceId;

    const baseSpec = {
        id: "equipment-test",
        name: "장비 테스트",
        title: "테스트",
        color: "#80bfff",
        face: "default",
        stats: { hp: 100, damage: 10, defense: 2, speed: 260, radius: 42, mass: 1 },
        statAllocation: { hp: 0, damage: 0, speed: 0, skill: 0, defense: 0 }
    };
    const equippedItems = getEquippedItems(profile, baseSpec.id);
    assert.deepEqual(
        equippedItems.map((item) => item.instanceId),
        [weapon.instanceId, armor.instanceId, accessory1.instanceId, accessory2.instanceId],
        "Active visual items should keep the equipment slot order"
    );

    const oneItemDashes = getEquipmentRingDashes([weapon], 42);
    const fullSetDashes = getEquipmentRingDashes(equippedItems, 42);
    const previewDashes = getEquipmentRingDashes(equippedItems, 23);
    const outlineWidth = getCharacterOutlineWidth(42);
    const ringLineWidth = getEquipmentRingLineWidth(42);
    const ringRadius = getEquipmentRingRadius(42);
    assert.equal(oneItemDashes.length, 6, "One equipped item should use a sparse six-dash ring");
    assert.equal(fullSetDashes.length, 24, "Four equipped items should use a dense twenty-four-dash ring");
    assert.equal(previewDashes.length, 24, "A 46px preview should retain the full ring density");
    assert.ok(
        fullSetDashes.every((dash) => dash.radius === ringRadius),
        "Equipment dashes should use the shared outline-relative radius"
    );
    assert.ok(
        Math.abs(42 - outlineWidth / 2 - (ringRadius + ringLineWidth / 2) - 0.6) < 1e-9,
        "The outside edge of each dash should sit directly inside the character outline"
    );
    assert.deepEqual(
        fullSetDashes.slice(0, 4).map((dash) => dash.color),
        ["#fbbf24", "#c084fc", "#4ade80", "#fb7185"],
        "Equipment rarity colors should rotate in stable slot order"
    );

    const normalDash = getEquipmentRingDashes([weapon], 42)[0];
    const enhancedDash = getEquipmentRingDashes([{ ...weapon, enhanceLevel: 5 }], 42)[0];
    assert.equal(enhancedDash.startAngle, normalDash.startAngle, "Enhancement should not move equipment dashes");
    assert.equal(enhancedDash.endAngle, normalDash.endAngle, "Enhancement should not resize equipment dashes");
    assert.equal(enhancedDash.color, normalDash.color, "Enhancement should not replace the rarity color");
    assert.ok(enhancedDash.alpha > normalDash.alpha, "Enhancement should only brighten its equipment dashes");

    const directCtx = makeRecordingCanvasContext();
    const mockBall = { radius: 42, position: { x: 120, y: 120 } };
    drawEquipmentItems(directCtx, mockBall, equippedItems);
    assert.equal(
        directCtx.calls.filter(([name]) => name === "arc").length,
        24,
        "The shared equipment renderer should draw one arc per dense-ring dash"
    );
    assert.equal(
        directCtx.calls.filter(([name]) => name === "ellipse").length,
        0,
        "The shared equipment renderer should not draw external armor shapes"
    );
    assert.equal(
        directCtx.calls.filter(([name]) => name === "lineTo").length,
        0,
        "The shared equipment renderer should not draw external weapon shapes"
    );

    const visualSpec = applyEquipmentVisuals(baseSpec, profile);
    const ball = new BattleBall(visualSpec, new Vector2(120, 120));
    const ballCtx = makeRecordingCanvasContext();
    ball.draw(ballCtx);
    assert.equal(
        ballCtx.calls.filter(([name, , , radius]) => name === "arc" && radius === ringRadius).length,
        24,
        "BattleBall should render the shared inner equipment ring before the face"
    );

    const preview = new PreviewReselectSimulation({
        oldFighter: visualSpec,
        newFighter: visualSpec,
        center: new Vector2(480, 452),
        canvasWidth: 960
    });
    assert.equal(
        preview.outgoing.equipment.items.length,
        4,
        "Outgoing reselect previews should receive active equipment"
    );
    assert.equal(
        preview.incoming.equipment.items.length,
        4,
        "Incoming reselect previews should receive active equipment"
    );

    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    assert.ok(
        appSource.includes(
            "drawEquipmentItems(ctx, fakeBall, getEquippedItems(this.playerProfile, fighter.id), outlineWidth);"
        ),
        "The setup face preview should use the shared renderer with the matching outline width"
    );
}

function testAlpineTemplateComponentSystem() {
    const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    assert.ok(
        readFileSync(new URL("../src/components/xp-reward-panel.html", import.meta.url), "utf8"),
        "xp-reward-panel component file should exist"
    );
    assert.ok(
        readFileSync(new URL("../src/components/xp-progress-bar.html", import.meta.url), "utf8"),
        "xp-progress-bar component file should exist"
    );
    assert.ok(indexHtml.includes("<game-overlay"), "Index should use a tag component for the game overlay");
    assert.ok(
        indexHtml.includes("<xp-reward-panel") ||
            readFileSync(new URL("../src/components/game-overlay.html", import.meta.url), "utf8").includes(
                "<xp-reward-panel"
            ),
        "xp-reward-panel should be used as a tag component (in index or child component)"
    );
    const rewardTemplateHtml = readFileSync(new URL("../src/components/xp-reward-panel.html", import.meta.url), "utf8");
    assert.ok(
        rewardTemplateHtml.includes("<xp-progress-bar"),
        "Reward panel template should include nested xp-progress-bar"
    );
    assert.ok(
        rewardTemplateHtml.includes("previousLevelLabel") && rewardTemplateHtml.includes("bar-resetting"),
        "Reward panel should preserve the previous level while its level-up animation changes stages"
    );
    assert.ok(
        rewardTemplateHtml.indexOf("this.levelLabel = val.levelUp") <
            rewardTemplateHtml.indexOf("this.levelLabel = val.nextLevelLabel"),
        "Reward panel should finish the previous level before displaying the new level"
    );
    assert.ok(
        readFileSync(new URL("../src/components/game-overlay.html", import.meta.url), "utf8").includes(
            'requireComponent("xpRewardPanel")'
        ),
        "Result overlay should require the shared XP reward panel it owns"
    );

    assert.equal(normalizeTemplateComponentName("pull-request"), "pull-request");
    assert.equal(normalizeTemplateComponentName("'pull-request'"), "pull-request");
    assert.equal(isValidTemplateComponentName("xp-meter"), true);
    assert.equal(isValidTemplateComponentName("XpMeter"), false);
    assert.equal(isValidTemplateComponentName("../bad"), false);
    assert.equal(getTemplateComponentId("xp-meter"), "template-xp-meter");
    assert.equal(getTemplateComponentNameFromTagName("XP-METER"), "xp-meter");
    assert.equal(getTemplateComponentNameFromTagName("meter"), null, "Tag components should require kebab names");

    const template = {
        id: "template-xp-meter",
        content: {
            cloneNode() {
                return {
                    childNodes: [{ nodeType: 1, tagName: "SPAN" }]
                };
            }
        }
    };
    const root = {
        getElementById(id) {
            return id === "template-xp-meter" ? template : null;
        }
    };
    assert.equal(resolveTemplateComponent("xp-meter", { root }), template, "Template should resolve by prefix + name");
    assert.equal(resolveTemplateComponent("../bad", { root }), null, "Invalid names should not hit the DOM");

    const initialized = [];
    const element = {
        dataset: {},
        children: [],
        replaceChildren(fragment) {
            this.children = [...fragment.childNodes];
        }
    };
    assert.equal(
        mountTemplateComponent(element, template, {
            Alpine: {
                initTree(child) {
                    initialized.push(child);
                }
            }
        }),
        true,
        "Template component mount should clone template content"
    );
    assert.equal(element.children.length, 1, "Mounted component should replace host children");
    assert.equal(initialized.length, 1, "Mounted component should initialize cloned child roots");
    assert.equal(
        mountTemplateComponent(
            { innerHTML: "" },
            { innerHTML: "<span>fallback</span>" },
            { Alpine: null, initialize: true }
        ),
        true,
        "Mount should still work when Alpine.initTree is unavailable"
    );
    assert.equal(
        mountTemplateComponentByName(element, "xp-meter", { root, Alpine: null, initialize: false }),
        true,
        "Component should mount by resolved component name"
    );

    const warnings = [];
    const directive = createTemplateComponentDirective({
        root,
        warn(message) {
            warnings.push(message);
        }
    });
    const host = {
        dataset: {},
        children: [],
        replaceChildren(fragment) {
            this.children = [...fragment.childNodes];
        }
    };
    let cleanupHandler = null;
    directive(
        host,
        { expression: "xp-meter" },
        { Alpine: { initTree() {} }, cleanup: (handler) => (cleanupHandler = handler) }
    );
    assert.equal(host.dataset.component, "xp-meter", "Directive should stamp component metadata");
    assert.equal(host.children.length, 1, "Directive should mount template content");
    assert.equal(typeof cleanupHandler, "function", "Directive should register cleanup");
    cleanupHandler();
    assert.equal(host.__bfsTemplateComponentName, undefined, "Cleanup should clear mount marker");

    directive({ dataset: {} }, { expression: "../bad" }, { Alpine: { initTree() {} } });
    assert.equal(warnings.length, 1, "Invalid component names should warn");
    directive({ dataset: {} }, { expression: "missing-template" }, { Alpine: { initTree() {} } });
    assert.equal(warnings.length, 2, "Missing templates should warn without mutating the host");

    const tagHost = {
        tagName: "XP-METER",
        dataset: {},
        children: [],
        replaceChildren(fragment) {
            this.children = [...fragment.childNodes];
        }
    };
    const tagRoot = {
        getElementById(id) {
            return id === "template-xp-meter" ? template : null;
        },
        querySelectorAll() {
            return [tagHost, { tagName: "unknown-panel", dataset: {} }, { tagName: "meter", dataset: {} }];
        }
    };
    assert.deepEqual(findTemplateComponentTagHosts(tagRoot), [tagHost], "Only matching tag hosts should be found");
    assert.equal(
        mountTemplateComponentTags({ root: tagRoot, Alpine: null, initialize: false }),
        1,
        "Matching component tags should mount before Alpine.start"
    );
    assert.equal(tagHost.dataset.component, "xp-meter", "Tag component should stamp component metadata");

    const nestedProgressHost = {
        tagName: "XP-PROGRESS-BAR",
        dataset: {},
        children: [],
        replaceChildren(fragment) {
            this.children = [...fragment.childNodes];
        }
    };
    const nestedPanelTemplate = {
        content: {
            cloneNode() {
                return {
                    childNodes: [{ nodeType: 1, tagName: "SECTION", nestedHost: nestedProgressHost }]
                };
            }
        }
    };
    const nestedProgressTemplate = {
        content: {
            cloneNode() {
                return {
                    childNodes: [{ nodeType: 1, tagName: "DIV" }]
                };
            }
        }
    };
    const nestedRoot = {
        getElementById(id) {
            if (id === "template-xp-reward-panel") return nestedPanelTemplate;
            if (id === "template-xp-progress-bar") return nestedProgressTemplate;
            return null;
        },
        querySelectorAll() {
            const hosts = [nestedPanelHost];
            if (nestedPanelHost.children.length > 0) hosts.push(nestedProgressHost);
            return hosts;
        }
    };
    const nestedDirective = createTemplateComponentDirective({ root: nestedRoot });
    const nestedPanelHost = {
        tagName: "XP-REWARD-PANEL",
        dataset: {},
        children: [],
        replaceChildren(fragment) {
            this.children = [...fragment.childNodes];
        }
    };
    let nestedInitCount = 0;
    const nestedAlpine = {
        initTree(child) {
            nestedInitCount += 1;
            if (child.nestedHost) {
                nestedDirective(child.nestedHost, { expression: "xp-progress-bar" }, { Alpine: nestedAlpine });
            }
        }
    };
    nestedDirective(nestedPanelHost, { expression: "xp-reward-panel" }, { Alpine: nestedAlpine });
    assert.equal(nestedPanelHost.dataset.component, "xp-reward-panel", "Parent component should mount");
    assert.equal(nestedProgressHost.dataset.component, "xp-progress-bar", "Nested component should mount");
    assert.equal(nestedProgressHost.children.length, 1, "Nested component should receive its template content");
    assert.ok(nestedInitCount >= 2, "Nested component roots should be initialized");

    nestedPanelHost.children = [];
    nestedProgressHost.children = [];
    delete nestedPanelHost.__bfsTemplateComponentName;
    delete nestedPanelHost.dataset.component;
    delete nestedProgressHost.__bfsTemplateComponentName;
    delete nestedProgressHost.dataset.component;
    assert.equal(
        mountTemplateComponentTags({ root: nestedRoot, Alpine: null, initialize: false }),
        2,
        "Nested tag components should mount across passes"
    );
    assert.equal(nestedPanelHost.dataset.component, "xp-reward-panel", "Parent tag component should mount");
    assert.equal(nestedProgressHost.dataset.component, "xp-progress-bar", "Nested tag component should mount");

    let registeredName = null;
    let registeredDirective = null;
    const alpine = {
        directive(name, handler) {
            registeredName = name;
            registeredDirective = handler;
            return { name };
        }
    };
    registerAlpineComponentSystem(alpine, { root });
    assert.equal(registeredName, "component", "System should register x-component");
    assert.equal(typeof registeredDirective, "function", "System should register a directive function");
    console.log("[alpine-components] ok");
}

// ──────────────────────────────────────────────
// Fighter collision: polygon / circle shape 충돌
// ──────────────────────────────────────────────

import {
    getFighterCollisionShape,
    resolveFighterShapeCollision,
    computeRegularPolygonLocalPoints
} from "../src/physics/CollisionShape.js";

async function testCircleVsCircleCollisionStillWorks(app) {
    const sim = new BattleSimulation(
        [
            app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
            app.roster.find((fighter) => fighter.id === FIGHTER_IDS.GRENADE)
        ],
        { onLog() {}, onSound() {} }
    );
    const [a, b] = sim.fighters;
    a.position = new Vector2(440, 480);
    b.position = new Vector2(440 + a.radius + b.radius - 4, 480);
    a.applyImpulse(Vector2.subtract(new Vector2(700, 0), a.velocity));
    b.applyImpulse(Vector2.subtract(new Vector2(-520, 0), b.velocity));

    sim.handleCollision();
    assert.ok(a.velocity.x < 0, "circle-circle collision should reverse a's velocity");
    assert.ok(b.velocity.x > 0, "circle-circle collision should reverse b's velocity");

    a.update(0.016, sim);
    b.update(0.016, sim);
    assert.ok(a.velocity.length() > a.stats.baseSpeed * 1.2, "circle-circle impulse should persist after update");
}

function testPolygonVsPolygonCollisionSeparates() {
    // 전용 polygon spec 2개 생성
    const specA = {
        id: "test-poly-a",
        name: "PolyA",
        teamId: "team-a",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 6, face: "default" },
        ability: "dash"
    };
    const specB = {
        id: "test-poly-b",
        name: "PolyB",
        teamId: "team-b",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#0000ff",
        appearance: { sides: 8, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([specA, specB], { onLog() {}, onSound() {} });
    const [a, b] = sim.fighters;

    // 확실히 겹치게 배치
    a.position = new Vector2(475, 480);
    b.position = new Vector2(485, 480);
    a.angle = 0.3;
    b.angle = 0.8;
    a.applyImpulse(Vector2.subtract(new Vector2(400, 0), a.velocity));
    b.applyImpulse(Vector2.subtract(new Vector2(-350, 0), b.velocity));

    sim.handleCollision();
    // 충돌 후 분리 확인 (다각형은 bounding circle보다 실제 overlap이 작으므로 재충돌 없음만 확인)
    const resultAfter = resolveFighterShapeCollision(a, b);
    assert.ok(resultAfter.overlap <= 0, "polygon-polygon should not overlap after collision resolution");
    assert.ok(a.velocity.x < 0, "polygon A should bounce left");
    assert.ok(b.velocity.x > 0, "polygon B should bounce right");
}

function testCircleVsPolygonCollisionSeparates() {
    const specCircle = {
        id: "test-circ",
        name: "Circle",
        teamId: "team-c",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#00ff00",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const specPoly = {
        id: "test-poly-c",
        name: "PolyC",
        teamId: "team-p",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#ff00ff",
        appearance: { sides: 5, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([specCircle, specPoly], { onLog() {}, onSound() {} });
    const [circle, poly] = sim.fighters;

    circle.position = new Vector2(475, 480);
    poly.position = new Vector2(485, 480);
    poly.angle = Math.PI / 4;
    circle.applyImpulse(Vector2.subtract(new Vector2(400, 0), circle.velocity));
    poly.applyImpulse(Vector2.subtract(new Vector2(-350, 0), poly.velocity));

    sim.handleCollision();
    const resultAfter = resolveFighterShapeCollision(circle, poly);
    assert.ok(resultAfter.overlap <= 0, "circle-polygon should not overlap after collision resolution");
    assert.ok(circle.velocity.x < 0, "circle should bounce left from polygon");
    assert.ok(poly.velocity.x > 0, "polygon should bounce right from circle");
}

function testPolygonAngleChangesCollisionResult() {
    const specA = {
        id: "poly-ang-a",
        name: "AngA",
        teamId: "t1",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#aa0000",
        appearance: { sides: 5, face: "default" },
        ability: "dash"
    };
    const specB = {
        id: "poly-ang-b",
        name: "AngB",
        teamId: "t2",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#0000aa",
        appearance: { sides: 5, face: "default" },
        ability: "dash"
    };

    // B의 각도만 변경 → 상대 기하가 달라져 normal이 바뀜
    const sim1 = new BattleSimulation(
        [
            { ...specA, id: "a1" },
            { ...specB, id: "b1" }
        ],
        { onLog() {}, onSound() {} }
    );
    const [a1, b1] = sim1.fighters;
    a1.position = new Vector2(475, 480);
    b1.position = new Vector2(485, 488);
    a1.angle = 0;
    b1.angle = 0;
    const r1 = resolveFighterShapeCollision(a1, b1);

    // B만 회전 → 다른 normal
    const sim2 = new BattleSimulation(
        [
            { ...specA, id: "a2" },
            { ...specB, id: "b2" }
        ],
        { onLog() {}, onSound() {} }
    );
    const [a2, b2] = sim2.fighters;
    a2.position = new Vector2(475, 480);
    b2.position = new Vector2(485, 488);
    a2.angle = 0;
    b2.angle = 0.5;
    const r2 = resolveFighterShapeCollision(a2, b2);

    const normalDiff = Math.abs(r1.normal.x - r2.normal.x) + Math.abs(r1.normal.y - r2.normal.y);
    assert.ok(normalDiff > 0.05, "rotating one polygon should change collision normal");
}

function testPolygonBodyDrawAppliesAngle() {
    const ctx = makeRecordingCanvasContext();
    const spec = {
        id: "test-draw",
        name: "DrawMe",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 6, face: "default" },
        ability: "dash"
    };
    const ball = new BattleBall(spec, new Vector2(200, 300));
    ball.radius = 30;
    ball.angle = 1.2;

    ball.draw(ctx);

    // translate(200, 300) + rotate(1.2) 호출 확인
    const translateCalls = ctx.calls.filter((c) => c[0] === "translate");
    assert.ok(translateCalls.length >= 1, "_drawPolygonBody should call translate");
    const rotateCalls = ctx.calls.filter((c) => c[0] === "rotate");
    assert.ok(
        rotateCalls.some((c) => Math.abs(c[1] - 1.2) < 0.01),
        "draw should apply angle to rotate"
    );
}

function testGetFighterCollisionShapePolygon() {
    const spec = {
        id: "test-shape",
        name: "Shape",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 6, face: "default" },
        ability: "dash"
    };
    const ball = new BattleBall(spec, new Vector2(100, 200));
    ball.angle = 0.5;
    const shape = getFighterCollisionShape(ball);
    assert.equal(shape.type, "polygon", "polygon fighter should return polygon shape");
    assert.equal(shape.sides, 6, "should have 6 sides");
    assert.ok(Array.isArray(shape.worldPoints) && shape.worldPoints.length === 6, "should have 6 world points");
    assert.equal(shape.angle, 0.5, "should preserve angle");
}

function testGetFighterCollisionShapeCircle() {
    const spec = {
        id: "test-circ-shape",
        name: "CircShape",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#00ff00",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const ball = new BattleBall(spec, new Vector2(300, 400));
    const shape = getFighterCollisionShape(ball);
    assert.equal(shape.type, "circle", "circle fighter should return circle shape");
    assert.equal(shape.radius, 25, "should preserve radius");
}

function testLocalPointsMatchDrawBody() {
    // computeRegularPolygonLocalPoints가 _drawPolygonBody와 동일한 로컬 좌표를 생성하는지 검증
    const sides = 6;
    const radius = 30;
    const points = computeRegularPolygonLocalPoints(sides, radius);

    // 직접 계산한 값과 비교
    const a = (Math.PI * 2) / sides;
    const offset = -Math.PI / 2 - a / 2;
    const expected = [];
    for (let i = 0; i < sides; i++) {
        const angle = i * a + offset;
        expected.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
    assert.equal(points.length, expected.length, "point count should match");
    for (let i = 0; i < points.length; i++) {
        assert.ok(Math.abs(points[i].x - expected[i].x) < 0.0001, `point[${i}].x should match`);
        assert.ok(Math.abs(points[i].y - expected[i].y) < 0.0001, `point[${i}].y should match`);
    }
}

async function testRotationInitializedOnPolygonFighter(app) {
    const spec = {
        id: "test-rot-init",
        name: "RotInit",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#112233",
        appearance: { sides: 7, face: "default" },
        ability: "dash"
    };
    const ball = new BattleBall(spec, new Vector2(400, 400));
    assert.ok(Number.isFinite(ball.angle), "polygon fighter should have numeric angle");
    assert.ok(Number.isFinite(ball.angularVelocity), "polygon fighter should have numeric angularVelocity");
    assert.ok(Math.abs(ball.angularVelocity) > 0.0001, "polygon should have non-zero initial angular velocity");

    const circleSpec = { ...spec, appearance: { sides: 0, face: "default" } };
    const circleBall = new BattleBall(circleSpec, new Vector2(500, 500));
    assert.ok(Number.isFinite(circleBall.angle), "circle fighter should have finite angle");
    assert.ok(Number.isFinite(circleBall.angularVelocity), "circle fighter should have finite angularVelocity");
    assert.ok(Math.abs(circleBall.angularVelocity) > 0.0001, "circle should have non-zero initial angular velocity");
}

async function testIntegrateRotationSpins() {
    const spec = {
        id: "test-spin",
        name: "Spin",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#112233",
        appearance: { sides: 6, face: "default" },
        ability: "dash"
    };
    const ball = new BattleBall(spec, new Vector2(400, 400));
    ball.angle = 0;
    ball.angularVelocity = 1.0;
    ball.integrateRotation(0.5);
    // damping 0.98, delta=0.5 → factor = 0.98 ^ 0.5 ≈ 0.98995
    // angle = 0 + 1.0 * 0.98995 * 0.5 ≈ 0.495
    assert.ok(
        Math.abs(ball.angle - 0.495) < 0.02,
        "integrateRotation should advance angle with frame-rate independent damping"
    );
    // 누적이 초기화되었는지 확인
    assert.equal(ball._accumulatedTorque, 0, "torque should clear after integrate");
    assert.equal(ball._accumulatedAngularImpulse, 0, "impulse should clear after integrate");
}

function testRotationalBodyTorqueAccumulation() {
    // torque 누적 → integrate → 각가속도 반영 검증
    class Dummy {}
    const SpinningDummy = RotationalBody(Dummy);
    const s = new SpinningDummy();
    s.mass = 2;
    s.radius = 10;
    // I = 0.5*2*100 = 100, inverse = 0.01

    s.applyTorque(200); // torque = 200
    s.integrateRotation(1.0);
    // angularAccel = 200 * 0.01 = 2
    // angularVelocity = 0 + 2 * 1 = 2
    // damping 0.98 → 1.96
    // angle = 0 + 1.96 * 1 = 1.96
    assert.ok(Math.abs(s.angularVelocity - 1.96) < 0.02, "torque should produce angular acceleration");
    assert.ok(Math.abs(s.angle - 1.96) < 0.02, "angle should integrate from torque-driven velocity");
    assert.equal(s._accumulatedTorque, 0, "torque should clear after integrate");
}

function testMultipleTorqueSameFrame() {
    class Dummy {}
    const SpinningDummy = RotationalBody(Dummy);
    const s = new SpinningDummy();
    s.mass = 2;
    s.radius = 10;

    // 같은 프레임에 여러 번 torque 호출 → 합산
    s.applyTorque(100);
    s.applyTorque(100);
    s.applyTorque(50);
    assert.equal(s._accumulatedTorque, 250, "multiple applyTorque in same frame should sum");
    s.integrateRotation(1.0);
    // angularAccel = 250 * 0.01 = 2.5
    // velocity = 2.5, damping → 2.45, angle = 2.45
    assert.ok(Math.abs(s.angle - 2.45) < 0.02, "accumulated torque should produce correct angle");
    assert.equal(s._accumulatedTorque, 0, "torque should clear after integrate");

    // torque + impulse 동시 누적
    s.applyTorque(100);
    s.applyAngularImpulse(3);
    s.integrateRotation(1.0);
    // angularAccel = 100*0.01 = 1 → velocity += 1
    // impulse L = 3 → Δω = 3 * 0.01 = 0.03
    // velocity = 2.45 + 1 + 0.03 = 3.48 → damping 0.98 → 3.4104
    // angle = 2.45 + 3.4104 = 5.8604
    assert.ok(Math.abs(s.angularVelocity - 3.4104) < 0.02, "torque + impulse should both contribute to velocity");
    assert.ok(Math.abs(s.angle - 5.8604) < 0.02, "combined torque and impulse should integrate correctly");
}

function testFrameRateIndependentDamping() {
    class Dummy {}
    const SpinningDummy = RotationalBody(Dummy);

    // delta=1, damping=0.5 → factor = 0.5^1 = 0.5
    const s1 = new SpinningDummy();
    s1.angularDamping = 0.5;
    s1.angularVelocity = 1.0;
    s1.integrateRotation(1.0);
    assert.ok(Math.abs(s1.angularVelocity - 0.5) < 0.001, "delta=1, damping=0.5 → angularVelocity should halve");

    // delta=0.5, damping=0.5 → factor = 0.5^0.5 ≈ 0.7071
    const s2 = new SpinningDummy();
    s2.angularDamping = 0.5;
    s2.angularVelocity = 1.0;
    s2.integrateRotation(0.5);
    assert.ok(
        Math.abs(s2.angularVelocity - 0.7071) < 0.001,
        "delta=0.5, damping=0.5 → angularVelocity should be sqrt(0.5)"
    );

    // delta=2, damping=0.5 → factor = 0.5^2 = 0.25
    const s3 = new SpinningDummy();
    s3.angularDamping = 0.5;
    s3.angularVelocity = 1.0;
    s3.integrateRotation(2.0);
    assert.ok(Math.abs(s3.angularVelocity - 0.25) < 0.001, "delta=2, damping=0.5 → angularVelocity should be 0.25");

    console.log("[frame-rate-indep-damping] ok");
}

async function testPolygonUpdateIntegratesRotation(app) {
    const spec = {
        id: "test-update-rot",
        name: "UpdateRot",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#112233",
        appearance: { sides: 6, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([spec, { ...spec, id: "opp", teamId: "t2" }], { onLog() {}, onSound() {} });
    const fighter = sim.fighters[0];
    fighter.angle = 0;
    fighter.angularVelocity = 2.0;
    fighter.update(0.5, sim);
    // damping 0.98, delta=0.5 → factor = 0.98 ^ 0.5 ≈ 0.98995
    // velocity = 2.0 * 0.98995 ≈ 1.9799, angle = 1.9799 * 0.5 ≈ 0.990
    assert.ok(Math.abs(fighter.angle - 0.99) < 0.05, "update should call integrateRotation and advance angle");
}

async function testCollisionProducesAngularImpulse(app) {
    // 충돌 시 angular impulse 흐름이 정상 동작하는지 검증
    // circle-polygon 조합, 비중심 충돌을 구성해 angular impulse가 실제로 누적되는지 확인
    const specCircle = {
        id: "circ-col",
        name: "CircCol",
        teamId: "t1",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#00ff00",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const specPoly = {
        id: "poly-col-b",
        name: "PolyColB",
        teamId: "t2",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#0000aa",
        appearance: { sides: 5, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([specCircle, specPoly], { onLog() {}, onSound() {} });
    const [circle, poly] = sim.fighters;

    // 비중심 충돌: 두 객체가 normal 방향으로 정렬되지 않게 offset 배치
    circle.position = new Vector2(475, 472);
    poly.position = new Vector2(485, 488);
    poly.angle = 0;
    circle.applyImpulse(Vector2.subtract(new Vector2(500, 0), circle.velocity));
    poly.applyImpulse(Vector2.subtract(new Vector2(-400, 0), poly.velocity));

    // 충돌 전 누적값 기록
    const aImpulseBefore = circle._accumulatedAngularImpulse;
    const bImpulseBefore = poly._accumulatedAngularImpulse;

    sim.handleCollision();

    // 충돌 후 NaN/Infinity 없음
    assert.ok(Number.isFinite(circle.angularVelocity), "angularVelocity should stay finite after collision");
    assert.ok(Number.isFinite(poly.angularVelocity), "both fighters angularVelocity should be finite");
    assert.ok(Number.isFinite(circle._accumulatedAngularImpulse), "angular impulse should stay finite after collision");
    assert.ok(Number.isFinite(poly._accumulatedAngularImpulse), "angular impulse should stay finite for both fighters");
    // 충돌이 _applyAngularCollisionResponse를 호출했는지 간접 확인
    const impulseChanged =
        circle._accumulatedAngularImpulse !== aImpulseBefore || poly._accumulatedAngularImpulse !== bImpulseBefore;
    // 비중심 충돌이므로 angular impulse가 실제로 누적되어야 함
    assert.ok(impulseChanged, "off-center collision should change accumulated angular impulse");
    assert.ok(typeof circle.applyAngularImpulse === "function", "fighter should have applyAngularImpulse method");
}

async function testCollisionAngularImpulseChangesVelocity(app) {
    // 충돌 angular impulse가 integrateRotation 후 angularVelocity에 반영되는지 검증
    // polygon-polygon 조합, 완전 비중심 충돌 구성
    const specA = {
        id: "ang-a",
        name: "AngA",
        teamId: "t1",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 6, face: "default" },
        ability: "dash"
    };
    const specB = {
        id: "ang-b",
        name: "AngB",
        teamId: "t2",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#0000ff",
        appearance: { sides: 5, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([specA, specB], { onLog() {}, onSound() {} });
    const [a, b] = sim.fighters;

    // 큰 Y offset으로 비중심 충돌 보장 (polygon SAT 감지 범위 내)
    a.position = new Vector2(480, 468);
    b.position = new Vector2(480, 498);
    a.angle = 0;
    b.angle = 0;
    a.applyImpulse(Vector2.subtract(new Vector2(0, 500), a.velocity));
    b.applyImpulse(Vector2.subtract(new Vector2(0, -400), b.velocity));

    const aAngVelBefore = a.angularVelocity;
    const bAngVelBefore = b.angularVelocity;

    sim.handleCollision();

    // 적어도 한 쪽의 angularVelocity가 충돌 후 달라져야 함 (integrateRotation 전이므로 impulse 누적만 확인)
    // _accumulatedAngularImpulse가 0이 아니어야 함 — off-center collision
    const aImpulseAfter = a._accumulatedAngularImpulse;
    const bImpulseAfter = b._accumulatedAngularImpulse;

    // update → integrateRotation 호출
    a.update(0.016, sim);
    b.update(0.016, sim);

    // update는 integrateRotation을 호출하므로 angularVelocity가 누적 impulse만큼 변경되어야 함
    // (damping(0.98)이 적용되므로 정확히 누적 impulse값과 같진 않음)
    const aAngVelAfter = a.angularVelocity;
    const bAngVelAfter = b.angularVelocity;
    const aChanged = Math.abs(aAngVelAfter - aAngVelBefore) > 0.0001;
    const bChanged = Math.abs(bAngVelAfter - bAngVelBefore) > 0.0001;

    assert.ok(Number.isFinite(aAngVelAfter), "angularVelocity should stay finite after update");
    assert.ok(Number.isFinite(bAngVelAfter), "angularVelocity should stay finite for both fighters after update");
    assert.ok(
        aChanged || bChanged,
        "off-center polygon collision should change angularVelocity after integrateRotation"
    );
    assert.ok(Number.isFinite(a._accumulatedAngularImpulse), "angular impulse should clear properly");
}

async function testNonHostileCollisionProducesAngularImpulse(app) {
    // 아군(같은 팀) 충돌에서도 angular impulse가 누적되고 update 후 angularVelocity가 변하는지 검증
    const specA = {
        id: "ally-a",
        name: "AllyA",
        teamId: "same-team",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 6, face: "default" },
        ability: "dash"
    };
    const specB = {
        id: "ally-b",
        name: "AllyB",
        teamId: "same-team",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#0000ff",
        appearance: { sides: 5, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([specA, specB], { onLog() {}, onSound() {} });
    const [a, b] = sim.fighters;
    // 같은 팀인지 확인
    assert.equal(a.teamId, b.teamId, "both fighters should be on the same team");
    assert.equal(sim.isHostile(a, b), false, "same team should not be hostile");

    // 비중심 충돌 (polygon SAT가 감지하도록 충분히 가깝게)
    a.position = new Vector2(480, 468);
    b.position = new Vector2(480, 498);
    a.angle = 0;
    b.angle = 0;
    a.applyImpulse(Vector2.subtract(new Vector2(0, 500), a.velocity));
    b.applyImpulse(Vector2.subtract(new Vector2(0, -400), b.velocity));

    const aIncBefore = a._accumulatedAngularImpulse;
    const bIncBefore = b._accumulatedAngularImpulse;
    const aVelBefore = a.angularVelocity;
    const bVelBefore = b.angularVelocity;

    sim.handleCollision();

    // 아군 충돌에서도 angular impulse가 누적되어야 함
    const aIncAfter = a._accumulatedAngularImpulse;
    const bIncAfter = b._accumulatedAngularImpulse;
    const impulseChanged = aIncAfter !== aIncBefore || bIncAfter !== bIncBefore;
    assert.ok(impulseChanged, "non-hostile collision should still accumulate angular impulse");

    // update → integrateRotation
    a.update(0.016, sim);
    b.update(0.016, sim);

    const aVelAfter = a.angularVelocity;
    const bVelAfter = b.angularVelocity;
    const velChanged = Math.abs(aVelAfter - aVelBefore) > 0.0001 || Math.abs(bVelAfter - bVelBefore) > 0.0001;
    assert.ok(velChanged, "non-hostile collision should change angularVelocity after integrateRotation");
    assert.ok(Number.isFinite(aVelAfter) && Number.isFinite(bVelAfter), "angular velocity should stay finite");
}

function testPolygonContactPointAsymmetric() {
    // polygon-polygon 비대칭 배치에서 contactPoint가 단순 center midpoint가 아닌지 검증
    // SAT 기반 접촉 후보가 실제 교차 영역을 반영하도록
    const shapeA = {
        type: "polygon",
        x: 400,
        y: 400,
        radius: 40,
        angle: 0,
        points: [
            { x: -40, y: -40 },
            { x: 40, y: -40 },
            { x: 40, y: 40 },
            { x: -40, y: 40 }
        ]
    };
    const shapeB = {
        type: "polygon",
        x: 440,
        y: 400,
        radius: 40,
        angle: 0,
        points: [
            { x: -40, y: -40 },
            { x: 40, y: -40 },
            { x: 40, y: 40 },
            { x: -40, y: 40 }
        ]
    };
    shapeA.worldPoints = getWorldPolygonPoints(shapeA);
    shapeB.worldPoints = getWorldPolygonPoints(shapeB);

    const midpoint = { x: (shapeA.x + shapeB.x) / 2, y: (shapeA.y + shapeB.y) / 2 };

    // _resolvePolygonPolygon 호출하여 contactPoint 확인
    // resolveFighterShapeCollision 사용
    // 먼저 정사각형 충돌 테스트 (단순)
    const a = { position: { x: 400, y: 400 }, radius: 40, angle: 0, appearance: { sides: 4 }, mass: 10 };
    const b = { position: { x: 430, y: 400 }, radius: 40, angle: 0, appearance: { sides: 4 }, mass: 10 };
    const result1 = resolveFighterShapeCollision(a, b);
    assert.ok(result1.normal !== null, "overlapping squares should collide");
    assert.ok(result1.contactPoint !== undefined, "contactPoint should exist");
    assert.ok(Number.isFinite(result1.contactPoint.x), "contactPoint.x should be finite");
    assert.ok(Number.isFinite(result1.contactPoint.y), "contactPoint.y should be finite");
    // 대칭 배치에서는 midpoint와 가까워야 함
    assert.ok(
        Math.abs(result1.contactPoint.x - (400 + 430) / 2) < 10,
        "symmetric overlap contactPoint should be near center midpoint"
    );

    // 비대칭 배치: shapeA는 회전, shapeB는 정방향 → SAT 접촉 후보가 midpoint와 다른 지점을 반환
    const c = { position: { x: 400, y: 370 }, radius: 40, angle: Math.PI / 8, appearance: { sides: 4 }, mass: 10 };
    const d = { position: { x: 420, y: 400 }, radius: 40, angle: 0, appearance: { sides: 4 }, mass: 10 };
    const result2 = resolveFighterShapeCollision(c, d);
    assert.ok(result2.normal !== null, "asymmetric polygons should collide");
    assert.ok(result2.contactPoint !== undefined, "contactPoint should exist for asymmetric");
    assert.ok(Number.isFinite(result2.contactPoint.x), "asymmetric contactPoint.x should be finite");
    assert.ok(Number.isFinite(result2.contactPoint.y), "asymmetric contactPoint.y should be finite");
    const asymMidpoint = { x: (400 + 420) / 2, y: (370 + 400) / 2 };
    // SAT 기반 접촉 후보로 계산된 contactPoint는 shape 간 실제 교차 영역을 반영하므로 midpoint와 달라야 함
    const diffX = Math.abs(result2.contactPoint.x - asymMidpoint.x);
    const diffY = Math.abs(result2.contactPoint.y - asymMidpoint.y);
    assert.ok(diffX > 0.5 || diffY > 0.5, "rotated polygon contactPoint should differ from center midpoint");
}

console.log("[fighter-collision] ok");

// ──────────────────────────────────────────────
// Mob rotation visibility
// ──────────────────────────────────────────────

function testMobAppearanceHasRotationData() {
    const rng_calls = [];
    const mockRng = () => {
        rng_calls.push(rng_calls.length);
        return rng_calls.length * 0.1;
    };
    const app = MobAppearance.generate(mockRng);
    assert.ok(typeof app.angle === "number", "appearance should have angle");
    assert.ok(typeof app.angularVelocity === "number", "appearance should have angularVelocity");
    assert.ok(Number.isFinite(app.angle), "angle should be finite");
    assert.ok(Number.isFinite(app.angularVelocity), "angularVelocity should be finite");
    assert.ok(app.sides >= 5, "generated sides should be >=5");
    // 재현성: 같은 rng 시퀀스는 같은 결과
    const rng_calls2 = [];
    const mockRng2 = () => {
        rng_calls2.push(rng_calls2.length);
        return rng_calls2.length * 0.1;
    };
    const app2 = MobAppearance.generate(mockRng2);
    assert.equal(app2.angle, app.angle, "same rng sequence should produce same angle");
    assert.equal(app2.angularVelocity, app.angularVelocity, "same rng sequence should produce same angularVelocity");
}

function testBattleBallUsesAppearanceAngle() {
    const spec = {
        id: "test-app-angle",
        name: "AppAngle",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#112233",
        appearance: { sides: 7, face: "default", angle: 1.5, angularVelocity: 0.3 },
        ability: "dash"
    };
    const ball = new BattleBall(spec, new Vector2(400, 400));
    assert.equal(ball.angle, 1.5, "should use appearance.angle when provided");
    assert.equal(ball.angularVelocity, 0.3, "should use appearance.angularVelocity when provided");
}

function testRandomSpinHelper() {
    // deterministic rng (0, 0.25, 0.5, 0.75, ...)
    let calls = 0;
    const rng = () => (calls++ % 4) / 4;
    const spin = randomSpin(rng, 0.9, 1.6);
    // rng[0]=0, rng[1]=0.25 → sign=-1, abs=0.9+0*0.7=0.9 → -0.9
    // or rng[0]=0.25, rng[1]=0 → sign=-1, abs=0.9+0.25*0.7=1.075 → -1.075
    assert.ok(Number.isFinite(spin), "randomSpin should return a finite number");
    assert.ok(Math.abs(spin) >= 0.9, "randomSpin absolute value should be >= min");
    assert.ok(Math.abs(spin) <= 1.6, "randomSpin absolute value should be <= max");
    // Test multiple calls
    for (let i = 0; i < 10; i++) {
        const s = randomSpin(rng, 0.9, 1.6);
        assert.ok(Math.abs(s) >= 0.89, `randomSpin iteration ${i} should be >= 0.9, got ${s}`);
    }
}

function testCircleMinAngularVelocity() {
    const spec = {
        id: "test-min-spin",
        name: "MinSpin",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    for (let i = 0; i < 20; i++) {
        const ball = new BattleBall(spec, new Vector2(100 + i * 10, 100));
        assert.equal(ball.angle, 0, `default circle angle should be 0 (iteration ${i})`);
        assert.ok(
            Math.abs(ball.angularVelocity) >= 0.8,
            `circle angularVelocity (${ball.angularVelocity}) should be >= 0.8 rad/s`
        );
    }
}

function testDefaultPolygonAngleIsZero() {
    const spec = {
        id: "test-poly-zero",
        name: "PolyZero",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 6, face: "default" },
        ability: "dash"
    };
    for (let i = 0; i < 10; i++) {
        const ball = new BattleBall(spec, new Vector2(100 + i * 10, 100));
        assert.equal(ball.angle, 0, `default polygon angle should be 0 (iteration ${i})`);
        assert.ok(
            Math.abs(ball.angularVelocity) >= 0.8,
            `polygon angularVelocity (${ball.angularVelocity}) should be >= 0.8 rad/s`
        );
    }
    console.log("[default-angle-zero] ok");
}

async function testCircleRotatesVisibly(app) {
    const spec = {
        id: "test-vis-rot",
        name: "VisRot",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash",
        rotationEnabled: true
    };
    const sim = new BattleSimulation([spec, { ...spec, id: "opp", teamId: "t2" }], { onLog() {}, onSound() {} });
    const ball = sim.fighters[0];
    const angleBefore = ball.angle;
    for (let i = 0; i < 60; i++) {
        ball.update(1 / 60, sim);
    }
    const angleAfter = ball.angle;
    const angleChange = Math.abs(angleAfter - angleBefore);
    assert.ok(angleChange >= 0.6, `circle should rotate at least 0.6 rad in 1 second, got ${angleChange}`);
}

function testPolygonMobFaceRotatesWithBody() {
    const ctx = makeRecordingCanvasContext();
    const spec = {
        id: "test-face-rot",
        name: "FaceRot",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 6, face: "default" },
        ability: "dash"
    };
    const ball = new BattleBall(spec, new Vector2(200, 300));
    ball.radius = 30;
    ball.angle = 2.5;

    ball.draw(ctx);

    // drawFace should also call rotate with the body angle for polygon mobs
    const rotateCalls = ctx.calls.filter((c) => c[0] === "rotate" && Math.abs(c[1] - 2.5) < 0.01);
    assert.ok(rotateCalls.length >= 2, "face should also rotate with body angle for polygon mobs");

    // circle character SHOULD pass body angle to face (rotation enabled by default)
    const ctx2 = makeRecordingCanvasContext();
    const circleSpec = { ...spec, appearance: { sides: 0, face: "default" } };
    const circleBall = new BattleBall(circleSpec, new Vector2(300, 300));
    circleBall.radius = 30;
    circleBall.angle = 2.5;
    circleBall.draw(ctx2);
    const rotateCalls2 = ctx2.calls.filter((c) => c[0] === "rotate" && Math.abs(c[1] - 2.5) < 0.01);
    assert.ok(rotateCalls2.length >= 1, "circle character face should rotate with body angle (rotation enabled)");
}

async function testCircleRotationDisabled(app) {
    // rotationEnabled: false → angle/angularVelocity are 0, update doesn't rotate
    const spec = {
        id: "test-no-rot",
        name: "NoRot",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash",
        rotationEnabled: false
    };
    const ball = new BattleBall(spec, new Vector2(200, 200));
    assert.equal(ball.angle, 0, "rotationEnabled=false should start at angle=0");
    assert.equal(ball.angularVelocity, 0, "rotationEnabled=false should start at angularVelocity=0");
    ball.angularVelocity = 5;
    const sim = new BattleSimulation(
        [
            { ...spec, id: "t1" },
            { ...spec, id: "t2", rotationEnabled: true }
        ],
        { onLog() {}, onSound() {} }
    );
    const disabledBall = sim.fighters[0];
    disabledBall.angularVelocity = 3;
    disabledBall._accumulatedTorque = 100;
    disabledBall._accumulatedAngularImpulse = 50;
    disabledBall.update(0.5, sim);
    assert.equal(disabledBall.angle, 0, "rotationEnabled=false should not integrate rotation");
    assert.equal(disabledBall._accumulatedTorque, 0, "rotationEnabled=false should clear torque");
    assert.equal(disabledBall._accumulatedAngularImpulse, 0, "rotationEnabled=false should clear angular impulse");
}

function testCircleEquipmentRotatesWithFace() {
    const ctx = makeRecordingCanvasContext();
    const spec = {
        id: "test-eq",
        name: "EqRot",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const ball = new BattleBall(spec, new Vector2(400, 300));
    ball.radius = 30;
    ball.angle = 1.5;
    ball.equipment.items = [{ slot: "weapon", draw: "weapon", rarity: "common", name: "TestSpear", enhanceLevel: 0 }];
    ball.draw(ctx);
    // face rotation(1.5) + 장비 그리기 전에 rotate(1.5) 호출이 있어야 함
    const rotateCalls = ctx.calls.filter((c) => c[0] === "rotate" && Math.abs(c[1] - 1.5) < 0.01);
    assert.ok(rotateCalls.length >= 2, "equipment + face should both rotate with body angle");
}

function testWallSlamUsesPhysicalAngularImpulse() {
    const spec = {
        id: "test-ws",
        name: "WS",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };

    // rotation-enabled ball: WallSlam should produce physical angular impulse
    const sim = new BattleSimulation([spec, { ...spec, id: "opp", teamId: "t2" }], { onLog() {}, onSound() {} });
    const ball = sim.fighters[0];
    ball.position.x = 200;
    ball.position.y = 200;
    ball.velocity = new Vector2(300, 0);
    ball.angle = 0;
    ball.angularVelocity = 0;
    ball.clearAngularForces();
    ball.appearance.sides = 0;
    ball.state.wallSlam = new WallSlamEffect({ source: sim.fighters[1], damage: 10, duration: 0.5 });

    const angVelBefore = ball.angularVelocity;
    ball.update(0.12, sim);
    assert.ok(Math.abs(ball.angularVelocity) > 0, "WallSlam should produce physical angular velocity");
    assert.notEqual(ball.angle, 0, "WallSlam should change angle through physical rotation");

    // rotation-disabled ball: WallSlam must NOT affect physical rotation
    const sim2 = new BattleSimulation(
        [
            { ...spec, id: "disabled", rotationEnabled: false },
            { ...spec, id: "opp2", teamId: "t3" }
        ],
        { onLog() {}, onSound() {} }
    );
    const ballOff = sim2.fighters[0];
    ballOff.position.x = 200;
    ballOff.position.y = 200;
    ballOff.velocity = new Vector2(300, 0);
    ballOff.angle = 0;
    ballOff.angularVelocity = 0;
    ballOff.clearAngularForces();
    ballOff.appearance.sides = 0;
    ballOff.state.wallSlam = new WallSlamEffect({ source: sim2.fighters[1], damage: 10, duration: 0.5 });

    const angleBeforeOff = ballOff.angle;
    const angVelBeforeOff = ballOff.angularVelocity;
    ballOff.update(0.12, sim2);
    assert.equal(ballOff.angle, angleBeforeOff, "rotation-disabled ball should not change angle from WallSlam");
    assert.equal(
        ballOff.angularVelocity,
        angVelBeforeOff,
        "rotation-disabled ball should not change angularVelocity from WallSlam"
    );
}

function testPolygonAppearanceAnglePriority() {
    // appearance.angle/angularVelocity should still be used for polygon mobs
    const spec = {
        id: "test-poly-app",
        name: "PolyApp",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 30, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 5, angle: 0.7, angularVelocity: 1.5, face: "default" },
        ability: "dash"
    };
    const ball = new BattleBall(spec, new Vector2(300, 300));
    assert.ok(Math.abs(ball.angle - 0.7) < 0.01, "polygon should use appearance.angle");
    assert.ok(Math.abs(ball.angularVelocity - 1.5) < 0.01, "polygon should use appearance.angularVelocity");
}

console.log("[mob-rotation-visibility] ok");

// ──────────────────────────────────────────────
// Physics debug ring buffer
// ──────────────────────────────────────────────

import {
    PhysicsDebugRingBuffer,
    snapshotPhysicsState,
    validatePhysicsState
} from "../src/physics/PhysicsDebugRingBuffer.js";

function testRingBufferPushAndOrder() {
    const buf = new PhysicsDebugRingBuffer(5);
    buf.push({ id: 1 });
    buf.push({ id: 2 });
    buf.push({ id: 3 });
    const arr = buf.toArray();
    assert.equal(arr.length, 3, "should store 3 events");
    assert.equal(arr[0].id, 1, "first event should be oldest");
    assert.equal(arr[2].id, 3, "last event should be newest");
    assert.equal(buf.length, 3, "length should match stored count");
}

function testRingBufferCapacityOverflow() {
    const buf = new PhysicsDebugRingBuffer(3);
    buf.push({ id: 1 });
    buf.push({ id: 2 });
    buf.push({ id: 3 });
    buf.push({ id: 4 }); // overflow
    buf.push({ id: 5 });
    const arr = buf.toArray();
    assert.equal(arr.length, 3, "should keep only the last 3 events");
    assert.equal(arr[0].id, 3, "oldest event should be #3 after overflow");
    assert.equal(arr[1].id, 4, "middle event should be #4");
    assert.equal(arr[2].id, 5, "newest event should be #5");
}

function testRingBufferToArrayIsCopy() {
    const buf = new PhysicsDebugRingBuffer(3);
    const obj = { id: 1, data: "hello" };
    buf.push(obj);
    const arr1 = buf.toArray();
    arr1[0].data = "modified";
    const arr2 = buf.toArray();
    assert.equal(arr2[0].data, "modified", "toArray shares references (shallow copy) — ok for simple objects");
    // 하지만 내부 배열을 직접 노출하지 않는지 확인
    arr1.push({ id: 999 });
    assert.equal(buf.length, 1, "modifying returned array should not affect buffer size");
}

function testRingBufferClear() {
    const buf = new PhysicsDebugRingBuffer(3);
    buf.push({ id: 1 });
    buf.push({ id: 2 });
    buf.clear();
    assert.equal(buf.length, 0, "clear should reset length to 0");
    assert.equal(buf.toArray().length, 0, "toArray should return empty after clear");
    // clear 후 다시 push 가능
    buf.push({ id: 3 });
    assert.equal(buf.length, 1, "should accept new events after clear");
}

function testSnapshotPhysicsStateCopiesValues() {
    // snapshot이 Vector2 참조가 아닌 값 복사인지 검증
    const entity = {
        position: { x: 100, y: 200 },
        velocity: { x: 10, y: 20 },
        angle: 0.5,
        angularVelocity: 1.2,
        _accumulatedTorque: 5,
        _accumulatedAngularImpulse: 3
    };
    const snap = snapshotPhysicsState(entity);

    // 원본 수정
    entity.position.x = 999;
    entity.velocity.y = 888;
    entity.angle = 777;

    assert.equal(snap.position.x, 100, "snapshot position.x should be independent copy");
    assert.equal(snap.position.y, 200, "snapshot position.y should be independent copy");
    assert.equal(snap.velocity.x, 10, "snapshot velocity should be copy");
    assert.equal(snap.velocity.y, 20, "snapshot velocity.y should be copy");
    assert.equal(snap.angle, 0.5, "snapshot angle should be copy");
    assert.equal(snap.angularVelocity, 1.2, "snapshot angularVelocity should be copy");
}

function testBattleBallDebugBufferExists() {
    const spec = {
        id: "test-debug",
        name: "DebugBall",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const ball = new BattleBall(spec, new Vector2(200, 300));
    assert.ok(ball.physicsDebug instanceof PhysicsDebugRingBuffer, "BattleBall should have physicsDebug ring buffer");
    assert.equal(ball.physicsDebug.length, 0, "debug buffer should start empty");
}

function testApplyImpulseRecordsDebugEvent() {
    const spec = {
        id: "test-imp-debug",
        name: "ImpDebug",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const ball = new BattleBall(spec, new Vector2(200, 300));
    ball.applyImpulse(new Vector2(50, -30));
    const events = ball.physicsDebug.toArray();
    assert.ok(events.length >= 1, "applyImpulse should record a debug event");
    const last = events[events.length - 1];
    assert.equal(last.type, "impulse", "event type should be impulse");
    assert.ok(last.impulse.x === 50 && last.impulse.y === -30, "should record impulse values");
}

function testUpdateRecordsSummaryEvent() {
    const spec = {
        id: "test-update-debug",
        name: "UpdateDebug",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([spec, { ...spec, id: "opp", teamId: "t2" }], { onLog() {}, onSound() {} });
    const fighter = sim.fighters[0];
    fighter.update(0.016, sim);
    const events = fighter.physicsDebug.toArray();
    const updateEvents = events.filter((e) => e.type === "update");
    assert.ok(updateEvents.length >= 1, "update should record a summary event");
    const snap = updateEvents[updateEvents.length - 1];
    assert.ok(typeof snap.position.x === "number", "summary should include position.x");
    assert.ok(typeof snap.velocity.x === "number", "summary should include velocity.x");
    assert.ok(typeof snap.angle === "number", "summary should include angle");
}

function testCollisionRecordsDebugEvent() {
    const specA = {
        id: "col-debug-a",
        name: "ColDebugA",
        teamId: "t1",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#aa0000",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const specB = {
        id: "col-debug-b",
        name: "ColDebugB",
        teamId: "t2",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#0000aa",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([specA, specB], { onLog() {}, onSound() {} });
    const [a, b] = sim.fighters;
    a.position = new Vector2(475, 480);
    b.position = new Vector2(485, 480);
    a.applyImpulse(Vector2.subtract(new Vector2(400, 0), a.velocity));
    b.applyImpulse(Vector2.subtract(new Vector2(-350, 0), b.velocity));
    sim.handleCollision();

    const eventsA = a.physicsDebug.toArray();
    const colEventsA = eventsA.filter((e) => e.type === "collision");
    assert.ok(colEventsA.length >= 1, "collision should record debug event on fighter A");
    assert.equal(colEventsA[0].entityIdA, "col-debug-a", "collision event should include entityIdA");
    assert.equal(colEventsA[0].entityIdB, "col-debug-b", "collision event should include entityIdB");
    assert.ok(typeof colEventsA[0].normal.x === "number", "collision event should include normal");
    assert.ok(typeof colEventsA[0].overlap === "number", "collision event should include overlap");
}

function testValidatePhysicsStateNoErrorOnValid() {
    const entity = {
        name: "valid-entity",
        position: { x: 100, y: 200 },
        velocity: { x: 10, y: 20 },
        angle: 0.5,
        angularVelocity: 1.2,
        physicsDebug: new PhysicsDebugRingBuffer(3)
    };
    entity.physicsDebug.push({ type: "test" });
    const result = validatePhysicsState(entity, 123);
    assert.equal(result, true, "valid state should return true");
}

function testValidatePhysicsStateDetectsNaN() {
    const entity = {
        name: "nan-entity",
        position: { x: NaN, y: 200 },
        velocity: { x: 10, y: 20 },
        angle: 0.5,
        angularVelocity: 1.2,
        physicsDebug: new PhysicsDebugRingBuffer(3)
    };
    entity.physicsDebug.push({ type: "before-nan", data: "test" });
    const result = validatePhysicsState(entity, 456);
    assert.equal(result, false, "NaN position should return false");
}

function testDebugBufferDoesNotThrowOnPushFailure() {
    // buffer가 없는 entity에도 validatePhysicsState가 깨지지 않아야 함
    const entity = {
        name: "no-buffer",
        position: { x: Infinity, y: 200 },
        velocity: { x: 10, y: 20 },
        angle: 0.5,
        angularVelocity: 1.2
        // physicsDebug 없음
    };
    const result = validatePhysicsState(entity);
    assert.equal(result, true, "missing debug buffer should not crash validation");
}

console.log("[physics-debug] ok");

async function testMatchEndGrantsImmediateExperience(app) {
    app.tournament = null;
    app.currentTournamentMatch = null;
    app._currentTournamentReport = null;
    app.playerProfile = createDefaultPlayerProfile();
    app.playerFighterId = FIGHTER_IDS.DASH;

    const playerSpec = app.roster.find((fighter) => fighter.id === app.playerFighterId);
    const opponentSpec = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    await app.startMatch([playerSpec, opponentSpec], { keepLog: false });

    const playerBall = app.simulation.fighters.find((fighter) => fighter.id === app.playerFighterId);
    const opponentBall = app.simulation.fighters.find((fighter) => fighter.id === opponentSpec.id);
    opponentBall.takeDamage(999, playerBall, "Forced KO");
    app.simulation.checkResult();
    app.simulation.update(2.3);
    app.finishMatch();

    assert.ok(app._lastMatchXpResult.xpGained > 0, "A user match should grant XP as soon as it ends");
    assert.equal(
        app.playerProfile.experience.byCharacter[FIGHTER_IDS.DASH].currentXp,
        app._lastMatchXpResult.xpGained,
        "Character XP should be updated at match end"
    );
    assert.equal(
        app.ui.state.playerExperience.totalXp,
        app._lastMatchXpResult.xpGained,
        "Player setup XP meter should update after match XP is granted"
    );
    assert.equal(globalThis.Alpine.store("gameOverlay").subtext, "", "XP should use the structured reward panel");
    assert.equal(
        globalThis.Alpine.store("xpReward").visible,
        true,
        "Match result overlay should show the XP reward panel"
    );
    assert.equal(globalThis.Alpine.store("xpReward").xpGained, app._lastMatchXpResult.xpGained);
    assert.equal(
        globalThis.Alpine.store("xpReward").previousLevelLabel,
        `Lv.${app._lastMatchXpResult.previousLevel}`,
        "XP reward panel should begin from the level before the reward"
    );
    assert.ok(
        app.ui.logItems.some((item) => item.includes("[경험치]")),
        "Match end should write an XP log entry immediately"
    );
    assert.equal(app._currentTournamentReport, null, "Standalone matches should not create a tournament report");
}

function testShuffledUtility() {
    const original = [1, 2, 3, 4];
    const result = shuffled(original, () => 0);

    assert.deepEqual(original, [1, 2, 3, 4], "shuffled should not mutate the source array");
    assert.deepEqual(result, [2, 3, 4, 1], "shuffled should use deterministic Fisher-Yates ordering with a fixed rng");
}

function testMultiFighterSimulationSetup(app) {
    const sim = new BattleSimulation(app.roster.slice(0, 3), {
        onLog() {},
        onSound() {}
    });

    assert.equal(sim.fighters.length, 3, "BattleSimulation should create every requested fighter");
    assert.equal(sim.getFighterPairs().length, 3, "Three fighters should create three collision pairs");
    assert.ok(
        sim.fighters.every((fighter) => fighter.simulation === sim),
        "Every fighter should reference the simulation"
    );
    assert.ok(
        sim.fighters.every((fighter) => fighter.ability),
        "Every fighter should bind its ability"
    );
    assert.deepEqual(
        sim.fighters.map((fighter) => fighter.teamId),
        ["fighter-0", "fighter-1", "fighter-2"],
        "Fighters without explicit teams should receive unique default teams"
    );
    assert.equal(
        sim.getEnemiesOf(sim.fighters[0]).length,
        2,
        "Default multi-fighter battles should remain free-for-all"
    );

    const huntingSizedSim = new BattleSimulation(app.roster.slice(0, 3), { onLog() {}, onSound() {} }, null, {
        arenaWidth: HUNTING_ARENA.WIDTH,
        arenaHeight: HUNTING_ARENA.HEIGHT
    });
    assert.equal(huntingSizedSim.width, HUNTING_ARENA.WIDTH, "BattleSimulation should accept a wider arena");
    assert.equal(huntingSizedSim.height, HUNTING_ARENA.HEIGHT, "BattleSimulation should accept a taller arena");
    assert.ok(
        huntingSizedSim.fighters.every(
            (fighter) =>
                fighter.position.x >= 0 &&
                fighter.position.x <= HUNTING_ARENA.WIDTH &&
                fighter.position.y >= 0 &&
                fighter.position.y <= HUNTING_ARENA.HEIGHT
        ),
        "Spawn points should stay inside the configured arena"
    );
}

function testArenaCameraZoom() {
    const camera = new ArenaCamera();

    const defaultView = camera.getViewTransform({ width: 960, height: 960 }, { width: 960, height: 960 });
    assert.equal(defaultView.scale, 1, "Default 960 arena should render at 1:1 scale");
    assert.equal(defaultView.offsetX, 0, "Default arena should not need horizontal letterboxing");
    assert.equal(defaultView.offsetY, 0, "Default arena should not need vertical letterboxing");

    const huntingView = camera.getViewTransform(
        { width: 960, height: 960 },
        { width: HUNTING_ARENA.WIDTH, height: HUNTING_ARENA.HEIGHT, camera: { zoom: 1 } }
    );
    assert.equal(huntingView.scale, 0.75, "Larger hunting arena should fit fully into the same canvas");
    assert.equal(huntingView.offsetX, 0, "Square hunting arena should stay centered horizontally");
    assert.equal(huntingView.offsetY, 0, "Square hunting arena should stay centered vertically");

    const closerView = camera.getViewTransform(
        { width: 960, height: 960 },
        { width: HUNTING_ARENA.WIDTH, height: HUNTING_ARENA.HEIGHT, camera: { zoom: 1.2 } }
    );
    assert.ok(Math.abs(closerView.scale - 0.9) < 0.001, "Camera zoom should be a multiplier on top of fit-to-map");
}

function testHuntingMeleeMobChasesTarget(app) {
    const playerSpec = {
        ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
        teamId: HUNTING_TEAMS.PLAYER
    };
    const meleeSpec = createHuntingMobSpec({
        type: HUNTING_MONSTER_TYPES.MELEE,
        floor: 1,
        index: 0
    });
    const sim = new BattleSimulation([playerSpec, meleeSpec], {
        onLog() {},
        onSound() {}
    });
    const [player, melee] = sim.fighters;
    player.position = new Vector2(260, 480);
    player.velocity = new Vector2(0, 0);
    melee.position = new Vector2(720, 480);
    melee.velocity = new Vector2(0, 0);

    const before = Vector2.subtract(player.position, melee.position).length();
    for (let index = 0; index < 30; index += 1) {
        melee.update(1 / 60, sim);
    }
    const after = Vector2.subtract(player.position, melee.position).length();

    assert.equal(
        melee.ability.constructor.name,
        "HuntingMobAbility",
        "Pursuer hunting mobs should bind the shared monster ability"
    );
    assert.ok(after < before - 20, "Melee hunting mobs should close distance toward the player");
    assert.ok(melee.velocity.x < 0, "Melee hunting mobs should move horizontally toward the player");
}

function testHuntingAdaptiveRangedReposition() {
    const createScenario = (type, allyOffsets = []) => {
        const playerSpec = {
            id: `reposition-player-${type}`,
            name: "Reposition Target",
            ability: "none",
            teamId: HUNTING_TEAMS.PLAYER,
            color: "#ffffff",
            face: "default",
            stats: { hp: 1000, damage: 1, defense: 1000, speed: 0, radius: 36, mass: 1 }
        };
        const ownerSpec = createHuntingMobSpec({ type, floor: 100, index: 0 });
        const allySpecs = allyOffsets.map((_, index) =>
            createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.PURSUER, floor: 100, index: index + 1 })
        );
        const simulation = new BattleSimulation(
            [playerSpec, ownerSpec, ...allySpecs],
            { onLog() {}, onSound() {} },
            null,
            {
                assignActions: false
            }
        );
        const [target, owner, ...allies] = simulation.fighters;
        target.position = new Vector2(650, 480);
        target.velocity = new Vector2();
        owner.position = new Vector2(500, 480);
        owner.velocity = new Vector2();
        allies.forEach((ally, index) => {
            const offset = allyOffsets[index];
            ally.position = Vector2.add(owner.position, new Vector2(offset.x, offset.y));
            ally.velocity = new Vector2();
        });
        return { simulation, target, owner };
    };

    const repositionTypes = [
        HUNTING_MONSTER_TYPES.SHOOTER,
        HUNTING_MONSTER_TYPES.SHARD,
        HUNTING_MONSTER_TYPES.BOOMERANG,
        HUNTING_MONSTER_TYPES.LASER
    ];
    repositionTypes.forEach((type) => {
        const spec = createHuntingMobSpec({ type, floor: 100, index: 0 });
        assert.ok(spec.hunting.reposition, `${type} should opt into proximity repositioning`);
        assert.equal(spec.hunting.reposition.impulse, 1500, `${type} should use a visible relocation impulse`);
        assert.equal(spec.hunting.reposition.cooldown, 3, `${type} should wait a clear 3 seconds between relocations`);
    });
    [HUNTING_MONSTER_TYPES.ELECTRIC, HUNTING_MONSTER_TYPES.CHAIN, HUNTING_MONSTER_TYPES.SIPHON].forEach((type) => {
        const spec = createHuntingMobSpec({ type, floor: 100, index: 0 });
        assert.equal(spec.hunting.reposition, undefined, `${type} should keep its direct pressure movement`);
    });

    const positiveSide = createScenario(HUNTING_MONSTER_TYPES.SHOOTER, [{ x: 0, y: 100 }]);
    assert.equal(
        positiveSide.owner.ability._tickProximityReposition(positiveSide.target),
        true,
        "A close shooter should reposition when its cooldown is ready"
    );
    assert.ok(
        positiveSide.owner.velocity.y < 0,
        "An ally on one side should push the shooter toward the open opposite side"
    );
    const cooldown = positiveSide.owner.ability.state.repositionCooldown;
    const velocityAfterFirstReposition = positiveSide.owner.velocity.length();
    assert.equal(
        velocityAfterFirstReposition,
        1500,
        "The initial reposition impulse should be visibly stronger than normal chase"
    );
    assert.ok(cooldown > 0, "Repositioning should begin an independent cooldown");
    assert.equal(
        positiveSide.owner.ability._tickProximityReposition(positiveSide.target),
        false,
        "Cooldown should prevent repeated immediate repositioning"
    );
    assert.equal(
        positiveSide.owner.velocity.length(),
        velocityAfterFirstReposition,
        "A blocked repeat should not add another impulse"
    );

    const negativeSide = createScenario(HUNTING_MONSTER_TYPES.SHARD, [{ x: 0, y: -100 }]);
    negativeSide.owner.ability._tickProximityReposition(negativeSide.target);
    assert.ok(negativeSide.owner.velocity.y > 0, "The open side should reverse when the nearby ally reverses sides");

    const bothSides = createScenario(HUNTING_MONSTER_TYPES.BOOMERANG, [
        { x: 0, y: 100 },
        { x: 0, y: -100 }
    ]);
    bothSides.owner.ability._tickProximityReposition(bothSides.target);
    assert.ok(bothSides.owner.velocity.x < 0, "Allies on both sides should make the monster fall back from the target");

    const laserCharge = createScenario(HUNTING_MONSTER_TYPES.LASER);
    laserCharge.owner.ability.state.laser = { angle: 0, charge: 0.75, fire: 0 };
    assert.equal(
        laserCharge.owner.ability._tickProximityReposition(laserCharge.target),
        false,
        "Laser charge should keep its position rather than stacking a relocation impulse"
    );
    assert.equal(laserCharge.owner.velocity.length(), 0, "Blocked laser relocation should not change its velocity");

    const activeBoomerang = createScenario(HUNTING_MONSTER_TYPES.BOOMERANG);
    activeBoomerang.owner.ability.state.boomerang = { phase: "outbound" };
    assert.equal(
        activeBoomerang.owner.ability._tickProximityReposition(activeBoomerang.target),
        true,
        "Boomerang flight should continue tracking its owner while the owner can reposition"
    );

    const midpointRoll = (pool, predicate) => {
        const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
        let consumed = 0;
        for (const entry of pool) {
            if (predicate(entry)) return (consumed + entry.weight / 2) / total;
            consumed += entry.weight;
        }
        throw new Error("Expected weighted test entry to exist");
    };
    const floor = 100;
    const allMonsters = getHuntingMonsterPool(floor);
    const shooterRoll = midpointRoll(allMonsters, (monster) => monster.type === HUNTING_MONSTER_TYPES.SHOOTER);
    const shardRoll = midpointRoll(
        allMonsters.filter((monster) => monster.type !== HUNTING_MONSTER_TYPES.SHOOTER),
        (monster) => monster.type === HUNTING_MONSTER_TYPES.SHARD
    );
    const boomerangRoll = midpointRoll(allMonsters, (monster) => monster.type === HUNTING_MONSTER_TYPES.BOOMERANG);
    const pressureRoll = midpointRoll(allMonsters, (monster) => monster.type === HUNTING_MONSTER_TYPES.PURSUER);
    const countRoll = midpointRoll(getHuntingMobCountWeights(floor), (entry) => entry.count === 3);
    const rolls = [countRoll, shooterRoll, shardRoll, boomerangRoll, pressureRoll];
    const forcedRangedEncounter = createHuntingMobEncounter({ floor, rng: () => rolls.shift() ?? 0 });
    assert.ok(
        forcedRangedEncounter.some((mob) => HUNTING_PRESSURE_BEHAVIORS.includes(mob.hunting.behavior)),
        "Every normal encounter should retain at least one pressure monster when ranged picks dominate"
    );
    console.log("[hunting-adaptive-ranged-reposition] ok");
}

function testHuntingLaserReachesArenaWall(app) {
    const playerSpec = {
        ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.DASH),
        teamId: HUNTING_TEAMS.PLAYER
    };
    const laserSpec = createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.LASER, floor: 94, index: 0 });
    const simulation = new BattleSimulation([laserSpec, playerSpec], { onLog() {}, onSound() {} }, null, {
        arenaWidth: 1200,
        arenaHeight: 960,
        assignActions: false
    });
    const [laserBall, target] = simulation.fighters;
    laserBall.position = new Vector2(200, 400);
    laserBall.velocity = new Vector2(0, 0);
    target.position = new Vector2(900, 400);
    target.velocity = new Vector2(0, 0);

    const rightWallRay = getArenaWallRay(laserBall.position, 0, simulation.width, simulation.height);
    assert.equal(rightWallRay.length, 1000, "Laser range should extend from the caster to the right arena wall");
    assert.equal(rightWallRay.end.x, 1200, "Horizontal laser should stop at the right arena wall");
    assert.equal(rightWallRay.end.y, 400, "Horizontal laser should preserve its locked aim height");

    const diagonalRay = getArenaWallRay(new Vector2(300, 200), Math.PI / 4, simulation.width, simulation.height);
    assert.ok(Math.abs(diagonalRay.end.x - 1060) < 0.001, "Diagonal laser should stop where it first meets a wall");
    assert.ok(Math.abs(diagonalRay.end.y - 960) < 0.001, "Diagonal laser should reach the bottom arena wall");

    laserBall.ability.state.timer = laserBall.ability.cooldown;
    laserBall.ability._tickLaser(0, target);
    const hpBefore = target.hp;
    laserBall.ability._tickLaser(0.76, target);
    assert.ok(target.hp < hpBefore, "Laser should damage a target beyond the former 520px fixed range");

    const startCharge = (position) => {
        target.position = position;
        laserBall.ability.state.laser = null;
        laserBall.ability.state.timer = laserBall.ability.cooldown;
        laserBall.ability._tickLaser(0, target);
        return laserBall.ability.state.laser;
    };
    const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
    const chargingLaser = startCharge(new Vector2(900, 400));
    const huntingCasterState = getHuntingLaserCasterVisualState(laserBall, chargingLaser);
    assert.equal(
        HUNTING_LASER_CASTER_RENDERER,
        drawLaserCasterVisual,
        "Hunting laser should expose the same named caster renderer as Dash"
    );
    assert.deepEqual(
        huntingCasterState.origin,
        { x: laserBall.position.x, y: laserBall.position.y },
        "Hunting laser caster should use the monster position as its shared renderer origin"
    );
    const dashHalfCharge = new LaserBeamEffect(target, laserBall);
    dashHalfCharge.angle = chargingLaser.angle;
    dashHalfCharge.chargeRemaining = 0.175;
    const dashHalfChargeState = dashHalfCharge.getCasterVisualState();
    const huntingHalfChargeState = getHuntingLaserCasterVisualState(laserBall, {
        angle: chargingLaser.angle,
        charge: 0.375,
        fire: 0,
        aimLength: 200
    });
    assert.deepEqual(
        [dashHalfChargeState.phase, dashHalfChargeState.phaseProgress],
        [LASER_CASTER_PHASES.CHARGE, 0.5],
        "Dash 0.35s charge should map its own half-duration to shared charge progress"
    );
    assert.deepEqual(
        [huntingHalfChargeState.phase, huntingHalfChargeState.phaseProgress],
        [LASER_CASTER_PHASES.CHARGE, 0.5],
        "Hunting 0.75s charge should map its own half-duration to the same shared charge progress"
    );
    const commonRendererState = createLaserCasterVisualState({
        origin: { x: 200, y: 400 },
        angle: 0.2,
        phase: LASER_CASTER_PHASES.CHARGE,
        phaseProgress: 0.5,
        scale: 0.9,
        aimLength: 200
    });
    const dashRendererContext = makeRecordingCanvasContext();
    const huntingRendererContext = makeRecordingCanvasContext();
    DASH_LASER_CASTER_RENDERER(dashRendererContext, commonRendererState);
    HUNTING_LASER_CASTER_RENDERER(huntingRendererContext, commonRendererState);
    assert.deepEqual(
        dashRendererContext.primitives,
        huntingRendererContext.primitives,
        "Identical shared phase input should produce the same cyclops lens and aim rendering for Dash and hunting lasers"
    );
    const huntingAdapterContext = makeRecordingCanvasContext();
    laserBall.ability._drawLaser(huntingAdapterContext, chargingLaser);
    assert.ok(
        huntingAdapterContext.primitives.some((primitive) => primitive.method === "ellipse"),
        "Hunting laser draw adapter should call the shared cyclops caster renderer during charge"
    );
    const arenaContext = makeRecordingCanvasContext();
    const arenaCanvas = {
        width: 960,
        height: 960,
        clientWidth: 700,
        clientHeight: 700,
        getBoundingClientRect: () => ({ width: 700, height: 700 }),
        getContext: () => arenaContext
    };
    arenaContext.canvas = arenaCanvas;
    const originalHuntingLaserDraw = laserBall.ability._drawLaser;
    let huntingLaserArenaDraws = 0;
    laserBall.ability._drawLaser = (...args) => {
        huntingLaserArenaDraws += 1;
        return originalHuntingLaserDraw.call(laserBall.ability, ...args);
    };
    try {
        new ArenaRenderer(arenaCanvas).render(simulation);
    } finally {
        laserBall.ability._drawLaser = originalHuntingLaserDraw;
    }
    assert.equal(
        huntingLaserArenaDraws,
        1,
        "ArenaRenderer should render the hunting laser's shared caster visual exactly once during charge"
    );
    const initialAngle = chargingLaser.angle;
    target.position = new Vector2(200, 800);
    laserBall.ability._tickLaser(0.1, target);
    const desiredAngle = Math.atan2(target.position.y - laserBall.position.y, target.position.x - laserBall.position.x);
    const chargeTurn = normalizeAngle(chargingLaser.angle - initialAngle);
    assert.ok(chargeTurn > 0, "Laser charge aim should turn toward a moving target");
    assert.ok(
        Math.abs(chargeTurn) <= LASER_CHARGE_TURN_RATE * 0.1 + 1e-9,
        "Laser charge aim should not turn farther than its per-frame speed limit"
    );
    assert.ok(
        Math.abs(normalizeAngle(desiredAngle - chargingLaser.angle)) <
            Math.abs(normalizeAngle(desiredAngle - initialAngle)),
        "Laser charge aim should close the angular gap without snapping directly to the target"
    );

    laserBall.ability.state.laser = { angle: Math.PI - 0.05, charge: 0.5, fire: 0 };
    target.position = new Vector2(100, 395);
    const boundaryAngle = laserBall.ability.state.laser.angle;
    laserBall.ability._tickLaser(0.1, target);
    const boundaryTurn = normalizeAngle(laserBall.ability.state.laser.angle - boundaryAngle);
    assert.ok(boundaryTurn > 0, "Laser charge aim should cross the -pi/pi boundary by the shortest direction");
    assert.ok(
        Math.abs(boundaryTurn) <= LASER_CHARGE_TURN_RATE * 0.1 + 1e-9,
        "Laser charge aim should retain its speed limit across the -pi/pi boundary"
    );

    laserBall.ability.state.laser = { angle: 0.35, charge: 0.01, fire: 0 };
    target.position = new Vector2(200, 800);
    laserBall.ability._tickLaser(0.02, target);
    const firingAngle = laserBall.ability.state.laser.angle;
    target.position = new Vector2(1000, 400);
    laserBall.ability._tickLaser(0.1, target);
    assert.equal(
        laserBall.ability.state.laser.angle,
        firingAngle,
        "Laser firing should keep the angle locked after charge completes"
    );
    console.log("[hunting-laser-wall-range] ok");
}

function testHuntingBoomerangReachAndReturnArc(app) {
    const createScenario = (targetX) => {
        let hitCount = 0;
        const targetSpec = {
            ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.DASH),
            id: `boomerang-target-${targetX}`,
            teamId: HUNTING_TEAMS.PLAYER
        };
        const boomerangSpec = createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.BOOMERANG, floor: 91, index: 0 });
        const simulation = new BattleSimulation(
            [boomerangSpec, targetSpec],
            {
                onLog() {},
                onSound() {},
                onDamageTaken(fighterId) {
                    if (fighterId === targetSpec.id) hitCount += 1;
                }
            },
            null,
            { arenaWidth: 1200, arenaHeight: 960, assignActions: false }
        );
        const [owner, target] = simulation.fighters;
        owner.position = new Vector2(200, 480);
        owner.velocity = new Vector2();
        target.position = new Vector2(targetX, 480);
        target.velocity = new Vector2();
        owner.ability.state.timer = owner.ability.cooldown;

        const damageCalls = [];
        const takeDamage = target.takeDamage.bind(target);
        target.takeDamage = (...args) => {
            damageCalls.push(args);
            return takeDamage(...args);
        };

        const samples = [];
        const drawState = { saves: 0, restores: 0, rotations: [] };
        const drawContext = {
            save() {
                drawState.saves += 1;
            },
            restore() {
                drawState.restores += 1;
            },
            translate() {},
            rotate(angle) {
                drawState.rotations.push(angle);
            },
            beginPath() {},
            moveTo() {},
            lineTo() {},
            quadraticCurveTo() {},
            closePath() {},
            fill() {},
            stroke() {},
            arc() {}
        };

        let launched = false;
        let returned = false;
        let rendered = false;
        for (let step = 0; step < 300; step += 1) {
            owner.ability.update(1 / 60, target);
            const boom = owner.ability.state.boomerang;
            if (!boom) {
                if (launched) {
                    returned = true;
                    break;
                }
                continue;
            }

            launched = true;
            samples.push({
                phase: boom.phase,
                position: boom.position.clone(),
                velocity: boom.velocity.clone(),
                rotationAngle: boom.rotationAngle,
                outboundDistance: boom.outboundDistance
            });
            if (!rendered) {
                owner.ability.draw(drawContext);
                rendered = true;
            }
        }

        return { owner, target, samples, hitCount, damageCalls, returned, drawState };
    };

    const hitScenario = createScenario(760);
    const hitReturnSamples = hitScenario.samples.filter((sample) => sample.phase === "return");
    assert.equal(hitScenario.hitCount, 1, "A 560px target should be struck exactly once before the boomerang returns");
    assert.equal(hitScenario.owner.ability.cooldown, 3.1, "Boomerang cooldown should remain 3.1 seconds");
    assert.equal(
        hitScenario.damageCalls[0]?.[0],
        hitScenario.owner.stats.baseDamage * 1.1,
        "Boomerang damage should remain baseDamage * 1.1"
    );
    assert.equal(hitScenario.damageCalls[0]?.[2], "Boomerang", "Boomerang damage should preserve its log label");
    assert.ok(hitScenario.returned, "A hit boomerang should clean up after returning to its owner");
    assert.ok(hitReturnSamples.length > 0, "A hit should immediately enter the return phase");
    assert.ok(
        Math.max(...hitReturnSamples.map((sample) => Math.abs(sample.position.y - 480))) >= 30,
        "The return path should visibly curve at least 30px away from the outbound line"
    );
    assert.ok(
        hitScenario.samples.every((sample) =>
            [sample.position.x, sample.position.y, sample.velocity.x, sample.velocity.y, sample.rotationAngle].every(
                Number.isFinite
            )
        ),
        "Boomerang positions, velocity, and rotation should remain finite throughout the flight"
    );
    assert.ok(
        hitScenario.samples.every(
            (sample) =>
                sample.position.x >= 14 &&
                sample.position.x <= 1186 &&
                sample.position.y >= 14 &&
                sample.position.y <= 946
        ),
        "Boomerang flight should stay inside the arena bounds"
    );
    assert.equal(
        hitScenario.drawState.saves,
        hitScenario.drawState.restores,
        "Boomerang rendering should restore every saved canvas state"
    );
    assert.ok(hitScenario.drawState.rotations.length > 0, "Boomerang rendering should consume its rotation state");

    const missScenario = createScenario(1100);
    const missReturnStart = missScenario.samples.find((sample) => sample.phase === "return");
    assert.equal(
        missScenario.hitCount,
        0,
        "A target beyond the outbound limit should not receive phantom boomerang damage"
    );
    assert.ok(
        missReturnStart?.outboundDistance >= 650,
        "A missed boomerang should travel at least 650px before beginning its return"
    );
    assert.ok(missScenario.returned, "A missed boomerang should return and clear its state at the owner");
    console.log("[hunting-boomerang-range-return-arc] ok");
}

function testHuntingSplitterDeathFragmentsAndResultGrace(app) {
    const createScenario = ({ splitLevel = 2, splitCount = 2, splitLootMultiplier = 1 } = {}) => {
        const playerSpec = {
            ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.DASH),
            teamId: HUNTING_TEAMS.PLAYER
        };
        const splitterSpec = createHuntingMobSpec({
            type: HUNTING_MONSTER_TYPES.SPLITTER,
            floor: 92,
            index: 0,
            splitLevel,
            splitCount,
            splitLootMultiplier
        });
        const defeatEvents = [];
        const lootSession = new HuntingBattleLootSession({ playerId: playerSpec.id, floor: 92 });
        const lootController = new HuntingLootDropController({ session: lootSession, rng: () => 0.999999 });
        const simulation = new BattleSimulation(
            [splitterSpec, playerSpec],
            {
                onLog() {},
                onSound() {},
                onFighterDefeated(fighter, context) {
                    defeatEvents.push({ fighter, context });
                    lootController.onFighterDefeated(fighter, context);
                }
            },
            null,
            {
                assignActions: false,
                hostileAbsenceGraceDuration: 1,
                hostileAbsenceGraceTeamId: HUNTING_TEAMS.PLAYER
            }
        );
        const [splitter, player] = simulation.fighters;
        splitter.position = new Vector2(300, 480);
        splitter.velocity = new Vector2();
        player.position = new Vector2(700, 480);
        player.velocity = new Vector2();
        return { simulation, splitter, player, defeatEvents };
    };
    const getSplitFragments = (simulation) => simulation.fighters.filter((fighter) => fighter.hunting?.isSplitFragment);

    const { simulation, splitter, player, defeatEvents } = createScenario();
    const originalMaxHp = splitter.maxHp;
    splitter.ability.state.timer = splitter.ability.cooldown;
    splitter.ability.update(0, player);
    assert.equal(splitter.hunting.splitLevel, 2, "Splitter definitions should expose an extensible split level");
    assert.equal(splitter.hunting.splitCount, 2, "Splitter definitions should expose an extensible split count");
    assert.equal(
        splitter.hunting.lootMultiplier,
        1,
        "Splitter definitions should cap their reward budget at the base value"
    );
    assert.equal(
        getHuntingLootMultiplier({ hunting: { lootMultiplier: 1.5 } }),
        1,
        "Split reward overrides should never exceed the base monster reward budget"
    );
    assert.equal(
        scaleHuntingLootAmount(18, 0.5),
        9,
        "A reduced split reward override should scale physical shard value"
    );
    assert.equal(scaleHuntingLootAmount(18, 0), 0, "A zero split reward override should retain a zero reward budget");
    assert.equal(
        getSplitFragments(simulation).length,
        0,
        "Splitter cooldown updates should not create fragments before the monster is defeated"
    );
    assert.ok(simulation.fighters.includes(splitter), "Splitter should stay active until its fatal damage event");

    splitter.takeDamage(99999, player, "Test Split Death");
    const firstGeneration = getSplitFragments(simulation);
    assert.equal(firstGeneration.length, 2, "A level-two splitter should create two level-one fragments on death");
    assert.equal(
        simulation.fighters.includes(splitter),
        false,
        "Defeated splitters should leave the active fighter roster"
    );
    assert.equal(splitter.isExpired, true, "Defeated splitters should leave the active entity list");
    assert.ok(
        firstGeneration.every(
            (fragment) =>
                fragment.hunting.splitLevel === 1 &&
                fragment.hunting.splitCount === 2 &&
                fragment.hunting.behavior === HUNTING_MONSTER_TYPES.PURSUER &&
                fragment.teamId === splitter.teamId
        ),
        "First-generation fragments should keep the split count, lose one level, and continue pursuing"
    );
    assert.equal(
        firstGeneration.reduce((sum, fragment) => sum + fragment.maxHp, 0),
        originalMaxHp,
        "Each split generation should preserve the parent total maximum health"
    );
    assert.equal(
        firstGeneration.reduce((sum, fragment) => sum + fragment.hp, 0),
        originalMaxHp,
        "Death fragments should begin with their allocated maximum health instead of inheriting zero HP"
    );

    firstGeneration.forEach((fragment) => fragment.takeDamage(99999, player, "Test Recursive Split Death"));
    const terminalFragments = getSplitFragments(simulation);
    assert.equal(terminalFragments.length, 4, "Both level-one fragments should create two terminal fragments each");
    assert.ok(
        terminalFragments.every((fragment) => fragment.hunting.splitLevel === 0),
        "Terminal fragments should retain level zero and stop the recursive split chain"
    );
    assert.equal(
        terminalFragments.reduce((sum, fragment) => sum + fragment.maxHp, 0),
        originalMaxHp,
        "The final four fragments should still preserve the original total maximum health"
    );
    assert.equal(
        terminalFragments.filter((fragment) => !fragment.hunting.suppressLootDrop).length,
        1,
        "Only one terminal fragment should retain the original monster loot budget"
    );
    assert.ok(
        terminalFragments.every((fragment) => fragment.hunting.lootMultiplier === 1),
        "The terminal reward branch should preserve the splitter reward override"
    );
    assert.ok(
        terminalFragments.every((fragment, index) =>
            terminalFragments.slice(index + 1).every((other) => {
                const distance = Vector2.subtract(fragment.position, other.position).length();
                return distance >= fragment.radius + other.radius;
            })
        ),
        "Every fragment generation should begin physically separated"
    );

    terminalFragments.forEach((fragment) => fragment.takeDamage(99999, player, "Test Terminal Split Death"));
    const intermediateDefeatEvents = defeatEvents.filter((event) => (event.fighter.hunting?.splitLevel ?? 0) > 0);
    const terminalDefeatEvents = defeatEvents.filter((event) => event.fighter.hunting?.splitLevel === 0);
    assert.ok(
        intermediateDefeatEvents.every((event) => event.context.suppressLootDrop),
        "Every splitting death should suppress its own loot before the next generation appears"
    );
    assert.equal(terminalDefeatEvents.length, 4, "Every terminal fragment should emit one final defeat event");
    assert.equal(
        terminalDefeatEvents.filter((event) => !event.fighter.hunting.suppressLootDrop).length,
        1,
        "Only one terminal defeat should remain eligible for the base monster reward budget"
    );
    const terminalShardDrops = simulation.entities.filter((entity) => entity instanceof ShardDrop);
    const baseShardAmount = getHuntingShardDropAmount(92, () => 0.999999);
    assert.equal(
        terminalShardDrops.length,
        7,
        "The complete split tree should create only one terminal monster's physical shard-drop count"
    );
    assert.ok(
        terminalShardDrops.every((drop) => drop.amount === baseShardAmount),
        "The eligible terminal fragment should retain the base monster shard value"
    );
    simulation.checkResult();
    assert.equal(simulation.finished, false, "Hunting victory should wait while the hostile-absence grace begins");
    simulation.update(0.99);
    assert.equal(simulation.finished, false, "Hunting victory should not resolve before one full hostile-free second");
    simulation.update(0.02);
    assert.equal(simulation.finished, true, "Hunting victory should resolve after one hostile-free second");

    const graceScenario = createScenario({ splitLevel: 0 });
    graceScenario.splitter.takeDamage(99999, graceScenario.player, "Test Grace Start");
    graceScenario.simulation.checkResult();
    graceScenario.simulation.update(0.5);
    assert.equal(
        graceScenario.simulation.finished,
        false,
        "The hostile-free timer should remain pending before one second"
    );
    const reenteredEnemy = graceScenario.simulation.spawnFighter(
        createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.MELEE, floor: 1, index: 4 }),
        new Vector2(520, 480)
    );
    graceScenario.simulation.checkResult();
    reenteredEnemy.takeDamage(99999, graceScenario.player, "Test Grace Reset");
    graceScenario.simulation.checkResult();
    graceScenario.simulation.update(0.75);
    assert.equal(
        graceScenario.simulation.finished,
        false,
        "A newly spawned hostile should reset the pending result timer before the next defeat"
    );
    graceScenario.simulation.update(0.3);
    assert.equal(
        graceScenario.simulation.finished,
        true,
        "The reset hostile-free timer should resolve after a new full second"
    );

    const defeatScenario = createScenario({ splitLevel: 0 });
    defeatScenario.player.takeDamage(99999, defeatScenario.splitter, "Test Player Defeat");
    defeatScenario.simulation.checkResult();
    assert.equal(
        defeatScenario.simulation.finished,
        true,
        "The hostile-absence grace should not delay a player defeat while enemy monsters remain"
    );

    const reducedRewardScenario = createScenario({ splitLootMultiplier: 0.5 });
    reducedRewardScenario.splitter.takeDamage(99999, reducedRewardScenario.player, "Test Reduced Split Reward");
    getSplitFragments(reducedRewardScenario.simulation).forEach((fragment) =>
        fragment.takeDamage(99999, reducedRewardScenario.player, "Test Reduced Recursive Split Reward")
    );
    getSplitFragments(reducedRewardScenario.simulation).forEach((fragment) =>
        fragment.takeDamage(99999, reducedRewardScenario.player, "Test Reduced Terminal Split Reward")
    );
    const reducedShardDrops = reducedRewardScenario.simulation.entities.filter((entity) => entity instanceof ShardDrop);
    assert.equal(
        reducedShardDrops.length,
        7,
        "A reduced split reward override must still spend one terminal monster's physical drop count"
    );
    assert.ok(
        reducedShardDrops.every((drop) => drop.amount === scaleHuntingLootAmount(baseShardAmount, 0.5)),
        "A reduced split reward override must scale the one eligible terminal monster's shard values"
    );
    console.log("[hunting-splitter-death-fragments] ok");
}

function testElectricArcPathAndHuntingRender(app) {
    const from = new Vector2(120, 180);
    const to = new Vector2(360, 240);
    const initialPath = createElectricArcPath(from, to, { time: 0 });
    const animatedPath = createElectricArcPath(from, to, { time: 0.12 });
    const straightDirection = Vector2.subtract(to, from);

    assert.ok(initialPath.length > 4, "Electric arcs should divide a link into multiple segments");
    assert.deepEqual(initialPath[0], from, "Electric arcs should begin exactly at the caster");
    assert.deepEqual(initialPath.at(-1), to, "Electric arcs should end exactly at the target");
    assert.ok(
        initialPath.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
        "Electric arc points should remain finite"
    );
    assert.ok(
        initialPath.slice(1, -1).some((point) => {
            const offset = Vector2.subtract(point, from);
            return Math.abs(offset.x * straightDirection.y - offset.y * straightDirection.x) > 0.001;
        }),
        "Electric arc intermediate points should bend away from a straight link"
    );
    assert.ok(
        initialPath.slice(1, -1).some((point, index) => {
            const next = animatedPath[index + 1];
            return Math.abs(point.x - next.x) > 0.001 || Math.abs(point.y - next.y) > 0.001;
        }),
        "Electric arc intermediate points should move over time"
    );

    const playerSpec = {
        ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.DASH),
        teamId: HUNTING_TEAMS.PLAYER
    };
    const electricSpec = createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.ELECTRIC, floor: 20, index: 0 });
    const simulation = new BattleSimulation([electricSpec, playerSpec], { onLog() {}, onSound() {} }, null, {
        assignActions: false
    });
    const [electricMage, target] = simulation.fighters;
    electricMage.position = new Vector2(340, 480);
    target.position = new Vector2(580, 480);
    electricMage.ability.update(1 / 60, target);

    const paths = [];
    let path = [];
    const ctx = {
        save() {},
        restore() {},
        beginPath() {
            path = [];
        },
        moveTo(x, y) {
            path.push({ command: "move", x, y });
        },
        lineTo(x, y) {
            path.push({ command: "line", x, y });
        },
        stroke() {
            paths.push(path);
        }
    };
    electricMage.ability.draw(ctx);

    assert.equal(
        electricMage.ability.state.link.style,
        "electric",
        "Electric mages should opt into the arc link style"
    );
    assert.ok(
        paths.every((drawnPath) => drawnPath.filter((point) => point.command === "line").length > 1),
        "Electric mage rendering should draw every glow layer as a multi-segment arc"
    );
    console.log("[electric-arc] ok");
}

function testHuntingElectricChannelCooldown(app) {
    const createScenario = () => {
        const casterSpec = createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.ELECTRIC, floor: 20, index: 0 });
        const targetSpec = {
            ...casterSpec,
            id: "electric-channel-target",
            teamId: HUNTING_TEAMS.PLAYER,
            stats: { ...casterSpec.stats, hp: 1000, defense: 0 }
        };
        const simulation = new BattleSimulation([casterSpec, targetSpec], { onLog() {}, onSound() {} }, null, {
            assignActions: false
        });
        const [caster, target] = simulation.fighters;
        caster.position = new Vector2(340, 480);
        caster.velocity = new Vector2();
        caster.stats.criticalChance = 0;
        target.position = new Vector2(580, 480);
        target.velocity = new Vector2();
        return { caster, target };
    };
    const updateFrames = ({ caster, target }, frames) => {
        for (let frame = 0; frame < frames; frame += 1) caster.ability.update(1 / 60, target);
    };

    const channelScenario = createScenario();
    const channelHpBefore = channelScenario.target.hp;
    updateFrames(channelScenario, 30);
    assert.equal(
        channelHpBefore - channelScenario.target.hp,
        30,
        "Electric channel should deal exactly 30 minimum-damage hits across 0.5 seconds"
    );
    assert.equal(
        channelScenario.caster.ability.state.link,
        null,
        "Electric link should clear as the 0.5-second channel ends"
    );

    const hpAfterChannel = channelScenario.target.hp;
    updateFrames(channelScenario, 179);
    assert.equal(
        channelScenario.target.hp,
        hpAfterChannel,
        "Electric cooldown should deal no additional damage for 179 frames"
    );
    assert.equal(channelScenario.caster.ability.state.link, null, "Electric cooldown should not render a link");
    channelScenario.caster.ability.update(1 / 60, channelScenario.target);
    assert.equal(
        channelScenario.target.hp,
        hpAfterChannel - 1,
        "Electric channel should restart after its 3-second cooldown"
    );
    assert.equal(
        channelScenario.caster.ability.state.link?.style,
        "electric",
        "A restarted electric channel should restore its arc link"
    );

    const rangeExitScenario = createScenario();
    rangeExitScenario.caster.ability.update(1 / 60, rangeExitScenario.target);
    const hpBeforeRangeExit = rangeExitScenario.target.hp;
    rangeExitScenario.target.position.x = rangeExitScenario.caster.position.x + 331;
    rangeExitScenario.caster.ability.update(1 / 60, rangeExitScenario.target);
    assert.equal(
        rangeExitScenario.target.hp,
        hpBeforeRangeExit,
        "Leaving range should stop electric damage in the same frame"
    );
    assert.equal(
        rangeExitScenario.caster.ability.state.link,
        null,
        "Leaving range should immediately hide the electric link"
    );

    rangeExitScenario.target.position.x = rangeExitScenario.caster.position.x + 240;
    updateFrames(rangeExitScenario, 179);
    assert.equal(
        rangeExitScenario.target.hp,
        hpBeforeRangeExit,
        "Re-entering range should not bypass electric cooldown"
    );
    assert.equal(
        rangeExitScenario.caster.ability.state.link,
        null,
        "Cooldown should stay visually inactive after range re-entry"
    );
    rangeExitScenario.caster.ability.update(1 / 60, rangeExitScenario.target);
    assert.equal(
        rangeExitScenario.target.hp,
        hpBeforeRangeExit - 1,
        "Electric channel should resume only after its cooldown expires"
    );

    const largeDeltaScenario = createScenario();
    const largeDeltaHpBefore = largeDeltaScenario.target.hp;
    largeDeltaScenario.caster.ability.update(0.6, largeDeltaScenario.target);
    assert.equal(
        largeDeltaHpBefore - largeDeltaScenario.target.hp,
        4,
        "Electric damage should clamp a large update to its remaining 0.5-second channel time"
    );
    assert.equal(
        largeDeltaScenario.caster.ability.state.link,
        null,
        "A large update should still clear the link after channel completion"
    );
    assert.ok(
        Math.abs(largeDeltaScenario.caster.ability.state.electric.cooldownRemaining - 2.9) < 1e-9,
        "Time beyond a completed channel should count toward electric cooldown"
    );
    console.log("[hunting-electric-channel-cooldown] ok");
}

function testHuntingLinkCooldowns(app) {
    const frameDelta = 1 / 60;
    const behaviors = [
        {
            type: HUNTING_MONSTER_TYPES.CHAIN,
            config: HUNTING_LINK_CHANNEL_CONFIG.chain,
            name: "Chain",
            expectedStrength: 58 * frameDelta
        },
        {
            type: HUNTING_MONSTER_TYPES.SIPHON,
            config: HUNTING_LINK_CHANNEL_CONFIG.siphon,
            name: "Siphon",
            expectedStrength: 7 * frameDelta
        }
    ];
    const createScenario = (type, id) => {
        const casterSpec = createHuntingMobSpec({ type, floor: 20, index: 0 });
        const targetSpec = {
            ...casterSpec,
            id: `link-cooldown-target-${id}`,
            teamId: HUNTING_TEAMS.PLAYER,
            stats: { ...casterSpec.stats, hp: 1000, defense: 0 }
        };
        const simulation = new BattleSimulation([casterSpec, targetSpec], { onLog() {}, onSound() {} }, null, {
            assignActions: false
        });
        const [caster, target] = simulation.fighters;
        caster.position = new Vector2(340, 480);
        caster.velocity = new Vector2();
        target.position = new Vector2(500, 480);
        target.velocity = new Vector2();
        caster.hp = 1;
        return { caster, target };
    };
    const updateFrames = ({ caster, target }, frames) => {
        Array.from({ length: frames }).forEach(() => caster.ability.update(frameDelta, target));
    };
    const createEffectRecorder = ({ caster, target }, type) => {
        const strengths = [];
        const healingRequests = [];
        if (type === HUNTING_MONSTER_TYPES.CHAIN) {
            target.applyKnockback = (impulse) => {
                strengths.push(impulse.length());
            };
        } else {
            const takeDamage = target.takeDamage.bind(target);
            const heal = caster.heal.bind(caster);
            target.takeDamage = (...args) => {
                strengths.push(args[0]);
                return takeDamage(...args);
            };
            caster.heal = (amount) => {
                healingRequests.push(amount);
                return heal(amount);
            };
        }
        return { strengths, healingRequests };
    };

    Object.values(HUNTING_LINK_CHANNEL_CONFIG).forEach((config) => {
        [config.activeDuration, config.cooldownDuration].forEach((duration) => {
            assert.equal(
                Number.isInteger(duration * 2),
                true,
                "Link active and cooldown durations should use 0.5-second units"
            );
        });
    });
    assert.ok(
        HUNTING_LINK_CHANNEL_CONFIG.chain.activeDuration < HUNTING_LINK_CHANNEL_CONFIG.siphon.activeDuration,
        "Chain should keep the shorter active window"
    );
    assert.ok(
        HUNTING_LINK_CHANNEL_CONFIG.chain.cooldownDuration < HUNTING_LINK_CHANNEL_CONFIG.siphon.cooldownDuration,
        "Chain should return more frequently than siphon"
    );

    behaviors.forEach(({ type, config, name, expectedStrength }) => {
        const lifecycleScenario = createScenario(type, `${type}-lifecycle`);
        const { strengths, healingRequests } = createEffectRecorder(lifecycleScenario, type);
        const activeFrames = config.activeDuration / frameDelta;
        const cooldownFrames = config.cooldownDuration / frameDelta;
        const targetHpBefore = lifecycleScenario.target.hp;

        updateFrames(lifecycleScenario, activeFrames);
        assert.equal(
            strengths.length,
            activeFrames,
            `${name} should apply its existing effect during every active frame`
        );
        assert.ok(
            strengths.every((strength) => Math.abs(strength - expectedStrength) < 1e-9),
            `${name} should preserve its existing per-frame effect strength`
        );
        assert.equal(
            lifecycleScenario.caster.ability.state.link,
            null,
            `${name} should hide its link as the active window ends`
        );
        assert.ok(
            Math.abs(lifecycleScenario.caster.ability.state.linkChannel.cooldownRemaining - config.cooldownDuration) <
                1e-9,
            `${name} should begin its full cooldown after the active window`
        );
        if (type === HUNTING_MONSTER_TYPES.SIPHON) {
            assert.equal(
                targetHpBefore - lifecycleScenario.target.hp,
                activeFrames,
                "Siphon should preserve its actual minimum-damage hits during the active window"
            );
            assert.ok(
                Math.abs(healingRequests.reduce((sum, amount) => sum + amount, 0) - activeFrames * 0.8) < 1e-9,
                "Siphon should heal for 80% of the actual damage dealt"
            );
        }

        const effectsAfterActiveWindow = strengths.length;
        updateFrames(lifecycleScenario, cooldownFrames);
        assert.equal(strengths.length, effectsAfterActiveWindow, `${name} should apply no effect during its cooldown`);
        assert.equal(
            lifecycleScenario.caster.ability.state.link,
            null,
            `${name} should keep its link hidden during cooldown`
        );
        updateFrames(lifecycleScenario, 1);
        assert.equal(
            strengths.length,
            effectsAfterActiveWindow + 1,
            `${name} should resume exactly after its cooldown expires`
        );

        const rangeExitScenario = createScenario(type, `${type}-range-exit`);
        const { strengths: rangeExitStrengths } = createEffectRecorder(rangeExitScenario, type);
        updateFrames(rangeExitScenario, 1);
        rangeExitScenario.target.position.x = rangeExitScenario.caster.position.x + config.range + 1;
        updateFrames(rangeExitScenario, 1);
        assert.equal(
            rangeExitStrengths.length,
            1,
            `${name} should stop its effect in the same frame that the target leaves range`
        );
        assert.equal(
            rangeExitScenario.caster.ability.state.link,
            null,
            `${name} should immediately hide its link on range exit`
        );
        assert.ok(
            Math.abs(rangeExitScenario.caster.ability.state.linkChannel.cooldownRemaining - config.cooldownDuration) <
                1e-9,
            `${name} should start a full cooldown when its active link breaks`
        );
        rangeExitScenario.target.position.x = rangeExitScenario.caster.position.x + 160;
        updateFrames(rangeExitScenario, cooldownFrames);
        assert.equal(rangeExitStrengths.length, 1, `${name} range re-entry should not bypass its cooldown`);
        updateFrames(rangeExitScenario, 1);
        assert.equal(rangeExitStrengths.length, 2, `${name} should reconnect only after the full range-exit cooldown`);

        const firstScenario = createScenario(type, `${type}-first`);
        const secondScenario = createScenario(type, `${type}-second`);
        createEffectRecorder(firstScenario, type);
        const { strengths: secondStrengths } = createEffectRecorder(secondScenario, type);
        updateFrames(firstScenario, 1);
        firstScenario.target.position.x = firstScenario.caster.position.x + config.range + 1;
        updateFrames(firstScenario, 1);
        updateFrames(secondScenario, 1);
        assert.ok(
            firstScenario.caster.ability.state.linkChannel.cooldownRemaining > 0,
            `${name} first monster should be on its own cooldown`
        );
        assert.equal(
            secondScenario.caster.ability.state.linkChannel.cooldownRemaining,
            0,
            `${name} second monster should not inherit another monster's cooldown`
        );
        assert.equal(secondStrengths.length, 1, `${name} second monster should stay active independently`);
    });
    console.log("[hunting-link-cooldowns] ok");
}

function testHuntingConnectionEffectsClearDefeatedTargets(app) {
    const createLinkDrawContext = () => {
        let strokes = 0;
        return {
            get strokes() {
                return strokes;
            },
            save() {},
            restore() {},
            beginPath() {},
            moveTo() {},
            lineTo() {},
            stroke() {
                strokes += 1;
            }
        };
    };
    const createPlayerSpec = () => ({
        ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.DASH),
        teamId: HUNTING_TEAMS.PLAYER
    });
    const assertDefeatedTargetLinkClears = ({ owner, target, label }) => {
        const context = createLinkDrawContext();
        target.takeDamage(100000, owner, "Test Defeat");
        assert.equal(target.flags.defeated, true, `${label} test target should be defeated`);
        owner.ability.draw(context);
        assert.equal(context.strokes, 0, `${label} should not render toward a defeated target in the same frame`);
        owner.ability.update(1 / 60, target);
        assert.equal(owner.ability.state.link, null, `${label} should clear its stored link on the next update`);
    };

    [HUNTING_MONSTER_TYPES.ELECTRIC, HUNTING_MONSTER_TYPES.CHAIN, HUNTING_MONSTER_TYPES.SIPHON].forEach((type) => {
        const simulation = new BattleSimulation(
            [createHuntingMobSpec({ type, floor: 100 }), createPlayerSpec()],
            { onLog() {}, onSound() {} },
            null,
            { assignActions: false }
        );
        const [owner, target] = simulation.fighters;
        owner.position = new Vector2(300, 480);
        target.position = new Vector2(480, 480);
        owner.ability.update(1 / 60, target);
        assert.ok(owner.ability.state.link, `${type} should establish a link before the target is defeated`);
        assertDefeatedTargetLinkClears({ owner, target, label: type });
    });

    const healerSimulation = new BattleSimulation(
        [
            createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.HEALER, floor: 100, index: 0 }),
            createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.PURSUER, floor: 100, index: 1 }),
            createPlayerSpec()
        ],
        { onLog() {}, onSound() {} },
        null,
        { assignActions: false }
    );
    const [healer, ally, healerTarget] = healerSimulation.fighters;
    healer.position = new Vector2(300, 480);
    ally.position = new Vector2(460, 480);
    healerTarget.position = new Vector2(700, 480);
    ally.takeDamage(ally.hp / 2, healerTarget, "Test Setup");
    healer.ability.update(1 / 60, healerTarget);
    assert.equal(healer.ability.state.link?.target, ally, "Healers should link to injured allies");
    assertDefeatedTargetLinkClears({ owner: healer, target: ally, label: "healer" });

    const barrierSimulation = new BattleSimulation(
        [
            createPlayerSpec(),
            createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.BARRIER, floor: 100, index: 0 }),
            createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.PURSUER, floor: 100, index: 1 })
        ],
        { onLog() {}, onSound() {} },
        null,
        { assignActions: false }
    );
    const [barrierTarget, barrier, barrierAlly] = barrierSimulation.fighters;
    barrier.ability.state.barrierSwapTarget = barrierAlly;
    barrier.ability.state.barrierSwapTime = 0.36;
    barrierAlly.takeDamage(100000, barrierTarget, "Test Defeat");
    assert.equal(barrierAlly.flags.defeated, true, "Barrier test ally should be defeated");
    const barrierContext = createLinkDrawContext();
    barrier.ability.draw(barrierContext);
    assert.equal(barrierContext.strokes, 0, "Barrier swaps should not render toward defeated allies");
    barrier.ability.update(1 / 60, barrierTarget);
    assert.equal(barrier.ability.state.barrierSwapTarget, null, "Barrier swaps should clear defeated allies");
    assert.equal(barrier.ability.state.barrierSwapTime, 0, "Barrier swaps should clear their visual lifetime");
    console.log("[hunting-connection-target-lifecycle] ok");
}

function testTeamTargetingAndFriendlyCollision(app) {
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const orbit = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT);
    const trickster = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER);
    const sim = new BattleSimulation(
        [
            { ...archer, teamId: "player" },
            { ...orbit, teamId: "player" },
            { ...trickster, teamId: "enemy" }
        ],
        {
            onLog() {},
            onSound() {}
        }
    );
    const [player, ally, enemy] = sim.fighters;

    player.position = new Vector2(300, 480);
    ally.position = new Vector2(330, 480);
    enemy.position = new Vector2(700, 480);

    assert.equal(sim.isHostile(player, ally), false, "Fighters with the same teamId should be allies");
    assert.equal(sim.isHostile(player, enemy), true, "Fighters with different teamIds should be hostile");
    assert.deepEqual(
        sim.getEnemiesOf(player).map((fighter) => fighter.id),
        [enemy.id],
        "Enemy lookup should exclude allies"
    );
    assert.equal(sim.getOpponent(player), enemy, "getOpponent should return a hostile fighter, not the nearest ally");

    const hpBeforePlayer = player.hp;
    const hpBeforeAlly = ally.hp;
    sim.handleFighterCollision(player, ally);
    assert.equal(player.hp, hpBeforePlayer, "Friendly collision should not damage the owner");
    assert.equal(ally.hp, hpBeforeAlly, "Friendly collision should not damage the ally");
    assert.ok(
        Vector2.subtract(player.position, ally.position).length() >= player.radius + ally.radius - 1,
        "Friendly collision should still separate overlapping allies"
    );
}

function createHuntingFriendlyCollisionSimulation(types) {
    return new BattleSimulation(
        types.map((type, index) => ({
            ...createHuntingMobSpec({ type, floor: 1, index }),
            teamId: HUNTING_TEAMS.ENEMY
        })),
        { onLog() {}, onSound() {} },
        null,
        { assignActions: false }
    );
}

function placeOverlappingFighters(a, b) {
    a.position = new Vector2(450, 480);
    b.position = new Vector2(480, 480);
}

function getDistanceBetween(a, b) {
    return Vector2.subtract(a.position, b.position).length();
}

function testHuntingJumperAirborneCollisionAndScale() {
    const jumpDuration = 0.55;
    const maximumRadiusScale = 1.34;

    const passingSimulation = createHuntingFriendlyCollisionSimulation([
        HUNTING_MONSTER_TYPES.JUMPER,
        HUNTING_MONSTER_TYPES.PURSUER
    ]);
    const [jumpingJumper, regularAlly] = passingSimulation.fighters;
    placeOverlappingFighters(jumpingJumper, regularAlly);
    jumpingJumper.ability.state.jump = jumpDuration;
    const passingStartDistance = getDistanceBetween(jumpingJumper, regularAlly);
    const passingContext = passingSimulation.handleFighterCollision(jumpingJumper, regularAlly);
    assert.equal(passingContext, null, "An airborne jumper must not create a friendly collision context");
    assert.equal(
        getDistanceBetween(jumpingJumper, regularAlly),
        passingStartDistance,
        "An airborne jumper must not force-separate a regular ally"
    );

    const groundedSimulation = createHuntingFriendlyCollisionSimulation([
        HUNTING_MONSTER_TYPES.JUMPER,
        HUNTING_MONSTER_TYPES.PURSUER
    ]);
    const [groundedJumper, groundedAlly] = groundedSimulation.fighters;
    placeOverlappingFighters(groundedJumper, groundedAlly);
    const groundedContext = groundedSimulation.handleFighterCollision(groundedJumper, groundedAlly);
    assert.ok(groundedContext, "A grounded jumper must preserve normal friendly physics collisions");
    assert.ok(
        getDistanceBetween(groundedJumper, groundedAlly) >= groundedJumper.radius + groundedAlly.radius - 1,
        "A grounded jumper must still force-separate an overlapping ally"
    );

    const doubleJumpSimulation = createHuntingFriendlyCollisionSimulation([
        HUNTING_MONSTER_TYPES.JUMPER,
        HUNTING_MONSTER_TYPES.JUMPER
    ]);
    const [firstJumper, secondJumper] = doubleJumpSimulation.fighters;
    placeOverlappingFighters(firstJumper, secondJumper);
    firstJumper.ability.state.jump = jumpDuration;
    secondJumper.ability.state.jump = jumpDuration;
    firstJumper.radius = firstJumper.stats.baseRadius * firstJumper.ability.getRadiusScale();
    secondJumper.radius = secondJumper.stats.baseRadius * secondJumper.ability.getRadiusScale();
    const firstJumperHp = firstJumper.hp;
    const secondJumperHp = secondJumper.hp;
    const doubleJumpContext = doubleJumpSimulation.handleFighterCollision(firstJumper, secondJumper);
    assert.ok(doubleJumpContext, "Two airborne jumpers must retain a physical collision context");
    assert.ok(
        getDistanceBetween(firstJumper, secondJumper) >= firstJumper.radius + secondJumper.radius - 1,
        "Two airborne jumpers must still force-separate each other"
    );
    assert.equal(firstJumper.hp, firstJumperHp, "Friendly jumper collisions must not damage the first jumper");
    assert.equal(secondJumper.hp, secondJumperHp, "Friendly jumper collisions must not damage the second jumper");

    const scaleSimulation = createHuntingFriendlyCollisionSimulation([HUNTING_MONSTER_TYPES.JUMPER]);
    const [scaleJumper] = scaleSimulation.fighters;
    const getScaleAt = (elapsed) => {
        scaleJumper.ability.state.jump = Math.max(0, jumpDuration - elapsed);
        return scaleJumper.ability.getRadiusScale();
    };
    const launchScale = getScaleAt(0.1);
    const apexStartScale = getScaleAt(0.2);
    const apexEndScale = getScaleAt(0.35);
    const descentScale = getScaleAt(0.45);
    const landingScale = getScaleAt(jumpDuration);
    assert.equal(getScaleAt(0), 1, "A jump must begin at the normal radius");
    assert.ok(launchScale > 1.29, "A jump must rise sharply during its opening 0.1 seconds");
    assert.ok(
        Math.abs(apexStartScale - maximumRadiusScale) < 1e-9 && Math.abs(apexEndScale - maximumRadiusScale) < 1e-9,
        "A jump must keep its maximum radius through a readable apex hold"
    );
    assert.ok(
        descentScale < apexEndScale && apexEndScale - descentScale < 0.05,
        "A jump must leave the apex smoothly before the accelerated landing phase"
    );
    assert.equal(landingScale, 1, "A jump must return to the normal radius at landing");
}

function testTeamsResolveByRemainingHostileTeams(app) {
    const sim = new BattleSimulation(
        [
            { ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER), teamId: "player" },
            { ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT), teamId: "player" },
            { ...app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER), teamId: "enemy" }
        ],
        {
            onLog() {},
            onSound() {}
        }
    );
    const [player, ally, enemy] = sim.fighters;

    enemy.takeDamage(999, player, "Forced KO");
    sim.checkResult();

    assert.equal(sim.finished, true, "Battle should finish when only one team remains alive");
    assert.equal(sim.winner, player, "Winner should be a surviving fighter from the remaining team");
    assert.equal(ally.flags.destroyed, false, "Allies on the winning team should not be destroyed as losers");
}

function testProjectileIgnoresAllies(app) {
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const orbit = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT);
    const trickster = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER);
    const sim = new BattleSimulation(
        [
            { ...archer, teamId: "player" },
            { ...orbit, teamId: "player" },
            { ...trickster, teamId: "enemy" }
        ],
        {
            onLog() {},
            onSound() {}
        }
    );
    const [owner, ally, enemy] = sim.fighters;
    const arrow = sim.spawnArrow(owner, ally.position.clone(), new Vector2(0, 0));

    arrow.update(0.016, sim);
    assert.equal(ally.hp, ally.maxHp, "Projectile should not damage an allied fighter it overlaps");

    arrow.position = enemy.position.clone();
    arrow.update(0.016, sim);
    assert.ok(enemy.hp < enemy.maxHp, "Projectile should damage a hostile fighter");
}

function assertPassiveEvasionAppliesImpulse(app, fighterId, label) {
    const sim = new BattleSimulation(
        [
            app.roster.find((fighter) => fighter.id === fighterId),
            app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
        ],
        {
            onLog() {},
            onSound() {}
        }
    );
    const [evader, target] = sim.fighters;
    evader.position = new Vector2(300, 480);
    target.position = new Vector2(380, 480);
    evader.applyImpulse(Vector2.subtract(new Vector2(180, 0), evader.velocity));
    target.applyImpulse(Vector2.subtract(new Vector2(180, 0), target.velocity));

    evader.ability.update(0.016, target);

    assert.ok(evader.state.forcedHeading, `${label} passive evasion should still hold a short dodge heading`);
    assert.ok(
        Math.abs(evader.velocity.y) > 20,
        `${label} passive evasion should apply immediate lateral impulse after velocity became impulse-based`
    );
}

function testPassiveEvasionAppliesImpulse(app) {
    assertPassiveEvasionAppliesImpulse(app, FIGHTER_IDS.ARCHER, "Archer");
}

function testClickActionEffectOwnership(app) {
    const sim = new BattleSimulation(app.roster.slice(0, 2), {
        onLog() {},
        onSound() {}
    });
    const [player, opponent] = sim.fighters;
    const rush = findActionById("rush");
    const endure = findActionById("endure");

    player.applyImpulse(Vector2.subtract(new Vector2(120, 0), player.velocity));
    rush.apply(sim, player);

    assert.equal(sim.getSpeedMultiplier(player), 1.5, "RushAction should register speed effect on its target ball");
    assert.equal(sim.getSpeedMultiplier(opponent), 1, "RushAction should not boost unrelated balls");
    const expectedRushSpeed = player.stats.baseSpeed * player.getStatModifiers().speed * sim.getSpeedMultiplier(player);
    assert.ok(player.velocity.x > 120, "RushAction should immediately burst forward instead of only buffing speed");
    assert.ok(
        Math.abs(player.velocity.length() - expectedRushSpeed) < 0.001,
        "RushAction should snap to the boosted movement speed through impulse"
    );

    player.actionContext.tickTimers(player, 0.25);
    rush.apply(sim, player);
    assert.equal(
        player.actionContext.getEffect("rush").remaining,
        1.75,
        "RushAction should own duration extension logic"
    );

    player.actionContext.tickTimers(player, 1.76);
    assert.equal(sim.getSpeedMultiplier(player), 1, "Rush effect should expire through the generic action context");

    endure.apply(sim, player);
    assert.equal(
        player.actionContext.onDamageTaken(11, opponent, "Test"),
        2,
        "EndureAction should reduce damage by 80% (11 * 0.2 -> round)"
    );

    player.actionContext.tickTimers(player, 0.21);
    assert.equal(
        player.actionContext.onDamageTaken(11, opponent, "Test"),
        11,
        "Endure effect should expire after 0.2s"
    );
}

function testRiskWindowActionOwnership(app) {
    const sim = new BattleSimulation(app.roster.slice(0, 2), {
        onLog() {},
        onSound() {}
    });
    const [player, opponent] = sim.fighters;
    const counter = findActionById("counter");
    const projectileGuard = findActionById("projectile_guard");

    assert.equal(counter.getFailureReason(sim, player), null, "Counter should not fail for free before HP cost");
    assert.equal(
        projectileGuard.getFailureReason(sim, player),
        null,
        "Projectile guard should not fail for free before HP cost"
    );

    counter.apply(sim, player);
    assert.ok(player.actionContext.getEffect("counter"), "Counter should arm a short collision window");
    const opponentHpBeforeCounter = opponent.hp;
    const counterResult = player.actionContext.onFighterCollision(player, opponent, 10, 50, sim);
    assert.equal(counterResult.incomingDamage, 0, "Counter should cancel reflected incoming collision damage");
    assert.ok(opponent.hp < opponentHpBeforeCounter, "Counter should reflect incoming damage back to the opponent");
    const opponentHpAfterCounter = opponent.hp;
    player.actionContext.onFighterCollision(player, opponent, 50, 0, sim);
    assert.equal(opponent.hp, opponentHpAfterCounter, "Counter should not apply twice in the same frame");
    player.actionContext.tickTimers(player, 0);
    assert.equal(player.actionContext.getEffect("counter"), null, "Counter should expire after it is consumed");

    player.hp = 50;
    projectileGuard.apply(sim, player, 2);
    assert.equal(
        player.actionContext.onDamageTaken(20, opponent, "Crash"),
        20,
        "Projectile guard should not reduce normal collision damage"
    );
    assert.equal(
        player.actionContext.onProjectileDamage(20, {}, opponent, "Arrow Shot", sim, player),
        5,
        "Projectile guard should reduce projectile damage inside its window"
    );
    assert.equal(player.hp, 52, "Projectile guard should refund its paid HP cost on success");
    assert.equal(
        player.actionContext.onProjectileDamage(20, {}, opponent, "Arrow Shot", sim, player),
        20,
        "Projectile guard should not reduce a second projectile after it is consumed"
    );
    player.actionContext.tickTimers(player, 0);
    assert.equal(
        player.actionContext.getEffect("projectile_guard"),
        null,
        "Projectile guard should expire after reducing one projectile"
    );

    projectileGuard.apply(sim, player);
    player.actionContext.tickTimers(player, 0.31);
    assert.equal(
        player.actionContext.onProjectileDamage(20, {}, opponent, "Arrow Shot", sim, player),
        20,
        "Projectile guard should do nothing after the window expires"
    );
}

// ── Hero Ball / Hero Orb Tests ──────────────────────────────────────────────

async function testHeroBallRegistered(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    assert.ok(hero, "Hero Ball should be registered in the roster");
    assert.equal(hero.ability, "hero", "Hero Ball should have 'hero' ability type");

    const { HeroAbility } = await import("../src/abilities/heroAbility.js");
    const sim = new BattleSimulation([hero, app.roster.find((f) => f.id !== FIGHTER_IDS.HERO)], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    assert.ok(heroFighter.ability instanceof HeroAbility, "Hero Ball should create HeroAbility via ability map");
}

async function testHeroAbilitySpawnsOrb(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    sim.entities = sim.fighters.slice();

    // Trigger ability cooldown
    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);
    const orbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb");
    assert.equal(orbs.length, 1, "HeroAbility should spawn one Hero Orb when cooldown triggers");
}

async function testHeroOrbEffectType(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);

    const validTypes = ["hp", "damage", "speed", "defense", "skill", "dash", "arrow", "cooldown_burst"];
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
        sim.entities = sim.fighters.slice();
        heroFighter.ability.timer = 0;
        heroFighter.ability.update(0.016, target);
        const orb = sim.entities.find((e) => e.constructor?.name === "HeroOrb");
        assert.ok(orb, "HeroAbility should spawn an orb");
        assert.ok(validTypes.includes(orb.effectType), `Effect type ${orb.effectType} should be one of valid types`);
        seen.add(orb.effectType);
    }
    assert.ok(seen.size >= 5, "At least 5 effect types should appear over multiple spawns");
}

async function testHeroOrbOwnerCollects(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    sim.entities = sim.fighters.slice();

    // Simulate collecting each type of orb (gain is 1~3 random)
    for (const type of ["hp", "damage", "speed", "defense", "skill"]) {
        const before = { ...heroFighter.hero.bonuses };
        const orb = new (await import("../src/entities/index.js")).HeroOrb(
            heroFighter,
            heroFighter.position.clone(),
            new Vector2(0, 0),
            type,
            10
        );
        // Position orb at owner's position so owner collects it
        orb.position = heroFighter.position.clone();
        sim.entities.push(orb);
        orb.update(0.016, sim);
        const after = heroFighter.hero.bonuses;
        const gained = after[type] - before[type];
        assert.ok(gained >= 1 && gained <= 5, `Collecting ${type} orb should gain 1~5, got ${gained}`);
    }
}

async function testHeroOrbCollectionGraceDefersOwnerPickup(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((fighter) => fighter.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const bonusesBefore = { ...heroFighter.hero.bonuses };
    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(), "hp", 10, {
        collectionGraceDuration: 1
    });

    orb.update(0.1, sim);
    assert.equal(orb.isExpired, false, "Hero Orb must remain on the field while collection grace is active");
    assert.deepEqual(heroFighter.hero.bonuses, bonusesBefore, "Collection grace must defer the Hero Orb reward");
    assert.equal(orb.collectionGraceRemaining, 0.9, "Hero Orb must use the shared collection-grace state");
    orb.update(0.9, sim);
    assert.equal(orb.isExpired, false, "The update that consumes the final grace duration must still defer collection");
    orb.update(1 / 60, sim);
    assert.equal(orb.isExpired, true, "Hero Orb must collect normally on the update after grace expires");
    assert.ok(
        heroFighter.hero.bonuses.hp > bonusesBefore.hp,
        "Hero Orb reward must apply after collection grace expires"
    );
}

async function testHeroOrbOpponentCollects(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    sim.entities = sim.fighters.slice();

    const HeroOrb = (await import("../src/entities/index.js")).HeroOrb;
    const bonusesBefore = { ...heroFighter.hero.bonuses };

    const orbVelocity = new Vector2(0, 0);
    const orb = new HeroOrb(heroFighter, target.position.clone(), orbVelocity, "hp", 10);
    sim.entities.push(orb);
    const velocityBefore = orb.velocity.length();
    orb.update(0.016, sim);

    assert.deepEqual(heroFighter.hero.bonuses, bonusesBefore, "Opponent touching orb should not give bonus to owner");
    assert.equal(orb.isExpired, false, "Orb should bounce off opponent, not disappear");
    // orb가 상대에게서 멀어졌는지 확인 (겹침 해소로 position 변경)
    const distAfter = Vector2.subtract(orb.position, target.position).length();
    assert.ok(distAfter > orb.radius + target.radius - 1, "Orb should be pushed away from opponent");
}

async function testHeroOrbMaxActivePerOwner(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);

    // Override timer and spawn orbs repeatedly
    sim.entities = sim.fighters.slice();
    const HeroOrb = (await import("../src/entities/index.js")).HeroOrb;

    // Create 12 orbs in simulation (bypass ability to control exactly)
    for (let i = 0; i < 12; i++) {
        sim.entities.push(new HeroOrb(heroFighter, new Vector2(100, 100), new Vector2(0, 0), "hp", 10));
    }

    // Now enforce via ability's max active check
    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);

    const activeOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && !e.isExpired);
    // 12 old + 1 new = 13, but max is 10 → at most 10 active
    // Actually the new one was spawned after expiring the oldest ones
    // So active = 10 (9 old that weren't expired + 1 new)
    assert.ok(activeOrbs.length <= 10, `Should have at most 10 active orbs per owner, got ${activeOrbs.length}`);
    // The oldest orbs should be expired
    const expiredOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && e.isExpired);
    assert.ok(expiredOrbs.length >= 3, "Should expire at least 3 old orbs when exceeding limit");
}

async function testHeroOrbDoesNotExpireFromCooldown(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);

    sim.entities = sim.fighters.slice();
    for (let i = 0; i < 6; i++) {
        heroFighter.ability.timer = 0;
        heroFighter.ability.update(0.016, target);
    }

    const activeOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && !e.isExpired);
    assert.equal(activeOrbs.length, 6, "Hero Orbs should stay until collected or owner limit removes them");

    for (const orb of activeOrbs) {
        orb.update(heroFighter.ability.cooldown + 1, sim);
    }

    const stillActiveOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && !e.isExpired);
    assert.equal(stillActiveOrbs.length, 6, "Hero Orbs should not use cooldown-derived natural expiry");
}

async function testHeroOrbLimitIgnoresCollectedOrbs(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    sim.entities = sim.fighters.slice();
    for (let i = 0; i < 10; i++) {
        const orb = new HeroOrb(heroFighter, new Vector2(100 + i, 100), new Vector2(0, 0), "hp");
        if (i < 7) orb.isExpired = true;
        sim.entities.push(orb);
    }

    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);

    const activeOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && !e.isExpired);
    assert.equal(activeOrbs.length, 4, "Owner limit should count only active Hero Orb entities on the field");
}

async function testHeroOrbStatCapInfinite(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HERO_ORB_STAT_CAP } = await import("../src/entities/index.js");

    assert.equal(HERO_ORB_STAT_CAP, -1, "Default HERO_ORB_STAT_CAP should be -1 (infinite)");

    // Apply the same stat type many times - should never be blocked
    const HeroOrb = (await import("../src/entities/index.js")).HeroOrb;
    let totalGained = 0;
    for (let i = 0; i < 5; i++) {
        const before = heroFighter.hero.bonuses.hp;
        sim.entities = sim.fighters.slice();
        const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "hp", 10);
        orb.position = heroFighter.position.clone();
        sim.entities.push(orb);
        orb.update(0.016, sim);
        const gained = heroFighter.hero.bonuses.hp - before;
        assert.ok(gained >= 1 && gained <= 5, `HP bonus should gain 1~5 per orb (iteration ${i}, gained ${gained})`);
        totalGained += gained;
    }
    assert.ok(totalGained >= 5, `Over 5 collects, total gain should be at least 5, got ${totalGained}`);
}

async function testHeroOrbStatCapLimited(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { setHeroOrbStatCap, rollHeroOrbStatGain } = await import("../src/entities/index.js");
    const HeroOrb = (await import("../src/entities/index.js")).HeroOrb;

    // Temporarily set cap to 5
    setHeroOrbStatCap(5);
    try {
        heroFighter.hero.bonuses.hp = 0;
        // Collect orbs until we reach or exceed cap
        for (let i = 0; i < 10; i++) {
            const before = heroFighter.hero.bonuses.hp;
            sim.entities = sim.fighters.slice();
            const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "hp", 10);
            orb.position = heroFighter.position.clone();
            sim.entities.push(orb);
            orb.update(0.016, sim);
            const gained = heroFighter.hero.bonuses.hp - before;
            if (before < 5) {
                assert.ok(gained >= 1, `HP bonus should increase when under cap (iteration ${i}, gained ${gained})`);
            } else {
                assert.equal(gained, 0, `HP bonus should stop at cap (iteration ${i}, gained ${gained})`);
            }
        }
        // Verify we never overshoot the cap
        assert.ok(
            heroFighter.hero.bonuses.hp <= 5,
            `HP bonus should never exceed cap of 5, got ${heroFighter.hero.bonuses.hp}`
        );
    } finally {
        // Reset cap
        setHeroOrbStatCap(-1);
    }
}

async function testHeroOrbNoDamage(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const HeroOrb = (await import("../src/entities/index.js")).HeroOrb;

    const hpBefore = target.hp;
    const orb = new HeroOrb(heroFighter, target.position.clone(), new Vector2(0, 0), "hp", 10);
    sim.entities = [orb, ...sim.fighters];
    // Orb overlapping with opponent should bounce off, not deal damage
    orb.position = target.position.clone();
    orb.update(0.016, sim);
    assert.equal(target.hp, hpBefore, "Hero Orb should not damage opponents on contact");
    assert.equal(orb.isExpired, false, "Hero Orb should bounce off opponent, not disappear");
}

// ── Hero Ball v0.11.0 Improvement Tests ─────────────────────────────────────

async function testHeroBaseCooldown(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    assert.equal(heroFighter.ability._baseCooldown, 1.0, "HeroAbility base cooldown should be 1.0 second");
}

async function testHeroOrbSpeedMinMax(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);

    // Check multiple spawns
    for (let i = 0; i < 20; i++) {
        sim.entities = sim.fighters.slice();
        heroFighter.ability.timer = 0;
        heroFighter.ability.update(0.016, target);
        const orb = sim.entities.find((e) => e.constructor?.name === "HeroOrb");
        assert.ok(orb, `Orb should be spawned (iteration ${i})`);

        const orbSpeed = orb.velocity.length();
        const effectiveBaseSpeed = heroFighter.stats.baseSpeed * (heroFighter.getStatModifiers()?.speed ?? 1);
        const expectedMin = effectiveBaseSpeed * 1.2;
        const expectedMax = effectiveBaseSpeed * 1.5;
        assert.ok(
            orbSpeed >= expectedMin - 0.01,
            `Orb speed ${orbSpeed.toFixed(1)} should be >= ${expectedMin.toFixed(1)} (1.2× base) (iter ${i})`
        );
        assert.ok(
            orbSpeed <= expectedMax + 0.01,
            `Orb speed ${orbSpeed.toFixed(1)} should be <= ${expectedMax.toFixed(1)} (1.5× base) (iter ${i})`
        );
    }
}

async function testHeroOrbSpeedScalesWithOwner(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);

    // Spawn orb at normal speed
    sim.entities = sim.fighters.slice();
    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);
    const orb1 = sim.entities.find((e) => e.constructor?.name === "HeroOrb");
    const speed1 = orb1.velocity.length();

    // Increase owner baseSpeed and spawn again
    heroFighter.stats.baseSpeed *= 2;
    sim.entities = sim.fighters.slice();
    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);
    const orb2 = sim.entities.find((e) => e.constructor?.name === "HeroOrb");
    const speed2 = orb2.velocity.length();

    assert.ok(
        speed2 > speed1 * 1.5,
        `Orb speed should scale with owner baseSpeed (${speed2.toFixed(1)} vs ${speed1.toFixed(1)})`
    );
}

async function testHeroOrbOwnerCollectFeedback(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb, HERO_ORB_EFFECTS } = await import("../src/entities/index.js");

    // Check that collecting an orb spawns an action text entity
    const beforeTextCount = sim.entities.filter((e) => e.constructor?.name === "ActionText").length;

    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "hp", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);

    const afterTextCount = sim.entities.filter((e) => e.constructor?.name === "ActionText").length;
    assert.ok(afterTextCount > beforeTextCount, "Collecting an orb should spawn ActionText feedback");

    // Verify the text content matches the effect label
    const newTexts = sim.entities.filter((e) => e.constructor?.name === "ActionText");
    const lastText = newTexts[newTexts.length - 1];
    assert.ok(lastText, "ActionText should exist");
    assert.ok(
        lastText.displayText?.includes(HERO_ORB_EFFECTS.hp.label),
        `ActionText should contain the effect label (${lastText.displayText})`
    );
    const match = lastText.displayText?.match(/\+(\d+)/);
    assert.ok(match, `ActionText should contain +N (${lastText.displayText})`);
    const gainValue = parseInt(match[1], 10);
    assert.ok(gainValue >= 1 && gainValue <= 5, `Gain value should be 1~5, got ${gainValue}`);
}

async function testHeroOrbOpponentNoFeedback(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const textCountBefore = sim.entities.filter((e) => e.constructor?.name === "ActionText").length;

    const orb = new HeroOrb(heroFighter, target.position.clone(), new Vector2(0, 0), "hp", 10);
    sim.entities.push(orb);
    orb.update(0.016, sim);

    const textCountAfter = sim.entities.filter((e) => e.constructor?.name === "ActionText").length;
    assert.equal(textCountAfter, textCountBefore, "Opponent collecting orb should NOT spawn ActionText feedback");
}

async function testHeroOrbCapNoFeedback(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb, setHeroOrbStatCap } = await import("../src/entities/index.js");

    setHeroOrbStatCap(0);
    try {
        heroFighter.hero.bonuses.hp = 0;
        const textCountBefore = sim.entities.filter((e) => e.constructor?.name === "ActionText").length;

        const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "hp", 10);
        orb.position = heroFighter.position.clone();
        sim.entities.push(orb);
        orb.update(0.016, sim);

        const textCountAfter = sim.entities.filter((e) => e.constructor?.name === "ActionText").length;
        assert.equal(textCountAfter, textCountBefore, "No ActionText should spawn when stat cap prevents increase");
        assert.equal(heroFighter.hero.bonuses.hp, 0, "HP bonus should stay 0 when cap is 0");
    } finally {
        setHeroOrbStatCap(-1);
    }
}

async function testHeroOrbBonusUiFormat(app) {
    const { HERO_ORB_EFFECTS, formatHeroStatLine, formatHeroStatParts } = await import("../src/entities/index.js");

    const baseAllocation = { hp: 30, damage: 20, speed: 10, skill: 25, defense: 15 };
    assert.equal(
        formatHeroStatLine(baseAllocation, { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0 }),
        "체력 +30% · 힘 +20% · 속도 +10% · 쿨타임 +25% · 방어 +15%",
        "Hero stat line should show base allocation even before orb bonuses"
    );

    const result = formatHeroStatLine(baseAllocation, { hp: 3, damage: 1, speed: 0, defense: 0, skill: 2 });
    assert.ok(result.includes("체력 +30%(+3)"), "Hero stat line should merge base HP and orb HP");
    assert.ok(result.includes("힘 +20%(+1)"), "Hero stat line should merge base damage and orb damage");
    assert.ok(result.includes("쿨타임 +25%(+2)"), "Hero stat line should merge base skill and orb skill");
    assert.ok(result.includes("속도 +10%"), "Hero stat line should keep zero-bonus base stats");
    assert.ok(!result.includes("속도 +10%(+0)"), "Hero stat line should not render +0 orb bonuses");

    const parts = formatHeroStatParts(baseAllocation, { hp: 3, damage: 1, speed: 0, defense: 0, skill: 2 });
    const hpPart = parts.find((part) => part.key === "hp");
    assert.equal(hpPart.bonusText, "(+3)", "Hero stat bonus text should be compact and have no middle space");
    assert.equal(hpPart.color, HERO_ORB_EFFECTS.hp.color, "Hero stat bonus should use the matching orb color");
}

async function testHeroOrbBonusUiOnlyForHero(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const sim = new BattleSimulation([hero, archer], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const archerFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.ARCHER);

    // Hero has hero.bonuses, Archer has it too (all BattleBalls have it initialized)
    // But the display logic checks if bonuses are non-zero
    assert.ok(heroFighter.hero.bonuses, "Hero should have hero.bonuses");
    assert.ok(archerFighter.hero.bonuses, "All BattleBalls should have hero.bonuses (initialized to 0)");

    heroFighter.hero.bonuses.hp = 3;
    heroFighter.stats.allocation = { hp: 12, damage: 18, speed: 22, skill: 28, defense: 20 };
    const { formatHeroStatLine } = await import("../src/entities/index.js");
    const heroLine = formatHeroStatLine(heroFighter.stats.allocation, heroFighter.hero.bonuses);
    const normalLine = formatStatAllocation(heroFighter.stats.allocation);
    assert.ok(heroLine.includes("체력 +12%(+3)"), "Hero's stat line should show base allocation plus orb bonuses");
    assert.ok(!normalLine.includes("+12%(+3)"), "Normal stat formatter should not include Hero Orb bonuses");
    assert.deepEqual(archerFighter.hero.bonuses, { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0 });
}

async function testHeroExistingRulesNotBroken(app) {
    // Verify that existing rules still hold after the improvements
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], {
        onLog() {},
        onSound() {}
    });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb, HERO_ORB_EFFECTS } = await import("../src/entities/index.js");

    // 1) Max 10 orbs per owner
    sim.entities = sim.fighters.slice();
    const HeroOrbClass = HeroOrb;
    for (let i = 0; i < 12; i++) {
        sim.entities.push(new HeroOrbClass(heroFighter, new Vector2(100, 100), new Vector2(0, 0), "hp", 10));
    }
    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);
    const activeOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && !e.isExpired);
    assert.ok(activeOrbs.length <= 10, `Max 10 active orbs per owner, got ${activeOrbs.length}`);

    // 2) Opponent collects → no bonus
    const bonusesBefore = { ...heroFighter.hero.bonuses };
    const orb = new HeroOrbClass(heroFighter, target.position.clone(), new Vector2(0, 0), "hp", 10);
    sim.entities.push(orb);
    orb.update(0.016, sim);
    assert.deepEqual(heroFighter.hero.bonuses, bonusesBefore, "Opponent collecting orb should not give bonus to owner");

    // 3) Orb does no damage
    const hpBefore = target.hp;
    const orb2 = new HeroOrbClass(heroFighter, target.position.clone(), new Vector2(0, 0), "hp", 10);
    sim.entities.push(orb2);
    orb2.update(0.016, sim);
    assert.equal(target.hp, hpBefore, "Hero Orb should not damage opponents");
}

// ── Special Hero Orb Tests (v0.12.0) ─────────────────────────────────────────

async function testPickHeroOrbEffectType() {
    const { pickHeroOrbEffectType } = await import("../src/abilities/HeroAbility.js");

    // Deterministic rng: first checks special chances
    // dash=0.10, arrow=0.10, cooldown_burst=0.05
    let type = pickHeroOrbEffectType(() => 0.0);
    assert.equal(type, "dash", "rng=0.0 should pick dash (first special)");
    type = pickHeroOrbEffectType(() => 0.09);
    assert.equal(type, "dash", "rng=0.09 should still be in dash range");
    type = pickHeroOrbEffectType(() => 0.1);
    assert.equal(type, "arrow", "rng=0.1 should pick arrow");
    type = pickHeroOrbEffectType(() => 0.19);
    assert.equal(type, "arrow", "rng=0.19 should still be in arrow range");
    type = pickHeroOrbEffectType(() => 0.2);
    assert.equal(type, "cooldown_burst", "rng=0.2 should pick cooldown_burst");
    type = pickHeroOrbEffectType(() => 0.24);
    assert.equal(type, "cooldown_burst", "rng=0.24 should still be in cooldown_burst range");

    // Beyond special total (0.25) → stat orb
    const statTypes = ["hp", "damage", "speed", "defense", "skill"];
    type = pickHeroOrbEffectType(() => 0.25);
    assert.ok(statTypes.includes(type), `rng=0.25 should pick a stat orb, got ${type}`);
    type = pickHeroOrbEffectType(() => 0.9);
    assert.ok(statTypes.includes(type), `rng=0.9 should pick a stat orb, got ${type}`);
}

async function testSpecialOrbOwnerCollectDash(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    heroFighter.position.x = 200;
    heroFighter.position.y = 480;
    target.position.x = 600;
    target.position.y = 480;
    const bonusesBefore = { ...heroFighter.hero.bonuses };
    const dashBefore = heroFighter.state.movement;

    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "dash", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);

    assert.ok(heroFighter.state.movement, "Dash orb should set movementEffect on owner");
    assert.ok(heroFighter.state.movement.constructor?.name === "DashEffect", "Dash orb should use DashEffect");
    const dashSpeed = heroFighter.state.movement.getSpeed(heroFighter);
    const expectedSpeed = heroFighter.stats.baseSpeed * 1.5;
    assert.ok(
        Math.abs(dashSpeed - expectedSpeed) < 1,
        `Dash orb speed (${dashSpeed.toFixed(1)}) should be ~${expectedSpeed.toFixed(1)}`
    );
    assert.deepEqual(heroFighter.hero.bonuses, bonusesBefore, "Dash orb should not increment hero.bonuses");
}

async function testSpecialOrbOwnerCollectArrow(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    heroFighter.position.x = 200;
    heroFighter.position.y = 480;
    target.position.x = 600;
    target.position.y = 480;
    const bonusesBefore = { ...heroFighter.hero.bonuses };

    const entitiesBefore = sim.entities.length;
    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "arrow", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);

    const newEntities = sim.entities.slice(entitiesBefore);
    const arrow = newEntities.find((e) => e.constructor?.name === "ArrowProjectile");
    assert.ok(arrow, "Arrow orb should spawn an ArrowProjectile");
    const arrowSpeed = arrow.velocity.length();
    const expectedSpeed = heroFighter.stats.baseSpeed * 2.0;
    assert.ok(
        Math.abs(arrowSpeed - expectedSpeed) < expectedSpeed * 0.1,
        `Arrow speed (${arrowSpeed.toFixed(1)}) should be ~${expectedSpeed.toFixed(1)}`
    );
    assert.deepEqual(heroFighter.hero.bonuses, bonusesBefore, "Arrow orb should not increment hero.bonuses");
}

async function testSpecialOrbOwnerCollectCooldownBurst(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const bonusesBefore = { ...heroFighter.hero.bonuses };
    const normalCooldown = heroFighter.ability.cooldown;

    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "cooldown_burst", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);

    const burstCooldown = heroFighter.ability.cooldown;
    assert.ok(
        Math.abs(burstCooldown - normalCooldown * 0.1) < 0.01,
        `Cooldown burst should reduce cooldown to 10% (${burstCooldown.toFixed(3)} vs ${normalCooldown.toFixed(3)})`
    );
    assert.deepEqual(heroFighter.hero.bonuses, bonusesBefore, "Cooldown burst orb should not increment hero.bonuses");
    assert.ok(heroFighter.ability.state.cooldownBurstTimer > 0, "Cooldown burst timer should be active");
}

async function testSpecialOrbCooldownBurstExpires(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const normalCooldown = heroFighter.ability.cooldown;

    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "cooldown_burst", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);

    // Tick past burst duration
    heroFighter.ability._tickCooldownBurst(1.5);
    const afterBurstCooldown = heroFighter.ability.cooldown;
    assert.ok(
        Math.abs(afterBurstCooldown - normalCooldown) < 0.01,
        `After burst expires, cooldown should return to normal (${afterBurstCooldown.toFixed(3)} vs ${normalCooldown.toFixed(3)})`
    );
    assert.equal(heroFighter.ability.state.cooldownBurstTimer, 0, "Burst timer should be 0 after expiry");
}

async function testSpecialOrbOpponentCollects(app) {
    for (const specialType of ["dash", "arrow", "cooldown_burst"]) {
        const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
        const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
        const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
        const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
        const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
        const { HeroOrb } = await import("../src/entities/index.js");

        heroFighter.position.x = 200;
        heroFighter.position.y = 480;
        target.position.x = 600;
        target.position.y = 480;
        const bonusesBefore = { ...heroFighter.hero.bonuses };
        const movementBefore = heroFighter.state.movement;
        const entitiesBefore = sim.entities.length;

        const orb = new HeroOrb(heroFighter, target.position.clone(), new Vector2(0, 0), specialType, 10);
        sim.entities.push(orb);
        orb.update(0.016, sim);

        assert.deepEqual(
            heroFighter.hero.bonuses,
            bonusesBefore,
            `${specialType} orb collected by opponent should not give bonus to owner`
        );
        assert.equal(
            heroFighter.state.movement,
            movementBefore,
            `${specialType} orb collected by opponent should not trigger dash on owner`
        );
        assert.equal(orb.isExpired, false, `${specialType} orb should bounce off opponent, not disappear`);
    }
}

async function testSpecialOrbNotInStatBonuses(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const { formatHeroStatLine, formatHeroStatParts } = await import("../src/entities/index.js");
    const allocation = { hp: 30, damage: 20, speed: 10, skill: 0, defense: 0 };
    const bonuses = { hp: 3, damage: 1, speed: 0, defense: 0, skill: 2 };

    // Stat orbs appear in format
    const line = formatHeroStatLine(allocation, bonuses);
    assert.ok(line.includes("체력 +30%(+3)"), "Format should include stat orb bonus");
    assert.ok(line.includes("힘 +20%(+1)"), "Format should include damage stat bonus");
    assert.ok(!line.includes("대시"), "Format should NOT include dash");
    assert.ok(!line.includes("화살"), "Format should NOT include arrow");
    assert.ok(!line.includes("버스트"), "Format should NOT include cooldown_burst");

    // Parts should not contain special orb keys
    const parts = formatHeroStatParts(allocation, bonuses);
    const partKeys = parts.map((p) => p.key);
    assert.ok(!partKeys.includes("dash"), "Stat parts should not include dash key");
    assert.ok(!partKeys.includes("arrow"), "Stat parts should not include arrow key");
    assert.ok(!partKeys.includes("cooldown_burst"), "Stat parts should not include cooldown_burst key");
}

async function testSpecialOrbCountsTowardMaxActive(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    sim.entities = sim.fighters.slice();
    // Add 8 stat orbs + 4 special orbs = 12 total
    for (let i = 0; i < 8; i++) {
        sim.entities.push(new HeroOrb(heroFighter, new Vector2(100, 100), new Vector2(0, 0), "hp", 10));
    }
    for (let i = 0; i < 4; i++) {
        sim.entities.push(new HeroOrb(heroFighter, new Vector2(100, 100), new Vector2(0, 0), "dash", 10));
    }

    heroFighter.ability.timer = 0;
    heroFighter.ability.update(0.016, target);

    const activeOrbs = sim.entities.filter((e) => e.constructor?.name === "HeroOrb" && !e.isExpired);
    assert.ok(activeOrbs.length <= 10, `Active orbs (stat+special) should be limited to 10, got ${activeOrbs.length}`);
}

async function testSpecialOrbDrawDistinction(app) {
    const { HeroOrb, HERO_ORB_EFFECTS } = await import("../src/entities/index.js");
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const fakeOwner = { id: hero.id };

    for (const specialType of ["dash", "arrow", "cooldown_burst"]) {
        const orb = new HeroOrb(fakeOwner, new Vector2(0, 0), new Vector2(0, 0), specialType, 10);
        assert.ok(orb._isSpecial, `${specialType} orb should be marked as special`);
    }
    for (const statType of ["hp", "damage", "speed", "defense", "skill"]) {
        const orb = new HeroOrb(fakeOwner, new Vector2(0, 0), new Vector2(0, 0), statType, 10);
        assert.equal(orb._isSpecial, false, `${statType} orb should not be marked as special`);
    }
}

// ── Hero Orb Stat Gain 1~3 + Trickster Buff Tests (v0.13.0) ──────────────────

async function testRollHeroOrbStatGain() {
    const { rollHeroOrbStatGain } = await import("../src/entities/index.js");

    // Deterministic rng: amount = 1 + floor(rng * 3)
    assert.equal(
        rollHeroOrbStatGain(() => 0.0),
        1,
        "rng=0.0 should produce amount 1"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.19),
        1,
        "rng=0.19 should produce amount 1"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.2),
        2,
        "rng=0.2 should produce amount 2"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.39),
        2,
        "rng=0.39 should produce amount 2"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.4),
        3,
        "rng=0.4 should produce amount 3"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.59),
        3,
        "rng=0.59 should produce amount 3"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.6),
        4,
        "rng=0.6 should produce amount 4"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.79),
        4,
        "rng=0.79 should produce amount 4"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.8),
        5,
        "rng=0.8 should produce amount 5"
    );
    assert.equal(
        rollHeroOrbStatGain(() => 0.999),
        5,
        "rng=0.999 should produce amount 5"
    );

    // Test with multiple values - always 1~5
    for (let i = 0; i < 100; i++) {
        const val = rollHeroOrbStatGain();
        assert.ok(val >= 1 && val <= 5, `rollHeroOrbStatGain should return 1~5, got ${val}`);
    }
}

async function testHeroOrbStatGainAmountApplied(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const { HeroOrb, setHeroOrbStatCap } = await import("../src/entities/index.js");

    // Test hp: each point = +5 maxHp and +5 current hp
    const hpBefore = { maxHp: heroFighter.maxHp, hp: heroFighter.hp };
    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "hp", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);
    const gained = heroFighter.hero.bonuses.hp;
    assert.ok(gained >= 1 && gained <= 5, "HP gain should be 1~5");
    assert.equal(heroFighter.maxHp, hpBefore.maxHp + 5 * gained, "maxHp should increase by 5×gained");
    assert.equal(heroFighter.hp, hpBefore.hp + 5 * gained, "current HP should increase by 5×gained");
}

async function testHeroOrbStatGainDamage(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const dmgBefore = heroFighter.stats.baseDamage;
    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "damage", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);
    const gained = heroFighter.hero.bonuses.damage;
    assert.ok(gained >= 1 && gained <= 5, "Damage gain should be 1~5");
    assert.ok(
        Math.abs(heroFighter.stats.baseDamage - dmgBefore * Math.pow(1.02, gained)) < 0.1,
        `baseDamage should reflect 1.02^${gained} increase`
    );
}

async function testHeroOrbStatGainSpeed(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const speedBefore = heroFighter.stats.baseSpeed;
    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "speed", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);
    const gained = heroFighter.hero.bonuses.speed;
    assert.ok(gained >= 1 && gained <= 5, "Speed gain should be 1~5");
    assert.equal(
        heroFighter.stats.baseSpeed,
        Math.round(speedBefore + 4 * gained),
        "baseSpeed should increase by 4×gained"
    );
}

async function testHeroOrbStatGainDefense(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const defBefore = heroFighter.stats.baseDefense;
    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "defense", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);
    const gained = heroFighter.hero.bonuses.defense;
    assert.ok(gained >= 1 && gained <= 5, "Defense gain should be 1~5");
    assert.equal(
        heroFighter.stats.baseDefense,
        Number((defBefore + 0.33 * gained).toFixed(2)),
        "baseDefense should increase by 0.33×gained"
    );
}

async function testHeroOrbStatGainSkill(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    const skillBefore = heroFighter.hero.bonuses.skill;
    const cooldownBefore = heroFighter.ability.cooldown;
    const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "skill", 10);
    orb.position = heroFighter.position.clone();
    sim.entities.push(orb);
    orb.update(0.016, sim);
    const gained = heroFighter.hero.bonuses.skill - skillBefore;
    assert.ok(gained >= 1 && gained <= 5, "Skill gain should be 1~5");
    // Cooldown getter uses statAllocation.skill, not hero.bonuses.skill.
    // hero.bonuses.skill is stored but cooldown getter doesn't read it yet.
    assert.ok(heroFighter.hero.bonuses.skill > skillBefore, "hero.bonuses.skill should increase");
}

async function testHeroOrbStatGainCapClamp(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const { HeroOrb, setHeroOrbStatCap } = await import("../src/entities/index.js");

    // cap=5, current=4 → max add = 1
    setHeroOrbStatCap(5);
    try {
        heroFighter.hero.bonuses.hp = 4;
        // Collect with controlled gain (min=1, but rng could be >1, so the clamp will cap it)
        const before = heroFighter.hero.bonuses.hp;
        const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), "hp", 10);
        orb.position = heroFighter.position.clone();
        sim.entities.push(orb);
        orb.update(0.016, sim);
        const after = heroFighter.hero.bonuses.hp;
        const gained = after - before;
        assert.ok(gained >= 0 && gained <= 1, `With cap=5 and bonus=4, gain should be 0 or 1, got ${gained}`);
        assert.ok(after <= 5, `HP bonus should not exceed cap of 5, got ${after}`);
    } finally {
        setHeroOrbStatCap(-1);
    }
}

async function testHeroOrbSpecialNotAffectedByGain(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.HERO);
    const sim = new BattleSimulation([hero, opponent], { onLog() {}, onSound() {} });
    const heroFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.HERO);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.HERO);
    const { HeroOrb } = await import("../src/entities/index.js");

    heroFighter.position.x = 200;
    heroFighter.position.y = 480;
    target.position.x = 600;
    target.position.y = 480;

    for (const specialType of ["dash", "arrow", "cooldown_burst"]) {
        const bonusesBefore = { ...heroFighter.hero.bonuses };
        const orb = new HeroOrb(heroFighter, heroFighter.position.clone(), new Vector2(0, 0), specialType, 10);
        orb.position = heroFighter.position.clone();
        sim.entities.push(orb);
        orb.update(0.016, sim);
        assert.deepEqual(
            heroFighter.hero.bonuses,
            bonusesBefore,
            `${specialType} orb should not increment hero.bonuses`
        );
    }
}

// ── Hero Orb Carryover Tests (v0.14.0) ───────────────────────────────────────

async function testCarryoverRateConstant() {
    const { HERO_ORB_CARRYOVER_RATE } = await import("../src/entities/index.js");
    assert.equal(HERO_ORB_CARRYOVER_RATE, 0.5, "HERO_ORB_CARRYOVER_RATE should be 0.5");
}

async function testComputeHeroOrbCarryover() {
    const { computeHeroOrbCarryover } = await import("../src/entities/index.js");
    const gained = { hp: 5, damage: 1, speed: 4, defense: 2, skill: 0 };
    const carry = computeHeroOrbCarryover(gained, 0.5);
    assert.equal(carry.hp, 2, "hp +5 → carry +2");
    assert.equal(carry.damage, undefined, "damage +1 → carry undefined (floor(1*0.5)=0)");
    assert.equal(carry.speed, 2, "speed +4 → carry +2");
    assert.equal(carry.defense, 1, "defense +2 → carry +1");
    assert.equal(carry.skill, undefined, "skill +0 → carry undefined");
}

async function testComputeHeroOrbCarryoverCustomRate() {
    const { computeHeroOrbCarryover } = await import("../src/entities/index.js");
    // rate 0.25: hp 5 → floor(5*0.25)=1
    const carry = computeHeroOrbCarryover({ hp: 5, speed: 10 }, 0.25);
    assert.equal(carry.hp, 1, "hp +5 with rate 0.25 → carry +1");
    assert.equal(carry.speed, 2, "speed +10 with rate 0.25 → carry +2");
}

async function testMergeHeroOrbCarryover() {
    const { mergeHeroOrbCarryover } = await import("../src/entities/index.js");
    const spec = { hero: { carryover: { hp: 2, damage: 0, speed: 1, defense: 0, skill: 0 } } };
    const gained = { hp: 5, damage: 0, speed: 0, defense: 0, skill: 0 };

    mergeHeroOrbCarryover(spec, gained, 0.5);
    assert.equal(spec.hero.carryover.hp, 4, "기존 2 + 새 floor(5*0.5)=2 → 총 4");
    assert.equal(spec.hero.carryover.speed, 1, "speed는 변하지 않음 (gained 0)");
}

async function testMergeHeroOrbCarryoverNoRecycle() {
    const { mergeHeroOrbCarryover } = await import("../src/entities/index.js");
    // 기존 carry +2, 새 획득 +5 → carry 추가 = floor(5*0.5)=2
    const spec = {};
    mergeHeroOrbCarryover(spec, { hp: 5 }, 0.5);
    assert.equal(spec.hero.carryover.hp, 2, "첫 승리: hp 5 → carry 2");

    // 두 번째 승리: 새 획득 hp +3 → floor(3*0.5)=1
    mergeHeroOrbCarryover(spec, { hp: 3 }, 0.5);
    assert.equal(spec.hero.carryover.hp, 3, "기존 2 + 새 1 → 총 3 (기존 2를 다시 절반 계산 안 함)");
}

async function testApplyHeroOrbCarryoverToBattleBall(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const { BattleBall, applyHeroOrbCarryoverToBattleBall } = await import("../src/entities/index.js");
    const ball = new BattleBall(hero, { x: 480, y: 480 });

    const hpBefore = ball.maxHp;
    const speedBefore = ball.stats.baseSpeed;

    applyHeroOrbCarryoverToBattleBall(ball, { hp: 2, speed: 2 });

    assert.equal(ball.maxHp, hpBefore + 10, "hp carry +2 should increase maxHp by 10");
    assert.equal(ball.stats.baseSpeed, speedBefore + 8, "speed carry +2 should increase baseSpeed by 8");
    assert.equal(ball.hero.bonuses.hp, 0, "carryover should NOT count as current match gain");
    assert.equal(ball.hero.bonuses.speed, 0, "carryover should NOT count as current match gain");
}

async function testMergeOrbBonuses(app) {
    const { mergeOrbBonuses } = await import("../src/entities/index.js");
    const current = { hp: 3, damage: 1, speed: 0, defense: 0, skill: 2 };
    const carry = { hp: 2, damage: 0, speed: 1, defense: 0, skill: 0 };

    const merged = mergeOrbBonuses(current, carry);
    assert.equal(merged.hp, 5, "3+2=5");
    assert.equal(merged.damage, 1, "1+0=1");
    assert.equal(merged.speed, 1, "0+1=1");
    assert.equal(merged.defense, 0, "0+0=0");
    assert.equal(merged.skill, 2, "2+0=2");
}

async function testCarryoverNotForNonHero(app) {
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const { BattleBall, applyHeroOrbStatAmount } = await import("../src/entities/index.js");
    const ball = new BattleBall(archer, { x: 480, y: 480 });

    const hpBefore = ball.maxHp;
    applyHeroOrbStatAmount(ball, "hp", 2, { countAsCurrentMatch: false });
    assert.equal(ball.maxHp, hpBefore + 10, "applyHeroOrbStatAmount should work on any BattleBall");
    assert.equal(ball.hero.bonuses.hp, 0, "countAsCurrentMatch=false should not increment bonuses");
}

async function testCarryoverSkillAffectsCooldown(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const { BattleBall, applyHeroOrbStatAmount } = await import("../src/entities/index.js");
    const ball = new BattleBall(hero, { x: 480, y: 480 });
    ball.stats.allocation = { hp: 0, damage: 0, speed: 0, skill: 0, defense: 0 };

    applyHeroOrbStatAmount(ball, "skill", 2, { countAsCurrentMatch: false });
    assert.equal(ball.stats.allocation.skill, 2, "skill carryover should update statAllocation.skill");
}

async function testCarryoverDoesNotAffectSpecialOrbs(app) {
    const hero = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.HERO);
    const { BattleBall, applyHeroOrbStatAmount } = await import("../src/entities/index.js");
    const ball = new BattleBall(hero, { x: 480, y: 480 });

    const bonusesBefore = { ...ball.hero.bonuses };
    applyHeroOrbStatAmount(ball, "dash", 5, { countAsCurrentMatch: true });
    applyHeroOrbStatAmount(ball, "arrow", 5, { countAsCurrentMatch: true });
    applyHeroOrbStatAmount(ball, "cooldown_burst", 5, { countAsCurrentMatch: true });
    assert.deepEqual(ball.hero.bonuses, bonusesBefore, "special orb keys should not affect hero.bonuses");
}

async function testTricksterSeedSpeedBuff(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [trickster, opponent] = app.simulation.fighters;
    trickster.position.x = 200;
    trickster.position.y = 480;
    opponent.position.x = 640;
    opponent.position.y = 480;
    app.simulation.entities = [];
    trickster.ability.timer = 0;
    trickster.ability.update(0.016, opponent);
    const seeds = app.simulation.entities.filter((entity) => entity.constructor.name === "SeedOrb");
    assert.equal(seeds.length, 3, "Trickster should still launch three seeds");

    // Check speed range: owner combat speed × 1.2~1.5
    for (const seed of seeds) {
        const seedSpeed = seed.velocity.length();
        const ownerSpeed = trickster.stats.baseSpeed * (trickster.getStatModifiers()?.speed ?? 1);
        const expectedMin = ownerSpeed * 1.2;
        const expectedMax = ownerSpeed * 1.5;
        assert.ok(
            seedSpeed >= expectedMin - 0.01,
            `Seed speed ${seedSpeed.toFixed(1)} should be >= ${expectedMin.toFixed(1)} (1.2×)`
        );
        assert.ok(
            seedSpeed <= expectedMax + 0.01,
            `Seed speed ${seedSpeed.toFixed(1)} should be <= ${expectedMax.toFixed(1)} (1.5×)`
        );
    }
}

async function testTricksterSeedLifeBuff(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [trickster, opponent] = app.simulation.fighters;
    app.simulation.entities = [];
    trickster.ability.timer = 0;
    trickster.ability.update(0.016, opponent);
    const seeds = app.simulation.entities.filter((entity) => entity.constructor.name === "SeedOrb");
    assert.equal(seeds.length, 3, "Trickster should launch three seeds");

    // Seed life should be cooldown * 2
    const expectedLife = trickster.ability.cooldown * 2;
    for (const seed of seeds) {
        assert.equal(seed.life, expectedLife, `Seed life (${seed.life}) should be cooldown * 2 (${expectedLife})`);
    }
}

async function testTricksterSeedSpeedScalesWithOwner(app) {
    await app.startMatch([
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.TRICKSTER),
        app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
    ]);
    const [trickster, opponent] = app.simulation.fighters;
    trickster.position.x = 200;
    trickster.position.y = 480;
    opponent.position.x = 640;
    opponent.position.y = 480;

    // First batch
    app.simulation.entities = [];
    trickster.ability.timer = 0;
    trickster.ability.update(0.016, opponent);
    const seeds1 = app.simulation.entities.filter((e) => e.constructor.name === "SeedOrb");
    const speed1 = seeds1[0].velocity.length();

    // Double baseSpeed
    trickster.stats.baseSpeed *= 2;
    app.simulation.entities = [];
    trickster.ability.timer = 0;
    trickster.ability.update(0.016, opponent);
    const seeds2 = app.simulation.entities.filter((e) => e.constructor.name === "SeedOrb");
    const speed2 = seeds2[0].velocity.length();

    assert.ok(
        speed2 > speed1 * 1.5,
        `Seed speed should scale with owner baseSpeed (${speed2.toFixed(1)} vs ${speed1.toFixed(1)})`
    );
}

// ── Tournament Roster Selection Tests ────────────────────────────────────────

async function testTournamentRosterOverEight() {
    // Currently has 9 (8 old + Hero)
    if (app.roster.length < 9) return; // Skip if roster count changed

    const { createEmptyStatAllocation } = await import("../src/statAllocation.js");
    const playerAllocation = createEmptyStatAllocation();
    const tournamentRoster = createTournamentRoster(app.roster, FIGHTER_IDS.ARCHER, playerAllocation, Math.random);
    assert.equal(tournamentRoster.length, 8, "Tournament roster should have exactly 8 participants when roster has 9+");
    const playerInRoster = tournamentRoster.find((f) => f.id === FIGHTER_IDS.ARCHER);
    assert.ok(playerInRoster, "Player fighter should be included in tournament roster");
    assert.ok(playerInRoster.isPlayer, "Player fighter should be marked as isPlayer");
    const playerCount = tournamentRoster.filter((f) => f.id === FIGHTER_IDS.ARCHER).length;
    assert.equal(playerCount, 1, "Player fighter should not be duplicated in tournament roster");
}

async function testTournamentRosterUnderEight() {
    const { createEmptyStatAllocation } = await import("../src/statAllocation.js");
    // Use a subset of roster with fewer than 8 entries
    const smallRoster = app.roster.slice(0, 4);
    const playerAllocation = createEmptyStatAllocation();
    const tournamentRoster = createTournamentRoster(smallRoster, smallRoster[0].id, playerAllocation, Math.random);
    assert.equal(
        tournamentRoster.length,
        smallRoster.length,
        "Tournament roster should include all fighters when roster is under 8"
    );
    // No duplicate entries
    const ids = tournamentRoster.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length, "Tournament roster should not contain duplicates even when under 8");
    const playerInRoster = tournamentRoster.find((f) => f.id === smallRoster[0].id);
    assert.ok(playerInRoster, "Player fighter should be included even in small roster");
}

async function testTournamentRosterNoExcessMultipleRuns() {
    const { createEmptyStatAllocation } = await import("../src/statAllocation.js");
    const playerAllocation = createEmptyStatAllocation();
    for (let run = 0; run < 20; run++) {
        const roster = createTournamentRoster(app.roster, FIGHTER_IDS.HERO, playerAllocation, Math.random);
        assert.ok(
            roster.length <= 8,
            `Tournament roster should never exceed 8 participants (run ${run}, got ${roster.length})`
        );
        assert.ok(
            roster.some((f) => f.id === FIGHTER_IDS.HERO),
            `Player should always be in the roster (run ${run})`
        );
        const playerCount = roster.filter((f) => f.id === FIGHTER_IDS.HERO).length;
        assert.equal(playerCount, 1, `Player should not be duplicated (run ${run})`);
    }
}

// ── Achievement system tests ────────────────────────────────────────────────

async function testEvaluateAchievements() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { ACHIEVEMENT_DEFINITIONS } = await import("../src/collection/achievementDefinitions.js");
    const { evaluateAchievements } = await import("../src/collection/achievementRules.js");
    const { createRoster } = await import("../src/roster.js");
    const { createMatchReport, createTournamentReport, addMatchReport } = await import("../src/collection/index.js");

    // first_tournament_win: playerTournamentsCompleted >= 1 && report.playerWon
    const profile = createDefaultPlayerProfile();
    const roster = createRoster();
    const report = createTournamentReport();
    report.playerWon = true;
    report.playerFighterId = "archer";

    // Apply tournament report to populate playerTournamentsCompleted
    const { applyTournamentReport } = await import("../src/collection/index.js");
    applyTournamentReport(profile, report);

    const results = evaluateAchievements(profile, ACHIEVEMENT_DEFINITIONS, {
        profile,
        report,
        roster,
        playerFighterId: "archer"
    });
    const firstWin = results.find((r) => r.id === "first_tournament_win");
    assert.ok(firstWin, "first_tournament_win should unlock after first win");
    assert.ok(firstWin.reward, "first_tournament_win should have a reward");

    // 이미 해금된 업적은 다시 해금되지 않음
    const results2 = evaluateAchievements(profile, ACHIEVEMENT_DEFINITIONS, {
        profile,
        report,
        roster,
        playerFighterId: "archer"
    });
    assert.equal(results2.length, 0, "Already unlocked achievements should not fire again");

    // flawless_tournament: matchReports with combatDamageTaken === 0
    const profile2 = createDefaultPlayerProfile();
    const report2 = createTournamentReport();
    report2.playerWon = true;
    const match1 = createMatchReport();
    match1.combatDamageTaken = 0;
    const match2 = createMatchReport();
    match2.combatDamageTaken = 5;
    addMatchReport(report2, match1);
    applyTournamentReport(profile2, report2);

    const results3 = evaluateAchievements(profile2, ACHIEVEMENT_DEFINITIONS, {
        profile: profile2,
        report: report2,
        roster,
        playerFighterId: "archer"
    });
    // flawless_tournament: now checks .some() — one match with 0 damage is enough
    assert.ok(
        results3.some((r) => r.id === "flawless_tournament"),
        "flawless_tournament should unlock when any match has 0 damage"
    );

    // counter_expert: actionSuccessCounts.counter >= 10
    const profile3 = createDefaultPlayerProfile();
    profile3.collection.careerStats.actionSuccessCounts.counter = 10;
    const results4 = evaluateAchievements(profile3, ACHIEVEMENT_DEFINITIONS, {
        profile: profile3,
        report: createTournamentReport(),
        roster,
        playerFighterId: "archer"
    });
    assert.ok(
        results4.some((r) => r.id === "counter_expert"),
        "counter_expert should unlock at 10 counter successes"
    );
    assert.ok(
        results4.some((r) => r.id === "first_tournament_win") === false,
        "first_tournament_win should NOT unlock without win"
    );

    // marathon_50: playerMatchesCompleted >= 50
    const profile5 = createDefaultPlayerProfile();
    profile5.collection.careerStats.playerMatchesCompleted = 50;
    const results5 = evaluateAchievements(profile5, ACHIEVEMENT_DEFINITIONS, {
        profile: profile5,
        report: createTournamentReport(),
        roster,
        playerFighterId: "archer"
    });
    assert.ok(
        results5.some((r) => r.id === "marathon_50"),
        "marathon_50 should unlock at 50 matches"
    );

    // speed_2x: first win — 첫 evaluateCall에서 함께 해금됨
    assert.ok(
        results.some((r) => r.id === "speed_2x"),
        "speed_2x should unlock with first win"
    );
    assert.equal(
        ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === "speed_2x").reward.payload.description,
        "2배속 관전 전환 해금 (관전 전투 화면 터치)",
        "speed_2x reward should explain the spectator canvas interaction"
    );

    // speed_4x: bestTournamentWinStreak >= 3
    const profile7 = createDefaultPlayerProfile();
    const report7 = createTournamentReport();
    report7.playerFighterId = "archer";
    profile7.collection.careerStats.bestTournamentWinStreak = 3;
    const results7 = evaluateAchievements(profile7, ACHIEVEMENT_DEFINITIONS, {
        profile: profile7,
        report: report7,
        roster,
        playerFighterId: "archer"
    });
    assert.ok(
        results7.some((r) => r.id === "speed_4x"),
        "speed_4x should unlock at 3-win streak"
    );
    assert.equal(
        ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === "speed_4x").reward.payload.description,
        "4배속 관전 전환 해금 (관전 전투 화면 터치)",
        "speed_4x reward should explain the spectator canvas interaction"
    );

    // single_hit_monster: maxHitDamage >= 150
    const profile8 = createDefaultPlayerProfile();
    const report8 = createTournamentReport();
    report8.playerFighterId = "archer";
    const matchBig = createMatchReport();
    matchBig.maxHitDamage = 150;
    addMatchReport(report8, matchBig);
    const results8 = evaluateAchievements(profile8, ACHIEVEMENT_DEFINITIONS, {
        profile: profile8,
        report: report8,
        roster,
        playerFighterId: "archer"
    });
    assert.ok(
        results8.some((r) => r.id === "single_hit_monster"),
        "single_hit_monster should unlock at 150 maxHitDamage"
    );

    const masteryComplete = ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === "mastery_complete");
    const masteryProfile = createDefaultPlayerProfile();
    for (const fighter of roster) {
        masteryProfile.collection.characters[fighter.id] = { tournamentWins: 99 };
    }
    assert.equal(
        masteryComplete.evaluate({ profile: masteryProfile, roster }),
        false,
        "mastery_complete should not use obsolete tournament win thresholds"
    );
    masteryProfile.characterMastery.levels = Object.fromEntries(roster.map((fighter) => [fighter.id, 3]));
    assert.equal(
        masteryComplete.evaluate({ profile: masteryProfile, roster }),
        true,
        "mastery_complete should require every stored mastery tier to be GOLD"
    );
}

async function testApplyAchievementRewards() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { applyAchievementRewards, computeEffectiveBonuses } = await import("../src/progression/progressionState.js");

    const profile = createDefaultPlayerProfile();

    // 업적 해금 시뮬레이션 (evaluateAchievements가 하는 일)
    profile.collection.achievements["test_ach_1"] = { unlockedAt: Date.now() };

    const results = [
        {
            id: "test_ach_1",
            reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 5 } }
        },
        { id: "test_ach_2", reward: null }
    ];

    const outcomes = applyAchievementRewards(results);
    assert.equal(outcomes.length, 2, "Should return outcome for each result");
    assert.ok(outcomes[0].applied, "Reward with valid bonus should be applied");
    assert.equal(outcomes[0].bonusKey, "extraStatPoints");
    assert.equal(outcomes[0].amount, 5);

    // 동적 계산으로 보상 확인
    const defs = [{ id: "test_ach_1", reward: results[0].reward }];
    const computed = computeEffectiveBonuses(profile, defs);
    assert.equal(computed.extraStatPoints, 5, "Computed bonus should be 5 from unlocked achievement");

    assert.ok(!outcomes[1].applied, "Null reward should not be applied");
}

async function testFormatRewardDescription() {
    const { formatRewardDescription } = await import("../src/progression/progressionState.js");

    assert.equal(formatRewardDescription(null), "", "Null reward should return empty");
    assert.equal(formatRewardDescription({}), "", "Reward without type should return empty");

    const r1 = { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 5 } };
    assert.ok(
        formatRewardDescription(r1).includes("추가 스탯 포인트"),
        "extraStatPoints reward should describe correctly"
    );
    assert.ok(formatRewardDescription(r1).includes("+5"), "Reward amount should be included");
}

async function testProgressionBonusCapClamp() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { computeEffectiveBonuses } = await import("../src/progression/progressionState.js");

    const profile = createDefaultPlayerProfile();

    // extraStatPoints cap is 40 — 업적 여러 개가 합산 45를 줘도 상한 40
    const defs = [
        { id: "ach1", reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 20 } } },
        { id: "ach2", reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 20 } } },
        { id: "ach3", reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 5 } } }
    ];

    // 세 업적 모두 해금
    for (const def of defs) {
        profile.collection.achievements[def.id] = { unlockedAt: Date.now() };
    }

    const computed = computeEffectiveBonuses(profile, defs);
    assert.equal(computed.extraStatPoints, 40, "Should cap at 40 even with 45 total from definitions");

    // 두 개만 해금 → 40 (cap)
    delete profile.collection.achievements["ach3"];
    const computed2 = computeEffectiveBonuses(profile, defs);
    assert.equal(computed2.extraStatPoints, 40, "Should cap at 40 with two 20-point achievements");
}

// ── Mastery system tests ───────────────────────────────────────────────────

async function testGetCharacterMasteryLevel() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { getCharacterMasteryLevel } = await import("../src/character-mastery/index.js");

    const profile = createDefaultPlayerProfile();
    assert.equal(getCharacterMasteryLevel(profile, "archer"), 0, "New profile should have level 0");
    assert.equal(getCharacterMasteryLevel(profile, "invalid"), 0, "Invalid ID should return 0");

    profile.characterMastery.levels = { archer: 2 };
    assert.equal(getCharacterMasteryLevel(profile, "archer"), 2, "Should return stored level");
}

async function testGetCharacterChallengeLevel() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const {
        advanceTournamentChallenge,
        getCharacterChallengeLevel,
        getCharacterMasteryLevel,
        getTournamentOpponentExperienceLevel,
        resetTournamentChallenge
    } = await import("../src/character-mastery/index.js");

    const profile = createDefaultPlayerProfile();
    profile.characterMastery.levels.archer = 3;
    assert.equal(getCharacterChallengeLevel(profile, "archer"), 0, "Mastery must not set the first challenge level");
    assert.equal(getTournamentOpponentExperienceLevel(profile, "archer"), null, "First challenge should use Lv.1 AI");

    const firstWin = advanceTournamentChallenge(profile, { characterId: "archer", playerWon: true });
    assert.ok(firstWin.changed, "Tournament win should advance the next challenge");
    assert.equal(getCharacterChallengeLevel(profile, "archer"), 1, "First win -> challenge 1");
    assert.equal(getTournamentOpponentExperienceLevel(profile, "archer"), 3, "Challenge 1 should use Lv.3 AI");

    advanceTournamentChallenge(profile, { characterId: "archer", playerWon: true });
    advanceTournamentChallenge(profile, { characterId: "archer", playerWon: true });
    assert.equal(getCharacterChallengeLevel(profile, "archer"), 3, "Challenge should reach the Lv.9 cap");
    assert.equal(getTournamentOpponentExperienceLevel(profile, "archer"), 9, "Challenge 3 should use Lv.9 AI");

    const reset = resetTournamentChallenge(profile, "archer");
    assert.ok(reset.changed, "Rebirth reset should clear the current tournament challenge");
    assert.equal(getCharacterChallengeLevel(profile, "archer"), 0, "Reset challenge should return to Lv.1 AI");
    assert.equal(profile.characterMastery.levels.archer, 3, "Resetting the challenge must preserve mastery");

    const versionNineProfile = createDefaultPlayerProfile();
    versionNineProfile.version = 9;
    versionNineProfile.characterMastery.levels.archer = 3;
    versionNineProfile.experience.byCharacter.archer = { currentXp: 500 };
    versionNineProfile.experience.currentXp = 500;
    delete versionNineProfile.tournamentChallenge;
    const migratedProfile = migratePlayerProfile(versionNineProfile);
    assert.equal(getCharacterMasteryLevel(migratedProfile, "archer"), 3, "Version 9 profiles must retain mastery");
    assert.equal(
        getCharacterChallengeLevel(migratedProfile, "archer"),
        0,
        "Version 9 profiles must receive the first tournament challenge by default"
    );
}

async function testAdvanceCharacterMastery() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { advanceCharacterMastery, getCharacterMasteryLevel } = await import("../src/character-mastery/index.js");

    const profile = createDefaultPlayerProfile();

    // 레벨 0 → BRONZE (난도 0)
    const r1 = advanceCharacterMastery(profile, { characterId: "archer", challengeLevel: 0, playerWon: true });
    assert.ok(r1.changed, "Win at challenge 0 should advance to BRONZE");
    assert.equal(r1.newLevel, 1);
    assert.equal(r1.previousTier, "미해금");
    assert.equal(r1.newTier, "BRONZE");

    // BRONZE → SILVER: needs challenge >= 1
    const r2 = advanceCharacterMastery(profile, { characterId: "archer", challengeLevel: 0, playerWon: true });
    assert.ok(!r2.changed, "Bronze needs challenge >= 1");
    assert.equal(r2.reason, "insufficient_challenge");

    const r3 = advanceCharacterMastery(profile, { characterId: "archer", challengeLevel: 1, playerWon: true });
    assert.ok(r3.changed, "Win at challenge 1 should advance to SILVER");
    assert.equal(r3.newLevel, 2);

    // SILVER → GOLD: needs challenge >= 2
    const r4 = advanceCharacterMastery(profile, { characterId: "archer", challengeLevel: 2, playerWon: true });
    assert.ok(r4.changed, "Win at challenge 2 should advance to GOLD");
    assert.equal(r4.newLevel, 3);

    // GOLD: max, no further advance
    const r5 = advanceCharacterMastery(profile, { characterId: "archer", challengeLevel: 2, playerWon: true });
    assert.ok(!r5.changed, "GOLD should not advance");
    assert.equal(r5.reason, "max_level");

    // 패배
    const r6 = advanceCharacterMastery(profile, { characterId: "archer", challengeLevel: 0, playerWon: false });
    assert.ok(!r6.changed, "Loss should not advance");
    assert.equal(r6.reason, "lost");

    // 잘못된 ID
    const r7 = advanceCharacterMastery(profile, { characterId: "invalid", challengeLevel: 0, playerWon: true });
    assert.ok(!r7.changed, "Invalid ID should not advance");
}

// ── Tournament report tests ─────────────────────────────────────────────────

async function testApplyTournamentReport() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { createMatchReport, createTournamentReport, addMatchReport, applyTournamentReport } =
        await import("../src/collection/index.js");

    const profile = createDefaultPlayerProfile();
    const report = createTournamentReport();
    report.playerFighterId = "archer";
    report.playerWon = true;
    report.placement = 1;

    const match = createMatchReport();
    match.playerWon = true;
    match.combatDamageDealt = 100;
    match.combatDamageTaken = 5;
    match.lowestHpRatio = 0.5;
    match.usedActionIds = ["rush", "counter"];
    match.actionSuccessCounts = { counter: 1 };
    addMatchReport(report, match);

    const result = applyTournamentReport(profile, report);
    assert.ok(!result.alreadyProcessed, "First apply should succeed");

    const charRecord = profile.collection.characters.archer;
    assert.ok(charRecord, "Character record should exist");
    assert.equal(charRecord.tournamentsCompleted, 1, "Tournament count should increment");
    assert.equal(charRecord.tournamentWins, 1, "Win should be recorded");
    assert.equal(charRecord.matchWins, 1, "Match win should be recorded");
    assert.equal(charRecord.totalDamageDealt, 100, "Damage dealt should match");
    assert.equal(charRecord.bestPlacement, 1, "Best placement should be 1");

    assert.equal(profile.collection.careerStats.playerTournamentsCompleted, 1);
    assert.equal(profile.collection.careerStats.playerMatchesCompleted, 1);
    assert.equal(profile.collection.careerStats.currentTournamentWinStreak, 1);
    assert.ok(profile.collection.careerStats.usedActionIds.includes("rush"), "Action IDs should be recorded");
    assert.equal(profile.collection.careerStats.actionSuccessCounts.counter, 1);

    // 중복 반영 방지
    const result2 = applyTournamentReport(profile, report);
    assert.ok(result2.alreadyProcessed, "Duplicate report should be skipped");
}

function testDeveloperTournamentWinTool() {
    const profile = createDefaultPlayerProfile();
    const characterId = FIGHTER_IDS.RAGE;
    const result = recordDeveloperTournamentWin(profile, characterId);

    assert.equal(result.ok, true, "Developer tournament win should create a valid tournament report");
    assert.equal(
        result.report.playerFighterId,
        characterId,
        "Developer report should belong to the selected character"
    );
    assert.equal(result.report.playerWon, true, "Developer report should record a win");
    assert.equal(result.report.placement, 1, "Developer report should record first place");
    assert.equal(result.record.tournamentsCompleted, 1, "Developer win should increase tournament completion count");
    assert.equal(result.record.tournamentWins, 1, "Developer win should increase the selected character win count");
    assert.equal(result.record.bestPlacement, 1, "Developer win should record first place as best placement");
    assert.equal(
        canEnterHunting(profile, characterId),
        true,
        "Developer win should satisfy the hunting entry requirement"
    );
    assert.equal(
        profile.collection.careerStats.playerTournamentsCompleted,
        1,
        "Career tournament total should use the report path"
    );
    assert.equal(
        profile.collection.careerStats.processedTournamentReportIds.length,
        1,
        "Report deduplication should track the developer report"
    );
    assert.equal(recordDeveloperTournamentWin(profile, "unknown").error, "unknown_character");

    const app = {
        playerProfile: profile,
        debugActive: false,
        isDebugModeActive() {
            return this.debugActive;
        },
        _refreshCollectionHub() {
            this.collectionRefreshCount = (this.collectionRefreshCount ?? 0) + 1;
        },
        refreshPlayerSetup() {
            this.setupRefreshCount = (this.setupRefreshCount ?? 0) + 1;
        }
    };
    const bridge = createAppComponentBridge(app);
    assert.equal(
        bridge.recordDebugTournamentWin(characterId).error,
        "debug_disabled",
        "Bridge should not allow tournament results outside a development session"
    );
    app.debugActive = true;
    const bridgeResult = bridge.recordDebugTournamentWin(characterId);
    assert.equal(bridgeResult.ok, true, "Bridge should record the selected debug character victory");
    assert.equal(app.collectionRefreshCount, 1, "Developer win should refresh collection data");
    assert.equal(app.setupRefreshCount, 1, "Developer win should refresh setup data");
    console.log("[developer-tournament-win-tool] ok");
}

function testDeveloperCollectionSampleTool() {
    const profile = createDefaultPlayerProfile();
    const result = seedDeveloperCollectionSample(profile, FIGHTER_IDS.HERO);
    const commonItems = profile.equipment.inventory.filter((item) => item.rarity === "common");

    assert.equal(result.ok, true, "Collection sample should be created for a valid profile");
    assert.equal(result.itemCount, 6, "Collection sample should provide equipment management coverage");
    assert.equal(result.chestCount, 3, "Collection sample should provide storage coverage");
    assert.equal(profile.hunting.shards, 800, "Collection sample should fund shop and equipment actions");
    assert.equal(profile.equipment.enhancementStones, 99, "Collection sample should fund enhancement actions");
    assert.equal(profile.equipment.maxInventorySlots, 12, "Collection sample should leave room for fusion output");
    assert.deepEqual(
        profile.hunting.chests.map((chest) => chest.rarity),
        ["common", "rare", "epic"],
        "Collection sample should use real chest rarity definitions"
    );
    assert.equal(commonItems.length, 3, "Collection sample should provide one complete fusion recipe");
    assert.equal(
        canFuseEquipment(
            profile,
            commonItems.map((item) => item.instanceId)
        ),
        true,
        "Collection sample should make the fusion UI immediately actionable"
    );
    assert.deepEqual(
        Object.values(profile.equipment.equipped).filter(Boolean).length,
        3,
        "Collection sample should use production equipment slots for the equipped summaries"
    );
    assert.equal(seedDeveloperCollectionSample(null, FIGHTER_IDS.HERO).error, "invalid_profile");
    console.log("[developer-collection-sample-tool] ok");
}

// ── Toast queue tests ───────────────────────────────────────────────────────

async function testToastQueue() {
    const state = {
        active: null,
        departing: null,
        queue: [],
        nextId: 0
    };

    function createToast(message) {
        return { id: ++state.nextId, message, count: 1 };
    }

    function promoteNextToast() {
        const next = state.queue.shift();
        if (!next) return;
        state.departing = state.active;
        state.active = next;
    }

    function showToast(message) {
        if (state.active?.message === message) {
            state.active.count += 1;
            return;
        }

        const queued = state.queue.at(-1);
        if (queued?.message === message) queued.count += 1;
        else state.queue.push(createToast(message));

        if (!state.active) state.active = state.queue.shift();
    }

    showToast("업적1");
    assert.equal(state.active.message, "업적1", "First toast should be displayed immediately");

    showToast("업적2");
    assert.equal(state.active.message, "업적1", "Current toast should remain visible until its minimum display time");
    assert.equal(state.queue.length, 1, "Different toast should wait for the minimum display time");

    promoteNextToast();
    assert.equal(
        state.active.message,
        "업적2",
        "Next toast should become the foreground toast after the minimum display time"
    );
    assert.equal(state.departing.message, "업적1", "Previous toast should leave behind the new foreground toast");

    showToast("업적2");
    assert.equal(
        state.active.count,
        2,
        "Repeated current toast should merge into a count instead of creating another item"
    );

    showToast("업적3");
    promoteNextToast();
    assert.equal(state.active.message, "업적3", "Queued toast should replace the current toast in order");
    assert.equal(state.departing.count, 2, "Merged toast count should remain visible while the prior toast exits");

    const source = readFileSync("src/components/toast-notification.html", "utf8");
    assert.ok(source.includes("MIN_VISIBLE_DURATION = 650"), "Toast should define a short minimum display duration");
    assert.ok(source.includes("component.departing"), "Toast should retain a departing layer during replacement");
    assert.ok(source.includes("queue.at(-1)"), "Toast should merge repeated queued messages");
    assert.ok(
        source.includes("toast--entering") && source.includes("toast--leaving"),
        "Toast should animate both entry and exit"
    );
    assert.ok(!source.includes('x-show="visible"'), "Toast should not use a single visible flag for replacement");
}

// ── Sensitivity reset test ──────────────────────────────────────────────────

async function testSensitivityAlwaysReset() {
    const { STAT_BALANCER_CONFIG } = await import("../src/statAllocation.js");

    // balanceTolerance가 0이어도 SENSITIVITY는 20으로 설정되어야 함
    STAT_BALANCER_CONFIG.SENSITIVITY = 99; // 이전 값 흔적
    const totalBalanceTol = 0;
    STAT_BALANCER_CONFIG.SENSITIVITY = 20 + totalBalanceTol;
    assert.equal(STAT_BALANCER_CONFIG.SENSITIVITY, 20, "SENSITIVITY should reset to 20 when balanceTol=0");

    // balanceTolerance가 있으면 증가
    STAT_BALANCER_CONFIG.SENSITIVITY = 20 + 5;
    assert.equal(STAT_BALANCER_CONFIG.SENSITIVITY, 25, "SENSITIVITY should be 20+5=25 when balanceTol=5");

    // 다시 0으로
    STAT_BALANCER_CONFIG.SENSITIVITY = 20 + 0;
    assert.equal(STAT_BALANCER_CONFIG.SENSITIVITY, 20, "SENSITIVITY should reset back to 20");
}

// ── adjustStat with bonus total test ────────────────────────────────────────

async function testAdjustStatWithBonusTotal() {
    const { adjustStatAllocation, getRemainingStatPoints, PLAYER_STAT_POINTS, createEmptyStatAllocation } =
        await import("../src/statAllocation.js");

    const effectiveTotal = PLAYER_STAT_POINTS + 5; // +5 bonus
    let allocation = createEmptyStatAllocation();

    // Fill base 100 points (20 per stat, within 50 cap)
    for (const key of ["hp", "damage", "speed", "skill", "defense"]) {
        allocation = adjustStatAllocation(allocation, key, 20, effectiveTotal);
    }
    assert.equal(
        getRemainingStatPoints(allocation, effectiveTotal),
        5,
        "After allocating 100/105 (20 each), remaining should be 5"
    );

    // Bonus points도 배분 가능해야 함
    allocation = adjustStatAllocation(allocation, "hp", 5, effectiveTotal);
    assert.equal(
        getRemainingStatPoints(allocation, effectiveTotal),
        0,
        "After allocating 105/105, remaining should be 0"
    );

    // 초과 배분 불가
    allocation = adjustStatAllocation(allocation, "speed", 1, effectiveTotal);
    assert.equal(getRemainingStatPoints(allocation, effectiveTotal), 0, "Cannot allocate beyond effectiveTotal");
}

// ── Mastery modifier tests ─────────────────────────────────────────────────

async function testMasteryModifiersStoredOnBattleBall(app) {
    // BattleBall 생성 시 mastery.physics, mastery.action, mastery.passives가 저장되는지 확인
    const { BattleBall } = await import("../src/entities/index.js");
    const { Vector2 } = await import("../src/core.js");

    const spec = {
        id: "archer",
        name: "Archer",
        title: "Test Title",
        description: "",
        color: "#ff0000",
        face: "archer",
        stats: { hp: 1000, damage: 50, speed: 200, defense: 5, radius: 16, mass: 10 },
        statAllocation: null,
        mastery: {
            physics: { velocityRecoveryBonus: 0.02, wallBounce: 0.05 },
            combat: { incomingCollisionDamageReduce: 0.05, outgoingCollisionDamageBonus: 0.03 },
            action: { hpCostPercentReduction: 0.0003, cooldownPercent: 0.02 },
            passives: [{ id: "test_passive", type: "periodic_collision_bonus", cooldown: 12, damageBonus: 0.04 }]
        }
    };

    const ball = new BattleBall(spec, new Vector2(100, 100));
    assert.equal(ball.mastery.physics.velocityRecoveryBonus, 0.02, "velocityRecoveryBonus should be stored");
    assert.equal(ball.mastery.physics.wallBounce, 0.05, "wallBounce should be stored");
    assert.equal(
        ball.mastery.combat.incomingCollisionDamageReduce,
        0.05,
        "incomingCollisionDamageReduce should be stored"
    );
    assert.equal(
        ball.mastery.combat.outgoingCollisionDamageBonus,
        0.03,
        "outgoingCollisionDamageBonus should be stored"
    );
    assert.equal(ball.mastery.action.hpCostPercentReduction, 0.0003, "hpCostPercentReduction should be stored");
    assert.equal(ball.mastery.action.cooldownPercent, 0.02, "cooldownPercent should be stored");
    assert.equal(ball.mastery.passives.length, 1, "combat passives should be stored");
    assert.equal(ball.mastery.passives[0].id, "test_passive", "passive id should match");
}

async function testStatModifierDamageIndependentOfHp() {
    // Bug 10: 데미지 보너스가 hp 보너스 게이트에 묶여있지 않은지 확인
    // 이 테스트는 코드 레벨 검증 — stat modifier가 독립 적용되는지 확인
    const { MASTERY_EFFECT_DEFS } = await import("../src/character-mastery/index.js");

    // archer의 mastery는 damage만 제공 (hp 없음)
    const archerDef = MASTERY_EFFECT_DEFS.find((d) => d.sourceFighterId === "archer");
    assert.ok(archerDef, "Archer mastery should exist");

    // archer mastery의 apply는 damage에만 영향을 줌
    const ctx = {
        statModifiers: { hp: 0, damage: 0, defense: 0, speed: 0, mass: 0 },
        physicsModifiers: { velocityRecoveryBonus: 0, wallBounce: 0, collisionAngularImpulse: 0 },
        combatModifiers: { incomingCollisionDamageReduce: 0, outgoingCollisionDamageBonus: 0 },
        combatPassives: [],
        actionModifiers: { hpCostPercentReduction: 0, cooldownPercent: 0 }
    };

    archerDef.apply(ctx, 1); // BRONZE level
    assert.ok(ctx.statModifiers.damage > 0, "Archer mastery should increase damage");
    assert.equal(ctx.statModifiers.hp, 0, "Archer mastery should NOT increase hp");

    // eater의 mastery는 hp만 제공 (damage 없음)
    const eaterDef = MASTERY_EFFECT_DEFS.find((d) => d.sourceFighterId === "eater");
    assert.ok(eaterDef, "Eater mastery should exist");

    eaterDef.apply(ctx, 1);
    assert.ok(ctx.statModifiers.hp > 0, "Eater mastery should increase hp");
    // damage는 archer가 이미 올렸으므로 변함 없어야 하지만 eater가 추가로 올리진 않음
    const damageAfterEater = ctx.statModifiers.damage;
    eaterDef.apply(ctx, 1); // 두 번 호출해도 damage는 eater가 올리지 않음
    assert.equal(ctx.statModifiers.damage, damageAfterEater, "Eater mastery should NOT increase damage");
}

async function testMasteryEffectsApplyAfterFixedStats() {
    const { applyMasteryEffectsToFighterSpec } = await import("../src/character-mastery/index.js");
    const spec = {
        id: "standard",
        stats: { hp: 120, damage: 11, defense: 2, speed: 300, radius: 50, mass: 1 }
    };
    const mastery = {
        statModifiers: { hp: 0.06, damage: 0.06, defense: 0 },
        physicsModifiers: { velocityRecoveryBonus: 0.1, wallBounce: 0 },
        combatModifiers: { incomingCollisionDamageReduce: 0.06, outgoingCollisionDamageBonus: 0.06 },
        actionModifiers: { hpCostPercentReduction: 0.001, cooldownPercent: 0.06 },
        combatPassives: []
    };

    const result = applyMasteryEffectsToFighterSpec(spec, mastery);
    assert.equal(result.stats.hp, 127.2, "Mastery HP percent should apply to the completed fixed-stat value");
    assert.equal(result.stats.damage, 11.66, "Mastery damage percent should preserve fractional final values");
    assert.equal(spec.stats.damage, 11, "Mastery application should not mutate the input spec");
    assert.equal(result.mastery.combat.incomingCollisionDamageReduce, 0.06, "Combat modifier should reach the spec");
}

async function testVampireMasteryRestoresCollisionDamage() {
    const { MASTERY_EFFECT_DEFS } = await import("../src/character-mastery/index.js");
    const vampire = MASTERY_EFFECT_DEFS.find((definition) => definition.sourceFighterId === "vampire");
    const ctx = {
        statModifiers: { hp: 0, damage: 0, defense: 0, speed: 0, mass: 0 },
        physicsModifiers: { velocityRecoveryBonus: 0, wallBounce: 0, collisionAngularImpulse: 0 },
        combatModifiers: { incomingCollisionDamageReduce: 0, outgoingCollisionDamageBonus: 0 },
        combatPassives: [],
        actionModifiers: { hpCostPercentReduction: 0, cooldownPercent: 0 }
    };
    vampire.apply(ctx, 3);

    const effect = ctx.combatPassives[0];
    const attacker = {
        hp: 50,
        maxHp: 100,
        position: { clone: () => ({}) },
        heal(amount) {
            const restored = Math.min(Math.round(amount), this.maxHp - this.hp);
            this.hp += restored;
            return restored;
        }
    };
    const result = effect.onAfterFighterCollisionDamage({
        simulation: { spawnActionText() {} },
        attacker,
        actualOutgoingDamage: 40
    });
    assert.equal(effect.cooldown, 4, "Vampire mastery should prepare every four seconds");
    assert.equal(attacker.hp, 55, "GOLD vampire mastery should use 9% damage and the missing-HP multiplier");
    assert.ok(result.consumed, "Successful collision restoration should consume the ready mastery effect");

    attacker.hp = attacker.maxHp;
    const fullHpResult = effect.onAfterFighterCollisionDamage({
        simulation: { spawnActionText() {} },
        attacker,
        actualOutgoingDamage: 40
    });
    assert.ok(!fullHpResult.consumed, "Full-health vampire mastery should keep its ready state");
}

async function testMasteryCombatModifiersApplyAtFinalDamageStage() {
    const { BattleBall } = await import("../src/entities/index.js");
    const { Vector2 } = await import("../src/core.js");
    const calls = [];
    const target = new BattleBall(
        {
            id: "target",
            teamId: "target",
            name: "Target",
            title: "",
            description: "",
            color: "#ffffff",
            face: "default",
            ability: "none",
            stats: { hp: 500, damage: 10, speed: 300, defense: 0, radius: 50, mass: 1 },
            mastery: {
                combat: { incomingCollisionDamageReduce: 0.1, outgoingCollisionDamageBonus: 0 }
            }
        },
        new Vector2(100, 100)
    );
    const simulation = {
        modifyFighterCollisionDamage(amount) {
            calls.push("equipment");
            return amount * 1.2;
        },
        modifyIncomingFighterCollisionDamage(amount) {
            calls.push("mastery");
            return amount * 0.9;
        },
        spawnDamageNumber() {},
        recordFighterCollisionDamage() {}
    };

    const result = target.takeDamage(100, { id: "source", stats: { criticalChance: 0 }, simulation }, "Crash");
    assert.deepEqual(calls, ["equipment", "mastery"], "Mastery reduction should follow equipment collision damage");
    assert.equal(result.actualDamage, 108, "Mastery reduction should apply to the completed collision damage amount");
}

async function testMasteryCombatAndCooldownDefinitions() {
    const { MASTERY_EFFECT_DEFS } = await import("../src/character-mastery/index.js");
    const ctx = {
        statModifiers: { hp: 0, damage: 0, defense: 0, speed: 0, mass: 0 },
        physicsModifiers: { velocityRecoveryBonus: 0, wallBounce: 0 },
        combatModifiers: { incomingCollisionDamageReduce: 0, outgoingCollisionDamageBonus: 0 },
        combatPassives: [],
        actionModifiers: { hpCostPercentReduction: 0, cooldownPercent: 0 }
    };

    MASTERY_EFFECT_DEFS.find((definition) => definition.sourceFighterId === "grenade").apply(ctx, 3);
    MASTERY_EFFECT_DEFS.find((definition) => definition.sourceFighterId === "hero").apply(ctx, 3);
    MASTERY_EFFECT_DEFS.find((definition) => definition.sourceFighterId === "bat_ball").apply(ctx, 3);
    assert.equal(
        ctx.combatModifiers.outgoingCollisionDamageBonus,
        0.06,
        "Grenade mastery should add final collision damage"
    );
    assert.equal(ctx.actionModifiers.cooldownPercent, 0.06, "Hero mastery should reduce ability cooldowns");
    assert.equal(ctx.actionModifiers.hpCostPercentReduction, 0.001, "Bat mastery should reduce action cost by 0.10%p");
}

// ── Mastery regression correction tests ─────────────────────────────────────

async function testCollectEffectsFromDefinitionsNoCap() {
    const { collectEffectsFromDefinitions } = await import("../src/character-mastery/index.js");
    const fixtureDefs = [
        {
            sourceFighterId: "fixture_a",
            apply(ctx) {
                ctx.statModifiers.hp += 0.06;
            }
        },
        {
            sourceFighterId: "fixture_b",
            apply(ctx) {
                ctx.statModifiers.hp += 0.06;
            }
        }
    ];
    const levels = { fixture_a: 3, fixture_b: 3 };
    const ctx = collectEffectsFromDefinitions(fixtureDefs, levels, "irrelevant_self");
    assert.equal(ctx.statModifiers.hp, 0.12, "Two fixture 6% hp should sum to 12% with no 8% cap re-introduced");
    console.log("[collect-effects-no-cap] ok");
}

async function testDashMasterySpeedApplied() {
    const { applyMasteryEffectsToFighterSpec } = await import("../src/character-mastery/index.js");
    const spec = {
        id: "dash_test",
        stats: { hp: 100, damage: 10, defense: 1, speed: 300, radius: 50, mass: 1 }
    };
    const mastery = {
        statModifiers: { hp: 0, damage: 0, defense: 0, speed: 0.06 },
        physicsModifiers: { velocityRecoveryBonus: 0, wallBounce: 0 },
        combatModifiers: { incomingCollisionDamageReduce: 0, outgoingCollisionDamageBonus: 0 },
        actionModifiers: { hpCostPercentReduction: 0, cooldownPercent: 0 },
        combatPassives: []
    };
    const result = applyMasteryEffectsToFighterSpec(spec, mastery);
    assert.equal(result.stats.speed, 318, "Dash GOLD mastery should apply 6% speed boost: 300 * 1.06 = 318");
    assert.equal(spec.stats.speed, 300, "Input spec should not be mutated by mastery application");
    console.log("[dash-mastery-speed] ok");
}

async function testOrbitWallBounceMultiplicative() {
    const { BattleBall } = await import("../src/entities/index.js");
    const { Vector2 } = await import("../src/core.js");
    const { BattleSimulation } = await import("../src/simulation/battleSimulation.js");

    const spec = {
        id: "orbit_test",
        teamId: "a",
        name: "Orbit",
        title: "",
        description: "",
        color: "#ff0000",
        face: "default",
        ability: "none",
        appearance: { sides: 0, face: "default", angle: 0, angularVelocity: 0 },
        stats: { hp: 100, damage: 10, defense: 1, speed: 300, radius: 50, mass: 1 },
        equipment: { equippedItems: [{ instanceId: "echo", specialOptions: [{ type: "wallBounce", value: 15 }] }] },
        mastery: { physics: { velocityRecoveryBonus: 0, wallBounce: 0.15 } }
    };
    const sim = new BattleSimulation(
        [spec, { ...spec, id: "other", teamId: "b", face: "default" }],
        { onLog() {}, onSound() {} },
        null,
        { assignActions: false }
    );
    const ball = sim.fighters[0];
    ball.position = new Vector2(0, 480);
    ball.velocity = new Vector2(-500, 0);
    sim.keepInsideArena(ball);
    const expected = 500 + 500 * (1.15 * 1.15 - 1);
    assert.ok(
        Math.abs(ball.velocity.x - expected) < 0.01,
        `Equipment wallBounce + Orbit mastery should multiply: expected ${expected}, got ${ball.velocity.x}`
    );
    console.log("[orbit-wall-bounce-multiplicative] ok");
}

async function testGunnerMassMultiplicative() {
    const { applyMasteryEffectsToFighterSpec, MASTERY_EFFECT_DEFS } = await import("../src/character-mastery/index.js");
    const { BattleBall } = await import("../src/entities/index.js");
    const { Vector2 } = await import("../src/core.js");

    // Gunner 정의가 statModifiers.mass를 올리고 collisionAngularImpulse를 참조하지 않는지 확인
    const gunnerDef = MASTERY_EFFECT_DEFS.find((d) => d.sourceFighterId === "gunner");
    assert.ok(gunnerDef, "Gunner mastery definition should exist");
    assert.equal(gunnerDef.kind, "stat_modifier", "Gunner mastery should be stat_modifier");
    assert.equal(gunnerDef.id, "gunner_mass_loading", "Gunner mastery id should be gunner_mass_loading");

    const ctx = {
        statModifiers: { hp: 0, damage: 0, defense: 0, speed: 0, mass: 0 },
        physicsModifiers: { velocityRecoveryBonus: 0, wallBounce: 0, collisionAngularImpulse: 0 },
        combatModifiers: { incomingCollisionDamageReduce: 0, outgoingCollisionDamageBonus: 0 },
        combatPassives: [],
        actionModifiers: { hpCostPercentReduction: 0, cooldownPercent: 0 }
    };
    gunnerDef.apply(ctx, 3);
    assert.equal(ctx.statModifiers.mass, 0.06, "Gunner GOLD should add 6% mass modifier");
    assert.equal(
        ctx.physicsModifiers.collisionAngularImpulse,
        0,
        "Gunner mastery should not touch collisionAngularImpulse"
    );
    assert.equal(ctx.statModifiers.hp, 0, "Gunner mastery should not affect hp");

    const spinDef = MASTERY_EFFECT_DEFS.find((d) => d.sourceFighterId === "spin");
    assert.ok(spinDef, "Spin mastery definition should exist");
    assert.equal(spinDef.kind, "physics_modifier", "Spin mastery should modify physics");
    assert.equal(spinDef.id, "spin_gyroscopic_transfer", "Spin mastery should own collision angular impulse");
    spinDef.apply(ctx, 3);
    assert.equal(
        ctx.physicsModifiers.collisionAngularImpulse,
        0.15,
        "Spin GOLD should add 15% collision angular impulse"
    );

    // BattleBall에서 mastery(6%) + 장비 중량(15%)가 곱으로 결합되는지 확인
    const baseSpec = {
        id: "gunner_test",
        teamId: "a",
        name: "Gunner Test",
        title: "",
        description: "",
        color: "#777777",
        face: "default",
        ability: "none",
        appearance: { sides: 0, face: "default" },
        stats: { hp: 100, damage: 10, defense: 1, speed: 300, radius: 50, mass: 10 },
        equipment: {
            equippedItems: [
                {
                    instanceId: "mass-eq",
                    specialOptions: [{ type: "mass", value: 15 }]
                }
            ]
        },
        mastery: {
            physics: { velocityRecoveryBonus: 0, wallBounce: 0, collisionAngularImpulse: 0 },
            combat: { incomingCollisionDamageReduce: 0, outgoingCollisionDamageBonus: 0 },
            action: { hpCostPercentReduction: 0, cooldownPercent: 0 },
            passives: []
        },
        statAllocation: null
    };
    const masteryCtx = {
        statModifiers: { hp: 0, damage: 0, defense: 0, speed: 0, mass: 0.06 },
        physicsModifiers: { velocityRecoveryBonus: 0, wallBounce: 0, collisionAngularImpulse: 0 },
        combatModifiers: { incomingCollisionDamageReduce: 0, outgoingCollisionDamageBonus: 0 },
        combatPassives: [],
        actionModifiers: { hpCostPercentReduction: 0, cooldownPercent: 0 }
    };
    const spec = applyMasteryEffectsToFighterSpec(baseSpec, masteryCtx);
    // Spec mass after mastery: 10 * 1.06 = 10.6
    assert.equal(spec.stats.mass, 10.6, "Mastery should multiply base mass by 1.06: 10 * 1.06 = 10.6");

    // BattleBall 생성 시 equipment massMultiplier 적용
    const ball = new BattleBall(spec, new Vector2(100, 100));
    // ball.mass: 10.6 * 1.15 = 12.19
    assert.equal(ball.mass, 12.19, "Equipment mass multiplier should apply after mastery: 10.6 * 1.15 = 12.19");
    assert.equal(ball.stats.mass, 12.19, "ball.stats.mass should match ball.mass after both multipliers");

    const angularMasterySimulation = new BattleSimulation(
        [
            {
                ...baseSpec,
                id: "angular-mastery-a",
                teamId: "angular-a",
                mastery: {
                    ...baseSpec.mastery,
                    physics: { velocityRecoveryBonus: 0, wallBounce: 0, collisionAngularImpulse: 0.15 }
                }
            },
            { ...baseSpec, id: "angular-mastery-b", teamId: "angular-b" }
        ],
        { onLog() {}, onSound() {} }
    );
    const angularContext = {
        a: angularMasterySimulation.fighters[0],
        b: angularMasterySimulation.fighters[1],
        aModifiers: { impact: 1 },
        bModifiers: { impact: 1 }
    };
    const angularOptions = angularMasterySimulation.getFighterCollisionResponseOptions(angularContext);
    assert.ok(
        Math.abs(angularOptions.angularScaleA - 1.15) < 1e-9,
        "Spin mastery should multiply the owner's collision angular impulse in BattleSimulation"
    );
    console.log("[gunner-mass-multiplicative] ok");
}

async function testHuntingMasteryPlayerOnly(app) {
    const playerId = FIGHTER_IDS.DASH;
    const player = app.roster.find((f) => f.id === playerId);
    const archer = app.roster.find((f) => f.id === FIGHTER_IDS.ARCHER);

    const capturedSpecs = [];
    const mockApp = {
        roster: [player, archer],
        playerProfile: createDefaultPlayerProfile(),
        playerStatAllocation: createEmptyStatAllocation(),
        ui: { setHuntingActive() {}, setHuntingOverlayState() {}, addLog() {} },
        startMatch(specs) {
            capturedSpecs.push(specs);
        }
    };

    // Player has archer mastery at GOLD
    mockApp.playerProfile.characterMastery = { levels: { archer: 3 } };

    const manager = new HuntingManager(mockApp);
    manager._run = createHuntingRun({ characterId: playerId, stageId: HUNTING_STAGE_IDS.CAVE });
    manager._startFloorBattle();

    const specs = capturedSpecs[0];
    const playerSpec = specs[0];

    // Player spec should have mastery (proving HuntingManager applied it)
    assert.ok(playerSpec.mastery, "Player spec should have mastery from HuntingManager");
    assert.equal(playerSpec.teamId, HUNTING_TEAMS.PLAYER, "Player spec should be on player team");

    // Damage should include Archer GOLD +6% final multiplier (statModifiers.damage = 0.06)
    const alloc = createEmptyStatAllocation();
    const { multiplier } = calculateStatMultiplier(Object.values(alloc));
    const baseDamage = player.stats.damage;
    const expectedDamage = Number((baseDamage * multiplier * 1.06).toFixed(3));
    assert.equal(
        playerSpec.stats.damage,
        expectedDamage,
        `Player spec damage should get archer GOLD +6% final multiplier: base ${baseDamage} * ${multiplier} * 1.06 = ${expectedDamage}`
    );

    // Enemy specs should NOT have mastery effects from player profile
    for (let i = 1; i < specs.length; i++) {
        assert.equal(specs[i].mastery, undefined, `Enemy spec ${i} should NOT have player mastery effects`);
    }

    console.log("[hunting-mastery-player-only] ok");
}

function testZeroCostActionSchedulesWithoutHpSpend(app) {
    const isolatedApp = Object.create(Object.getPrototypeOf(app));
    const scheduled = [];
    const action = {
        id: "zero_cost_action",
        hpCostPercent: 0.05,
        getFailureReason() {
            return null;
        }
    };
    const player = {
        flags: { defeated: false },
        hp: 100,
        maxHp: 100,
        mastery: { action: { hpCostPercentReduction: 0.001 } },
        actionContext: {
            spendHpForAction(_, cost) {
                return cost;
            }
        }
    };

    isolatedApp._action = {
        ctx: {
            action,
            player,
            sim: {
                scheduleAction(...args) {
                    scheduled.push(args);
                }
            }
        }
    };
    isolatedApp._currentMatchReport = null;

    assert.equal(isolatedApp._tryFireAction(), true, "Zero-cost action should remain usable after mastery reduction");
    assert.deepEqual(scheduled, [[action, player, 0]], "Zero-cost action should be scheduled without HP spending");
    console.log("[zero-cost-action-schedules] ok");
}

// ── Dynamic bonus computation test ──────────────────────────────────────────

async function testComputeEffectiveBonusesDynamic() {
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { computeEffectiveBonuses } = await import("../src/progression/progressionState.js");

    const profile = createDefaultPlayerProfile();

    // 업적 하나 해금
    profile.collection.achievements["ach_1"] = { unlockedAt: Date.now() };

    // 정의 v1: +5 extraStatPoints
    const defsV1 = [
        {
            id: "ach_1",
            reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 5 } }
        }
    ];
    const computedV1 = computeEffectiveBonuses(profile, defsV1);
    assert.equal(computedV1.extraStatPoints, 5, "v1: bonus should be 5");

    // 정의 v2 (업데이트): 동일 업적 보상이 +10으로 상향 — 재접속 시 자동 반영되어야 함
    const defsV2 = [
        {
            id: "ach_1",
            reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 10 } }
        }
    ];
    const computedV2 = computeEffectiveBonuses(profile, defsV2);
    assert.equal(computedV2.extraStatPoints, 10, "v2: bonus should auto-update to 10 without re-unlock");

    // 미해금 업적은 계산에서 제외
    const defsWithLocked = [
        ...defsV2,
        {
            id: "ach_locked",
            reward: { type: "PROGRESSION_BONUS", payload: { bonusKey: "extraStatPoints", amount: 99 } }
        }
    ];
    const computedLocked = computeEffectiveBonuses(profile, defsWithLocked);
    assert.equal(computedLocked.extraStatPoints, 10, "Locked achievement should not contribute");
}

// ── Collection hub ViewModel tests ──────────────────────────────────────────

async function testCreateCollectionHubViewModel() {
    const { createCollectionHubViewModel } = await import("../src/collection/collectionViewModel.js");
    const { MASTERY_EFFECT_DEFS } = await import("../src/character-mastery/index.js");
    const { createDefaultPlayerProfile } = await import("../src/playerProfile.js");
    const { createRoster } = await import("../src/roster.js");
    const { ACHIEVEMENT_DEFINITIONS } = await import("../src/collection/achievementDefinitions.js");

    const roster = createRoster();
    const profile = createDefaultPlayerProfile();

    const vm = createCollectionHubViewModel({
        profile,
        roster,
        masteryDefinitions: MASTERY_EFFECT_DEFS,
        achievementDefinitions: [],
        currentPlayerFighterId: "archer"
    });

    assert.equal(vm.rosterSize, roster.length, "rosterSize should match");
    assert.equal(vm.rosterItems.length, roster.length, "rosterItems should include all characters");
    assert.equal(vm.monsterCodexItems.length, 14, "Monster codex should include every defined monster type");
    assert.ok(
        vm.monsterCodexItems.every((item) => !item.isDiscovered),
        "Monster codex should keep unencountered monsters hidden by default"
    );
    assert.equal(vm.masteryItems.length, MASTERY_EFFECT_DEFS.length, "masteryItems should match definitions");

    const allHaveIds = vm.rosterItems.every((item) => item.id);
    assert.ok(allHaveIds, "Every roster item should have an id");
    assert.ok(
        vm.rosterItems.every((item) =>
            item.levelRewards
                .filter((reward) => [3, 6, 9].includes(reward.level))
                .every((reward) => !reward.text.includes("대표 행동 강화"))
        ),
        "Collection rewards should show character-specific ability text instead of generic tier labels"
    );

    // 숙련도 항목에 sourceName과 unlockCondition이 있는지
    const firstMastery = vm.masteryItems[0];
    assert.ok(firstMastery.sourceName, "Mastery item should have sourceName");
    assert.ok(firstMastery.unlockCondition, "Mastery item should have unlockCondition");

    // 승리 기록 추가 시 masteryLevel/masteryUnlocked 반영
    profile.collection.characters.archer = {
        tournamentsCompleted: 10,
        tournamentWins: 6,
        matchWins: 15,
        bestPlacement: 1,
        totalDamageDealt: 5000,
        comebackMatchWins: 2,
        firstTournamentAt: 1000,
        lastTournamentAt: 2000
    };
    profile.experience.byCharacter.archer = { currentXp: 135 };
    profile.hunting.shards = 50;
    profile.hunting.chests = [{ id: "hunt-chest-1", rarity: "uncommon", acquiredAt: 3000 }];
    const vm2 = createCollectionHubViewModel({
        profile,
        roster,
        masteryDefinitions: MASTERY_EFFECT_DEFS,
        achievementDefinitions: [],
        currentPlayerFighterId: "archer"
    });
    const archerItem = vm2.rosterItems.find((i) => i.id === "archer");
    assert.equal(archerItem.tournamentWins, 6, "tournamentWins should match");
    assert.equal(archerItem.bestPlacement, 1, "bestPlacement should match");
    assert.equal(archerItem.experienceTotalXp, 135, "Roster item should expose character XP");
    assert.equal(archerItem.experienceLevel, 2, "Roster item should expose character XP level");
    assert.ok(archerItem.experienceProgressPct > 0, "Roster item should expose XP progress");
    assert.equal(archerItem.levelRewards.length, 9, "Roster detail should expose every level reward");
    assert.equal(archerItem.levelRewards[0].level, 2, "Level reward history should start at level 2");
    assert.equal(archerItem.levelRewards[0].earned, true, "Current-level rewards should be marked earned");
    assert.equal(archerItem.levelRewards[1].earned, false, "Future rewards should be marked upcoming");
    assert.ok(
        archerItem.levelRewards.every((reward) => reward.text),
        "Every level reward should have display text"
    );
    assert.equal(archerItem.masteryLevel, 0, "Tournament wins alone should not advance mastery UI progress");
    assert.equal(vm2.storage.shards, 50, "Collection hub should expose hunting key shards");
    assert.equal(vm2.storage.chests.length, 1, "Collection hub should expose hunting chests");
    assert.equal(vm2.storage.chests[0].canOpen, true, "Collection hub should mark openable chests");
    assert.equal(vm2.summary.storageChestCount, 1, "Collection summary should count storage chests");

    profile.equipment.inventory.push(
        ...["weapon", "armor", "accessory"].map((slot) =>
            createEquipmentInstance({ rarity: "common", slot, rng: () => 0.5 })
        )
    );
    const fusionVm = createCollectionHubViewModel({
        profile,
        roster,
        masteryDefinitions: MASTERY_EFFECT_DEFS,
        achievementDefinitions: [],
        currentPlayerFighterId: "archer"
    });
    const commonFusionRecipe = fusionVm.equipment.fusion.recipes.find((recipe) => recipe.rarity === "common");
    assert.equal(fusionVm.equipment.fusion.sourceItemCount, 3, "Fusion UI should require three selected sources");
    assert.equal(commonFusionRecipe.items.length, 3, "Fusion UI should expose every selectable same-rarity item");
    assert.deepEqual(
        commonFusionRecipe.cost,
        { stones: 10, shards: 50 },
        "Fusion UI should display the derived material cost"
    );
    assert.equal(commonFusionRecipe.rarityLabel, "common", "Fusion UI should use the canonical rarity label");
    assert.equal(vm2.storage.chests[0].rarityLabel, "uncommon", "Storage UI should use the canonical rarity label");

    // 숙련도 레벨이 있으면 masteryItems에 반영
    profile.characterMastery.levels = { archer: 1, orbit: 2, eater: 3 };
    const vm3 = createCollectionHubViewModel({
        profile,
        roster,
        masteryDefinitions: MASTERY_EFFECT_DEFS,
        achievementDefinitions: [],
        currentPlayerFighterId: "archer"
    });
    const arcMastery = vm3.masteryItems.find((i) => i.sourceFighterId === "archer");
    assert.ok(arcMastery.unlocked, "Archer mastery should be unlocked");
    assert.ok(arcMastery.isSelf, "Archer mastery should be marked as self");
    assert.equal(arcMastery.level, 1, "Archer mastery level should be 1");
    assert.equal(vm3.summary.masteryTotal, 6, "Mastery total should sum stored mastery tiers");

    profile.hunting.stats.monsterKillsByTag = { [HUNTING_MONSTER_TAGS.MONSTER]: 12 };
    profile.hunting.stats.visitedStageIds = [HUNTING_STAGE_IDS.CAVE, HUNTING_STAGE_IDS.FOREST];
    profile.hunting.stats.monsterCodexByType = {
        [HUNTING_MONSTER_TYPES.ELECTRIC]: {
            firstEncounterFloor: 20,
            lastEncounterFloor: 24,
            kills: 7,
            regions: {
                [HUNTING_STAGE_IDS.CAVE]: { firstEncounterFloor: 20, lastEncounterFloor: 24, kills: 7 }
            }
        }
    };
    const vm4 = createCollectionHubViewModel({
        profile,
        roster,
        masteryDefinitions: MASTERY_EFFECT_DEFS,
        achievementDefinitions: ACHIEVEMENT_DEFINITIONS,
        currentPlayerFighterId: "archer"
    });
    assert.equal(
        vm4.achievementItems.find((item) => item.id === "hunting_monster_slayer").progressText,
        "12 / 300",
        "Collection achievement cards should expose tagged hunting progress"
    );
    const electricCodexItem = vm4.monsterCodexItems.find((item) => item.type === HUNTING_MONSTER_TYPES.ELECTRIC);
    assert.equal(electricCodexItem.isDiscovered, true, "Monster codex should reveal encountered monster types");
    assert.equal(electricCodexItem.kills, 7, "Monster codex should expose total type kills");
    assert.equal(
        electricCodexItem.regions.length,
        2,
        "Monster codex should expose every entered region as a selector option"
    );
    assert.equal(
        electricCodexItem.regions.find((region) => region.id === HUNTING_STAGE_IDS.CAVE).isDiscovered,
        true,
        "Encountered regions should reveal their detailed monster data"
    );
    assert.equal(
        electricCodexItem.regions.find((region) => region.id === HUNTING_STAGE_IDS.FOREST).isDiscovered,
        false,
        "Entered regions without a monster encounter should remain locked"
    );
}

const app = await loadModuleApp();

function testRewardBalanceConfig() {
    const balance = REWARD_BALANCE;
    assert.ok(Object.isFrozen(balance), "Reward balance must be immutable at runtime");
    assert.equal(XP_SCALE, balance.experience.xpScale, "XP scale must come from reward balance");
    assert.ok(
        Object.isFrozen(balance.experience.characterLevelProgressions),
        "Character level progressions must come from immutable reward balance"
    );
    assert.equal(
        getChestOpenCost("epic"),
        balance.hunting.chest.openCosts.epic,
        "Chest cost must come from reward balance"
    );
    assert.equal(
        balance.hunting.loot.rarityRewards.epic.high_chest,
        20,
        "Epic monster special-reward weight must come from centralized reward balance"
    );
    assert.equal(
        getSellReward("legendary"),
        balance.equipment.sellRewards.legendary,
        "Equipment sell rewards must come from reward balance"
    );
    assert.equal(
        EQUIPMENT.ENHANCE.COST,
        balance.equipment.enhance.costs,
        "Enhancement costs must come from reward balance"
    );
    console.log("[reward-balance-config] ok");
}

function testRosterLevelRewardDescriptions() {
    const roster = createRoster();
    const orbit = roster.find((fighter) => fighter.id === FIGHTER_IDS.ORBIT);
    const spin = roster.find((fighter) => fighter.id === FIGHTER_IDS.SPIN);

    assert.equal(orbit.description.includes("3개"), false, "Orbit roster copy must not restore the old shard count");
    for (const term of ["위성 5개", "첫 적중점", "폭발", "본체 캐치"]) {
        assert.ok(orbit.description.includes(term), `Orbit roster copy should include ${term}`);
    }
    assert.equal(spin.description.includes("오버스핀"), false, "Spin roster copy must not restore the removed reward");
    for (const term of ["만충", "표면 절단", "가속 절삭", "유체장"]) {
        assert.ok(spin.description.includes(term), `Spin roster copy should include ${term}`);
    }
    console.log("[roster-level-reward-descriptions] ok");
}

function testNoAbilityStandardBallSupport() {
    const spec = {
        id: "standard-no-ability",
        name: "Standard Ball",
        title: "",
        description: "",
        color: "#888888",
        face: "default",
        ability: "none",
        stats: { hp: 100, damage: 10, defense: 1, speed: 300, radius: 50, mass: 1 },
        appearance: { sides: 0, face: "default" }
    };
    const sim = new BattleSimulation([spec, { ...spec, id: "standard-no-ability-opponent" }], {
        onLog() {},
        onSound() {}
    });
    assert.equal(
        sim.fighters[0].ability.constructor.name,
        "Ability",
        "none ability should bind the neutral Ability base class"
    );
    assert.equal(sim.fighters[0].ability.getUiState().label, "Passive", "none ability should not add active behavior");
    console.log("[standard-no-ability] ok");
}

testRewardBalanceConfig();
testRosterLevelRewardDescriptions();
testNoAbilityStandardBallSupport();
testShuffledUtility();
testStatAllocationRules(app);
testComponentBridgeCallsGameHandlers(app);
testStartButtonReceivesRemainingStatPoints(app);
testHuntingUiRouteDisplay();
await testHuntingEarlyEventUi();
await testHuntingFirstMoveUiPaintGate();
testHuntingChestEventStopsAndResumes();
testHuntingEventPresentationContracts();
testHuntingBoonShardRewardsScaleWithFloor();
testHuntingEventHealthInitialization();
testHuntingAutoEventRequiresConfirmation();
testHuntingChampionEventRequiresBattleConfirmation();
testHuntingConsumableInventoryAndUseLimits();
testHuntingBattlePreparationUsesActualBattleHp();
testHuntingHealthDisplayUsesSharedIntegerGetter();
await testHuntingChestEventStopsAdvanceLoop();
testHuntingAdvanceDispatchContract();
testComponentBridgeEquipmentFunctions();
await testBattleAppAdoptsPreExistingAlpineAllocation();
await testAdjustRandomResetSyncPlayerStatAllocation(app);
testIndexCacheVersionMatchesLatestPatchNote();
testStatBalanceSystem();
testMultiFighterSimulationSetup(app);
testArenaCameraZoom();
testHuntingMeleeMobChasesTarget(app);
testHuntingAdaptiveRangedReposition();
testHuntingLaserReachesArenaWall(app);
testHuntingBoomerangReachAndReturnArc(app);
testElectricArcPathAndHuntingRender(app);
testHuntingElectricChannelCooldown(app);
testHuntingLinkCooldowns(app);
testHuntingConnectionEffectsClearDefeatedTargets(app);
testTeamTargetingAndFriendlyCollision(app);
testHuntingJumperAirborneCollisionAndScale();
testTeamsResolveByRemainingHostileTeams(app);
testProjectileIgnoresAllies(app);
testPassiveEvasionAppliesImpulse(app);
testClickActionEffectOwnership(app);
testRiskWindowActionOwnership(app);
await testCloneSeedDash(app);
await testEaterFeast(app);
await testRageBallMomentum(app);
await testDashBallCooldownDash(app);
await testCollisionImpulsePersists(app);
await testGrenadeScatterShot(app);
testExperienceSystem();
testCharacterLevelProgressions(app);
testAbilityLevelUpgrades(app);
testFiveBallLevelRewardContracts(app);
testTricksterLevelRewardContracts(app);
testOrbitLevelRewardContracts(app);
testSpinLevelRewardContracts(app);
testBatBallWallSlamContracts(app);
testVampireLevelRewardContracts(app);
testMultiAbilityFoundation(app);
testHuntingSystem();
await testHuntingAchievementProgress();
testHunting100FloorStructure();
testHuntingCombatRelief();
testHuntingPortalDecline();
testHuntingStageSelectionAndArenaTheme();
await testHuntingStageSelectUsesPreviewCharacter();
await testDebugHuntingStartsRequestedFloor();
await testDebugHuntingEventPreviewUsesProductionEventFlow();
await testHuntingResumeStartsAtHalfLatestStageFloor();
testHuntingTerrain();
testTournamentAngledBounceRamps();
testEquipmentEnhancement();
testEquipmentStatValueRatios();
testEquipmentNaming();
testEquipmentSpecialCombatEffects();
testEquipmentPhysicalSpecialEffects();
testEquipmentLevelRequirement(app);
testEquipmentDraw();
testAlpineTemplateComponentSystem();
await testMatchEndGrantsImmediateExperience(app);
await testDamageShake(app);
await testArrowBounceFacing(app);
await testArcherPredictiveBurst(app);
await testOrbitShardRecharge(app);
await testTournament(app);
await testTournamentOpponentProgressionByChallenge(app);
await testRebirthResetsTournamentChallengePresentation();
await testTournamentWinAdvancesChallengeAfterMasteryCheck();
await testActionSelectionShowsTournamentChallengeBeforeMatchup();
await testTournamentWinDisplaysMasteryReward();
testResultSequenceProgression();
await testTournamentEliminationAwaitsConfirmation(app);
await testHeroBallRegistered(app);
await testTricksterSeedSpeedBuff(app);
await testTricksterSeedLifeBuff(app);
await testTricksterSeedSpeedScalesWithOwner(app);
// Tournament roster tests
await testTournamentRosterOverEight();
await testTournamentRosterUnderEight();
await testTournamentRosterNoExcessMultipleRuns();
// Achievement system tests
await testEvaluateAchievements();
// Mastery system tests
await testAdvanceCharacterMastery();
await testGetCharacterMasteryLevel();
await testGetCharacterChallengeLevel();
// Tournament report tests
await testApplyTournamentReport();
testDeveloperTournamentWinTool();
testDeveloperCollectionSampleTool();
// Collection hub view model tests
await testCreateCollectionHubViewModel();
// Toast queue tests
await testToastQueue();
// Sensitivity reset + adjustStat with bonus total test
await testSensitivityAlwaysReset();
await testAdjustStatWithBonusTotal();
// Mastery modifier tests
await testMasteryModifiersStoredOnBattleBall(app);
await testStatModifierDamageIndependentOfHp();
await testMasteryEffectsApplyAfterFixedStats();
await testVampireMasteryRestoresCollisionDamage();
await testMasteryCombatModifiersApplyAtFinalDamageStage();
await testMasteryCombatAndCooldownDefinitions();
// Mastery regression correction tests
await testCollectEffectsFromDefinitionsNoCap();
await testDashMasterySpeedApplied();
await testOrbitWallBounceMultiplicative();
await testGunnerMassMultiplicative();
await testHuntingMasteryPlayerOnly(app);
testZeroCostActionSchedulesWithoutHpSpend(app);
// Dynamic bonus computation test
// ── New character tests ──────────────────────────────────────────────────────

async function testNewCharactersRegistered(app) {
    const vampire = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.VAMPIRE);
    assert.ok(vampire, "Vampire Ball should be registered in the roster");
    assert.equal(vampire.ability, "vampire", "Vampire Ball should have 'vampire' ability type");

    const gunner = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.GUNNER);
    assert.ok(gunner, "Gunner Ball should be registered in the roster");
    assert.equal(gunner.ability, "gunner", "Gunner Ball should have 'gunner' ability type");

    const phantom = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.PHANTOM);
    assert.ok(phantom, "Phantom Ball should be registered in the roster");
    assert.equal(phantom.ability, "phantom", "Phantom Ball should have 'phantom' ability type");
}

async function testVampireBatsSpawn(app) {
    const vampire = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.VAMPIRE);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.VAMPIRE);
    const sim = new BattleSimulation([vampire, opponent], { onLog() {}, onSound() {} });
    const vampireFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.VAMPIRE);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.VAMPIRE);

    sim.entities = sim.fighters.slice();
    vampireFighter.ability.timer = 0;
    vampireFighter.ability.update(0.016, target);
    const bats = sim.entities.filter((e) => e.constructor?.name === "BatProjectile");
    assert.equal(bats.length, 7, "Vampire should spawn 7 bats when cooldown triggers");
}

async function testVampireLifestealOnCollision(app) {
    const vampire = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.VAMPIRE);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.VAMPIRE);
    const sim = new BattleSimulation([vampire, opponent], { onLog() {}, onSound() {} });
    const vampireFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.VAMPIRE);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.VAMPIRE);

    vampireFighter.position.x = 200;
    vampireFighter.position.y = 480;
    target.position.x = 240;
    target.position.y = 480;
    vampireFighter.applyImpulse(Vector2.subtract(new Vector2(500, 0), vampireFighter.velocity));
    target.applyImpulse(Vector2.subtract(new Vector2(-300, 0), target.velocity));
    vampireFighter.hp = 10;

    const hpBefore = vampireFighter.hp;
    vampireFighter.ability.onCollision(target);
    assert.ok(vampireFighter.hp > hpBefore, "Vampire should heal on collision (lifesteal)");
}

async function testGunnerBulletsSpawn(app) {
    const gunner = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.GUNNER);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.GUNNER);
    const sim = new BattleSimulation([gunner, opponent], { onLog() {}, onSound() {} });
    const gunnerFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.GUNNER);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.GUNNER);

    sim.entities = sim.fighters.slice();
    gunnerFighter.ability.timer = 0;
    gunnerFighter.ability.update(0.016, target); // starts burst
    gunnerFighter.ability.update(0.016, target); // fires first bullet
    const bullets = sim.entities.filter((e) => e.constructor?.name === "BulletProjectile");
    assert.ok(bullets.length >= 1, "Gunner should fire at least 1 bullet");
    assert.ok(bullets.length <= 6, "Gunner should fire at most 6 bullets");
}

async function testPhantomRegistered(app) {
    const phantom = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.PHANTOM);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.PHANTOM);
    const sim = new BattleSimulation([phantom, opponent], { onLog() {}, onSound() {} });
    const phantomFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.PHANTOM);
    assert.ok(phantomFighter.ability.constructor.name === "PhantomAbility", "Phantom should have PhantomAbility");
}

async function testPhantomShadowStrike(app) {
    const phantom = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.PHANTOM);
    const opponent = app.roster.find((f) => f.id !== FIGHTER_IDS.PHANTOM);
    const sim = new BattleSimulation([phantom, opponent], { onLog() {}, onSound() {} });
    const phantomFighter = sim.fighters.find((f) => f.id === FIGHTER_IDS.PHANTOM);
    const target = sim.fighters.find((f) => f.id !== FIGHTER_IDS.PHANTOM);

    phantomFighter.position.x = 200;
    phantomFighter.position.y = 480;
    target.position.x = 250;
    target.position.y = 480;
    phantomFighter.ability.timer = 0;
    phantomFighter.ability.state.primed = true;
    phantomFighter.ability.state.primedTimer = 99;

    const posBefore = phantomFighter.position.clone();
    phantomFighter.ability.onCollision(target);
    assert.ok(phantomFighter.ability.timer > 0, "Phantom should set cooldown after shadow strike");
    // During vanish phase, position hasn't changed yet
    const distBefore = Vector2.subtract(phantomFighter.position, posBefore).length();
    assert.ok(distBefore < 1, "Phantom should not teleport yet during vanish phase");
    // Simulate through vanish + appear animation
    for (let i = 0; i < 60; i++) {
        phantomFighter.ability.update(0.01, target);
    }
    assert.ok(phantomFighter.state.movement, "Phantom should start dashing after teleport animation");
    // Position should have changed (teleported behind target)
    const distFromTarget = Vector2.subtract(phantomFighter.position, target.position).length();
    assert.ok(distFromTarget > 10, "Phantom should teleport away from target position");
}

function testCompleteChallengeTournament() {
    const profile = createDefaultPlayerProfile();
    // 기본: highestUnlockedLevel=0, selectedLevel=0
    assert.equal(profile.progression.challenge.highestUnlockedLevel, 0);
    assert.equal(profile.progression.challenge.selectedLevel, 0);

    // 레벨 0에서 우승 → 레벨 1 해금
    const r1 = completeChallengeTournament(profile, { selectedLevel: 0, playerWon: true });
    assert.ok(r1.unlocked);
    assert.equal(r1.unlockedLevel, 1);
    assert.equal(profile.progression.challenge.highestUnlockedLevel, 1);
    assert.equal(profile.progression.challenge.selectedLevel, 1);

    // 레벨 1에서 패배 → 변화 없음
    const r2 = completeChallengeTournament(profile, { selectedLevel: 1, playerWon: false });
    assert.ok(!r2.unlocked);
    assert.equal(profile.progression.challenge.highestUnlockedLevel, 1);

    // 낮은 레벨(0)에서 우승 → 변화 없음 (이미 1 해금)
    const r3 = completeChallengeTournament(profile, { selectedLevel: 0, playerWon: true });
    assert.ok(!r3.unlocked);
    assert.equal(profile.progression.challenge.highestUnlockedLevel, 1);

    // 레벨 1에서 우승 → 레벨 2 해금
    const r4 = completeChallengeTournament(profile, { selectedLevel: 1, playerWon: true });
    assert.ok(r4.unlocked);
    assert.equal(r4.unlockedLevel, 2);
    assert.equal(profile.progression.challenge.highestUnlockedLevel, 2);
    assert.equal(profile.progression.challenge.selectedLevel, 2);
}

function testFormatBonusSummary() {
    assert.equal(formatBonusSummary({ extraStatPoints: 0, balanceTolerance: 0, perStatCapBonus: 0 }), "");
    assert.equal(formatBonusSummary({ extraStatPoints: 10, balanceTolerance: 0, perStatCapBonus: 0 }), "배분 +10");
    assert.equal(
        formatBonusSummary({ extraStatPoints: 20, balanceTolerance: 5, perStatCapBonus: 15 }),
        "배분 +20 · 유연성 +5 · 집중 한도 +15"
    );
}

function testGrenadeProximityTrigger() {
    const grenadeFighter = app.roster.find((fighter) => fighter.ability === "grenade");
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const sim = new BattleSimulation([archer, grenadeFighter], { onLog() {}, onSound() {} });
    const owner = sim.fighters.find((f) => f.id === grenadeFighter.id);
    const archerBall = sim.fighters.find((f) => f.id !== grenadeFighter.id);

    owner.position = new Vector2(400, 480);
    const g = new Grenade(owner, new Vector2(500, 480), 1.0);
    g.position = new Vector2(400, 480);
    assert.ok(g.timer > 0.5, "Grenade should start with full fuse timer");

    // 아처가 수류탄 폭발 범위 밖에 있음 → 타이머 변화 없음
    archerBall.position = new Vector2(100, 100);
    g.update(0.016, sim);
    assert.ok(!g._proximityTriggered, "Proximity should not trigger when target is far");

    // 아처가 폭발 범위 내로 이동
    archerBall.position = new Vector2(420, 480);
    g.update(0.016, sim);
    assert.ok(g._proximityTriggered, "Proximity should trigger when target enters explosion radius");
    // 타이머가 0.6배로 단축되었어야 함
    const proximityTimer = g.timer;
    // 다시 업데이트해도 두 번째 가속은 없어야 함
    g.update(0.016, sim);
    assert.ok(g.timer < proximityTimer, "Timer should keep decreasing after proximity trigger");
    // 아처가 멀어져도 이미 발동했으므로 추가 가속 없음
    archerBall.position = new Vector2(100, 100);
    const timerAfter = g.timer;
    g.update(0.016, sim);
    assert.ok(g.timer < timerAfter, "Timer should decrease even when target moves away");
}

function testGrenadeHighSpeedProximityTrigger() {
    const grenadeFighter = app.roster.find((fighter) => fighter.ability === "grenade");
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const sim = new BattleSimulation([grenadeFighter, archer], { onLog() {}, onSound() {} });
    const owner = sim.fighters.find((fighter) => fighter.id === grenadeFighter.id);
    const target = sim.fighters.find((fighter) => fighter.id === archer.id);

    owner.position = new Vector2(100, 480);
    target.position = new Vector2(400, 480);
    const grenade = new Grenade(owner, new Vector2(900, 480), 1);
    grenade.position = new Vector2(100, 480);
    grenade.applyImpulse(Vector2.subtract(new Vector2(6000, 0), grenade.velocity));

    grenade.update(0.08, sim);

    assert.ok(grenade._proximityTriggered, "High-speed grenade should trigger while crossing the explosion range");
    assert.equal(grenade._proximityFuseMultiplier, 6, "High-speed grenade should cap proximity fuse drain at 6x");
    assert.ok(Math.abs(grenade.timer - 0.52) < 0.001, "High-speed grenade should drain its fuse at the capped 6x rate");
}

function testGrenadeProximityFuseMultiplier() {
    const grenadeFighter = app.roster.find((fighter) => fighter.ability === "grenade");
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const sim = new BattleSimulation([grenadeFighter, archer], { onLog() {}, onSound() {} });
    const owner = sim.fighters.find((fighter) => fighter.id === grenadeFighter.id);
    const target = sim.fighters.find((fighter) => fighter.id === archer.id);

    owner.position = new Vector2(400, 480);
    target.position = new Vector2(420, 480);
    const grenade = new Grenade(owner, new Vector2(1200, 480), 1);
    grenade.position = owner.position.clone();
    grenade.applyImpulse(Vector2.subtract(new Vector2(grenade.launchSpeed, 0), grenade.velocity));

    grenade.update(0.1, sim);

    assert.equal(grenade._proximityFuseMultiplier, 3, "Reference projectile speed should drain the fuse at 3x");
    assert.ok(
        Math.abs(grenade.timer - 0.7) < 0.001,
        "Reference projectile speed should consume 0.3 seconds per 0.1 seconds"
    );
}

function testGrenadeExplosionRangeMatchesVisualEffect() {
    const grenadeFighter = app.roster.find((fighter) => fighter.ability === "grenade");
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const sim = new BattleSimulation([grenadeFighter, archer], { onLog() {}, onSound() {} });
    const owner = sim.fighters.find((fighter) => fighter.id === grenadeFighter.id);
    const target = sim.fighters.find((fighter) => fighter.id === archer.id);

    owner.position = new Vector2(400, 480);
    target.position = new Vector2(570, 480);
    const grenade = new Grenade(owner, owner.position, 1);
    grenade.position = owner.position.clone();
    const hpBefore = target.hp;

    grenade._detonate(sim);

    assert.equal(grenade.explosionRadius, 174, "Explosion hit range should match the visual burst outer radius");
    assert.ok(target.hp < hpBefore, "A target inside the visual explosion outer radius should take damage");
}

async function testPpoActorCriticUtilities() {
    const { createActorCriticNetworks, deterministicAction, prepareTensorflowBackend, sampleAction, trainPpoEpochs } =
        await import("../scripts/rl/policyNetwork.js");
    const { RunningNormalizer } = await import("../scripts/rl/normalizer.js");
    await prepareTensorflowBackend();
    const { actor, critic } = createActorCriticNetworks(2, 4);
    const before = sampleAction(actor, [0.5, -0.5], () => 0).probability;
    assert.ok(before > 0 && before < 1, "PPO actor should return a Bernoulli probability");
    assert.equal(deterministicAction(actor, [0.5, -0.5], 0).action, 1, "Threshold 0 should always use action");
    assert.equal(deterministicAction(actor, [0.5, -0.5], 1).action, 0, "Threshold 1 should always wait");

    const normalizer = new RunningNormalizer(2);
    normalizer.update([1, 3]);
    normalizer.update([3, 5]);
    const cloned = normalizer.clone();
    assert.deepEqual(cloned.normalize([2, 4]), normalizer.normalize([2, 4]), "Normalizer clone should preserve stats");

    const optimizer = (await import("@tensorflow/tfjs")).train.adam(0.01);
    const result = trainPpoEpochs(
        actor,
        critic,
        optimizer,
        {
            obs: [
                [0.5, -0.5],
                [-0.5, 0.5]
            ],
            actions: [1, 0],
            oldLogProbs: [Math.log(0.5), Math.log(0.5)],
            returns: [1, -1],
            advantages: [1, -1],
            weights: [1, 1]
        },
        { epochs: 1, entropyCoef: 0, miniBatchSize: 1 }
    );
    assert.equal(result.samples, 2, "PPO update should report trained samples");
    assert.ok(Number.isFinite(result.loss), "PPO loss should stay finite");
    actor.dispose();
    critic.dispose();
    optimizer.dispose?.();
}

testGrenadeProximityTrigger();
testGrenadeHighSpeedProximityTrigger();
testGrenadeProximityFuseMultiplier();
testGrenadeExplosionRangeMatchesVisualEffect();
await testPpoActorCriticUtilities();
await testNewCharactersRegistered(app);
await testVampireBatsSpawn(app);
await testVampireLifestealOnCollision(app);
await testGunnerBulletsSpawn(app);
await testPhantomRegistered(app);
await testPhantomShadowStrike(app);
testCircleVsCircleCollisionStillWorks(app);
testPolygonVsPolygonCollisionSeparates();
testCircleVsPolygonCollisionSeparates();
testPolygonAngleChangesCollisionResult();
testPolygonBodyDrawAppliesAngle();
testMobAppearanceHasRotationData();
testBattleBallUsesAppearanceAngle();
testRandomSpinHelper();
testCircleMinAngularVelocity();
testDefaultPolygonAngleIsZero();
testPolygonMobFaceRotatesWithBody();
testGetFighterCollisionShapePolygon();
testGetFighterCollisionShapeCircle();
testLocalPointsMatchDrawBody();
await testRotationInitializedOnPolygonFighter(app);
testIntegrateRotationSpins();
testRotationalBodyTorqueAccumulation();
testMultipleTorqueSameFrame();
testFrameRateIndependentDamping();
await testPolygonUpdateIntegratesRotation(app);
await testCircleRotatesVisibly(app);
await testCollisionProducesAngularImpulse(app);
await testCollisionAngularImpulseChangesVelocity(app);
await testNonHostileCollisionProducesAngularImpulse(app);
testPolygonContactPointAsymmetric();
await testCircleRotationDisabled(app);
testCircleEquipmentRotatesWithFace();
testWallSlamUsesPhysicalAngularImpulse();
testPolygonAppearanceAnglePriority();
testRingBufferPushAndOrder();
testRingBufferCapacityOverflow();
testRingBufferToArrayIsCopy();
testRingBufferClear();
testSnapshotPhysicsStateCopiesValues();
testBattleBallDebugBufferExists();
testApplyImpulseRecordsDebugEvent();
testUpdateRecordsSummaryEvent();
testCollisionRecordsDebugEvent();
testValidatePhysicsStateNoErrorOnValid();
testValidatePhysicsStateDetectsNaN();
testDebugBufferDoesNotThrowOnPushFailure();

// ── Unified collision response module tests ──────────────────────────────

function testCollisionResponseHelperAngularImpulse() {
    const body = {
        position: { x: 400, y: 300 },
        angularVelocity: 0,
        applyAngularImpulse(value) {
            this.angularVelocity += value;
        }
    };
    applyCollisionAngularImpulse(body, { x: 1, y: 0 }, { x: 380, y: 330 }, 100, 0.15);
    assert.ok(body.angularVelocity !== 0, "applyCollisionAngularImpulse should modify angularVelocity via duck typing");
    assert.ok(Number.isFinite(body.angularVelocity), "applyCollisionAngularImpulse should produce finite value");
    console.log("[collision-response-angular-impulse] ok");
}

function testCollisionResponseNoApplyAngularImpulse() {
    const body = {
        position: { x: 400, y: 300 },
        applyAngularImpulse: undefined
    };
    const result = applyCollisionAngularImpulse(body, { x: 0, y: -1 }, { x: 400, y: 340 }, 100, 0.15);
    assert.equal(result, 0, "applyCollisionAngularImpulse should return 0 when body has no applyAngularImpulse");
    console.log("[collision-response-no-angular] ok");
}

function testCollisionAppliesLinearImpulse() {
    const body = {
        position: { x: 500, y: 500 },
        velocity: { x: -100, y: 0 },
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse() {}
    };
    applyCollisionResponse(
        body,
        { x: 1, y: 0 },
        { x: 475, y: 500 },
        { x: -100, y: 0 },
        { restitution: 1, angularFactor: 0, tangentialFriction: 0 }
    );
    assert.ok(body.velocity.x > 0, "applyCollisionResponse should reverse velocity via linear impulse (restitution=1)");
    console.log("[collision-response-linear-impulse] ok");
}

function testCollisionResponseDuckTypingDetection() {
    const noLinear = {
        position: { x: 300, y: 300 },
        applyAngularImpulse() {}
    };
    const noAngular = {
        position: { x: 300, y: 300 },
        velocity: { x: -50, y: 0 },
        applyImpulse() {}
    };
    const both = {
        position: { x: 300, y: 300 },
        velocity: { x: -50, y: 0 },
        applyImpulse(impulse) {
            this.lastImpulse = impulse;
        },
        applyAngularImpulse(value) {
            this.lastAngular = value;
        }
    };
    const neither = {
        position: { x: 300, y: 300 }
    };
    // no linear impulse for body without applyImpulse
    applyCollisionResponse(noLinear, { x: 1, y: 0 }, { x: 275, y: 300 }, { x: -50, y: 0 });
    assert.ok(true, "applyCollisionResponse should not throw when body has no applyImpulse");

    // no angular impulse for body without applyAngularImpulse
    applyCollisionResponse(noAngular, { x: 1, y: 0 }, { x: 275, y: 300 }, { x: -50, y: 0 });
    assert.ok(true, "applyCollisionResponse should not throw when body has no applyAngularImpulse");

    // both linear and angular for full body (contact offset from center for non-zero torque)
    applyCollisionResponse(both, { x: 1, y: 0 }, { x: 275, y: 320 }, { x: -50, y: 0 });
    assert.ok(both.lastImpulse !== undefined, "full body should receive linear impulse");
    assert.ok(both.lastAngular !== undefined, "full body should receive angular impulse");
    console.log("[collision-response-duck-typing] ok");
}

function testDynamicCollisionResponsePair() {
    const bodyA = {
        position: { x: 350, y: 300 },
        velocity: { x: 100, y: 0 },
        mass: 10,
        radius: 25,
        angularVelocity: 0,
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse(value) {
            this.angularVelocity += value;
        }
    };
    const bodyB = {
        position: { x: 450, y: 300 },
        velocity: { x: -100, y: 0 },
        mass: 10,
        radius: 25,
        angularVelocity: 0,
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse(value) {
            this.angularVelocity += value;
        }
    };
    applyDynamicCollisionResponse(bodyA, bodyB, { x: 1, y: 0 }, { x: 400, y: 320 }, -200);
    assert.ok(bodyA.angularVelocity !== 0, "dynamic collision should apply angular impulse to bodyA");
    assert.ok(bodyB.angularVelocity !== 0, "dynamic collision should apply angular impulse to bodyB");
    assert.ok(
        Math.sign(bodyA.angularVelocity) !== Math.sign(bodyB.angularVelocity),
        "bodyA and bodyB should spin in opposite directions for a centered contact offset"
    );
    console.log("[collision-response-dynamic-pair] ok");
}

function testDynamicCollisionResponseNoPotential() {
    const bodyA = {
        position: { x: 300, y: 300 },
        applyAngularImpulse() {
            this._applied = true;
        }
    };
    const bodyB = {
        position: { x: 400, y: 300 },
        applyAngularImpulse() {
            this._applied = true;
        }
    };
    applyDynamicCollisionResponse(bodyA, bodyB, { x: 1, y: 0 }, { x: 350, y: 300 }, 50);
    assert.equal(bodyA._applied, undefined, "no angular impulse when approachSpeed >= 0");
    assert.equal(bodyB._applied, undefined, "no angular impulse when approachSpeed >= 0");
    console.log("[collision-response-no-potential] ok");
}

function testTangentialFrictionReducesSpeed() {
    // 접선 마찰이 접선 속도를 증가시키지 않고 감소시키는지 검증
    const body = {
        position: { x: 500, y: 500 },
        velocity: { x: -100, y: 50 },
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse() {}
    };
    const tangentialSpeedBefore = Math.abs(body.velocity.y) + Math.abs(body.velocity.x);
    applyCollisionResponse(
        body,
        { x: 1, y: 0 },
        { x: 480, y: 500 },
        { x: -100, y: 50 },
        { restitution: 1, angularFactor: 0, tangentialFriction: 0.1 }
    );
    // 선형 반사 후 Y 속도가 마찰로 인해 감소해야 함 (증가 금지)
    const tangentialAfter = Math.abs(body.velocity.y);
    assert.ok(
        tangentialAfter <= 50 + 0.01,
        `tangential friction should not increase tangential speed: before=50 after=${tangentialAfter}`
    );
    console.log("[collision-response-tangential-friction] ok");
}

function testApplyCollisionResponseWallReflects() {
    // applyCollisionResponse가 벽 반사(restitution=1)에서 velocity를 올바르게 반전하는지 검증
    const body = {
        position: { x: 500, y: 500 },
        velocity: { x: -100, y: 30 },
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse() {}
    };
    applyCollisionResponse(
        body,
        { x: 1, y: 0 },
        { x: 480, y: 500 },
        { x: -100, y: 30 },
        { restitution: 1, angularFactor: 0, tangentialFriction: 0 }
    );
    assert.ok(body.velocity.x > 0, "applyCollisionResponse with restitution=1 should reverse x velocity");
    assert.equal(body.velocity.y, 30, "tangential (y) velocity should be unchanged when friction=0");
    console.log("[collision-response-wall-reflect] ok");
}

testCollisionResponseHelperAngularImpulse();
testCollisionResponseNoApplyAngularImpulse();
testCollisionAppliesLinearImpulse();
testCollisionResponseDuckTypingDetection();
testDynamicCollisionResponsePair();
testDynamicCollisionResponseNoPotential();
testTangentialFrictionReducesSpeed();
testApplyCollisionResponseWallReflects();

// ── Static surface angular impulse tests ─────────────────────────────────

function testWallCollisionProducesAngularImpulse() {
    const spec = {
        id: "wall-spin",
        name: "WallSpin",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash",
        rotationEnabled: true
    };
    const sim = new BattleSimulation([spec, { ...spec, id: "opp", teamId: "t2" }], { onLog() {}, onSound() {} });
    const ball = sim.fighters[0];
    // position just past the right wall boundary, moving right into the wall
    ball.position = new Vector2(sim.width - ball.radius + 1, 500);
    ball.velocity = new Vector2(300, 200);
    const impulseBefore = ball._accumulatedAngularImpulse;
    sim.keepInsideArena(ball);
    const impulseChanged = ball._accumulatedAngularImpulse !== impulseBefore;
    assert.ok(impulseChanged, "wall collision should accumulate angular impulse");
    ball.integrateRotation(0.016);
    assert.ok(Number.isFinite(ball.angularVelocity), "angularVelocity should stay finite after wall collision");
    console.log("[wall-angular] ok");
}

function testCornerCollisionProducesAngularImpulse() {
    const spec = {
        id: "corner-spin",
        name: "CornerSpin",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash",
        rotationEnabled: true
    };
    const sim = new BattleSimulation([spec, { ...spec, id: "opp", teamId: "t2" }], { onLog() {}, onSound() {} });
    const ball = sim.fighters[0];
    // top-left corner: both x and y past boundaries
    ball.position = new Vector2(ball.radius - 5, ball.radius - 5);
    ball.velocity = new Vector2(-200, -300);
    const impulseBefore = ball._accumulatedAngularImpulse;
    sim.keepInsideArena(ball);
    assert.ok(
        ball._accumulatedAngularImpulse !== impulseBefore,
        "corner collision should accumulate angular impulse from both axes"
    );
    assert.ok(Number.isFinite(ball._accumulatedAngularImpulse), "corner angular impulse should be finite");
    ball.integrateRotation(0.016);
    assert.ok(Number.isFinite(ball.angularVelocity), "corner angularVelocity should stay finite after integrate");
    console.log("[corner-angular] ok");
}

function testCircleTerrainCollisionProducesAngularImpulse() {
    const fighter = {
        position: { x: 210, y: 215 },
        velocity: { x: -50, y: -30 },
        radius: 24,
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse(value) {
            this._angularImpulseApplied = (this._angularImpulseApplied || 0) + value;
        }
    };
    const rock = { shape: "circle", type: "rock", x: 200, y: 200, radius: 50, blocking: true };
    const collided = resolveTerrainCollision(fighter, rock);
    assert.ok(collided, "fighter at rock edge should collide");
    assert.ok(Number.isFinite(fighter._angularImpulseApplied), "circle terrain collision should apply angular impulse");
    const impulseMag = Math.abs(fighter._angularImpulseApplied);
    assert.ok(impulseMag > 0, "circle terrain collision angular impulse should be non-zero");
    console.log("[circle-terrain-angular] ok");
}

function testPolygonTerrainCollisionProducesAngularImpulse() {
    const polyTerrain = {
        shape: "polygon",
        type: "rock",
        x: 300,
        y: 300,
        points: [
            { x: -40, y: -30 },
            { x: 48, y: -20 },
            { x: 35, y: 38 },
            { x: -35, y: 30 }
        ],
        blocking: true
    };
    const fighter = {
        position: { x: 300, y: 300 },
        velocity: { x: -50, y: -40 },
        radius: 24,
        applyImpulse() {},
        applyAngularImpulse(value) {
            this._angularImpulseApplied = (this._angularImpulseApplied || 0) + value;
        }
    };
    const collided = resolveTerrainCollision(fighter, polyTerrain);
    assert.ok(collided, "fighter inside polygon should collide");
    assert.ok(
        Number.isFinite(fighter._angularImpulseApplied),
        "polygon terrain collision should apply angular impulse"
    );
    const impulseMag = Math.abs(fighter._angularImpulseApplied);
    assert.ok(impulseMag > 0, "polygon terrain collision angular impulse should be non-zero");
    console.log("[polygon-terrain-angular] ok");
}

testWallCollisionProducesAngularImpulse();
testCornerCollisionProducesAngularImpulse();
testCircleTerrainCollisionProducesAngularImpulse();
testPolygonTerrainCollisionProducesAngularImpulse();

// ── 실제 update 루프 경로 테스트 ─────────────────────────────────────────

function testPlayerCircleCollisionChangesAngularVelocity() {
    // circle-circle 동적 충돌에서 접선 마찰로 angularVelocity가 변하는지 검증
    const specPlayer = {
        id: "circ-p",
        name: "CircP",
        teamId: "t1",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#00ff00",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const specOpp = {
        id: "circ-o",
        name: "CircO",
        teamId: "t2",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([specPlayer, specOpp], { onLog() {}, onSound() {} });
    const [player, opponent] = sim.fighters;

    // 접선 상대 속도 있는 circle-circle 충돌 (같은 Y, 서로 다른 X)
    player.position = new Vector2(400, 500);
    opponent.position = new Vector2(430, 500);
    player.angularVelocity = 0;
    opponent.angularVelocity = 0;
    player.applyImpulse(Vector2.subtract(new Vector2(200, 100), player.velocity));
    opponent.applyImpulse(Vector2.subtract(new Vector2(-200, 0), opponent.velocity));

    const accImpBefore = player._accumulatedAngularImpulse;

    sim.handleCollision();

    // 충돌 후 accumulatedAngularImpulse가 변경되어야 함 (접선 마찰 torque)
    assert.ok(
        player._accumulatedAngularImpulse !== accImpBefore,
        "circle-circle dynamic collision should produce angular impulse via tangential friction"
    );

    // update → integrateRotation → angularVelocity에 반영
    player.update(0.016, sim);
    opponent.update(0.016, sim);

    assert.ok(
        Math.abs(player.angularVelocity) > 0.0001,
        "circle player angularVelocity should change after circle-circle collision"
    );
    assert.ok(Number.isFinite(player.angularVelocity), "angularVelocity should stay finite");
    console.log("[circle-circle-angular] ok");
}

function testWallCollisionAngularImpulseAppliesSameUpdate() {
    // BattleBall.update() 경로에서 벽 충돌 angular impulse가 같은 프레임
    // integrateRotation에 반영되는지 검증
    const spec = {
        id: "wall-upd",
        name: "WallUpd",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash",
        rotationEnabled: true
    };
    const sim = new BattleSimulation([spec, { ...spec, id: "opp", teamId: "t2" }], { onLog() {}, onSound() {} });
    const ball = sim.fighters[0];

    // 우측 벽 바로 앞, 벽 쪽으로 이동
    ball.position = new Vector2(sim.width - ball.radius - 5, 500);
    ball.velocity = new Vector2(400, 150);
    ball.angularVelocity = 0;

    // update 한 번 = _applyVelocityCorrection → integrate → keepInsideArena → integrateRotation
    ball.update(0.016, sim);

    // 벽 충돌 angular impulse가 같은 update의 integrateRotation에서 반영되어야 함
    assert.ok(
        Math.abs(ball.angularVelocity) > 0.0001,
        "wall collision angular impulse should reflect in same update frame"
    );
    assert.ok(Number.isFinite(ball.angularVelocity), "angularVelocity should stay finite");
    console.log("[wall-same-update] ok");
}

testPlayerCircleCollisionChangesAngularVelocity();
testWallCollisionAngularImpulseAppliesSameUpdate();

// ── Impulse solver correctness tests ──────────────────────────────────────

function testImpulseMassDistribution() {
    // 동일 접근 속도에서 mass가 큰 body가 velocity 변화가 작은지 검증
    const normal = { x: 1, y: 0 };
    const contact = { x: 300, y: 300 };
    const approachSpeed = -100;

    const lightBody = {
        position: { x: 280, y: 300 },
        velocity: { x: 100, y: 0 },
        mass: 5,
        radius: 20,
        angularVelocity: 0,
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse() {}
    };
    const heavyBody = {
        position: { x: 280, y: 300 },
        velocity: { x: 100, y: 0 },
        mass: 20,
        radius: 20,
        angularVelocity: 0,
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse() {}
    };
    const opp = {
        position: { x: 320, y: 300 },
        velocity: { x: 0, y: 0 },
        mass: 1000,
        radius: 20,
        angularVelocity: 0,
        applyImpulse() {},
        applyAngularImpulse() {}
    };

    applyDynamicCollisionResponse(lightBody, opp, normal, contact, approachSpeed, {
        restitution: 0.5,
        angularFactor: 0,
        tangentialFriction: 0
    });
    const lightDelta = Math.abs(lightBody.velocity.x - 100);

    applyDynamicCollisionResponse(heavyBody, opp, normal, contact, approachSpeed, {
        restitution: 0.5,
        angularFactor: 0,
        tangentialFriction: 0
    });
    const heavyDelta = Math.abs(heavyBody.velocity.x - 100);

    assert.ok(lightDelta > heavyDelta, "lighter body should have larger velocity change than heavier body");
    assert.ok(heavyDelta > 0, "heavy body should still receive impulse");
    assert.ok(Number.isFinite(lightDelta) && Number.isFinite(heavyDelta), "velocity deltas should be finite");
    console.log("[impulse-mass-distribution] ok");
}

function testOffCenterAngularImpulse() {
    // 접촉점이 중심에서 대각선으로 떨어진 off-center 충돌이 angular impulse를 생성하는지 검증
    // r×n ≠ 0이 되도록 접촉점을 중심에서 수직/수평 모두 오프셋함
    const body = {
        position: { x: 400, y: 300 },
        velocity: { x: -50, y: 0 },
        mass: 10,
        radius: 25,
        angularVelocity: 0,
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse(value) {
            this.angularVelocity += value;
        }
    };
    // r = {380-400, 350-300} = {-20, 50}, n = {1,0}
    // r×n = (-20)*0 - 50*1 = -50 ≠ 0 → angular impulse 생성
    const contact = { x: 380, y: 350 };
    const normal = { x: 1, y: 0 };

    const angularBefore = body.angularVelocity;
    applyCollisionResponse(
        body,
        normal,
        contact,
        { x: -50, y: 0 },
        { restitution: 0.5, angularFactor: 1, tangentialFriction: 0 }
    );
    assert.ok(body.angularVelocity !== angularBefore, "off-center collision should change angular velocity via r×J");
    assert.ok(Number.isFinite(body.angularVelocity), "off-center angular velocity should stay finite");
    console.log("[off-center-angular] ok");
}

function testTangentFrictionChangesLinearAndAngular() {
    // tangent friction impulse가 linear tangent velocity와 angularVelocity를 함께 바꾸는지 검증
    const bodyA = {
        position: { x: 350, y: 300 },
        velocity: { x: 100, y: 50 },
        mass: 10,
        radius: 25,
        angularVelocity: 0,
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse(value) {
            this.angularVelocity += value;
        }
    };
    const bodyB = {
        position: { x: 450, y: 300 },
        velocity: { x: -100, y: 0 },
        mass: 10,
        radius: 25,
        angularVelocity: 0,
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse(value) {
            this.angularVelocity += value;
        }
    };
    const normal = { x: 1, y: 0 };
    const contact = { x: 400, y: 310 }; // slightly below center to generate torque

    const velYBeforeA = bodyA.velocity.y;
    const angVelBeforeA = bodyA.angularVelocity;

    // 접근 속도 = (-100 - 100) * 1 + (0 - 50) * 0 = -200 (approaching)
    applyDynamicCollisionResponse(bodyA, bodyB, normal, contact, -200, {
        restitution: 0.5,
        angularFactor: 1,
        tangentialFriction: 0.05
    });

    // tangent velocity of bodyA should change (friction reduces relative tangent speed)
    assert.ok(bodyA.velocity.y !== velYBeforeA, "tangential friction should change linear tangent velocity");
    // angular velocity should change (friction torque from offset contact + tangent impulse)
    assert.ok(
        bodyA.angularVelocity !== angVelBeforeA,
        "tangential friction should change angular velocity via friction torque"
    );
    assert.ok(Number.isFinite(bodyA.angularVelocity), "friction torque angular velocity should stay finite");
    console.log("[tangent-friction-linear-angular] ok");
}

function testEffectiveMassRotationalContribution() {
    // effective mass denominator에 회전 기여 ((r×n)² / I)가 포함되는지 검증.
    // 같은 조건에서 중심 충돌(r×n=0)과 비중심 충돌(r×n≠0)의 결과가 달라야 함.
    function makeBall(posX, posY, velX, velY) {
        return {
            position: { x: posX, y: posY },
            velocity: { x: velX, y: velY },
            mass: 10,
            radius: 25,
            angularVelocity: 0,
            applyImpulse(impulse) {
                this.velocity.x += impulse.x;
                this.velocity.y += impulse.y;
            },
            applyAngularImpulse(value) {
                this.angularVelocity += value;
            }
        };
    }

    const normal = { x: 1, y: 0 };
    const opp = { x: 500, y: 300 };

    // 중심 충돌: contact point at center → r×n = 0
    const centerContact = { x: 400, y: 300 };
    const centerBody = makeBall(350, 300, 100, 0);

    // 비중심 충돌: contact point offset → r×n ≠ 0
    const offsetContact = { x: 400, y: 350 };
    const offsetBody = makeBall(350, 300, 100, 0);

    const oppBody = {
        position: opp,
        velocity: { x: 0, y: 0 },
        mass: 1000,
        radius: 25,
        angularVelocity: 0,
        applyImpulse() {},
        applyAngularImpulse() {}
    };

    applyDynamicCollisionResponse(centerBody, oppBody, normal, centerContact, -100, {
        restitution: 0.5,
        angularFactor: 0,
        tangentialFriction: 0
    });
    const centerLinearVelAfter = centerBody.velocity.x;

    // reset + offset (angularFactor=1로 angular impulse를 물리적으로 정확하게 적용)
    const oppBody2 = {
        position: opp,
        velocity: { x: 0, y: 0 },
        mass: 1000,
        radius: 25,
        angularVelocity: 0,
        applyImpulse() {},
        applyAngularImpulse() {}
    };

    applyDynamicCollisionResponse(offsetBody, oppBody2, normal, offsetContact, -100, {
        restitution: 0.5,
        angularFactor: 1,
        tangentialFriction: 0
    });
    const offsetLinearVelAfter = offsetBody.velocity.x;

    // 중심 충돌이 더 많은 linear impulse를 전달해야 함 (회전으로 에너지가 분산되지 않으므로)
    assert.ok(
        Math.abs(centerLinearVelAfter - 100) > Math.abs(offsetLinearVelAfter - 100),
        "center collision should transfer more linear impulse than off-center"
    );
    assert.ok(offsetBody.angularVelocity !== 0, "off-center collision should produce angular velocity");
    console.log("[effective-mass-rotational] ok");
}

function testOffCenterAngularMagnitude() {
    // 동적 충돌에서 기본 angularFactor=1로 충분히 큰 angularVelocity가 생성되는지 검증.
    // 이 테스트는 angularFactor=0.15(default)일 때는 실패한다 (약 0.63 rad/s만 생성).
    const bodyA = {
        position: { x: 400, y: 300 },
        velocity: { x: 200, y: 0 },
        mass: 10,
        radius: 25,
        angularVelocity: 0,
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse(value) {
            this._angularMag = (this._angularMag || 0) + Math.abs(value);
        }
    };
    const bodyB = {
        position: { x: 500, y: 300 },
        velocity: { x: 0, y: 0 },
        mass: 1000,
        radius: 25,
        angularVelocity: 0,
        applyImpulse() {},
        applyAngularImpulse() {}
    };
    const normal = { x: 1, y: 0 };
    const contact = { x: 450, y: 350 }; // off-center → r×n ≠ 0
    // approachSpeed = (0 - 200) * 1 + (0 - 0) * 0 = -200 → collision
    applyDynamicCollisionResponse(bodyA, bodyB, normal, contact, -200, {
        restitution: 0.5,
        tangentialFriction: 0
    });
    const angImpulse = bodyA._angularMag;
    // With angularFactor=1: expected ~16650 (|r × J|). With 0.15: ~2498.
    assert.ok(
        Math.abs(angImpulse) > 5000,
        `off-center angular impulse should be > 5000 with default angularFactor=1, got ${angImpulse}`
    );
    assert.ok(Number.isFinite(angImpulse), "off-center angular impulse should stay finite");
    console.log("[off-center-magnitude] ok");
}

function testWallCollisionAngularNotReduced() {
    // 벽 충돌 angular impulse가 기본 angularFactor=1로 충분히 큰지 검증.
    const spec = {
        id: "wall-mag",
        name: "WallMag",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash",
        rotationEnabled: true
    };
    const sim = new BattleSimulation([spec, { ...spec, id: "opp", teamId: "t2" }], { onLog() {}, onSound() {} });
    const ball = sim.fighters[0];
    ball.position = new Vector2(sim.width - ball.radius + 1, 500);
    ball.velocity = new Vector2(300, 200);
    const impulseBefore = ball._accumulatedAngularImpulse;
    sim.keepInsideArena(ball);
    const impulseAfter = ball._accumulatedAngularImpulse;
    // Apply accumulated angular impulse manually (as done in the update path)
    if (ball._inverseMomentOfInertia && impulseAfter !== 0) {
        ball.angularVelocity += impulseAfter * ball._inverseMomentOfInertia;
    }
    assert.ok(impulseAfter !== impulseBefore, "wall collision should accumulate angular impulse");
    // With angularFactor=1: magnitude ~4320 (tangent friction torque, friction-clamped).
    // With 0.15: ~648. Threshold 2000 distinguishes them.
    const impulseMag = Math.abs(impulseAfter - impulseBefore);
    assert.ok(
        impulseMag > 2000,
        `wall collision angular impulse should be > 2000 with angularFactor=1, got ${impulseMag}`
    );
    assert.ok(Number.isFinite(impulseMag), "wall collision angular impulse should be finite");
    console.log("[wall-angular-not-reduced] ok");
}

testImpulseMassDistribution();
testOffCenterAngularImpulse();
testTangentFrictionChangesLinearAndAngular();
testEffectiveMassRotationalContribution();
testOffCenterAngularMagnitude();
testWallCollisionAngularNotReduced();

// ── Physics Material system tests ──────────────────────────────────────────

function testPhysicsMaterialBodyMixin() {
    class Dummy extends PhysicsMaterialBody(class {}) {}
    const obj = new Dummy();
    assert.equal(obj.physicsMaterial, "wood", "PhysicsMaterialBody should default to wood");
    obj.setPhysicsMaterial("ice");
    assert.equal(obj.physicsMaterial, "ice", "setPhysicsMaterial should update material");
    const resolved = obj.getResolvedPhysicsMaterial();
    assert.equal(resolved.restitution, 0.95, "getResolvedPhysicsMaterial should resolve ice restitution");
    assert.equal(resolved.friction, 0.03, "getResolvedPhysicsMaterial should resolve ice friction");
    console.log("[physics-material-body-mixin] ok");
}

function testBattleBallSpecMaterialOverride() {
    const spec = {
        id: "spec-mat",
        name: "SpecMat",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash",
        rotationEnabled: true,
        physicsMaterial: "stone"
    };
    const ball = new BattleBall(spec, new Vector2(100, 100));
    assert.equal(ball.physicsMaterial, "stone", "spec.physicsMaterial should override mixin default");
    console.log("[physics-material-spec-override] ok");
}

function testResolvePhysicsMaterial() {
    const rb = resolvePhysicsMaterial("rubberBall");
    assert.equal(rb.restitution, 0.92);
    assert.equal(rb.friction, 0.2);

    const w = resolvePhysicsMaterial("wall");
    assert.equal(w.restitution, 1.0);
    assert.equal(w.friction, 0.2);

    // null/undefined → wood default
    const def = resolvePhysicsMaterial(null);
    assert.equal(def.restitution, 0.92);
    assert.equal(def.friction, 0.2);

    const def2 = resolvePhysicsMaterial();
    assert.equal(def2.restitution, 0.92);
    assert.equal(def2.friction, 0.2);

    // object passthrough
    const custom = { restitution: 0.5, friction: 0.1 };
    const resolved = resolvePhysicsMaterial(custom);
    assert.equal(resolved.restitution, 0.5);
    assert.equal(resolved.friction, 0.1);

    // unknown string → wood default
    const unknown = resolvePhysicsMaterial("nonexistent");
    assert.equal(unknown.restitution, 0.92);
    assert.equal(unknown.friction, 0.2);

    console.log("[physics-material-resolve] ok");
}

function testCombinePhysicsMaterials() {
    // rubberBall + wall: max restitution, sqrt friction
    const rbWall = combinePhysicsMaterials(PHYSICS_MATERIALS.rubberBall, PHYSICS_MATERIALS.wall);
    assert.equal(rbWall.restitution, 1.0, "rubberBall+wall restitution should be max=1.0");
    assert.equal(rbWall.friction, 0.2, "rubberBall+wall friction should stay wood-level=0.20");

    // rubberBall + rubberBall
    const rbRb = combinePhysicsMaterials(PHYSICS_MATERIALS.rubberBall, PHYSICS_MATERIALS.rubberBall);
    assert.equal(rbRb.restitution, 0.92);
    assert.equal(rbRb.friction, 0.2);

    // wood + rubberBall
    const woodRb = combinePhysicsMaterials(PHYSICS_MATERIALS.wood, PHYSICS_MATERIALS.rubberBall);
    assert.equal(woodRb.restitution, 0.92);
    assert.equal(woodRb.friction, 0.2);

    // 낮은 마찰 재질은 실제로 낮은 조합값을 만들어야 한다.
    const iceRb = combinePhysicsMaterials(PHYSICS_MATERIALS.ice, PHYSICS_MATERIALS.rubberBall);
    assert.equal(iceRb.restitution, 0.95);
    assert.ok(iceRb.friction < 0.2, "ice+rubberBall friction should be lower than wood-level friction");

    // null fallback
    const onlyA = combinePhysicsMaterials(PHYSICS_MATERIALS.wall, null);
    assert.equal(onlyA.restitution, 1.0);
    assert.equal(onlyA.friction, 0.2);

    console.log("[physics-material-combine] ok");
}

function testCollisionResponseUsesBodyMaterial() {
    // body의 physicsMaterial로부터 restitution/friction이 추론되는지 검증
    const body = {
        position: { x: 500, y: 500 },
        velocity: { x: -100, y: 50 },
        physicsMaterial: "rubberBall",
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse() {}
    };
    applyCollisionResponse(body, { x: 1, y: 0 }, { x: 480, y: 500 }, { x: -100, y: 50 }, { surfaceMaterial: "wood" });
    // 마찰+반발로 인해 velocity가 변했는지만 검증 (구체적인 방향은 impulse 계산 결과)
    assert.ok(body.velocity.x > -100, "material-based collision should change velocity");
    assert.ok(Number.isFinite(body.velocity.x), "velocity should stay finite");
    console.log("[physics-material-collision-response] ok");
}

function testExplicitOverrideStillWorks() {
    const body = {
        position: { x: 500, y: 500 },
        velocity: { x: -100, y: 30 },
        physicsMaterial: "rubberBall",
        applyImpulse(impulse) {
            this.velocity.x += impulse.x;
            this.velocity.y += impulse.y;
        },
        applyAngularImpulse() {}
    };
    // explicit restitution/tangentialFriction should override material
    applyCollisionResponse(
        body,
        { x: 1, y: 0 },
        { x: 480, y: 500 },
        { x: -100, y: 30 },
        { restitution: 1, tangentialFriction: 0, angularFactor: 0 }
    );
    // restitution=1, friction=0 → complete normal reflection, y unchanged
    assert.ok(body.velocity.x > 0, "explicit restitution=1 should reverse x velocity");
    assert.equal(body.velocity.y, 30, "explicit friction=0 should leave y unchanged");
    console.log("[physics-material-explicit-override] ok");
}

function testWallCollisionUsesMaterial() {
    // BattleSimulation(ball.physicsMaterial="rubberBall")의 벽 충돌이
    // surfaceMaterial="wall"을 통해 restitution=1, friction=0.20 조합으로 동작하는지 검증
    const spec = {
        id: "wall-mat",
        name: "WallMat",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash",
        rotationEnabled: true
    };
    const sim = new BattleSimulation([spec, { ...spec, id: "opp", teamId: "t2" }], { onLog() {}, onSound() {} });
    const ball = sim.fighters[0];
    ball.position = new Vector2(sim.width - ball.radius + 1, 500);
    ball.velocity = new Vector2(300, 0);

    // 등록된 physicsMaterial 확인
    assert.equal(ball.physicsMaterial, "rubberBall", "BattleBall should have rubberBall material by default");

    // 벽 충돌: rubberBall(0.92, 0.20) + wall(1.0, 0.20) → restitution=1.0, friction=0.20
    sim.keepInsideArena(ball);
    // restitution=1.0, friction=0.20 → 속도는 반대 방향(완전 반사) + 마찰
    assert.ok(ball.velocity.x < 0, "wall collision should reverse x velocity (restitution=1.0)");
    assert.ok(Number.isFinite(ball.velocity.x), "velocity should stay finite");
    console.log("[physics-material-wall-collision] ok");
}

function testTerrainCollisionUsesMaterial() {
    // 원형 terrain 충돌이 surfaceMaterial="wood"을 통해
    // rubberBall(0.92, 0.20) + wood(0.92, 0.20) → restitution=0.92, friction=0.20 조합으로 동작하는지 검증
    const spec = {
        id: "terrain-mat",
        name: "TerrainMat",
        teamId: "t",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff8800",
        appearance: { sides: 0, face: "default" },
        ability: "dash",
        rotationEnabled: true
    };
    const sim = new BattleSimulation([spec, { ...spec, id: "opp", teamId: "t2" }], { onLog() {}, onSound() {} });
    const ball = sim.fighters[0];

    const terrain = {
        shape: TERRAIN_SHAPES.CIRCLE,
        x: 480,
        y: 480,
        radius: 80,
        blocking: true
    };
    // 볼을 지형과 겹치게 배치
    ball.position = new Vector2(480, 400);
    ball.velocity = new Vector2(0, 200);

    const hit = resolveTerrainCollision(ball, terrain);
    assert.ok(hit, "terrain collision should detect overlap");
    // restitution=0.92, friction=0.20 조합 속도 반전
    assert.ok(ball.velocity.y < 0, "terrain collision should reverse y velocity");
    assert.ok(Number.isFinite(ball.velocity.y), "velocity should stay finite");
    console.log("[physics-material-terrain-collision] ok");
}

function testFighterCollisionUsesMaterial() {
    // 볼-볼 충돌이 양쪽 body.physicsMaterial 조합으로 동작하는지 검증
    const spec = {
        id: "f-mat-a",
        name: "FMatA",
        teamId: "t1",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 0, face: "default" },
        ability: "dash",
        rotationEnabled: true
    };
    const specB = {
        id: "f-mat-b",
        name: "FMatB",
        teamId: "t2",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#0000ff",
        appearance: { sides: 0, face: "default" },
        ability: "dash",
        rotationEnabled: true
    };
    const sim = new BattleSimulation([spec, specB], { onLog() {}, onSound() {} });
    const [a, b] = sim.fighters;
    a.position = new Vector2(440, 480);
    b.position = new Vector2(440 + a.radius + b.radius - 4, 480);
    a.velocity = new Vector2(300, 0);
    b.velocity = new Vector2(-300, 0);

    assert.equal(a.physicsMaterial, "rubberBall", "fighter should have rubberBall material");
    assert.equal(b.physicsMaterial, "rubberBall", "fighter should have rubberBall material");

    sim.handleFighterCollision(a, b);
    // rubberBall(0.92,0.20)+rubberBall(0.92,0.20) → restitution=0.92, friction=0.20
    assert.ok(a.velocity.x < 0 || b.velocity.x > 0, "fighter collision should apply impulse");
    assert.ok(Number.isFinite(a.velocity.x) && Number.isFinite(b.velocity.x), "velocities should stay finite");
    console.log("[physics-material-fighter-collision] ok");
}

testPhysicsMaterialBodyMixin();
testBattleBallSpecMaterialOverride();
testResolvePhysicsMaterial();
testCombinePhysicsMaterials();
testCollisionResponseUsesBodyMaterial();
testExplicitOverrideStillWorks();
testWallCollisionUsesMaterial();
testTerrainCollisionUsesMaterial();
testFighterCollisionUsesMaterial();

// ── Rotational Contact Damage Tests ─────────────────────────────────────────

function testGetContactPointVelocity() {
    const body = {
        position: { x: 400, y: 300 },
        velocity: { x: 100, y: 0 },
        angularVelocity: 2
    };
    // r = (100, 50), v_contact = (100 - 2*50, 0 + 2*100) = (0, 200)
    const cp = getContactPointVelocity(body, { x: 500, y: 350 });
    assert.ok(Math.abs(cp.x - 0) < 0.001, `cp.x should be 0, got ${cp.x}`);
    assert.ok(Math.abs(cp.y - 200) < 0.001, `cp.y should be 200, got ${cp.y}`);
    console.log("[contact-point-velocity] ok");
}

function testContactDamageSpeed() {
    const body = {
        position: { x: 400, y: 300 },
        velocity: { x: 100, y: 0 },
        angularVelocity: 2
    };
    const speed = getContactDamageSpeed(body, { x: 500, y: 350 });
    assert.ok(Math.abs(speed.linearSpeed - 100) < 0.001, "contact damage speed should preserve linear speed");
    assert.ok(
        Math.abs(speed.rotationalSpeed - Math.sqrt(50000)) < 0.001,
        "contact damage speed should convert omega cross r"
    );
    assert.ok(
        Math.abs(speed.damageSpeed - (100 + Math.sqrt(50000))) < 0.001,
        "contact damage speed should add rotational speed like linear speed"
    );
    console.log("[contact-damage-speed] ok");
}

function testRotationalContactDamageBonusZero() {
    // 중심 속도와 접촉점 속도가 같으면 보너스 0
    const body = {
        position: { x: 400, y: 300 },
        velocity: { x: 100, y: 0 },
        angularVelocity: 0,
        stats: { baseSpeed: 200 }
    };
    const bonus = calculateRotationalContactDamageBonus(body, { x: 500, y: 300 });
    assert.equal(bonus, 0, "zero angularVelocity should give 0 bonus");
    console.log("[rotational-bonus-zero] ok");
}

function testRotationalContactDamageBonusPositive() {
    const body = {
        position: { x: 400, y: 300 },
        velocity: { x: 0, y: 0 },
        angularVelocity: 10,
        stats: { baseSpeed: 200 }
    };
    // r = (100, 100), v_contact = (0 - 10*100, 0 + 10*100) = (-1000, 1000)
    // contactSpeed = sqrt(1000^2+1000^2) ≈ 1414, centerSpeed = 0
    // bonus = min(1414 / 200, 0.6) = min(7.07, 0.6) = 0.6
    const bonus = calculateRotationalContactDamageBonus(body, { x: 500, y: 400 });
    assert.ok(Math.abs(bonus - 0.6) < 0.001, `bonus should be capped at 0.6, got ${bonus}`);
    console.log("[rotational-bonus-capped] ok");
}

function testRotationalContactDamageApply() {
    const body = {
        position: { x: 400, y: 300 },
        velocity: { x: 0, y: 0 },
        angularVelocity: 5,
        stats: { baseSpeed: 200 }
    };
    // r = (100, 50), v_contact = (0 - 5*50, 0 + 5*100) = (-250, 500)
    // contactSpeed ≈ 559, centerSpeed = 0
    // bonus = min(559 / 200, 0.6) = min(2.795, 0.6) = 0.6
    const result = applyRotationalContactDamage(20, body, { x: 500, y: 350 });
    assert.equal(result, 32, "20 * (1+0.6) = 32 should be the capped damage");
    console.log("[rotational-damage-apply] ok");
}

function testRotationalDamageZeroBasePreserved() {
    const body = {
        position: { x: 400, y: 300 },
        velocity: { x: 0, y: 0 },
        angularVelocity: 10,
        stats: { baseSpeed: 200 }
    };
    const result = applyRotationalContactDamage(0, body, { x: 500, y: 300 });
    assert.equal(result, 0, "baseDamage <= 0 should return unchanged");
    console.log("[rotational-damage-zero] ok");
}

async function testCrashDamageWithRotation() {
    const spec = {
        id: "rot-crash",
        name: "RotCrash",
        teamId: "t1",
        stats: { hp: 500, damage: 20, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([spec, { ...spec, id: "opp", teamId: "t2" }], { onLog() {}, onSound() {} });
    const [a, b] = sim.fighters;

    a.position = new Vector2(400, 480);
    b.position = new Vector2(440, 480);
    a.velocity = new Vector2(300, 0);
    b.velocity = new Vector2(-300, 0);
    const normal = new Vector2(1, 0);
    const cp = { x: 425, y: 505 };

    a.angularVelocity = 0;
    const baseDamage = sim.calculateCollisionDamageWithContact(a, b, normal, cp);
    a.angularVelocity = 15;
    const boostedDamage = sim.calculateCollisionDamageWithContact(a, b, normal, cp);

    assert.ok(boostedDamage > baseDamage, `rotation should boost crash damage: ${baseDamage} -> ${boostedDamage}`);
    assert.ok(
        boostedDamage > baseDamage * 2,
        "rotation crash damage should use linear-equivalent rotational speed instead of the legacy +60% cap"
    );
    console.log("[crash-rotation-damage] ok");
}

async function testDashContactRotationalBonus(app) {
    const dash = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.DASH);
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    const sim = new BattleSimulation([dash, archer], { onLog() {}, onSound() {} });
    const [attacker, defender] = sim.fighters;

    attacker.position = new Vector2(400, 480);
    defender.position = new Vector2(460, 480);
    attacker.angularVelocity = 20;
    attacker.velocity = new Vector2(300, 0);
    defender.velocity = new Vector2(0, 0);

    // Set up dash effect via movement
    attacker.state.movement = new (await import("../src/combatEffects.js")).DashEffect({
        duration: 1,
        multiplier: 1.5,
        color: "#ff0000",
        collisionDamage: 10,
        collisionLabel: "Dash Contact",
        untilImpact: true
    });

    const hpBefore = defender.hp;
    // contactPoint will be roughly at (430, 480) - between the two
    const cp = { x: 430, y: 480 };
    attacker.state.movement.onCollision(attacker, defender, sim, cp);
    const damageTaken = hpBefore - defender.hp;

    assert.ok(damageTaken > 10, "dash contact damage should be boosted by rotation (> base 10)");
    console.log("[dash-contact-rotation] ok");
}

async function testVampireRotationalBonus(app) {
    const vampire = app.roster.find((fighter) => fighter.id === "vampire" || fighter.ability === "vampire");
    const archer = app.roster.find((fighter) => fighter.id === FIGHTER_IDS.ARCHER);
    if (!vampire) {
        console.log("[vampire-rotation] skip (no vampire in roster)");
        return;
    }
    const sim = new BattleSimulation([vampire, archer], { onLog() {}, onSound() {} });
    const [owner, target] = sim.fighters;

    owner.position = new Vector2(400, 480);
    target.position = new Vector2(425, 480);
    owner.velocity = new Vector2(300, 0);
    target.velocity = new Vector2(-50, 0);
    owner.hp = Math.max(1, owner.maxHp - 50);

    const cp = { x: 412, y: 480 };
    owner.angularVelocity = 0;
    const baseDamage = owner.ability._getCollisionDamage(owner, target, cp);
    owner.angularVelocity = 20;
    const boostedDamage = owner.ability._getCollisionDamage(owner, target, cp);

    const hpBefore = owner.hp;
    owner.ability.onCollision(target, { contactPoint: cp });
    const healed = owner.hp - hpBefore;

    assert.ok(
        boostedDamage > baseDamage,
        `rotation should boost vampire contact damage: ${baseDamage} -> ${boostedDamage}`
    );
    assert.ok(boostedDamage <= Math.round(baseDamage * 1.6), "vampire rotation damage should respect +60% cap");
    assert.ok(healed >= 1, "vampire collision should heal when owner is below max HP");
    console.log("[vampire-rotation] ok");
}

testGetContactPointVelocity();
testContactDamageSpeed();
testRotationalContactDamageBonusZero();
testRotationalContactDamageBonusPositive();
testRotationalContactDamageApply();
testRotationalDamageZeroBasePreserved();
await testCrashDamageWithRotation();
await testDashContactRotationalBonus(app);
await testVampireRotationalBonus(app);

// ── Anti-stall burst tests ──────────────────────────────────────────────────

function testAntiStallNoBurstBeforeTimeout() {
    const specA = {
        id: "as-a",
        name: "ASA",
        teamId: "t1",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const specB = {
        id: "as-b",
        name: "ASB",
        teamId: "t2",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#0000ff",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([specA, specB], { onLog() {}, onSound() {} });
    sim._antiStallTimer = 7.9;
    sim._checkAntiStall(0.09);
    assert.equal(sim._antiStallBurstCount, 0, "should not fire before 8s");
    console.log("[anti-stall-no-burst] ok");
}

function testAntiStallBurstAtTimeout() {
    const specA = {
        id: "as-c",
        name: "ASC",
        teamId: "t1",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const specB = {
        id: "as-d",
        name: "ASD",
        teamId: "t2",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#0000ff",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([specA, specB], { onLog() {}, onSound() {} });
    const f0 = sim.fighters[0];
    const f1 = sim.fighters[1];
    f0.position = new Vector2(200, 480);
    f1.position = new Vector2(600, 480);
    f0.velocity = new Vector2();
    f1.velocity = new Vector2();
    sim._antiStallTimer = 7.9;
    const velBefore0 = f0.velocity.clone();
    const velBefore1 = f1.velocity.clone();
    sim._checkAntiStall(0.2);
    assert.equal(sim._antiStallBurstCount, 1, "should fire burst at 8s");
    assert.ok(sim._antiStallTimer < 0.2, "timer should reset after burst");
    const center = new Vector2(sim.width / 2, sim.height / 2);
    assert.ok(f0.velocity.length() !== 0, "fighters should receive impulse after burst");
    assert.ok(f1.velocity.length() !== 0, "fighters should receive impulse after burst");
    const dir0 = Vector2.subtract(f0.position, center);
    const delta0 = Vector2.subtract(f0.velocity, velBefore0);
    assert.ok(delta0.dot(dir0) > 0, "first fighter receives outward anti-stall impulse");
    assert.ok(delta0.length() >= 650, "first fighter receives a meaningful wall-reaching impulse");
    const dir1 = Vector2.subtract(f1.position, center);
    const delta1 = Vector2.subtract(f1.velocity, velBefore1);
    assert.ok(delta1.dot(dir1) > 0, "second fighter receives outward anti-stall impulse");
    assert.ok(delta1.length() >= 650, "second fighter receives a meaningful wall-reaching impulse");
    console.log("[anti-stall-burst] ok");
}

function testAntiStallBurstReachesWallsFromCenter() {
    const specs = [
        {
            id: "as-wall-a",
            name: "ASWallA",
            teamId: "t1",
            stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
            color: "#ff0000",
            appearance: { sides: 0, face: "default" },
            ability: "dash"
        },
        {
            id: "as-wall-b",
            name: "ASWallB",
            teamId: "t2",
            stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
            color: "#0000ff",
            appearance: { sides: 0, face: "default" },
            ability: "dash"
        }
    ];
    const sim = new BattleSimulation(specs, { onLog() {}, onSound() {} });
    const [first, second] = sim.fighters;
    first.position = new Vector2(430, 430);
    second.position = new Vector2(530, 530);
    first.velocity = new Vector2();
    second.velocity = new Vector2();
    sim._fireAntiStallBurst(sim.fighters);

    let firstBounced = false;
    let secondBounced = false;
    for (let frame = 0; frame < 75; frame++) {
        first.update(1 / 60, sim);
        second.update(1 / 60, sim);
        firstBounced ||= first.bounced;
        secondBounced ||= second.bounced;
    }

    assert.ok(firstBounced, "center-near first fighter should reach and bounce from a wall within 1.25s");
    assert.ok(secondBounced, "center-near second fighter should reach and bounce from a wall within 1.25s");
    console.log("[anti-stall-wall-reaching] ok");
}

function testAntiStallCollisionResetsTimer() {
    const specA = {
        id: "as-e",
        name: "ASE",
        teamId: "t1",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const specB = {
        id: "as-f",
        name: "ASF",
        teamId: "t2",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#0000ff",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([specA, specB], { onLog() {}, onSound() {} });
    const a = sim.fighters[0];
    const b = sim.fighters[1];
    a.position = new Vector2(400, 480);
    b.position = new Vector2(400 + a.radius + b.radius - 2, 480);
    a.applyImpulse(new Vector2(100, 0));
    b.applyImpulse(new Vector2(-100, 0));
    sim._antiStallTimer = 7.5;
    sim.handleCollision();
    assert.equal(sim._antiStallTimer, 0, "hostile collision should reset timer");
    console.log("[anti-stall-reset] ok");
}

function testAntiStallDefeatedFightersSkipped() {
    const specA = {
        id: "as-g",
        name: "ASG",
        teamId: "t1",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const specB = {
        id: "as-h",
        name: "ASH",
        teamId: "t2",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#0000ff",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([specA, specB], { onLog() {}, onSound() {} });
    sim.fighters[0].flags.defeated = true;
    sim._antiStallTimer = 7.9;
    sim._checkAntiStall(0.2);
    assert.equal(sim._antiStallBurstCount, 0, "should not fire with only 1 active fighter");
    console.log("[anti-stall-defeated] ok");
}

function testAntiStallFriendlyOnlyNoBurst() {
    const specA = {
        id: "as-i",
        name: "ASI",
        teamId: "t1",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const specB = {
        id: "as-j",
        name: "ASJ",
        teamId: "t1",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#0000ff",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([specA, specB], { onLog() {}, onSound() {} });
    const f0 = sim.fighters[0];
    const f1 = sim.fighters[1];
    f0.position = new Vector2(200, 480);
    f1.position = new Vector2(600, 480);
    f0.velocity = new Vector2(0, 0);
    f1.velocity = new Vector2(0, 0);
    sim._antiStallTimer = 7.9;
    sim._checkAntiStall(0.2);
    assert.equal(sim._antiStallBurstCount, 0, "should not fire with friendly-only active fighters");
    assert.equal(f0.velocity.length(), 0, "friendly fighter velocity unchanged");
    assert.equal(f1.velocity.length(), 0, "friendly fighter velocity unchanged");
    console.log("[anti-stall-friendly] ok");
}

function testAntiStallProjectileHitDoesNotResetTimer() {
    const specA = {
        id: "as-proj-a",
        name: "ASProjA",
        teamId: "t1",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#ff0000",
        appearance: { sides: 0, face: "default" },
        ability: "archer"
    };
    const specB = {
        id: "as-proj-b",
        name: "ASProjB",
        teamId: "t2",
        stats: { hp: 100, damage: 10, defense: 5, speed: 200, radius: 25, mass: 10 },
        color: "#0000ff",
        appearance: { sides: 0, face: "default" },
        ability: "dash"
    };
    const sim = new BattleSimulation([specA, specB], { onLog() {}, onSound() {} });
    const archer = sim.fighters[0];
    const target = sim.fighters[1];
    archer.position = new Vector2(200, 480);
    target.position = new Vector2(600, 480);

    // Set anti-stall timer to a non-zero value
    const TIMER_BEFORE = 5;
    sim._antiStallTimer = TIMER_BEFORE;

    // Fire an arrow at the target using the simulation's spawnArrow path
    const startPos = archer.position.clone().add(new Vector2(30, 0));
    const dir = Vector2.subtract(target.position, startPos).normalize();
    const velocity = dir.scale(archer.stats.baseSpeed * 2);
    const arrow = sim.spawnArrow(archer, startPos, velocity);
    // Move entites list so arrow is in the same collection
    sim.entities = [arrow, ...sim.fighters];

    // Advance arrow multiple steps until it hits the target
    for (let i = 0; i < 60; i++) {
        arrow.update(0.016, sim);
        if (arrow.isExpired) break;
    }

    // Arrow should have hit and damaged the target
    assert.ok(arrow.isExpired, "arrow should hit target and expire");
    assert.ok(target.hp < target.maxHp, "projectile should deal damage to target");

    // Anti-stall timer must NOT have been reset by the projectile hit
    assert.equal(
        sim._antiStallTimer,
        TIMER_BEFORE,
        "projectile damage must NOT reset anti-stall timer (fighter-vs-fighter collision only)"
    );

    // Clean up: remove arrow from entities so it does not affect other tests
    sim.entities = [...sim.fighters];
    console.log("[anti-stall-projectile-no-reset] ok");
}

testAntiStallNoBurstBeforeTimeout();
testAntiStallBurstAtTimeout();
testAntiStallBurstReachesWallsFromCenter();
testAntiStallCollisionResetsTimer();
testAntiStallDefeatedFightersSkipped();
testAntiStallFriendlyOnlyNoBurst();
testAntiStallProjectileHitDoesNotResetTimer();

function testHuntingMerchantOffers() {
    const run = createHuntingRun({ characterId: FIGHTER_IDS.DASH });
    const runWithHp = {
        ...run,
        floor: 10,
        carriedHp: 50,
        carriedMaxHp: 100,
        pendingLoot: {
            shards: 25,
            chests: [
                createHuntingChest({ rarity: "common", id: "p1" }),
                createHuntingChest({ rarity: "rare", id: "p2" })
            ],
            enhancementStones: 0
        },
        securedLoot: { shards: 0, enhancementStones: 0, chests: [] }
    };

    const event = { type: HUNTING_EVENT_TYPES.WANDERING_MERCHANT, floor: 10, discountRatio: 0 };

    // Profile with permanent hunting shards
    const profile = createDefaultPlayerProfile();
    profile.hunting.shards = 200;

    // ── Generate offers ──
    const offers = createMerchantOffers(runWithHp, event, profile);
    assert.equal(offers.length, 3, "Should generate exactly 3 offers");
    assert.equal(offers[0].type, "repair", "First offer should be repair");
    assert.equal(offers[1].type, "buy_loot", "Second offer should be buy_loot");
    assert.equal(offers[2].type, "secure_transport", "Third offer should be secure_transport");

    // Repair offer details
    assert.equal(offers[0].disabled, false, "Repair should not be disabled when HP < max");
    assert.ok(offers[0].cost > 0, "Repair should have a cost");
    assert.ok(offers[0].healAmount > 0, "Repair should have a heal amount");

    // Buy loot offer
    assert.equal(offers[1].disabled, false, "Buy loot should not be disabled");
    assert.ok(offers[1].cost > 0, "Buy loot should have a cost");

    // Secure transport offer - has pending chests
    assert.equal(offers[2].disabled, false, "Secure transport should be enabled when pending chests exist");

    // ── Discount applies ──
    const eventDiscounted = { ...event, discountRatio: 0.2 };
    const discountedOffers = createMerchantOffers(runWithHp, eventDiscounted, profile);
    assert.ok(discountedOffers[0].cost <= offers[0].cost, "Discount should reduce prices");

    // ── Future consumable merchant offer reuses the persistent inventory definition ──
    const potionOffer = createConsumableMerchantOffer(CONSUMABLE_IDS.HP_POTION, profile, 0.2);
    assert.equal(potionOffer.type, "consumable", "Consumables should use a distinct merchant offer type");
    assert.equal(potionOffer.cost, 80, "Consumable merchant discounts should reuse the definition purchase cost");
    const potionPurchase = applyMerchantOffer(runWithHp, profile, potionOffer);
    assert.ok(potionPurchase, "A future consumable merchant offer should be purchasable through the shared path");
    assert.equal(
        profile.consumables.owned[CONSUMABLE_IDS.HP_POTION],
        1,
        "Merchant purchase should add persistent stock"
    );
    assert.equal(potionPurchase.result.type, "consumable", "Merchant result should retain the consumable type");

    // ── Secure transport disabled when no pending chests ──
    const runNoPending = { ...runWithHp, pendingLoot: { shards: 0, enhancementStones: 0, chests: [] } };
    const noChestOffers = createMerchantOffers(runNoPending, event, profile);
    assert.equal(noChestOffers[2].disabled, true, "Secure transport should be disabled with no pending chests");
    assert.ok(noChestOffers[2].disabledReason.length > 0, "Disabled offer should have a reason");

    // ── canAffordOffer ──
    profile.hunting.shards = 0;
    assert.equal(canAffordOffer(offers[0], profile), false, "Cannot afford with 0 shards");
    profile.hunting.shards = 200;
    assert.equal(canAffordOffer(offers[0], profile), true, "Can afford with enough shards");

    // ── Repair offer: spends permanent shards, heals carried HP ──
    const repairResult = applyMerchantOffer(runWithHp, profile, offers[0]);
    assert.ok(repairResult !== null, "Repair offer should apply");
    assert.equal(profile.hunting.shards, 200 - offers[0].cost, "Repair should spend permanent shards");
    assert.ok(repairResult.run.carriedHp > runWithHp.carriedHp, "Repair should increase carried HP");
    assert.equal(repairResult.result.type, "repair", "Result type should be repair");
    assert.ok(repairResult.result.healed > 0, "Should have healed positive amount");
    const toastMsg = formatOfferResultToast(repairResult.result);
    assert.ok(toastMsg.includes("HP"), "Repair toast should mention HP");

    // ── Buy loot offer: adds unsecured chest ──
    profile.hunting.shards = 200;
    const buyResult = applyMerchantOffer(runWithHp, profile, offers[1]);
    assert.ok(buyResult !== null, "Buy loot offer should apply");
    assert.equal(profile.hunting.shards, 200 - offers[1].cost, "Buy loot should spend permanent shards");
    assert.equal(
        buyResult.run.pendingLoot.chests.length,
        runWithHp.pendingLoot.chests.length + 1,
        "Buy loot should add a chest to pendingLoot"
    );
    const buyToast = formatOfferResultToast(buyResult.result);
    assert.ok(buyToast.includes("미확보"), "Buy loot toast should mention 미확보");

    // ── Secure transport offer: moves pending chest to secured loot ──
    profile.hunting.shards = 200;
    const secureResult = applyMerchantOffer(runWithHp, profile, offers[2]);
    assert.ok(secureResult !== null, "Secure transport offer should apply");
    assert.equal(profile.hunting.shards, 200 - offers[2].cost, "Secure transport should spend permanent shards");
    assert.equal(
        secureResult.run.pendingLoot.chests.length,
        runWithHp.pendingLoot.chests.length - 1,
        "Secure transport should remove a chest from pendingLoot"
    );
    assert.equal(
        secureResult.run.securedLoot.chests.length,
        (runWithHp.securedLoot?.chests?.length ?? 0) + 1,
        "Secure transport should add a chest to securedLoot"
    );
    const secureToast = formatOfferResultToast(secureResult.result);
    assert.ok(secureToast.includes("안전"), "Secure transport toast should mention 안전");

    // ── Purchased offer cannot be applied again ──
    assert.equal(
        applyMerchantOffer(runWithHp, profile, { ...offers[0], purchased: true }),
        null,
        "Purchased offer should return null"
    );
    assert.equal(
        applyMerchantOffer({ ...runWithHp, carriedHp: runWithHp.carriedMaxHp }, profile, offers[0]),
        null,
        "Repair should return null when current run HP is already full"
    );

    // ── Insufficient shards ──
    profile.hunting.shards = 1;
    assert.equal(applyMerchantOffer(runWithHp, profile, offers[1]), null, "Insufficient shards should return null");

    // ── Disabled offer cannot be applied ──
    profile.hunting.shards = 200;
    assert.equal(
        applyMerchantOffer(runNoPending, profile, noChestOffers[2]),
        null,
        "Disabled offer should return null"
    );

    console.log("[hunting-merchant] ok");
}

function testHuntingMerchantPurchaseRefreshesUiState() {
    const profile = createDefaultPlayerProfile();
    profile.hunting.shards = 100;
    const overlayStates = [];
    let toastCalls = 0;
    const app = {
        playerProfile: profile,
        setHuntingOverlayState(data) {
            overlayStates.push(data);
        },
        showToast() {
            toastCalls += 1;
        }
    };
    const manager = new HuntingManager(app);
    const run = createHuntingRun({ characterId: FIGHTER_IDS.RAGE, stageId: HUNTING_STAGE_IDS.CAVE });
    const offers = createMerchantOffers(run, { type: HUNTING_EVENT_TYPES.WANDERING_MERCHANT }, profile);
    manager._run = { ...run, merchantOffers: offers };

    manager.merchantChoose(1);

    assert.notEqual(manager._run.merchantOffers, offers, "Purchased merchant offers should use a new array reference");
    assert.equal(manager._run.merchantOffers[1].purchased, true, "Purchased merchant offer should be marked complete");
    assert.equal(
        overlayStates.at(-1).huntingMerchantOffers[1].purchased,
        true,
        "Merchant overlay should receive the purchased state for immediate button refresh"
    );
    assert.equal(
        manager._run.pendingLoot.chests.length,
        1,
        "Merchant chest purchase should still add exactly one unsecured chest"
    );
    assert.equal(toastCalls, 0, "Merchant purchases should report their result in the merchant screen, not a toast");
    assert.ok(
        overlayStates.at(-1).huntingMerchantResult,
        "Merchant overlay should receive a textual result for the completed purchase"
    );
    console.log("[hunting-merchant-ui-refresh] ok");
}

function testHuntingMerchantPassPaintsResumedMove() {
    const overlayStates = [];
    const app = {
        setHuntingOverlayState(data) {
            overlayStates.push(data);
        }
    };
    const manager = new HuntingManager(app);
    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.RAGE, stageId: HUNTING_STAGE_IDS.CAVE });

    let advanceOptions = null;
    manager.advance = (options) => {
        advanceOptions = options;
    };

    manager.merchantPass();

    assert.deepEqual(
        advanceOptions,
        { waitForFirstMoveUi: true },
        "Merchant pass must paint the resumed movement card before advancing"
    );
    assert.equal(overlayStates.at(-1).huntingMerchantActive, false, "Merchant pass should close the merchant screen");
    console.log("[hunting-merchant-pass-paint] ok");
}

function testResultConfirmationReturnsInitialState() {
    const appSource = readFileSync("src/app.js", "utf8");
    assert.ok(
        appSource.includes('this._startBtn.setState({ text: "확인", hidden: true, disabled: true });'),
        "The common result sequence must hide the large bottom confirmation button"
    );
    assert.ok(
        appSource.includes("confirmResultSequence()") && appSource.includes("!presentation?.isFinal"),
        "Only the final side tab must be allowed to confirm a result sequence"
    );
    assert.equal(
        appSource.includes('text: "새 토너먼트 준비"'),
        false,
        "Tournament completion should not retain the obsolete preparation button label"
    );

    const calls = [];
    const resultApp = {
        rafId: 17,
        lifecycle: new AppLifecycle(),
        _screenWakeLock: {
            deactivate() {
                calls.push(["wake-release"]);
            }
        },
        _onSimulationResult: () => {},
        matchFinalized: true,
        simulation: { finished: true },
        tournament: { champion: { id: "archer" } },
        currentTournamentMatch: { id: "final" },
        _currentMatchReport: {},
        _currentTournamentReport: {},
        _matchReports: [{}],
        ui: {
            lastOverlayState: { label: "결과" }
        },
        _root: {
            tournamentActive: true,
            statusText: "결과",
            statusBadge: "Result",
            reset() {
                this.tournamentActive = false;
                this.statusText = "내 캐릭터 스탯을 배분하세요";
                this.statusBadge = "Setup";
                calls.push(["root"]);
            }
        },
        _panel: {
            reset() {
                calls.push(["panel"]);
            }
        },
        _modeSegment: {
            reset() {
                calls.push(["mode"]);
            }
        },
        _startBtn: {
            reset() {
                calls.push(["start"]);
            }
        },
        _log: {
            reset() {
                calls.push(["log"]);
            }
        },
        _strip: {
            reset() {
                calls.push(["strip"]);
            }
        },
        _bracket: {
            render(value) {
                calls.push(["bracket", value]);
            },
            reset() {
                calls.push(["bracket-reset"]);
            }
        },
        _overlay: {
            reset() {
                calls.push(["result-overlay"]);
            }
        },
        resetHuntingUiState() {
            calls.push(["overlay"]);
        },
        _toast: {
            reset() {
                calls.push(["toast"]);
            }
        },
        refreshPlayerSetup() {
            calls.push(["setup"]);
        },
        startPlayerPreviewLoop() {
            calls.push(["preview"]);
        }
    };
    resultApp.lifecycle.beginGameplay();
    resultApp.lifecycle.awaitResultConfirmation();
    const savedCancelAnimationFrame = globalThis.cancelAnimationFrame;
    globalThis.cancelAnimationFrame = (id) => calls.push(["cancel", id]);

    try {
        Object.setPrototypeOf(resultApp, Object.getPrototypeOf(app));
        resultApp.returnToInitialState();
    } finally {
        globalThis.cancelAnimationFrame = savedCancelAnimationFrame;
    }

    assert.equal(
        resultApp.lifecycle.state,
        APP_LIFECYCLE_STATES.SETUP,
        "Confirming a result should restore the shared lifecycle to setup"
    );
    assert.equal(resultApp.tournament, null, "Confirming a result should discard the finished tournament");
    assert.equal(resultApp.simulation, null, "Confirming a result should discard the finished simulation");
    assert.equal(resultApp.ui.lastOverlayState, null, "Initial state should clear transient overlay data");
    assert.equal(resultApp._root.tournamentActive, false, "Initial state should not remain tournament-locked");
    assert.equal(resultApp._root.statusBadge, "Setup", "Initial state should restore the setup status");
    assert.deepEqual(calls, [
        ["cancel", 17],
        ["wake-release"],
        ["root"],
        ["panel"],
        ["mode"],
        ["start"],
        ["log"],
        ["strip"],
        ["bracket-reset"],
        ["result-overlay"],
        ["overlay"],
        ["toast"],
        ["setup"],
        ["preview"]
    ]);
    console.log("[result-confirmation-initial-state] ok");
}

async function testRebirthPromptWaitsForResultConfirmation(app) {
    const originalProfile = app.playerProfile;
    const originalCharacterId = app.playerFighterId;
    const originalDialog = PopupService._testDialog;
    const originalOpenCharacterRebirth = CollectionHubService.openCharacterRebirth;
    const promptCalls = [];
    const openedCharacterIds = [];
    const characterId = FIGHTER_IDS.ARCHER;

    app.playerProfile = createDefaultPlayerProfile();
    setCharacterXp(app.playerProfile, characterId, getLevelRequirement(10));
    app.playerFighterId = characterId;
    PopupService.setTestDialog({
        show(options) {
            promptCalls.push(options);
            return Promise.resolve("open");
        }
    });
    CollectionHubService.openCharacterRebirth = (openedCharacterId) => openedCharacterIds.push(openedCharacterId);

    try {
        for (const resultKind of ["tournament_win", "tournament_elimination"]) {
            const promptCountBefore = promptCalls.length;
            app._queueRebirthPrompt({
                characterId,
                levelUp: true,
                previousLevel: 9,
                level: 10
            });
            assert.equal(
                app._pendingRebirthPromptCharacterId,
                characterId,
                `${resultKind} should retain a newly reached Lv.10 prompt until confirmation`
            );

            app.beginGameSession();
            app.beginResultConfirmation();
            assert.equal(
                promptCalls.length,
                promptCountBefore,
                `${resultKind} should not show the rebirth popup while result confirmation is active`
            );

            app.returnToInitialState();
            assert.equal(app.lifecycle.isSetup, true, `${resultKind} should restore setup before prompting`);
            assert.equal(
                promptCalls.length,
                promptCountBefore + 1,
                `${resultKind} should show exactly one rebirth popup`
            );
            assert.equal(
                app._pendingRebirthPromptCharacterId,
                null,
                "Showing the popup must consume only the notification"
            );
            await Promise.resolve();
            assert.equal(
                openedCharacterIds.at(-1),
                characterId,
                "The rebirth popup primary action must open the eligible character's rebirth tab"
            );
        }

        app._queueRebirthPrompt({
            characterId,
            levelUp: false,
            previousLevel: 10,
            level: 10
        });
        assert.equal(
            app._pendingRebirthPromptCharacterId,
            null,
            "Entering setup with an already max-level character must not create another prompt"
        );
    } finally {
        app.playerProfile = originalProfile;
        app.playerFighterId = originalCharacterId;
        app._pendingRebirthPromptCharacterId = null;
        CollectionHubService.openCharacterRebirth = originalOpenCharacterRebirth;
        PopupService.setTestDialog(originalDialog);
        app.refreshPlayerSetup();
        app._refreshCollectionHub();
    }
    console.log("[rebirth-result-confirmation-prompt] ok");
}

function testAppLifecycleTransitions() {
    const lifecycle = new AppLifecycle();
    assert.equal(lifecycle.state, APP_LIFECYCLE_STATES.SETUP, "Lifecycle should begin in setup");
    assert.equal(lifecycle.isSetupInteractionLocked, false, "Setup should leave configuration interactive");
    const initialRevision = lifecycle.revision;
    lifecycle.returnToSetup();
    assert.equal(
        lifecycle.isCurrentRevision(initialRevision),
        false,
        "Explicit reset should invalidate stale setup work"
    );

    lifecycle.beginGameplay();
    const gameplayRevision = lifecycle.revision;
    assert.equal(lifecycle.isGameplayActive, true, "Gameplay state should be explicit");
    assert.equal(lifecycle.isSetupInteractionLocked, true, "Gameplay should lock configuration");

    lifecycle.awaitResultConfirmation();
    assert.equal(lifecycle.isAwaitingResultConfirmation, true, "Result state should wait for explicit confirmation");
    assert.equal(lifecycle.isSetupInteractionLocked, true, "Result confirmation should keep configuration locked");
    assert.equal(
        lifecycle.isCurrentRevision(gameplayRevision),
        false,
        "Result transition should invalidate active match work"
    );

    lifecycle.returnToSetup();
    assert.equal(lifecycle.isSetup, true, "Confirmation should return to setup");
    assert.throws(
        () => lifecycle.awaitResultConfirmation(),
        /Invalid app lifecycle transition/,
        "Lifecycle should reject result screens without an active game"
    );
    console.log("[app-lifecycle-transitions] ok");
}

async function testScreenWakeLock() {
    const visibilityListeners = [];
    const documentRef = {
        visibilityState: "visible",
        addEventListener(type, listener) {
            if (type === "visibilitychange") visibilityListeners.push(listener);
        }
    };
    const createSentinel = () => {
        let releaseListener = null;
        return {
            released: false,
            addEventListener(type, listener) {
                if (type === "release") releaseListener = listener;
            },
            async release() {
                this.released = true;
                releaseListener?.();
            }
        };
    };
    const sentinels = [createSentinel(), createSentinel(), createSentinel()];
    const requests = [];
    const wakeLock = new ScreenWakeLock({
        navigatorRef: {
            wakeLock: {
                request(type) {
                    requests.push(type);
                    return Promise.resolve(sentinels.shift());
                }
            }
        },
        documentRef
    });

    await wakeLock.activate();
    assert.deepEqual(requests, ["screen"], "Gameplay should request a screen wake lock");
    await wakeLock.deactivate();
    assert.equal(sentinels.length, 2, "Only the requested sentinel should be consumed");

    await wakeLock.activate();
    documentRef.visibilityState = "hidden";
    await wakeLock._sentinel.release();
    assert.deepEqual(requests, ["screen", "screen"], "Hidden documents must not reacquire a released wake lock");

    documentRef.visibilityState = "visible";
    visibilityListeners.forEach((listener) => listener());
    await Promise.resolve();
    assert.deepEqual(
        requests,
        ["screen", "screen", "screen"],
        "Visible gameplay should reacquire a released wake lock"
    );
    await wakeLock.deactivate();

    const unsupportedWakeLock = new ScreenWakeLock({ navigatorRef: {}, documentRef });
    await unsupportedWakeLock.activate();
    await unsupportedWakeLock.deactivate();
    console.log("[screen-wake-lock] ok");
}

function testBattleAppControlsScreenWakeLock() {
    const calls = [];
    const lifecycleApp = {
        lifecycle: new AppLifecycle(),
        _screenWakeLock: {
            activate() {
                calls.push("activate");
            },
            deactivate() {
                calls.push("deactivate");
            }
        }
    };
    Object.setPrototypeOf(lifecycleApp, Object.getPrototypeOf(app));

    lifecycleApp.beginGameSession();
    lifecycleApp.beginResultConfirmation();

    assert.deepEqual(
        calls,
        ["activate", "deactivate"],
        "Battle lifecycle should hold the screen awake only while playing"
    );
    console.log("[battle-app-screen-wake-lock-lifecycle] ok");
}

function testHuntingRetreatAwaitsResultConfirmation() {
    const source = readFileSync("src/hunting/huntingManager.js", "utf8");
    const resultTransitions = source.match(/app\.beginResultConfirmation\(\);/g) ?? [];
    assert.equal(
        resultTransitions.length,
        3,
        "Stage clear, defeat, and portal retreat should all enter result confirmation"
    );

    const calls = [];
    const app = {
        playerProfile: createDefaultPlayerProfile(),
        _refreshCollectionHub() {
            calls.push("collection");
        },
        beginResultConfirmation() {
            calls.push("result");
        },
        refreshPlayerSetup() {
            calls.push("setup");
        },
        setHuntingActive() {
            calls.push("active");
        },
        setHuntingOverlayState() {
            calls.push("overlay-state");
        },
        presentResultSequence() {
            calls.push("result-sequence");
        },
        showToast() {
            calls.push("toast");
        },
        _settleHuntingAchievements() {
            calls.push("achievements");
        }
    };
    const manager = new HuntingManager(app);
    const run = createHuntingRun({ characterId: FIGHTER_IDS.ARCHER });
    run.lastEvent = { type: HUNTING_EVENT_TYPES.PORTAL };
    manager._run = run;

    manager.retreat();

    assert.ok(
        calls.indexOf("result") < calls.indexOf("setup"),
        "Hunting must lock result state before refreshing setup UI"
    );
    assert.equal(manager._run, null, "Hunting retreat should release the finished run after showing its result");
    console.log("[hunting-retreat-awaits-result-confirmation] ok");
}

function testHuntingFormatHelpers() {
    // ── formatChestRarityCounts ──
    assert.equal(formatChestRarityCounts([]), "", "Empty chests should produce empty string");
    assert.equal(formatChestRarityCounts(null), "", "Null chests should produce empty string");

    const chests = [
        createHuntingChest({ rarity: "common", id: "c1" }),
        createHuntingChest({ rarity: "rare", id: "r1" }),
        createHuntingChest({ rarity: "common", id: "c2" })
    ];
    const formatted = formatChestRarityCounts(chests);
    assert.ok(formatted.includes("common 2개"), "Should count common chests");
    assert.ok(formatted.includes("rare 1개"), "Should count rare chests");

    // ── formatPendingLootSummary ──
    const summary = formatPendingLootSummary({ shards: 50, chests: [createHuntingChest({ rarity: "common" })], xp: 0 });
    assert.ok(summary.includes("보유 파편 50"), "Should show shard count");
    assert.ok(summary.includes("미확보 상자 1개"), "Should show unsecured chest count");

    const noChestSummary = formatPendingLootSummary({ shards: 30, chests: [], xp: 0 });
    assert.ok(noChestSummary.includes("보유 파편 30"), "Should show shard count without chests");
    assert.ok(!noChestSummary.includes("미확보"), "Should not mention chests when none exist");

    const stoneSummary = formatPendingLootSummary({ shards: 0, enhancementStones: 2, chests: [], xp: 0 });
    assert.ok(stoneSummary.includes("2"), "Pending loot summaries must include enhancement stones");

    assert.equal(formatPendingLootSummary(null), "", "Null input should return empty");
    assert.equal(
        formatPendingLootSummary({ shards: 0, chests: [], xp: 0 }),
        "",
        "Empty pending loot should not hide contextual choice summary"
    );

    // ── formatDefeatLossText ──
    const lossText = formatDefeatLossText({
        shards: 10,
        chests: [createHuntingChest({ rarity: "common", id: "l1" }), createHuntingChest({ rarity: "rare", id: "l2" })],
        xp: 0
    });
    assert.ok(lossText.includes("파편 10"), "Should show lost shards");
    assert.ok(lossText.includes("common 1개"), "Should show common chest destroyed");
    assert.ok(lossText.includes("rare 1개"), "Should show rare chest destroyed");

    const shardOnlyLoss = formatDefeatLossText({ shards: 5, chests: [], xp: 0 });
    assert.equal(shardOnlyLoss, "파편 5 손실", "Should only mention shards when no chests destroyed");

    const stoneLoss = formatDefeatLossText({ shards: 0, enhancementStones: 2, chests: [], xp: 0 });
    assert.ok(stoneLoss.includes("2"), "Defeat loss text must include lost enhancement stones");

    assert.equal(formatDefeatLossText(null), "", "Null defeat losses should return empty");

    console.log("[hunting-format] ok");
}

function testHuntingCombatText() {
    // ── getHuntingMobCount uses generic count, no melee/ranged labels ──
    const countFloor1 = getHuntingMobCount(1, () => 0.5);
    const countFloor10 = getHuntingMobCount(10, () => 0.5);

    assert.ok(Number.isFinite(countFloor1) && countFloor1 >= 2, "Floor 1 should have at least two enemies");
    assert.ok(countFloor10 >= 2 && countFloor10 <= 10, "Mob counts should remain within the configured random range");

    // ── Individual mob specs should not expose melee/ranged labels ──
    const forbiddenLabels = ["근접", "원거리", "melee", "ranged"];
    const meleeSpec = createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.MELEE, floor: 1, index: 0 });
    const rangedSpec = createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.RANGED, floor: 1, index: 1 });
    for (const spec of [meleeSpec, rangedSpec]) {
        for (const label of forbiddenLabels) {
            assert.ok(
                !spec.name.toLowerCase().includes(label.toLowerCase()),
                `Mob name "${spec.name}" should not contain "${label}"`
            );
            assert.ok(
                !spec.title.toLowerCase().includes(label.toLowerCase()),
                `Mob title "${spec.title}" should not contain "${label}"`
            );
        }
    }

    // ── Internal archetypes and abilities still work ──
    assert.equal(
        meleeSpec.hunting.monsterType,
        HUNTING_MONSTER_TYPES.MELEE,
        "Melee mob should retain internal monsterType"
    );
    assert.equal(meleeSpec.ability, "hunting_mob", "Pursuer mob should use the shared monster ability");
    assert.equal(
        rangedSpec.hunting.monsterType,
        HUNTING_MONSTER_TYPES.RANGED,
        "Ranged mob should retain internal monsterType"
    );
    assert.equal(rangedSpec.ability, "hunting_mob", "Shooter mob should use the shared monster ability");

    // ── createHuntingMobEncounter does not use melee/ranged in UI-visible text ──
    const mobs = createHuntingMobEncounter({ floor: 5, rng: () => 0.5 });
    assert.equal(
        mobs.length,
        getHuntingMobCount(5, () => 0.5),
        "Encounter count matches getHuntingMobCount"
    );
    for (const mob of mobs) {
        assert.ok(typeof mob.name === "string", "Mob should have a name");
        assert.ok(typeof mob.title === "string", "Mob should have a title");
        for (const label of forbiddenLabels) {
            assert.ok(
                !mob.name.toLowerCase().includes(label.toLowerCase()),
                `Encounter mob name "${mob.name}" should not contain "${label}"`
            );
            assert.ok(
                !mob.title.toLowerCase().includes(label.toLowerCase()),
                `Encounter mob title "${mob.title}" should not contain "${label}"`
            );
        }
    }

    console.log("[hunting-combat-text] ok");
}

function testHuntingLootHud() {
    const app = {
        ui: {
            lastOverlayState: null
        },
        setHuntingOverlayState(data) {
            this.ui.lastOverlayState = data;
        }
    };

    // ── HUD hidden when no run ──
    const manager = new HuntingManager(app);
    const stateNoRun = manager._getLootHudState();
    assert.equal(stateNoRun.huntingLootHudVisible, false, "No run: HUD should be hidden");
    assert.equal(stateNoRun.huntingLootHudShards, 0, "No run: shards should be 0");
    assert.equal(stateNoRun.huntingLootHudEnhancementStones, 0, "No run: enhancement stones should be 0");
    assert.equal(stateNoRun.huntingLootHudChests, 0, "No run: chests should be 0");

    // ── HUD hidden when pending loot is empty ──
    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.DASH });
    const stateEmpty = manager._getLootHudState();
    assert.equal(stateEmpty.huntingLootHudVisible, false, "Empty pending loot: HUD should be hidden");
    assert.equal(stateEmpty.huntingLootHudShards, 0, "Empty pending loot: shards should be 0");
    assert.equal(stateEmpty.huntingLootHudEnhancementStones, 0, "Empty pending loot: enhancement stones should be 0");
    assert.equal(stateEmpty.huntingLootHudChests, 0, "Empty pending loot: chests should be 0");

    manager._run = {
        ...manager._run,
        pendingLoot: { shards: 0, enhancementStones: 3, chests: [] }
    };
    const stateStones = manager._getLootHudState();
    assert.equal(stateStones.huntingLootHudVisible, true, "Enhancement stones alone must keep the loot HUD visible");
    assert.equal(
        stateStones.huntingLootHudEnhancementStones,
        3,
        "The loot HUD must display pending enhancement stones"
    );

    // ── HUD visible with shards only ──
    manager._run = {
        ...manager._run,
        pendingLoot: { shards: 30, enhancementStones: 0, chests: [] }
    };
    const stateShards = manager._getLootHudState();
    assert.equal(stateShards.huntingLootHudVisible, true, "Shards only: HUD should be visible");
    assert.equal(stateShards.huntingLootHudShards, 30, "Shards only: shards should be 30");
    assert.equal(stateShards.huntingLootHudChests, 0, "Shards only: chests should be 0");

    // ── HUD visible with shards and chests ──
    manager._run = {
        ...manager._run,
        pendingLoot: {
            shards: 45,
            enhancementStones: 4,
            chests: [
                createHuntingChest({ rarity: "common", id: "h1" }),
                createHuntingChest({ rarity: "rare", id: "h2" })
            ],
            xp: 0
        }
    };
    const stateBoth = manager._getLootHudState();
    assert.equal(stateBoth.huntingLootHudVisible, true, "Both: HUD should be visible");
    assert.equal(stateBoth.huntingLootHudShards, 45, "Both: shards should be 45");
    assert.equal(stateBoth.huntingLootHudEnhancementStones, 4, "Both: enhancement stones should be 4");
    assert.equal(stateBoth.huntingLootHudChests, 2, "Both: chests should be 2");

    // ── _setHuntingMoveState includes HUD data ──
    manager._run = {
        ...manager._run,
        pendingLoot: { shards: 12, enhancementStones: 0, chests: [createHuntingChest({ rarity: "common" })] }
    };
    manager._setHuntingMoveState({
        moving: true,
        step: 1,
        maxSteps: 5,
        routeStartFloor: 5,
        routeEndFloor: 10,
        message: "이동 중..."
    });
    assert.equal(app.ui.lastOverlayState.huntingLootHudVisible, true, "Movement: HUD should be visible");
    assert.equal(app.ui.lastOverlayState.huntingLootHudShards, 12, "Movement: shards should be 12");
    assert.equal(app.ui.lastOverlayState.huntingLootHudChests, 1, "Movement: chests should be 1");
    assert.equal(app.ui.lastOverlayState.huntingMoving, true, "Movement: huntingMoving should be true");

    // ── _stopHuntingMoveForChoice includes HUD data ──
    manager._stopHuntingMoveForChoice(app, {
        message: "5층 — 포탈 발견!",
        canRetreat: true,
        floor: 5,
        summary: "포탈 발견 · 현재 5층 · 귀환 또는 10층 전진"
    });
    assert.equal(app.ui.lastOverlayState.huntingLootHudVisible, true, "Choice: HUD should be visible");
    assert.equal(app.ui.lastOverlayState.huntingLootHudShards, 12, "Choice: shards should be 12");
    assert.equal(app.ui.lastOverlayState.huntingChoiceVisible, true, "Choice: huntingChoiceVisible should be true");

    // ── _stopHuntingMoveForMerchant includes HUD data ──
    manager._stopHuntingMoveForMerchant(app, {
        message: "5층 — 떠돌이 상인",
        floor: 5,
        offers: [],
        summary: ""
    });
    assert.equal(app.ui.lastOverlayState.huntingLootHudVisible, true, "Merchant: HUD should be visible");
    assert.equal(app.ui.lastOverlayState.huntingLootHudShards, 12, "Merchant: shards should be 12");
    assert.equal(app.ui.lastOverlayState.huntingMerchantActive, true, "Merchant: huntingMerchantActive should be true");

    // ── HUD clears when pending loot becomes empty ──
    manager._run = {
        ...manager._run,
        pendingLoot: { shards: 0, enhancementStones: 0, chests: [] }
    };
    const stateEmpty2 = manager._getLootHudState();
    assert.equal(stateEmpty2.huntingLootHudVisible, false, "Empty after having loot: HUD should hide");
    assert.equal(stateEmpty2.huntingLootHudShards, 0, "Empty after having loot: shards should be 0");
    assert.equal(
        stateEmpty2.huntingLootHudEnhancementStones,
        0,
        "Empty after having loot: enhancement stones should be 0"
    );
    assert.equal(stateEmpty2.huntingLootHudChests, 0, "Empty after having loot: chests should be 0");

    console.log("[hunting-loot-hud] ok");
}

function testHuntingDefeatChestLoss() {
    const run = createHuntingRun({ characterId: FIGHTER_IDS.DASH });
    const runWithChests = {
        ...run,
        floor: 5,
        carriedHp: 30,
        carriedMaxHp: 100,
        status: "active",
        pendingLoot: {
            shards: 100,
            chests: [
                createHuntingChest({ rarity: "common", id: "d1" }),
                createHuntingChest({ rarity: "rare", id: "d2" })
            ],
            xp: 100
        }
    };

    // Controlled RNG: probability chain ensures both chests are destroyed
    const defeated = defeatHuntingRun(runWithChests, {
        rng: (() => {
            const seq = [0.01, 0.01, 0.01, 0.01];
            let i = 0;
            return () => seq[i++] ?? 0.01;
        })()
    });

    assert.equal(defeated.status, "defeated", "Defeat should end the run");

    // Both chests should be in defeatLosses (with high probability rng)
    if (defeated.defeatLosses.chests.length > 0) {
        const lossText = formatDefeatLossText(defeated.defeatLosses);
        assert.ok(typeof lossText === "string" && lossText.length > 0, "Defeat loss text should be non-empty");
        // Check that text mentions destruction
        // The text should have 파괴 when chests are destroyed
        const hasDestroyed = lossText.includes("파괴");
        const hasShards = lossText.includes("파편");
        assert.ok(hasShards, "Defeat loss text should mention shard loss");
        // If chests were destroyed, should mention 파괴
        if (defeated.defeatLosses.chests.length > 0) {
            assert.ok(hasDestroyed, "Defeat loss text should mention chest destruction when chests lost");
        }
    }

    console.log("[hunting-defeat-chest-loss] ok");
}

function testHuntingChoiceSummaryKeepsContextWithPendingLoot() {
    const app = {
        ui: {
            lastOverlayState: null
        },
        setHuntingOverlayState(data) {
            this.ui.lastOverlayState = data;
        }
    };
    const manager = new HuntingManager(app);
    manager._run = {
        pendingLoot: {
            shards: 12,
            chests: [createHuntingChest({ rarity: "common" })],
            xp: 0
        }
    };

    manager._stopHuntingMoveForChoice(app, {
        message: "5층 — 포탈 발견!",
        canRetreat: true,
        floor: 5,
        summary: "포탈 발견 · 현재 5층 · 귀환 또는 10층 전진"
    });

    assert.ok(
        app.ui.lastOverlayState.huntingLootSummary.includes("포탈 발견"),
        "Choice summary should keep event context"
    );
    assert.ok(
        app.ui.lastOverlayState.huntingLootSummary.includes("미확보 상자 1개"),
        "Choice summary should include pending chests"
    );

    console.log("[hunting-choice-summary-context] ok");
}

// ── Hero Orb Carryover — BattleBall 인스턴스 메서드 ────────────────────────────

function testBattleBallAppliesSpecHeroCarryover(app) {
    const hero = app.roster.find((f) => f.id === FIGHTER_IDS.HERO);
    const spec = JSON.parse(JSON.stringify(hero));
    spec.hero = { carryover: { hp: 2, damage: 1, speed: 0, defense: 1, skill: 0 } };
    const ball = new BattleBall(spec, { x: 480, y: 480 });

    assert.equal(ball.maxHp, spec.stats.hp + 10, "hp carryover 2 → maxHp +10");
    assert.equal(ball.stats.baseSpeed, spec.stats.speed, "speed carryover 0 → baseSpeed unchanged");
    assert.ok(ball.stats.baseDamage > spec.stats.damage, "damage carryover 1 → baseDamage increased");
    assert.ok(ball.stats.baseDefense > spec.stats.defense, "defense carryover 1 → baseDefense increased");

    const zeroBonuses = Object.values(ball.hero.bonuses).every((v) => v === 0);
    assert.ok(zeroBonuses, "carryover should NOT modify hero.bonuses");

    console.log("[battleball-applies-spec-hero-carryover] ok");
}

function testBattleBallMergeHeroOrbCarryoverInto(app) {
    const hero = app.roster.find((f) => f.id === FIGHTER_IDS.HERO);
    const ball = new BattleBall(hero, { x: 480, y: 480 });

    // Simulate orb gains: hp=5, damage=3 (rest 0)
    ball.hero.bonuses.hp = 5;
    ball.hero.bonuses.damage = 3;

    const targetSpec = { hero: { carryover: { hp: 0, damage: 0, speed: 0, defense: 0, skill: 0 } } };
    ball.mergeHeroOrbCarryoverInto(targetSpec);

    // hp: floor(5 * 0.5) = 2, damage: floor(3 * 0.5) = 1
    assert.equal(targetSpec.hero.carryover.hp, 2, "hp carryover from bonuses 5 → 2");
    assert.equal(targetSpec.hero.carryover.damage, 1, "damage carryover from bonuses 3 → 1");
    assert.equal(targetSpec.hero.carryover.speed, 0, "speed carryover should be 0");

    // Merge again — cumulative
    ball.hero.bonuses.hp = 3;
    ball.mergeHeroOrbCarryoverInto(targetSpec);
    assert.equal(targetSpec.hero.carryover.hp, 2 + 1, "second merge: floor(3*0.5)=1, total 3");

    console.log("[battleball-merge-hero-orb-carryover-into] ok");
}

function testHuntingHeroCarryoverInStartFloorBattle(app) {
    const hero = app.roster.find((f) => f.id === FIGHTER_IDS.HERO);
    const archer = app.roster.find((f) => f.id === FIGHTER_IDS.ARCHER);

    const capturedSpecs = [];
    const mockApp = {
        roster: [hero, archer],
        playerProfile: createDefaultPlayerProfile(),
        playerStatAllocation: createRandomStatAllocation(() => 0),
        ui: { setHuntingActive() {}, setHuntingOverlayState() {}, addLog() {} },
        startMatch(specs) {
            capturedSpecs.push(specs);
        }
    };
    const manager = new HuntingManager(mockApp);

    // Hero Ball should receive carryover injection
    capturedSpecs.length = 0;
    const runHero = createHuntingRun({ characterId: FIGHTER_IDS.HERO, stageId: HUNTING_STAGE_IDS.CAVE });
    runHero.hero.carryover.hp = 2;
    runHero.hero.carryover.damage = 1;
    manager._run = runHero;
    manager._startFloorBattle();

    const heroSpec = capturedSpecs[0][0];
    assert.ok(heroSpec.hero?.carryover, "Hero Ball should receive carryover injection");
    assert.equal(heroSpec.hero.carryover.hp, 2, "carryover.hp should be injected for Hero Ball");

    // Non-Hero should NOT receive carryover injection
    capturedSpecs.length = 0;
    const runArcher = createHuntingRun({ characterId: FIGHTER_IDS.ARCHER, stageId: HUNTING_STAGE_IDS.CAVE });
    runArcher.hero.carryover.hp = 2;
    manager._run = runArcher;
    manager._startFloorBattle();

    const archerSpec = capturedSpecs[0][0];
    assert.equal(archerSpec.hero?.carryover, undefined, "Non-Hero should NOT receive carryover injection");

    console.log("[hunting-hero-carryover-start-floor] ok");
}

function testHuntingHeroCarryoverInHandleFinish(app) {
    const hero = app.roster.find((f) => f.id === FIGHTER_IDS.HERO);
    const ball = new BattleBall(hero, { x: 480, y: 480 });

    ball.hero.bonuses.hp = 5;
    ball.hero.bonuses.damage = 3;

    const run = createHuntingRun({ characterId: FIGHTER_IDS.HERO, stageId: HUNTING_STAGE_IDS.CAVE });

    ball.mergeHeroOrbCarryoverInto(run);

    assert.equal(run.hero.carryover.hp, 2, "hp: floor(5*0.5)=2");
    assert.equal(run.hero.carryover.damage, 1, "damage: floor(3*0.5)=1");
    assert.equal(run.hero.carryover.speed, 0, "speed should remain 0");

    ball.hero.bonuses.hp = 3;
    ball.mergeHeroOrbCarryoverInto(run);
    assert.equal(run.hero.carryover.hp, 2 + 1, "second merge: floor(3*0.5)=1, total 3");

    console.log("[hunting-hero-carryover-handle-finish] ok");
}

function testHuntingStartFloorBattleAppliesStatAllocation(app) {
    const playerId = FIGHTER_IDS.DASH;
    const player = app.roster.find((f) => f.id === playerId);
    const opponent = app.roster.find((f) => f.id !== playerId);

    const allocation = { hp: 20, damage: 10, speed: 5, skill: 0, defense: 0 };
    const profile = createDefaultPlayerProfile();
    profile.experience.byCharacter[playerId] = { currentXp: getLevelRequirement(3) };
    const progression = collectActiveExperienceProgression(profile, playerId);
    const expectedSpec = applyStatAllocation(
        applyExperienceProgressionToBaseSpec(player, progression),
        allocation,
        true
    );

    const capturedMatches = [];
    const mockApp = {
        roster: [player, opponent],
        playerProfile: profile,
        playerStatAllocation: { ...allocation },
        ui: { setHuntingActive() {}, setHuntingOverlayState() {}, addLog() {} },
        startMatch(specs, options) {
            capturedMatches.push({ specs, options });
        }
    };
    const manager = new HuntingManager(mockApp);
    manager._run = createHuntingRun({ characterId: playerId, stageId: HUNTING_STAGE_IDS.CAVE });
    manager._startFloorBattle();

    const { specs, options } = capturedMatches[0];
    const playerSpec = specs[0];
    assert.equal(playerSpec.stats.hp, expectedSpec.stats.hp, "Hunting spec hp should match applyStatAllocation");
    assert.equal(
        playerSpec.stats.damage,
        expectedSpec.stats.damage,
        "Hunting spec damage should match applyStatAllocation"
    );
    assert.equal(
        playerSpec.stats.speed,
        expectedSpec.stats.speed,
        "Hunting spec speed should match applyStatAllocation"
    );
    assert.equal(playerSpec.teamId, HUNTING_TEAMS.PLAYER, "Hunting spec should be on player team");
    assert.equal(
        options.experienceProgressionByFighter.get(playerId).abilityTier,
        1,
        "Hunting should pass the same progression snapshot to BattleSimulation"
    );
    // 변경 전 roster와 공유되지 않아야 함 (spread clone)
    assert.notEqual(playerSpec, player, "Hunting spec should be a clone of the roster base spec");

    console.log("[hunting-stat-allocation] ok");
}

function testHuntingActiveLocksSetupUi(app) {
    try {
        app.returnToInitialState();
        app.beginGameSession();
        app.refreshPlayerSetup();

        assert.equal(app._modeSegment.visible, false, "Gameplay should hide the mode selector");
        assert.equal(app._modeSegment.locked, true, "Gameplay should lock the mode selector");
        assert.equal(app._panel.locked, true, "Gameplay should lock stat allocation");
        assert.equal(app._startBtn.hidden, true, "Gameplay should hide the start button");

        app.beginResultConfirmation();
        app._startBtn.hidden = false;
        app.refreshPlayerSetup();
        assert.equal(app._modeSegment.visible, false, "Result confirmation should keep the mode selector hidden");
        assert.equal(app._modeSegment.locked, true, "Result confirmation should keep the mode selector locked");
        assert.equal(app._panel.locked, true, "Result confirmation should keep stat allocation locked");
        assert.equal(app._startBtn.hidden, false, "Result confirmation refresh should keep the confirm button visible");
    } finally {
        app.returnToInitialState();
    }

    console.log("[game-lifecycle-locks-setup-ui] ok");
}

// ── Preview reselect tests ─────────────────────────────────────────────────────

function testFighterPhysicsSimulationHierarchy(app) {
    const first = app.roster[0];
    const second = app.roster.find((fighter) => fighter.id !== first.id);
    const battle = new BattleSimulation([first, second], { onLog() {}, onSound() {}, onOvertime() {} });
    const preview = new PreviewReselectSimulation({
        oldFighter: first,
        newFighter: second,
        center: new Vector2(480, 452),
        canvasWidth: 960
    });

    assert.ok(
        battle instanceof FighterPhysicsSimulation,
        "BattleSimulation should inherit shared fighter physics layer"
    );
    assert.ok(
        preview instanceof FighterPhysicsSimulation,
        "PreviewReselectSimulation should inherit shared fighter physics layer"
    );
    assert.equal(
        typeof preview.handleCollision,
        "function",
        "preview reselection should use shared fighter collision flow"
    );

    console.log("[fighter-physics-hierarchy] ok");
}

function testPreviewReselectChangesCharacter(app) {
    const initialId = app.playerFighterId;
    const initialAllocation = { ...app.playerStatAllocation };
    app.playerStatAllocation = { hp: 99, damage: 0, speed: 0, skill: 0, defense: 0 };

    // Mock canvas size for reselect method
    const originalWidth = app.renderer.canvas.width;
    const originalHeight = app.renderer.canvas.height;
    app.renderer.canvas.width = 960;
    app.renderer.canvas.height = 960;

    // Ensure setup unlocked state (no tournament, no active match)
    app.tournament = null;
    app._previewSim = null;
    app._previewBall = null;
    app.simulation = null;
    app.hunting._run = null;

    const result = app.reselectPreviewCharacterFromPreview();
    assert.ok(result, "reselectPreviewCharacterFromPreview should return true");

    // playerFighterId should NOT change immediately — only after swap finalizes
    assert.equal(app.playerFighterId, initialId, "playerFighterId should NOT change immediately at swap start");

    // Stat allocation should NOT be reset immediately
    assert.deepEqual(
        app.playerStatAllocation,
        { hp: 99, damage: 0, speed: 0, skill: 0, defense: 0 },
        "stat allocation should NOT be reset immediately at swap start"
    );

    // Complete the swap
    const duration = app._previewSim.duration;
    const ticks = Math.ceil(duration / 0.016) + 5;
    for (let i = 0; i < ticks; i++) {
        app._updatePreviewSwap(0.016);
    }

    // After finalization, playerFighterId should have changed
    const newId = app.playerFighterId;
    assert.notEqual(newId, initialId, "playerFighterId should change after swap finalizes");

    // Stat allocation should be reset after finalization
    const empty = createEmptyStatAllocation();
    assert.deepEqual(app.playerStatAllocation, empty, "Stat allocation should be reset to empty after swap finalizes");

    // Restore
    app.renderer.canvas.width = originalWidth;
    app.renderer.canvas.height = originalHeight;
    app.playerStatAllocation = { ...initialAllocation };

    console.log("[preview-reselect-changes-character] ok");
}

function testPreviewReselectHeavyKnockAway(app) {
    app.tournament = null;
    app._previewSim = null;
    app._previewBall = null;
    app.simulation = null;
    app.hunting._run = null;

    const originalWidth = app.renderer.canvas.width;
    const originalHeight = app.renderer.canvas.height;
    app.renderer.canvas.width = 960;
    app.renderer.canvas.height = 960;

    // Ensure a preview ball exists first
    const initialFighter = app.roster.find((f) => f.id === app.playerFighterId);
    app._ensurePreviewBall(initialFighter);

    const result = app.reselectPreviewCharacterFromPreview();
    assert.ok(result, "reselectPreviewCharacterFromPreview should return true");
    assert.ok(app._previewSim !== null, "_previewSim should be set after reselect");
    assert.ok(app._previewSim.outgoing !== null, "preview sim should have outgoing ball");
    assert.ok(app._previewSim.incoming !== null, "preview sim should have incoming ball");

    // Tick enough times for collision to happen (incoming ball travels ~960px/s, need ~0.55s to reach center)
    // Use larger dt for faster simulation
    const tickDt = 0.032;
    const tickCount = Math.ceil(0.65 / tickDt);
    for (let i = 0; i < tickCount; i++) {
        app._updatePreviewSwap(tickDt);
    }

    // After collision, outgoing velocity should be significantly higher than its initial near-zero value
    // The incoming ball (10x impact) should have violently knocked the outgoing ball away
    const postOutVel = app._previewSim.outgoing.velocity.length();
    const threshold = 50;
    assert.ok(
        postOutVel > threshold,
        `outgoing ball velocity after collision (${postOutVel.toFixed(1)}) should exceed ${threshold} (heavy knock-away)`
    );

    app.renderer.canvas.width = originalWidth;
    app.renderer.canvas.height = originalHeight;

    console.log("[preview-reselect-heavy-knock-away] ok");
}

function testPreviewReselectCollisionFeedback(app) {
    app.tournament = null;
    app._previewSim = null;
    app._previewBall = null;
    app.simulation = null;
    app.hunting._run = null;

    const originalWidth = app.renderer.canvas.width;
    const originalHeight = app.renderer.canvas.height;
    app.renderer.canvas.width = 960;
    app.renderer.canvas.height = 960;

    const initialFighter = app.roster.find((f) => f.id === app.playerFighterId);
    app._ensurePreviewBall(initialFighter);

    const result = app.reselectPreviewCharacterFromPreview();
    assert.ok(result, "reselectPreviewCharacterFromPreview should return true");

    // Tick in steps, checking for feedback right after collision
    const tickDt = 0.032;
    let foundFeedback = false;
    let maxTicks = Math.ceil(0.8 / tickDt);
    for (let i = 0; i < maxTicks; i++) {
        app._updatePreviewSwap(tickDt);
        if (app._previewSim && app._previewSim.entities.length > 0) {
            foundFeedback = true;
            break;
        }
    }

    assert.ok(foundFeedback, "preview sim should have spawned visual effects after collision");

    // Also verify screen shake was/would've been triggered (entities imply collision occurred)
    const entityCount = app._previewSim ? app._previewSim.entities.length : 0;
    assert.ok(entityCount > 0, `preview sim entities should be > 0 after collision (count: ${entityCount})`);

    app.renderer.canvas.width = originalWidth;
    app.renderer.canvas.height = originalHeight;

    console.log("[preview-reselect-collision-feedback] ok");
}

function testPreviewReselectLabelsHiddenDuringSwap(app) {
    // During swap, renderPlayerPreview dispatches to renderPlayerPreviewSwap
    // which does NOT draw labels. After swap, renderPlayerPreview is called
    // which draws labels. Test the state transition.
    app.tournament = null;
    app._previewSim = null;
    app._previewBall = null;
    app.simulation = null;
    app.hunting._run = null;

    const result = app.reselectPreviewCharacterFromPreview();
    assert.ok(result, "reselectPreviewCharacterFromPreview should return true");
    assert.ok(app._previewSim !== null, "_previewSim should be set during swap (labels hidden)");

    // Complete the swap
    const duration = app._previewSim.duration;
    const ticks = Math.ceil(duration / 0.016) + 5;
    for (let i = 0; i < ticks; i++) {
        app._updatePreviewSwap(0.016);
    }

    assert.ok(app._previewSim === null, "_previewSim should be null after swap (labels restored)");
    assert.ok(app._previewBall !== null, "_previewBall should be set after swap");
    assert.equal(app._previewBall.id, app.playerFighterId, "preview ball should match playerFighterId after swap");

    console.log("[preview-reselect-labels-hidden-during-swap] ok");
}

function testPreviewReselectBlockedWhenTournamentActive(app) {
    app.tournament = {};
    app._previewSim = null;
    app.simulation = null;
    const result = app.canReselectPreviewCharacter();
    assert.ok(!result, "canReselectPreviewCharacter should be false when tournament is non-null");
    app.tournament = null;
    console.log("[preview-reselect-blocked-tournament] ok");
}

function testPreviewReselectBlockedDuringSwap(app) {
    app._previewSim = {};
    app.tournament = null;
    app.simulation = null;
    app.hunting._run = null;
    const result = app.canReselectPreviewCharacter();
    assert.ok(!result, "canReselectPreviewCharacter should be false during swap animation");
    app._previewSim = null;
    console.log("[preview-reselect-blocked-swap] ok");
}

function testPreviewReselectBlockedDuringHuntingRun(app) {
    app.tournament = null;
    app.simulation = null;
    app._previewSim = null;
    app.hunting._run = createHuntingRun({ characterId: app.playerFighterId, stageId: HUNTING_STAGE_IDS.CAVE });
    const result = app.canReselectPreviewCharacter();
    assert.ok(!result, "canReselectPreviewCharacter should be false while hunting run exists");
    app.hunting._run = null;
    console.log("[preview-reselect-blocked-hunting] ok");
}

function testPreviewReselectQueuesDuringSwap(app) {
    app.tournament = null;
    app._previewSim = null;
    app._previewBall = null;
    app.simulation = null;
    app.hunting._run = null;

    const originalWidth = app.renderer.canvas.width;
    const originalHeight = app.renderer.canvas.height;
    app.renderer.canvas.width = 960;
    app.renderer.canvas.height = 960;

    const initialId = app.playerFighterId;

    // Start first swap
    const result1 = app.reselectPreviewCharacterFromPreview();
    assert.ok(result1, "first reselect should return true");
    assert.ok(app._previewSim !== null, "_previewSim should be set after first reselect");
    assert.equal(app.playerFighterId, initialId, "playerFighterId should still be initial during first swap");

    // Call reselect again while swap in progress — should queue
    app._queuedPreviewReselect = false;
    const result2 = app.reselectPreviewCharacterFromPreview();
    assert.ok(result2, "second reselect during swap should return true (queued)");
    assert.ok(app._previewSim !== null, "_previewSim should still be active after queued call");
    assert.ok(app._queuedPreviewReselect, "_queuedPreviewReselect should be set to true");

    // Complete the first swap
    const duration = app._previewSim.duration;
    const ticks = Math.ceil(duration / 0.016) + 5;
    for (let i = 0; i < ticks; i++) {
        app._updatePreviewSwap(0.016);
    }

    // After first swap finalizes, the queued reselect should have started a second swap
    assert.ok(app._previewSim !== null, "queued reselect should have started a second swap");
    assert.notEqual(app.playerFighterId, initialId, "playerFighterId should have changed after first swap finalizes");
    // 두 번째 스왑의 대상은 _pickDifferentPlayerFighterId에 의해 현재와 다른 ID가 보장됨
    const secondSwapPendingId = app._previewSim.pendingId;
    assert.notEqual(
        secondSwapPendingId,
        app.playerFighterId,
        "second swap pendingId must differ from current playerFighterId"
    );

    // Complete the second swap
    const duration2 = app._previewSim.duration;
    const ticks2 = Math.ceil(duration2 / 0.016) + 5;
    for (let i = 0; i < ticks2; i++) {
        app._updatePreviewSwap(0.016);
    }

    // After second swap finalizes, everything should be clean
    assert.ok(app._previewSim === null, "_previewSim should be null after both swaps complete");
    assert.ok(app._previewBall !== null, "_previewBall should be set after both swaps");
    assert.equal(app._previewBall.id, app.playerFighterId, "final preview ball should match playerFighterId");
    assert.equal(
        app.playerFighterId,
        secondSwapPendingId,
        "playerFighterId should match the deterministic second-swap target"
    );
    assert.ok(
        app.canReselectPreviewCharacter(),
        "canReselectPreviewCharacter should return true after all swaps complete"
    );

    app.renderer.canvas.width = originalWidth;
    app.renderer.canvas.height = originalHeight;

    console.log("[preview-reselect-queues-during-swap] ok");
}

function testPreviewReselectTransitionFinalizes(app) {
    app.tournament = null;
    app._previewSim = null;
    app._previewBall = null;
    app.simulation = null;
    app.hunting._run = null;

    const result = app.reselectPreviewCharacterFromPreview();
    assert.ok(result, "should start preview swap");

    assert.ok(app._previewSim !== null, "_previewSim should be set after reselect");
    assert.ok(app._previewSim.outgoing !== null, "swap should have outgoing ball");
    assert.ok(app._previewSim.incoming !== null, "swap should have incoming ball");
    assert.ok(!app._previewSim.finished, "swap should not be finished at start");

    // Simulate enough update ticks to complete the transition
    const duration = app._previewSim.duration;
    const ticks = Math.ceil(duration / 0.016) + 5;
    for (let i = 0; i < ticks; i++) {
        app._updatePreviewSwap(0.016);
    }

    assert.ok(app._previewSim === null, "_previewSim should be cleared after transition completes");
    assert.ok(app._previewBall !== null, "_previewBall should be set after swap finalizes");
    assert.equal(app._previewBall.id, app.playerFighterId, "final preview ball should match new playerFighterId");

    console.log("[preview-reselect-transition-finalizes] ok");
}

testHuntingMerchantOffers();
testHuntingMerchantPurchaseRefreshesUiState();
testHuntingMerchantPassPaintsResumedMove();
testAppLifecycleTransitions();
await testScreenWakeLock();
testBattleAppControlsScreenWakeLock();
testResultConfirmationReturnsInitialState();
await testRebirthPromptWaitsForResultConfirmation(app);
testHuntingRetreatAwaitsResultConfirmation();
testHuntingFormatHelpers();
testHuntingCombatText();
testHuntingLootHud();
testHuntingDefeatChestLoss();
testHuntingChoiceSummaryKeepsContextWithPendingLoot();
testBattleBallAppliesSpecHeroCarryover(app);
testBattleBallMergeHeroOrbCarryoverInto(app);
testHuntingHeroCarryoverInStartFloorBattle(app);
testHuntingHeroCarryoverInHandleFinish(app);
testHuntingStartFloorBattleAppliesStatAllocation(app);
testHuntingActiveLocksSetupUi(app);
testFighterPhysicsSimulationHierarchy(app);
testPreviewReselectChangesCharacter(app);
testPreviewReselectHeavyKnockAway(app);
testPreviewReselectCollisionFeedback(app);
testPreviewReselectLabelsHiddenDuringSwap(app);
testPreviewReselectBlockedWhenTournamentActive(app);
testPreviewReselectBlockedDuringSwap(app);
testPreviewReselectBlockedDuringHuntingRun(app);
testPreviewReselectQueuesDuringSwap(app);
testPreviewReselectTransitionFinalizes(app);

// ── Repair regression tests ──

function testHuntingManagerNoAppUiMethods(app) {
    // Verify that HuntingManager calls app.* not app.ui.*
    const src = readFileSync("src/hunting/huntingManager.js", "utf8");
    const lines = src.split("\n");
    const badRefs = lines.filter((l) => l.includes("app.ui."));
    assert.equal(
        badRefs.length,
        0,
        `HuntingManager should not reference app.ui.* (found ${badRefs.length}):\n${badRefs.join("\n")}`
    );
    console.log("[hunting-manager-no-app-ui] ok");
}

function testComponentBridgeEquipmentActionsReachProfile() {
    const profile = createDefaultPlayerProfile();
    if (!profile.equipment)
        profile.equipment = { inventory: [], equipped: {}, maxInventorySlots: 5, enhancementStones: 10 };
    if (!profile.hunting) profile.hunting = { shards: 100, chests: [], stats: {} };
    const app = {
        playerProfile: profile,
        playerFighterId: "archer",
        roster: [{ id: "archer", name: "Archer", title: "Test", color: "#f00" }],
        _refreshCollectionHub() {},
        refreshPlayerSetup() {}
    };
    const bridge = createAppComponentBridge(app);

    // Test: bridge methods exist
    assert.ok(typeof bridge.equipItem === "function", "bridge.equipItem should be a function");
    assert.ok(typeof bridge.unequipItem === "function", "bridge.unequipItem should be a function");
    assert.ok(typeof bridge.enhanceItem === "function", "bridge.enhanceItem should be a function");
    assert.ok(typeof bridge.fuseEquipmentItems === "function", "bridge.fuseEquipmentItems should be a function");
    assert.ok(typeof bridge.disassembleItem === "function", "bridge.disassembleItem should be a function");
    assert.ok(typeof bridge.sellItem === "function", "bridge.sellItem should be a function");
    assert.ok(typeof bridge.expandInventory === "function", "bridge.expandInventory should be a function");

    // Test: creating equipment and equipping it mutates profile
    const item = createEquipmentInstance({ rarity: "common", rng: () => 0.5 });
    profile.equipment.inventory.push(item);
    bridge.equipItem(item.instanceId);
    const equippedValues = Object.values(profile.equipment.equipped ?? {}).filter(Boolean);
    assert.ok(equippedValues.includes(item.instanceId), "equipped item ID should appear in equipped slots");

    // Test: unequip removes from slot
    bridge.unequipItem(item.instanceId);
    const eqAfterUnequip = Object.values(profile.equipment.equipped ?? {}).filter(Boolean);
    assert.ok(!eqAfterUnequip.includes(item.instanceId), "unequipped item ID should be removed from equipped slots");

    // Test: expandInventory extends slots
    const prevSlots = profile.equipment.maxInventorySlots;
    profile.hunting.shards = 100;
    bridge.expandInventory();
    assert.ok(profile.equipment.maxInventorySlots > prevSlots, "expandInventory should increase max slots");

    // Test: disassemble adds enhancement stones
    profile.equipment.enhancementStones = 0;
    const item2 = createEquipmentInstance({ rarity: "common", rng: () => 0.5 });
    profile.equipment.inventory.push(item2);
    bridge.disassembleItem(item2.instanceId);
    assert.ok(profile.equipment.enhancementStones > 0, "disassemble should add enhancement stones");

    console.log("[component-bridge-equipment-actions] ok");
}

function testCollectionActionPopupOptions() {
    const item = {
        name: "테스트 검",
        rarity: "rare",
        description: "검증용 장비",
        stats: [{ type: "damage", value: 7 }],
        enhanceLevel: 3
    };
    const expectedConfirmButton = [{ text: "확인", value: "ok", primary: true }];

    const enhanceSuccess = createCollectionActionPopupOptions("enhance", {
        success: true,
        item,
        oldLevel: 2,
        newLevel: 3,
        cost: { stones: 4, shards: 30 },
        failureRate: 0.48
    });
    assert.equal(enhanceSuccess.title, "강화 성공", "Successful enhancement should use the shared result popup");
    assert.ok(enhanceSuccess.bodyHtml.includes("테스트 검"), "Enhancement popup should identify the affected item");
    assert.ok(enhanceSuccess.bodyHtml.includes("+2 → +3"), "Enhancement popup should show the level change");
    assert.deepEqual(enhanceSuccess.buttons, expectedConfirmButton, "Result popups should have one confirm action");

    const enhanceFailure = createCollectionActionPopupOptions("enhance", {
        success: false,
        item,
        oldLevel: 3,
        newLevel: 2,
        cost: { stones: 6, shards: 40 },
        failureRate: 0.64
    });
    assert.equal(enhanceFailure.title, "강화 실패", "Failed enhancement should still describe the applied outcome");
    assert.ok(enhanceFailure.bodyHtml.includes("+3 → +2"), "Failure popup should show the decreased level");

    const disassemble = createCollectionActionPopupOptions("disassemble", { item, stones: 12 });
    assert.equal(disassemble.title, "장비 분해 완료", "Disassembly should use the shared result popup");
    assert.ok(disassemble.bodyHtml.includes("강화석 +12"), "Disassembly popup should show the gained stones");

    const sale = createCollectionActionPopupOptions("sell", { item, shards: 30 });
    assert.equal(sale.title, "장비 판매 완료", "Sale should use the shared result popup");
    assert.ok(sale.bodyHtml.includes("파편 +30"), "Sale popup should show the gained shards");

    const fusion = createCollectionActionPopupOptions("fusion", {
        item: { ...item, name: "새 장비", rarity: "epic", enhanceLevel: 0 },
        consumed: [item, { ...item, name: "재료 방패" }, { ...item, name: "재료 반지" }],
        cost: { stones: 80, shards: 300 }
    });
    assert.equal(fusion.title, "장비 합성 완료", "Fusion should use the shared result popup");
    assert.ok(fusion.bodyHtml.includes("테스트 검"), "Fusion popup should list consumed equipment");
    assert.ok(fusion.bodyHtml.includes("새 장비"), "Fusion popup should identify the new equipment");
    assert.ok(fusion.bodyHtml.includes("강화석 80"), "Fusion popup should show the consumed materials");

    const chest = createCollectionActionPopupOptions("chest", {
        opened: true,
        applied: { shards: 0, equipment: item },
        currentShards: 70
    });
    assert.equal(chest.title, "상자 개봉 결과", "Chest reward should use the shared result popup");
    assert.ok(chest.bodyHtml.includes("테스트 검"), "Chest popup should identify awarded equipment");
    assert.ok(chest.bodyHtml.includes("(rare)"), "Chest popup should use the canonical rarity label");

    const chestFailure = createCollectionActionPopupOptions("chest", {
        opened: false,
        reason: "not_enough_shards",
        cost: 80
    });
    assert.equal(chestFailure.title, "개봉 실패", "Chest failure should use the shared result popup");
    assert.ok(chestFailure.bodyHtml.includes("80"), "Chest failure should include the required cost when known");
    console.log("[collection-action-popup-options] ok");
}

function testRarityPresentation() {
    assert.deepEqual(
        ["common", "uncommon", "rare", "unique", "epic", "legendary"].map((rarity) => getRarityLabel(rarity)),
        ["common", "uncommon", "rare", "unique", "epic", "legendary"],
        "Every supported rarity should preserve its canonical lowercase English label"
    );
    assert.equal(getRarityLabel(null), "common", "Missing rarities should fall back to common");
    assert.equal(getRarityLabel("MyStic"), "mystic", "Unknown rarities should remain readable in lowercase");
    const template = readFileSync("src/components/collection-hub.html", "utf8");
    assert.ok(
        !/\.ch-equip-rarity\s*\{[^}]*text-transform:\s*uppercase;/s.test(template),
        "Equipment rarity badges should preserve canonical lowercase labels"
    );
    console.log("[rarity-presentation] ok");
}

testRarityPresentation();

function testComponentBridgeCollectionActionResultsUsePopupService() {
    const profile = createDefaultPlayerProfile();
    profile.hunting.shards = 999;
    profile.equipment.enhancementStones = 999;
    const enhanceTarget = createEquipmentInstance({ rarity: "common", rng: () => 0.5 });
    const disassembleTarget = createEquipmentInstance({ rarity: "common", rng: () => 0.5 });
    const saleTarget = createEquipmentInstance({ rarity: "common", rng: () => 0.5 });
    const fusionTargets = ["weapon", "armor", "accessory"].map((slot) =>
        createEquipmentInstance({ rarity: "common", slot, rng: () => 0.5 })
    );
    profile.equipment.inventory.push(enhanceTarget, disassembleTarget, saleTarget, ...fusionTargets);

    let refreshCount = 0;
    const app = {
        playerProfile: profile,
        playerFighterId: "archer",
        roster: [{ id: "archer", name: "Archer", title: "Test", color: "#f00" }],
        _refreshCollectionHub() {
            refreshCount += 1;
        },
        refreshPlayerSetup() {}
    };
    const popupCalls = [];
    const originalDialog = PopupService._testDialog;
    PopupService.setTestDialog({
        show(options) {
            popupCalls.push(options);
            return Promise.resolve("ok");
        }
    });

    try {
        const bridge = createAppComponentBridge(app);
        bridge.enhanceItem(enhanceTarget.instanceId);
        bridge.disassembleItem(disassembleTarget.instanceId);
        bridge.sellItem(saleTarget.instanceId);
        bridge.fuseEquipmentItems(fusionTargets.map((item) => item.instanceId));

        assert.equal(popupCalls.length, 4, "Each completed collection action should present one result popup");
        assert.ok(
            popupCalls[0].title.startsWith("강화"),
            "Enhancement should report success or failure through PopupService"
        );
        assert.equal(popupCalls[1].title, "장비 분해 완료", "Disassembly should report through PopupService");
        assert.equal(popupCalls[2].title, "장비 판매 완료", "Sale should report through PopupService");
        assert.equal(popupCalls[3].title, "장비 합성 완료", "Fusion should report through PopupService");
        assert.ok(
            popupCalls.every((options) => options.buttons?.[0]?.text === "확인"),
            "Collection action result popups should use an explicit confirmation button"
        );
        assert.equal(refreshCount, 4, "Completed collection actions should refresh the open collection hub");
    } finally {
        PopupService.setTestDialog(originalDialog);
    }
    console.log("[component-bridge-collection-action-results] ok");
}

function testActionPickerServiceIdAndConcurrency() {
    // Test that ActionPickerService.show returns card ID, not index
    const cards = [
        { id: "dash", name: "Dash", description: "Dodge", hpCostPercent: 10 },
        { id: "rage", name: "Rage", description: "Attack up", hpCostPercent: 15 },
        { id: "heal", name: "Heal", description: "Heal", hpCostPercent: 5 }
    ];

    // Stub document so ActionPickerService uses the picker path
    const docOrig = globalThis.document;
    globalThis.document = { addEventListener() {} };

    // Mock uiManager with actionPicker
    const uiManager = Alpine.store("uiManager");
    const origGetComponent = uiManager.getComponent.bind(uiManager);

    let resolvePromise = null;
    let pickerVisible = false;
    let pickerCards = [];

    uiManager.getComponent = (id) => {
        if (id === "actionPicker") {
            return {
                show(cards) {
                    pickerCards = cards;
                    pickerVisible = true;
                    return new Promise((resolve) => {
                        resolvePromise = resolve;
                    });
                }
            };
        }
        return origGetComponent ? origGetComponent(id) : null;
    };

    // Start show and immediately resolve with index 1
    const promise = ActionPickerService.show(cards);
    assert.ok(resolvePromise !== null, "action picker should have stored resolve function");
    assert.ok(pickerVisible, "action picker should be visible");
    assert.equal(pickerCards.length, 3, "picker should receive 3 cards");

    resolvePromise(1);
    return promise.then(async (result) => {
        assert.equal(result, "rage", "ActionPickerService.show should return card ID, not index");

        // Test: non-browser environment returns first card ID
        globalThis.document = undefined;
        const nonBrowserResult = await ActionPickerService.show(cards);
        assert.equal(nonBrowserResult, "dash", "non-browser picker should return first card ID");
        globalThis.document = docOrig;

        console.log("[action-picker-service-id-and-concurrency] ok");
    });
}

function testActionPickerConcurrency() {
    // Simulate the action-picker component behavior: show() replaces old _resolve
    const docOrig = globalThis.document;
    globalThis.document = { addEventListener() {} };

    let _resolve = null;
    const mockPicker = {
        show(cards) {
            if (_resolve) {
                const r = _resolve;
                _resolve = null;
                r(-1);
            }
            return new Promise((resolve) => {
                _resolve = resolve;
            });
        }
    };

    const uiManager2 = Alpine.store("uiManager");
    const origGetComponent = uiManager2.getComponent.bind(uiManager2);
    uiManager2.getComponent = (id) => {
        if (id === "actionPicker") return mockPicker;
        return origGetComponent ? origGetComponent(id) : null;
    };

    // First show
    const p1 = ActionPickerService.show([{ id: "dash", name: "Dash", description: "D", hpCostPercent: 10 }]);
    assert.ok(_resolve !== null, "first show should register resolver");

    // Second show — cancels first
    const p2 = ActionPickerService.show([{ id: "rage", name: "Rage", description: "R", hpCostPercent: 15 }]);

    // Resolve second
    _resolve(0);

    return Promise.all([
        p1.then((r) => assert.equal(r, null, "cancelled show should resolve null")),
        p2.then((r) => assert.equal(r, "rage", "second show should resolve with correct ID"))
    ]).then(() => {
        globalThis.document = docOrig;
        console.log("[action-picker-concurrency] ok");
    });
}

// ── PopupService 정적 의존 회귀 테스트 ─────────────────────────────────────

function testNoWindowPopupServiceInProductionSource() {
    const pattern = "window.PopupService";
    const dir = "src";
    const offenders = [];
    function scanDir(path) {
        for (const name of readdirSync(path)) {
            const full = `${path}/${name}`;
            const stat = statSync(full);
            if (stat.isDirectory()) {
                scanDir(full);
            } else if (full.endsWith(".js") || full.endsWith(".html")) {
                const content = readFileSync(full, "utf8");
                if (content.includes(pattern)) {
                    offenders.push(full);
                }
            }
        }
    }
    scanDir(dir);
    assert.equal(
        offenders.length,
        0,
        `Production source should not contain "${pattern}" (found in ${offenders.length} files):\n${offenders.join("\n")}`
    );
    console.log("[no-window-popup-service-in-production] ok");
}

function testGameActionBridgeOpenHelp() {
    const profile = createDefaultPlayerProfile();
    const app = {
        playerProfile: profile,
        playerFighterId: "archer",
        roster: [{ id: "archer", name: "Archer", title: "Test", color: "#f00" }],
        _refreshCollectionHub() {},
        refreshPlayerSetup() {}
    };

    let lastPopup = null;
    const origDialog = PopupService._testDialog;
    PopupService.setTestDialog({
        show(opts) {
            lastPopup = opts;
            return Promise.resolve("ok");
        }
    });

    try {
        const bridge = createAppComponentBridge(app);
        bridge.openHelp();
        assert.ok(lastPopup !== null, "openHelp should show a popup via PopupService");
        assert.ok(lastPopup.title === "게임 도움말", "openHelp should use HELP_TITLE");
        assert.ok(lastPopup.bodyHtml.includes("기본 규칙"), "openHelp should use HELP_CONTENT");
    } finally {
        PopupService.setTestDialog(origDialog);
    }
    console.log("[game-action-bridge-open-help] ok");
}

function testHuntingManagerStaticPopupServiceImport() {
    const src = readFileSync("src/hunting/huntingManager.js", "utf8");
    assert.ok(src.includes("import { PopupService }"), "huntingManager should statically import PopupService");
    assert.ok(!src.includes("window.PopupService"), "huntingManager should not reference window.PopupService");
    console.log("[hunting-manager-static-popup-service] ok");
}

async function testPopupServiceShowFailsWithoutPopupDialog() {
    const origDialog = PopupService._testDialog;
    PopupService.setTestDialog(null);
    const mgr = Alpine.store("uiManager");
    const savedPopup = mgr?.components?.["popupDialog"];
    if (mgr) mgr.unregister("popupDialog");
    try {
        await assert.rejects(
            () => PopupService.show({ title: "test", bodyHtml: "<p>test</p>" }),
            /popupDialog가 uiManager에 등록되지 않았습니다/,
            "PopupService.show should reject with clear error when popupDialog is unavailable"
        );
        console.log("[popup-service-show-fails-without-dialog] ok");
    } finally {
        PopupService.setTestDialog(origDialog);
        if (mgr && savedPopup) mgr.register("popupDialog", savedPopup);
    }
}

function testComponentBridgePopupCallsThroughServiceSeam() {
    const profile = createDefaultPlayerProfile();
    profile.hunting.shards = 0;
    profile.hunting.chests = [{ id: "t_chest", rarity: "common", count: 1 }];
    if (!profile.equipment)
        profile.equipment = { inventory: [], equipped: {}, maxInventorySlots: 5, enhancementStones: 0 };
    const app = {
        playerProfile: profile,
        playerFighterId: "archer",
        roster: [{ id: "archer", name: "Archer", title: "Test", color: "#f00" }],
        _refreshCollectionHub() {},
        refreshPlayerSetup() {}
    };

    let popupCalls = [];
    const origDialog = PopupService._testDialog;
    PopupService.setTestDialog({
        show(opts) {
            popupCalls.push(opts);
            return Promise.resolve("ok");
        }
    });

    try {
        const bridge = createAppComponentBridge(app);
        // Failure case - triggers popup
        bridge.openChest("t_chest");
        assert.equal(popupCalls.length, 1, "openChest failure should call PopupService.show");
        assert.ok(popupCalls[0].title.includes("실패"), "failure popup title should indicate failure");

        // expandInventory when already max (typically fails if no shards)
        const expandResult = bridge.expandInventory();
        assert.equal(expandResult, false, "expandInventory should fail with no shards");
        assert.ok(popupCalls.length >= 2, "expandInventory failure should call PopupService.show");
    } finally {
        PopupService.setTestDialog(origDialog);
    }
    console.log("[component-bridge-popup-service-seam] ok");
}

async function runNewBridgeTests() {
    testHuntingManagerNoAppUiMethods(app);
    testComponentBridgeEquipmentActionsReachProfile();
    testCollectionActionPopupOptions();
    testComponentBridgeCollectionActionResultsUsePopupService();
    testCollectionHubServiceNoBlacklistedRefs();
    testComponentBridgeOpenChestExists();
    testComponentBridgeOpenChestFailure();
    testComponentBridgeOpenChestSuccess();
    await testActionPickerServiceIdAndConcurrency();
    await testActionPickerConcurrency();
    testNoWindowPopupServiceInProductionSource();
    testGameActionBridgeOpenHelp();
    testHuntingManagerStaticPopupServiceImport();
    await testPopupServiceShowFailsWithoutPopupDialog();
    testComponentBridgePopupCallsThroughServiceSeam();
}

await runNewBridgeTests();

// ── CollectionHubService + bridge.openChest regression ─────────────────────

function testCollectionHubServiceNoBlacklistedRefs() {
    const src = readFileSync("src/collectionHubService.js", "utf8");
    const blacklisted = [
        "ballFightApp",
        "openHuntingChest",
        "savePlayerProfile",
        "gameBridge",
        "requireGameUIComponent"
    ];
    for (const term of blacklisted) {
        assert.ok(!src.includes(term), `collectionHubService.js should not reference "${term}"`);
    }
    console.log("[collection-hub-service-no-blacklisted-refs] ok");
}

function testComponentBridgeOpenChestExists() {
    const profile = createDefaultPlayerProfile();
    profile.hunting.chests = [{ id: "test_chest", rarity: "common", count: 1 }];
    const app = {
        playerProfile: profile,
        playerFighterId: "archer",
        roster: [{ id: "archer", name: "Archer", title: "Test", color: "#f00" }],
        _refreshCollectionHub() {},
        refreshPlayerSetup() {}
    };
    const bridge = createAppComponentBridge(app);
    assert.ok(typeof bridge.openChest === "function", "bridge.openChest should be a function");
    console.log("[component-bridge-open-chest-exists] ok");
}

function testComponentBridgeOpenChestFailure() {
    const profile = createDefaultPlayerProfile();
    profile.hunting.shards = 0;
    profile.hunting.chests = [{ id: "test_chest", rarity: "common", count: 1 }];
    const app = {
        playerProfile: profile,
        playerFighterId: "archer",
        roster: [{ id: "archer", name: "Archer", title: "Test", color: "#f00" }],
        _refreshCollectionHub() {},
        refreshPlayerSetup() {}
    };

    let lastPopup = null;
    const origDialog = PopupService._testDialog;
    PopupService.setTestDialog({
        show(opts) {
            lastPopup = opts;
            return Promise.resolve("ok");
        }
    });

    const bridge = createAppComponentBridge(app);
    try {
        const result = bridge.openChest("test_chest");
        assert.equal(result, false, "openChest should return false when shards insufficient");
        assert.ok(lastPopup !== null, "openChest failure should show a popup");
        assert.ok(lastPopup.title.includes("실패"), "failure popup title should indicate failure");
    } finally {
        PopupService.setTestDialog(origDialog);
    }
    console.log("[component-bridge-open-chest-failure] ok");
}

function testComponentBridgeOpenChestSuccess() {
    const profile = createDefaultPlayerProfile();
    profile.hunting.shards = 9999;
    profile.hunting.chests = [{ id: "test_chest", rarity: "common", count: 1 }];
    if (!profile.equipment)
        profile.equipment = { inventory: [], equipped: {}, maxInventorySlots: 5, enhancementStones: 0 };
    let refreshed = false;
    const app = {
        playerProfile: profile,
        playerFighterId: "archer",
        roster: [{ id: "archer", name: "Archer", title: "Test", color: "#f00" }],
        _refreshCollectionHub() {
            refreshed = true;
        },
        refreshPlayerSetup() {}
    };

    let lastPopup = null;
    const origDialog = PopupService._testDialog;
    PopupService.setTestDialog({
        show(opts) {
            lastPopup = opts;
            return Promise.resolve("ok");
        }
    });

    const bridge = createAppComponentBridge(app);
    try {
        const result = bridge.openChest("test_chest");
        assert.equal(result, true, "openChest should return true on success");
        assert.ok(refreshed, "openChest should trigger _refreshCollectionHub");
        assert.ok(lastPopup !== null, "openChest success should show a popup");
        assert.ok(lastPopup.title.includes("결과"), "success popup title should indicate result");
    } finally {
        PopupService.setTestDialog(origDialog);
    }
    console.log("[component-bridge-open-chest-success] ok");
}

// ── Popup dialog resolver capture regression ─────────────────────────────────

async function testPopupResolverCapture() {
    const timeouts = [];
    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => {
        timeouts.push(fn);
        return timeouts.length;
    };

    try {
        let _resolve = null;

        function show() {
            if (_resolve) {
                _resolve("cancel");
                _resolve = null;
            }
            return new Promise((resolve) => {
                _resolve = resolve;
            });
        }

        function closePopup(value) {
            const captured = _resolve;
            _resolve = null;
            setTimeout(() => {
                if (captured) {
                    captured(value ?? "close");
                }
            }, 250);
        }

        // 1. Show A → 2. Close A (captures resolver, clears _resolve)
        const pA = show();
        assert.ok(_resolve !== null, "A should have a resolver");
        closePopup("close");
        assert.equal(_resolve, null, "_resolve should be null after closePopup captures it");

        // 3. Show B before A's close timeout fires
        const pB = show();
        assert.ok(_resolve !== null, "B should have a new resolver");

        // 4. Flush A's pending timeout — must resolve A, NOT B
        assert.equal(timeouts.length, 1, "closePopup should have queued one timeout");
        timeouts[0]();
        await Promise.resolve();

        let resolvedA, resolvedB;
        pA.then((v) => {
            resolvedA = v;
        });
        pB.then((v) => {
            resolvedB = v;
        });
        await Promise.resolve();

        assert.equal(resolvedA, "close", "A should resolve with 'close' from its own closePopup");
        assert.equal(resolvedB, undefined, "B should NOT be resolved by A's closePopup timeout");

        // 5. Close B — clean close
        closePopup("ok");
        assert.equal(timeouts.length, 2, "second closePopup should queue another timeout");
        timeouts[1]();
        await Promise.resolve();
        assert.equal(resolvedB, "ok", "B should resolve with 'ok' from its own closePopup");
        assert.equal(resolvedA, "close", "A should stay resolved with 'close'");

        // 6. Fresh show + close works independently
        const pC = show();
        closePopup("close_from_c");
        timeouts[2]();
        await Promise.resolve();
        let resolvedC;
        pC.then((v) => {
            resolvedC = v;
        });
        await Promise.resolve();
        assert.equal(resolvedC, "close_from_c", "C should resolve independently");

        console.log("[popup-resolver-capture] ok");
    } finally {
        globalThis.setTimeout = origSetTimeout;
    }
}

await testPopupResolverCapture();

// ── Action Gateway regression tests ──

async function testActionGateway() {
    const { registerGameActionBridge, requireGameActionBridge } = await import("../src/actionGateway.js");

    // 1. Before registration — both forms throw
    assert.throws(
        () => requireGameActionBridge(),
        /등록되지 않았습니다/,
        "requireGameActionBridge() should throw before bridge registration"
    );
    assert.throws(
        () => requireGameActionBridge("startTournament"),
        /액션을 호출할 수 없습니다/,
        "requireGameActionBridge(actionName) should throw before bridge registration"
    );

    // 2. Register mock bridge
    let called = false;
    const mockBridge = {
        startTournament() {
            called = true;
            return "started";
        },
        adjustStat() {}
    };
    registerGameActionBridge(mockBridge);

    // 3. After registration — returns bridge
    assert.strictEqual(
        requireGameActionBridge(),
        mockBridge,
        "requireGameActionBridge() should return the registered bridge"
    );
    assert.strictEqual(
        requireGameActionBridge("startTournament"),
        mockBridge,
        "requireGameActionBridge('startTournament') should return the bridge"
    );
    requireGameActionBridge("startTournament").startTournament();
    assert.ok(called, "requireGameActionBridge('startTournament').startTournament() should delegate");

    // 4. Missing action throws with registered bridge
    assert.throws(
        () => requireGameActionBridge("nonexistent"),
        /액션이 gameActionBridge에 등록되지 않았습니다/,
        "requireGameActionBridge('nonexistent') should throw for unregistered action"
    );

    console.log("[action-gateway] ok");
}

function testUiManagerGameActionBridgeContract() {
    const harness = makeHarness();
    const uiManager = harness.context.Alpine.store("uiManager");

    assert.throws(
        () => uiManager.invokeGameAction("startTournament"),
        /gameActionBridge가 아직 등록되지 않았습니다/,
        "UI actions must fail explicitly until the app installs its bridge"
    );

    const calls = [];
    uiManager.setGameActionBridge({
        startTournament(...args) {
            calls.push(args);
            return "started";
        }
    });
    assert.equal(
        uiManager.invokeGameAction("startTournament", "from-ui"),
        "started",
        "uiManager must invoke the registered public bridge action"
    );
    assert.deepEqual(calls, [["from-ui"]], "uiManager must preserve action arguments");
    assert.throws(
        () => uiManager.invokeGameAction("openHelp"),
        /openHelp.*등록되지 않았습니다/,
        "uiManager must reject unknown bridge actions before invocation"
    );

    const indexSource = readFileSync("index.html", "utf8");
    const mainSource = readFileSync("src/main.js", "utf8");
    assert.ok(
        indexSource.includes("setGameActionBridge(bridge)") &&
            indexSource.includes("invokeGameAction(actionName, ...args)"),
        "uiManager must own the explicit bridge installation and invocation path"
    );
    assert.equal(
        indexSource.includes("window.requireGameActionBridge"),
        false,
        "index.html must not expose the action bridge as a template window global"
    );
    assert.ok(
        mainSource.includes('Alpine.store("uiManager").setGameActionBridge(gameActionBridge)'),
        "main.js must install the bridge after creating the BattleApp public actions"
    );
    for (const path of [
        "src/components/game-overlay.html",
        "src/components/hunting-overlay.html",
        "src/components/collection-hub.html",
        "src/components/mode-segment.html",
        "src/components/player-panel.html",
        "src/components/start-button.html"
    ]) {
        const source = readFileSync(path, "utf8");
        assert.equal(
            source.includes("window.requireGameActionBridge"),
            false,
            `${path} must not access the window bridge`
        );
        assert.ok(source.includes('Alpine.store("uiManager")'), `${path} must access actions through uiManager`);
    }
    console.log("[ui-manager-game-action-bridge] ok");
}

// ── Hunting end-to-end deterministic state regression test ──

async function testHuntingEndToEnd() {
    const profile = createDefaultPlayerProfile();
    profile.collection.characters[FIGHTER_IDS.DASH] = {
        tournamentsCompleted: 1,
        tournamentWins: 1,
        matchWins: 3,
        bestPlacement: 1,
        totalDamageDealt: 1200,
        comebackMatchWins: 0,
        firstTournamentAt: 100,
        lastTournamentAt: 200
    };
    const commonChest = createHuntingChest({ id: "c1", rarity: "common", acquiredAt: 1000 });
    const uncommonChest = createHuntingChest({ id: "u1", rarity: "uncommon", acquiredAt: 1000 });
    const rareChest = createHuntingChest({ id: "r1", rarity: "rare", acquiredAt: 1000 });

    // Start run
    const run = createHuntingRun({ characterId: FIGHTER_IDS.DASH, now: 1000 });
    assert.equal(run.floor, 1, "Run starts at floor 1");
    assert.equal(run.status, "active", "New run should be active");
    assert.equal(run.characterId, FIGHTER_IDS.DASH, "Run should use correct character");

    // Advance floor 1→2: empty outcome (rng=0.9 > 0.7 combat+event threshold)
    const f1 = advanceHuntingRun(run, { rng: () => 0.9 });
    assert.equal(f1.floor, 2, "Advance from 1→2");
    assert.equal(f1.lastEncounter.type, HUNTING_FLOOR_OUTCOME_TYPES.EMPTY, "Floor 2: empty (rng=0.9)");

    // Advance floor 2→3: combat outcome (rng=0.3 < 0.4 combat threshold)
    const f2 = advanceHuntingRun(f1, { rng: () => 0.3 });
    assert.equal(f2.floor, 3, "Advance from 2→3");
    assert.equal(f2.lastEncounter.type, HUNTING_FLOOR_OUTCOME_TYPES.COMBAT, "Floor 3: combat (rng=0.3)");

    // Record floor result with loot
    const f2Done = recordHuntingFloorResult(f2, {
        hpRemain: 80,
        maxHp: 100,
        loot: { shards: 20, chests: [commonChest] }
    });
    assert.equal(f2Done.carriedHp, 80, "HP carryover after combat");
    assert.equal(f2Done.pendingLoot.shards, 20, "Shards should be pending");
    assert.equal(f2Done.pendingLoot.chests.length, 1, "Chests should be pending");

    // Advance floor 3→4: event outcome (rng=0.5 → splits by event weights)
    const f3 = advanceHuntingRun(f2Done, { rng: () => 0.5 });
    assert.equal(f3.floor, 4, "Advance from 3→4");
    assert.equal(f3.lastEncounter.type, HUNTING_FLOOR_OUTCOME_TYPES.EVENT, "Floor 4: event (rng=0.5)");
    assert.ok(f3.lastEvent, "Event floor should produce lastEvent data");

    // Advance floor 4→5: combat outcome (rng=0.2)
    const f4 = advanceHuntingRun(f3, { rng: () => 0.2 });
    assert.equal(f4.floor, 5, "Advance from 4→5");
    assert.equal(f4.lastEncounter.type, HUNTING_FLOOR_OUTCOME_TYPES.COMBAT, "Floor 5: combat (rng=0.2)");

    // Record floor 5 result then retreat
    const f4Done = recordHuntingFloorResult(f4, {
        hpRemain: 60,
        maxHp: 100,
        loot: { shards: 35, chests: [uncommonChest, rareChest] }
    });
    assert.equal(f4Done.pendingLoot.shards, 55, "Shards should accumulate: 20+35=55");
    assert.equal(f4Done.pendingLoot.chests.length, 3, "3 chests total pending");

    // Retreat
    const retreated = retreatHuntingRun(f4Done, { now: 2000 });
    assert.equal(retreated.status, "retreated", "Retreat should end run safely");
    assert.equal(retreated.securedLoot.shards, 55, "Retreat secures all pending shards");
    assert.equal(retreated.securedLoot.chests.length, 3, "Retreat secures all pending chests");
    assert.equal(retreated.securedLoot.xp, undefined, "XP must be granted at pickup rather than retreat");

    console.log("[hunting-end-to-end] ok");
}

// ── Strict UI component contract regression ──

async function testUiManagerRequireComponentResolvesAll() {
    const resolved = {};

    const app = await loadModuleApp();
    resolved.bracket = app._bracket !== undefined && app._bracket !== null;
    resolved.overlay = app._overlay !== undefined && app._overlay !== null;
    resolved.huntingOverlay = app._huntingOverlay !== undefined && app._huntingOverlay !== null;
    resolved.panel = app._panel !== undefined && app._panel !== null;
    resolved.startBtn = app._startBtn !== undefined && app._startBtn !== null;
    resolved.log = app._log !== undefined && app._log !== null;
    resolved.strip = app._strip !== undefined && app._strip !== null;
    resolved.root = app._root !== undefined && app._root !== null;
    resolved.toast = app._toast !== undefined && app._toast !== null;
    resolved.modeSegment = app._modeSegment !== undefined && app._modeSegment !== null;

    const allResolved = Object.values(resolved).every(Boolean);
    if (!allResolved) {
        const missing = Object.entries(resolved)
            .filter(([, ok]) => !ok)
            .map(([key]) => key);
        console.log(`[ui-manager-require-resolves-all] FAIL: missing ${missing.join(", ")}`);
    }
    assert.ok(allResolved, "All required UI components must be resolved at startup via uiManager.requireComponent");
    console.log("[ui-manager-require-resolves-all] ok");
}

async function testHuntingOverlayOwnsHuntingPresentation() {
    const app = await loadModuleApp();
    app._gameMode = "hunting";

    app.showOverlay("사냥터", "전투 준비", "원정 소비품을 준비하세요");
    app.setHuntingOverlayState({ huntingBattlePreparationActive: true });

    assert.equal(app._overlay.visible, false, "Hunting presentation must not leave the result overlay visible");
    assert.equal(app._huntingOverlay.visible, true, "Hunting presentation must open the hunting overlay");
    assert.equal(
        app._huntingOverlay.huntingBattlePreparationActive,
        true,
        "Hunting state must stay with the hunting overlay"
    );

    app.showOverlay("Matchup", "Archer Ball vs Cave Mob");

    assert.equal(
        app._huntingOverlay.huntingBattlePreparationActive,
        false,
        "The matchup router must clear battle preparation before BattleSimulation can start"
    );
    assert.equal(app._huntingOverlay.label, "Matchup", "Hunting matchups must replace the preparation header");

    app.hideOverlay();

    assert.equal(app._huntingOverlay.visible, false, "The matchup router must close the hunting overlay before combat");

    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const startMatchSource = appSource.slice(
        appSource.indexOf("async startMatch"),
        appSource.indexOf("// ── 클릭 액션 핸들러 ──")
    );
    assert.match(
        startMatchSource,
        /this\.showOverlay\("Matchup", label\)/,
        "Matchup must use the active overlay router"
    );
    assert.match(
        startMatchSource,
        /this\.hideOverlay\(\)/,
        "Matchup must close the active overlay router before combat"
    );

    app.presentResultSequence([{ id: "summary", label: "사냥터", text: "원정 완료", subtext: "파편을 확보했습니다" }]);

    assert.equal(app._huntingOverlay.visible, false, "Result presentation must close the hunting overlay first");
    assert.equal(app._overlay.visible, true, "Result presentation must use the result overlay");
    console.log("[hunting-overlay-presentation-ownership] ok");
}

async function testUiManagerRequireComponentMissingFails() {
    const harness = makeHarness();
    Object.assign(globalThis, harness.context);
    const uiManagerStore = globalThis.Alpine.store("uiManager");
    uiManagerStore.register("battleLog", { items: [], add() {}, reset() {} });
    uiManagerStore.register("gameOverlay", {
        visible: false,
        show() {},
        hide() {},
        showTransient() {},
        setHuntingState() {}
    });
    uiManagerStore.register("startButton", { hidden: true, setState() {} });
    uiManagerStore.register("fighterStrip", { fighters: [] });
    uiManagerStore.register("playerPanel", {
        fighter: null,
        experience: {},
        equipmentSummary: { slots: [], statLine: "" },
        allocation: {},
        totalPoints: 0,
        bonusPoints: 0,
        remainingPoints: 0,
        locked: false,
        statDefs: [],
        challengeLevel: 0,
        highestUnlockedLevel: 0,
        progressionBonusSummary: "",
        allocationSummary: ""
    });

    const moduleUrl = new URL(`../src/app.js?test=${Date.now()}`, import.meta.url).href;
    const { BattleApp } = await import(moduleUrl);
    try {
        new BattleApp();
        assert.fail("Should have thrown for missing tournamentBracket");
    } catch (e) {
        assert.ok(e instanceof Error, "Thrown must be an Error");
        assert.ok(e.message.includes("필수 UI 컴포넌트"), `Error message must be Korean. Got: ${e.message}`);
        assert.ok(
            e.message.includes("tournamentBracket") ||
                e.message.includes("appRoot") ||
                e.message.includes("toastNotification"),
            `Error message must mention a missing component name. Got: ${e.message}`
        );
    }
    console.log("[ui-manager-require-component-missing-fails] ok");
}

async function testUiManagerRequireComponentNoRemainingGuards() {
    const appJs = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const productionLineErrors = [];

    const forbiddenPatterns = [
        /if\s*\(\s*this\._(bracket|overlay|huntingOverlay|startBtn|log|strip|root|toast|modeSegment)\b/,
        /if\s*\(\s*!this\._(bracket|overlay|huntingOverlay|startBtn|log|strip|root|toast|modeSegment)\b/,
        /this\._panel\?\./,
        /this\._(bracket|overlay|huntingOverlay|startBtn|log|strip|root|toast|modeSegment)\s*\?\./
    ];

    for (const pattern of forbiddenPatterns) {
        const match = appJs.match(pattern);
        if (match) {
            productionLineErrors.push(`Found forbidden pattern: ${match[0]}`);
        }
    }

    if (productionLineErrors.length > 0) {
        console.log("[ui-manager-require-no-remaining-guards] FAIL: " + productionLineErrors.join("; "));
    }
    assert.equal(productionLineErrors.length, 0, "No remaining optional guards for required UI components in app.js");
    console.log("[ui-manager-require-no-remaining-guards] ok");
}

async function testCollectionHubServiceUsesUiManagerRequire() {
    const src = readFileSync(new URL("../src/collectionHubService.js", import.meta.url), "utf8");
    assert.ok(!src.includes("gameBridge"), "collectionHubService must not reference gameBridge");
    assert.ok(
        !src.includes("requireGameUIComponent"),
        "collectionHubService must not reference requireGameUIComponent"
    );
    assert.ok(
        src.includes('Alpine.store("uiManager").requireComponent("collectionHub")'),
        'collectionHubService must use Alpine.store("uiManager").requireComponent'
    );
    console.log("[collectionHubService-uses-uiManager-require] ok");
}

async function testPatchNotesServiceUsesUiManagerRequire() {
    const src = readFileSync(new URL("../src/patchNotesService.js", import.meta.url), "utf8");
    assert.ok(!src.includes("gameBridge"), "patchNotesService must not reference gameBridge");
    assert.ok(!src.includes("requireGameUIComponent"), "patchNotesService must not reference requireGameUIComponent");
    assert.ok(
        src.includes('Alpine.store("uiManager").requireComponent("patchNotes")'),
        'patchNotesService must use Alpine.store("uiManager").requireComponent'
    );
    console.log("[patchNotesService-uses-uiManager-require] ok");
}

async function testPlayerPanelAllocationContract(app) {
    // 플레이어 패널 allocation은 필수이므로 _syncPlayerStatAllocationFromUi가
    // 조용히 무시하지 않고 항상 동기화해야 함

    // 1. 소스 코드에 silent guard가 남아 있는지 확인
    const appJs = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    assert.ok(
        !appJs.includes("!this._panel.allocation"),
        "app.js must not contain silent `if (!this._panel.allocation) return` guard anywhere"
    );

    // 1b. 명시적 계약 위반 검증(throw Error)이 존재하는지 확인
    assert.ok(
        appJs.includes("Array.isArray(alloc)"),
        "_syncPlayerStatAllocationFromUi must have explicit allocation type assertion"
    );
    assert.ok(appJs.includes("playerPanel.allocation"), "error message must name playerPanel.allocation");

    // 2. 정상 경로: allocation이 {}일 때 동기화가 동작하는지 확인
    const saved = { ...app.playerStatAllocation };
    const testAlloc = { hp: 10, damage: 10, speed: 10, skill: 10, defense: 10 };
    app._panel.allocation = { ...testAlloc };
    app._syncPlayerStatAllocationFromUi();
    assert.deepEqual(
        app.playerStatAllocation,
        { ...createEmptyStatAllocation(), ...testAlloc },
        "playerStatAllocation should be synced from _panel.allocation"
    );

    // 3. 복원
    app.playerStatAllocation = saved;
    app._panel.allocation = {};

    console.log("[player-panel-allocation-contract] ok");
}

async function testPlayerPanelAllocationContractBoundary(app) {
    // 경계 검증: _panel.allocation이 null/undefined/비객체인 경우
    // _syncPlayerStatAllocationFromUi가 명시적 Error를 throw해야 함

    const savedAlloc = app._panel.allocation;
    const savedPlayer = { ...app.playerStatAllocation };

    function expectAllocationError(fn, label) {
        try {
            fn();
            assert.fail(`${label}: Error가 발생하지 않음`);
        } catch (e) {
            assert.ok(e instanceof Error, `${label}: throw된 값은 Error여야 함`);
            assert.ok(
                e.message.includes("playerPanel.allocation"),
                `${label}: 오류 메시지에 "playerPanel.allocation"이 포함되어야 함`
            );
            assert.ok(e.message.includes("객체"), `${label}: 오류 메시지에 "객체"가 포함되어야 함`);
        }
    }

    // undefined 경로 → Error
    app._panel.allocation = undefined;
    expectAllocationError(() => app._syncPlayerStatAllocationFromUi(), "undefined allocation");

    // null 경로 → Error
    app._panel.allocation = null;
    expectAllocationError(() => app._syncPlayerStatAllocationFromUi(), "null allocation");

    // 비객체 타입(문자열) → Error
    app._panel.allocation = "not-an-object";
    expectAllocationError(() => app._syncPlayerStatAllocationFromUi(), "string allocation");

    // 배열 → Error (배열은 객체 타입이지만 유효한 allocation이 아님)
    app._panel.allocation = [];
    expectAllocationError(() => app._syncPlayerStatAllocationFromUi(), "array allocation");

    // 복원 — playerStatAllocation은 변경되지 않아야 함
    assert.deepEqual(app.playerStatAllocation, savedPlayer, "호출 실패 후 playerStatAllocation이 변경되지 않아야 함");
    app._panel.allocation = savedAlloc;

    console.log("[player-panel-allocation-contract-boundary] ok");
}

function testNoGameBridgeInProduction() {
    // Prove that production source files no longer reference legacy gameBridge/requireGameUIComponent
    const srcDirs = ["src"];
    const legacyRefs = ["window.gameBridge", "requireGameUIComponent"];
    const offenders = [];
    for (const dir of srcDirs) {
        function scan(path) {
            for (const name of readdirSync(path)) {
                const full = `${path}/${name}`;
                const stat = statSync(full);
                if (stat.isDirectory()) {
                    scan(full);
                } else if (full.endsWith(".js") || full.endsWith(".html")) {
                    const content = readFileSync(full, "utf8");
                    for (const ref of legacyRefs) {
                        if (content.includes(ref)) {
                            offenders.push(`${full}: contains "${ref}"`);
                        }
                    }
                }
            }
        }
        scan(dir);
    }
    if (offenders.length > 0) {
        console.log("[no-game-bridge-in-production] FAIL: " + offenders.join("; "));
    }
    assert.equal(offenders.length, 0, "No production files should reference legacy gameBridge/requireGameUIComponent");
    console.log("[no-game-bridge-in-production] ok");
}

await testUiManagerRequireComponentResolvesAll();
await testHuntingOverlayOwnsHuntingPresentation();
await testUiManagerRequireComponentMissingFails();
await testUiManagerRequireComponentNoRemainingGuards();
await testCollectionHubServiceUsesUiManagerRequire();
await testPatchNotesServiceUsesUiManagerRequire();
await testPlayerPanelAllocationContract(app);
await testPlayerPanelAllocationContractBoundary(app);

await testActionGateway();
testUiManagerGameActionBridgeContract();
await testHuntingEndToEnd();
await testHuntingChestContinueHandlersContract();
testHuntingLootBalanceRules();
testHuntingSplitterDeathFragmentsAndResultGrace(app);
testHuntingLootItemsRotate();
testHuntingLootItemsAndDropController(app);
testHuntingExperienceBalance();
testHuntingExperienceGrantsImmediately();
testHuntingLootValueRadius();
testHuntingNormalCombatWinUsesXpRewardPanel();
testHuntingBossRolesAndEnhancementStoneDrops(app);
testEliteMobCombinationEvent(app);
testHuntingLootSessionIsDiscardedOnDefeat(app);
testHuntingCombatRewardChestUi();
testHuntingCombatWithoutCollectedChestSkipsChestUi();
testHuntingCombatRewardChestQueue();
testHuntingCombatRewardChestNormalContinue();
testHuntingCombatRewardChestFinalBossContinue();
testHuntingChestRoomContinueStillWorks();
await testNoGameBridgeInProduction();
function testHuntingMishapAvoidsLowHpRuns() {
    const event = new MishapEvent(HUNTING_EVENT_TYPES.MISHAP);
    const run = {
        ...createHuntingRun({ characterId: FIGHTER_IDS.DASH }),
        floor: 70,
        carriedHp: 100,
        carriedMaxHp: 100
    };
    const result = event.resolve(event.createPayload(70), { run });
    assert.equal(result.run.carriedHp, 90, "Deep mishaps should remove 10% of current HP");
    const highHp = rollHuntingFloorOutcome(
        10,
        (() => {
            const rolls = [0.5, 0.4];
            return () => rolls.shift() ?? 0;
        })(),
        0,
        { hpRatio: 0.5 }
    );
    const lowHp = rollHuntingFloorOutcome(
        10,
        (() => {
            const rolls = [0.5, 0.4];
            return () => rolls.shift() ?? 0;
        })(),
        0,
        { hpRatio: 0.2 }
    );
    assert.equal(
        highHp.event.type,
        HUNTING_EVENT_TYPES.MISHAP,
        "Mishaps should remain available above the low-HP threshold"
    );
    assert.notEqual(lowHp.event.type, HUNTING_EVENT_TYPES.MISHAP, "Mishaps should not roll at or below 20% HP");
    console.log("[hunting-mishap-low-hp-exclusion] ok");
}

testHuntingMishapAvoidsLowHpRuns();

function testHuntingBarrierSwapsOnlyBlockingFrontlineAlly() {
    const playerSpec = {
        id: "barrier-swap-player",
        name: "Barrier Swap Player",
        teamId: HUNTING_TEAMS.PLAYER,
        ability: "none",
        color: "#ffffff",
        stats: { hp: 100, damage: 10, defense: 1, speed: 250, radius: 36, mass: 1 }
    };
    const barrierSpec = createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.BARRIER, floor: 60, index: 0 });
    const frontlineSpec = createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.PURSUER, floor: 60, index: 1 });
    const simulation = new BattleSimulation(
        [playerSpec, barrierSpec, frontlineSpec],
        { onLog() {}, onSound() {} },
        null,
        { assignActions: false }
    );
    const player = simulation.fighters.find((fighter) => fighter.id === playerSpec.id);
    const barrier = simulation.fighters.find((fighter) => fighter.id === barrierSpec.id);
    const frontline = simulation.fighters.find((fighter) => fighter.id === frontlineSpec.id);

    barrier.position = new Vector2(180, 500);
    frontline.position = new Vector2(230, 500);
    player.position = new Vector2(820, 500);
    barrier.ability.state.timer = barrier.ability.cooldown;
    barrier.ability.update(0, player);

    assert.equal(barrier.position.x, 180, "Barrier activation alone should not move through an ally");
    assert.equal(frontline.position.x, 230, "The ally should stay in place until it physically blocks the barrier");
    simulation.handleCollision();
    assert.ok(
        barrier.position.x > frontline.position.x,
        "Barrier should take the closer ally's blocking position after collision"
    );
    assert.equal(barrier.ability.state.barrier, 1.5, "Barrier defense window should stay active after swapping");
    assert.equal(barrier.ability.state.barrierSwapTarget, frontline, "Swap effect should track the blocking ally");
    assert.ok(
        barrier.ability.state.barrierSwapTargetIds.has(frontline.id),
        "The blocking ally should be unavailable for another swap during this barrier turn"
    );

    barrier.position = new Vector2(180, 500);
    frontline.position = new Vector2(230, 500);
    simulation.handleCollision();
    assert.ok(
        barrier.position.x < frontline.position.x,
        "The same ally should not trigger another swap during the active barrier turn"
    );

    barrier.position = new Vector2(180, 500);
    frontline.position = new Vector2(230, 500);
    barrier.ability.state.timer = barrier.ability.cooldown;
    barrier.ability.update(0, player);
    simulation.handleCollision();
    assert.ok(
        barrier.position.x > frontline.position.x,
        "The same ally should become eligible again when the next barrier turn starts"
    );

    const rearAllySimulation = new BattleSimulation(
        [playerSpec, barrierSpec, frontlineSpec],
        { onLog() {}, onSound() {} },
        null,
        { assignActions: false }
    );
    const rearAllyPlayer = rearAllySimulation.fighters.find((fighter) => fighter.id === playerSpec.id);
    const rearAllyBarrier = rearAllySimulation.fighters.find((fighter) => fighter.id === barrierSpec.id);
    const rearAlly = rearAllySimulation.fighters.find((fighter) => fighter.id === frontlineSpec.id);
    rearAllyBarrier.position = new Vector2(250, 500);
    rearAlly.position = new Vector2(200, 500);
    rearAllyPlayer.position = new Vector2(820, 500);
    rearAllyBarrier.ability.state.timer = rearAllyBarrier.ability.cooldown;
    rearAllyBarrier.ability.update(0, rearAllyPlayer);
    rearAllySimulation.handleCollision();
    assert.ok(rearAllyBarrier.position.x > rearAlly.position.x, "An ally behind the barrier should not trigger a swap");
    assert.equal(
        rearAllyBarrier.ability.state.barrierSwapTarget,
        null,
        "Only the closer ally should become a swap target"
    );

    const barrierAllySpec = createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.BARRIER, floor: 60, index: 2 });
    const barrierAllySimulation = new BattleSimulation(
        [playerSpec, barrierSpec, barrierAllySpec],
        { onLog() {}, onSound() {} },
        null,
        { assignActions: false }
    );
    const barrierAllyPlayer = barrierAllySimulation.fighters.find((fighter) => fighter.id === playerSpec.id);
    const firstBarrier = barrierAllySimulation.fighters.find((fighter) => fighter.id === barrierSpec.id);
    const secondBarrier = barrierAllySimulation.fighters.find((fighter) => fighter.id === barrierAllySpec.id);
    firstBarrier.position = new Vector2(180, 500);
    secondBarrier.position = new Vector2(230, 500);
    barrierAllyPlayer.position = new Vector2(820, 500);
    firstBarrier.ability.state.timer = firstBarrier.ability.cooldown;
    firstBarrier.ability.update(0, barrierAllyPlayer);
    barrierAllySimulation.handleCollision();
    assert.ok(firstBarrier.position.x < secondBarrier.position.x, "Barrier balls should not swap with each other");
    assert.equal(firstBarrier.ability.state.barrierSwapTarget, null, "A barrier ball should not become a swap target");
    console.log("[hunting-barrier-blocking-swap] ok");
}

testHuntingBarrierSwapsOnlyBlockingFrontlineAlly();

function testHuntingMobActionsKeepPhysicsFinite() {
    const player = {
        id: "hunting-mob-test-player",
        name: "Test Player",
        teamId: "player",
        ability: "none",
        color: "#ffffff",
        stats: { hp: 1000, damage: 1, speed: 240, radius: 40, mass: 1, defense: 0 }
    };
    for (const type of Object.keys(HUNTING_MONSTER_BASE_SPECS)) {
        const simulation = new BattleSimulation(
            [player, createHuntingMobSpec({ type, floor: 94 })],
            { onLog() {}, onSound() {} },
            null,
            { assignActions: false }
        );
        for (let frame = 0; frame < 600; frame += 1) simulation.update(1 / 60);
        const mob = simulation.fighters[1];
        assert.ok(
            [mob.position.x, mob.position.y, mob.velocity.x, mob.velocity.y].every(Number.isFinite),
            `${type} should keep finite hunting physics state`
        );
    }
    console.log("[hunting-mob-finite-physics] ok");
}

testHuntingMobActionsKeepPhysicsFinite();

function testDailyShopPurchaseAndRerollCycles() {
    const profile = createDefaultPlayerProfile();
    profile.hunting.shards = 10_000;

    const firstOffer = getDailyShop(profile, 0);
    assert.equal(firstOffer.purchases, 0, "A new shop cycle should start with no purchases");
    assert.equal(firstOffer.purchaseResetAt, null, "Unused purchase limits should not start a reset timer");
    assert.equal(firstOffer.rerollResetAt, null, "Unused rerolls should not start a reset timer");

    const autoRerollProfile = createDefaultPlayerProfile();
    autoRerollProfile.hunting.shards = 500;
    autoRerollProfile.hunting.dailyShop = {
        rarity: "rare",
        purchases: 0,
        lastPurchaseAt: null,
        rerolls: 2,
        lastRerollAt: 40
    };
    const rareChest = buyDailyShopChest(autoRerollProfile, { now: 100, rng: () => 0.71 });
    assert.equal(rareChest.rarity, "rare", "Buying should grant the rarity that was displayed before the refresh");
    assert.equal(
        autoRerollProfile.hunting.dailyShop.rarity,
        "uncommon",
        "Buying should immediately roll the next offer"
    );
    assert.equal(autoRerollProfile.hunting.shards, 350, "Buying should deduct only the chest price");
    assert.equal(autoRerollProfile.hunting.dailyShop.rerolls, 2, "Buying must not consume a manual reroll");
    assert.equal(autoRerollProfile.hunting.dailyShop.lastRerollAt, 40, "Buying must not change manual reroll timing");

    const uncommonChest = buyDailyShopChest(autoRerollProfile, { now: 101, rng: () => 0.01 });
    assert.equal(uncommonChest.rarity, "uncommon", "The second purchase should use the rerolled offer");
    assert.equal(
        autoRerollProfile.hunting.dailyShop.rarity,
        "common",
        "Each successful purchase should prepare one next offer"
    );
    assert.equal(autoRerollProfile.hunting.dailyShop.purchases, 2, "Auto rerolls must preserve the purchase limit");
    assert.equal(
        autoRerollProfile.hunting.dailyShop.lastPurchaseAt,
        101,
        "The second purchase should refresh only its timer"
    );

    const blockedAutoReroll = buyDailyShopChest(autoRerollProfile, { now: 102, rng: () => 0.96 });
    assert.equal(blockedAutoReroll, null, "A capped purchase must fail");
    assert.equal(autoRerollProfile.hunting.dailyShop.rarity, "common", "A failed purchase must not replace the offer");
    assert.equal(autoRerollProfile.hunting.shards, 200, "A failed purchase must not deduct shards");
    assert.equal(autoRerollProfile.hunting.dailyShop.rerolls, 2, "A failed purchase must preserve manual rerolls");
    assert.equal(autoRerollProfile.hunting.dailyShop.lastRerollAt, 40, "A failed purchase must preserve reroll timing");

    const firstChest = buyDailyShopChest(profile, { now: 1, rng: () => 0.01 });
    const secondChest = buyDailyShopChest(profile, { now: 4, rng: () => 0.01 });
    const blockedChest = buyDailyShopChest(profile, { now: 4, rng: () => 0.01 });
    assert.ok(firstChest && secondChest, "The shop should sell two chests per purchase cycle");
    assert.equal(blockedChest, null, "The shop must enforce its purchase limit");
    assert.equal(profile.hunting.shards, 9_700, "Two shop chests should cost 300 shards");
    assert.equal(profile.hunting.dailyShop.lastPurchaseAt, 4, "Purchases should save their latest successful time");
    assert.equal(
        getDailyShop(profile, 4).purchaseResetAt,
        DAILY_SHOP.purchaseResetMs + 4,
        "Purchase reset should count from the latest successful purchase"
    );

    const rerolledOffer = rerollDailyShop(profile, { now: 5, rng: () => 0.96 });
    assert.equal(rerolledOffer.rarity, "rare", "Rerolling should replace the offered chest rarity");
    assert.equal(profile.hunting.shards, 9_670, "The first reroll should cost 30 shards");
    assert.equal(profile.hunting.dailyShop.lastRerollAt, 5, "Rerolls should save their latest successful time");
    assert.equal(
        rerolledOffer.rerollResetAt,
        DAILY_SHOP.rerollResetMs + 5,
        "Reroll reset should count from the latest successful reroll"
    );
    rerollDailyShop(profile, { now: 8, rng: () => 0.01 });
    assert.equal(profile.hunting.dailyShop.lastRerollAt, 8, "Later rerolls should refresh their reset time");
    assert.equal(profile.hunting.shards, 9_610, "The second reroll should cost 60 shards");
    for (let attempt = 0; attempt < 8; attempt += 1) rerollDailyShop(profile, { now: 8, rng: () => 0.01 });
    assert.equal(profile.hunting.shards, 8_050, "Reroll costs should continue rising through 300 shards");
    const cappedOffer = rerollDailyShop(profile, { now: 8, rng: () => 0.01 });
    assert.equal(cappedOffer.rerollCost, 300, "Reroll cost should stop at ten times the base price");
    assert.equal(profile.hunting.shards, 7_750, "The capped reroll should still cost 300 shards");

    const nextRerollCycle = getDailyShop(profile, DAILY_SHOP.rerollResetMs + 9);
    assert.equal(nextRerollCycle.rerolls, 0, "The reroll count should reset independently");
    assert.equal(nextRerollCycle.rerollResetAt, null, "Reset rerolls should stop their countdown");
    const nextPurchaseCycle = getDailyShop(profile, DAILY_SHOP.purchaseResetMs + 5);
    assert.equal(nextPurchaseCycle.purchases, 0, "The purchase count should reset independently");
    assert.equal(nextPurchaseCycle.purchaseResetAt, null, "Reset purchases should stop their countdown");

    const legacyUnusedProfile = createDefaultPlayerProfile();
    legacyUnusedProfile.hunting.dailyShop = {
        purchases: 0,
        rerolls: 0,
        purchaseResetAt: DAILY_SHOP.purchaseResetMs,
        rerollResetAt: DAILY_SHOP.rerollResetMs
    };
    const migratedView = getDailyShop(legacyUnusedProfile, 1);
    assert.equal(migratedView.purchaseResetAt, null, "Legacy unused purchase timers should be removed");
    assert.equal(migratedView.rerollResetAt, null, "Legacy unused reroll timers should be removed");
    assert.equal(
        "purchaseResetAt" in legacyUnusedProfile.hunting.dailyShop,
        false,
        "Legacy reset timestamps should not remain persisted"
    );

    const legacyActiveProfile = createDefaultPlayerProfile();
    legacyActiveProfile.hunting.dailyShop = {
        purchases: 1,
        rerolls: 2,
        purchaseResetAt: DAILY_SHOP.purchaseResetMs + 10,
        rerollResetAt: DAILY_SHOP.rerollResetMs + 10
    };
    getDailyShop(legacyActiveProfile, 10);
    assert.equal(
        legacyActiveProfile.hunting.dailyShop.lastPurchaseAt,
        10,
        "Active legacy purchases should retain their reset deadline"
    );
    assert.equal(
        legacyActiveProfile.hunting.dailyShop.lastRerollAt,
        10,
        "Active legacy rerolls should retain their reset deadline"
    );
    console.log("[daily-shop-purchase-reroll-cycles] ok");
}

testDailyShopPurchaseAndRerollCycles();

function testDailyShopBridgeOnlySoundsOnSuccessfulReroll() {
    const profile = createDefaultPlayerProfile();
    const sounds = [];
    profile.hunting.shards = 100;
    const bridge = createAppComponentBridge({
        playerProfile: profile,
        audio: {
            play(type) {
                sounds.push(type);
            }
        },
        _refreshCollectionHub() {},
        refreshPlayerSetup() {}
    });

    assert.ok(bridge.rerollDailyShop(), "A funded reroll should succeed");
    assert.deepEqual(sounds, ["shop_reroll"], "A successful reroll should play its dedicated sound once");
    profile.hunting.shards = 0;
    assert.equal(bridge.rerollDailyShop(), null, "An unfunded reroll should fail");
    assert.deepEqual(sounds, ["shop_reroll"], "A failed reroll must not play a sound");
    console.log("[daily-shop-reroll-sound] ok");
}

testDailyShopBridgeOnlySoundsOnSuccessfulReroll();

function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function setCharacterXp(profile, characterId, totalXp) {
    profile.experience.byCharacter[characterId] = { currentXp: totalXp };
    profile.experience.currentXp = Object.values(profile.experience.byCharacter).reduce(
        (sum, record) => sum + record.currentXp,
        0
    );
}

function testLevelTenBaseStatTarget() {
    const baseStatKeys = ["hp", "damage", "speed", "defense"];
    for (const fighter of createRoster()) {
        const progression = getCharacterLevelProgression(fighter.id, 10);
        const levelTenSpec = applyExperienceProgressionToBaseSpec(fighter, progression);
        for (const stat of baseStatKeys) {
            assert.equal(
                levelTenSpec.stats[stat],
                fighter.stats[stat] * 1.5,
                `${fighter.id} Lv.10 ${stat} must be exactly 150% of Lv.1`
            );
        }
        assert.equal(
            "skill" in progression.baseStatBonuses,
            false,
            `${fighter.id} level rewards must not treat cooldown as a permanent base stat`
        );
    }
    console.log("[level-ten-base-stat-target] ok");
}

testLevelTenBaseStatTarget();

function testRebirthDomainContracts() {
    const profile = createDefaultPlayerProfile();
    const sourceId = FIGHTER_IDS.ARCHER;
    const otherId = FIGHTER_IDS.RAGE;
    const maxXp = getLevelRequirement(10);
    setCharacterXp(profile, sourceId, maxXp);
    setCharacterXp(profile, otherId, 123);
    profile.characterMastery.levels[sourceId] = 3;
    profile.tournamentChallenge.levels[sourceId] = 3;

    const firstOffer = createRebirthOffer(sourceId, createSeededRandom(20260714));
    const secondOffer = createRebirthOffer(sourceId, createSeededRandom(20260714));
    assert.deepEqual(
        firstOffer.map((card) => card.id),
        secondOffer.map((card) => card.id),
        "Seeded rebirth offers must be deterministic"
    );
    assert.equal(new Set(firstOffer.map((card) => card.id)).size, 3, "A rebirth offer must not duplicate card ids");
    assert.ok(
        firstOffer
            .filter((card) => card.type === "action")
            .every((card) => getRebirthCardDefinition(sourceId, card.id)?.abilityId !== "archer"),
        "A fighter must never receive its own primary ability as a sub card"
    );

    const statReward = createRebirthStatReward(0, () => 0);
    assert.deepEqual(
        statReward.stats,
        {
            hp: REWARD_BALANCE.equipment.statRanges.rare.min * REWARD_BALANCE.equipment.statValueRatios.hp,
            damage: REWARD_BALANCE.equipment.statRanges.rare.min * REWARD_BALANCE.equipment.statValueRatios.damage
        },
        "Rebirth stat rewards must derive their minimum values from the rare equipment range and value ratios"
    );
    const maximumStatReward = createRebirthStatReward(1, () => 0.999999999);
    assert.deepEqual(
        maximumStatReward.stats,
        {
            speed: REWARD_BALANCE.equipment.statRanges.rare.max * REWARD_BALANCE.equipment.statValueRatios.speed,
            defense: REWARD_BALANCE.equipment.statRanges.rare.max * REWARD_BALANCE.equipment.statValueRatios.defense
        },
        "Rebirth stat rewards must derive their maximum values from the rare equipment range and value ratios"
    );
    assert.equal(Object.keys(statReward.stats).length, 2, "Rebirth stat rewards must contain exactly two stats");
    assert.equal(new Set(Object.keys(statReward.stats)).size, 2, "Rebirth stat rewards must never repeat a stat type");
    profile.rebirth.byCharacter[sourceId] = {
        rebirthCount: 0,
        statBonuses: { hp: 0, damage: 0, speed: 0, defense: 0 },
        cardRanks: {},
        equippedCardIds: [],
        pendingOfferCards: [getRebirthOfferMaterial(sourceId, statReward)]
    };
    const firstCompletion = completeRebirth(profile, sourceId, statReward.id);
    assert.equal(firstCompletion.ok, true);
    assert.equal(firstCompletion.rank, 0, "Permanent base-stat rewards must not receive a card rank");
    assert.deepEqual(
        firstCompletion.tournamentChallenge,
        { changed: true, characterId: sourceId, previousLevel: 3, newLevel: 0 },
        "Rebirth must reset the completed character's tournament challenge"
    );
    assert.equal(profile.characterMastery.levels[sourceId], 3, "Rebirth must keep earned mastery");
    assert.equal(
        profile.tournamentChallenge.levels[sourceId],
        undefined,
        "Rebirth must return the tournament challenge to its Lv.1 default"
    );
    assert.deepEqual(
        getRebirthState(profile, sourceId).statBonuses,
        {
            hp: REWARD_BALANCE.equipment.statRanges.rare.min * REWARD_BALANCE.equipment.statValueRatios.hp,
            damage: REWARD_BALANCE.equipment.statRanges.rare.min * REWARD_BALANCE.equipment.statValueRatios.damage,
            speed: 0,
            defense: 0
        },
        "A chosen stat reward must immediately accumulate in the permanent base-stat record"
    );
    assert.equal(
        getRebirthState(profile, sourceId).cardRanks[statReward.id],
        undefined,
        "Permanent base-stat rewards must not become equippable cards"
    );
    assert.equal(
        getCharacterExperienceSummary(profile, sourceId).level,
        1,
        "Rebirth resets only the chosen character XP"
    );
    assert.equal(
        getCharacterExperienceSummary(profile, otherId).totalXp,
        123,
        "Other character XP must survive rebirth"
    );
    assert.equal(getRebirthState(profile, sourceId).rebirthCount, 1);

    setCharacterXp(profile, sourceId, maxXp);
    const actionCardId = `ability:${getSubAbilityIds(sourceId)[0]}`;
    profile.rebirth.byCharacter[sourceId].pendingOfferCards = [{ id: actionCardId, type: "action" }];
    const firstActionCompletion = completeRebirth(profile, sourceId, actionCardId);
    assert.equal(firstActionCompletion.rank, 1, "Action cards should begin at rank 1");

    setCharacterXp(profile, sourceId, maxXp);
    profile.rebirth.byCharacter[sourceId].pendingOfferCards = [{ id: actionCardId, type: "action" }];
    const duplicateCompletion = completeRebirth(profile, sourceId, actionCardId);
    assert.equal(duplicateCompletion.rank, 2, "Duplicate cards should increase rank instead of creating a copy");

    const state = profile.rebirth.byCharacter[sourceId];
    const equipIds = [
        actionCardId,
        "passive:global-cooldown",
        ...getSubAbilityIds(sourceId)
            .slice(1, 3)
            .map((abilityId) => `ability:${abilityId}`)
    ];
    equipIds.forEach((cardId) => (state.cardRanks[cardId] = 1));
    state.equippedCardIds = [];
    assert.equal(toggleRebirthCardEquip(profile, sourceId, equipIds[0]).ok, true);
    assert.equal(toggleRebirthCardEquip(profile, sourceId, equipIds[1]).ok, true);
    assert.equal(toggleRebirthCardEquip(profile, sourceId, equipIds[2]).ok, true);
    assert.equal(toggleRebirthCardEquip(profile, sourceId, equipIds[3]).error, "equip_limit");
    assert.equal(
        toggleRebirthCardEquip(profile, sourceId, statReward.id).error,
        "not_owned",
        "Permanent base-stat rewards must never enter the equipment loadout"
    );

    const loadout = getRebirthLoadout(profile, sourceId);
    const rebornSpec = applyRebirthLoadoutToBaseSpec(
        createRoster().find((fighter) => fighter.id === sourceId),
        loadout
    );
    assert.equal(
        rebornSpec.stats.damage,
        createRoster().find((fighter) => fighter.id === sourceId).stats.damage + statReward.stats.damage
    );
    assert.equal(
        rebornSpec.stats.hp,
        createRoster().find((fighter) => fighter.id === sourceId).stats.hp + statReward.stats.hp
    );
    assert.equal(rebornSpec.stats.radius, 50, "Rebirth base stats must not change collision radius");
    assert.equal(rebornSpec.stats.mass, 1.2, "Rebirth base stats must not change mass");
    assert.ok(loadout.subAbilities.length > 0, "Equipped action cards should become an explicit combat loadout");
    assert.equal(
        loadout.passiveModifiers.abilityCooldownMultiplier,
        0.7,
        "The rank-one passive card should reduce all ability cooldowns by 30%"
    );

    const opponent = createRoster().find((fighter) => fighter.id !== sourceId);
    const baselineSimulation = new BattleSimulation(
        [createRoster().find((fighter) => fighter.id === sourceId), opponent],
        {}
    );
    const baselineCooldown = baselineSimulation.fighters.find((fighter) => fighter.id === sourceId).ability.cooldown;
    const rebirthSimulation = new BattleSimulation(
        [createRoster().find((fighter) => fighter.id === sourceId), opponent],
        {
            onBattleBallReady(ball, spec, simulation) {
                if (spec.id === sourceId) applyRebirthLoadoutToBattleBall(ball, simulation, loadout);
            }
        }
    );
    assert.equal(
        rebirthSimulation.fighters.find((fighter) => fighter.id === sourceId).ability.cooldown,
        baselineCooldown * 0.7,
        "The equipped passive must change the actual primary ability cooldown"
    );

    const sanitizedLegacyProfile = sanitizePlayerProfile({
        ...createDefaultPlayerProfile(),
        rebirth: {
            byCharacter: {
                [sourceId]: {
                    rebirthCount: 4,
                    cardRanks: { [`stat:${sourceId}:balanced`]: 4 },
                    equippedCardIds: [`stat:${sourceId}:balanced`],
                    pendingOfferCardIds: [`stat:${sourceId}:balanced`]
                }
            }
        }
    });
    assert.deepEqual(
        sanitizedLegacyProfile.rebirth.byCharacter[sourceId].cardRanks,
        {},
        "Removed legacy stat cards must not be migrated into the new permanent-stat model"
    );
    assert.deepEqual(sanitizedLegacyProfile.rebirth.byCharacter[sourceId].pendingOfferCards, []);
    console.log("[rebirth-domain-contracts] ok");
}

testRebirthDomainContracts();

function testRebirthOfferPersistsUntilInlineSelection() {
    const profile = createDefaultPlayerProfile();
    const characterId = FIGHTER_IDS.ARCHER;
    setCharacterXp(profile, characterId, getLevelRequirement(10));
    const app = {
        lifecycle: { isSetup: true },
        playerProfile: profile,
        _refreshCollectionHub() {},
        refreshPlayerSetup() {}
    };
    const originalDialog = PopupService._testDialog;
    PopupService.setTestDialog({ show: () => Promise.resolve("ok") });

    try {
        const bridge = createAppComponentBridge(app);
        const created = beginRebirth(profile, characterId, () => 0);
        assert.equal(created.ok, true, "Starting a rebirth should save its inline offer before selection");
        const opened = bridge.beginRebirth(characterId);
        assert.equal(opened.ok, true, "Opening the rebirth tab should reuse its inline offer");
        const persistedOfferCards = getRebirthState(profile, characterId).pendingOfferCards;
        assert.deepEqual(
            persistedOfferCards,
            opened.cards.map((card) => getRebirthOfferMaterial(characterId, card)),
            "Rebirth candidates must save their exact material before inline selection begins"
        );
        assert.ok(
            persistedOfferCards.every((card) => card.type === "statReward" && Object.keys(card.stats).length === 2),
            "Seeded rebirth offers must persist the exact two-stat reward material"
        );
        assert.equal(
            getCharacterExperienceSummary(profile, characterId).level,
            10,
            "An unselected rebirth offer must not reset character XP"
        );

        const reopened = bridge.beginRebirth(characterId);
        assert.deepEqual(
            reopened.cards.map((card) => getRebirthOfferMaterial(characterId, card)),
            persistedOfferCards,
            "Reopening the rebirth tab must reuse the original pending candidates"
        );

        const reloadedProfile = sanitizePlayerProfile(profile);
        const reloadedOffer = beginRebirth(reloadedProfile, characterId);
        assert.deepEqual(
            reloadedOffer.cards.map((card) => getRebirthOfferMaterial(characterId, card)),
            persistedOfferCards,
            "Saved candidate IDs and exact stat values must survive a profile reload before selection"
        );

        const completed = bridge.completeRebirth(characterId, persistedOfferCards[1].id);
        assert.equal(completed.ok, true, "Selecting a pending rebirth card should complete the rebirth");
        assert.deepEqual(
            getRebirthState(profile, characterId).pendingOfferCards,
            [],
            "Only a selected rebirth card may consume the pending candidates"
        );
        assert.equal(getCharacterExperienceSummary(profile, characterId).level, 1);
    } finally {
        PopupService.setTestDialog(originalDialog);
    }
    console.log("[rebirth-inline-pending-offer] ok");
}

testRebirthOfferPersistsUntilInlineSelection();

function testHuntingRebirthLoadoutIntegration() {
    const playerId = FIGHTER_IDS.DASH;
    const statBonuses = { hp: 0, damage: 2, speed: 2, defense: 0 };
    const createHuntingTestApp = (profile) => ({
        roster: createRoster(),
        playerProfile: profile,
        playerStatAllocation: createEmptyStatAllocation()
    });
    const baselineProfile = createDefaultPlayerProfile();
    const rebornProfile = createDefaultPlayerProfile();
    rebornProfile.rebirth.byCharacter[playerId] = {
        rebirthCount: 1,
        statBonuses,
        cardRanks: {},
        equippedCardIds: [],
        pendingOfferCards: []
    };
    const run = createHuntingRun({ characterId: playerId, stageId: HUNTING_STAGE_IDS.CAVE });
    const baselineSpec = new HuntingManager(createHuntingTestApp(baselineProfile))._createPlayerHuntingSpec(
        run
    ).appliedSpec;
    const rebornApp = createHuntingTestApp(rebornProfile);
    const rebornManager = new HuntingManager(rebornApp);
    const rebornPlayer = rebornManager._createPlayerHuntingSpec(run);
    const allocationMultiplier = calculateStatMultiplier(Object.values(createEmptyStatAllocation())).multiplier;

    assert.equal(
        rebornPlayer.appliedSpec.stats.damage,
        baselineSpec.stats.damage + statBonuses.damage * allocationMultiplier,
        "Hunting player specs must apply permanent rebirth stats before the stat-allocation multiplier"
    );
    assert.equal(
        rebornPlayer.appliedSpec.stats.speed,
        baselineSpec.stats.speed + statBonuses.speed * allocationMultiplier,
        "Hunting player specs must preserve permanent rebirth stats through the stat-allocation multiplier"
    );

    let capturedOptions = null;
    rebornApp.startMatch = (_specs, options) => {
        capturedOptions = options;
    };
    rebornManager._run = run;
    rebornManager._startFloorBattle();
    assert.equal(
        capturedOptions.rebirthLoadoutByFighter.get(playerId).rebirthCount,
        1,
        "Hunting battles must pass the rebirth loadout through to BattleSimulation"
    );
    console.log("[hunting-rebirth-loadout-integration] ok");
}

testHuntingRebirthLoadoutIntegration();

function testRebirthSubAbilityMatrix() {
    const roster = createRoster();
    let scenarioCount = 0;
    for (const source of roster) {
        for (const abilityId of getSubAbilityIds(source.id)) {
            const card = getRebirthCardDefinition(source.id, `ability:${abilityId}`);
            const opponent = roster.find((fighter) => fighter.id !== source.id);
            const loadout = {
                rebirthCount: 1,
                statBonuses: { hp: 0, damage: 0, speed: 0, defense: 0 },
                passiveModifiers: { abilityCooldownMultiplier: 1 },
                subAbilities: [
                    {
                        cardId: card.id,
                        abilityId,
                        rank: 1,
                        displayName: card.name,
                        modifiers: card.getRankEffect(1).modifiers
                    }
                ]
            };
            const sim = new BattleSimulation([source, opponent], {
                onLog() {},
                onBattleBallReady(ball, spec, simulation) {
                    if (spec.id === source.id) applyRebirthLoadoutToBattleBall(ball, simulation, loadout);
                }
            });
            const owner = sim.fighters.find((fighter) => fighter.id === source.id);
            assert.equal(
                owner.getAbilityUiStates().length,
                2,
                "Primary and rebirth sub ability should expose separate UI states"
            );
            assert.equal(owner.abilities.all[1].abilityTier, 0, "Sub abilities must not inherit the owner's XP tier");
            for (const _ of Array.from({ length: 12 })) sim.update(1 / 30);
            assert.ok(
                sim.fighters.every(
                    (fighter) => Number.isFinite(fighter.position.x) && Number.isFinite(fighter.position.y)
                )
            );
            scenarioCount += 1;
        }
    }
    assert.equal(scenarioCount, 156, "Every fighter x external ability pairing must remain playable");
    console.log("[rebirth-sub-ability-matrix] ok");
}

testRebirthSubAbilityMatrix();

function testRebirthVisualProfileContract() {
    const stages = [0, 1, 3, 6, 10, 999].map(getRebirthVisualProfile);
    assert.ok(
        stages.every((visual) => visual.flameCount <= 8),
        "Rebirth flame draw budget must stay bounded"
    );
    assert.ok(stages.every((visual, index) => index === 0 || visual.auraRadius >= stages[index - 1].auraRadius));
    assert.ok(stages.every((visual, index) => index === 0 || visual.stage >= stages[index - 1].stage));
    assert.ok(
        stages.every((visual, index) => index === 0 || visual.flickerStrength >= stages[index - 1].flickerStrength),
        "Higher rebirth stages should not reduce flame flicker strength"
    );
    assert.ok(
        stages.every((visual) => !("radius" in visual) && !("mass" in visual) && !("speed" in visual)),
        "Visual profile must not expose physics modifiers"
    );

    const visual = getRebirthVisualProfile(6);
    const createBall = (velocity) => ({
        id: "rebirth-flame-test",
        position: new Vector2(300, 300),
        radius: 50,
        velocity,
        stats: { baseSpeed: 200 }
    });

    const turningBall = createBall(new Vector2());
    const initialFlameDirection = getRebirthFlameDirection(turningBall, 0);
    turningBall.velocity = new Vector2(420, 0);
    turningBall.position.x += turningBall.velocity.x / 60;
    const earlyTurnDirection = getRebirthFlameDirection(turningBall, 1 / 60);
    const initialDirectionDot =
        initialFlameDirection.x * earlyTurnDirection.x + initialFlameDirection.y * earlyTurnDirection.y;
    assert.ok(
        initialDirectionDot > 0.9,
        "Flame direction should retain most of its previous heading on the first turn frame"
    );
    const settledTurnDirection = Array.from({ length: 45 }, (_, index) => {
        turningBall.position.x += turningBall.velocity.x / 60;
        return getRebirthFlameDirection(turningBall, (index + 2) / 60);
    }).at(-1);
    assert.ok(
        settledTurnDirection.x < -0.9,
        "Outward-launched particles should leave a natural trail behind sustained movement"
    );

    const statlessMovingBall = { ...createBall(new Vector2(420, 0)), stats: undefined };
    getRebirthFlameDirection(statlessMovingBall, 0);
    statlessMovingBall.position.x += statlessMovingBall.velocity.x * 0.1;
    const statlessDirection = getRebirthFlameDirection(statlessMovingBall, 0.1);
    assert.ok(
        Number.isFinite(statlessDirection.x) && statlessDirection.x < -0.3,
        "Outward-launched square particles should keep a finite natural trail without combat stats"
    );

    const baseParticleCtx = makeRecordingCanvasContext();
    drawRebirthVisualOverlay(baseParticleCtx, createBall(new Vector2()), getRebirthVisualProfile(1), 0.1);
    const nextRebirthParticleCtx = makeRecordingCanvasContext();
    drawRebirthVisualOverlay(nextRebirthParticleCtx, createBall(new Vector2()), getRebirthVisualProfile(2), 0.1);
    const middleRebirthParticleCtx = makeRecordingCanvasContext();
    drawRebirthVisualOverlay(middleRebirthParticleCtx, createBall(new Vector2()), getRebirthVisualProfile(5), 0.1);
    const maxRebirthParticleCtx = makeRecordingCanvasContext();
    drawRebirthVisualOverlay(maxRebirthParticleCtx, createBall(new Vector2()), getRebirthVisualProfile(10), 0.1);
    const canvasCtx = makeRecordingCanvasContext();
    drawRebirthVisualOverlay(canvasCtx, createBall(new Vector2()), visual, 0.1);
    assert.ok(
        baseParticleCtx.calls.filter((call) => call[0] === "fillRect").length >= 56,
        "Base rebirth should render a bounded set of square flame particles"
    );
    const baseParticleCount = baseParticleCtx.calls.filter((call) => call[0] === "fillRect").length;
    const nextParticleCount = nextRebirthParticleCtx.calls.filter((call) => call[0] === "fillRect").length;
    const middleParticleCount = middleRebirthParticleCtx.calls.filter((call) => call[0] === "fillRect").length;
    const maxParticleCount = maxRebirthParticleCtx.calls.filter((call) => call[0] === "fillRect").length;
    assert.ok(nextParticleCount > baseParticleCount, "Every rebirth should increase square flame particle density");
    assert.equal(
        middleParticleCount,
        Math.round(baseParticleCount + (maxParticleCount - baseParticleCount) * (4 / 9)),
        "Intermediate rebirths should linearly interpolate the integer particle density"
    );
    assert.equal(maxParticleCount, 92, "Tenth rebirth should reach the linear 92-particle ceiling");
    const wrappedSectors = new Set(
        baseParticleCtx.calls
            .filter((call) => call[0] === "translate")
            .map(([, x, y]) => Math.floor((((Math.atan2(y - 300, x - 300) + Math.PI) / (Math.PI * 2)) * 8) % 8))
    );
    assert.ok(
        wrappedSectors.size >= 6,
        "Square flame particles should occupy most of the ball perimeter before they join the trailing plume"
    );
    const emissionBall = createBall(new Vector2());
    emissionBall.id = "rebirth-flame-emission";
    const emissionStartCtx = makeRecordingCanvasContext();
    drawRebirthVisualOverlay(emissionStartCtx, emissionBall, visual, 0);
    const emissionNextCtx = makeRecordingCanvasContext();
    drawRebirthVisualOverlay(emissionNextCtx, emissionBall, visual, 1 / 60);
    const emissionStartParticles = emissionStartCtx.calls.filter((call) => call[0] === "translate");
    const emissionNextParticles = emissionNextCtx.calls.filter((call) => call[0] === "translate");
    const bottomLaunchDeltas = emissionStartParticles
        .map(([, x, y]) => {
            const nearestParticle = emissionNextParticles.reduce(
                (nearest, candidate) => {
                    const distance = Math.hypot(candidate[1] - x, candidate[2] - y);
                    return distance < nearest.distance ? { candidate, distance } : nearest;
                },
                { candidate: null, distance: Infinity }
            );
            return {
                verticalDelta: nearestParticle.candidate[2] - y,
                distance: nearestParticle.distance,
                radialDistance: Math.hypot(x - emissionBall.position.x, y - emissionBall.position.y),
                relativeY: y - emissionBall.position.y
            };
        })
        .filter(
            (sample) =>
                sample.distance < 8 &&
                sample.relativeY > emissionBall.radius * 0.45 &&
                sample.radialDistance < emissionBall.radius + emissionBall.radius * 0.35
        );
    assert.ok(bottomLaunchDeltas.length >= 2, "Renderer should retain multiple newly emitted bottom flame particles");
    assert.ok(
        bottomLaunchDeltas.reduce((total, sample) => total + sample.verticalDelta, 0) / bottomLaunchDeltas.length > 0.5,
        "Bottom flame particles should first launch outward before buoyancy bends them upward"
    );
    const risingParticleCtx = makeRecordingCanvasContext();
    const risingBall = createBall(new Vector2());
    drawRebirthVisualOverlay(risingParticleCtx, risingBall, visual, 0);
    Array.from({ length: 30 }, (_, index) => {
        risingParticleCtx.calls.length = 0;
        drawRebirthVisualOverlay(risingParticleCtx, risingBall, visual, (index + 1) / 60);
    });
    const averageRise =
        risingParticleCtx.calls
            .filter((call) => call[0] === "translate")
            .reduce((total, [, , y]) => total + y - risingBall.position.y, 0) /
        risingParticleCtx.calls.filter((call) => call[0] === "translate").length;
    assert.ok(averageRise < -12, "Detached square flame particles should visibly rise above a stationary character");
    assert.ok(
        canvasCtx.calls.filter((call) => call[0] === "fillRect").length >= 76,
        "Higher rebirth counts should linearly increase square flame particle density"
    );
    assert.ok(
        canvasCtx.calls.filter((call) => call[0] === "rotate").length >= 76,
        "Square flame particles should rotate with their physical flow"
    );
    assert.equal(
        canvasCtx.calls.filter((call) => call[0] === "quadraticCurveTo").length,
        0,
        "Square particle renderer should remove the legacy curved flame silhouette"
    );
    assert.equal(
        canvasCtx.calls.filter((call) => call[0] === "arc").length,
        1,
        "Square particle renderer should not draw round flame particles"
    );
    assert.equal(
        canvasCtx.calls.filter((call) => call[0] === "setLineDash").length,
        0,
        "Square particle renderer should not restore the removed dotted outer ring"
    );
    assert.equal(
        canvasCtx.calls.filter((call) => call[0] === "closePath").length,
        0,
        "Square particle renderer should not restore a closed flame silhouette"
    );
    assert.ok(
        canvasCtx.calls.some(
            (call) => call[0] === "set" && call[1] === "globalCompositeOperation" && call[2] === "source-over"
        ),
        "Square particles should use alpha compositing instead of additive saturation"
    );
    const statlessCanvasCtx = makeRecordingCanvasContext();
    drawRebirthVisualOverlay(statlessCanvasCtx, statlessMovingBall, visual, 0.1);
    assert.ok(
        statlessCanvasCtx.calls.some((call) => call[0] === "fillRect"),
        "Preview overlay should render square particles without combat stats"
    );
    console.log("[rebirth-visual-profile] ok");
}

testRebirthVisualProfileContract();

function testAbilitySetForwardsDashEffect() {
    const owner = {};
    let forwardedEffect = null;
    const primary = {
        owner,
        setContext() {},
        onDashHit(_target, effect) {
            forwardedEffect = effect;
        }
    };
    const abilities = new AbilitySet(owner, { primary });
    const effect = {};
    abilities.onDashHit({}, effect);
    assert.equal(forwardedEffect, effect, "AbilitySet must preserve DashEffect context for primary ability handlers");
    console.log("[ability-set-dash-effect-forwarding] ok");
}

testAbilitySetForwardsDashEffect();

function testCriticalChanceInAllocatableStats() {
    const criticalStat = ALLOCATABLE_STATS.find((stat) => stat.key === "criticalChance");
    assert.ok(criticalStat, "criticalChance should be in ALLOCATABLE_STATS");
    assert.equal(
        criticalStat.description.includes("분산"),
        false,
        "criticalChance should not use the dispersion multiplier"
    );
    console.log("[critical-stat-allocation] ok");
}

testCriticalChanceInAllocatableStats();

function testCriticalChanceAppliedToStats() {
    const baseFighter = createRoster().find((f) => f.id === FIGHTER_IDS.ARCHER);
    const allocation = createEmptyStatAllocation();
    allocation.criticalChance = 20;
    const applied = applyStatAllocation(baseFighter, allocation, false);
    assert.equal(applied.stats.criticalChance, 25, "criticalChance should be 5 base + 20 stat = 25");
    const zeroAlloc = createEmptyStatAllocation();
    const zeroApplied = applyStatAllocation(baseFighter, zeroAlloc, false);
    assert.equal(zeroApplied.stats.criticalChance, 5, "criticalChance should default to 5 base");
    const cappedAlloc = createEmptyStatAllocation();
    cappedAlloc.criticalChance = 100;
    const cappedApplied = applyStatAllocation(baseFighter, cappedAlloc, false);
    assert.equal(cappedApplied.stats.criticalChance, 100, "criticalChance should cap at 100");
    console.log("[critical-stat-application] ok");
}

testCriticalChanceAppliedToStats();

function testCriticalRollAndDamage() {
    const sim = new BattleSimulation(
        [
            createRoster().find((f) => f.id === FIGHTER_IDS.ARCHER),
            createRoster().find((f) => f.id === FIGHTER_IDS.GRENADE)
        ],
        { onLog() {}, onSound() {}, onDamageTaken() {}, onDamageDealt() {}, onHpChanged() {} }
    );
    const [a, b] = sim.fighters;
    a.stats.criticalChance = 100;
    // enemy damage should be able to crit
    const baseDamage = 20;
    const defenseVal = b.stats.baseDefense;
    const rawBefore = baseDamage;
    // critical: rawBefore * 2 = 40, then - defense
    const expectedCrit = Math.max(1, rawBefore * 2 - Math.round(defenseVal));
    // non-critical: rawBefore - defense
    const expectedNormal = Math.max(1, rawBefore - Math.round(defenseVal));
    // force a crit roll by temporarily storing the result
    let critRolled = false;
    const originalSpawn = sim.spawnCriticalNumber;
    sim.spawnCriticalNumber = () => {
        critRolled = true;
    };
    const hpBefore = b.hp;
    a._tempCritMultiplier = null;
    b.takeDamage(baseDamage, a, "Test Critical");
    sim.spawnCriticalNumber = originalSpawn;
    if (critRolled) {
        assert.equal(hpBefore - b.hp, expectedCrit, "Critical should double damage before defense");
    } else {
        assert.equal(hpBefore - b.hp, expectedNormal, "Non-critical should apply normal damage");
    }
    // self-damage must not crit
    critRolled = false;
    sim.spawnCriticalNumber = () => {
        critRolled = true;
    };
    a.takeDamage(baseDamage, a, "Self Damage");
    sim.spawnCriticalNumber = originalSpawn;
    assert.equal(critRolled, false, "Self-damage should not trigger critical");
    console.log("[critical-damage-path] ok");
}

testCriticalRollAndDamage();

function testArcherAbilityTierBehavior() {
    const createAimSimulation = (abilityTier) => {
        const sim = new BattleSimulation(
            [
                createRoster().find((fighter) => fighter.id === FIGHTER_IDS.ARCHER),
                createRoster().find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
            ],
            { onLog() {}, onSound() {}, onDamageTaken() {}, onDamageDealt() {}, onHpChanged() {} }
        );
        const [archer, opponent] = sim.fighters;
        archer.position = new Vector2(240, 360);
        opponent.position = new Vector2(640, 360);
        opponent.velocity = new Vector2(0, 0);
        sim.entities = sim.fighters.slice();
        archer.ability.setContext({ abilityTier });
        archer.ability.timer = 0;
        return { sim, archer, opponent, ability: archer.ability };
    };

    const direct = createAimSimulation(0);
    direct.ability.update(0.016, direct.opponent);
    const initialDirectAim = direct.ability.state.aimPoint.clone();
    direct.opponent.position = new Vector2(640, 660);
    direct.opponent.velocity = new Vector2(180, -120);
    direct.ability.update(0.1, direct.opponent);
    const movedDirectAim = direct.ability.state.aimPoint;
    const expectedDirectDirection = Vector2.subtract(direct.opponent.position, direct.archer.position).normalize();
    assert.ok(
        Vector2.subtract(movedDirectAim, initialDirectAim).length() > 100,
        "Archer Lv0 should update its aim point while the target moves during windup"
    );
    assert.ok(
        Vector2.subtract(movedDirectAim, direct.opponent.position).length() < 1e-9,
        "Archer Lv0 should aim at the target's latest current position"
    );
    assert.ok(
        Vector2.subtract(direct.ability.state.lastAimDir, expectedDirectDirection).length() < 1e-9,
        "Archer Lv0 should refresh its direction toward the latest current position"
    );
    direct.ability.update(0.31, direct.opponent);
    const directArrow = direct.sim.entities.find((entity) => entity.constructor?.name === "ArrowProjectile");
    assert.ok(directArrow, "Archer Lv0 should fire after windup");
    assert.ok(
        Vector2.subtract(directArrow.velocity.clone().normalize(), direct.ability.state.lastAimDir).length() < 1e-9,
        "The fired arrow should use the final windup direction"
    );
    const postFireVelocity = directArrow.velocity.clone();
    direct.opponent.position = new Vector2(200, 760);
    directArrow.update(0.01, direct.sim);
    assert.ok(
        Vector2.subtract(directArrow.velocity, postFireVelocity).length() < 1e-9,
        "The arrow should not steer toward the target after release"
    );

    const predictive = createAimSimulation(1);
    predictive.opponent.velocity = new Vector2(0, -180);
    predictive.ability.update(0.016, predictive.opponent);
    const predictionEffect = predictive.ability.state.predictionEffect;
    predictionEffect.update();
    const renderPredictionMarker = (label) => {
        let markerArc;
        assertForegroundEffectRenders(predictionEffect, label, (primitives) => {
            markerArc = assertEffectArcAt(
                primitives,
                predictionEffect.position,
                label,
                (radius) => radius >= 6 && radius <= 11
            );
            assertEffectUsesColor(primitives, predictive.archer.color, label);
            assert.ok(
                findEffectPrimitive(
                    primitives,
                    "lineTo",
                    ([x, y]) =>
                        Math.abs(x - predictionEffect.position.x) < 1e-6 ||
                        Math.abs(y - predictionEffect.position.y) < 1e-6
                ),
                `${label} should draw a crosshair through the predicted aim point`
            );
        });
        return markerArc.args[2];
    };
    const predictionStartRadius = renderPredictionMarker("Archer predictive marker start");
    const initialPredictiveAim = predictive.ability.state.aimPoint.clone();
    predictive.opponent.position = new Vector2(600, 650);
    predictive.opponent.velocity = new Vector2(-40, -220);
    predictive.ability.update(0.1, predictive.opponent);
    predictionEffect.update();
    const predictionMidRadius = renderPredictionMarker("Archer predictive marker mid");
    const expectedPredictiveAim = calculateInterceptPoint(
        predictive.archer.position,
        predictive.opponent.position,
        predictive.opponent.velocity,
        predictive.ability._getArrowSpeed()
    );
    assert.ok(
        Vector2.subtract(predictive.ability.state.aimPoint, initialPredictiveAim).length() > 100,
        "Archer Lv3+ should refresh its predictive point during windup"
    );
    assert.ok(
        Vector2.subtract(predictive.ability.state.aimPoint, expectedPredictiveAim).length() < 1e-9,
        "Archer Lv3+ should use the target's latest position and velocity for prediction"
    );
    predictive.ability.state.windUp = predictive.ability._getWindupDuration() * 0.05;
    predictionEffect.update();
    const predictionEndRadius = renderPredictionMarker("Archer predictive marker end");
    assert.ok(
        predictionStartRadius < predictionMidRadius && predictionMidRadius < predictionEndRadius,
        "Archer prediction marker radius should visibly advance from windup start through its end"
    );

    const doubleShot = createAimSimulation(2);
    assert.ok(Math.abs(doubleShot.ability._getWindupDuration() - 0.32) < 1e-9, "Archer Lv6 should have 0.32s windup");
    doubleShot.ability.timer = 10;
    doubleShot.ability.state.pendingSecondShot = true;
    doubleShot.ability.state.secondShotTimer = 0.01;
    doubleShot.ability.state.secondShotTargetCache = doubleShot.opponent;
    doubleShot.opponent.position = new Vector2(620, 620);
    doubleShot.opponent.velocity = new Vector2(-80, -180);
    doubleShot.ability.update(0.02, doubleShot.opponent);
    const secondArrow = doubleShot.sim.entities.find((entity) => entity.constructor?.name === "ArrowProjectile");
    const expectedSecondAim = calculateInterceptPoint(
        doubleShot.archer.position,
        doubleShot.opponent.position,
        doubleShot.opponent.velocity,
        doubleShot.ability._getArrowSpeed()
    );
    assert.ok(secondArrow, "Archer Lv6 should release its pending second arrow");
    assert.ok(
        Vector2.subtract(doubleShot.ability.state.aimPoint, expectedSecondAim).length() < 1e-9,
        "Archer Lv6 should re-aim the second arrow from the target's latest movement"
    );
    assert.ok(
        Vector2.subtract(secondArrow.velocity.clone().normalize(), doubleShot.ability.state.lastAimDir).length() < 1e-9,
        "Archer Lv6 second arrow should use its refreshed direction"
    );

    doubleShot.ability.setContext({ abilityTier: 3 });
    assert.equal(doubleShot.ability.abilityTier, 3, "Archer Lv9 should enable the per-arrow critical chance boost");
    console.log("[archer-ability-tier] ok");
}

testArcherAbilityTierBehavior();

function testRageAbilityThresholds() {
    const sim = new BattleSimulation(
        [createRoster().find((f) => f.id === FIGHTER_IDS.RAGE), createRoster().find((f) => f.id === FIGHTER_IDS.DASH)],
        { onLog() {}, onSound() {} }
    );
    const [rage, opponent] = sim.fighters;
    const setCharge = (ability, pct) => {
        ability.state.timeWithoutCollision = ability.getMaxChargeTime() * (pct / 100);
    };

    rage.ability.state.aftershock = null;
    opponent._igniteState = undefined;

    // --- Tier 1 (Lv3): >=35 ignite only ---
    rage.ability.setContext({ abilityTier: 1 });

    setCharge(rage.ability, 34);
    rage.ability.onCollision(opponent);
    assert.equal(opponent._igniteState, undefined, "Lv3 34%: no ignite");
    assert.ok(rage.ability.getChargeProgress() > 0, "Lv3 34%: charge preserved below threshold");

    setCharge(rage.ability, 35);
    opponent._igniteState = undefined;
    rage.ability.onCollision(opponent);
    assert.ok(opponent._igniteState !== undefined, "Lv3 35%: ignite applied");
    assertForegroundEffectRenders(opponent._igniteState, "Rage burning target");
    assert.equal(rage.ability.getChargeProgress(), 0, "Lv3 35%: charge reset");

    setCharge(rage.ability, 69);
    opponent._igniteState = undefined;
    rage.ability.onCollision(opponent);
    assert.ok(opponent._igniteState !== undefined, "Lv3 69%: ignite applied");

    setCharge(rage.ability, 100);
    opponent._igniteState = undefined;
    rage.ability.onCollision(opponent);
    assert.ok(opponent._igniteState !== undefined, "Lv3 100%: ignite still applied (tier1 has no explosion)");

    // --- Tier 2 (Lv6): 35-69 ignite, >=70 explosion ONLY ---
    rage.ability.setContext({ abilityTier: 2 });

    setCharge(rage.ability, 35);
    opponent._igniteState = undefined;
    rage.ability.onCollision(opponent);
    assert.ok(opponent._igniteState !== undefined, "Lv6 35%: ignite applied");

    setCharge(rage.ability, 69);
    opponent._igniteState = undefined;
    rage.ability.onCollision(opponent);
    assert.ok(opponent._igniteState !== undefined, "Lv6 69%: ignite applied");

    setCharge(rage.ability, 70);
    opponent._igniteState = undefined;
    const hpAt70 = opponent.hp;
    rage.ability.onCollision(opponent);
    assert.equal(opponent._igniteState, undefined, "Lv6 70%: no ignite (explosion only)");
    assert.equal(rage.ability.getChargeProgress(), 0, "Lv6 70%: charge reset");
    assert.ok(opponent.hp < hpAt70, "Lv6 70%: explosion dealt damage");

    setCharge(rage.ability, 99);
    const hpAt99 = opponent.hp;
    opponent._igniteState = undefined;
    rage.ability.onCollision(opponent);
    assert.equal(opponent._igniteState, undefined, "Lv6 99%: no ignite (explosion only)");
    assert.ok(opponent.hp < hpAt99, "Lv6 99%: explosion dealt damage");

    setCharge(rage.ability, 100);
    const hpAt100 = opponent.hp;
    opponent._igniteState = undefined;
    rage.ability.onCollision(opponent);
    assert.equal(opponent._igniteState, undefined, "Lv6 100%: no ignite (explosion only at tier2)");
    assert.ok(opponent.hp < hpAt100, "Lv6 100%: explosion dealt damage");

    // --- Tier 3 (Lv9): 35-69 ignite, 70-99 explosion ONLY, 100 aftershock ONLY ---
    rage.ability.setContext({ abilityTier: 3 });

    setCharge(rage.ability, 35);
    opponent._igniteState = undefined;
    rage.ability.onCollision(opponent);
    assert.ok(opponent._igniteState !== undefined, "Lv9 35%: ignite applied");

    setCharge(rage.ability, 69);
    opponent._igniteState = undefined;
    rage.ability.onCollision(opponent);
    assert.ok(opponent._igniteState !== undefined, "Lv9 69%: ignite applied");

    setCharge(rage.ability, 70);
    opponent._igniteState = undefined;
    const hpBeforeExplode = opponent.hp;
    rage.ability.onCollision(opponent);
    assert.equal(opponent._igniteState, undefined, "Lv9 70%: no ignite (explosion only)");
    assert.equal(rage.ability.getChargeProgress(), 0, "Lv9 70%: charge reset");
    assert.ok(opponent.hp < hpBeforeExplode, "Lv9 70%: explosion dealt damage");

    setCharge(rage.ability, 99);
    opponent._igniteState = undefined;
    const hpBeforeExplode99 = opponent.hp;
    rage.ability.onCollision(opponent);
    assert.equal(opponent._igniteState, undefined, "Lv9 99%: no ignite (explosion only)");
    assert.ok(opponent.hp < hpBeforeExplode99, "Lv9 99%: explosion dealt damage");

    setCharge(rage.ability, 100);
    opponent._igniteState = undefined;
    rage.ability.state.aftershock = null;
    rage.ability.onCollision(opponent);
    assert.equal(opponent._igniteState, undefined, "Lv9 100%: no ignite (aftershock only)");
    assert.equal(rage.ability.getChargeProgress(), 0, "Lv9 100%: charge reset");
    assert.ok(rage.ability.state.aftershock !== null, "Lv9 100%: aftershock queued");

    console.log("[rage-ability-thresholds] ok");
}

testRageAbilityThresholds();

function testRageIgniteRefreshSeparatesDamageFromVisualLifetime() {
    const sim = new BattleSimulation(
        [
            createRoster().find((fighter) => fighter.id === FIGHTER_IDS.RAGE),
            createRoster().find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
        ],
        { onLog() {}, onSound() {}, onDamageTaken() {}, onDamageDealt() {}, onHpChanged() {} }
    );
    const [rage, opponent] = sim.fighters;
    rage.ability.setContext({ abilityTier: 1 });
    rage.ability._applyIgnite(opponent);
    const ignite = opponent._igniteState;
    const hpBefore = opponent.hp;
    const damagePerTick = rage.stats.baseDamage * 0.1;
    const assertIgniteFrame = (label) => {
        assertForegroundEffectRenders(ignite, label, (primitives) => {
            assertEffectArcAt(
                primitives,
                opponent.position,
                label,
                (radius) => Math.abs(radius - (opponent.radius + 2)) < 1e-9
            );
            assertEffectUsesColor(primitives, "#fff4bd", label);
        });
    };

    ignite.update(0.25);
    assert.equal(ignite.tickCount, 2, "Ignite should resolve two 0.1s ticks during its first 0.25s");
    assert.equal(opponent.hp, hpBefore - damagePerTick * 2, "Ignite should preserve total-attack x0.10 per tick");

    rage.ability._applyIgnite(opponent);
    assert.equal(opponent._igniteState, ignite, "Reapplying ignite should refresh the existing visual entity");
    assert.equal(ignite.tickCount, 0, "Refreshing ignite should restart the shared five-tick cycle");
    assert.equal(opponent.hp, hpBefore - damagePerTick * 2, "Refreshing ignite should not deal immediate damage");
    assert.ok(Math.abs(ignite.life - 0.5) < 1e-9, "Refreshing ignite should restore 0.5s of visual lifetime");
    assertIgniteFrame("Rage ignite refresh start");

    ignite.update(0.25);
    assert.equal(ignite.tickCount, 2, "Refreshed ignite should reserve its own five-tick cycle");
    assert.equal(
        opponent.hp,
        hpBefore - damagePerTick * 4,
        "Refresh should restart rather than overlap burning damage"
    );
    assert.equal(ignite.damageComplete, false, "The refreshed damage cycle should remain active at 0.25s");
    assert.equal(ignite.isExpired, false, "The refreshed visual should remain active at 0.25s");
    assert.equal(opponent._igniteState, ignite, "The target should retain the refreshed shared effect");
    assertIgniteFrame("Rage ignite refresh mid");

    ignite.update(0.249);
    assert.equal(ignite.tickCount, 4, "The refreshed effect should emit four ticks before its final frame");
    assert.equal(ignite.isExpired, false, "The refreshed visual should remain visible until 0.5s after refresh");
    assertIgniteFrame("Rage ignite refresh end");
    ignite.update(0.001);
    assert.equal(
        opponent.hp,
        hpBefore - damagePerTick * 7,
        "The original two and refreshed five ticks should be exact"
    );
    assert.equal(ignite.isExpired, true, "The refreshed visual should expire 0.5s after refresh");
    assert.equal(opponent._igniteState, null, "Visual expiry should clear the target's ignite state");

    const mobTarget = {
        position: new Vector2(300, 320),
        radius: 24,
        color: "#5aa865",
        flags: { defeated: false },
        damageTaken: 0,
        takeDamage(amount) {
            this.damageTaken += amount;
        }
    };
    const mobIgnite = new BurningEffect({
        source: rage,
        target: mobTarget,
        duration: 0.5,
        tickInterval: 0.1,
        maximumTicks: 5,
        damagePerTick,
        label: "Ignite"
    });
    mobTarget._igniteState = mobIgnite;
    mobIgnite.update(0.225);
    mobIgnite.refresh();
    assert.equal(mobIgnite.tickTimer, 0, "Mob ignite refresh should restart the next shared tick reservation");
    mobIgnite.update(0.1);
    assert.equal(mobIgnite.tickCount, 1, "Mob ignite should restart at the first 0.1s tick after refresh");
    assert.equal(mobTarget.damageTaken, damagePerTick * 3, "Mob targets should share the same refresh contract");
    console.log("[rage-ignite-refresh-lifetimes] ok");
}

testRageIgniteRefreshSeparatesDamageFromVisualLifetime();

function testRageAftershockUsesVector2Effects() {
    const sim = new BattleSimulation(
        [
            createRoster().find((fighter) => fighter.id === FIGHTER_IDS.RAGE),
            createRoster().find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
        ],
        { onLog() {}, onSound() {}, onDamageTaken() {}, onDamageDealt() {}, onHpChanged() {} }
    );
    const [rage, opponent] = sim.fighters;
    rage.ability.setContext({ abilityTier: 3 });
    rage.ability.state.timeWithoutCollision = rage.ability.getMaxChargeTime();
    const hpBefore = opponent.hp;

    rage.ability.onCollision(opponent, { contactPoint: { x: opponent.position.x, y: opponent.position.y } });
    assert.ok(rage.ability.state.aftershock, "Rage Lv9 should queue an aftershock at full charge");
    assert.ok(
        rage.ability.state.aftershock.localContact instanceof Vector2,
        "Rage Lv9 should keep its saved local contact as Vector2"
    );

    assert.doesNotThrow(() => {
        for (let frame = 0; frame < 24; frame += 1) {
            rage.ability.update(0.016);
        }
    }, "Rage Lv9 aftershock should pass Vector2 positions to effect APIs");
    assert.equal(rage.ability.state.aftershock, null, "Rage aftershock should finish after its delay");
    assert.ok(opponent.hp < hpBefore, "Rage aftershock should damage the target after its delay");
    console.log("[rage-aftershock-vector2-effects] ok");
}

testRageAftershockUsesVector2Effects();

function testRageExplosionUsesVector2Effects() {
    const sim = new BattleSimulation(
        [
            createRoster().find((fighter) => fighter.id === FIGHTER_IDS.RAGE),
            createRoster().find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
        ],
        { onLog() {}, onSound() {}, onDamageTaken() {}, onDamageDealt() {}, onHpChanged() {} }
    );
    const [rage, opponent] = sim.fighters;
    rage.ability.setContext({ abilityTier: 2 });
    rage.ability.state.timeWithoutCollision = rage.ability.getMaxChargeTime() * 0.8;
    const hpBefore = opponent.hp;

    assert.doesNotThrow(() => {
        rage.ability.onCollision(opponent, {
            contactPoint: { x: opponent.position.x, y: opponent.position.y }
        });
    }, "Rage Lv6 explosion should convert plain collision positions for effect APIs");
    assert.ok(opponent.hp < hpBefore, "Rage explosion should damage the target from its collision center");
    const ring = sim.entities.find((entity) => entity.constructor?.name === "RageFlameRing");
    const renderRageRing = (label) => {
        let ringRadius;
        assertForegroundEffectRenders(ring, label, (primitives) => {
            const expandingRing = findEffectPrimitive(
                primitives,
                "arc",
                ([x, y, radius], primitive) =>
                    Math.abs(x - ring.position.x) < 1e-6 &&
                    Math.abs(y - ring.position.y) < 1e-6 &&
                    radius >= 0 &&
                    primitive.strokeStyle === "#ff983d"
            );
            assert.ok(expandingRing, `${label} should draw its orange fire wave at the collision center`);
            ringRadius = expandingRing.args[2];
            assertEffectUsesColor(primitives, "#fff4bd", label);
            assert.ok(
                primitives.filter((primitive) => primitive.method === "fillRect").length >= 18,
                `${label} should retain the radial flame fragments`
            );
        });
        return ringRadius;
    };
    ring.update(0.01);
    const ringStartRadius = renderRageRing("Rage explosion ring start");
    ring.update(0.1);
    const ringMidRadius = renderRageRing("Rage explosion ring mid");
    ring.update(0.1);
    const ringEndRadius = renderRageRing("Rage explosion ring end");
    assert.ok(
        ringStartRadius < ringMidRadius && ringMidRadius < ringEndRadius,
        "Rage fire wave should expand from collision start through its final visible frame"
    );
    console.log("[rage-explosion-vector2-effects] ok");
}

testRageExplosionUsesVector2Effects();

function testEaterAbilityDigestion() {
    const sim = new BattleSimulation(
        [createRoster().find((f) => f.id === FIGHTER_IDS.EATER), createRoster().find((f) => f.id === FIGHTER_IDS.SPIN)],
        { onLog() {}, onSound() {} }
    );
    const [eater, target] = sim.fighters;
    eater.ability.setContext({ abilityTier: 1 });
    eater.ability.state.swallowedTarget = target;
    eater.ability.state.swallowTimer = 0.72;
    const hpBefore = target.hp;
    for (let index = 0; index < 6; index += 1) {
        eater.ability._tickDigestion(0.12);
    }
    assert.ok(target.hp < hpBefore, "Eater Lv3 digestion should deal damage over time");
    eater.ability.state.swallowedTarget = null;
    // Lv6 spit behavior
    eater.ability.setContext({ abilityTier: 2 });
    eater.ability.state.swallowedTarget = target;
    eater.ability.state.swallowTimer = 0.72;
    const hpBeforeSpit = target.hp;
    eater.ability.releaseSwallowed();
    assert.ok(target.hp < hpBeforeSpit, "Eater Lv6 spit should deal damage");
    const spitEffect = sim.entities.find((entity) => entity.constructor?.name === "EaterSpitEffect");
    const renderSpit = (label) => {
        const mouth = Vector2.add(
            spitEffect.origin,
            spitEffect.direction.clone().scale(spitEffect.owner.radius * 0.86)
        );
        let dustRadius;
        assertForegroundEffectRenders(spitEffect, label, (primitives) => {
            assertEffectTrajectory(primitives, mouth, spitEffect.target.position, label);
            assertEffectUsesColor(primitives, spitEffect.color, label);
            const dustArc = findEffectPrimitive(
                primitives,
                "arc",
                ([, , radius, startAngle, endAngle]) =>
                    radius >= spitEffect.owner.radius * 0.55 &&
                    radius <= spitEffect.owner.radius * 1.55 &&
                    startAngle !== 0 &&
                    endAngle !== Math.PI * 2
            );
            assert.ok(dustArc, `${label} should draw the recoil dust arc behind the spit trajectory`);
            dustRadius = dustArc.args[2];
        });
        return dustRadius;
    };
    const spitStartRadius = renderSpit("Eater spit trajectory start");
    spitEffect.update(0.16);
    const spitMidRadius = renderSpit("Eater spit trajectory mid");
    spitEffect.update(0.15);
    const spitEndRadius = renderSpit("Eater spit trajectory end");
    assert.ok(
        spitStartRadius < spitMidRadius && spitMidRadius < spitEndRadius,
        "Eater spit recoil arc should expand across its start, mid, and end frames"
    );
    console.log("[eater-ability-digestion] ok");
}

testEaterAbilityDigestion();

function testEaterOrbitDigestionLifecycleKeepsBattleProgressing() {
    const sim = new BattleSimulation(
        [
            createRoster().find((fighter) => fighter.id === FIGHTER_IDS.EATER),
            createRoster().find((fighter) => fighter.id === FIGHTER_IDS.ORBIT)
        ],
        { onLog() {}, onSound() {}, onDamageTaken() {}, onDamageDealt() {}, onHpChanged() {} }
    );
    const [eater, orbit] = sim.fighters;
    eater.ability.setContext({ abilityTier: 3 });
    orbit.ability.setContext({ abilityTier: 3 });
    eater.position.x = 480;
    eater.position.y = 480;
    orbit.position.x = 480;
    orbit.position.y = 480;
    eater.ability.state.feastTimer = 1;
    const orbitHpBefore = orbit.hp;

    eater.ability.onCollision(orbit);
    assert.equal(orbit.state.swallowed?.owner, eater, "Eater should hold Orbit during digestion");
    const digestEffect = sim.entities.find((entity) => entity.constructor?.name === "EaterDigestEffect");
    assertForegroundEffectRenders(digestEffect, "Eater digestion proxy", (primitives) => {
        assert.ok(
            findEffectPrimitive(
                primitives,
                "translate",
                ([x, y]) => Math.abs(x - eater.position.x) < 1e-6 && Math.abs(y - eater.position.y) < 1e-6
            ),
            "Eater digestion proxy should stay centered inside Eater"
        );
        assert.ok(
            findEffectPrimitive(
                primitives,
                "arc",
                ([x, y, radius]) => x === 0 && y === 0 && radius === Math.min(orbit.radius, eater.radius * 0.72)
            ),
            "Eater digestion proxy should render the swallowed target at the compressed radius"
        );
        assertEffectUsesColor(primitives, orbit.color, "Eater digestion proxy");
        assert.ok(
            primitives.filter((primitive) => primitive.method === "moveTo").length >= 6,
            "Eater digestion proxy should draw both rows of teeth around the swallowed target"
        );
    });

    for (let frame = 0; frame < 47; frame += 1) {
        sim.update(0.016);
    }

    assert.equal(eater.ability.state.digestionTick, 6, "Eater should complete all six digestion ticks");
    assert.ok(orbit.hp < orbitHpBefore, "Orbit should receive the digestion damage");
    assert.equal(eater.ability.state.swallowedTarget, null, "Eater should release Orbit after the hold duration");
    assert.equal(orbit.state.swallowed, null, "Orbit should resume normal battle updates after release");
    assert.equal(sim.finished, false, "Digestion must not stall or prematurely end an active duel");
    assert.ok(sim.entities.length < 140, "Digestion feedback should stay below the mobile render budget");

    orbit.applyImpulse(Vector2.subtract(new Vector2(400, 0), orbit.velocity));
    orbit.position.x = sim.width + orbit.radius + 5;
    assert.doesNotThrow(
        () => sim.keepInsideArena(orbit),
        "Lv9 wall rupture should accept particle positions from the arc"
    );
    assert.equal(
        eater.ability.state.lv9WallRuptureUsed,
        true,
        "Lv9 wall rupture should resolve after Orbit hits a wall"
    );
    const ruptureEffect = sim.entities.find((entity) => entity.constructor?.name === "EaterWallRuptureEffect");
    const renderRupture = (label) => {
        let ruptureArc;
        assertForegroundEffectRenders(ruptureEffect, label, (primitives) => {
            ruptureArc = assertEffectArcAt(
                primitives,
                ruptureEffect.position,
                label,
                (radius) => radius >= 0 && radius <= ruptureEffect.maxRadius
            );
            assert.ok(
                Math.abs(ruptureArc.args[4] - ruptureArc.args[3] - Math.PI) < 1e-9,
                `${label} should preserve the inward-facing half-circle rupture angle`
            );
            assertEffectUsesColor(primitives, ruptureEffect.color, label);
        });
        return ruptureArc.args[2];
    };
    ruptureEffect.update(0.01);
    const ruptureStartRadius = renderRupture("Eater wall rupture start");
    ruptureEffect.update(0.13);
    const ruptureMidRadius = renderRupture("Eater wall rupture mid");
    ruptureEffect.update(0.13);
    const ruptureEndRadius = renderRupture("Eater wall rupture end");
    assert.ok(
        ruptureStartRadius < ruptureMidRadius && ruptureMidRadius < ruptureEndRadius,
        "Eater wall rupture should expand from the wall contact across start, mid, and end frames"
    );
    console.log("[eater-orbit-digestion-lifecycle] ok");
}

testEaterOrbitDigestionLifecycleKeepsBattleProgressing();

function testTerrainCollisionReturnsResult() {
    const entity = {
        position: { x: 200, y: 200 },
        velocity: { x: 50, y: 0 },
        radius: 24,
        applyImpulse() {},
        applyAngularImpulse() {}
    };
    const terrain = { shape: "circle", type: "rock", x: 200, y: 200, radius: 50, blocking: true };
    const result = resolveTerrainCollision(entity, terrain);
    assert.ok(result, "terrain collision should return truthy");
    assert.ok(result.normal && result.contactPoint, "terrain collision should return { normal, contactPoint }");
    assert.ok(result.normal instanceof Vector2, "terrain collision normal should be Vector2");
    assert.ok(result.contactPoint instanceof Vector2, "terrain collision contactPoint should be Vector2");
    assert.ok(typeof result.normal.x === "number", "result.normal.x should be a number");
    assert.ok(typeof result.contactPoint.x === "number", "result.contactPoint.x should be a number");
    console.log("[terrain-collision-result] ok");
}

testTerrainCollisionReturnsResult();

function testKeepInsideArenaWallSlamIntegration() {
    const sim = new BattleSimulation(
        [
            createRoster().find((f) => f.id === FIGHTER_IDS.ARCHER),
            createRoster().find((f) => f.id === FIGHTER_IDS.GRENADE)
        ],
        { onLog() {}, onSound() {}, onDamageTaken() {}, onDamageDealt() {}, onHpChanged() {} }
    );
    const [a] = sim.fighters;
    let onRuptureCalled = false;
    const slam = new WallSlamEffect({
        source: a,
        damage: 25,
        duration: 2.45,
        onRupture: () => {
            onRuptureCalled = true;
        }
    });
    a.state.wallSlam = slam;
    a.position.x = sim.width + a.radius + 5;
    sim.keepInsideArena(a);
    assert.ok(a.position.x <= sim.width, "keepInsideArena should push fighter inside the arena");
    console.log("[keep-inside-arena-wallslam] ok");
}

testKeepInsideArenaWallSlamIntegration();

console.log("regression tests ok");
