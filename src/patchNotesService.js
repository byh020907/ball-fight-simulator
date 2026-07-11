import { dismissPatchNotes as _dismissPatchNotes } from "./utils.js";

export class PatchNotesService {
    static show(entries) {
        Alpine.store("uiManager").requireComponent("patchNotes").show(entries);
    }

    static dismiss() {
        Alpine.store("uiManager").requireComponent("patchNotes").dismissNotes();
        _dismissPatchNotes();
    }
}
