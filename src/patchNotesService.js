import { dismissPatchNotes as _dismissPatchNotes } from "./utils.js";

export class PatchNotesService {
    static show(entries) {
        window.uiManager.requireComponent("patchNotes").show(entries);
    }

    static dismiss() {
        window.uiManager.requireComponent("patchNotes").dismissNotes();
        _dismissPatchNotes();
    }
}
