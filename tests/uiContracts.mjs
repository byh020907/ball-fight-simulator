import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import {
    EQUIPMENT_SPECIAL_OPTION_DESCRIPTIONS,
    getEquipmentSpecialOptionDescription
} from "../src/hunting/equipmentConfig.js";
import { createCollectionHubViewModel } from "../src/collection/collectionViewModel.js";
import { createDefaultPlayerProfile } from "../src/playerProfile.js";
import { createRoster } from "../src/roster.js";
import { MASTERY_EFFECT_DEFS } from "../src/character-mastery/masteryDefinitions.js";
import { getCombinedHealthBarPercentages } from "../src/fighterHealthBar.js";
import { renderCharacterPortrait } from "../src/characterPortrait.js";
import {
    getRegisteredTags,
    getRegisteredTagMetadata,
    getUnknownTagMetadata,
    getTagLabel,
    resolveTagDraw,
    renderIconTag,
    EquipmentIconTagController
} from "../src/equipmentIconTags.js";

function readSource(path) {
    return readFileSync(path, "utf8");
}

function testDisabledHuntingUiIsNotMounted() {
    const content = readSource("src/components/hunting-overlay.html");
    const manager = readSource("src/hunting/huntingManager.js");
    assert.equal(/huntingMerchant|hunting-merchant/.test(content), false, "Disabled merchant UI must not stay mounted");
    assert.equal(
        /huntingSwapCharacter|hunting-party-action|formatHuntingPartyHealth/.test(content),
        false,
        "Disabled swap controls must not leave unused component state or styles"
    );
    assert.equal(
        /huntingPartyHudVisible|_syncCombatPartyUi/.test(`${content}\n${manager}`),
        false,
        "Combat must not keep syncing an empty party HUD after swap controls are disabled"
    );
    console.log("[disabled-hunting-ui-not-mounted] ok");
}

function testHuntingChestIconReuseContract() {
    const chestIcon = readSource("src/components/chest-icon.html");
    const overlay = readSource("src/components/hunting-overlay.html");
    const collectionShopPanel = readSource("src/components/collection-shop-panel.html");
    assert.ok(chestIcon.includes('chest-icon[data-rarity="rare"]'), "Chest icon should own rarity color variants");
    assert.ok(overlay.includes("<chest-icon"), "Hunting chest event should render the shared chest icon");
    assert.ok(
        collectionShopPanel.includes("ch-shop-chest"),
        "The shop should render the shared chest icon for its chest offer"
    );
    console.log("[hunting-chest-icon-reuse] ok");
}

function testCollectionEquipmentPanelsOwnTheirFlows() {
    const collectionHub = readSource("src/components/collection-hub.html");
    const equipmentPanel = readSource("src/components/collection-equipment-panel.html");
    const fusionDialog = readSource("src/components/collection-fusion-dialog.html");
    const shopPanel = readSource("src/components/collection-shop-panel.html");

    assert.ok(
        collectionHub.includes(
            "<collection-equipment-panel x-show=\"state.activeTab === 'equipment'\"></collection-equipment-panel>"
        ) &&
            collectionHub.includes("<collection-fusion-dialog>") &&
            collectionHub.includes("<collection-shop-panel>"),
        "Collection hub should compose the equipment tab, fusion dialog, and shop from dedicated components"
    );
    assert.equal(
        collectionHub.includes("ch-fusion-modal") || collectionHub.includes("ch-shop-modal"),
        false,
        "Collection hub must not retain modal markup after moving it to its owner components"
    );
    const equipmentHostRule = collectionHub.match(/collection-equipment-panel\s*\{([^}]*)\}/s)?.[1] ?? "";
    const equipmentRootRule = collectionHub.match(/collection-equipment-panel\s*>\s*div\s*\{([^}]*)\}/s)?.[1] ?? "";
    const overlayPanelHostRule =
        collectionHub.match(/collection-fusion-dialog,\s*collection-shop-panel\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        equipmentHostRule,
        /display:\s*flex;[\s\S]*flex:\s*1\s+1\s+0;[\s\S]*min-height:\s*0;/,
        "The active equipment host must own a shrinkable flex boundary inside the collection frame"
    );
    assert.match(
        equipmentRootRule,
        /display:\s*flex;[\s\S]*flex:\s*1\s+1\s+0;[\s\S]*min-height:\s*0;/,
        "The equipment panel root must pass the available height to its scrollable content"
    );
    assert.match(
        overlayPanelHostRule,
        /display:\s*contents;/,
        "Overlay-only panel hosts must remain outside the collection frame layout"
    );
    assert.ok(
        equipmentPanel.includes('window.createGameUI("collectionEquipmentPanel"') &&
            equipmentPanel.includes('requireComponent("collectionHub")') &&
            equipmentPanel.includes('invokeGameAction("equipItem", instanceId)') &&
            equipmentPanel.includes('requireComponent("collectionFusionDialog").show()') &&
            equipmentPanel.includes('requireComponent("collectionShopPanel").show()'),
        "Equipment panel should render shared hub state and route its own equipment actions through uiManager"
    );
    assert.ok(
        fusionDialog.includes('window.createGameUI("collectionFusionDialog"') &&
            fusionDialog.includes('invokeGameAction("fuseEquipmentItems", sourceInstanceIds)') &&
            fusionDialog.includes("function recommendedItems()") &&
            fusionDialog.includes("function hide()"),
        "Fusion dialog should own its visibility and recommended-material lifecycle"
    );
    assert.ok(
        shopPanel.includes('window.createGameUI("collectionShopPanel"') &&
            shopPanel.includes("rerolling: false") &&
            shopPanel.includes('invokeGameAction("buyDailyShopChest")') &&
            shopPanel.includes('invokeGameAction("rerollDailyShop")') &&
            shopPanel.includes("function playOfferSwapAnimation()"),
        "Shop panel should own its visibility, countdown, and reroll animation lifecycle"
    );
    console.log("[collection-equipment-panel-ownership] ok");
}

function testEquipmentSpecialOptionTooltipContract() {
    const equipmentPanel = readSource("src/components/collection-equipment-panel.html");
    const expectedOptionTypes = ["crashDamage", "cooldown", "hpSteal", "mass", "wallBounce", "angularImpulse"];

    assert.deepEqual(
        Object.keys(EQUIPMENT_SPECIAL_OPTION_DESCRIPTIONS),
        expectedOptionTypes,
        "Every equipment special option should expose one effect description"
    );
    for (const description of Object.values(EQUIPMENT_SPECIAL_OPTION_DESCRIPTIONS)) {
        assert.match(description, /[가-힣]/, "Equipment special option descriptions should be readable Korean text");
    }
    const profile = createDefaultPlayerProfile();
    profile.equipment.inventory = expectedOptionTypes.map((type) => ({
        instanceId: `tooltip-${type}`,
        rarity: "common",
        slot: "weapon",
        name: type,
        stats: [],
        specialOptions: [{ type, value: 10 }]
    }));
    const viewModel = createCollectionHubViewModel({ profile, roster: [] });
    assert.deepEqual(
        viewModel.equipment.items.map((item) => item.specialOptions[0].description),
        expectedOptionTypes.map((type) => EQUIPMENT_SPECIAL_OPTION_DESCRIPTIONS[type]),
        "The collection view model should expose each special option effect description to the equipment panel"
    );
    assert.ok(
        equipmentPanel.includes('x-for="option in item.specialOptions"') &&
            equipmentPanel.includes('role="tooltip"') &&
            equipmentPanel.includes('tabindex="0"') &&
            equipmentPanel.includes('x-teleport="body"'),
        "Equipment special options should render individually with one focusable, teleported tooltip"
    );
    assert.ok(
        equipmentPanel.includes('@mouseenter="openSpecialTooltip(item, option, $el)"') &&
            equipmentPanel.includes('@focus="openSpecialTooltip(item, option, $el)"') &&
            equipmentPanel.includes('@click="openSpecialTooltip(item, option, $el)"') &&
            equipmentPanel.includes('@mouseleave="closeSpecialTooltip()"') &&
            equipmentPanel.includes('@blur="closeSpecialTooltip()"') &&
            equipmentPanel.includes('@keydown.escape.window="closeSpecialTooltip()"') &&
            equipmentPanel.includes('@scroll="closeSpecialTooltip()"'),
        "Special option tooltips should open for pointer, keyboard, and touch then close on leave, blur, outside tap, Escape, or list scroll"
    );
    const panelRoot = equipmentPanel.match(/^<div\s+[^>]*>/)?.[0] ?? "";
    const specialOptionOpenTag = equipmentPanel.match(/<span\s+class="ch-equip-special-option"[\s\S]*?>/)?.[0] ?? "";
    assert.ok(
        panelRoot.includes('@click.outside="closeSpecialTooltip()"') &&
            !specialOptionOpenTag.includes("@click.outside"),
        "Only the panel root should close on an outside tap, so tapping one option cannot be cancelled by sibling options"
    );
    assert.ok(
        equipmentPanel.includes("position: fixed") &&
            equipmentPanel.includes("getBoundingClientRect") &&
            equipmentPanel.includes('x-bind:style="specialTooltip.style"') &&
            equipmentPanel.includes('x-ref="specialTooltip"'),
        "The tooltip should use a teleported fixed viewport anchor whose reactive style is measured after rendering"
    );
    assert.ok(
        equipmentPanel.includes("this.$nextTick(() => {") &&
            equipmentPanel.includes("this.$refs.specialTooltip") &&
            equipmentPanel.includes("tooltip.getBoundingClientRect()") &&
            equipmentPanel.includes("document.documentElement.clientWidth") &&
            equipmentPanel.includes("document.documentElement.clientHeight") &&
            equipmentPanel.includes("canFitBelow") &&
            equipmentPanel.includes("canFitAbove") &&
            equipmentPanel.includes("max-height: calc(100vh - 1rem)") &&
            !equipmentPanel.includes("tooltipWidth") &&
            !equipmentPanel.includes("tooltipHeight") &&
            !equipmentPanel.includes("globalThis.innerWidth"),
        "The tooltip should measure its actual rendered size, choose an above or below placement, and clamp it inside the viewport"
    );
    assert.equal(
        getEquipmentSpecialOptionDescription("legacyUnknown"),
        "특수 전투 효과를 적용합니다.",
        "Unknown legacy special options should keep a safe description fallback"
    );
    console.log("[equipment-special-option-tooltip] ok");
}

