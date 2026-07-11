export class ActionPickerService {
    static async show(cards) {
        if (typeof document === "undefined" || !document.addEventListener) {
            return cards[0]?.id ?? null;
        }
        const picker = typeof Alpine !== "undefined" ? Alpine.store("uiManager").getComponent("actionPicker") : null;
        if (!picker) return cards[0]?.id ?? null;
        const pickedIndex = await picker.show(cards);
        return cards[pickedIndex]?.id ?? null;
    }
}
