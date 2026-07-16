import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";

function readSource(path) {
    return readFileSync(path, "utf8");
}

function testHuntingMerchantMobileScrollContract() {
    const content = readSource("src/components/hunting-overlay.html");
    assert.ok(
        content.includes("'hunting-merchant-active': huntingMerchantActive"),
        "Overlay should expose a merchant-active class for the compact mobile layout"
    );
    assert.ok(
        content.includes(":scope.hunting-merchant-active .hunting-overlay-card") &&
            content.includes("width: fit-content;") &&
            content.includes("max-width: 100%;"),
        "Merchant overlay card should use content width inside the shared fluid frame"
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
        collectionHub.includes("<collection-equipment-panel>") &&
            collectionHub.includes("<collection-fusion-dialog>") &&
            collectionHub.includes("<collection-shop-panel>"),
        "Collection hub should compose the equipment tab, fusion dialog, and shop from dedicated components"
    );
    assert.equal(
        collectionHub.includes("ch-fusion-modal") || collectionHub.includes("ch-shop-modal"),
        false,
        "Collection hub must not retain modal markup after moving it to its owner components"
    );
    const panelHostRule =
        collectionHub.match(
            /collection-equipment-panel,\s*collection-fusion-dialog,\s*collection-shop-panel\s*\{([^}]*)\}/s
        )?.[1] ?? "";
    assert.match(
        panelHostRule,
        /display:\s*contents;/,
        "Panel hosts must not add a flex item between the collection frame and its existing screen layout"
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
            fusionDialog.includes("selection: { rarity: null, itemIds: [] }") &&
            fusionDialog.includes("function hide()"),
        "Fusion dialog should own its visibility and material-selection lifecycle"
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
    assert.ok(shopPanel.includes("state.storage.consumables"), "Shop should render definition-driven consumable rows");
    assert.ok(shopPanel.includes("buyConsumable(item.id)"), "Consumable rows should purchase the selected definition");
    assert.ok(
        shopPanel.includes("upgradeHuntingConsumableUseLimit"),
        "Shop should expose the permanent hunting consumable use-limit upgrade"
    );
    assert.ok(
        !collectionHub.includes('class="ch-daily-shop"'),
        "Shard shop must not appear in an unrelated collection tab"
    );
    console.log("[daily-shop-popup-contract] ok");
}

function testFusionEquippedLabelTypographyContract() {
    const template = readSource("src/components/collection-fusion-dialog.html");
    const candidateRule =
        [...template.matchAll(/\.ch-fusion-candidate\s*\{([^}]*)\}/gs)]
            .map((match) => match[1])
            .find((rule) => /display:\s*grid;/.test(rule)) ?? "";
    const stateRule =
        [...template.matchAll(/\.ch-fusion-equipment-state\s*\{([^}]*)\}/gs)]
            .map((match) => match[1])
            .find((rule) => /display:\s*inline-block;/.test(rule)) ?? "";
    const mobileCandidateRule = template.match(
        /@media\s*\(max-width:\s*600px\)\s*\{\s*\.ch-fusion-candidate\s*\{([^}]*)\}/s
    )?.[1];
    assert.ok(
        template.includes('class="ch-fusion-equipment-state"'),
        "Fusion candidates should give the equipped-state text a dedicated typography class"
    );
    assert.ok(
        /\.ch-fusion-candidate\s*\{[^}]*font:\s*inherit;/s.test(template),
        "Fusion candidates should inherit the app font instead of the desktop browser button font"
    );
    assert.ok(
        /\.ch-fusion-equipment-state\s*\{[^}]*display:\s*inline-block;[^}]*line-height:\s*1\.2;[^}]*white-space:\s*nowrap;/s.test(
            template
        ),
        "Fusion equipped-state text should remain on one readable line"
    );
    assert.match(
        candidateRule,
        /grid-template-rows:\s*auto\s+auto\s+minmax\(/,
        "Fusion candidates should reserve a dedicated third grid row for the equipped-state text"
    );
    assert.match(
        stateRule,
        /min-height:\s*[\d.]+rem;/,
        "Fusion equipped-state text should reserve its own readable line height"
    );
    assert.ok(
        mobileCandidateRule,
        "Fusion candidates should define a mobile layout rule instead of relying on implicit grid sizing"
    );
    const mobileCandidateMinHeight = Number(mobileCandidateRule.match(/min-height:\s*(\d+)px;/)?.[1]);
    assert.ok(
        mobileCandidateMinHeight >= 68,
        "Mobile fusion candidates should reserve enough height for name, stats, state, padding, and a 40px touch target"
    );
    console.log("[fusion-equipped-label-typography] ok");
}

function loadCollectionComponentFactory(path, expectedName, factories) {
    const source = readSource(path);
    const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script, `${path} should define its Alpine component script`);
    Function(script)();
    assert.equal(typeof factories[expectedName], "function", `${path} should register ${expectedName}`);
    return factories[expectedName];
}

function restoreGlobalProperty(name, descriptor) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
}