function testDailyShopPopupContract() {
    const collectionHub = readSource("src/components/collection-hub.html");
    const equipmentPanel = readSource("src/components/collection-equipment-panel.html");
    const shopPanel = readSource("src/components/collection-shop-panel.html");
    assert.ok(equipmentPanel.includes('@click="openShop()"'), "Equipment toolbar should open the shard shop popup");
    assert.ok(shopPanel.includes('class="ch-shop-modal"'), "Shard shop should use a dedicated popup layer");
    assert.ok(shopPanel.includes('@click.self="hide()"'), "Shop backdrop should close only the shop popup");
    assert.ok(collectionHub.includes(".ch-ach-info {"), "Collection cards should define their shared info layout");
    assert.ok(collectionHub.includes("flex: 1;"), "Collection card info should occupy remaining horizontal space");
    assert.ok(
        !collectionHub.includes('<chest-icon x-bind:data-rarity="item.rarity">'),
        "Achievement rows should not repeat a chest icon for every achievement"
    );
    assert.ok(
        !collectionHub.includes("flex-shrink: 0;\n    }\n\n    }\n\n    .ch-mast-tier"),
        "Collection stylesheet should not contain a dangling mastery block terminator"
    );
    assert.ok(
        !collectionHub.includes("min-width: 0;\n    }\n\n    }\n\n    .ch-ach-desc"),
        "Collection stylesheet should not contain a dangling achievement block terminator"
    );
    assert.ok(
        collectionHub.includes(".ch-btn:not(:disabled):hover"),
        "Collection buttons should have an enabled hover state"
    );
    assert.ok(
        collectionHub.includes(".ch-btn:not(:disabled):active"),
        "Collection buttons should have an enabled pressed state"
    );
    assert.ok(
        collectionHub.includes(".ch-btn--danger:not(:disabled):hover"),
        "Danger buttons should retain their red hover feedback"
    );
    assert.ok(shopPanel.includes("rerolling"), "Shop rerolls should trigger a visible transition state");
    assert.ok(shopPanel.includes("ch-shop-chest"), "Shop offers should reuse the chest icon component");
    assert.ok(
        shopPanel.includes("isShopResetPending"),
        "Shop reset timers should be shown only while a reset is pending"
    );
    assert.ok(
        shopPanel.includes("getShopPurchaseCount"),
        "Expired purchase limits should become available without reopening the shop"
    );
    assert.ok(
        shopPanel.includes("getShopRerollCost"),
        "Expired rerolls should return to their base cost without reopening the shop"
    );
    assert.ok(
        shopPanel.includes("x-component=\"'chest-icon'\""),
        "Dynamically shown shop chest must mount its template"
    );
    assert.ok(
        shopPanel.includes("ch-shop-chest-reroll"),
        "Shop rerolls should animate the chest even at the same rarity"
    );
    assert.match(
        shopPanel,
        /function playOfferSwapAnimation\(\)\s*\{\s*state\.rerolling = false;\s*requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => \(state\.rerolling = true\)\)\);\s*setTimeout\(\(\) => \(state\.rerolling = false\), 650\);\s*\}/s,
        "Shop offer replacement should replay its 650ms animation through one shared UI helper"
    );
    assert.match(
        shopPanel,
        /buyDailyShopChest\(\)\s*\{\s*const chest = Alpine\.store\("uiManager"\)\.invokeGameAction\("buyDailyShopChest"\);\s*if \(chest\) playOfferSwapAnimation\(\);\s*return chest;\s*\}/s,
        "A successful chest purchase should use the shared offer replacement animation, while failures should not"
    );
    assert.match(
        shopPanel,
        /rerollDailyShop\(\)\s*\{\s*const result = Alpine\.store\("uiManager"\)\.invokeGameAction\("rerollDailyShop"\);\s*if \(!result\) return result;\s*playOfferSwapAnimation\(\);\s*return result;\s*\}/s,
        "A successful manual reroll should use the shared offer replacement animation, while failures should not"
    );
    assert.ok(
        !shopPanel.includes("consumable") && !shopPanel.includes("물약"),
        "Removed consumables must not leave shop controls behind"
    );
    assert.ok(
        !collectionHub.includes('class="ch-daily-shop"'),
        "Shard shop must not appear in an unrelated collection tab"
    );
    console.log("[daily-shop-popup-contract] ok");
}

function testFusionEquippedLabelTypographyContract() {
    const template = readSource("src/components/collection-fusion-dialog.html");
    assert.ok(
        template.includes('aria-label="추천 합성 재료"') && template.includes("recommendedItems()[index - 1]"),
        "Fusion should present the exact recommended source items before execution"
    );
    assert.ok(
        template.includes("능력치 가치가 가장 낮은 비장착 장비 3개"),
        "Fusion should explain its deterministic low-value recommendation rule"
    );
    assert.ok(
        !template.includes("toggleItem(") && !template.includes("ch-fusion-candidate"),
        "Fusion should not retain manual material-selection controls"
    );
    assert.match(
        template,
        /\.ch-fusion-source-slots\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
        "Recommended fusion sources should use a fluid three-column grid"
    );
    console.log("[fusion-recommended-source-layout] ok");
}

function loadCollectionComponentFactory(path, expectedName, factories) {
    const source = readSource(path);
    const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script, `${path} should define its Alpine component script`);
    Function(script)();
    assert.equal(typeof factories[expectedName], "function", `${path} should register ${expectedName}`);
    return factories[expectedName];
}

function withGlobalPropertyStubs(stubs, callback) {
    const originalDescriptors = new Map(
        Object.keys(stubs).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
    );

    try {
        Object.entries(stubs).forEach(([name, value]) => {
            Object.defineProperty(globalThis, name, { configurable: true, value });
        });
        return callback();
    } finally {
        originalDescriptors.forEach((descriptor, name) => {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        });
    }
}

function testEquipmentSpecialTooltipInteractionContract() {
    const factories = {};

    withGlobalPropertyStubs(
        {
            window: {
                createGameUI(name, factory) {
                    factories[name] = factory;
                }
            },
            Alpine: { store() {} },
            document: { documentElement: { clientWidth: 360, clientHeight: 800 } }
        },
        () => {
            const createEquipmentPanel = loadCollectionComponentFactory(
                "src/components/collection-equipment-panel.html",
                "collectionEquipmentPanel",
                factories
            );
            const panel = createEquipmentPanel();
            panel.$refs = {
                specialTooltip: {
                    getBoundingClientRect() {
                        return { width: 220, height: 64 };
                    }
                }
            };
            panel.$nextTick = (callback) => callback();
            const anchor = {
                getBoundingClientRect() {
                    return { left: 320, top: 700, bottom: 724 };
                }
            };
            const item = { instanceId: "mobile-tooltip" };
            const option = { type: "hpSteal", description: "긴 갈망 설명" };

            panel.openSpecialTooltip(item, option, anchor);
            assert.equal(panel.specialTooltip.visible, true, "One tap should leave its tooltip open");
            assert.equal(
                panel.specialTooltip.placement,
                "above",
                "A bottom-edge anchor should place the tooltip above"
            );
            assert.match(
                panel.specialTooltip.style,
                /left:\s*132px/,
                "A right-edge anchor should clamp tooltip placement"
            );

            panel.closeSpecialTooltip();
            assert.equal(
                panel.specialTooltip.visible,
                false,
                "Blur or an outside panel tap should close the visible tooltip"
            );
        }
    );

    console.log("[equipment-special-option-tooltip-interaction] ok");
}

function testCollectionEquipmentPanelsShareHubState() {
    const factories = {};
    const components = {};
    const calls = [];
    let observedElement = null;
    const uiManager = {
        requireComponent(componentId) {
            const component = components[componentId];
            assert.ok(component, `${componentId} should be available through uiManager`);
            return component;
        },
        invokeGameAction(actionName, ...args) {
            calls.push([actionName, args]);
            return { actionName, args };
        }
    };

    withGlobalPropertyStubs(
        {
            window: {
                createGameUI(name, factory) {
                    factories[name] = factory;
                }
            },
            Alpine: {
                reactive(value) {
                    return value;
                },
                store(name) {
                    assert.equal(name, "uiManager", "Collection child components should only request uiManager");
                    return uiManager;
                }
            },
            ResizeObserver: class {
                constructor() {}

                observe(element) {
                    observedElement = element;
                }

                disconnect() {}
            }
        },
        () => {
            const createHub = loadCollectionComponentFactory(
                "src/components/collection-hub.html",
                "collectionHub",
                factories
            );
            const hub = createHub();
            hub.$root = { focus() {}, querySelector() {} };
            components.collectionHub = hub;
            hub.init();
            assert.equal(
                observedElement,
                hub.$root,
                "Collection hub should observe its frame size for active tab visibility"
            );
            hub.state.equipment = {
                enhancementStones: 30,
                fusion: {
                    sourceItemCount: 1,
                    recipes: [
                        {
                            rarity: "common",
                            recommendedItems: [{ instanceId: "source-1", isEquipped: false }],
                            cost: { shards: 20 }
                        }
                    ]
                }
            };
            hub.state.storage = { shards: 50 };

            const createFusion = loadCollectionComponentFactory(
                "src/components/collection-fusion-dialog.html",
                "collectionFusionDialog",
                factories
            );
            components.collectionFusionDialog = createFusion();
            const createShop = loadCollectionComponentFactory(
                "src/components/collection-shop-panel.html",
                "collectionShopPanel",
                factories
            );
            components.collectionShopPanel = createShop();
            const createEquipmentPanel = loadCollectionComponentFactory(
                "src/components/collection-equipment-panel.html",
                "collectionEquipmentPanel",
                factories
            );
            components.collectionEquipmentPanel = createEquipmentPanel();

            components.collectionEquipmentPanel.openFusion();
            assert.equal(
                components.collectionFusionDialog.state.visible,
                true,
                "Equipment panel should open the fusion dialog"
            );
            assert.equal(
                components.collectionFusionDialog.state.rarity,
                "common",
                "Fusion should select its first recipe"
            );
            components.collectionFusionDialog.fuseRecommendedItems();
            assert.deepEqual(
                calls.at(-1),
                ["fuseEquipmentItems", [["source-1"]]],
                "Fusion should use the game action bridge"
            );
            assert.equal(
                components.collectionFusionDialog.state.visible,
                true,
                "Fusion should remain open so the next recommendation can appear after one fusion"
            );

            components.collectionEquipmentPanel.openShop();
            assert.equal(
                components.collectionShopPanel.state.visible,
                true,
                "Equipment panel should open the shop panel"
            );
            hub.close();
            assert.equal(
                components.collectionShopPanel.state.visible,
                false,
                "Closing the hub should hide the shop panel"
            );
            assert.equal(
                components.collectionFusionDialog.state.visible,
                false,
                "Closing the hub should reset the fusion dialog"
            );
        }
    );

    console.log("[collection-equipment-panel-shared-state] ok");
}

