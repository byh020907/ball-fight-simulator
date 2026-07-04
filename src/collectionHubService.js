import { COLLECTION_HUB_TABS } from "./collection/collectionViewModel.js";

export class CollectionHubService {
    static render(vm) {
        const data = Alpine.store("collectionHub") || {};
        data.rosterItems = vm.rosterItems;
        data.masteryItems = vm.masteryItems;
        data.achievementItems = vm.achievementItems;
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
}
