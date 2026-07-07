import { HELP_CONTENT, HELP_TITLE } from "./helpContent.js";
import { equipEquipmentItem } from "./hunting/equipmentConfig.js";
import { savePlayerProfile } from "./playerProfile.js";

function getAppRoot() {
    try {
        return document.querySelector(".app");
    } catch {
        return null;
    }
}

export function createComponentBridge(Alpine) {
    function getAppStore() {
        const root = getAppRoot();
        return root && Alpine?.$data ? Alpine.$data(root) : null;
    }

    function getGameApp() {
        return globalThis.ballFightApp ?? null;
    }

    return {
        adjustStat(key, delta) {
            getAppStore()?.adjustStat?.(key, delta);
        },
        randomAllocation() {
            getAppStore()?.randomAllocation?.();
        },
        resetAllocation() {
            getAppStore()?.resetAllocation?.();
        },
        adjustChallengeLevel(delta) {
            getAppStore()?.adjustChallengeLevel?.(delta);
        },
        openCollectionHub(tabId = "roster") {
            const appStore = getAppStore();
            if (appStore?.openCollectionHub) {
                appStore.openCollectionHub(tabId);
                return;
            }
            globalThis.CollectionHubService?.open?.(tabId);
        },
        openHelp() {
            globalThis.PopupService?.show?.({ title: HELP_TITLE, bodyHtml: HELP_CONTENT });
        },
        startTournament() {
            return getGameApp()?.startTournament?.();
        },
        openHuntingLobby() {
            getGameApp()?.hunting?.showCharacterSelect?.();
        },
        huntingRetreat() {
            getGameApp()?.hunting?.retreat?.();
        },
        huntingAdvance() {
            getGameApp()?.hunting?.advance?.();
        },
        huntingMerchantChoose(offerIndex) {
            getGameApp()?.hunting?.merchantChoose?.(offerIndex);
        },
        huntingMerchantPass() {
            getGameApp()?.hunting?.merchantPass?.();
        },
        async openChest(chestId) {
            await globalThis.CollectionHubService?.openChest?.(chestId);
        },
        equipItem(instanceId) {
            const app = getGameApp();
            if (!app?.playerProfile) return false;
            const result = equipEquipmentItem(app.playerProfile, instanceId, app.playerFighterId);
            if (result?.error === "level") {
                globalThis.PopupService?.show?.({
                    title: "장착 제한",
                    bodyHtml: `<p>현재 캐릭터 Lv.${result.characterLevel}에서는 ${result.item.name}을 장착할 수 없습니다.<br>필요 레벨: Lv.${result.requiredLevel}</p>`
                });
                return false;
            }
            if (!result?.item) return false;
            savePlayerProfile(app.playerProfile);
            app._refreshCollectionHub?.();
            return true;
        },
        unequipItem(instanceId) {
            const app = getGameApp();
            if (!app?.playerProfile?.equipment) return false;
            const equipped = app.playerProfile.equipment.equipped;
            for (const [slot, id] of Object.entries(equipped)) {
                if (id === instanceId) {
                    equipped[slot] = null;
                    savePlayerProfile(app.playerProfile);
                    app._refreshCollectionHub?.();
                    return true;
                }
            }
            return false;
        },
        async expandInventory() {
            const app = getGameApp();
            if (!app?.playerProfile) return false;
            const { expandInventory: doExpand } = await import("./hunting/equipmentConfig.js");
            const result = doExpand(app.playerProfile);
            if (result) {
                const { savePlayerProfile } = await import("./playerProfile.js");
                savePlayerProfile(app.playerProfile);
                app._refreshCollectionHub?.();
            }
            return result;
        },
        async disassembleItem(instanceId) {
            const app = getGameApp();
            if (!app?.playerProfile) return false;
            const { disassembleEquipment } = await import("./hunting/equipmentConfig.js");
            const result = disassembleEquipment(app.playerProfile, instanceId);
            if (result) {
                const { savePlayerProfile } = await import("./playerProfile.js");
                savePlayerProfile(app.playerProfile);
                app._refreshCollectionHub?.();
            }
            return result;
        },
        async enhanceItem(instanceId) {
            const app = getGameApp();
            if (!app?.playerProfile) return false;
            const { enhanceEquipment } = await import("./hunting/equipmentConfig.js");
            const result = enhanceEquipment(app.playerProfile, instanceId);
            if (result) {
                const { savePlayerProfile } = await import("./playerProfile.js");
                savePlayerProfile(app.playerProfile);
                app._refreshCollectionHub?.();
            }
            return result;
        },
        async fuseItem(instanceId) {
            const app = getGameApp();
            if (!app?.playerProfile) return false;
            const { fuseEquipment } = await import("./hunting/equipmentConfig.js");
            const result = fuseEquipment(app.playerProfile, instanceId);
            if (result?.item) {
                const { savePlayerProfile } = await import("./playerProfile.js");
                savePlayerProfile(app.playerProfile);
                app._refreshCollectionHub?.();
            }
            return result;
        },
        async sellItem(instanceId) {
            const app = getGameApp();
            if (!app?.playerProfile) return false;
            const { sellEquipment } = await import("./hunting/equipmentConfig.js");
            const result = sellEquipment(app.playerProfile, instanceId);
            if (result) {
                const { savePlayerProfile } = await import("./playerProfile.js");
                savePlayerProfile(app.playerProfile);
                app._refreshCollectionHub?.();
            }
            return result;
        }
    };
}