function testCollectionDetailContracts() {
    const collectionHub = readSource("src/components/collection-hub.html");
    assert.ok(collectionHub.includes("상세 정보"), "Character detail should expose an overview tab");
    assert.ok(collectionHub.includes("레벨 보상"), "Character detail should expose a level rewards tab");
    assert.ok(collectionHub.includes("reward.statusLabel"), "Level reward rows should expose earned status");
    assert.ok(
        !collectionHub.includes("목록으로"),
        "Character detail should not duplicate the always-visible roster navigation"
    );
    assert.ok(
        collectionHub.includes("closeCollectionCharacterDetail") &&
            collectionHub.includes('aria-label="캐릭터 상세 닫기"'),
        "Character detail should expose a close control that only clears its selection"
    );
    assert.ok(
        collectionHub.includes("캐릭터") &&
            collectionHub.includes("몬스터") &&
            collectionHub.includes("setCodexSection"),
        "Codex should switch characters and monsters inside the existing roster tab"
    );
    assert.ok(
        collectionHub.includes("selectedMonsterRegionId") && collectionHub.includes("selectedMonsterRegion(item)"),
        "Monster detail should preserve a selected unlocked region"
    );
    assert.ok(
        collectionHub.includes("첫 조우 후 상세 공개") &&
            collectionHub.includes("이 지역에서는 아직 조우하지 않았습니다."),
        "Monster codex should distinguish unknown monsters from unknown regional variants"
    );
    assert.ok(
        collectionHub.includes("전체 처치") && collectionHub.includes("선택 지역 처치"),
        "Monster detail should show type-wide and selected-region kill statistics"
    );
    assert.ok(
        collectionHub.includes("closeCollectionMonsterDetail") &&
            collectionHub.includes('aria-label="몬스터 상세 닫기"'),
        "Monster detail should expose a close control that only clears its selection"
    );
    console.log("[collection-detail-contracts] ok");
}

function testEquipmentCurrencyContract() {
    const equipmentPanel = readSource("src/components/collection-equipment-panel.html");
    assert.ok(
        equipmentPanel.includes('x-text="state.equipment.shards"') &&
            equipmentPanel.includes('x-text="state.equipment.enhancementStones"'),
        "Equipment toolbar should show both shards spent by equipment actions and enhancement recovery stones"
    );
    console.log("[collection-equipment-currency] ok");
}

function testDefenseHelpCopyContract() {
    const helpContent = readSource("src/helpContent.js");
    const playerPanel = readSource("src/components/player-panel.html");
    assert.match(
        helpContent,
        /방어력 \(DEF\).*1포인트당 방어력이 1 증가.*방어 100.*50%/,
        "Help should explain direct defense rating points and the 100-rating half-damage point"
    );
    assert.ok(
        playerPanel.includes("stat.key === 'defense' ? '' : '%'"),
        "Player panel should omit the percent suffix only for direct defense allocation"
    );
    console.log("[defense-help-copy] ok");
}

