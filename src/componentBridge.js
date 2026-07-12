import {
    equipEquipmentItem,
    expandInventory as expandEquipmentInventory,
    disassembleEquipment,
    sellEquipment,
    fuseEquipment,
    enhanceEquipment,
    canFuseEquipment,
    getCharacterEquipmentLevel,
    getEquipmentRequiredLevel
} from "./hunting/equipmentConfig.js";
import { openHuntingChest } from "./hunting/chestRewards.js";
import { savePlayerProfile } from "./playerProfile.js";
import { PopupService } from "./popup.js";
import { HELP_TITLE, HELP_CONTENT } from "./helpContent.js";
import { CollectionHubService } from "./collectionHubService.js";
import { createCollectionActionPopupOptions } from "./collection/collectionActionPopup.js";

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

        fuseItem(instanceId) {
            const profile = app.playerProfile;
            if (!canFuseEquipment(profile, instanceId)) {
                PopupService.show({
                    title: "합성 불가",
                    bodyHtml: `<p>파편, 강화석 부족 또는 같은 등급의 파트너 장비가 없습니다.</p>`,
                    buttons: [{ text: "확인", value: "ok", primary: true }]
                });
                return;
            }
            const result = fuseEquipment(profile, instanceId);
            if (result && !result.error) {
                refreshCollectionAndProfile();
            }
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
        }
    };
}
