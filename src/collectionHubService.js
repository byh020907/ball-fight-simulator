import { COLLECTION_HUB_TABS } from "./collection/collectionViewModel.js";

export class CollectionHubService {
    static render(vm) {
        const data = Alpine.store("collectionHub") || {};
        data.rosterItems = vm.rosterItems;
        data.masteryItems = vm.masteryItems;
        data.achievementItems = vm.achievementItems;
        data.equipment = vm.equipment;
        data.storage = vm.storage;
        data.summary = vm.summary;
        data.tabs = [...COLLECTION_HUB_TABS];
        Alpine.store("collectionHub", { ...data });
    }

    static open(tabId) {
        const data = Alpine.store("collectionHub") || {};
        data.visible = true;
        data.activeTab = tabId || "roster";
        Alpine.store("collectionHub", { ...data });
    }

    static close() {
        const data = Alpine.store("collectionHub") || {};
        data.visible = false;
        data.selectedCharacterId = null;
        Alpine.store("collectionHub", { ...data });
    }

    static async openChest(chestId) {
        const app = globalThis.ballFightApp;
        if (!app?.playerProfile?.hunting) return;

        const { openHuntingChest } = await import("./hunting/chestRewards.js");
        const { savePlayerProfile } = await import("./playerProfile.js");

        const result = openHuntingChest(app.playerProfile, chestId);
        if (!result.opened) {
            const msg =
                result.reason === "not_enough_shards"
                    ? `파편이 부족합니다 (필요: ${result.cost})`
                    : "상자를 찾을 수 없습니다.";
            globalThis.PopupService?.show?.({ title: "개봉 실패", bodyHtml: `<p>${msg}</p>` });
            return;
        }

        savePlayerProfile(app.playerProfile);
        app._refreshCollectionHub?.();

        let bodyHtml = "";
        if (result.applied.shards > 0) {
            bodyHtml += `<p>파편 +${result.applied.shards} (보유: ${result.currentShards})</p>`;
        }
        if (result.applied.equipment) {
            const eq = result.applied.equipment;
            const statsText = eq.stats.map((s) => `${s.type} +${s.value}`).join(", ");
            bodyHtml += `<p><strong>${eq.name}</strong> (${eq.rarity})<br><span style="font-size:0.8rem">${eq.description} · ${statsText}</span></p>`;
        }

        globalThis.PopupService?.show?.({
            title: "상자 개봉 결과",
            bodyHtml
        });
    }
}
