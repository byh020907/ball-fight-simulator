import {
    equipEquipmentItem,
    expandInventory as expandEquipmentInventory,
    disassembleEquipment,
    sellEquipment,
    fuseEquipment,
    enhanceEquipment,
    getCharacterEquipmentLevel,
    getEquipmentRequiredLevel
} from "./hunting/equipmentConfig.js";
import { openHuntingChest } from "./hunting/chestRewards.js";
import {
    buyDailyShopChest as purchaseDailyShopChest,
    rerollDailyShop as refreshDailyShopOffer
} from "./hunting/dailyShop.js";
import {
    buyConsumable as purchaseConsumable,
    upgradeHuntingConsumableUseLimit as upgradeConsumableUseLimit
} from "./consumables.js";
import { savePlayerProfile } from "./playerProfile.js";
import { PopupService } from "./popup.js";
import { HELP_TITLE, HELP_CONTENT } from "./helpContent.js";
import { CollectionHubService } from "./collectionHubService.js";
import { createCollectionActionPopupOptions } from "./collection/collectionActionPopup.js";
import { beginRebirth, completeRebirth, toggleRebirthCardEquip } from "./rebirth/rebirthService.js";
import {
    recordDeveloperTournamentWin,
    setDeveloperCharacterToMaxLevel,
    setDeveloperRebirthCount
} from "./developer/developerTools.js";

