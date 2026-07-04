import { dismissPatchNotes } from "./utils.js";

let _entries = null;

export class PatchNotesService {
    static show(entries) {
        _entries = entries;
        Alpine.store("patchNotes", { entries, visible: true });
    }

    static dismiss() {
        Alpine.store("patchNotes", { visible: false, entries: [] });
        dismissPatchNotes();
    }
}