function testPopupCloseOwnershipContract() {
    const collectionHub = readSource("src/components/collection-hub.html");
    const popupDialog = readSource("src/components/popup-dialog.html");
    const patchNotes = readSource("src/components/patch-notes.html");
    const actionPicker = readSource("src/components/action-picker.html");

    assert.ok(
        collectionHub.includes('@click.self="closeCollectionHub()"') &&
            collectionHub.includes('@keydown.escape="closeCollectionHub()"'),
        "Collection hub should own backdrop and Escape closing"
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
        popupDialog.includes("@keydown.escape=\"closePopup('close')\"") &&
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

function testGameplayUiResetContracts() {
    const components = [
        ["src/components/game-overlay.html", "game overlay"],
        ["src/components/hunting-overlay.html", "hunting overlay"],
        ["src/components/xp-reward-panel.html", "XP reward panel"],
        ["src/components/fighter-strip.html", "fighter strip"],
        ["src/components/tournament-bracket.html", "tournament bracket"],
        ["src/components/player-panel.html", "player panel"],
        ["src/components/mode-segment.html", "mode segment"],
        ["src/components/start-button.html", "start button"],
        ["src/components/toast-notification.html", "toast notification"]
    ];

    components.forEach(([path, name]) => {
        assert.ok(readSource(path).includes("reset()"), `${name} should expose an explicit reset interface`);
    });
    const fighterStrip = readSource("src/components/fighter-strip.html");
    const layoutStyles = readSource("src/styles.css");
    const index = readSource("index.html");
    assert.ok(
        fighterStrip.includes("max-width: 100%") && fighterStrip.includes("text-overflow: ellipsis"),
        "Fighter cards should constrain long mobile labels inside their fluid grid cell"
    );
    assert.ok(
        fighterStrip.includes(":scope:has(.fighter-card:nth-of-type(2))") &&
            fighterStrip.includes(":scope:has(.fighter-card:nth-of-type(3))") &&
            !fighterStrip.includes(":scope:has(.fighter-card:nth-child(3))"),
        "The fighter layout should count actual fighter articles without treating the Alpine template as a card"
    );
    assert.ok(
        index.includes('class="arena-slot"') &&
            layoutStyles.includes("grid-template-rows: minmax(0, 1fr) auto") &&
            layoutStyles.includes("container-type: size") &&
            !layoutStyles.includes("calc(100vh - 208px)"),
        "Desktop battle layout should size the arena from its remaining grid row instead of a fixed viewport deduction"
    );
    assert.ok(
        layoutStyles.includes("--desktop-side-rail:") &&
            /grid-template-columns:\s*minmax\(var\(--desktop-side-rail\),\s*1fr\)\s*minmax\(0,\s*852px\)\s*minmax\(\s*var\(--desktop-side-rail\),\s*1fr\s*\)/s.test(
                layoutStyles
            ) &&
            layoutStyles.includes("grid-column: 2") &&
            layoutStyles.includes("grid-column: 3") &&
            layoutStyles.includes("justify-self: start"),
        "Desktop tournament layout should center the arena and keep the bracket beside it, clear of the outer battle log"
    );
    assert.ok(
        fighterStrip.includes("grid-template-columns: minmax(0, 1fr)") &&
            fighterStrip.includes(":scope:has(.fighter-card:nth-of-type(2))") &&
            fighterStrip.includes("grid-template-columns: repeat(2, minmax(0, 1fr))") &&
            fighterStrip.includes(":scope:has(.fighter-card:nth-of-type(3))") &&
            fighterStrip.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"),
        "One-, two-, and three-member hunting parties should use a fluid column count that matches active fighters"
    );
    assert.ok(
        fighterStrip.includes("grid-template: 1fr / 1fr") &&
            fighterStrip.includes('class="shield-fill"') &&
            !fighterStrip.includes('class="shield-bar"'),
        "Shield UI should share the existing health bar instead of adding a second bar"
    );
    assert.ok(
        fighterStrip.includes("fighter.revivalBattlesUntilReturn > 0") &&
            fighterStrip.includes("fighter.revivalLabel") &&
            fighterStrip.includes("companion-revival-state"),
        "Resting companion cards should remain visible with a battle-count revival state"
    );
    const huntingOverlay = readSource("src/components/hunting-overlay.html");
    assert.ok(
        huntingOverlay.includes("resetHuntingState()"),
        "Hunting overlay should expose an explicit hunting state reset"
    );
    assert.ok(huntingOverlay.includes("this.huntingFloor = 1;"), "Hunting reset should restore the first floor");
    assert.ok(
        huntingOverlay.includes('this.huntingCharacterName = "";'),
        "Hunting reset should clear the prior character"
    );
    assert.ok(
        huntingOverlay.includes('this.huntingLootSummary = "";'),
        "Hunting reset should clear prior loot summary"
    );
    assert.ok(huntingOverlay.includes("this.resetHuntingState();"), "Overlay hide should invoke the hunting reset");
    const appSource = readSource("src/app.js");
    assert.ok(
        appSource.includes("resetHuntingUiState()"),
        "BattleApp should own an explicit hunting UI reset entry point"
    );
    assert.ok(
        appSource.includes("resetGameplayUiState()"),
        "BattleApp should own the result-confirmation UI reset entry point"
    );
    console.log("[gameplay-ui-reset-contract] ok");
}

function testCombinedHealthBarProportions() {
    const fullHealth = getCombinedHealthBarPercentages({ hp: 100, maxHp: 100, shield: 0, maximumShield: 50 });
    assert.equal(fullHealth.hpPct, 100, "Full HP without an active shield must fill the health bar");
    assert.equal(fullHealth.shieldPct, 0, "Inactive shield capacity must not reserve empty bar space");

    const partialArmor = getCombinedHealthBarPercentages({ hp: 100, maxHp: 100, shield: 25, maximumShield: 50 });
    assert.equal(partialArmor.hpPct, 80, "Full HP should use its real share of current combined health");
    assert.equal(partialArmor.shieldPct, 20, "Current shield should use its real share of current combined health");

    const fullArmor = getCombinedHealthBarPercentages({ hp: 100, maxHp: 100, shield: 50, maximumShield: 50 });
    assert.ok(Math.abs(fullArmor.hpPct - 100 / 1.5) < 1e-9, "Full HP should occupy two thirds of Hero capacity");
    assert.ok(
        Math.abs(fullArmor.shieldPct - 50 / 1.5) < 1e-9,
        "A half-max-HP shield should occupy one third of combined capacity"
    );
    assert.ok(Math.abs(fullArmor.hpPct + fullArmor.shieldPct - 100) < 1e-9, "Full HP and shield should fill one bar");
    console.log("[combined-health-bar-proportions] ok");
}

function testNoWindowUiManagerInProduction() {
    const offenders = [];
    function scan(path) {
        for (const name of readdirSync(path)) {
            const full = `${path}/${name}`;
            const stat = statSync(full);
            if (stat.isDirectory()) scan(full);
            else if (
                (full.endsWith(".js") || full.endsWith(".html")) &&
                readSource(full).includes("window.uiManager")
            ) {
                offenders.push(`${full}: contains window.uiManager`);
            }
        }
    }
    scan("src");
    assert.equal(
        offenders.length,
        0,
        "No production src/ files should reference window.uiManager — use Alpine.store('uiManager') or $store.uiManager"
    );
    console.log("[no-window-uimanager-in-production] ok");
}

function testAlpineTemplateUiManagerContracts() {
    const offenders = [];
    const directivePattern = /\bx-(?:data|bind|on|text|html|show|if|for|model|cloak|ref|effect|init|transition)\s*=/;
    for (const name of readdirSync("src/components")) {
        if (!name.endsWith(".html")) continue;
        const full = `src/components/${name}`;
        readSource(full)
            .split("\n")
            .forEach((line, index) => {
                if (directivePattern.test(line) && line.includes("window.uiManager")) {
                    offenders.push(`${full}:${index + 1} — ${line.trim()}`);
                }
            });
    }
    assert.equal(offenders.length, 0, "No Alpine template directives should reference window.uiManager");

    const xpProgress = readSource("src/components/xp-progress-bar.html");
    const directiveLine = xpProgress.split("\n").find((line) => line.includes("x-bind:style"));
    assert.ok(directiveLine?.includes("$store.uiManager"), "xp-progress-bar should use the uiManager store");
    assert.equal(directiveLine.includes("window.uiManager"), false, "xp-progress-bar should not use window.uiManager");
    assert.ok(
        directiveLine.includes("closest('xp-reward-panel')?.dataset.componentId"),
        "Each XP progress bar must read the panel instance that owns it"
    );
    assert.ok(
        readSource("src/components/xp-reward-panel.html").includes(
            "xpRewardPanel($el.parentElement?.dataset.componentId)"
        ),
        "The reusable XP panel must accept its host-specific uiManager ID"
    );
    console.log("[alpine-ui-manager-contracts] ok");
}

function testHuntingOverlayActionContracts() {
    const overlay = readSource("src/components/hunting-overlay.html");
    const bridge = readSource("src/componentBridge.js");
    assert.ok(
        overlay.includes("huntingChestConfirmLabel"),
        "Hunting chest confirmation label must remain local overlay state"
    );
    assert.ok(
        overlay.includes('huntingChestConfirmLabel: ""'),
        "Hunting chest confirmation label must initialize empty"
    );
    assert.ok(
        overlay.includes('this.huntingChestConfirmLabel = ""'),
        "Hunting reset must clear the chest confirmation label"
    );
    assert.ok(
        overlay.includes("data.huntingChestConfirmLabel !== undefined"),
        "Hunting state updates must accept the chest confirmation label"
    );
    assert.ok(
        overlay.includes("huntingChestConfirmLabel || '계속 전진'"),
        "Chest button must retain its fallback label"
    );
    assert.ok(overlay.includes("huntingEventActive: false"), "Hunting event result must initialize its local state");
    assert.ok(overlay.includes("this.huntingEventActive = false"), "Hunting reset must clear the event result state");
    assert.ok(
        overlay.includes("data.huntingEventDetail !== undefined"),
        "Event result detail must accept manager updates"
    );
    assert.ok(
        overlay.includes('@click="huntingEventContinue()"'),
        "Event result confirmation must stay inside the hunting overlay"
    );
    assert.ok(bridge.includes("huntingEventContinue()"), "Component bridge must expose hunting event confirmation");
    assert.ok(
        overlay.includes("huntingBattlePreparationActive: false") &&
            overlay.includes('class="hunting-battle-preparation"') &&
            overlay.includes('@click="huntingStartPreparedBattle()"'),
        "Automatic battle start feedback must remain inside the hunting overlay"
    );
    assert.ok(
        !bridge.includes("huntingUsePreparationConsumable") && bridge.includes("huntingStartPreparedBattle()"),
        "Component bridge must remove potion actions and expose battle start"
    );
    assert.ok(
        overlay.includes('data-component-id="huntingXpRewardPanel"') &&
            overlay.includes('requireComponent("huntingXpRewardPanel")'),
        "Normal hunting wins must render the shared XP reward panel inside the hunting overlay"
    );
    assert.ok(
        overlay.includes("huntingCombatResultActive: false") &&
            overlay.includes('class="hunting-combat-choice-card"') &&
            overlay.includes('class="hunting-combat-result-tab"') &&
            overlay.includes('@click="advanceHuntingCombatResult()"'),
        "Hunting wins must advance reusable local result cards"
    );
    assert.ok(
        bridge.includes("huntingAdvanceCombatResult()") &&
            overlay.includes('invokeGameAction("huntingAdvanceCombatResult")'),
        "Post-combat cards must use the manager-owned automatic result flow"
    );
    assert.ok(
        overlay.includes('class="hunting-combat-unlock-card"') &&
            overlay.includes("huntingCharacterUnlock") &&
            overlay.includes("huntingCombatResultTotal"),
        "The first hidden champion victory must prepend a compact unlock card without replacing XP and summary cards"
    );
    assert.ok(
        !overlay.includes('@click="huntingSwapActiveCharacter()"') &&
            overlay.includes('class="hunting-auto-advance"') &&
            overlay.includes('class="hunting-auto-advance-track"') &&
            overlay.includes("'자동 진행 · '") &&
            overlay.includes('@click="huntingSkipAutoAdvance()"'),
        "The hunting overlay should replace swap input with one visible automatic-progress control"
    );
    assert.ok(
        !bridge.includes("huntingSwapActiveCharacter()") && bridge.includes("huntingSkipAutoAdvance()"),
        "The bridge must disable swap input and expose early automatic-progress confirmation"
    );
    console.log("[hunting-overlay-action-contracts] ok");
}

function testHuntingStartPopupOwnershipContract() {
    const app = readSource("src/app.js");
    const fighterStrip = readSource("src/components/fighter-strip.html");
    const manager = readSource("src/hunting/huntingManager.js");
    const popup = readSource("src/components/popup-dialog.html");
    const bridge = readSource("src/componentBridge.js");
    const stageSelect = manager.match(/showStageSelect\(\)[\s\S]*?\n    }\n\n    selectStage/s)?.[0] ?? "";
    const checkpointSelect =
        manager.match(/showCheckpointSelect\([\s\S]*?\n    }\n\n    showDebugPartySelect/s)?.[0] ?? "";

    assert.ok(
        manager.includes('type: "hunting-stage-select"') && manager.includes('type: "hunting-checkpoint-select"'),
        "HuntingManager should pass structured stage and checkpoint content to the popup"
    );
    assert.equal(
        /(setTimeout|document\.querySelectorAll|addEventListener)/.test(stageSelect),
        false,
        "Production stage selection must not attach delayed DOM listeners"
    );
    assert.equal(
        /(setTimeout|document\.querySelectorAll|addEventListener)/.test(checkpointSelect),
        false,
        "Production checkpoint selection must not attach delayed DOM listeners"
    );
    assert.ok(
        popup.includes('@click="selectHuntingStage(stage.id)"') &&
            popup.includes('@click="startHuntingParty(checkpoint.floor)"') &&
            popup.includes('invokeGameAction("selectHuntingStage", stageId)') &&
            popup.includes('this.content?.startAction ?? "selectHuntingCheckpoint"'),
        "Popup component should own declarative selection handlers and route them through uiManager"
    );
    assert.ok(
        bridge.includes("selectHuntingStage(stageId)") &&
            bridge.includes("selectHuntingCheckpoint(encounterFloor, party = {})") &&
            bridge.includes("startDebugHuntingWithParty(encounterFloor, party, context = {})"),
        "Component bridge should expose the two hunting start actions"
    );
    const debugPartyOpeners = ["startDebugHunting", "startDebugHuntingEvent", "startDebugHuntingEncounter"].map(
        (methodName) => bridge.match(new RegExp(`${methodName}\\([^]*?\\n        },`))?.[0] ?? ""
    );
    assert.equal(
        debugPartyOpeners.some((method) => method.includes('setGameMode("hunting")')),
        false,
        "Opening a debug party popup must not switch modes before the party is confirmed"
    );
    assert.ok(
        manager.includes('this.app.setGameMode("hunting")') &&
            manager.indexOf('this.app.setGameMode("hunting")') < manager.indexOf("this.app.beginGameSession()"),
        "HuntingManager should switch modes only after validating and creating a run"
    );
    assert.ok(
        manager.includes("showDebugPartySelect(characterId, context = {})") &&
            manager.includes("_showPartySelection({"),
        "Debug hunting must reuse the production party selection component instead of duplicating role inputs"
    );
    assert.ok(
        popup.includes("companionIds") && !popup.includes("supportIds"),
        "The shared party popup should expose two companion slots without removed support slots"
    );
    assert.ok(
        popup.includes('class="hunting-party-slot"') &&
            popup.includes('@click="openHuntingPartyPicker(slot.key)"') &&
            popup.includes('class="hunting-party-character-grid"') &&
            popup.includes('@click="selectHuntingPartyCharacter(character.id)"') &&
            !popup.includes("<select :value=\"slot.value ?? ''\""),
        "Party formation should use visible role cards and one shared character picker instead of stacked native selects"
    );
    assert.ok(
        popup.includes("grid-template-columns: repeat(2, minmax(0, 1fr))") &&
            popup.includes("grid-template-columns: repeat(auto-fit, minmax(min(100%, clamp(8rem, 22vw, 10rem)), 1fr))"),
        "Party slots and character choices should keep a fluid grid contract"
    );
    assert.ok(
        manager.includes("createHuntingPartyCharacterOption") &&
            manager.includes("color: fighter.color") &&
            manager.includes("getCharacterExperienceSummary(profile, fighter.id).level"),
        "Party character cards should receive shared visual identity and current level data from HuntingManager"
    );
    assert.ok(
        fighterStrip.includes("fighter.partyLabel") && app.includes('partyRole?.startsWith("companion-") ? "동료"'),
        "Hunting companion cards should identify themselves as companions instead of AI fighters"
    );
    console.log("[hunting-start-popup-ownership] ok");
}

function testSharedCharacterPortraitContract() {
    const index = readSource("index.html");
    const app = readSource("src/app.js");
    const battleBall = readSource("src/entities/battleBall.js");
    const popup = readSource("src/components/popup-dialog.html");
    const playerPanel = readSource("src/components/player-panel.html");
    const collectionHub = readSource("src/components/collection-hub.html");
    const manager = readSource("src/hunting/huntingManager.js");

    assert.ok(
        index.includes("registerCharacterPortraitDirective") &&
            index.includes("registerCharacterPortraitDirective(Alpine)"),
        "The shared Canvas portrait directive should be registered before Alpine starts"
    );
    assert.ok(
        battleBall.includes("drawPortrait(ctx)") && battleBall.includes("this._drawCharacterBody(ctx)"),
        "BattleBall should expose its real body rendering for UI portraits"
    );
    assert.ok(
        playerPanel.includes('x-character-portrait="portrait"') && popup.match(/x-character-portrait=/g)?.length >= 2,
        "The player panel and both party-selection surfaces should reuse the Canvas portrait directive"
    );
    assert.ok(
        collectionHub.includes('x-character-portrait="item.portrait"'),
        "Unlocked collection cards should reuse the same Canvas portrait system"
    );
    assert.ok(
        manager.includes("portrait: fighter") &&
            app.includes("this._panel.portrait") &&
            !app.includes("_drawPlayerFace(fighter)"),
        "UI view models should provide fighter definitions instead of maintaining a bespoke fake-ball renderer"
    );
    assert.equal(
        popup.includes('class="hunting-character-orb"\n') && popup.includes("character.initial"),
        false,
        "Character choices should not fall back to initial-letter portraits"
    );
    console.log("[shared-character-portrait] ok");
}

function testSharedCharacterPortraitUsesBattleBallRendering() {
    const operations = [];
    const context = new Proxy(
        {
            setTransform(...args) {
                operations.push(["setTransform", ...args]);
            },
            clearRect(...args) {
                operations.push(["clearRect", ...args]);
            },
            arc(...args) {
                operations.push(["arc", ...args]);
            },
            measureText() {
                return { width: 0 };
            }
        },
        {
            get(target, property) {
                if (property in target) return target[property];
                return () => {};
            }
        }
    );
    const canvas = {
        width: 0,
        height: 0,
        getBoundingClientRect: () => ({ width: 80, height: 80 }),
        getContext: () => context
    };

    for (const fighter of createRoster()) {
        const rendered = renderCharacterPortrait(canvas, { fighter, equipmentItems: [] });
        assert.equal(rendered, true, `${fighter.id} should render through the shared portrait system`);
    }

    assert.equal(canvas.width, 80, "Canvas backing width should follow its rendered CSS width");
    assert.equal(canvas.height, 80, "Canvas backing height should follow its rendered CSS height");
    assert.ok(
        operations.some(([operation]) => operation === "arc"),
        "The real BattleBall body should be drawn"
    );
    console.log("[shared-character-portrait-rendering] ok");
}

function testResultOverlayLayoutContract() {
    const overlay = readSource("src/components/game-overlay.html");
    const huntingOverlay = readSource("src/components/hunting-overlay.html");
    const xpRewardPanel = readSource("src/components/xp-reward-panel.html");
    const globalStyles = readSource("src/styles.css");
    const bridge = readSource("src/componentBridge.js");
    assert.ok(
        overlay.includes('class="result-sequence-frame"') &&
            overlay.includes('class="result-sequence-tab"') &&
            overlay.includes('x-show="resultSequence"') &&
            overlay.includes('@click="handleResultSequenceAction()"'),
        "Result sequence must group its card and side action inside one frame"
    );
    assert.ok(
        overlay.includes("resultSequence?.isFinal ? '확인' : '》'"),
        "Final side tab must replace the arrow with confirmation"
    );
    assert.ok(
        overlay.includes(
            "'result-sequence-empty-experience': resultSequence?.id === 'experience' && !resultSequence?.xpReward"
        ) &&
            overlay.includes("@media (min-width: 601px)") &&
            overlay.includes("max-width: 17ch;") &&
            overlay.includes("font-size: clamp(1.5rem, 2vw, 2.15rem);"),
        "Only empty XP result steps may use the smaller desktop result copy"
    );
    assert.ok(
        overlay.includes('Alpine.store("uiManager").invokeGameAction("confirmResultSequence")') &&
            bridge.includes("confirmResultSequence()"),
        "The final side tab must confirm through the shared game action bridge"
    );
    const resultFrameRule =
        overlay.match(/:scope\.result-sequence-active \.result-sequence-frame\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        resultFrameRule,
        /width:\s*100%;[\s\S]*height:\s*100%;[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 6fr\) minmax\(0, 1fr\);/,
        "Result frame must reserve equal fluid tracks around the centered card"
    );
    assert.doesNotMatch(
        resultFrameRule,
        /(?:\b\d+px\b|calc\()/,
        "Result frame must not use a fixed desktop container width"
    );
    const resultTabRule = overlay.match(/\.result-sequence-tab\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        resultTabRule,
        /grid-column:\s*3;[\s\S]*position:\s*static;/,
        "Side tab must occupy the fluid right track"
    );
    assert.doesNotMatch(
        resultTabRule,
        /(?:right|top|transform):/,
        "Side tab must not use a fixed offset from the card"
    );
    assert.ok(
        overlay.includes("@media (max-width: 600px)") &&
            overlay.includes("width: 36px;") &&
            !overlay.includes("right: -36px;"),
        "Mobile result cards must keep the smaller side tab inside the frame's fluid side track"
    );
    for (const viewportWidth of [320, 390, 600, 768]) {
        const tabWidth = viewportWidth <= 600 ? 36 : 40;
        const sideTrackWidth = viewportWidth / 8;
        const cardWidth = viewportWidth - sideTrackWidth * 2;
        const cardLeft = sideTrackWidth;
        const cardRight = cardLeft + cardWidth;
        const tabLeft = cardRight;
        const tabRight = tabLeft + tabWidth;
        assert.equal(cardLeft + cardWidth / 2, viewportWidth / 2, "Result card must remain horizontally centered");
        assert.equal(tabLeft, cardRight, "Side tab must begin at the card border without covering its content");
        assert.ok(tabWidth <= sideTrackWidth, "Fluid side track must keep the touch target inside the viewport");
        assert.ok(tabRight <= viewportWidth, "Entire side-tab touch target must remain inside the viewport");
    }
    const huntingFrameRule =
        huntingOverlay.match(
            /:scope\.hunting-choice-active \.hunting-overlay-frame,\s*:scope\.hunting-chest-active \.hunting-overlay-frame,\s*:scope\.hunting-event-active \.hunting-overlay-frame,\s*:scope\.hunting-battle-preparation-active \.hunting-overlay-frame\s*\{([^}]*)\}/s
        )?.[1] ?? "";
    assert.match(
        huntingFrameRule,
        /width:\s*100%;[\s\S]*height:\s*100%;[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 6fr\) minmax\(0, 1fr\);[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\) auto;/,
        "Standalone hunting overlays must reserve a fluid center card track and a separate timer row"
    );
    assert.doesNotMatch(
        huntingFrameRule,
        /(?:\b\d+px\b|calc\()/,
        "Standalone hunting frame must not use fixed container dimensions"
    );
    const huntingCardRule =
        huntingOverlay.match(
            /:scope\.hunting-choice-active \.hunting-overlay-card,\s*:scope\.hunting-chest-active \.hunting-overlay-card,\s*:scope\.hunting-event-active \.hunting-overlay-card,\s*:scope\.hunting-battle-preparation-active \.hunting-overlay-card\s*\{([^}]*)\}/s
        )?.[1] ?? "";
    assert.match(
        huntingCardRule,
        /grid-column:\s*2;[\s\S]*grid-row:\s*1;[\s\S]*width:\s*100%;[\s\S]*max-height:\s*100%;[\s\S]*box-sizing:\s*border-box;/,
        "Standalone hunting cards must use the shared fluid center track instead of changing width with copy length"
    );
    assert.doesNotMatch(
        huntingCardRule,
        /(?:^|\s)(?:width|height|max-width|max-height):\s*(?:\d+px|calc\()/,
        "Standalone hunting cards must not use fixed container dimensions"
    );
    assert.ok(
        huntingOverlay.includes("'hunting-moving': huntingMoving"),
        "Floor movement must expose a dedicated layout state instead of inheriting unrelated result-card rules"
    );
    const huntingMovingFrameRule =
        huntingOverlay.match(/:scope\.hunting-moving \.hunting-overlay-frame\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        huntingMovingFrameRule,
        /width:\s*100%;[\s\S]*height:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*max-height:\s*100%;[\s\S]*display:\s*grid;[\s\S]*place-items:\s*center;/,
        "Mobile floor movement must center its card in the available overlay area"
    );
    assert.doesNotMatch(
        huntingMovingFrameRule,
        /(?:\b\d+px\b|calc\()/,
        "Mobile floor movement frame must not use fixed container dimensions"
    );
    const huntingMovingCardRule =
        huntingOverlay.match(/:scope\.hunting-moving \.hunting-overlay-card\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        huntingMovingCardRule,
        /width:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*max-height:\s*100%;[\s\S]*box-sizing:\s*border-box;/,
        "Mobile floor movement card must include its padding inside the available overlay width"
    );
    assert.doesNotMatch(
        huntingMovingCardRule,
        /(?:\b\d+px\b|calc\()/,
        "Mobile floor movement card must not use a fixed container width"
    );
    const huntingMovingRouteRule =
        huntingOverlay.match(/:scope\.hunting-moving \.hunting-route\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        huntingMovingRouteRule,
        /min-width:\s*0;[\s\S]*max-width:\s*100%;[\s\S]*box-sizing:\s*border-box;/,
        "Floor movement route must shrink within the movement card on narrow mobile screens"
    );
    const huntingCombatResultFrameRule =
        huntingOverlay.match(/:scope\.hunting-combat-result-active \.hunting-overlay-frame\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        huntingCombatResultFrameRule,
        /width:\s*100%;[\s\S]*height:\s*100%;[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 6fr\) minmax\(0, 1fr\);/,
        "Normal combat result cards must reserve equal fluid tracks around the centered card"
    );
    assert.doesNotMatch(
        huntingCombatResultFrameRule,
        /(?:\b\d+px\b|calc\()/,
        "Normal combat result frame must not use a fixed container width"
    );
    const huntingCombatCardRule =
        huntingOverlay.match(
            /:scope\.hunting-combat-result-active \.hunting-overlay-card,\s*:scope\.hunting-combat-result-active \.hunting-combat-choice-card\s*\{([^}]*)\}/s
        )?.[1] ?? "";
    assert.match(
        huntingCombatCardRule,
        /grid-column:\s*2;[\s\S]*width:\s*100%;[\s\S]*max-height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*box-sizing:\s*border-box;[\s\S]*overflow-y:\s*auto;/,
        "Both normal combat result cards must fit inside the centered fluid track"
    );
    assert.doesNotMatch(
        huntingCombatCardRule,
        /width:\s*(?:\d+px|calc\()/,
        "Normal combat result cards must not introduce fixed container widths"
    );
    const huntingCombatTabRule = huntingOverlay.match(/\.hunting-combat-result-tab\s*\{([^}]*)}/s)?.[1] ?? "";
    assert.match(
        huntingCombatTabRule,
        /grid-column:\s*3;[\s\S]*justify-self:\s*start;[\s\S]*align-self:\s*center;/,
        "Normal combat result tab must begin at the centered card border"
    );
    const transientFrameRule = overlay.match(/:scope\.transient \.result-sequence-frame\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        transientFrameRule,
        /width:\s*100%;[\s\S]*height:\s*100%;[\s\S]*display:\s*grid;[\s\S]*place-items:\s*center;/,
        "Transient alerts must use their own viewport-centered frame"
    );
    assert.ok(
        overlay.includes(":scope.result-sequence-active .overlay-card .xp-reward {") &&
            overlay.includes("max-width: 100%;"),
        "Result XP rewards must fit the narrowed card"
    );
    const resultCardRule = overlay.match(/:scope\.result-sequence-active \.overlay-card\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        resultCardRule,
        /width:\s*100%;[\s\S]*box-sizing:\s*border-box;[\s\S]*max-height:\s*100%;[\s\S]*min-height:\s*0;[\s\S]*overflow-y:\s*auto;/,
        "Result card border and padding must stay inside the shared frame"
    );
    const xpRewardRootRule = xpRewardPanel.match(/:scope\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        xpRewardRootRule,
        /width:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*min-width:\s*0;[\s\S]*box-sizing:\s*border-box;/,
        "Shared XP reward cards must include padding and borders inside their fluid parent width"
    );
    assert.doesNotMatch(
        xpRewardRootRule,
        /width:\s*(?:\d+px|min\()/,
        "Shared XP reward cards must not depend on a fixed container width"
    );
    assert.ok(
        xpRewardPanel.includes("flex-wrap: wrap;") && xpRewardPanel.includes("overflow-wrap: anywhere;"),
        "XP reward rows and long level reward copy must wrap without pushing the card boundary"
    );
    const globalXpRewardRule = globalStyles.match(/\.xp-reward\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        globalXpRewardRule,
        /width:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*min-width:\s*0;[\s\S]*box-sizing:\s*border-box;/,
        "Global XP reward defaults must preserve the shared fluid card contract"
    );
    assert.ok(
        overlay.includes("padding: 10px 12px;") &&
            overlay.includes(":scope.result-sequence-active .overlay-card > xp-reward-panel {") &&
            overlay.includes("margin-top: 12px;") &&
            overlay.includes(".overlay-card > xp-reward-panel .xp-reward {") &&
            overlay.includes("margin-top: 0;"),
        "Compact mobile result cards must remove duplicate reward-panel margins"
    );
    assert.ok(
        overlay.includes("@media (max-width: 359px)") &&
            overlay.includes("padding: 7px 10px;") &&
            overlay.includes("font-size: clamp(1.6rem, 8vw, 1.75rem);") &&
            overlay.includes("gap: 4px;") &&
            overlay.includes("font-size: 0.68rem;"),
        "320px result cards must use a dedicated compact density"
    );
    assert.ok(
        overlay.includes("resultSequenceSlide: false") && overlay.includes("result-sequence-slide-in"),
        "Advancing from the side tab must use a card slide transition"
    );
    assert.ok(
        overlay.includes(".mastery-reward {\n        width: min(420px, 100%);") &&
            overlay.includes("box-sizing: border-box;") &&
            overlay.includes("overflow-wrap: anywhere;"),
        "Mastery reward content must fit inside the mobile result card"
    );
    const masteryRewardTitleRule = overlay.match(/\.mastery-reward-title b\s*\{([^}]*)\}/s)?.[1] ?? "";
    const masteryRewardEffectNameRule = overlay.match(/\.mastery-reward-effect-name\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        masteryRewardTitleRule,
        /color:\s*#202020;/,
        "Mastery reward source names must keep an explicit dark color inside the light reward card"
    );
    assert.match(
        masteryRewardEffectNameRule,
        /color:\s*#202020;/,
        "Mastery reward effect names must keep an explicit dark color inside the light reward card"
    );
    console.log("[result-overlay-layout-contract] ok");
}

function testFluidModalLayoutContracts() {
    const huntingOverlay = readSource("src/components/hunting-overlay.html");
    const huntingManager = readSource("src/hunting/huntingManager.js");
    const collectionHub = readSource("src/components/collection-hub.html");
    const equipmentPanel = readSource("src/components/collection-equipment-panel.html");

    const huntingCardRule =
        huntingOverlay.match(
            /:scope\.hunting-choice-active \.hunting-overlay-card,\s*:scope\.hunting-chest-active \.hunting-overlay-card,\s*:scope\.hunting-event-active \.hunting-overlay-card,\s*:scope\.hunting-battle-preparation-active \.hunting-overlay-card\s*\{([^}]*)\}/s
        )?.[1] ?? "";
    assert.match(
        huntingCardRule,
        /min-height:\s*0;[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*overflow:\s*hidden;/,
        "Hunting event cards must pass their available height to internal content instead of relying on a viewport-specific card size"
    );
    const eventLayoutRule =
        huntingOverlay.match(/\.hunting-chest-event,\s*\.hunting-event-result\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        eventLayoutRule,
        /display:\s*grid;[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\) auto;[\s\S]*min-height:\s*0;/,
        "Hunting events must reserve their action row after a shrinkable body row"
    );
    const eventBodyRule = huntingOverlay.match(/\.hunting-event-scroll-body\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        eventBodyRule,
        /min-height:\s*0;[\s\S]*overflow-y:\s*auto;[\s\S]*touch-action:\s*pan-y;/,
        "Only the hunting event body may scroll when event content exceeds its card"
    );
    assert.ok(
        huntingOverlay.includes('class="hunting-event-scroll-body"') &&
            huntingOverlay.includes('class="hunting-event-actions"'),
        "Hunting event markup must keep the scroll body and action footer as reusable siblings"
    );
    const eventActionRule = huntingOverlay.match(/\.hunting-event-actions \.hunting-btn\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(eventActionRule, /width:\s*100%;/, "Every hunting event action must use the shared card width");
    assert.equal(
        huntingOverlay.includes('<strong x-text="huntingMoveMessage"></strong>'),
        false,
        "Battle preparation must not repeat the title already rendered by the shared heading"
    );
    assert.equal(
        huntingOverlay.includes("잠시 후 전투가 자동으로 시작됩니다.</p>"),
        false,
        "Battle preparation must not repeat the automatic-start guidance already visible in the heading and timer"
    );
    const eventHeadingTitleRule = huntingOverlay.match(/\.hunting-overlay-heading > strong\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        eventHeadingTitleRule,
        /text-wrap:\s*balance;/,
        "Long hunting event titles must balance their lines instead of leaving a one-character orphan"
    );
    assert.equal(
        huntingOverlay.includes("huntingChestSubtext") || huntingManager.includes("huntingChestSubtext"),
        false,
        "The removed duplicate chest storage copy must not leave dead overlay state behind"
    );
    const autoAdvanceInFrameRule =
        huntingOverlay.match(
            /:scope\.hunting-choice-active \.hunting-auto-advance,\s*:scope\.hunting-chest-active \.hunting-auto-advance,\s*:scope\.hunting-event-active \.hunting-auto-advance,\s*:scope\.hunting-battle-preparation-active \.hunting-auto-advance\s*\{([^}]*)\}/s
        )?.[1] ?? "";
    assert.match(
        autoAdvanceInFrameRule,
        /position:\s*static;[\s\S]*grid-column:\s*1 \/ -1;[\s\S]*grid-row:\s*2;/,
        "Automatic progress must occupy a reserved frame row instead of covering event actions"
    );

    const collectionScopeRule = collectionHub.match(/:scope\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        collectionScopeRule,
        /display:\s*flex;[\s\S]*padding:\s*clamp\([^)]*rem[^)]*\);[\s\S]*box-sizing:\s*border-box;/,
        "Collection overlay must own responsive safety padding rather than a device-width container"
    );
    const collectionFrameRule = collectionHub.match(/\.ch-frame\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        collectionFrameRule,
        /width:\s*min\(72rem, 100%\);[\s\S]*height:\s*100%;[\s\S]*max-height:\s*100%;[\s\S]*display:\s*flex;[\s\S]*min-height:\s*0;/,
        "Collection frame must use the overlay's available size with one content-width cap"
    );
    assert.doesNotMatch(
        collectionFrameRule,
        /width:\s*(?:\d+px|calc\()/,
        "Collection frame must not introduce a viewport-specific fixed width"
    );
    const codexDetailRule = collectionHub.match(/\.ch-codex-panel--detail-open\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        codexDetailRule,
        /grid-template-rows:\s*auto minmax\(0, 1fr\) minmax\(0, 1fr\);/,
        "Selected codex entries must split the remaining space between list and detail"
    );
    const detailRule = collectionHub.match(/\.ch-detail\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        detailRule,
        /flex:\s*1 1 0;[\s\S]*min-height:\s*0;[\s\S]*overflow-y:\s*auto;[\s\S]*touch-action:\s*pan-y;/,
        "Codex detail must scroll inside its own fluid row"
    );
    assert.ok(
        !collectionHub.includes("min-height: 400px") && !collectionHub.includes("max-height: 85vh"),
        "Collection layout must not restore legacy fixed content-height fallbacks"
    );
    const equipmentHostRule = collectionHub.match(/collection-equipment-panel\s*\{([^}]*)\}/s)?.[1] ?? "";
    const equipmentRootRule = collectionHub.match(/collection-equipment-panel\s*>\s*div\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        equipmentHostRule,
        /display:\s*flex;[\s\S]*flex:\s*1 1 0;[\s\S]*min-height:\s*0;/,
        "Equipment host must preserve the collection frame's available height through its component boundary"
    );
    assert.match(
        equipmentRootRule,
        /display:\s*flex;[\s\S]*flex:\s*1 1 0;[\s\S]*min-height:\s*0;/,
        "Equipment root must preserve the host height for its internal list"
    );
    const equipmentListRule = equipmentPanel.match(/\.ch-equip-list\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        equipmentListRule,
        /flex:\s*1;[\s\S]*min-height:\s*0;[\s\S]*overflow-y:\s*auto;[\s\S]*-webkit-overflow-scrolling:\s*touch;[\s\S]*touch-action:\s*pan-y;/,
        "Equipment inventory must own both its scroll area and mobile vertical touch input"
    );
    assert.ok(
        equipmentPanel.includes("repeat(auto-fit, minmax(min(100%, 8rem), 1fr))"),
        "Equipment slots must use a fluid grid instead of a viewport-specific column count"
    );
    console.log("[fluid-modal-layout-contracts] ok");
}

function testCollectionRebirthAndDeveloperContracts() {
    const template = readSource("src/components/collection-hub.html");
    assert.ok(template.includes("환생 보상 선택"), "Character detail should expose the rebirth action");
    assert.ok(template.includes("진행 중인 보상 선택"), "Character detail should reopen an existing rebirth offer");
    assert.ok(
        template.includes("item.rebirth.pendingOfferCards"),
        "Character detail should render pending rebirth candidates inline"
    );
    assert.ok(
        template.includes("completeRebirth(item.id, card.id)"),
        "Candidate selection must use the guarded rebirth completion bridge"
    );
    assert.ok(
        template.includes('class="ch-rebirth-choice"') &&
            template.includes('@click="completeRebirth(item.id, card.id)"') &&
            template.includes('class="ch-rebirth-choice-action"'),
        "Each pending reward should be one directly selectable card instead of a list row with a detached button"
    );
    const rebirthChoiceGridRule = template.match(/\.ch-rebirth-choice-grid\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        rebirthChoiceGridRule,
        /display:\s*grid;[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*[^)]+\),\s*1fr\)\);/,
        "Rebirth choices should use a fluid card grid rather than fixed viewport columns"
    );
    assert.ok(template.includes("toggleRebirthCardEquip"), "Character detail should expose card equip controls");
    assert.ok(template.includes("maxEquippedCards"), "Character detail should display the three-card loadout limit");
    assert.ok(
        template.includes("card.rankLabel") && template.includes("현재:") && template.includes("card?.nextUnlockText"),
        "Rebirth cards should show stage n/4, the current effect, and the next original growth unlock"
    );
    assert.ok(
        readSource("src/rebirth/rebirthCards.js").includes("MAX · 단계"),
        "Maximum rebirth cards should expose an explicit MAX stage label"
    );
    assert.ok(template.includes("누적 기초 수치"), "Character detail should show accumulated permanent rebirth stats");
    assert.ok(
        template.includes("formatRebirthStatBonus"),
        "Character detail should format base-stat totals by stat key"
    );
    assert.equal(existsSync("src/rebirth/rebirthPicker.js"), false, "Legacy rebirth picker service must be removed");
    assert.equal(
        existsSync("src/components/rebirth-picker.html"),
        false,
        "Legacy rebirth picker component must be removed"
    );
    assert.ok(!readSource("index.html").includes("rebirth-picker"), "Index must not mount the legacy picker");
    assert.ok(
        !readSource("src/componentBridge.js").includes("RebirthPicker"),
        "Production rebirth flow must not reference the legacy picker"
    );
    assert.ok(template.includes("우승 처리"), "Developer tools should label the tournament win action");
    assert.ok(
        template.includes('@click="recordDebugTournamentWin()"'),
        "Developer tournament action should use the dedicated debug bridge method"
    );
    assert.ok(
        template.includes("new ResizeObserver(revealActiveTab)"),
        "Collection tab visibility should be refreshed when the modal layout changes"
    );
    const collectionTabsRule = template.match(/\.ch-tabs\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.match(
        collectionTabsRule,
        /overflow-x:\s*auto;[\s\S]*scrollbar-width:\s*none;/,
        "Collection tabs should keep touch scrolling without exposing a native mobile scrollbar"
    );
    assert.ok(
        template.includes(".ch-tabs::-webkit-scrollbar") && template.includes("display: none;"),
        "Collection tabs should hide the WebKit scrollbar without clipping overflow"
    );
    assert.ok(template.includes("이벤트 미리보기"), "Developer tools should expose hunting event previews");
    assert.ok(template.includes("전투 조우 테스트"), "Developer tools should expose direct combat encounter previews");
    assert.ok(
        template.includes('@click="startDebugHuntingEncounter()"') &&
            template.includes("this.bridge.startDebugHuntingEncounter("),
        "Combat encounter previews should use their dedicated component bridge path"
    );
    assert.ok(
        template.includes('class="ch-developer-control-row"') && template.includes("미리보기 열기"),
        "Developer event actions should stay beside their event selector"
    );
    assert.ok(
        template.includes("환생 횟수") && template.includes("환생 적용"),
        "Developer rebirth actions should stay grouped with their count input"
    );
    assert.ok(
        template.includes("캐릭터 설정") && template.includes("사냥터 테스트"),
        "Developer controls should be grouped by the context they affect"
    );
    assert.ok(
        template.includes("Elementalist VFX") &&
            template.includes("state.developer.elementalistPreviewOptions") &&
            template.includes("data-elementalist-vfx-preview"),
        "Developer tools should expose the dedicated Elementalist VFX preview"
    );
    assert.ok(
        template.includes("startDebugElementalistVfxPreview") &&
            template.includes("stopDebugElementalistVfxPreview") &&
            template.includes("aspect-ratio: 16 / 9"),
        "Elementalist preview should use the debug bridge and a fluid canvas frame"
    );
    assert.ok(
        template.includes("triggerDebugElementalistWetPreview") && template.includes("젖음 발동"),
        "Elementalist wet preview should expose an explicit production-state trigger"
    );
    assert.ok(
        template.includes("젖음 피해 비교") &&
            template.includes("formatElementalistWetDamageComparison") &&
            template.includes("ch-elementalist-damage-grid"),
        "Elementalist spell previews should expose a responsive dry-versus-wet damage comparison"
    );
    assert.ok(
        template.includes("마른 대상 재생") &&
            template.includes("젖은 대상 재생") &&
            template.includes("ch-elementalist-preview-mode-buttons"),
        "Elementalist spell previews should expose responsive dry and wet visual replay buttons"
    );
    assert.ok(template.includes("정예 조합"), "Developer tools should expose the elite combination selector");
    assert.ok(
        template.includes("state.developer.huntingEventType === 'elite_mob'"),
        "The elite combination selector should only appear for elite event previews"
    );
    assert.ok(template.includes("컬렉션 샘플"), "Developer tools should expose collection sample data");
    assert.ok(
        template.includes('@click="startDebugHuntingEvent()"'),
        "Event preview should use the dedicated debug bridge method"
    );
    assert.ok(
        template.includes("this.bridge.startDebugHuntingEvent("),
        "The collection component should not reach into app state for event previews"
    );
    assert.ok(
        template.includes("state.developer.eliteCombinationId"),
        "Elite event previews should pass the selected production combination through the component bridge"
    );
    assert.ok(
        template.includes("this.bridge.seedDebugCollectionSample(state.developer.targetCharacterId)"),
        "The collection component should use the dedicated sample-data bridge"
    );
    console.log("[collection-rebirth-and-developer-contracts] ok");
}

