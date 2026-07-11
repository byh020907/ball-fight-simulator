import { dismissPatchNotes as _dismissPatchNotes } from "./utils.js";

export class PatchNotesService {
    static show(entries) {
        const notes = window.gameBridge?.get("patchNotes");
        if (notes) notes.show(entries);
    }

    static dismiss() {
        const notes = window.gameBridge?.get("patchNotes");
        if (notes) notes.dismissNotes();
        _dismissPatchNotes();
    }
}
