export class RebirthPickerService {
    static _testPicker = null;

    static setTestPicker(picker) {
        RebirthPickerService._testPicker = picker;
    }

    static _getPicker() {
        if (RebirthPickerService._testPicker) return RebirthPickerService._testPicker;
        if (typeof Alpine !== "undefined") return Alpine.store("uiManager").getComponent("rebirthPicker") ?? null;
        return null;
    }

    static async show(cards) {
        const picker = RebirthPickerService._getPicker();
        if (!picker) {
            throw new Error(
                "RebirthPickerService.show: rebirthPicker가 uiManager에 등록되지 않았습니다. " +
                    "Alpine 컴포넌트 rebirth-picker가 로드되었는지 확인하세요."
            );
        }
        const pickedIndex = await picker.show(cards);
        return cards[pickedIndex]?.id ?? null;
    }
}
