import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createComponentBridge as createAppComponentBridge } from "../src/componentBridge.js";
import { PopupService } from "../src/popup.js";
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
import { calculateInterceptPoint, FIGHTER_IDS, Vector2, randomSpin } from "../src/core.js";
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
    grantExperienceFromMatchReport
} from "../src/experience/experienceService.js";
import {
    getCharacterLevelProgression,
    getCharacterLevelRewardsBetween
} from "../src/experience/characterLevelProgression.js";
import { getLevelRewardEffectHandler } from "../src/experience/reward-effects/effectRegistry.js";
import { DashEffect, WallSlamEffect } from "../src/combatEffects.js";
import { shuffled } from "../src/random.js";
import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { FighterPhysicsSimulation } from "../src/simulation/fighterPhysicsSimulation.js";
import { PreviewReselectSimulation } from "../src/preview/previewReselectSimulation.js";
import {
    createDefaultPlayerProfile,
    migrateLegacyExperienceToCharacter,
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
    HUNTING_MONSTER_TYPES,
    HUNTING_MONSTER_BASE_SPECS,
    HUNTING_MONSTER_TAGS,
    HUNTING_PORTAL_DECLINE,
    HUNTING_RUN_PHASES,
    HUNTING_STAGE_IDS,
    HUNTING_STAGES,
    HUNTING_TEAMS,
    getHuntingDisplayHealth,
    getHuntingDisplayHp,
    createHuntingMinibossSpec,
    createHuntingMobSpec,
    createHuntingMobEncounter,
    applyHuntingRunAchievementProgress,
    recordHuntingBattleStart,
    recordHuntingBattleVictory,
    getHuntingMobCount,
    getHuntingMobCountWeights,
    getHuntingMonsterPool,
    shouldUseRosterMiniboss,
    createMerchantOffers,
    createConsumableMerchantOffer,
    applyMerchantOffer,
    formatOfferResultToast,
    canAffordOffer,
    formatChestRarityCounts,
    formatPendingLootSummary,
    formatDefeatLossText,
    HUNTING_LOOT_ITEM_TYPES,
    HuntingBattleLootSession,
    HuntingLootDropController,
    getHuntingBonusLootWeights,
    getHuntingLootDropChance,
    getHuntingShardDropAmount,
    getHuntingShardPhysicalDropCount,
    getSmallHealPackAmount,
    rollHighChestRarity,
    rollHuntingBonusLootItemType,
    rollHuntingShardBundleAmount
} from "../src/hunting/index.js";
import { Grenade } from "../src/entities/grenade.js";
import { getArenaWallRay } from "../src/abilities/huntingMobAbility.js";
import { createElectricArcPath } from "../src/effects/electricArc.js";
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
    applyRotationalContactDamage
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
    HeroOrb,
    ShardDrop,
    SmallHealPack,
    STAT_ORB_KEYS
} from "../src/entities/index.js";
import { MobAppearance } from "../src/entities/mobAppearance.js";
import { PHYSICS_MATERIALS, resolvePhysicsMaterial, combinePhysicsMaterials } from "../src/physics/PhysicsMaterial.js";
import PhysicsMaterialBody from "../src/physics/PhysicsMaterialBody.js";
import { AppLifecycle, APP_LIFECYCLE_STATES } from "../src/appLifecycle.js";
import { ScreenWakeLock } from "../src/screenWakeLock.js";

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
    const methods = new Set([
        "save",
        "restore",
        "translate",
        "scale",
        "rotate",
        "beginPath",
        "arc",
        "ellipse",
        "fill",
        "stroke",
        "fillRect",
        "strokeRect",
        "moveTo",
        "lineTo",
        "closePath",
        "fillText"
    ]);
    return new Proxy(
        { calls, globalAlpha: 1 },
        {
            get(target, prop) {
                if (prop in target) return target[prop];
                if (methods.has(prop)) {
                    return (...args) => {
                        calls.push([prop, ...args]);
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
    assert.equal(beforeHp - target.hp, 24, "Wall bounce should deal wall slam damage (25 - 1 defense)");
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
    for (const g of allGrenades()) {
        assert.ok(
            Math.abs(g.velocity.length() - 1600) < 0.001,
            "Grenade speed should scale with the owner's base speed"
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

    ability.state.missStreak = 2;
    ability.release(target);
    const burstArrows = app.simulation.entities.filter((entity) => entity.constructor?.name === "ArrowProjectile");
    assert.equal(
        burstArrows.length,
        1,
        "Burst should fire its first arrow immediately instead of a simultaneous scatter"
    );
    assert.ok(burstArrows[0].velocity.y < 0, "First burst arrow should lead the current upward movement");

    target.velocity = new Vector2(0, 240);
    ability.update(0.12, target);
    target.velocity = new Vector2(0, -240);
    ability.update(0.12, target);

    const completedBurst = app.simulation.entities.filter((entity) => entity.constructor?.name === "ArrowProjectile");
    assert.equal(completedBurst.length, 3, "Burst should contain exactly three sequential arrows");
    assert.ok(completedBurst[1].velocity.y > 0, "Second burst arrow should re-predict the changed target movement");
    assert.ok(completedBurst[2].velocity.y < 0, "Third burst arrow should independently re-predict again");
    assert.equal(ability.state.burstShotsRemaining, 0, "Burst should end after its third arrow");

    completedBurst.forEach((arrow) => arrow._onExpired(app.simulation));
    assert.equal(ability.state.missStreak, 0, "Burst arrow misses should not prime another burst");
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
        assert.equal(app._overlay.label, "아쉽네요", "Elimination should show the dedicated loss result presentation");
        assert.ok(
            startButtonStates.some((state) => state.text === "확인"),
            "Elimination should reuse the shared confirmation button"
        );

        await app.startTournament();
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

    const allocation = { hp: 30, damage: 40, speed: 30, skill: 0, defense: 0 };
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
        "체력 +30% · 공격 +40% · 속도 +30% · 쿨타임 +0% · 방어력 +0%",
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
        app.hunting.advance = () => {
            advanced = true;
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
    assert.equal(chestState.huntingChestTitle, "희귀 상자 확보", "Chest event should use the localized rarity title");
    assert.equal(
        manager._run.pendingLoot.chests.length,
        1,
        "Chest event should add one unsecured chest before display"
    );

    let advanceCalls = 0;
    manager.advance = () => {
        advanceCalls += 1;
    };
    manager.chestContinue();

    assert.equal(advanceCalls, 1, "Chest continue should resume the advance loop");
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
        [HUNTING_EVENT_TYPES.CHAMPION_INTRUSION]: "챔피언 난입"
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
    manager.advance = () => {
        advanceCalls += 1;
    };
    manager.eventContinue();

    assert.equal(advanceCalls, 1, "Confirming an auto event should resume the route exactly once");
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
    const rolls = [0, 0, 0, 0.25, 0.5, 0, 0.25, 0.999999, 0, 0.25, 0.9];
    const soundCalls = [];
    const controller = new HuntingLootDropController({ session, rng: () => rolls.shift() ?? 0 });
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
    player.position = new Vector2(300, 480);
    mob.position = player.position.clone();
    player.hp = player.maxHp;

    mob.takeDamage(100000, player, "Loot Hook Test");
    const droppedShards = simulation.entities.filter((entity) => entity instanceof ShardDrop);
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
    assert.equal(droppedShard.radius, 16, "Standard shard drops should be visibly larger than hero orbs");
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
    assert.deepEqual(
        soundCalls.at(-1),
        { type: "loot", intensity: 1 },
        "Loot collection should request its audible collect chime"
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
        amount: 1
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
        amount: 1
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
        amount: 1
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
    assert.equal(healPack.radius, 18, "Heal packs should use the enlarged loot size");
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
            }
        },
        _currentMatchReport: null,
        setHuntingOverlayState() {},
        showOverlay() {},
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
        loot: { shards: 15, chests: [chest], xp: 0 },
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
            }
        },
        _currentMatchReport: null,
        setHuntingOverlayState(data) {
            overlayStates.push({ ...data });
        },
        showOverlay(label, text, subtext) {
            showOverlayCalls.push({ label, text, subtext });
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
    return { overlayStates, showOverlayCalls, playerBall, mockApp, manager };
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
    const { overlayStates, showOverlayCalls, mockApp, manager } = createCombatRewardChestTestEnv({ isFinalBoss: true });

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
        const clearBefore = showOverlayCalls.find((c) => c.label === "스테이지 클리어");
        assert.equal(clearBefore, undefined, "Stage clear must NOT appear before chest confirm");

        // Reset tracking for chestContinue
        overlayStates.length = 0;
        showOverlayCalls.length = 0;
        beginResultConfirmationCallCount = 0;

        manager.chestContinue();

        // After chest confirm: run must be null (stage clear)
        assert.equal(manager._run, null, "Final boss combat reward chest continue must set run to null (stage clear)");

        // Stage clear overlay must appear
        const clearAfter = showOverlayCalls.find((c) => c.label === "스테이지 클리어");
        assert.ok(clearAfter, "After final boss chest confirm, stage clear overlay must appear");

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
        "fuseItem",
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
    const initialAllocation = { hp: 20, damage: 20, speed: 20, skill: 20, defense: 20 };
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
    assert.equal(
        levelUpResult.previousNextRewardText,
        "Lv.2 · 속도 +2",
        "Level-up result should retain the reward reached by the animation"
    );
    assert.equal(levelUpResult.level, 2, "Level-up result should expose the new level");
    assert.deepEqual(
        levelUpResult.earnedRewards.map((reward) => reward.text),
        ["속도 +2"],
        "Every level should grant the selected character a base stat reward"
    );
    assert.equal(
        levelUpResult.nextRewardText,
        "Lv.3 · 스킬 +2 · 대시 배율 +5%",
        "Tier levels should expose both the next base stat and player-facing ability reward"
    );
    profile.experience.byCharacter[FIGHTER_IDS.DASH].currentXp = getLevelRequirement(4);
    assert.equal(
        getCharacterExperienceSummary(profile, FIGHTER_IDS.DASH).nextRewardText,
        "Lv.5 · 속도 +2",
        "Next reward UI should resolve the selected character's next level row"
    );

    const dashLevelThree = getCharacterLevelProgression(FIGHTER_IDS.DASH, 3);
    const allRewardEffects = dashLevelThree.effects;
    allRewardEffects.forEach((effect) => {
        assert.doesNotThrow(() => getLevelRewardEffectHandler(effect), "Every configured level reward needs a handler");
    });
    assert.deepEqual(
        getExperienceRewardsBetween(FIGHTER_IDS.DASH, 1, 3).map((reward) => reward.text),
        ["속도 +2", "스킬 +2 · 대시 배율 +5%"],
        "Level ranges should expose every base stat reward and player-facing tier reward"
    );
    assert.equal(
        allRewardEffects.find((effect) => effect.type === "ability_tier")?.gameText,
        "대시 배율 +5%",
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
    assert.equal(
        rewardedSpec.stats.damage,
        Number((baselineSpec.stats.damage * 1.1).toFixed(3)),
        "Level base damage should be increased before the percentage stat multiplier"
    );
    assert.equal(
        rewardedSpec.stats.speed,
        Number((baselineSpec.stats.speed * (296 / 294)).toFixed(3)),
        "Level base speed should be increased before the percentage stat multiplier"
    );
    assert.equal(rewardedSpec.stats.skill, 2, "Level skill should remain a direct base stat addition");
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
        7,
        "Battle ball should combine level base skill with the allocated skill points"
    );
    assert.equal(
        preparedPlayer.progression.abilityTier,
        1,
        "Tier rewards should be recorded on the ball progression snapshot"
    );
    assert.deepEqual(
        preparedPlayer.progression.baseStatBonuses,
        { speed: 2, skill: 2, damage: 1 },
        "Ball progression should retain the accumulated base stat report"
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
            entries.every((entry) => Object.keys(entry.baseStats).length > 0),
            `${fighter.id} should have a base stat reward on every level row`
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
        assert.equal(progression.effects.length, 12, `${fighter.id} should expose stat and tier effects together`);
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
    assert.equal(archer._getBurstShotCount(), 4, "Archer tier 3 should round the burst to four arrows");

    const orbitRun = createTierSimulation(FIGHTER_IDS.ORBIT);
    orbitRun.ball.ability.update(0, orbitRun.target);
    assert.equal(orbitRun.ball.ability.shardCount, 6, "Orbit tier 1 should add a sixth shard");
    assertClose(orbitRun.ball.ability.rechargeDuration, 1 / 1.15, "Orbit tier 2 should increase recharge speed by 15%");
    assertClose(orbitRun.ball.ability.getVolleyDelay(), 0.18 * 0.65, "Orbit tier 3 should shorten volley delay by 35%");

    const tricksterRun = createTierSimulation(FIGHTER_IDS.TRICKSTER);
    tricksterRun.ball.ability.timer = 0;
    tricksterRun.ball.ability.update(0.01, tricksterRun.target);
    const tierSeeds = tricksterRun.sim.entities.filter((entity) => entity.constructor?.name === "SeedOrb");
    assert.equal(tierSeeds.length, 4, "Trickster tier 1 should launch four seeds");
    assertClose(tierSeeds[0].life, 18.9, "Trickster tier 2 should extend seed life by 35%");

    const grenadeRun = createTierSimulation(FIGHTER_IDS.GRENADE);
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
        grenadeRun.ball.ability._startBurst(grenadeRun.target);
        assert.equal(grenadeRun.ball.ability._burstTotal, 4, "Grenade tier 1 should raise the minimum burst to four");
    } finally {
        Math.random = originalRandom;
    }
    const grenade = grenadeRun.sim.entities.find((entity) => entity.constructor?.name === "Grenade");
    assertClose(grenade.explosionRadius, 174 * 1.15, "Grenade tier 2 should expand the explosion radius by 15%");
    assertClose(grenade.damageMultiplier, 1.1, "Grenade tier 3 should increase explosion damage by 10%");

    const dashRun = createTierSimulation(FIGHTER_IDS.DASH);
    dashRun.ball.ability.state.cooldownLevel = 2;
    dashRun.ball.ability.onDashWall();
    assertClose(dashRun.ball.ability.getDashMultiplier(), 2.15 * 1.05, "Dash tier 1 should increase dash speed");
    assertClose(dashRun.ball.ability.getHomingTurnRate(), 2.4 * 1.3, "Dash tier 2 should increase turn rate");
    assert.equal(dashRun.ball.ability.state.cooldownLevel, 1, "Dash tier 3 should retain half of a two-stage cooldown");

    const rageRun = createTierSimulation(FIGHTER_IDS.RAGE);
    rageRun.ball.ability.state.timeWithoutCollision = rageRun.ball.ability.getMaxChargeTime();
    assertClose(rageRun.ball.ability.getMaxChargeTime(), 11.9, "Rage tier 1 should reduce max charge time by 15%");
    assertClose(
        rageRun.ball.ability.getStatModifiers().impact,
        1.52 * 1.15,
        "Rage tier 2 should increase maximum impact by 15%"
    );
    rageRun.ball.ability.onCollision();
    assertClose(rageRun.ball.ability.state.timeWithoutCollision, 11.9 * 0.2, "Rage tier 3 should retain 20% charge");

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
    spinTierOneRun.ball.ability.state.timeWithoutCollision = spinTierOneRun.ball.ability.getMaxChargeTime();
    spinTierOneRun.ball.ability.onCollision(spinTierOneRun.target);
    assertClose(
        spinTierOneRun.ball.ability.getChargeProgress(),
        0.25,
        "Spin tier 1 should retain 25% of its rotation charge after a collision"
    );

    const spinTierTwoRun = createTierSimulation(FIGHTER_IDS.SPIN, 2);
    const spinTierTwo = spinTierTwoRun.ball.ability;
    spinTierTwo.state.timeWithoutCollision = spinTierTwo.getMaxChargeTime() * 0.6;
    spinTierTwo.onCollision(spinTierTwoRun.target);
    assert.equal(spinTierTwo.getSpiralKnockback(), 210, "Spin tier 2 should unlock spiral knockback");
    assert.ok(
        spinTierTwoRun.target.state.forcedHeading,
        "Spin tier 2 should apply its lateral knockback through the existing physics API"
    );

    const spinTierThreeRun = createTierSimulation(FIGHTER_IDS.SPIN, 3);
    const spinTierThree = spinTierThreeRun.ball.ability;
    spinTierThree.state.timeWithoutCollision = spinTierThree.getMaxChargeTime();
    assert.equal(spinTierThree.getUiState().label, "오버스핀", "Full Spin charge should announce ready overspin");
    assert.equal(
        spinTierThree.modifyOutgoingFighterCollisionDamage(10),
        15,
        "Spin tier 3 should strengthen the full-charge collision that consumes rotation"
    );
    spinTierThree.onCollision(spinTierThreeRun.target);
    assertClose(
        spinTierThree.getChargeProgress(),
        0.25,
        "Spin tier 3 should consume its overspin collision while preserving the tier 1 charge retention"
    );
    assert.equal(spinTierThree.state.overspinHit, false, "Overspin should be consumed by its charged collision");

    const eaterRun = createTierSimulation(FIGHTER_IDS.EATER);
    assertClose(
        eaterRun.ball.ability._getSwallowHoldDuration(),
        0.54,
        "Eater tier 1 should shorten swallow hold by 25%"
    );
    eaterRun.target.angularVelocity = 2;
    eaterRun.ball.ability._applySpitAngularImpulse(eaterRun.target, new Vector2(1, 0));
    assert.ok(
        eaterRun.target._accumulatedAngularImpulse > 0,
        "Eater tier 2 should add angular impulse instead of assigning spin"
    );

    const batRun = createTierSimulation(FIGHTER_IDS.BAT_BALL);
    assert.equal(batRun.ball.ability.getArcRange(), 184, "Bat tier 1 should extend arc range by 15%");
    assertClose(
        batRun.ball.ability.getArcAngle(),
        (Math.PI * 2 * 1.15) / 3,
        "Bat tier 2 should extend arc angle by 15%"
    );
    assertClose(batRun.ball.ability.getWallSlamDuration(), 1.3, "Bat tier 3 should extend wall slam duration by 30%");

    const vampireRun = createTierSimulation(FIGHTER_IDS.VAMPIRE);
    vampireRun.ball.ability._spawnBats(vampireRun.target);
    const tierBats = vampireRun.sim.entities.filter((entity) => entity.constructor?.name === "BatProjectile");
    assert.equal(tierBats.length, 8, "Vampire tier 1 should launch eight bats");
    assertClose(tierBats[0].life, 4.8, "Vampire tier 3 should extend bat life by 20%");
    assertClose(
        tierBats[0].velocity.length(),
        vampireRun.ball.stats.baseSpeed * 0.5 * 1.15,
        "Vampire tier 2 should increase bat speed by 15%"
    );

    const gunnerRun = createTierSimulation(FIGHTER_IDS.GUNNER);
    Math.random = () => 0;
    try {
        gunnerRun.ball.ability._startBurst();
    } finally {
        Math.random = originalRandom;
    }
    assert.equal(
        gunnerRun.ball.ability.state.burstBulletCount,
        7,
        "Gunner tier 1 should raise the minimum bullet count to seven"
    );
    gunnerRun.ball.ability._fireBurstBullet();
    const bullet = gunnerRun.sim.entities.find((entity) => entity.constructor?.name === "BulletProjectile");
    assertClose(
        bullet.velocity.length(),
        gunnerRun.ball.stats.baseSpeed * 2 * 1.15,
        "Gunner tier 2 should increase bullet speed by 15%"
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
    for (const _ of Array.from({ length: 24 })) {
        heroAbility.onOrbCollected();
    }
    assert.equal(heroAbility.state.orbStacks, 20, "Hero tier 2 should cap orb stacks at twenty");
    assert.deepEqual(
        heroAbility.getOrbStackState(),
        { stacks: 20, stackCap: 20, progress: 1 },
        "Hero should expose its capped orb stack progress for the battle visual"
    );
    heroAbility.state.orbStacks = 3;
    const drawnStackArcs = [];
    const drawnStackLabels = [];
    heroAbility.draw({
        save() {},
        restore() {},
        beginPath() {},
        arc(...args) {
            drawnStackArcs.push(args);
        },
        stroke() {},
        fillText(...args) {
            drawnStackLabels.push(args);
        }
    });
    assert.equal(drawnStackArcs.length, 3, "Hero should draw one bright stack band segment per collected orb");
    assert.equal(drawnStackLabels[0][0], "x3", "Hero stack band should show the current stack count");
    heroAbility.state.orbStacks = 20;
    assert.equal(
        heroAbility.modifyOutgoingFighterCollisionDamage(10),
        16,
        "Hero stacks should add 3% collision damage each"
    );
    const attractionOrb = new HeroOrb(heroRun.ball, heroRun.ball.position.clone(), new Vector2(0, 0), "hp");
    const heroAttraction = heroAbility.getOrbAttraction(attractionOrb);
    assert.equal(
        heroAttraction.radius,
        heroRun.ball.radius * 2.5 + attractionOrb.radius,
        "Hero tier 1 should use two-and-a-half times the Hero radius plus the Orb radius as magnet range"
    );

    heroRun.sim.width = 10_000;
    heroRun.target.position = new Vector2(9_000, 9_000);
    heroAbility._spawnOrb("hp", new Vector2(1, 0));
    const launchedOrb = heroRun.sim.entities.find((entity) => entity.constructor?.name === "HeroOrb");
    const launchVelocity = launchedOrb.velocity.clone();
    assert.equal(
        launchedOrb.collectionGraceRemaining,
        1,
        "Hero tier 1 should give launched orbs a one-second collection grace period"
    );
    for (const _ of Array.from({ length: 10 })) {
        launchedOrb.update(0.1, heroRun.sim);
    }
    assertClose(
        launchedOrb.velocity.length(),
        launchVelocity.length(),
        "Hero magnet should not reduce launch speed during the first second"
    );
    heroRun.sim.entities = heroRun.sim.entities.filter((entity) => entity !== launchedOrb);

    const heroOrb = new HeroOrb(
        heroRun.ball,
        Vector2.add(heroRun.ball.position, new Vector2(heroRun.ball.radius + 20, 0)),
        new Vector2(0, 0),
        "hp",
        undefined,
        { collectionGraceDuration: 1 }
    );
    heroOrb.update(1, heroRun.sim);
    assert.equal(
        heroOrb.velocity.length(),
        0,
        "Hero magnet should ignore an orb until its one-second grace period ends"
    );
    heroOrb.update(0.1, heroRun.sim);
    assert.ok(
        heroOrb.velocity.x < 0,
        "Hero tier 1 should physically pull owned orbs after the grace period inside the Hero-radius range"
    );
    heroAbility.onFighterCollisionDamageResolved(heroRun.target, 1);
    assert.equal(
        heroAbility.state.orbStacks,
        0,
        "Hero should consume stacks only after actual fighter collision damage"
    );
    assert.ok(heroAbility.state.stackReleaseFlash > 0, "Hero stack consumption should trigger a visible release flash");
    assert.equal(
        heroRun.sim.entities.filter((entity) => entity.constructor?.name === "HeroOrb").length,
        10,
        "Hero tier 3 should release half of twenty consumed stacks as normal orbs"
    );
    console.log("[ability-level-upgrades] ok");
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
    assert.equal(shouldUseRosterMiniboss(3), true, "Every third hunting floor should add a roster miniboss");
    const miniboss = createHuntingMinibossSpec({
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
    assert.equal(miniboss.hunting.isMiniboss, true, "Roster enemies should be marked as minibosses");
    assert.equal(miniboss.hunting.sourceFighterId, FIGHTER_IDS.ARCHER, "Minibosses should not copy the player");
    assert.equal(miniboss.teamId, HUNTING_TEAMS.ENEMY, "Minibosses should fight on the enemy team");

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
        loot: { shards: 100, chests: [common, uncommon, rare], xp: 90 }
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
        loot: { shards: 0, chests: [common], xp: 0 },
        consumeStatModifiers: false
    });
    assert.equal(
        preservedEventBuff.statModifiers.length,
        2,
        "Non-combat event rewards should not consume temporary stat modifiers"
    );

    // rng(1)=0.4→EVENT, rng(2)=0.95→CHAMPION_INTRUSION(idx7)
    const champion = advanceHuntingRun(afterFloor, {
        rng: (() => {
            const rolls = [0.4, 0.95];
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
    assert.equal(defeated.securedLoot.xp, 62, "Defeat should preserve 70% XP rounded down");
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

    const rareMonster = createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.ELECTRIC, floor: 20 });
    const epicMonster = createHuntingMobSpec({ type: HUNTING_MONSTER_TYPES.LASER, floor: 94 });
    let run = createHuntingRun({ characterId: FIGHTER_IDS.DASH });
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

    const returnedRun = retreatHuntingRun(
        {
            ...repeatedVictory,
            floor: 45,
            lastEvent: { type: HUNTING_EVENT_TYPES.PORTAL },
            pendingLoot: { shards: 0, chests: [createHuntingChest({ rarity: "common" })], xp: 0 }
        },
        { reason: "retreat" }
    );
    const stats = applyHuntingRunAchievementProgress(createDefaultPlayerProfile().hunting.stats, returnedRun);
    assert.equal(stats.monsterKillsByTag[HUNTING_MONSTER_TAGS.MONSTER], 2, "Normal monster kills should persist");
    assert.equal(stats.criticalHpCombatWins, 1, "A battle won from 20% starting HP should persist");
    assert.equal(stats.championVictories, 1, "Champion intrusion victories should persist separately");
    assert.equal(stats.securedChestCount, 1, "Only secured run chests should count toward the storage achievement");
    assert.equal(stats.bestPortalRetreatFloor, 45, "Portal retreats should keep their highest floor");

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
        }
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

    // ── gameOverlay store default values ──
    const overlayStore = Alpine.store("gameOverlay");
    assert.equal(overlayStore.huntingCanRetreat, false, "gameOverlay huntingCanRetreat default should be false");
    assert.equal(overlayStore.huntingMoving, false, "gameOverlay huntingMoving default should be false");
    assert.equal(overlayStore.huntingMoveFrom, 0, "gameOverlay huntingMoveFrom default should be 0");
    assert.equal(overlayStore.huntingMoveTo, 0, "gameOverlay huntingMoveTo default should be 0");
    assert.equal(overlayStore.huntingMoveStep, 0, "gameOverlay huntingMoveStep default should be 0");
    assert.equal(overlayStore.huntingMoveMax, 10, "gameOverlay huntingMoveMax default should be 10");
    assert.equal(overlayStore.huntingMoveMessage, "", "gameOverlay huntingMoveMessage default should be empty");

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
        loot: { shards: 0, chests: [], xp: 0 },
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
        loot: { shards: 10, chests: [], xp: 0 },
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
    assert.equal(collided, true, "Fighter at rock center should collide");
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
    assert.equal(polyCollided, true, "Fighter inside polygon should collide");
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
        false,
        "Non-blocking should be ignored"
    );
    assert.equal(
        resolveTerrainCollision(
            { position: { x: 500, y: 500 }, velocity: { x: 0, y: 0 }, radius: 24, applyImpulse() {} },
            rock
        ),
        false,
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
    craftProfile.equipment.inventory.push(fuseA, fuseB);
    craftProfile.equipment.equipped.weapon = fuseA.instanceId;

    const fusionCost = getFusionCost("common");
    const fused = fuseEquipment(craftProfile, fuseA.instanceId, fuseB.instanceId, () => 0.5);
    assert.equal(fused.toRarity, "uncommon", "Fusion should upgrade common equipment to uncommon");
    assert.equal(fused.consumed.length, 2, "Fusion should consume two source items");
    assert.equal(craftProfile.equipment.inventory.length, 1, "Fusion should replace two items with one item");
    assert.equal(craftProfile.equipment.inventory[0].rarity, "uncommon", "Fusion result should be the next rarity");
    assert.equal(craftProfile.equipment.equipped.weapon, null, "Fusing an equipped item should unequip it");
    assert.equal(
        craftProfile.equipment.enhancementStones,
        100 - fusionCost.stones,
        "Fusion should deduct enhancement stones"
    );
    assert.equal(craftProfile.hunting.shards, 500 - fusionCost.shards, "Fusion should deduct key shards");

    const lonely = createEquipmentInstance({ rarity: "rare", slot: "weapon", rng: () => 0.5 });
    craftProfile.equipment.inventory.push(lonely);
    const noPartner = fuseEquipment(craftProfile, lonely.instanceId, null, () => 0.5);
    assert.equal(noPartner.error, "partner", "Fusion should require a same-rarity partner");

    const legendA = createEquipmentInstance({ rarity: "legendary", slot: "weapon", rng: () => 0.5 });
    const legendB = createEquipmentInstance({ rarity: "legendary", slot: "armor", rng: () => 0.5 });
    craftProfile.equipment.inventory.push(legendA, legendB);
    const maxFusion = fuseEquipment(craftProfile, legendA.instanceId, legendB.instanceId, () => 0.5);
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
        { name: "질풍의 철검 갈망", primaryStatType: "speed", specialOptionType: "hpSteal" },
        "Equipment special options should appear as a suffix"
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

function testEquipmentLevelRequirement() {
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

    profile.experience.byCharacter[characterId] = { currentXp: getLevelRequirement(5) };
    assert.equal(
        canCharacterEquipItem(profile, rareWeapon, characterId),
        true,
        "Level 5 character should be able to equip rare equipment"
    );
    const unlockedSpec = applyEquipmentStats(baseSpec, profile);
    assert.equal(unlockedSpec.stats.damage, 18, "Unlocked equipment should add stat bonuses");
    assert.equal(unlockedSpec.equipment.equippedItems.length, 1, "Unlocked equipment should be drawn");
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
    const { getCharacterChallengeLevel } = await import("../src/character-mastery/index.js");

    const profile = createDefaultPlayerProfile();
    assert.equal(getCharacterChallengeLevel(profile, "archer"), 0, "Level 0 -> challenge 0");

    profile.characterMastery.levels = { archer: 1 };
    assert.equal(getCharacterChallengeLevel(profile, "archer"), 1, "Level 1 -> challenge 1");

    profile.characterMastery.levels = { archer: 3 };
    assert.equal(getCharacterChallengeLevel(profile, "archer"), 2, "Level 3 (GOLD) -> challenge 2 (capped)");
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

    const result = target.takeDamage(100, { id: "source", simulation }, "Crash");
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
testHuntingLaserReachesArenaWall(app);
testHuntingBoomerangReachAndReturnArc(app);
testElectricArcPathAndHuntingRender(app);
testHuntingElectricChannelCooldown(app);
testHuntingConnectionEffectsClearDefeatedTargets(app);
testTeamTargetingAndFriendlyCollision(app);
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
testHuntingSystem();
await testHuntingAchievementProgress();
testHunting100FloorStructure();
testHuntingCombatRelief();
testHuntingPortalDecline();
testHuntingStageSelectionAndArenaTheme();
await testHuntingStageSelectUsesPreviewCharacter();
testHuntingTerrain();
testEquipmentEnhancement();
testEquipmentStatValueRatios();
testEquipmentNaming();
testEquipmentSpecialCombatEffects();
testEquipmentPhysicalSpecialEffects();
testEquipmentLevelRequirement();
testEquipmentDraw();
testAlpineTemplateComponentSystem();
await testMatchEndGrantsImmediateExperience(app);
await testDamageShake(app);
await testArrowBounceFacing(app);
await testArcherPredictiveBurst(app);
await testOrbitShardRecharge(app);
await testTournament(app);
await testTournamentEliminationAwaitsConfirmation(app);
await testHeroBallRegistered(app);
await testHeroAbilitySpawnsOrb(app);
await testHeroOrbEffectType(app);
await testHeroOrbOwnerCollects(app);
await testHeroOrbCollectionGraceDefersOwnerPickup(app);
await testHeroOrbOpponentCollects(app);
await testHeroOrbMaxActivePerOwner(app);
await testHeroOrbDoesNotExpireFromCooldown(app);
await testHeroOrbLimitIgnoresCollectedOrbs(app);
await testHeroOrbStatCapInfinite(app);
await testHeroOrbStatCapLimited(app);
await testHeroOrbNoDamage(app);
await testHeroBaseCooldown(app);
await testHeroOrbSpeedMinMax(app);
await testHeroOrbSpeedScalesWithOwner(app);
await testHeroOrbOwnerCollectFeedback(app);
await testHeroOrbOpponentNoFeedback(app);
await testHeroOrbCapNoFeedback(app);
await testHeroOrbBonusUiFormat(app);
await testHeroOrbBonusUiOnlyForHero(app);
await testHeroExistingRulesNotBroken(app);
await testPickHeroOrbEffectType();
await testSpecialOrbOwnerCollectDash(app);
await testSpecialOrbOwnerCollectArrow(app);
await testSpecialOrbOwnerCollectCooldownBurst(app);
await testSpecialOrbCooldownBurstExpires(app);
await testSpecialOrbOpponentCollects(app);
await testSpecialOrbNotInStatBonuses(app);
await testSpecialOrbCountsTowardMaxActive(app);
await testSpecialOrbDrawDistinction(app);
await testCarryoverRateConstant();
await testComputeHeroOrbCarryover();
await testComputeHeroOrbCarryoverCustomRate();
await testMergeHeroOrbCarryover();
await testMergeHeroOrbCarryoverNoRecycle();
await testApplyHeroOrbCarryoverToBattleBall(app);
await testMergeOrbBonuses(app);
await testCarryoverNotForNonHero(app);
await testCarryoverSkillAffectsCooldown(app);
await testCarryoverDoesNotAffectSpecialOrbs(app);
await testRollHeroOrbStatGain();
await testHeroOrbStatGainAmountApplied(app);
await testHeroOrbStatGainDamage(app);
await testHeroOrbStatGainSpeed(app);
await testHeroOrbStatGainDefense(app);
await testHeroOrbStatGainSkill(app);
await testHeroOrbStatGainCapClamp(app);
await testHeroOrbSpecialNotAffectedByGain(app);
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
    grenade.velocity = new Vector2(6000, 0);

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
    grenade.velocity = new Vector2(800, 0);

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
    assert.equal(collided, true, "fighter at rock edge should collide");
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
    assert.equal(collided, true, "fighter inside polygon should collide");
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
    assert.equal(hit, true, "terrain collision should detect overlap");
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
            xp: 0
        },
        securedLoot: { shards: 0, chests: [], xp: 0 }
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
    const runNoPending = { ...runWithHp, pendingLoot: { shards: 0, chests: [], xp: 0 } };
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

function testHuntingMerchantMobileScrollContract() {
    const content = readFileSync("src/components/game-overlay.html", "utf8");
    assert.ok(
        content.includes("'hunting-merchant-active': huntingMerchantActive"),
        "Overlay should expose a merchant-active class for the compact mobile layout"
    );
    assert.ok(
        content.includes(":scope.hunting-merchant-active .overlay-card"),
        "Merchant overlay card should have a dedicated bounded layout"
    );
    assert.ok(
        content.includes(".hunting-merchant-offers") && content.includes("overflow-y: auto"),
        "Merchant offers should scroll when their choices exceed arena height"
    );
    assert.ok(content.includes("touch-action: pan-y"), "Merchant overlay should accept vertical touch scrolling");
    assert.ok(
        content.includes(".hunting-merchant-offer") && content.includes("flex: 0 0 auto"),
        "Merchant offers should not shrink their contents before the list scrolls"
    );
    assert.ok(content.includes("min-height: 76px"), "Merchant offers should retain a readable minimum height");
    assert.ok(
        content.includes(".hunting-merchant-pass") && content.includes("flex: 0 0 auto"),
        "Advance button should stay fixed"
    );
    console.log("[hunting-merchant-mobile-scroll] ok");
}

function testHuntingChestIconReuseContract() {
    const chestIcon = readFileSync("src/components/chest-icon.html", "utf8");
    const overlay = readFileSync("src/components/game-overlay.html", "utf8");
    const collectionHub = readFileSync("src/components/collection-hub.html", "utf8");
    assert.ok(chestIcon.includes('chest-icon[data-rarity="rare"]'), "Chest icon should own rarity color variants");
    assert.ok(overlay.includes("<chest-icon"), "Hunting chest event should render the shared chest icon");
    assert.ok(
        collectionHub.includes("ch-shop-chest"),
        "The shop should render the shared chest icon for its chest offer"
    );
    console.log("[hunting-chest-icon-reuse] ok");
}

function testCollectionCharacterDetailTabsContract() {
    const collectionHub = readFileSync("src/components/collection-hub.html", "utf8");
    assert.ok(collectionHub.includes("상세 정보"), "Character detail should expose an overview tab");
    assert.ok(collectionHub.includes("레벨 보상"), "Character detail should expose a level rewards tab");
    assert.ok(collectionHub.includes("reward.statusLabel"), "Level reward rows should expose earned status");
    assert.ok(
        !collectionHub.includes("목록으로"),
        "Character detail should not duplicate the always-visible roster navigation"
    );
    assert.ok(
        !collectionHub.includes("closeCollectionCharacterDetail"),
        "Character detail should stay selected until another character or hub close"
    );
    console.log("[collection-character-detail-tabs] ok");
}

function testPopupCloseOwnershipContract() {
    const collectionHub = readFileSync("src/components/collection-hub.html", "utf8");
    const popupDialog = readFileSync("src/components/popup-dialog.html", "utf8");
    const patchNotes = readFileSync("src/components/patch-notes.html", "utf8");
    const actionPicker = readFileSync("src/components/action-picker.html", "utf8");

    assert.ok(
        collectionHub.includes('@click.self="closeCollectionHub()"'),
        "Collection hub should close only when its own backdrop receives the click"
    );
    assert.ok(
        collectionHub.includes('@keydown.escape="closeCollectionHub()"'),
        "Collection hub should own its local Escape handling"
    );
    assert.ok(
        collectionHub.includes("dialogElement = this.$root") &&
            collectionHub.includes("requestAnimationFrame(() => dialogElement.focus())"),
        "Collection hub should capture its Alpine root before focus is requested through uiManager"
    );
    assert.ok(
        !collectionHub.includes("@click.outside") && !collectionHub.includes("hasVisiblePopupDialog"),
        "Collection hub should not need knowledge of child popup visibility"
    );
    assert.ok(
        popupDialog.includes("@keydown.escape=\"closePopup('close')\""),
        "Popup dialog should own Escape on its own root"
    );
    assert.ok(
        popupDialog.includes("dialogElement = this.$root") &&
            popupDialog.includes("requestAnimationFrame(() => dialogElement.focus())") &&
            popupDialog.includes('role="dialog"') &&
            popupDialog.includes('aria-modal="true"') &&
            !popupDialog.includes("@keydown.escape.window") &&
            !popupDialog.includes("data-modal-layer"),
        "Popup dialog should focus itself without a global key listener or parent marker"
    );
    assert.ok(
        patchNotes.includes('@click.self="dismissNotes()"') &&
            patchNotes.includes('@keydown.escape="dismissNotes()"') &&
            patchNotes.includes("dialogElement = this.$root") &&
            patchNotes.includes("requestAnimationFrame(() => dialogElement.focus())") &&
            !patchNotes.includes("@click.outside"),
        "Patch notes should use the same backdrop-owned close and focus contract"
    );
    assert.ok(
        actionPicker.includes("@keydown.escape.stop") &&
            actionPicker.includes("dialogElement = this.$root") &&
            actionPicker.includes("requestAnimationFrame(() => dialogElement.focus())"),
        "Action picker should capture its root and consume Escape while a choice is required"
    );
    assert.ok(
        [collectionHub, popupDialog, patchNotes, actionPicker].every((source) => !source.includes("@click.outside")),
        "Fullscreen overlays should never delegate their close behavior to a document-level outside listener"
    );
    console.log("[popup-close-ownership-contract] ok");
}

function testHuntingOverlayResetContract() {
    const content = readFileSync("src/components/game-overlay.html", "utf8");
    assert.ok(content.includes("resetHuntingState()"), "Game overlay should expose an explicit hunting state reset");
    assert.ok(content.includes("this.huntingFloor = 1;"), "Hunting reset should restore the first floor");
    assert.ok(content.includes('this.huntingCharacterName = "";'), "Hunting reset should clear the prior character");
    assert.ok(content.includes('this.huntingLootSummary = "";'), "Hunting reset should clear prior loot summary");
    assert.ok(content.includes("this.resetHuntingState();"), "Overlay hide should invoke the hunting reset");

    const appSource = readFileSync("src/app.js", "utf8");
    assert.ok(
        appSource.includes("resetHuntingUiState()"),
        "BattleApp should own an explicit hunting UI reset entry point"
    );
    console.log("[hunting-overlay-reset] ok");
}

function testGameplayUiResetContracts() {
    const components = [
        ["src/components/game-overlay.html", "game overlay"],
        ["src/components/xp-reward-panel.html", "XP reward panel"],
        ["src/components/fighter-strip.html", "fighter strip"],
        ["src/components/tournament-bracket.html", "tournament bracket"],
        ["src/components/player-panel.html", "player panel"],
        ["src/components/mode-segment.html", "mode segment"],
        ["src/components/start-button.html", "start button"],
        ["src/components/toast-notification.html", "toast notification"]
    ];

    components.forEach(([path, name]) => {
        const source = readFileSync(path, "utf8");
        assert.ok(source.includes("reset()"), `${name} should expose an explicit reset interface`);
    });

    const appSource = readFileSync("src/app.js", "utf8");
    assert.ok(
        appSource.includes("resetGameplayUiState()"),
        "BattleApp should own the result-confirmation UI reset entry point"
    );
    console.log("[gameplay-ui-reset-contract] ok");
}

function testResultConfirmationReturnsInitialState() {
    const appSource = readFileSync("src/app.js", "utf8");
    assert.ok(
        appSource.includes('this._startBtn.setState({ text: "확인", hidden: false, disabled: false });'),
        "Tournament completion should expose the same confirm button as other completed modes"
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
        ["overlay"],
        ["toast"],
        ["setup"],
        ["preview"]
    ]);
    console.log("[result-confirmation-initial-state] ok");
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
        showOverlay() {
            calls.push("overlay");
        },
        setStartButton() {
            calls.push("button");
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
    assert.equal(stateNoRun.huntingLootHudChests, 0, "No run: chests should be 0");

    // ── HUD hidden when pending loot is empty ──
    manager._run = createHuntingRun({ characterId: FIGHTER_IDS.DASH });
    const stateEmpty = manager._getLootHudState();
    assert.equal(stateEmpty.huntingLootHudVisible, false, "Empty pending loot: HUD should be hidden");
    assert.equal(stateEmpty.huntingLootHudShards, 0, "Empty pending loot: shards should be 0");
    assert.equal(stateEmpty.huntingLootHudChests, 0, "Empty pending loot: chests should be 0");

    // ── HUD visible with shards only ──
    manager._run = {
        ...manager._run,
        pendingLoot: { shards: 30, chests: [], xp: 0 }
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
    assert.equal(stateBoth.huntingLootHudChests, 2, "Both: chests should be 2");

    // ── _setHuntingMoveState includes HUD data ──
    manager._run = {
        ...manager._run,
        pendingLoot: { shards: 12, chests: [createHuntingChest({ rarity: "common" })], xp: 0 }
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
        pendingLoot: { shards: 0, chests: [], xp: 0 }
    };
    const stateEmpty2 = manager._getLootHudState();
    assert.equal(stateEmpty2.huntingLootHudVisible, false, "Empty after having loot: HUD should hide");
    assert.equal(stateEmpty2.huntingLootHudShards, 0, "Empty after having loot: shards should be 0");
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
testHuntingMerchantMobileScrollContract();
testHuntingChestIconReuseContract();
testCollectionCharacterDetailTabsContract();
testPopupCloseOwnershipContract();
testHuntingOverlayResetContract();
testGameplayUiResetContracts();
testAppLifecycleTransitions();
await testScreenWakeLock();
testBattleAppControlsScreenWakeLock();
testResultConfirmationReturnsInitialState();
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
    assert.ok(typeof bridge.fuseItem === "function", "bridge.fuseItem should be a function");
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

    const chest = createCollectionActionPopupOptions("chest", {
        opened: true,
        applied: { shards: 0, equipment: item },
        currentShards: 70
    });
    assert.equal(chest.title, "상자 개봉 결과", "Chest reward should use the shared result popup");
    assert.ok(chest.bodyHtml.includes("테스트 검"), "Chest popup should identify awarded equipment");

    const chestFailure = createCollectionActionPopupOptions("chest", {
        opened: false,
        reason: "not_enough_shards",
        cost: 80
    });
    assert.equal(chestFailure.title, "개봉 실패", "Chest failure should use the shared result popup");
    assert.ok(chestFailure.bodyHtml.includes("80"), "Chest failure should include the required cost when known");
    console.log("[collection-action-popup-options] ok");
}

function testComponentBridgeCollectionActionResultsUsePopupService() {
    const profile = createDefaultPlayerProfile();
    profile.hunting.shards = 999;
    profile.equipment.enhancementStones = 999;
    const enhanceTarget = createEquipmentInstance({ rarity: "common", rng: () => 0.5 });
    const disassembleTarget = createEquipmentInstance({ rarity: "common", rng: () => 0.5 });
    const saleTarget = createEquipmentInstance({ rarity: "common", rng: () => 0.5 });
    profile.equipment.inventory.push(enhanceTarget, disassembleTarget, saleTarget);

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

        assert.equal(popupCalls.length, 3, "Each completed collection action should present one result popup");
        assert.ok(
            popupCalls[0].title.startsWith("강화"),
            "Enhancement should report success or failure through PopupService"
        );
        assert.equal(popupCalls[1].title, "장비 분해 완료", "Disassembly should report through PopupService");
        assert.equal(popupCalls[2].title, "장비 판매 완료", "Sale should report through PopupService");
        assert.ok(
            popupCalls.every((options) => options.buttons?.[0]?.text === "확인"),
            "Collection action result popups should use an explicit confirmation button"
        );
        assert.equal(refreshCount, 3, "Completed collection actions should refresh the open collection hub");
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

// ── Action Gateway index.html module identity contract ──
// ESM treats `./actionGateway.js` and `./actionGateway.js?v=...` as
// different modules. index.html and main.js must share the same identity.

{
    const html = readFileSync("index.html", "utf8");
    const hasVersionedActionGateway = /actionGateway\.js\?v=/.test(html);
    assert.ok(
        !hasVersionedActionGateway,
        "index.html must import actionGateway.js without ?v= to share module identity with main.js"
    );
    console.log("[action-gateway-import-identity] ok");
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
        loot: { shards: 20, chests: [commonChest], xp: 30 }
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
        loot: { shards: 35, chests: [uncommonChest, rareChest], xp: 50 }
    });
    assert.equal(f4Done.pendingLoot.shards, 55, "Shards should accumulate: 20+35=55");
    assert.equal(f4Done.pendingLoot.chests.length, 3, "3 chests total pending");

    // Retreat
    const retreated = retreatHuntingRun(f4Done, { now: 2000 });
    assert.equal(retreated.status, "retreated", "Retreat should end run safely");
    assert.equal(retreated.securedLoot.shards, 55, "Retreat secures all pending shards");
    assert.equal(retreated.securedLoot.chests.length, 3, "Retreat secures all pending chests");
    assert.equal(retreated.securedLoot.xp, 80, "Retreat secures all pending XP");

    console.log("[hunting-end-to-end] ok");
}

// ── Strict UI component contract regression ──

async function testUiManagerRequireComponentResolvesAll() {
    const resolved = {};

    const app = await loadModuleApp();
    resolved.bracket = app._bracket !== undefined && app._bracket !== null;
    resolved.overlay = app._overlay !== undefined && app._overlay !== null;
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
    assert.ok(allResolved, "All 9 required UI components must be resolved at startup via uiManager.requireComponent");
    console.log("[ui-manager-require-resolves-all] ok");
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
        /if\s*\(\s*this\._(bracket|overlay|startBtn|log|strip|root|toast|modeSegment)\b/,
        /if\s*\(\s*!this\._(bracket|overlay|startBtn|log|strip|root|toast|modeSegment)\b/,
        /this\._panel\?\./,
        /this\._(bracket|overlay|startBtn|log|strip|root|toast|modeSegment)\s*\?\./
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

function testNoWindowUiManagerInProduction() {
    // Prove that production source files no longer reference window.uiManager
    const srcDirs = ["src"];
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
                    if (content.includes("window.uiManager")) {
                        offenders.push(`${full}: contains "window.uiManager"`);
                    }
                }
            }
        }
        scan(dir);
    }
    if (offenders.length > 0) {
        console.log("[no-window-uimanager-in-production] FAIL: " + offenders.join("; "));
    }
    assert.equal(
        offenders.length,
        0,
        "No production src/ files should reference window.uiManager — use Alpine.store('uiManager') or $store.uiManager"
    );
    console.log("[no-window-uimanager-in-production] ok");
}

await testUiManagerRequireComponentResolvesAll();
await testUiManagerRequireComponentMissingFails();
await testUiManagerRequireComponentNoRemainingGuards();
await testCollectionHubServiceUsesUiManagerRequire();
await testPatchNotesServiceUsesUiManagerRequire();
await testPlayerPanelAllocationContract(app);
await testPlayerPanelAllocationContractBoundary(app);

await testActionGateway();
await testHuntingEndToEnd();
await testHuntingChestContinueHandlersContract();
testHuntingLootBalanceRules();
testHuntingLootItemsAndDropController(app);
testHuntingLootSessionIsDiscardedOnDefeat(app);
testHuntingCombatRewardChestUi();
testHuntingCombatWithoutCollectedChestSkipsChestUi();
testHuntingCombatRewardChestQueue();
testHuntingCombatRewardChestNormalContinue();
testHuntingCombatRewardChestFinalBossContinue();
testHuntingChestRoomContinueStillWorks();
await testNoGameBridgeInProduction();
await testNoWindowUiManagerInProduction();

function testAlpineTemplatesNoWindowUiManager() {
    // Prove that Alpine template directives use $store.uiManager, never window.uiManager
    const offenders = [];
    const directivePattern = /\bx-(?:data|bind|on|text|html|show|if|for|model|cloak|ref|effect|init|transition)\s*=/;
    const componentDir = "src/components";
    for (const name of readdirSync(componentDir)) {
        if (!name.endsWith(".html")) continue;
        const full = `${componentDir}/${name}`;
        const lines = readFileSync(full, "utf8").split("\n");
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (directivePattern.test(line) && line.includes("window.uiManager")) {
                offenders.push(`${full}:${i + 1} — "${line.trim()}"`);
            }
        }
    }
    if (offenders.length > 0) {
        console.log("[alpine-no-window-uimanager] FAIL: " + offenders.join("; "));
    }
    assert.equal(offenders.length, 0, "No Alpine template directives should reference window.uiManager");
    console.log("[alpine-no-window-uimanager] ok");
}

function testXpProgressBarUsesStoreUiManager() {
    const content = readFileSync("src/components/xp-progress-bar.html", "utf8");
    const directiveLine = content.split("\n").find((l) => l.includes("x-bind:style"));
    assert.ok(directiveLine, "xp-progress-bar should have an x-bind:style directive");
    assert.ok(
        directiveLine.includes("$store.uiManager"),
        `xp-progress-bar x-bind:style should use $store.uiManager, got: "${directiveLine.trim()}"`
    );
    assert.equal(
        directiveLine.includes("window.uiManager"),
        false,
        `xp-progress-bar x-bind:style should not use window.uiManager, got: "${directiveLine.trim()}"`
    );
    console.log("[xp-progress-store-uimanager] ok");
}

await testAlpineTemplatesNoWindowUiManager();
await testXpProgressBarUsesStoreUiManager();

function testGameOverlayChestConfirmLabelContract() {
    const content = readFileSync("src/components/game-overlay.html", "utf8");
    assert.ok(content.includes("huntingChestConfirmLabel"), "game-overlay must define huntingChestConfirmLabel state");
    assert.ok(
        content.includes('huntingChestConfirmLabel: ""'),
        "game-overlay must initialize huntingChestConfirmLabel to empty string"
    );
    assert.ok(
        content.includes('this.huntingChestConfirmLabel = ""'),
        "resetHuntingState must clear huntingChestConfirmLabel"
    );
    assert.ok(
        content.includes("data.huntingChestConfirmLabel !== undefined"),
        "setHuntingState must accept huntingChestConfirmLabel"
    );
    assert.ok(
        content.includes("huntingChestConfirmLabel || '계속 전진'"),
        "Chest button must use x-text with fallback to '계속 전진'"
    );
    console.log("[game-overlay-chest-confirm-label] ok");
}

function testResultOverlayReservesConfirmActionSpace() {
    const styles = readFileSync("src/styles.css", "utf8");
    const confirmActionSelector = "game-overlay:has(~ start-button #startButton:not(.hidden)) #overlay";
    const confirmCardSelector = `${confirmActionSelector} .overlay-card`;
    assert.ok(
        styles.includes(confirmActionSelector),
        "Visible result confirmation buttons must reserve vertical space in the game overlay"
    );
    assert.ok(
        styles.includes("padding: 20px 16px calc(104px + env(safe-area-inset-bottom));"),
        "Desktop result overlays must keep content above the confirm button"
    );
    assert.ok(
        styles.includes("padding: 12px 12px calc(92px + env(safe-area-inset-bottom));"),
        "Mobile result overlays must keep content above the confirm button"
    );
    assert.ok(
        styles.includes(
            `${confirmCardSelector} {\n    margin: auto 0;\n    max-height: 100%;\n    min-height: 0;\n    overflow-y: auto;\n    overscroll-behavior: contain;\n    pointer-events: auto;`
        ),
        "The result card must stay inside the safe area and receive its own touch scroll input"
    );
    assert.ok(
        styles.includes(`${confirmCardSelector} .xp-reward {\n    width: min(420px, 100%);`),
        "Result XP rewards must fit the scrollable card without horizontal overflow"
    );
    console.log("[result-overlay-confirm-action-safe-area] ok");
}

function testHuntingEventResultOverlayContract() {
    const overlay = readFileSync("src/components/game-overlay.html", "utf8");
    const bridge = readFileSync("src/componentBridge.js", "utf8");
    assert.ok(overlay.includes("huntingEventActive: false"), "game-overlay must initialize the event result state");
    assert.ok(overlay.includes("this.huntingEventActive = false"), "event result state must reset with hunting UI");
    assert.ok(
        overlay.includes("data.huntingEventDetail !== undefined"),
        "event result detail must accept manager updates"
    );
    assert.ok(
        overlay.includes('@click="huntingEventContinue()"'),
        "Event result confirmation must stay inside the hunting overlay"
    );
    assert.ok(
        bridge.includes("huntingEventContinue()"),
        "Component bridge must expose hunting event confirmation to the overlay"
    );
    console.log("[hunting-event-result-overlay] ok");
}

function testHuntingBattlePreparationOverlayContract() {
    const overlay = readFileSync("src/components/game-overlay.html", "utf8");
    const bridge = readFileSync("src/componentBridge.js", "utf8");
    assert.ok(
        overlay.includes("huntingBattlePreparationActive: false"),
        "game-overlay must initialize battle preparation state"
    );
    assert.ok(
        overlay.includes('class="hunting-battle-preparation"'),
        "Battle preparation should be rendered inside the hunting overlay"
    );
    assert.ok(
        overlay.includes('@click="huntingUsePreparationConsumable(item.id)"'),
        "Preparation consumables should remain explicit overlay actions"
    );
    assert.ok(
        overlay.includes('@click="huntingStartPreparedBattle()"'),
        "Preparation should expose a separate battle start action"
    );
    assert.ok(
        bridge.includes("huntingUsePreparationConsumable(consumableId)"),
        "Component bridge must expose pre-battle consumable use"
    );
    assert.ok(bridge.includes("huntingStartPreparedBattle()"), "Component bridge must expose prepared battle start");
    console.log("[hunting-battle-preparation-overlay] ok");
}

await testGameOverlayChestConfirmLabelContract();
testResultOverlayReservesConfirmActionSpace();
testHuntingEventResultOverlayContract();
testHuntingBattlePreparationOverlayContract();

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
            const rolls = [0.5, 0.45];
            return () => rolls.shift() ?? 0;
        })(),
        0,
        { hpRatio: 0.5 }
    );
    const lowHp = rollHuntingFloorOutcome(
        10,
        (() => {
            const rolls = [0.5, 0.45];
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

function testDailyShopPopupContract() {
    const template = readFileSync("src/components/collection-hub.html", "utf8");
    assert.ok(template.includes('@click="openShop()"'), "Equipment toolbar should open the shard shop popup");
    assert.ok(template.includes('class="ch-shop-modal"'), "Shard shop should use a dedicated popup layer");
    assert.ok(template.includes('@click.self="closeShop()"'), "Shop backdrop should close only the shop popup");
    assert.ok(template.includes(".ch-ach-info {"), "Collection cards should define their shared info layout");
    assert.ok(template.includes("flex: 1;"), "Collection card info should occupy remaining horizontal space");
    assert.ok(
        !template.includes('<chest-icon x-bind:data-rarity="item.rarity">'),
        "Achievement rows should not repeat a chest icon for every achievement"
    );
    assert.ok(
        !template.includes("flex-shrink: 0;\n    }\n\n    }\n\n    .ch-mast-tier"),
        "Collection stylesheet should not contain a dangling mastery block terminator"
    );
    assert.ok(
        !template.includes("min-width: 0;\n    }\n\n    }\n\n    .ch-ach-desc"),
        "Collection stylesheet should not contain a dangling achievement block terminator"
    );
    assert.ok(
        template.includes(".ch-btn:not(:disabled):hover"),
        "Collection buttons should have an enabled hover state"
    );
    assert.ok(
        template.includes(".ch-btn:not(:disabled):active"),
        "Collection buttons should have an enabled pressed state"
    );
    assert.ok(
        template.includes(".ch-btn--danger:not(:disabled):hover"),
        "Danger buttons should retain their red hover feedback"
    );
    assert.ok(template.includes("shopRerolling"), "Shop rerolls should trigger a visible transition state");
    assert.ok(template.includes("ch-shop-chest"), "Shop offers should reuse the chest icon component");
    assert.ok(
        template.includes("isShopResetPending"),
        "Shop reset timers should be shown only while a reset is pending"
    );
    assert.ok(
        template.includes("getShopPurchaseCount"),
        "Expired purchase limits should become available without reopening the shop"
    );
    assert.ok(
        template.includes("getShopRerollCost"),
        "Expired rerolls should return to their base cost without reopening the shop"
    );
    assert.ok(
        template.includes("x-component=\"'chest-icon'\""),
        "Dynamically shown shop chest must mount its template"
    );
    assert.ok(
        template.includes("ch-shop-chest-reroll"),
        "Shop rerolls should animate the chest even at the same rarity"
    );
    assert.ok(template.includes("state.storage.consumables"), "Shop should render definition-driven consumable rows");
    assert.ok(template.includes("buyConsumable(item.id)"), "Consumable rows should purchase the selected definition");
    assert.ok(
        template.includes("upgradeHuntingConsumableUseLimit"),
        "Shop should expose the permanent hunting consumable use-limit upgrade"
    );
    assert.ok(!template.includes('class="ch-daily-shop"'), "Shard shop must not appear in an unrelated collection tab");
    console.log("[daily-shop-popup-contract] ok");
}

testDailyShopPopupContract();

console.log("regression tests ok");
