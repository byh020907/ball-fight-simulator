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
    const collectionHub = readSource("src/components/collection-hub.html");
    assert.ok(chestIcon.includes('chest-icon[data-rarity="rare"]'), "Chest icon should own rarity color variants");
    assert.ok(overlay.includes("<chest-icon"), "Hunting chest event should render the shared chest icon");
    assert.ok(
        collectionHub.includes("ch-shop-chest"),
        "The shop should render the shared chest icon for its chest offer"
    );
    console.log("[hunting-chest-icon-reuse] ok");
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
testCollectionDetailContracts();
testPopupCloseOwnershipContract();
testGameplayUiResetContracts();
testNoWindowUiManagerInProduction();
testAlpineTemplateUiManagerContracts();
testHuntingOverlayActionContracts();
testResultOverlayLayoutContract();
testCollectionRebirthAndDeveloperContracts();

console.log("ui contract tests ok");
