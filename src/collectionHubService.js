import { COLLECTION_HUB_TABS } from "./collection/collectionViewModel.js";

export class CollectionHubService {
    static render(vm) {
        const tabs = [...COLLECTION_HUB_TABS, ...(vm.developer?.active ? [{ id: "developer", label: "개발자" }] : [])];
        Alpine.store("uiManager")
            .requireComponent("collectionHub")
            .render({
                ...vm,
                tabs
            });
    }

    static open(tabId) {
        Alpine.store("uiManager").requireComponent("collectionHub").open(tabId);
    }

    static close() {
        Alpine.store("uiManager").requireComponent("collectionHub").close();
    }
}
