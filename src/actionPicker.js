let _resolve = null;

export class ActionPickerService {
    /**
     * 카드 선택 UI를 표시하고 사용자가 선택한 액션 ID를 반환합니다.
     * @param {{ id:string, name:string, description:string, hpCostPercent:number }[]} cards
     * @returns {Promise<string|null>}
     */
    static async show(cards) {
        if (typeof document === "undefined" || !document.addEventListener) {
            return cards[0]?.id ?? null;
        }
        if (_resolve) return cards[0]?.id ?? null;

        return new Promise((resolve) => {
            _resolve = (index) => {
                const r = _resolve;
                _resolve = null;
                Alpine.store("actionPicker", { visible: false, cards: [] });
                resolve(cards[index]?.id ?? cards[0]?.id ?? null);
            };
            Alpine.store("actionPicker", {
                cards: cards.map((c) => ({
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    hpCost: c.hpCostPercent
                })),
                visible: true
            });
        });
    }

    static resolve(index) {
        if (_resolve) _resolve(index);
    }
}
