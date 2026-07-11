import { COLLECTION_HUB_TABS } from "./collection/collectionViewModel.js";

export class CollectionHubService {
    static render(vm) {
        window.uiManager.requireComponent("collectionHub").render({
            ...vm,
            tabs: [...COLLECTION_HUB_TABS]
        });
    }

    static open(tabId) {
        window.uiManager.requireComponent("collectionHub").open(tabId);
    }

    static close() {
        window.uiManager.requireComponent("collectionHub").close();
    }
}
