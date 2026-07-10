export class ActionPickerService {
    static async show(cards) {
        if (typeof document === "undefined" || !document.addEventListener) {
            return cards[0]?.id ?? null;
        }
        const picker = window.gameBridge?.get("actionPicker");
        if (!picker) return cards[0]?.id ?? null;
        const pickedIndex = await picker.show(cards);
        return cards[pickedIndex]?.id ?? null;
    }
}