function testCollectionEquipmentPanelsShareHubState() {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const originalAlpine = Object.getOwnPropertyDescriptor(globalThis, "Alpine");
    const factories = {};
    const components = {};
    const calls = [];
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

    try {
        Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: {
                createGameUI(name, factory) {
                    factories[name] = factory;
                }
            }
        });
        Object.defineProperty(globalThis, "Alpine", {
            configurable: true,
            value: {
                reactive(value) {
                    return value;
                },
                store(name) {
                    assert.equal(name, "uiManager", "Collection child components should only request uiManager");
                    return uiManager;
                }
            }
        });

        const createHub = loadCollectionComponentFactory(
            "src/components/collection-hub.html",
            "collectionHub",
            factories
        );
        const hub = createHub();
        hub.$root = { focus() {}, querySelector() {} };
        components.collectionHub = hub;
        hub.init();
        hub.state.equipment = {
            enhancementStones: 30,
            fusion: {
                sourceItemCount: 1,
                recipes: [
                    {
                        rarity: "common",
                        items: [{ instanceId: "source-1", isEquipped: false }],
                        cost: { stones: 10, shards: 20 }
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
            components.collectionFusionDialog.state.selection.rarity,
            "common",
            "Fusion should select its first recipe"
        );
        components.collectionFusionDialog.toggleItem("source-1");
        components.collectionFusionDialog.fuseSelectedItems();
        assert.deepEqual(
            calls.at(-1),
            ["fuseEquipmentItems", [["source-1"]]],
            "Fusion should use the game action bridge"
        );
        assert.equal(
            components.collectionFusionDialog.state.visible,
            false,
            "Fusion should hide after a submitted selection"
        );

        components.collectionEquipmentPanel.openShop();
        assert.equal(components.collectionShopPanel.state.visible, true, "Equipment panel should open the shop panel");
        hub.close();
        assert.equal(components.collectionShopPanel.state.visible, false, "Closing the hub should hide the shop panel");
        assert.equal(
            components.collectionFusionDialog.state.visible,
            false,
            "Closing the hub should reset the fusion dialog"
        );
    } finally {
        restoreGlobalProperty("window", originalWindow);
        restoreGlobalProperty("Alpine", originalAlpine);
    }

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
            overlay.includes('@click="huntingUsePreparationConsumable(item.id)"') &&
            overlay.includes('@click="huntingStartPreparedBattle()"'),
        "Battle preparation must remain inside the hunting overlay"
    );
    assert.ok(
        bridge.includes("huntingUsePreparationConsumable(consumableId)") &&
            bridge.includes("huntingStartPreparedBattle()"),
        "Component bridge must expose preparation actions"
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
            overlay.includes('@click="showHuntingCombatResultSummary()"'),
        "Normal hunting wins must split XP and combat status into two locally owned result cards"
    );
    assert.ok(
        overlay.includes("this.resetHuntingCombatResult();") && overlay.includes('huntingCombatResultStep = "summary"'),
        "Advancing or leaving the post-combat cards must reset their display-only state before hunting continues"
    );
    console.log("[hunting-overlay-action-contracts] ok");
}

function testResultOverlayLayoutContract() {
    const overlay = readSource("src/components/game-overlay.html");
    const huntingOverlay = readSource("src/components/hunting-overlay.html");
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
            /:scope\.hunting-merchant-active \.hunting-overlay-frame,\s*:scope\.hunting-chest-active \.hunting-overlay-frame,\s*:scope\.hunting-event-active \.hunting-overlay-frame,\s*:scope\.hunting-battle-preparation-active \.hunting-overlay-frame\s*\{([^}]*)\}/s
        )?.[1] ?? "";
    assert.match(
        huntingFrameRule,
        /width:\s*100%;[\s\S]*height:\s*100%;[\s\S]*display:\s*grid;[\s\S]*place-items:\s*center;/,
        "Standalone hunting overlays must use the full available area before centering their card"
    );
    assert.doesNotMatch(
        huntingFrameRule,
        /(?:\b\d+px\b|calc\()/,
        "Standalone hunting frame must not use fixed container dimensions"
    );
    const huntingCardRule =
        huntingOverlay.match(
            /:scope\.hunting-merchant-active \.hunting-overlay-card,\s*:scope\.hunting-chest-active \.hunting-overlay-card,\s*:scope\.hunting-event-active \.hunting-overlay-card,\s*:scope\.hunting-battle-preparation-active \.hunting-overlay-card\s*\{([^}]*)\}/s
        )?.[1] ?? "";
    assert.match(
        huntingCardRule,
        /width:\s*fit-content;[\s\S]*max-width:\s*100%;[\s\S]*max-height:\s*100%;[\s\S]*box-sizing:\s*border-box;/,
        "Standalone hunting cards must size to their content while staying inside the fluid shared frame"
    );
    assert.doesNotMatch(
        huntingCardRule,
        /(?:\b\d+px\b|calc\()/,
        "Standalone hunting cards must not use fixed container dimensions"
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
        /grid-column:\s*2;[\s\S]*width:\s*100%;[\s\S]*max-height:\s*100%;[\s\S]*box-sizing:\s*border-box;/,
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
        /width:\s*100%;[\s\S]*box-sizing:\s*border-box;[\s\S]*max-height:\s*100%;/,
        "Result card border and padding must stay inside the shared frame"
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
    console.log("[result-overlay-layout-contract] ok");
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
    assert.ok(template.includes("toggleRebirthCardEquip"), "Character detail should expose card equip controls");
    assert.ok(template.includes("maxEquippedCards"), "Character detail should display the three-card loadout limit");
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
    console.log("[collection-rebirth-and-developer-contracts] ok");
}

testHuntingMerchantMobileScrollContract();
testHuntingChestIconReuseContract();
testCollectionEquipmentPanelsOwnTheirFlows();
testDailyShopPopupContract();
testFusionEquippedLabelTypographyContract();
testCollectionEquipmentPanelsShareHubState();
testCollectionDetailContracts();
testPopupCloseOwnershipContract();
testGameplayUiResetContracts();
testNoWindowUiManagerInProduction();
testAlpineTemplateUiManagerContracts();
testHuntingOverlayActionContracts();
testResultOverlayLayoutContract();
testCollectionRebirthAndDeveloperContracts();

console.log("ui contract tests ok");
