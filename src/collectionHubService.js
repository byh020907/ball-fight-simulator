import { COLLECTION_HUB_TABS } from "./collection/collectionViewModel.js";

export class CollectionHubService {
    static render(vm) {
        requireGameUIComponent("collectionHub").render({
            ...vm,
            tabs: [...COLLECTION_HUB_TABS]
        });
    }

    static open(tabId) {
        requireGameUIComponent("collectionHub").open(tabId);
    }

    static close() {
        requireGameUIComponent("collectionHub").close();
    }
}