function testCollectionTitleLongPressDebugEntry() {
    const template = readSource("src/components/collection-hub.html");
    assert.ok(
        template.includes('@pointerdown.prevent="startDebugModeHold($event)"') &&
            template.includes('@pointerup="cancelDebugModeHold()"') &&
            template.includes('@pointercancel="cancelDebugModeHold()"'),
        "Collection title should own a cancellable pointer hold gesture"
    );
    assert.ok(
        template.includes("const DEBUG_MODE_HOLD_DURATION_MS = 1000"),
        "Collection title debug entry should require a one-second hold"
    );

    const factories = {};
    let scheduledHold = null;
    let clearedTimerId = null;
    let debugEntryCount = 0;

    withGlobalPropertyStubs(
        {
            window: {
                createGameUI(name, factory) {
                    factories[name] = factory;
                }
            },
            Alpine: {
                reactive(value) {
                    return value;
                },
                store() {
                    return {
                        requireGameActionBridge() {
                            return {
                                enterDebugMode() {
                                    debugEntryCount += 1;
                                    return { ok: true };
                                }
                            };
                        }
                    };
                }
            },
            ResizeObserver: class {
                observe() {}
                disconnect() {}
            },
            requestAnimationFrame(callback) {
                callback();
                return 1;
            },
            setTimeout(callback, delay) {
                scheduledHold = { callback, delay, timerId: 7 };
                return scheduledHold.timerId;
            },
            clearTimeout(timerId) {
                clearedTimerId = timerId;
            }
        },
        () => {
            const createHub = loadCollectionComponentFactory(
                "src/components/collection-hub.html",
                "collectionHub",
                factories
            );
            const hub = createHub();
            hub.$root = { focus() {}, querySelector() {} };
            hub.init();
            hub.state.tabs = [
                { id: "roster", label: "도감" },
                { id: "developer", label: "개발자" }
            ];

            hub.startDebugModeHold({ pointerType: "touch", button: 0 });
            assert.equal(scheduledHold.delay, 1000, "Touch hold should wait exactly one second");
            assert.equal(hub.state.debugModeHoldActive, true, "Touch hold should expose visible progress feedback");
            hub.cancelDebugModeHold();
            assert.equal(clearedTimerId, 7, "Releasing early should cancel the pending debug entry");
            assert.equal(debugEntryCount, 0, "Cancelled hold must not enter debug mode");

            hub.startDebugModeHold({ pointerType: "touch", button: 0 });
            scheduledHold.callback();
            assert.equal(debugEntryCount, 1, "Completed hold should enter debug mode once");
            assert.equal(hub.state.activeTab, "developer", "Completed hold should open the developer tab");
            assert.equal(hub.state.debugModeHoldActive, false, "Completed hold should clear its progress state");
            hub.destroy();
        }
    );

    console.log("[collection-title-long-press-debug-entry] ok");
}

