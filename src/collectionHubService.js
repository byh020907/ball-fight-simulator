import { COLLECTION_HUB_TABS } from "./collection/collectionViewModel.js";

export class CollectionHubService {
    static render(vm) {
        Alpine.store("uiManager")
            .requireComponent("collectionHub")
            .render({
                ...vm,
                tabs: [...COLLECTION_HUB_TABS]
            });
    }

    static open(tabId) {
        Alpine.store("uiManager").requireComponent("collectionHub").open(tabId);
    }

    static close() {
        Alpine.store("uiManager").requireComponent("collectionHub").close();
    }
}
