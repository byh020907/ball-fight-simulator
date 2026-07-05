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
        }
    };
}