function testHiddenCharacterCollectionMasking() {
    const profile = createDefaultPlayerProfile();
    profile.collection.characters.elementalist = {
        tournamentsCompleted: 9,
        tournamentWins: 4,
        matchWins: 12,
        totalDamageDealt: 9999
    };
    profile.experience.byCharacter.elementalist = { currentXp: 99999 };
    profile.characterMastery.levels.elementalist = 3;
    const viewModel = createCollectionHubViewModel({
        profile,
        roster: createRoster(),
        masteryDefinitions: MASTERY_EFFECT_DEFS
    });
    const locked = viewModel.rosterItems.find((item) => item.id === "elementalist");
    assert.equal(locked.name, "???");
    assert.equal(locked.color, "#777777");
    assert.equal(locked.ability, "?");
    assert.equal(locked.tournamentWins, 0);
    assert.equal(locked.experienceLevelLabel, "미해금");
    assert.deepEqual(locked.levelRewards, []);
    assert.equal(locked.rebirth.visible, false);
    assert.equal(locked.portrait, null);
    const mastery = viewModel.masteryItems.find((item) => item.sourceFighterId === "elementalist");
    assert.equal(mastery.sourceName, "???");
    assert.equal(mastery.name, "???");
    const collectionHub = readSource("src/components/collection-hub.html");
    assert.ok(
        collectionHub.includes('x-if="!item.isLocked"') && collectionHub.includes('x-show="item.isLocked">?</span>'),
        "Locked hidden characters should keep the question-mark mask without creating a portrait"
    );
    console.log("[hidden-character-collection-masking] ok");
}

