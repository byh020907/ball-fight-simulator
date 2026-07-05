import { HELP_CONTENT, HELP_TITLE } from "./helpContent.js";

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
            getAppStore()?.openCollectionHub?.(tabId);
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
        async openChest(chestId) {
            await globalThis.CollectionHubService?.openChest?.(chestId);
        },
        equipItem(instanceId) {
            const app = getGameApp();
            if (!app?.playerProfile?.equipment) return false;
            const item = app.playerProfile.equipment.inventory.find((i) => i.instanceId === instanceId);
            if (!item) return false;
            const slot = item.slot;
            if (slot === "accessory") {
                if (!app.playerProfile.equipment.equipped.accessory1) {
                    app.playerProfile.equipment.equipped.accessory1 = instanceId;
                } else if (!app.playerProfile.equipment.equipped.accessory2) {
                    app.playerProfile.equipment.equipped.accessory2 = instanceId;
                } else {
                    return false;
                }
            } else {
                app.playerProfile.equipment.equipped[slot] = instanceId;
            }
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
                    app._refreshCollectionHub?.();
                    return true;
                }
            }
            return false;
        }
    };
}
