import { COLLECTION_HUB_TABS } from "./collection/collectionViewModel.js";

export class CollectionHubService {
    static render(vm) {
        const hub = window.gameBridge?.get("collectionHub");
        if (!hub) return;
        hub.render({
            ...vm,
            tabs: [...COLLECTION_HUB_TABS]
        });
    }

    static open(tabId) {
        const hub = window.gameBridge?.get("collectionHub");
        if (hub) hub.open(tabId);
    }

    static close() {
        const hub = window.gameBridge?.get("collectionHub");
        if (hub) hub.close();
    }
}