function testNearestEnemyCombatControlUiContract() {
    const template = readSource("src/components/combat-controls.html");
    const app = readSource("src/app.js");
    const bridge = readSource("src/componentBridge.js");
    assert.ok(template.includes('aria-label="이탈"') && template.includes('aria-label="압박"'));
    assert.ok(template.includes('invokeGameAction("useCombatControl", type)'));
    assert.ok(template.includes("min-height:48px") && template.includes("combat-control--retreat"));
    assert.ok(app.includes("_syncCombatControlUi") && app.includes("useNearestEnemyCombatControl"));
    assert.ok(bridge.includes("useCombatControl(type)"));
    assert.equal(app.includes("accelerateActiveCharacter"), false, "Canvas taps must not retain hunting acceleration");
    console.log("[nearest-enemy-combat-control-ui] ok");
}

testDisabledHuntingUiIsNotMounted();
testHuntingChestIconReuseContract();
testCollectionEquipmentPanelsOwnTheirFlows();
testEquipmentSpecialOptionTooltipContract();
testEquipmentSpecialTooltipInteractionContract();
testDailyShopPopupContract();
testFusionEquippedLabelTypographyContract();
testCollectionEquipmentPanelsShareHubState();
testEquipmentCurrencyContract();
testDefenseHelpCopyContract();
testCollectionDetailContracts();
testPopupCloseOwnershipContract();
testGameplayUiResetContracts();
testCombinedHealthBarProportions();
testNoWindowUiManagerInProduction();
testAlpineTemplateUiManagerContracts();
testHuntingOverlayActionContracts();
testHuntingStartPopupOwnershipContract();
testSharedCharacterPortraitContract();
testSharedCharacterPortraitUsesBattleBallRendering();
testResultOverlayLayoutContract();
testFluidModalLayoutContracts();
testCollectionRebirthAndDeveloperContracts();
testCollectionTitleLongPressDebugEntry();
testHiddenCharacterCollectionMasking();
testNearestEnemyCombatControlUiContract();