export function createComponentBridge(app) {
    function showLevelLockPopup(item) {
        const requiredLevel = getEquipmentRequiredLevel(item);
        const charLevel = getCharacterEquipmentLevel(app.playerProfile, app.playerFighterId);
        PopupService.show({
            title: "레벨 부족",
            bodyHtml: `<p>요구 레벨: ${requiredLevel}<br>현재 레벨: ${charLevel}</p>`,
            buttons: [{ text: "확인", value: "ok", primary: true }]
        });
    }

    function refreshCollectionAndProfile() {
        app._refreshCollectionHub();
        app.refreshPlayerSetup();
        savePlayerProfile(app.playerProfile);
    }

    function finishRebirth(characterId, cardId) {
        if (!app.lifecycle.isSetup) return { ok: false, error: "not_setup" };
        const result = completeRebirth(app.playerProfile, characterId, cardId);
        if (!result.ok) return result;
        refreshCollectionAndProfile();
        PopupService.show({
            title: "환생 완료",
            bodyHtml: `<p>${result.reward.name} 보상을 얻었습니다.</p><p>해당 캐릭터의 XP는 Lv.1부터 다시 시작합니다.</p>`,
            buttons: [{ text: "확인", value: "ok", primary: true }]
        });
        return result;
    }

    return {
        // ── Tournament/Setup actions ──
        startTournament() {
            return app.startTournament();
        },
        setGameMode(mode) {
            return app.setGameMode(mode);
        },
        adjustStat(key, delta) {
            return app.adjustStat(key, delta);
        },
        randomAllocation() {
            return app.randomAllocation();
        },
        resetAllocation() {
            return app.resetAllocation();
        },
        adjustChallengeLevel(delta) {
            return app.adjustChallengeLevel(delta);
        },

        // ── Hunting actions ──
        openHuntingStageSelect() {
            return app.hunting.showStageSelect();
        },
        huntingRetreat() {
            return app.hunting.retreat();
        },
        huntingAdvance() {
            return app.hunting.advance();
        },
        huntingMerchantChoose(idx) {
            return app.hunting.merchantChoose(idx);
        },
        huntingMerchantPass() {
            return app.hunting.merchantPass();
        },
        huntingChestContinue() {
            return app.hunting.chestContinue();
        },
        huntingEventContinue() {
            return app.hunting.eventContinue();
        },
        huntingUsePreparationConsumable(consumableId) {
            return app.hunting.usePreparationConsumable(consumableId);
        },
        huntingStartPreparedBattle() {
            return app.hunting.startPreparedBattle();
        },

        // ── Help action ──
        openHelp() {
            PopupService.show({
                title: HELP_TITLE,
                bodyHtml: HELP_CONTENT
            });
        },

        // ── Equipment actions ──
        expandInventory() {
            const profile = app.playerProfile;
            const result = expandEquipmentInventory(profile);
            if (result) {
                refreshCollectionAndProfile();
            } else {
                PopupService.show({
                    title: "확장 불가",
                    bodyHtml: `<p>파편이 부족하거나 최대 인벤토리입니다.</p>`,
                    buttons: [{ text: "확인", value: "ok", primary: true }]
                });
            }
            return result;
        },

        equipItem(instanceId) {
            const profile = app.playerProfile;
            const result = equipEquipmentItem(profile, instanceId, app.playerFighterId);
            if (!result) return;
            if (result.error === "level") {
                showLevelLockPopup(result.item);
                return;
            }
            if (result.error === "slot_full") {
                PopupService.show({
                    title: "슬롯 부족",
                    bodyHtml: `<p>해당 슬롯이 이미 찼습니다.</p>`,
                    buttons: [{ text: "확인", value: "ok", primary: true }]
                });
                return;
            }
            refreshCollectionAndProfile();
        },

        unequipItem(instanceId) {
            const profile = app.playerProfile;
            const eq = profile?.equipment;
            if (!eq || !Array.isArray(eq.inventory)) return;
            const equipped = eq.equipped ?? {};
            for (const slot of Object.keys(equipped)) {
                if (equipped[slot] === instanceId) {
                    equipped[slot] = null;
                    refreshCollectionAndProfile();
                    return;
                }
            }
        },

        enhanceItem(instanceId) {
            const profile = app.playerProfile;
            const result = enhanceEquipment(profile, instanceId);
            if (!result) return;
            if (!result.error) {
                refreshCollectionAndProfile();
            }
            PopupService.show(createCollectionActionPopupOptions("enhance", result));
            return result;
        },

        fuseEquipmentItems(sourceInstanceIds) {
            const profile = app.playerProfile;
            const result = fuseEquipment(profile, sourceInstanceIds);
            if (result && !result.error) {
                refreshCollectionAndProfile();
            }
            if (result) {
                PopupService.show(createCollectionActionPopupOptions("fusion", result));
            }
            return result;
        },

        disassembleItem(instanceId) {
            const profile = app.playerProfile;
            const result = disassembleEquipment(profile, instanceId);
            if (result) {
                refreshCollectionAndProfile();
                PopupService.show(createCollectionActionPopupOptions("disassemble", result));
            }
            return result;
        },

        sellItem(instanceId) {
            const profile = app.playerProfile;
            const result = sellEquipment(profile, instanceId);
            if (result) {
                refreshCollectionAndProfile();
                PopupService.show(createCollectionActionPopupOptions("sell", result));
            }
            return result;
        },

        // ── Collection navigation actions ──
        openCollectionHub(tabId) {
            CollectionHubService.open(tabId || "roster");
        },
        openEquipmentHub() {
            CollectionHubService.open("equipment");
        },
        enterDebugMode() {
            if (!app.enableDebugMode()) return { ok: false, error: "not_setup" };
            return { ok: true };
        },
        exitDebugMode() {
            if (!app.disableDebugMode()) return { ok: false, error: "debug_disabled" };
            return { ok: true };
        },
        setDebugCharacterToMaxLevel(characterId) {
            if (!app.isDebugModeActive()) return { ok: false, error: "debug_disabled" };
            const result = setDeveloperCharacterToMaxLevel(app.playerProfile, characterId);
            if (result.ok) refreshCollectionAndProfile();
            return result;
        },
        setDebugRebirthCount(characterId, rebirthCount) {
            if (!app.isDebugModeActive()) return { ok: false, error: "debug_disabled" };
            const result = setDeveloperRebirthCount(app.playerProfile, characterId, rebirthCount);
            if (result.ok) refreshCollectionAndProfile();
            return result;
        },
        recordDebugTournamentWin(characterId) {
            if (!app.isDebugModeActive()) return { ok: false, error: "debug_disabled" };
            const result = recordDeveloperTournamentWin(app.playerProfile, characterId);
            if (result.ok) refreshCollectionAndProfile();
            return result;
        },
        startDebugHunting(characterId, stageId, encounterFloor) {
            if (!app.isDebugModeActive() || !app.lifecycle.isSetup) return { ok: false, error: "debug_disabled" };
            CollectionHubService.close();
            return app.hunting.startDebugRun(characterId, { stageId, encounterFloor });
        },
        beginRebirth(characterId) {
            if (!app.lifecycle.isSetup) {
                PopupService.show({
                    title: "환생 대기",
                    bodyHtml: "<p>전투와 결과 확인이 끝난 준비 화면에서 환생할 수 있습니다.</p>",
                    buttons: [{ text: "확인", value: "ok", primary: true }]
                });
                return { ok: false, error: "not_setup" };
            }
            const result = beginRebirth(app.playerProfile, characterId);
            if (!result.ok) {
                PopupService.show({
                    title: "환생 조건",
                    bodyHtml: "<p>해당 캐릭터를 Lv.10까지 성장시킨 뒤 환생할 수 있습니다.</p>",
                    buttons: [{ text: "확인", value: "ok", primary: true }]
                });
                return result;
            }
            refreshCollectionAndProfile();
            return result;
        },
        completeRebirth(characterId, cardId) {
            return finishRebirth(characterId, cardId);
        },
        toggleRebirthCardEquip(characterId, cardId) {
            if (!app.lifecycle.isSetup) return { ok: false, error: "not_setup" };
            const result = toggleRebirthCardEquip(app.playerProfile, characterId, cardId);
            if (!result.ok && result.error === "equip_limit") {
                PopupService.show({
                    title: "장착 한도",
                    bodyHtml: "<p>환생 카드는 최대 3장까지 장착할 수 있습니다.</p>",
                    buttons: [{ text: "확인", value: "ok", primary: true }]
                });
                return result;
            }
            if (result.ok) refreshCollectionAndProfile();
            return result;
        },

        // ── Chest actions ──
        openChest(chestId) {
            const profile = app.playerProfile;
            if (!profile?.hunting) return false;

            const result = openHuntingChest(profile, chestId);
            if (result.opened) {
                refreshCollectionAndProfile();
            }
            PopupService.show(createCollectionActionPopupOptions("chest", result));
            return result.opened;
        },
        buyDailyShopChest() {
            const chest = purchaseDailyShopChest(app.playerProfile);
            if (chest) refreshCollectionAndProfile();
            return chest;
        },
        rerollDailyShop() {
            const result = refreshDailyShopOffer(app.playerProfile);
            if (result) {
                app.audio.play("shop_reroll");
                refreshCollectionAndProfile();
            }
            return result;
        },
        buyConsumable(consumableId) {
            const result = purchaseConsumable(app.playerProfile, consumableId);
            if (result) refreshCollectionAndProfile();
            return result;
        },
        upgradeHuntingConsumableUseLimit() {
            const result = upgradeConsumableUseLimit(app.playerProfile);
            if (result) refreshCollectionAndProfile();
            return result;
        }
    };
}
