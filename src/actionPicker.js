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
        const store = typeof Alpine !== "undefined" ? Alpine.store("actionPicker") : null;
        if (store?._resolve) return cards[0]?.id ?? null;

        return new Promise((resolve) => {
            const cb = (index) => {
                const s = typeof Alpine !== "undefined" ? Alpine.store("actionPicker") : null;
                if (s) {
                    s._resolve = null;
                    s.visible = false;
                    s.cards = [];
                }
                resolve(cards[index]?.id ?? cards[0]?.id ?? null);
            };
            Alpine.store("actionPicker", {
                cards: cards.map((c) => ({
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    hpCost: c.hpCostPercent
                })),
                visible: true,
                _resolve: cb
            });
        });
    }

    static resolve(index) {
        const store = typeof Alpine !== "undefined" ? Alpine.store("actionPicker") : null;
        if (store?._resolve) store._resolve(index);
    }
}