function testIconTagCountAndUniqueness() {
    const tags = getRegisteredTags();
    assert.deepEqual(
        tags,
        [
            "attack_sword",
            "attack_greatsword",
            "health_crystal",
            "health_belt",
            "defense_leather",
            "defense_chain",
            "speed_boots",
            "speed_wing",
            "haste_mote",
            "haste_kindlegem",
            "crit_cloak",
            "crit_twin_blades",
            "mass_weight",
            "wall_spring",
            "collision_gyro",
            "intermediate_attack_crit",
            "intermediate_attack_haste",
            "intermediate_attack_speed",
            "intermediate_attack_health",
            "intermediate_health_defense",
            "intermediate_health_haste",
            "intermediate_defense_wall",
            "intermediate_defense_mass",
            "intermediate_speed_wall",
            "intermediate_speed_angular",
            "intermediate_haste_angular",
            "intermediate_crit_mass",
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
        ],
        "The prototype registry should expose the approved 15 basic, 12 intermediate, and 12 completed tags in gallery order"
    );
    const unknownTag = resolveTagDraw("unknown");
    assert.ok(typeof unknownTag === "function", "Unknown fallback should resolve to a draw function");
    const nonExistentTag = resolveTagDraw("does_not_exist");
    assert.equal(nonExistentTag, unknownTag, "Non-existent tag should fall back to unknown draw function");
    assert.equal(tags.length, 39, "There should be exactly 39 registered non-unknown tags");
    const unique = new Set(tags);
    assert.equal(unique.size, tags.length, "All tag IDs must be unique");
    tags.forEach((id) => {
        assert.ok(
            typeof getTagLabel(id) === "string" && getTagLabel(id).length > 0,
            `Tag ${id} must have a non-empty label`
        );
    });
    const metadata = getRegisteredTagMetadata();
    assert.equal(metadata.length, 39, "getRegisteredTagMetadata should return exactly 39 entries");
    metadata.forEach((entry) => {
        assert.ok(typeof entry.id === "string" && entry.id.length > 0, "Each metadata entry must have an id");
        assert.ok(typeof entry.label === "string" && entry.label.length > 0, "Each metadata entry must have a label");
    });
    const LABEL_MAP = {
        attack_sword: "공격 · 금 간 장검",
        attack_greatsword: "높은 공격 · 무거운 대검",
        health_crystal: "HP · 생명 수정",
        health_belt: "높은 HP · 맥동 허리띠",
        defense_leather: "방어 · 가죽 갑옷",
        defense_chain: "높은 방어 · 쇠사슬 조끼",
        speed_boots: "속도 · 가벼운 장화",
        speed_wing: "높은 속도 · 날개깃",
        haste_mote: "스킬 가속 · 마력 구슬",
        haste_kindlegem: "높은 스킬 가속 · 점화석",
        crit_cloak: "치명타 · 행운 망토",
        crit_twin_blades: "높은 치명타 · 쌍날 부적",
        mass_weight: "질량 · 무쇠 추",
        wall_spring: "벽 반사 속도 · 압축 스프링",
        collision_gyro: "충돌 · 충격 자이로",
        intermediate_attack_crit: "중간 · 공격·치명타 · 정밀 보강검",
        intermediate_attack_haste: "중간 · 공격·스킬 가속 · 마력 동력검",
        intermediate_attack_speed: "중간 · 공격·속도 · 경량 날개검",
        intermediate_attack_health: "중간 · 공격·HP · 생명 수정 절단구",
        intermediate_health_defense: "중간 · HP·방어 · 수정 가죽흉갑",
        intermediate_health_haste: "중간 · HP·스킬 가속 · 열맥동 허리장치",
        intermediate_defense_wall: "중간 · 방어·벽 반사 속도 · 스프링 완충판",
        intermediate_defense_mass: "중간 · 방어·질량 · 중량 사슬조끼",
        intermediate_speed_wall: "중간 · 속도·벽 반사 속도 · 스프링 도약화",
        intermediate_speed_angular: "중간 · 속도·회전 충격 · 날개 자이로 안정기",
        intermediate_haste_angular: "중간 · 스킬 가속·회전 충격 · 점화 자이로 코어",
        intermediate_crit_mass: "중간 · 치명타·질량 · 쌍날 충격두",
        completed_ability_crit: "완성 · 스킬·치명타 폭발 · 명칭 미정",
        completed_pursuit_flurry: "완성 · 추격·연타 · 명칭 미정",
        completed_mass_execution: "완성 · 질량·치명타 처형 · 명칭 미정",
        completed_vital_heat: "완성 · HP·열기 지속 공격 · 명칭 미정",
        completed_defense_conversion: "완성 · 방어·공격 전환 · 명칭 미정",
        completed_mass_shockwave: "완성 · 질량·광역 충격파 · 명칭 미정",
        completed_wall_ricochet: "완성 · 벽 반사·도탄 공격 · 명칭 미정",
        completed_wall_heat: "완성 · 벽 반사·열기 파동 · 명칭 미정",
        completed_speed_angular: "완성 · 속도·회전 충격 · 명칭 미정",
        completed_ability_echo: "완성 · 스킬·충돌 메아리 · 명칭 미정",
        completed_vortex_charge: "완성 · 이동·광역 회전 · 명칭 미정",
        completed_vital_overwhelm: "완성 · HP·충돌 압도 · 명칭 미정"
    };
    metadata.forEach((entry) => {
        assert.equal(entry.label, LABEL_MAP[entry.id], `Label for ${entry.id} must match the confirmed equipment name`);
    });
    const unknownMeta = getUnknownTagMetadata();
    assert.equal(unknownMeta.id, "unknown", "Unknown metadata id must be 'unknown'");
    assert.ok(
        typeof unknownMeta.label === "string" && unknownMeta.label.length > 0,
        "Unknown metadata must have a label"
    );
    console.log("[icon-tag-count-and-uniqueness] ok");
}

function testIconTagDrawAll() {
    const tags = getRegisteredTags().concat(["unknown"]);
    const canvas = {
        width: 0,
        height: 0,
        getBoundingClientRect: () => ({ width: 64, height: 64 }),
        getContext: () => {
            const ctx = {
                _calls: [],
                save() {
                    this._calls.push("save");
                },
                restore() {
                    this._calls.push("restore");
                },
                setTransform() {
                    this._calls.push("setTransform");
                },
                clearRect() {
                    this._calls.push("clearRect");
                },
                beginPath() {
                    this._calls.push("beginPath");
                },
                closePath() {
                    this._calls.push("closePath");
                },
                moveTo() {
                    this._calls.push("moveTo");
                },
                lineTo() {
                    this._calls.push("lineTo");
                },
                quadraticCurveTo() {
                    this._calls.push("quadraticCurveTo");
                },
                arc() {
                    this._calls.push("arc");
                },
                ellipse() {
                    this._calls.push("ellipse");
                },
                roundRect() {
                    this._calls.push("roundRect");
                },
                rect() {
                    this._calls.push("rect");
                },
                fill() {
                    this._calls.push("fill");
                },
                stroke() {
                    this._calls.push("stroke");
                },
                fillRect() {
                    this._calls.push("fillRect");
                },
                translate() {
                    this._calls.push("translate");
                },
                scale() {
                    this._calls.push("scale");
                }
            };
            Object.defineProperty(ctx, "fillStyle", {
                get() {
                    return this._fillStyle;
                },
                set(v) {
                    this._fillStyle = v;
                    this._calls.push("fillStyle");
                }
            });
            Object.defineProperty(ctx, "strokeStyle", {
                get() {
                    return this._strokeStyle;
                },
                set(v) {
                    this._strokeStyle = v;
                    this._calls.push("strokeStyle");
                }
            });
            Object.defineProperty(ctx, "lineWidth", {
                get() {
                    return this._lineWidth;
                },
                set(v) {
                    this._lineWidth = v;
                    this._calls.push("lineWidth");
                }
            });
            Object.defineProperty(ctx, "lineJoin", {
                get() {
                    return this._lineJoin;
                },
                set(v) {
                    this._lineJoin = v;
                    this._calls.push("lineJoin");
                }
            });
            Object.defineProperty(ctx, "lineCap", {
                get() {
                    return this._lineCap;
                },
                set(v) {
                    this._lineCap = v;
                    this._calls.push("lineCap");
                }
            });
            return ctx;
        }
    };

    tags.forEach((id) => {
        const ctx = canvas.getContext();
        ctx._calls = [];
        const origGetContext = canvas.getContext;
        canvas.getContext = () => ctx;
        const result = renderIconTag(canvas, id);
        canvas.getContext = origGetContext;
        assert.equal(result, true, `renderIconTag for ${id} should return true`);
        assert.ok(ctx._calls.includes("beginPath"), `Tag ${id} draw should produce canvas path calls`);
    });
    console.log("[icon-tag-draw-all] ok");
}

function testIconTagDprBackingSize() {
    const canvas = {
        width: 0,
        height: 0,
        getBoundingClientRect: () => ({ width: 48, height: 48 }),
        getContext: () => ({
            save() {},
            restore() {},
            setTransform() {},
            clearRect() {},
            beginPath() {},
            closePath() {},
            moveTo() {},
            lineTo() {},
            quadraticCurveTo() {},
            arc() {},
            ellipse() {},
            roundRect() {},
            rect() {},
            fill() {},
            stroke() {},
            fillRect() {},
            translate() {},
            scale() {}
        })
    };
    renderIconTag(canvas, "attack_sword", { pixelRatio: 2 });
    assert.equal(canvas.width, 96, "48 CSS px at DPR 2 should produce 96 backing px");
    assert.equal(canvas.height, 96, "48 CSS px at DPR 2 should produce 96 backing px");
    console.log("[icon-tag-dpr-backing-size] ok");
}

function testIconTagControllerResizeObserverCleanup() {
    let disconnectCount = 0;
    const FakeResizeObserver = class {
        observe() {}
        disconnect() {
            disconnectCount += 1;
        }
    };
    const canvas = {};
    const controller = new EquipmentIconTagController(canvas, {
        ResizeObserverClass: FakeResizeObserver,
        requestFrame: (callback) => callback()
    });
    controller.destroy();
    assert.equal(disconnectCount, 1, "Controller destroy should disconnect the ResizeObserver");
    console.log("[icon-tag-controller-resize-observer-cleanup] ok");
}

function testDeveloperGalleryTemplateContracts() {
    const template = readSource("src/components/collection-hub.html");
    assert.ok(template.includes("장비 아이콘 갤러리"), "Developer tab should contain icon gallery section");
    assert.ok(template.includes("[32, 48, 64]"), "Gallery should render 32/48/64 size variants");
    assert.ok(
        template.includes("background:#ffffff") && template.includes("background:#333333"),
        "Gallery should have both light and dark background canvases"
    );
    assert.ok(
        template.includes('x-show="state.showIconLabels"'),
        "Gallery should support toggling icon label visibility"
    );
    assert.ok(template.includes('x-for="tag in iconTagList"'), "Gallery should iterate over iconTagList");
    assert.ok(template.includes("window.__equipmentIconTagList"), "Component should use the global metadata array");
    console.log("[developer-gallery-template-contracts] ok");
}

function testIconTagDirectiveRegistration() {
    const indexHtml = readSource("index.html");
    assert.ok(
        indexHtml.includes("registerEquipmentIconTagDirective"),
        "index.html should import and register the equipment icon tag directive"
    );
    assert.ok(indexHtml.includes("equipmentIconTags.js"), "index.html should import the equipmentIconTags module");
    assert.ok(
        indexHtml.includes("getRegisteredTagMetadata") && indexHtml.includes("getUnknownTagMetadata"),
        "index.html should import the metadata accessors"
    );
    assert.ok(
        indexHtml.includes("window.__equipmentIconTagList"),
        "index.html should set window.__equipmentIconTagList from module metadata"
    );
    console.log("[icon-tag-directive-registration] ok");
}

testIconTagCountAndUniqueness();
testIconTagDrawAll();
testIconTagDprBackingSize();
testIconTagControllerResizeObserverCleanup();
testDeveloperGalleryTemplateContracts();
testIconTagDirectiveRegistration();

console.log("ui contract tests ok");
