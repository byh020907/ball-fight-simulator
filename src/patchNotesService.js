import { dismissPatchNotes as _dismissPatchNotes } from "./utils.js";

export class PatchNotesService {
    static show(entries) {
        requireGameUIComponent("patchNotes").show(entries);
    }

    static dismiss() {
        requireGameUIComponent("patchNotes").dismissNotes();
        _dismissPatchNotes();
    }
}
